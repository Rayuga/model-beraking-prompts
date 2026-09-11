import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../App.jsx';
import { Badge, Card, Empty, ErrorText, LoadingState } from '../components/ui.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { api } from '../lib/api.js';
import { money } from '../lib/utils.js';

export default function Dashboard() {
  const { user, notify } = useSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/dashboard').then(setData).catch((e) => setError(e.message));
  }, [user.id]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return <LoadingState label={`Loading ${user.role.replaceAll('_', ' ').toLowerCase()} workspace…`} />;

  if (user.role === 'CUSTOMER') {
    return (
      <div className="space-y-4">
        <Intro user={user} />
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Your vehicles">
            <DataTable
              rows={data.vehicles}
              columns={[
                { key: 'year', label: 'Vehicle', render: (v) => `${v.year} ${v.make} ${v.model}` },
                { key: 'status', label: 'Status', render: (v) => <Badge status={v.status} /> }
              ]}
            />
          </Card>
          <Card title="Estimates awaiting you">
            <DataTable
              rows={data.estimates}
              columns={[
                { key: 'ro_number', label: 'RO' },
                { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
                { key: 'approved_cents', label: 'Approved', render: (r) => money(r.approved_cents) }
              ]}
              onRow={() => notify('Open Estimates to approve line items')}
            />
          </Card>
        </div>
      </div>
    );
  }

  if (user.role === 'TECHNICIAN') {
    return (
      <div className="space-y-4">
        <Intro user={user} />
        <Card title="Assigned repair orders">
          <RoTable rows={data.assigned_work} />
        </Card>
        <Card title="Certification alerts">
          {data.cert_alerts?.length ? data.cert_alerts.map((c) => (
            <p key={c.id} className="text-sm">{c.technician_name}: {c.cert_type} expires {c.expires_on}</p>
          )) : <Empty>No upcoming expiries on your board.</Empty>}
        </Card>
      </div>
    );
  }

  if (user.role === 'PARTS_MANAGER') {
    return (
      <div className="space-y-4">
        <Intro user={user} />
        <h2 className="text-xl font-semibold">Parts desk</h2>
        <Card title="Shelf exceptions">
          <DataTable
            rows={data.parts_attention || []}
            columns={[
              { key: 'part_number', label: 'Part' },
              { key: 'description', label: 'Description' },
              { key: 'quantity_on_hand', label: 'On hand' },
              { key: 'quantity_reserved', label: 'Reserved' },
              { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> }
            ]}
            empty="All stocked parts are above their attention thresholds"
          />
        </Card>
      </div>
    );
  }

  if (user.role === 'WARRANTY_ADMIN') {
    return (
      <div className="space-y-4">
        <Intro user={user} />
        <h2 className="text-xl font-semibold">Warranty review desk</h2>
        <Card title="Claims queue">
          <DataTable
            rows={data.claims || []}
            columns={[
              { key: 'ro_number', label: 'RO' },
              { key: 'customer_name', label: 'Customer' },
              { key: 'coverage_type', label: 'Coverage' },
              { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> }
            ]}
            empty="No claims are waiting for warranty review"
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Intro user={user} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Occupied bays" value={`${data.bay_utilization?.occupied || 0}`} />
        <Stat label="Available bays" value={`${data.bay_utilization?.available || 0}`} />
        <Stat label="Open claims" value={`${data.claims_open?.length || 0}`} />
        <Stat label="Pending invoices" value={`${data.pending_invoices?.length || 0}`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Repair orders awaiting estimate" action={<Link className="text-sm text-orange-700" to="/repair-orders">View all</Link>}>
          <RoTable rows={data.awaiting_estimate} />
        </Card>
        <Card title="Estimates pending customer approval">
          <DataTable
            rows={data.pending_customer_approval}
            columns={[
              { key: 'ro_number', label: 'RO' },
              { key: 'customer_name', label: 'Customer' },
              { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
              { key: 'total_cents', label: 'Total', render: (r) => money(r.total_cents) }
            ]}
          />
        </Card>
        {['SERVICE_ADVISOR', 'SHOP_MANAGER', 'SHOP_FOREMAN'].includes(user.role) && (
          <Card title="Appointment requests">
            <DataTable
              rows={data.appointment_requests || []}
              columns={[
                { key: 'customer_name', label: 'Customer' },
                { key: 'make', label: 'Vehicle', render: (r) => (r.make ? `${r.make} ${r.model}` : '—') },
                { key: 'preferred_date', label: 'Preferred date' },
                { key: 'notes', label: 'Notes' }
              ]}
              empty="No customer appointment requests are waiting for staff review"
            />
          </Card>
        )}
        <Card title="Bay board overview" action={<Link className="text-sm text-orange-700" to="/bays">Bay board</Link>}>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.bays?.map((bay) => (
              <div key={bay.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <strong>Bay {bay.number}</strong>
                  <Badge status={bay.status} />
                </div>
                <p className="text-xs text-slate-500">{bay.name}</p>
                {bay.booking && <p className="mt-2 text-sm">{bay.booking.ro_number} · {bay.booking.customer_name}</p>}
              </div>
            ))}
          </div>
        </Card>
        <Card title="Certification & parts alerts">
          <div className="space-y-2 text-sm">
            {data.cert_alerts?.map((c) => (
              <p key={c.id}>{c.technician_name}: {c.cert_type} expires {c.expires_on}</p>
            ))}
            {data.low_stock?.map((p) => (
              <p key={p.id}>{p.part_number} · {p.description} · <Badge status={p.status} /></p>
            ))}
            {!data.cert_alerts?.length && !data.low_stock?.length && <Empty>No operational alerts.</Empty>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Intro({ user }) {
  const role = ROLE_FOCUS[user.role] || ROLE_FOCUS.SERVICE_ADVISOR;
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">{role.eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome, {user.full_name}</h1>
        <p className="mt-1 max-w-3xl text-slate-600">{role.description}</p>
      </div>
      <section className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-panel sm:flex-row sm:items-center sm:justify-between" aria-label={`${role.title} priorities`}>
        <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today’s focus</p><h2 className="font-semibold text-slate-900">{role.title}</h2><p className="text-sm text-slate-600">{role.focus}</p></div>
        <Link className="shrink-0 rounded-md bg-slate-900 px-3 py-2 text-center text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-orange-500" to={role.to}>{role.action}</Link>
      </section>
    </div>
  );
}

const ROLE_FOCUS = {
  SERVICE_ADVISOR: { eyebrow: 'Service advisor workspace', title: 'Keep intake and approvals moving', description: 'Coordinate customers, estimates, dispatch, and pickup from one live shop record.', focus: 'Review waiting estimates and appointment requests before committing a bay.', to: '/repair-orders', action: 'Open repair orders' },
  SHOP_MANAGER: { eyebrow: 'Shop manager workspace', title: 'Resolve operational exceptions', description: 'Monitor capacity, approval exposure, account controls, billing, and immutable history.', focus: 'Clear high-value decisions and review exceptions that block the floor.', to: '/audit', action: 'Review audit trail' },
  SHOP_FOREMAN: { eyebrow: 'Shop foreman workspace', title: 'Balance bays and technicians', description: 'Dispatch approved work while protecting certifications, schedules, and bay availability.', focus: 'Check active bay windows and technician load before the next assignment.', to: '/bays', action: 'Open bay board' },
  TECHNICIAN: { eyebrow: 'Technician workspace', title: 'Complete assigned work safely', description: 'See only current assignments, required documentation, and certification alerts.', focus: 'Review job requirements before logging labor or completing a repair.', to: '/repair-orders', action: 'View assigned jobs' },
  PARTS_MANAGER: { eyebrow: 'Parts desk workspace', title: 'Protect inventory commitments', description: 'Prioritize low stock, backorders, compatible reservations, and received shipments.', focus: 'Resolve shelf exceptions without over-reserving available stock.', to: '/parts', action: 'Open parts desk' },
  WARRANTY_ADMIN: { eyebrow: 'Warranty desk workspace', title: 'Advance eligible claims', description: 'Review coverage, documentation, duplicate risk, and reviewer separation.', focus: 'Work the review queue while keeping covered amounts out of customer billing.', to: '/warranties', action: 'Open warranty queue' },
  CUSTOMER: { eyebrow: 'Customer portal', title: 'Review your Civic service', description: 'Your vehicles, estimates, invoices, and appointment requests stay scoped to your account.', focus: 'Review pending decisions or request the next visit for your vehicle.', to: '/portal', action: 'Open customer portal' }
};

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular">{value}</div>
    </div>
  );
}

function RoTable({ rows }) {
  return (
    <DataTable
      rows={rows}
      empty="Nothing in this queue"
      columns={[
        { key: 'number', label: 'RO', render: (r) => <Link className="font-medium text-orange-700" to={`/repair-orders/${r.id}`}>{r.number}</Link> },
        { key: 'customer_name', label: 'Customer' },
        { key: 'make', label: 'Vehicle', render: (r) => `${r.year} ${r.make} ${r.model}` },
        { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> }
      ]}
    />
  );
}
