import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, formatCents } from '../lib/api.js';

// In-app hosted Checkout twin. When Stripe test-mode is live the app redirects to
// checkout.stripe.com instead; either way settlement forms the same payments row.
export default function Checkout() {
  const { paymentId } = useParams();
  const [status, setStatus] = useState('ready');
  const [msg, setMsg] = useState('');
  async function pay() {
    setStatus('paying');
    try {
      await api(`/api/checkout/${paymentId}/complete`, { method: 'POST' });
      setStatus('paid');
      setMsg('Payment settled. You may return to the record.');
    } catch (e) { setStatus('error'); setMsg(e.message); }
  }
  return (
    <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="mb-2 text-lg font-semibold">MedLedger hosted checkout</h2>
      <p className="mb-4 text-sm text-slate-600">Payment <code>{paymentId}</code></p>
      <p className="mb-4 text-xs text-slate-500">Test card 4242 4242 4242 4242 · exp 12/34 · cvc 123 · ZIP 42424</p>
      <button disabled={status === 'paying' || status === 'paid'} onClick={pay}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50">Pay now</button>
      {msg && <p className="mt-3 text-sm text-slate-700">{msg}</p>}
    </div>
  );
}

export function CheckoutSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [msg, setMsg] = useState('Reconciling…');
  useEffect(() => {
    if (!sessionId) { setMsg('No session id.'); return; }
    api(`/api/checkout/reconcile?session_id=${encodeURIComponent(sessionId)}`)
      .then((d) => setMsg(`Settled: ${d.payment?.channel} ${formatCents(d.payment?.amount_cents)}`))
      .catch((e) => setMsg(e.message));
  }, [sessionId]);
  return <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6">
    <h2 className="mb-2 text-lg font-semibold">Payment received</h2>
    <p className="text-sm text-slate-700">{msg}</p>
  </div>;
}
