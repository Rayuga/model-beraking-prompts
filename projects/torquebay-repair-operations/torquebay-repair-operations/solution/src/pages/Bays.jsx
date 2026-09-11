import { useEffect, useState } from 'react';
import { useSession } from '../App.jsx';
import { Badge, Button, Card, ErrorText, Input, LoadingState, Modal, Select } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { fmtDate, toIso } from '../lib/utils.js';

export default function Bays() {
  const { user, notify } = useSession();
  const [bays, setBays] = useState([]);
  const [orders, setOrders] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [b, r] = await Promise.all([api('/api/bays'), api('/api/repair-orders')]);
      setBays(b.bays);
      setOrders(r.repair_orders);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load().catch((e) => notify(e.message, 'error')); }, [user.id]);

  async function act(path, body, ok) {
    setError('');
    setErrorCode('');
    try {
      await api(path, { method: 'POST', body });
      notify(ok);
      setModal(null);
      await load();
    } catch (e) {
      setError(e.message);
      setErrorCode(e.code || '');
    }
  }

  async function refreshBookingRevision() {
    try {
      const [bayData, orderData] = await Promise.all([api('/api/bays'), api('/api/repair-orders')]);
      const latestBay = bayData.bays.find((bay) => bay.id === form.bay.id);
      setBays(bayData.bays);
      setOrders(orderData.repair_orders);
      setForm((current) => ({ ...current, bay: latestBay || current.bay }));
      setError('');
      setErrorCode('');
      notify(`Latest ${latestBay?.name || 'bay'} state loaded. Your repair order and time window were kept.`);
    } catch (e) {
      setError(e.message);
      setErrorCode(e.code || '');
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Bay board</h1>
      <p className="text-sm text-slate-500">AVAILABLE, OCCUPIED, and MAINTENANCE_HOLD are enforced server-side. Stale bookings send the version you loaded.</p>
      {loading ? <LoadingState label="Refreshing bay availability and active bookings…" /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {bays.map((bay) => (
          <Card key={bay.id} className={bay.status === 'MAINTENANCE_HOLD' ? 'bg-slate-900 text-white' : ''}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-semibold">Bay {bay.number}</div>
                <div className="text-xs opacity-70">{bay.name} · {bay.type}</div>
              </div>
              <Badge status={bay.status} />
            </div>
            <p className="mt-3 text-sm">{bay.equipment}</p>
            {(bay.bookings || (bay.booking ? [bay.booking] : [])).map((booking) => (
              <p key={booking.id} className="mt-2 rounded border border-current/10 p-2 text-sm">
                {booking.ro_number} · {booking.customer_name}<br />
                {fmtDate(booking.window_start)} – {fmtDate(booking.window_end)}
              </p>
            ))}
            <p className="mt-2 text-xs opacity-70">Live revision {bay.version} · stale submissions are blocked</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['SERVICE_ADVISOR', 'SHOP_FOREMAN', 'SHOP_MANAGER'].includes(user.role) && (
                <Button
                  variant={bay.status === 'MAINTENANCE_HOLD' ? 'secondary' : 'primary'}
                  aria-label={`Book Bay ${bay.number}`}
                  onClick={() => {
                  setError('');
                  setErrorCode('');
                  setForm({
                    bay,
                    repair_order_id: orders[0]?.id,
                    window_start: '',
                    window_end: ''
                  });
                  setModal('book');
                }}>Book Bay {bay.number}</Button>
              )}
              {['SHOP_MANAGER', 'SHOP_FOREMAN'].includes(user.role) && (
                <Button variant="secondary" onClick={() => act(`/api/bays/${bay.id}/maintenance`, { hold: bay.status !== 'MAINTENANCE_HOLD', reason: 'Floor hold' }, 'Bay hold updated')}>
                  {bay.status === 'MAINTENANCE_HOLD' ? 'Lift hold' : 'Hold'}
                </Button>
              )}
            </div>
            {(bay.bookings || []).map((booking) => (
              <Button key={`release-${booking.id}`} className="mt-2" variant="ghost" onClick={() => {
                setError('');
                setErrorCode('');
                setForm({ bay, booking, reason: `Released ${booking.ro_number}` });
                setModal('release');
              }}>Release {booking.ro_number}</Button>
            ))}
          </Card>
        ))}
      </div>}
      {modal === 'book' && (
        <Modal title={`Book ${form.bay.name}`} onClose={() => setModal(null)}>
          <Select label="Repair order" value={form.repair_order_id} onChange={(e) => setForm({ ...form, repair_order_id: e.target.value })}>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.number} · {o.status}</option>)}
          </Select>
          <Input className="mt-3" label="Start" type="datetime-local" value={form.window_start} onChange={(e) => setForm({ ...form, window_start: e.target.value })} />
          <Input className="mt-3" label="End" type="datetime-local" value={form.window_end} onChange={(e) => setForm({ ...form, window_end: e.target.value })} />
          <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600" role="status">
            Submitting against live revision <strong>{form.bay.version}</strong>. If another dispatcher changes this bay first, your selections stay here while you refresh the latest state.
          </p>
          <ErrorText>{error}</ErrorText>
          {errorCode === 'STALE_BAY' && (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">A newer bay revision is available</p>
              <p className="mt-1 text-xs text-amber-800">Refresh the bay record, review its current status, then submit again. Your repair order and time window will be preserved.</p>
              <Button className="mt-3" variant="secondary" onClick={refreshBookingRevision}>Refresh latest state and keep my entries</Button>
            </div>
          )}
          <Button className="mt-3" onClick={() => act(`/api/bays/${form.bay.id}/book`, {
            repair_order_id: form.repair_order_id,
            window_start: toIso(form.window_start),
            window_end: toIso(form.window_end),
            expected_version: form.bay.version,
            expected_status: form.bay.status
          }, `Booking submitted for Bay ${form.bay.number}`)}>Submit booking for Bay {form.bay.number}</Button>
        </Modal>
      )}
      {modal === 'release' && (
        <Modal title={`Release ${form.booking.ro_number} from ${form.bay.name}?`} onClose={() => setModal(null)}>
          <p className="text-sm text-slate-600">
            This ends the active booking and returns the bay to available. The repair order remains unchanged.
          </p>
          <Input className="mt-3" label="Release reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
          <ErrorText>{error}</ErrorText>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModal(null)}>Keep booking</Button>
            <Button onClick={() => act(
              `/api/bays/${form.bay.id}/release`,
              { booking_id: form.booking.id, reason: form.reason },
              `${form.booking.ro_number} released and bay state saved`
            )}>Confirm release</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
