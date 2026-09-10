const base = () => String(process.env.VENDOR_BASE_URL || 'http://localhost:3101').replace(/\/$/, '');
const token = () => process.env.VENDOR_TOKEN || 'db-vendor-dev';
const noticeKey = () => process.env.NOTICE_API_KEY || 'db-notice-dev';

export async function vendorJson(method, path, { query, body, notice } = {}) {
  const url = new URL(path, `${base()}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null) url.searchParams.set(key, String(value));
    }
  }
  const headers = { 'Content-Type': 'application/json' };
  if (notice) headers['X-Notice-Key'] = noticeKey();
  else headers.Authorization = `Bearer ${token()}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'A plant vendor desk refused the request');
    error.status = response.status >= 400 ? response.status : 503;
    throw error;
  }
  return data;
}

export async function postPaidVendors({ application, quote, person }) {
  const breakdown = {
    wip_cents: quote.wip_cents,
    new_stored_cents: quote.new_stored_cents,
    fee_cents: quote.fee_cents,
    bond_cents: quote.bond_cents,
    tax_cents: quote.tax_cents,
    fringe_cents: quote.fringe_cents,
    retainage_cents: quote.retainage_cents,
    ld_cents: quote.ld_cents,
    total_cents: quote.net_cents
  };
  await vendorJson('POST', '/notices/receipts', {
    notice: true,
    body: { application_id: application.id, total_cents: quote.net_cents, breakdown, channel: 'paper' }
  });
  await vendorJson('POST', '/sms/receipts', {
    notice: true,
    body: { application_id: application.id, total_cents: quote.net_cents, breakdown, channel: 'sms' }
  });
  await vendorJson('POST', '/emails/receipts', {
    notice: true,
    body: { application_id: application.id, total_cents: quote.net_cents, breakdown, channel: 'email' }
  });
  await vendorJson('POST', '/diary/holds', {
    notice: true,
    body: {
      application_id: application.id,
      period_start: application.period_start,
      period_end: application.period_end
    }
  });
  // The people table carries `member`; preferred_vendor_member is a companies
  // column, so this guard never fired and the punch desk was never asked.
  if (person?.member) {
    await vendorJson('POST', '/loyalty/punches', {
      notice: true,
      body: { application_id: application.id, person_id: person.id, member: true }
    });
  }
  await vendorJson('POST', '/waivers', {
    notice: true,
    body: { application_id: application.id, kind: 'unconditional', status: 'ISSUED' }
  });
}
