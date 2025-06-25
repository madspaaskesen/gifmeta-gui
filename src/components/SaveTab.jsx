export default function SaveTab({ metadata, outputPath, setOutputPath, onSave }) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="label">
          <span className="label-text">Output Path</span>
        </label>
        <input
          type="text"
          className="input input-bordered w-full"
          value={outputPath}
          onChange={(e) => setOutputPath(e.target.value)}
          placeholder="e.g., /Users/you/Desktop/edited.gif"
        />
      </div>

      <button className="btn btn-primary w-full" onClick={onSave}>
        💾 Save Modified GIF
      </button>

      <div className="text-sm text-gray-500">
        Make sure to set global delay, loop count, or per-frame delays before saving.
      </div>
    </div>
  );
}
