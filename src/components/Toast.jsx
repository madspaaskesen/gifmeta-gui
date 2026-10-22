// Tiny toast messages (DaisyUI). type: "success" | "error" | "info"
export default function Toast({ toasts, onClose }) {
  if (!toasts.length) return null;
  return (
    <div className="toast toast-end toast-bottom mb-10 z-50">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`alert ${t.type === "error" ? "alert-error" : t.type === "success" ? "alert-success" : "alert-info"} shadow cursor-pointer max-w-md`}
          onClick={() => onClose(t.id)}
        >
          <span className="text-sm break-all">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
