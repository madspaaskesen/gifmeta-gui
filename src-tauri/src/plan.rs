//! Saving an edited frame list ("plan") with gifmeta.
//!
//! The GUI lets the user delete, duplicate, insert and re-order frames freely. gifmeta's
//! `--order` can't be combined with delete / insert / duplicate, so a plan is written in two
//! passes:
//!
//! 1. **build** – keep the frames the plan uses (delete the rest), add copies for frames used
//!    more than once, append inserted images; also re-key / unoptimize / loop.
//! 2. **arrange** – put the frames of pass 1 in plan order and set every delay.
//!
//! Both passes use gifmeta's shadow simulation, so frame-optimized GIFs stay pixel-exact; pass 2
//! copies frames losslessly wherever the order didn't change.

use std::collections::{BTreeSet, HashMap};
use std::path::{Path, PathBuf};

use gifmeta::{CreateOptions, DeleteMode, FrameInsert, LoopMode, ModOptions, ModReport};

/// One frame of the result: an original frame (0-based index) or an image file.
#[derive(Debug, Clone, PartialEq, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanItem {
    pub frame: Option<usize>,
    pub image: Option<String>,
    /// Delay in centiseconds.
    pub delay: u16,
}

/// Global settings for a save.
#[derive(Debug, Clone, Default)]
pub struct PlanSettings {
    pub loop_mode: Option<LoopMode>,
    /// Original indices to write as full images.
    pub keyframes: Vec<usize>,
    pub unoptimize: bool,
}

/// What a save did (sent back to the UI).
#[derive(Debug, Clone, Default, PartialEq, serde::Serialize)]
pub struct SaveReport {
    pub output: String,
    pub frames_in: usize,
    pub frames_out: usize,
    pub deleted: Vec<usize>,
    pub rekeyed: Vec<usize>,
    pub quantized: Vec<usize>,
    pub inserted: usize,
    pub duplicated: usize,
    pub reordered: bool,
    pub warnings: Vec<String>,
}

impl From<ModReport> for SaveReport {
    fn from(r: ModReport) -> Self {
        SaveReport {
            output: r.output.display().to_string(),
            frames_in: r.frames_in,
            frames_out: r.frames_out,
            warnings: r.warnings(),
            deleted: r.deleted,
            rekeyed: r.rekeyed,
            quantized: r.quantized,
            inserted: r.inserted,
            duplicated: r.duplicated.len(),
            reordered: r.reordered,
        }
    }
}

enum Source<'a> {
    Frame(usize),
    Image(&'a str),
}

fn source(item: &PlanItem) -> Result<Source<'_>, String> {
    match (item.frame, item.image.as_deref()) {
        (Some(i), None) => Ok(Source::Frame(i)),
        (None, Some(p)) => Ok(Source::Image(p)),
        _ => Err("Each plan item needs either a frame index or an image path".into()),
    }
}

/// The pass-1 layout: which plan item ends up at which position of the intermediate GIF.
struct Layout {
    /// Original frames not used by the plan.
    deleted: Vec<usize>,
    /// Extra copies (an index once per extra use).
    duplicates: Vec<usize>,
    /// Images in plan order (appended after the last frame in pass 1).
    images: Vec<PathBuf>,
    /// For every plan item: its position in the pass-1 output.
    positions: Vec<usize>,
}

fn layout(plan: &[PlanItem], frame_count: usize) -> Result<Layout, String> {
    let mut uses = vec![0usize; frame_count];
    let mut images = Vec::new();
    for item in plan {
        match source(item)? {
            Source::Frame(i) if i >= frame_count => {
                return Err(format!(
                    "Frame {i} out of range (the GIF has {frame_count} frames)"
                ))
            }
            Source::Frame(i) => uses[i] += 1,
            Source::Image(p) => images.push(PathBuf::from(p)),
        }
    }
    // Pass 1 writes the kept frames in original order (copies right after their frame), then
    // the images. Hand out those positions to the plan items.
    let mut next_pos: Vec<usize> = vec![0; frame_count];
    let mut pos = 0;
    for (i, &n) in uses.iter().enumerate() {
        next_pos[i] = pos;
        pos += n;
    }
    let mut next_image = pos;
    let mut positions = Vec::with_capacity(plan.len());
    for item in plan {
        match source(item)? {
            Source::Frame(i) => {
                positions.push(next_pos[i]);
                next_pos[i] += 1;
            }
            Source::Image(_) => {
                positions.push(next_image);
                next_image += 1;
            }
        }
    }
    Ok(Layout {
        deleted: (0..frame_count).filter(|&i| uses[i] == 0).collect(),
        duplicates: uses
            .iter()
            .enumerate()
            .flat_map(|(i, &n)| std::iter::repeat_n(i, n.saturating_sub(1)))
            .collect(),
        images,
        positions,
    })
}

