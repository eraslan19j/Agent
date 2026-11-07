import { CheckCircle2, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: number;
  text: string;
  type?: 'success' | 'info';
}

export function Toast({ toast, onClose }: { toast: ToastMessage | null; onClose: () => void }) {
  if (!toast) return null;
  return (
    <div className={`toast toast--${toast.type || 'success'}`} role="status">
      {toast.type === 'info' ? <Info size={19} /> : <CheckCircle2 size={19} />}
      <span>{toast.text}</span>
      <button onClick={onClose} aria-label="Bildirimi kapat"><X size={16} /></button>
    </div>
  );
}
