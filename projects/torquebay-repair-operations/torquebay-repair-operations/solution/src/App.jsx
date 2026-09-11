import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { api, setDemoUserId } from './lib/api.js';
import Dashboard from './pages/Dashboard.jsx';
import RepairOrders from './pages/RepairOrders.jsx';
import RepairOrderDetail from './pages/RepairOrderDetail.jsx';
import Bays from './pages/Bays.jsx';
import Parts from './pages/Parts.jsx';
import Technicians from './pages/Technicians.jsx';
import Warranties from './pages/Warranties.jsx';
import Invoices from './pages/Invoices.jsx';
import Customers from './pages/Customers.jsx';
import Estimates from './pages/Estimates.jsx';
import Audit from './pages/Audit.jsx';
import Portal from './pages/Portal.jsx';

const SessionContext = createContext(null);
export const useSession = () => useContext(SessionContext);

const NAV = [
  { to: '/', label: 'Dashboard', roles: 'all' },
  { to: '/repair-orders', label: 'Repair orders', roles: ['SERVICE_ADVISOR', 'TECHNICIAN', 'SHOP_FOREMAN', 'SHOP_MANAGER'] },
  { to: '/estimates', label: 'Estimates', roles: ['SERVICE_ADVISOR', 'SHOP_MANAGER', 'CUSTOMER'] },
  { to: '/bays', label: 'Bay board', roles: ['SERVICE_ADVISOR', 'SHOP_FOREMAN', 'SHOP_MANAGER', 'TECHNICIAN'] },
  { to: '/technicians', label: 'Technicians', roles: ['SERVICE_ADVISOR', 'SHOP_FOREMAN', 'SHOP_MANAGER'] },
  { to: '/parts', label: 'Parts', roles: ['PARTS_MANAGER', 'SHOP_MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN'] },
  { to: '/warranties', label: 'Warranty', roles: ['WARRANTY_ADMIN', 'SHOP_MANAGER'] },
  { to: '/invoices', label: 'Invoices', roles: ['SHOP_MANAGER', 'SERVICE_ADVISOR', 'CUSTOMER'] },
  { to: '/customers', label: 'Customers', roles: ['SERVICE_ADVISOR', 'SHOP_MANAGER'] },
  { to: '/audit', label: 'Audit', roles: ['SHOP_MANAGER', 'SHOP_FOREMAN'] },
  { to: '/portal', label: 'Customer portal', roles: ['CUSTOMER'] }
];

function ToastHost({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div role={toast.kind === 'error' ? 'alert' : 'status'} aria-live="polite" className={`fixed bottom-4 left-4 right-4 z-50 rounded-lg px-4 py-3 text-sm shadow-lg sm:left-auto sm:max-w-sm ${toast.kind === 'error' ? 'bg-rose-700 text-white' : 'bg-slate-900 text-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{toast.kind === 'error' ? 'Action blocked' : 'Saved to live server'}</p>
          <p>{toast.message}</p>
          <p className="mt-1 text-xs text-slate-300">{toast.kind === 'error' ? 'No data was changed.' : 'The refreshed workspace now includes this update.'}</p>
        </div>
        <button type="button" className="rounded px-2 py-1 focus-visible:ring-2 focus-visible:ring-orange-400" onClick={onDismiss} aria-label="Dismiss notification">×</button>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [users, setUsers] = useState([]);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [s, u] = await Promise.all([api('/api/session'), api('/api/demo-users')]);
      setSession(s.user);
      setUsers(u.users);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  function notify(message, kind = 'ok') {
    setToast({ message, kind });
  }

  const value = useMemo(() => ({ user: session, users, notify, reload: load }), [session, users]);

  if (error) {
    return <div className="mx-auto max-w-xl p-8"><div className="rounded-xl border border-rose-200 bg-white p-5 shadow-panel" role="alert"><h1 className="text-lg font-semibold text-rose-800">TorqueBay could not load</h1><p className="mt-2 text-sm text-slate-700">{error}</p><p className="mt-1 text-xs text-slate-500">Your server data was not changed. Check the connection and try again.</p><button type="button" className="mt-4 rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => load().catch((err) => setError(err.message))}>Try again</button></div></div>;
  }
  if (!session) {
    return <div className="mx-auto max-w-2xl p-8" role="status" aria-live="polite"><div className="h-2 w-32 animate-pulse rounded bg-orange-200" /><p className="mt-3 font-medium text-slate-700">Loading TorqueBay…</p><p className="text-sm text-slate-500">Opening the latest server-backed shop state.</p></div>;
  }

  const links = NAV.filter((item) => item.roles === 'all' || item.roles.includes(session.role));

  return (
    <SessionContext.Provider value={value}>
      <div className="min-h-screen">
        <header className="z-40 border-b border-slate-800 bg-slate-950 text-white sm:sticky sm:top-0">
          <div className="mx-auto flex max-w-[1440px] flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-lg font-bold tracking-tight">TorqueBay <span className="text-orange-400">Enterprise</span></div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Shop operations</div>
            </div>
            <div className="flex flex-col gap-2 text-sm sm:items-end">
              <span id="current-user" className="font-medium">{session.full_name} · {session.role.replaceAll('_', ' ')}</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-300" role="status" aria-live="polite"><span className={`h-2 w-2 rounded-full ${loading ? 'animate-pulse bg-amber-300' : 'bg-emerald-400'}`} />{loading ? 'Refreshing live data…' : 'Live server state'}</span>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                Switch demo user
                <select
                  id="demo-user-select"
                  aria-label="Switch demo user"
                  className="min-w-0 flex-1 rounded-md border border-slate-600 bg-white px-2 py-1.5 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 sm:w-[260px]"
                  value={session.id}
                  disabled={loading}
                  onChange={async (e) => {
                    setDemoUserId(e.target.value);
                    await load();
                    navigate('/');
                    notify('Switched demo user');
                  }}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.role.replaceAll('_', ' ')})</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <nav className="border-t border-slate-800 bg-slate-900">
            <div className="mx-auto grid max-w-[1440px] grid-cols-3 gap-1 px-4 py-2 text-xs sm:flex sm:flex-wrap sm:text-sm" aria-label="Role navigation">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) => `min-w-0 rounded-md px-2 py-2 text-center leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 sm:px-3 sm:py-1.5 ${isActive ? 'bg-orange-600 text-white' : 'text-slate-200 hover:bg-slate-800'}`}
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/repair-orders" element={<RepairOrders />} />
            <Route path="/repair-orders/:id" element={<RepairOrderDetail />} />
            <Route path="/estimates" element={<Estimates />} />
            <Route path="/bays" element={<Bays />} />
            <Route path="/technicians" element={<Technicians />} />
            <Route path="/parts" element={<Parts />} />
            <Route path="/warranties" element={<Warranties />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/portal" element={<Portal />} />
          </Routes>
        </main>
        <ToastHost toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </SessionContext.Provider>
  );
}
