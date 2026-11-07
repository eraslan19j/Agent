import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title?: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}

export function Modal({ title, children, onClose, className = '' }: ModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title || 'Pencere'}>
        <button className="icon-button modal__close" onClick={onClose} aria-label="Kapat"><X size={20} /></button>
        {title && <h2 className="modal__title">{title}</h2>}
        {children}
      </section>
    </div>
  );
}
