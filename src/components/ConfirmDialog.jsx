import { useEffect } from 'react';
import './ConfirmDialog.css';

/**
 * ConfirmDialog — in-app replacement for window.confirm, styled like the
 * app's liquid-glass modals. Escape or a backdrop click cancels.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {string} props.title
 * @param {string} [props.message]
 * @param {string} [props.confirmLabel]
 * @param {string} [props.cancelLabel]
 * @param {boolean} [props.danger] - style the confirm button as destructive
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onCancel?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="confirm-overlay" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="confirm-backdrop" onClick={onCancel} />
      <div className="confirm-dialog animate-scale-in">
        <h3 className="confirm-dialog__title">{title}</h3>
        {message && <p className="confirm-dialog__message">{message}</p>}
        <div className="confirm-dialog__actions">
          {/* Cancel gets focus so Enter can't fire a destructive action by accident. */}
          <button className="confirm-dialog__btn" type="button" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button
            className={`confirm-dialog__btn confirm-dialog__btn--confirm${danger ? ' confirm-dialog__btn--danger' : ''}`}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