fn temp_path() -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("gifmeta-gui-{}-{nanos}.gif", std::process::id()))
}

/// Writes `plan` (frames of `input` and/or image files, in order, with delays) to `output`.
pub fn save_plan(
    input: &Path,
    output: &Path,
    plan: &[PlanItem],
    settings: &PlanSettings,
) -> Result<SaveReport, String> {
    if plan.is_empty() {
        return Err("Nothing to save — at least one frame must remain".into());
    }
    if input == output {
        return Err("Choose a different file than the original".into());
    }
    let frame_count = gifmeta::get_metadata(&input.to_path_buf(), false)?.frame_count as usize;
    let lay = layout(plan, frame_count)?;
    let keyframes: Vec<usize> = settings
        .keyframes
        .iter()
        .copied()
        .filter(|i| !lay.deleted.contains(i))
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();

    // --- pass 1: build --------------------------------------------------------------------
    let pass1 = ModOptions {
        output: Some(temp_path()),
        loop_mode: settings.loop_mode,
        delete_frames: Some(lay.deleted.clone()),
        delete_mode: DeleteMode::DropDelay, // delays are set in pass 2
        duplicates: Some(lay.duplicates.clone()),
        inserts: Some(
            lay.images
                .iter()
                .map(|p| FrameInsert::new(frame_count, p))
                .collect(),
        ),
        keyframes: Some(keyframes),
        unoptimize: settings.unoptimize,
        ..Default::default()
    };
    let (mid, r1) = if pass1.has_frame_edits() || pass1.loop_mode.is_some() {
        let r = gifmeta::modify_gif_with_report(&input.to_path_buf(), pass1)?;
        (r.output.clone(), Some(r))
    } else {
        (input.to_path_buf(), None)
    };

    // --- pass 2: arrange + delays -----------------------------------------------------------
    let delays: HashMap<usize, u16> = lay
        .positions
        .iter()
        .zip(plan)
        .map(|(&p, item)| (p, item.delay))
        .collect();
    let pass2 = ModOptions {
        output: Some(output.to_path_buf()),
        order: Some(lay.positions.clone()),
        delays: Some(delays),
        ..Default::default()
    };
    let r2 = gifmeta::modify_gif_with_report(&mid, pass2);
    if r1.is_some() {
        let _ = std::fs::remove_file(&mid);
    }
    let r2 = r2?;

    // --- combined report ----------------------------------------------------------------
    let mut report = SaveReport {
        output: output.display().to_string(),
        frames_in: frame_count,
        frames_out: r2.frames_out,
        deleted: lay.deleted.clone(),
        inserted: lay.images.len(),
        duplicated: lay.duplicates.len(),
        reordered: r2.reordered,
        ..Default::default()
    };
    // Re-keyed frames as plan positions (each frame counted once).
    let mut rekeyed: BTreeSet<usize> = BTreeSet::new();
    let mut quantized: BTreeSet<usize> = BTreeSet::new();
    let pos_of_mid: HashMap<usize, usize> = lay
        .positions
        .iter()
        .enumerate()
        .map(|(i, &p)| (p, i))
        .collect();
    if let Some(r1) = &r1 {
        for (i, item) in plan.iter().enumerate() {
            if let Some(f) = item.frame {
                if r1.rekeyed.contains(&f) {
                    rekeyed.insert(i);
                }
                if r1.quantized.contains(&f) {
                    quantized.insert(i);
                }
            }
        }
        report.warnings.extend(r1.warnings());
    }
    rekeyed.extend(r2.rekeyed.iter().filter_map(|p| pos_of_mid.get(p)));
    quantized.extend(r2.quantized.iter().filter_map(|p| pos_of_mid.get(p)));
    // Inserted images are always written as full images, not "re-keyed".
    rekeyed.retain(|&i| plan[i].frame.is_some());
    report.rekeyed = rekeyed.into_iter().collect();
    report.quantized = quantized.into_iter().collect();
    report.warnings.extend(r2.warnings());
    report.warnings.dedup();
    Ok(report)
}

