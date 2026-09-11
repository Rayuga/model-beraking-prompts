import { cn } from '@/lib/utils';

export function Button({ variant = 'primary', className, ...props }) {
  const styles = {
    primary: 'bg-orange-600 text-white hover:bg-orange-700 border-orange-700',
    secondary: 'bg-white text-slate-800 hover:bg-slate-50 border-slate-300',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 border-transparent',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 border-rose-700'
  };
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        styles[variant],
        className
      )}
      {...props}
    />
  );
}

export function Card({ className, children, title, action, id }) {
  return (
    <section id={id} className={cn('min-w-0 rounded-xl border border-slate-200 bg-white shadow-panel', className)}>
      {(title || action) && (
        <header className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Input({ label, className, ...props }) {
  return (
    <label className="block text-sm">
      {label && <span className="mb-1 block font-medium text-slate-700">{label}</span>}
      <input
        className={cn(
          'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100',
          className
        )}
        {...props}
      />
    </label>
  );
}

export function Select({ label, children, className, ...props }) {
  return (
    <label className="block text-sm">
      {label && <span className="mb-1 block font-medium text-slate-700">{label}</span>}
      <select
        className={cn(
          'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100',
          className
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Textarea({ label, className, ...props }) {
  return (
    <label className="block text-sm">
      {label && <span className="mb-1 block font-medium text-slate-700">{label}</span>}
      <textarea
        className={cn(
          'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100',
          className
        )}
        {...props}
      />
    </label>
  );
}

export function Badge({ status, className, children }) {
  return (
    <span className={cn(
      'status-' + String(status || '').replaceAll(' ', '_'),
      'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
      className
    )}>
      {children || String(status || '').replaceAll('_', ' ')}
    </span>
  );
}

export function Empty({ title = 'No records yet', children }) {
  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
      <p className="font-medium text-slate-700">{title}</p>
      {children ? <p className="mt-0.5 text-slate-600">{children}</p> : null}
    </div>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  const stale = /stale|version|changed since|conflict/i.test(String(children));
  return (
    <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
      <p className="font-semibold">Action blocked</p>
      <p>{children}</p>
      <p className="mt-1 text-xs text-rose-700">{stale ? 'Nothing was changed. Refresh the current record, review its new status, and retry from the latest version.' : 'Nothing was changed. Review the stated rule, correct the highlighted action, and try again.'}</p>
    </div>
  );
}

export function LoadingState({ label = 'Loading current shop data…' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel" role="status" aria-live="polite">
      <div className="h-2 w-28 animate-pulse rounded bg-orange-200" />
      <p className="mt-3 text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-1 text-xs text-slate-500">The latest server-backed records will appear here.</p>
    </div>
  );
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 id="dialog-title" className="font-semibold">{title}</h3>
          <button type="button" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={onClose} aria-label="Close dialog">×</button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
