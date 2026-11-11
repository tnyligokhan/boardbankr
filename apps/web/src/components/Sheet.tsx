import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { Button } from './ui';

/**
 * Native <dialog>: focus trap, Esc and inert background for free.
 * Bottom sheet on phones, centred card from 640px up (see styles.css).
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // focus the sheet itself, not its first button, so nothing looks pre-selected
      d.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet focus:outline-none"
      tabIndex={-1}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <>
          <div className="relative flex shrink-0 items-center gap-2 px-5 pt-5 pb-2">
            <span aria-hidden className="absolute top-2 left-1/2 h-[5px] w-10 -translate-x-1/2 rounded-full bg-line sm:hidden" />
            <h2 className="flex-1 font-display text-xl font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close')}
              className="-mr-2 inline-flex size-10 items-center justify-center rounded-xl text-ink-2 hover:bg-sand"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          {/* flex-auto, not flex-1: Safari resolves flex-basis 0% to nothing in a column whose height
              is only capped by max-height, so on iOS the body collapsed and the sheet came up half-empty */}
          <div className={`min-h-0 flex-auto overflow-y-auto overscroll-contain px-5 ${footer ? 'pb-5' : 'pb-safe'}`}>{children}</div>
          {footer && <div className="shrink-0 px-5 pt-2 pb-safe">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-ink-2">{body}</p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="quiet" onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button variant={danger ? 'danger' : 'gold'} busy={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
