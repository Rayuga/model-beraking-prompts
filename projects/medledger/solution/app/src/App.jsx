import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { api, DEFAULT_USER_ID, setDemoUserId, formatCents } from './lib/api.js';
import Checkout, { CheckoutSuccess } from './pages/Checkout.jsx';

const SessionContext = createContext(null);
export const useSession = () => useContext(SessionContext);

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/patients', label: 'Clinic' },
  { to: '/pharmacy', label: 'Pharmacy' },
  { to: '/lab', label: 'Lab' },
  { to: '/imaging', label: 'Imaging' },
  { to: '/transport', label: 'Transport' },
  { to: '/supply', label: 'Supply' },
  { to: '/billing', label: 'Billing' },
  { to: '/compliance', label: 'Compliance' },
  { to: '/admin', label: 'Admin' }
];

function useList(path, key) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => { api(path).then((d) => setRows(d[key] || [])).catch((e) => setErr(e.message)); }, [path, key]);
  return { rows, err };
}

function Table({ cols, rows }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>{cols.map((c) => <th key={c.k} className="px-3 py-2">{c.h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || r.party_id || r.provider_id || i} className="border-t border-slate-100">
              {cols.map((c) => <td key={c.k} className="px-3 py-2">{c.render ? c.render(r) : String(r[c.k] ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Section({ title, children }) {
  return <div className="mb-6"><h2 className="mb-2 text-lg font-semibold text-slate-800">{title}</h2>{children}</div>;
}

function Patients() {
  const { rows, err } = useList('/api/patients', 'patients');
  return <Section title="Clinic — patients">{err ? <p className="text-rose-600">{err}</p> : (
    <Table cols={[{ k: 'party_id', h: 'Party' }, { k: 'name', h: 'Name' }, { k: 'site_id', h: 'Site' }]} rows={rows} />)}</Section>;
}
function Pharmacy() {
  const { rows, err } = useList('/api/skus', 'skus');
  return <Section title="Pharmacy & Central supply — SKUs">{err ? <p className="text-rose-600">{err}</p> : (
    <Table cols={[{ k: 'id', h: 'SKU' }, { k: 'name', h: 'Name' }, { k: 'on_hand', h: 'On hand' }, { k: 'unit_cost_cents', h: 'Unit cost', render: (r) => formatCents(r.unit_cost_cents) }]} rows={rows} />)}</Section>;
}
function Lab() {
  return <Section title="Lab"><p className="text-sm text-slate-600">Lab orders and results resolve at <code>/api/lab-results/:id</code>. Critical thresholds gate downstream domains.</p></Section>;
}
function Imaging() {
  return <Section title="Imaging / Radiology"><p className="text-sm text-slate-600">Studies resolve at <code>/api/imaging-studies/:id</code>. Contrast studies consume media and bill the add-on.</p></Section>;
}
function Transport() {
  const { rows, err } = useList('/api/rigs/RIG-OK', 'rig');
  return <Section title="Medical transport"><p className="text-sm text-slate-600">Rigs at <code>/api/rigs/:id</code>, dispatches at <code>/api/dispatches/:id</code>. DVIR and HOS gate dispatch.</p></Section>;
}
function Supply() {
  const { rows, err } = useList('/api/skus', 'skus');
  return <Section title="Central supply">{err ? <p className="text-rose-600">{err}</p> : (
    <Table cols={[{ k: 'id', h: 'SKU' }, { k: 'name', h: 'Name' }, { k: 'on_hand', h: 'On hand' }]} rows={rows} />)}</Section>;
}
function Billing() {
  const { rows, err } = useList('/api/charges', 'charges');
  return <Section title="Billing & claims — charges">{err ? <p className="text-rose-600">{err}</p> : (
    <Table cols={[{ k: 'id', h: 'Charge' }, { k: 'party_id', h: 'Party' }, { k: 'source_type', h: 'Source' }, { k: 'amount_cents', h: 'Amount', render: (r) => formatCents(r.amount_cents) }, { k: 'status', h: 'Status' }]} rows={rows} />)}</Section>;
}
function Compliance() {
  const { rows, err } = useList('/api/providers', 'providers');
  return <Section title="Credentialing & compliance — providers">{err ? <p className="text-rose-600">{err}</p> : (
    <Table cols={[{ k: 'provider_id', h: 'Provider' }, { k: 'canonical_name', h: 'Name' }, { k: 'site_id', h: 'Site' }]} rows={rows} />)}</Section>;
}
function Admin() {
  const [msg, setMsg] = useState('');
  return <Section title="Administration">
    <button className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
      onClick={() => api('/api/admin/close-of-shift', { method: 'POST' }).then((d) => setMsg(`Close-of-shift: ${JSON.stringify(d.effects)}`)).catch((e) => setMsg(e.message))}>
      Run close-of-shift
    </button>
    {msg && <p className="mt-3 text-sm text-slate-700">{msg}</p>}
  </Section>;
}
function Dashboard() {
  return <Section title="MedLedger — health-system back office">
    <p className="text-sm text-slate-600">Clinic, pharmacy, lab, imaging, transport, central supply, billing, and
      compliance — one platform. Use the tabs above. The demo-user switcher (top right) changes the acting identity
      via <code>X-User-Id</code>.</p>
  </Section>;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function load() {
    const [s, u] = await Promise.all([api('/api/session'), api('/api/demo-users')]);
    setSession(s.user);
    setUsers(u.users);
  }
  useEffect(() => { load().catch((err) => setError(err.message)); }, []);
  const value = useMemo(() => ({ user: session, users, reload: load }), [session, users]);

  if (error) return <div className="p-8 text-rose-700">{error}</div>;
  if (!session) return <div className="p-8 text-slate-500">Loading MedLedger…</div>;

  return (
    <SessionContext.Provider value={value}>
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 text-white">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3">
            <div>
              <div className="text-lg font-bold tracking-tight">Med<span className="text-emerald-400">Ledger</span></div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Health System Back Office</div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span id="current-user">{session.full_name} · {session.role.replaceAll('_', ' ')}</span>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                Switch demo user
                <select id="demo-user-select" aria-label="Switch demo user"
                  className="max-w-[260px] rounded-md border border-slate-600 bg-white px-2 py-1.5 text-slate-900"
                  value={session.id}
                  onChange={async (e) => { setDemoUserId(e.target.value || DEFAULT_USER_ID); await load(); navigate('/'); }}>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.role.replaceAll('_', ' ')})</option>)}
                </select>
              </label>
            </div>
          </div>
          <nav className="border-t border-slate-800 bg-slate-900">
            <div className="mx-auto flex max-w-[1440px] flex-wrap gap-1 px-4 py-2 text-sm">
              {NAV.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.to === '/'}
                  className={({ isActive }) => `rounded-md px-3 py-1.5 ${isActive ? 'bg-emerald-600 text-white' : 'text-slate-200 hover:bg-slate-800'}`}>
                  {link.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/pharmacy" element={<Pharmacy />} />
            <Route path="/lab" element={<Lab />} />
            <Route path="/imaging" element={<Imaging />} />
            <Route path="/transport" element={<Transport />} />
            <Route path="/supply" element={<Supply />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/checkout/:paymentId" element={<Checkout />} />
          </Routes>
        </main>
      </div>
    </SessionContext.Provider>
  );
}