/// Builds a new GIF from image files (in order, with one delay each).
pub fn create_from_images(
    images: &[String],
    delays: &[u16],
    output: &Path,
    loop_mode: Option<LoopMode>,
) -> Result<SaveReport, String> {
    let paths: Vec<PathBuf> = images.iter().map(PathBuf::from).collect();
    let r = gifmeta::create_gif(
        &paths,
        CreateOptions {
            output: Some(output.to_path_buf()),
            delays: Some(delays.iter().copied().enumerate().collect()),
            loop_mode,
            ..Default::default()
        },
    )?;
    Ok(SaveReport {
        output: r.output.display().to_string(),
        frames_in: 0,
        frames_out: r.frames,
        inserted: r.frames,
        warnings: if r.quantized.is_empty() {
            vec![]
        } else {
            vec![format!(
                "images {:?} had more than 256 colours and were colour-reduced",
                r.quantized
            )]
        },
        quantized: r.quantized,
        ..Default::default()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn f(i: usize) -> PlanItem {
        PlanItem {
            frame: Some(i),
            image: None,
            delay: 10,
        }
    }
    fn img(p: &str) -> PlanItem {
        PlanItem {
            frame: None,
            image: Some(p.into()),
            delay: 10,
        }
    }

    #[test]
    fn layout_positions() {
        // frames 0..5: drop 1, copy 3, reorder, two images
        let plan = [f(4), img("a.png"), f(3), f(0), f(3), img("b.png"), f(2)];
        let l = layout(&plan, 5).unwrap();
        assert_eq!(l.deleted, vec![1]);
        assert_eq!(l.duplicates, vec![3]);
        // pass 1 output: 0, 2, 3, 3, 4, a, b
        assert_eq!(l.positions, vec![4, 5, 2, 0, 3, 6, 1]);
    }

    #[test]
    fn layout_rejects_bad_items() {
        assert!(layout(&[f(9)], 5).is_err());
        let both = PlanItem {
            frame: Some(1),
            image: Some("x.png".into()),
            delay: 1,
        };
        assert!(layout(&[both], 5).is_err());
    }

    /// Writes solid-colour PNGs with a marker pixel; returns their paths.
    fn pngs(dir: &Path, colors: &[[u8; 3]]) -> Vec<String> {
        colors
            .iter()
            .enumerate()
            .map(|(i, c)| {
                let mut img =
                    image::RgbaImage::from_pixel(12, 8, image::Rgba([c[0], c[1], c[2], 255]));
                img.put_pixel(i as u32, 0, image::Rgba([255, 255, 255, 255]));
                let p = dir.join(format!("c{i}.png"));
                img.save(&p).unwrap();
                p.display().to_string()
            })
            .collect()
    }

    #[test]
    fn save_plan_end_to_end() {
        let dir = std::env::temp_dir().join(format!("gifmeta-gui-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let src = pngs(
            &dir,
            &[[200, 0, 0], [0, 200, 0], [0, 0, 200], [200, 200, 0]],
        );
        let gif = dir.join("src.gif");
        create_from_images(&src, &[10, 10, 10, 10], &gif, None).unwrap();
        let originals = gifmeta::render_all_frames(&gif, gifmeta::PreviewMode::Composited).unwrap();

        let ins_dir = dir.join("ins");
        std::fs::create_dir_all(&ins_dir).unwrap();
        let ins = pngs(&ins_dir, &[[50, 100, 150]]);
        let ins_img = image::open(&ins[0]).unwrap().to_rgba8();

        // drop frame 1, frame 3 twice, reversed, image in the middle
        let plan = vec![
            PlanItem {
                frame: Some(3),
                image: None,
                delay: 20,
            },
            PlanItem {
                frame: None,
                image: Some(ins[0].clone()),
                delay: 70,
            },
            PlanItem {
                frame: Some(2),
                image: None,
                delay: 30,
            },
            PlanItem {
                frame: Some(3),
                image: None,
                delay: 40,
            },
            PlanItem {
                frame: Some(0),
                image: None,
                delay: 50,
            },
        ];
        let out = dir.join("out.gif");
        let r = save_plan(&gif, &out, &plan, &PlanSettings::default()).unwrap();
        assert_eq!((r.frames_in, r.frames_out), (4, 5));
        assert_eq!(r.deleted, vec![1]);
        assert_eq!((r.inserted, r.duplicated), (1, 1));
        assert!(r.reordered);

        let got = gifmeta::render_all_frames(&out, gifmeta::PreviewMode::Composited).unwrap();
        let want = [
            &originals[3].image,
            &ins_img,
            &originals[2].image,
            &originals[3].image,
            &originals[0].image,
        ];
        for (g, w) in got.iter().zip(want) {
            assert_eq!(&g.image, w, "frame {}", g.index);
        }
        let delays: Vec<u16> = got.iter().map(|f| f.delay_cs).collect();
        assert_eq!(delays, vec![20, 70, 30, 40, 50]);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
