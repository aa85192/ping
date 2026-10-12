import { useApp } from '../store';

export function ToastHost() {
  const toast = useApp((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span>{toast.text}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.run();
            useApp.setState({ toast: null });
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
