import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
interface ModalProps { title?: string; children: ReactNode; onClose: () => void; className?: string; }
const focusable = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';
export function Modal({ title, children, onClose, className = '' }: ModalProps) {
  const dialog = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== 'Tab' || !dialog.current) return;
      const items = [...dialog.current.querySelectorAll<HTMLElement>(focusable)].filter(item => item.getClientRects().length > 0);
      if (!items.length) { event.preventDefault(); dialog.current.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => (dialog.current?.querySelector<HTMLElement>('[autofocus]') ?? dialog.current?.querySelector<HTMLElement>(focusable) ?? dialog.current)?.focus());
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; previousFocus?.focus(); };
  }, []);
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section ref={dialog} tabIndex={-1} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title || 'Pencere'}><button className="icon-button modal__close" onClick={onClose} aria-label="Kapat"><X size={20} /></button>{title && <h2 className="modal__title">{title}</h2>}{children}</section></div>;
}
