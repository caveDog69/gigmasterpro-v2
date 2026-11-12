import { useEffect, type ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';
import { STATUS_STYLES } from '../lib/constants';
import type { GigStatus } from '../lib/types';
import { cx, initials } from '../lib/format';

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={cx('animate-spin text-purple-400', className)} aria-hidden="true" />;
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-gray-400" role="status">
      <Spinner className="h-8 w-8" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-3">
        {icon && <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300">{icon}</div>}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-800 text-purple-300">{icon}</div>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {body && <p className="mt-1 max-w-md text-sm text-gray-400">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: GigStatus }) {
  return <span className={cx('chip capitalize', STATUS_STYLES[status])}>{status}</span>;
}

export function Avatar({ name, url, size = 'md' }: { name: string | null | undefined; url?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-24 w-24 text-2xl' };
  if (url) return <img src={url} alt="" className={cx('shrink-0 rounded-full object-cover ring-2 ring-gray-800', sizes[size])} />;
  return (
    <div className={cx('flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-700 font-semibold text-white ring-2 ring-gray-800', sizes[size])}>
      {initials(name)}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('flex max-h-[92vh] w-full animate-slide-in flex-col rounded-t-2xl border border-gray-700 bg-gray-900 shadow-2xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="scrollbar-thin overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, body, confirmLabel = 'Delete', onConfirm, onCancel, busy }: {
  open: boolean; title: string; body: ReactNode; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="text-sm text-gray-300">{body}</div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm} disabled={busy}>
          {busy && <Spinner className="h-4 w-4 text-white" />} {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Field({ label, htmlFor, hint, error, children, className }: { label: string; htmlFor?: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-gray-200">{label}</span>
        {description && <span className="block text-xs text-gray-500">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-purple-600' : 'bg-gray-700')}
      >
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
      <span>{message}</span>
      {onRetry && <button className="btn-secondary btn-sm" onClick={onRetry}>Retry</button>}
    </div>
  );
}
