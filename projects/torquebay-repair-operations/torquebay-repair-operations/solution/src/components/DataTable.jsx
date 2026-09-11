import { useId, useMemo, useState } from 'react';
import { Empty } from './ui.jsx';

export function DataTable({ columns, rows, rowKey = 'id', onRow, empty = 'No records' }) {
  const searchId = useId();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: columns[0]?.key, dir: 'asc' });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows || [];
    if (needle) {
      list = list.filter((row) => columns.some((col) => String(col.value ? col.value(row) : row[col.key] ?? '').toLowerCase().includes(needle)));
    }
    if (sort.key) {
      list = [...list].sort((a, b) => {
        const av = String((columns.find((c) => c.key === sort.key)?.value?.(a)) ?? a[sort.key] ?? '');
        const bv = String((columns.find((c) => c.key === sort.key)?.value?.(b)) ?? b[sort.key] ?? '');
        return sort.dir === 'asc' ? av.localeCompare(bv, undefined, { numeric: true }) : bv.localeCompare(av, undefined, { numeric: true });
      });
    }
    return list;
  }, [rows, q, sort, columns]);

  return (
    <div>
      <div className="mb-3">
        <label className="sr-only" htmlFor={searchId}>Search this table</label>
        <input
          id={searchId}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search table"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        />
      </div>
      {!!filtered.length && (
        <div className="space-y-2 sm:hidden" aria-label="Responsive record cards">
          {filtered.map((row) => (
            <article
              key={row[rowKey] || JSON.stringify(row)}
              className={onRow ? 'cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm focus-visible:ring-2 focus-visible:ring-orange-500' : 'rounded-lg border border-slate-200 bg-white p-3 shadow-sm'}
              onClick={onRow ? () => onRow(row) : undefined}
              onKeyDown={onRow ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onRow(row);
                }
              } : undefined}
              role={onRow ? 'button' : undefined}
              tabIndex={onRow ? 0 : undefined}
            >
              <dl className="space-y-2">
                {columns.map((col) => (
                  <div key={col.key} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-start gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{col.label}</dt>
                    <dd className="min-w-0 break-words text-right text-sm text-slate-800">
                      {col.render ? col.render(row) : String(col.value ? col.value(row) : row[col.key] ?? '—')}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      )}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 sm:block" tabIndex="0" role="region" aria-label="Data table">
        <table className="min-w-[620px] text-left text-sm sm:min-w-full">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-3 py-2 font-semibold">
                  <button type="button" className="rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => setSort((s) => ({ key: col.key, dir: s.key === col.key && s.dir === 'asc' ? 'desc' : 'asc' }))}>
                    {col.label}{sort.key === col.key ? <span className="ml-1" aria-hidden="true">{sort.dir === 'asc' ? '↑' : '↓'}</span> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row[rowKey] || JSON.stringify(row)}
                className={onRow ? 'cursor-pointer border-t border-slate-100 hover:bg-orange-50/40' : 'border-t border-slate-100'}
                onClick={onRow ? () => onRow(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-2 align-top">
                    {col.render ? col.render(row) : String(col.value ? col.value(row) : row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <Empty title={q ? 'No matching records' : 'Queue clear'}>{q ? `Nothing matches “${q}”. Clear the search or try broader terms.` : `${String(empty).replace(/[.]+$/, '')}. New records will appear here when the workflow creates them.`}</Empty>}
    </div>
  );
}
