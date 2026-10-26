#!/usr/bin/env bash
# Builds the macOS installers on this Mac, signs + notarizes them, and uploads them to the GitHub
# release — replacing the unsigned ones CI built (same file names, `--clobber`).
#
#   scripts/release-mac.sh              # version from package.json → release v<version>
#   scripts/release-mac.sh --no-upload  # only build, sign, notarize
#
# One-time setup (see ../docs or the CODE_SIGNING_PLAN):
#   1. "Developer ID Application" certificate in your login keychain (Flixlar uses the same).
#   2. Notarization credentials stored in the keychain:
#        xcrun notarytool store-credentials gifmeta-notary \
#          --apple-id <apple-id> --team-id 24Z4BBBVR5      # asks for an app-specific password
#      (or --key AuthKey_XXX.p8 --key-id <id> --issuer <issuer-id> for an App Store Connect API key)
#   3. GitHub CLI logged in: gh auth login
set -euo pipefail
cd "$(dirname "$0")/.."

: "${APPLE_SIGNING_IDENTITY:=Developer ID Application: Mads Paaskesen (24Z4BBBVR5)}"
: "${NOTARY_PROFILE:=gifmeta-notary}"
export APPLE_SIGNING_IDENTITY
UPLOAD=1
[[ "${1:-}" == "--no-upload" ]] && UPLOAD=0

VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"
echo "🔏 GIFmeta $TAG — signing as: $APPLE_SIGNING_IDENTITY"
security find-identity -v -p codesigning | grep -q "$APPLE_SIGNING_IDENTITY" ||
  { echo "❌ Certificate not found in the keychain: $APPLE_SIGNING_IDENTITY"; exit 1; }
# Fail fast (before a long build) when the notarization credentials are missing.
xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" >/dev/null 2>&1 || {
  echo "❌ No notarization profile '$NOTARY_PROFILE' in the keychain. Create it once with:"
  echo "   xcrun notarytool store-credentials $NOTARY_PROFILE --apple-id <apple-id> --team-id 24Z4BBBVR5"
  echo "   (asks for an app-specific password from account.apple.com)"
  exit 1
}

FILES=()
for TARGET in aarch64-apple-darwin x86_64-apple-darwin; do
  echo "▶ Building $TARGET"
  rustup target add "$TARGET" >/dev/null
  # Tauri signs the .app (hardened runtime) because APPLE_SIGNING_IDENTITY is set.
  # Notarization is done below on the .dmg, so no APPLE_ID / APPLE_API_* here.
  env -u APPLE_ID -u APPLE_API_KEY npm run tauri build -- --target "$TARGET" --bundles dmg
  DMG=$(ls -t src-tauri/target/"$TARGET"/release/bundle/dmg/*.dmg | head -1)

  echo "▶ Notarizing $(basename "$DMG") (takes a few minutes)"
  xcrun notarytool submit "$DMG" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$DMG"
  spctl -a -vvv -t install "$DMG"
  FILES+=("$DMG")
done

if [[ $UPLOAD == 1 ]]; then
  # CI's release build uploads files with the same names — if it is still running it would
  # overwrite the signed ones afterwards.
  CI_STATUS=$(gh run list --workflow release.yml --limit 1 --json status -q '.[0].status' 2>/dev/null || echo unknown)
  if [[ "$CI_STATUS" != "completed" ]]; then
    echo "⏳ The release workflow is '$CI_STATUS' — wait until it is done, then run:"
    echo "   gh release upload $TAG ${FILES[*]} --clobber"
    exit 1
  fi
  echo "▶ Uploading to release $TAG (replaces CI's unsigned files)"
  gh release upload "$TAG" "${FILES[@]}" --clobber
fi
echo "✅ Done:"; printf '   %s\n' "${FILES[@]}"
