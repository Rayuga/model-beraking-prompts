import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../App.jsx';
import { Badge, Button, Card, ErrorText } from '../components/ui.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { api } from '../lib/api.js';
import { money } from '../lib/utils.js';

export default function Estimates() {
  const { user, notify } = useSession();
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    const { estimates } = await api('/api/estimates');
    setRows(estimates);
  }
  useEffect(() => { load().catch((e) => notify(e.message, 'error')); }, [user.id]);

  async function open(row) {
    setError('');
    const data = await api(`/api/estimates/${row.id}`);
    setSelected(data.estimate);
  }

  async function staffApprove() {
    setError('');
    try {
      await api(`/api/estimates/${selected.id}/staff-approve`, {
        method: 'POST', body: { reason: 'Staff approval review' }
      });
      notify('Estimate staff-approved');
      await load();
      await open(selected);
    } catch (e) { setError(e.message); }
  }

  async function decide(approval) {
    await api(`/api/estimates/${selected.id}/approve-lines`, {
      method: 'POST',
      body: { decisions: selected.pending.map((l) => ({ id: l.id, approval })) }
    });
    notify(`Pending lines ${approval.toLowerCase()}`);
    await load();
    await open(selected);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Estimates</h1>
      <Card>
        <DataTable
          rows={rows}
          onRow={open}
          columns={[
            { key: 'ro_number', label: 'RO', render: (r) => <Link className="text-orange-700" to={`/repair-orders/${r.repair_order_id}`}>{r.ro_number}</Link> },
            { key: 'customer_name', label: 'Customer' },
            { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
            { key: 'total_cents', label: 'Total', render: (r) => money(r.total_cents) },
            { key: 'expires_at', label: 'Expires' }
          ]}
        />
      </Card>
      {selected && (
        <Card title={`Estimate revision ${selected.revision}`} action={<Badge status={selected.status} />}>
          <p className="text-sm">{selected.ro_number} · authored by {selected.created_by_name} · expires {selected.expires_at || '—'}</p>
          <table className="mt-3 min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th>Line</th><th>Amount</th><th>Approval</th></tr></thead>
            <tbody>
              {selected.lines.map((l) => (
                <tr key={l.id} className="border-t"><td className="py-2">{l.description}</td><td>{money(l.amount_cents)}</td><td><Badge status={l.customer_approval} /></td></tr>
              ))}
            </tbody>
          </table>
          {user.role === 'CUSTOMER' && selected.pending?.length > 0 && (
            <div className="mt-3 flex gap-2">
              <Button onClick={() => decide('APPROVED')}>Approve pending</Button>
              <Button variant="danger" onClick={() => decide('DECLINED')}>Decline pending</Button>
            </div>
          )}
          {['SERVICE_ADVISOR', 'SHOP_MANAGER'].includes(user.role) && !selected.staff_approved_by && (
            <div className="mt-3">
              <ErrorText>{error}</ErrorText>
              <Button onClick={staffApprove}>Staff approve estimate</Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
