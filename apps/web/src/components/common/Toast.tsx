import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const borderColors = {
    success: 'border-emerald-500/30 bg-[#081210]/95 text-emerald-300',
    error: 'border-rose-500/30 bg-[#14080a]/95 text-rose-300',
    info: 'border-sky-500/30 bg-[#080d16]/95 text-sky-300',
  };

  const icons = {
    success: <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />,
    error: <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />,
    info: <Info size={16} className="text-sky-400 shrink-0 mt-0.5" />,
  };

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-xl border backdrop-blur-md shadow-2xl animate-in slide-in-from-bottom-2 duration-200 ${
        borderColors[toast.type]
      }`}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0 pr-1">
        <h4 className="text-xs font-semibold text-slate-100">{toast.title}</h4>
        {toast.description && (
          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-slate-200 transition-colors p-0.5 -mr-1 -mt-1 rounded"
      >
        <X size={14} />
      </button>
    </div>
  );
}
