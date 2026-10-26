// In-app confirm dialog (DaisyUI modal). Used instead of the native dialog so it behaves the
// same on every platform. Enter = confirm, Escape = cancel.
import { useEffect, useRef } from "react";

export default function ConfirmDialog({ request, onAnswer }) {
  const okRef = useRef(null);
  useEffect(() => {
    if (!request) return;
    okRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onAnswer(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [request, onAnswer]);

  if (!request) return null;
  return (
    <div className="modal modal-open" role="dialog" aria-modal="true">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg">{request.title}</h3>
        <p className="py-3 text-sm">{request.message}</p>
        <div className="modal-action">
          <button className="btn btn-sm" onClick={() => onAnswer(false)}>
            {request.cancelLabel ?? "Cancel"}
          </button>
          <button ref={okRef} className="btn btn-sm btn-warning" onClick={() => onAnswer(true)}>
            {request.okLabel ?? "OK"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={() => onAnswer(false)} />
    </div>
  );
}
