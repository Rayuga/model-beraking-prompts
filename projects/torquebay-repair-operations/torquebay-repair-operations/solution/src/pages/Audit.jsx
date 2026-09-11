import { useEffect, useState } from 'react';
import { useSession } from '../App.jsx';
import { Card } from '../components/ui.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { api } from '../lib/api.js';
import { fmtDate } from '../lib/utils.js';

export default function Audit() {
  const { notify } = useSession();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api('/api/audit').then((d) => setRows(d.entries)).catch((e) => notify(e.message, 'error'));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit history</h1>
      <p className="text-sm text-slate-500">Append-only. Direct edit and delete requests are rejected by the server.</p>
      <Card>
        <DataTable
          rows={rows}
          columns={[
            { key: 'created_at', label: 'When', render: (r) => fmtDate(r.created_at) },
            { key: 'actor_name', label: 'Actor', render: (r) => `${r.actor_name} (${r.actor_role})` },
            { key: 'action', label: 'Action' },
            { key: 'entity', label: 'Entity', render: (r) => `${r.entity} ${String(r.entity_id).slice(0, 12)}` },
            { key: 'previous_state', label: 'From' },
            { key: 'new_state', label: 'To' },
            { key: 'reason', label: 'Reason' }
          ]}
        />
      </Card>
    </div>
  );
}
