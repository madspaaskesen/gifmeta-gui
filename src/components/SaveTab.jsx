export default function SaveTab({ metadata, outputPath, setOutputPath, onChoosePath, onSave, dirty, saving }) {
  return (
    <div className="p-2 space-y-4 max-w-2xl">
      <fieldset className="fieldset w-full">
        <legend className="fieldset-legend">Output file</legend>
        <div className="join w-full">
          <input
            type="text"
            className="input input-bordered join-item w-full"
            value={outputPath}
            onChange={(e) => setOutputPath(e.target.value)}
            placeholder="e.g. /Users/you/Desktop/edited.gif"
            disabled={!metadata}
          />
          <button className="btn join-item" onClick={onChoosePath} disabled={!metadata}>
            📂 Choose…
          </button>
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button className="btn btn-primary" onClick={onSave} disabled={!metadata || !dirty || saving}>
          {saving ? <span className="loading loading-spinner loading-sm" /> : "💾"} Save modified GIF
        </button>
        {metadata && (
          <span className="text-sm opacity-70">
            {dirty ? "● You have unsaved changes" : "No changes yet — edit delays or the loop setting first."}
          </span>
        )}
      </div>
    </div>
  );
}
