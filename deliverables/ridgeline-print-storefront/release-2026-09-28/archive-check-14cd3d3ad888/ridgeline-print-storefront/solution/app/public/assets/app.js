import { React, ReactDOM } from './react-vendor.js';

const h = React.createElement;
const { useState, useEffect, useRef } = React;
const money = value => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(value || 0) / 100);
const store = {
  read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  remove(key) { try { localStorage.removeItem(key); } catch {} }
};
const cartKey = 'ridgeline_basket_v2';
const addressKey = 'ridgeline_address_v2';
const intentKey = 'ridgeline_checkout_v2';
const emptyAddress = { name: '', line1: '', line2: '', city: '', postcode: '', country: 'United Kingdom' };
const initialCart = () => {
  const saved = store.read(cartKey, []);
  return Array.isArray(saved) ? saved.filter(line => line && typeof line.sku === 'string' && typeof line.size === 'string' && Number.isInteger(line.qty) && line.qty > 0) : [];
};
async function request(url, body) {
  const response = await fetch(url, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let data;
  try { data = await response.json(); } catch { throw new Error('The shop could not be reached. Please try again.'); }
  if (!response.ok) throw Object.assign(new Error(data.error || 'That request could not be completed.'), { details: data, status: response.status });
  return data;
}
function Icon({ name, size = 20 }) {
  const paths = {
    bag: 'M6 7h12l1 13H5L6 7Zm3 0V5a3 3 0 0 1 6 0v2',
    search: 'M21 21l-5.2-5.2M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    moon: 'M20 14a8 8 0 0 1-10-10A8 8 0 1 0 20 14Z',
    sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    check: 'm5 12 4 4L19 6',
    close: 'm6 6 12 12M6 18 18 6'
  };
  return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: paths[name] || paths.arrow }));
}
function Action({ children, className = '', secondary = false, ...props }) {
  return h('button', { type: 'button', className: `${secondary ? 'button-secondary' : 'button'} ${className}`, ...props }, children);
}
function Summary({ pricing, receipt = false }) {
  if (!pricing) return null;
  const postage = pricing.postage || { band: pricing.postage_band, price_pence: pricing.postage_pence, collection_only: pricing.collection_only };
  return h('div', { className: 'summary' },
    h('dl', null,
      h('div', null, h('dt', null, 'Subtotal'), h('dd', null, money(pricing.subtotal_pence))),
      h('div', { className: pricing.trade_saving_pence ? 'saving' : '' }, h('dt', null, 'Trade break saving'), h('dd', null, `${pricing.trade_saving_pence ? '−' : ''}${money(pricing.trade_saving_pence)}`)),
      h('div', null, h('dt', null, postage.collection_only ? 'Studio collection' : `Postage${postage.band ? ` · ${postage.band}` : ''}`), h('dd', null, money(postage.price_pence))),
      h('div', { className: 'summary-total' }, h('dt', null, receipt ? 'Original total' : 'Total'), h('dd', null, money(pricing.total_pence)))
    ),
    h('p', { className: 'fine-print' }, postage.collection_only ? `Collection only · ${pricing.weight_grams}g exceeds our postage bands. Collect from the studio.` : `${pricing.weight_grams || 0}g packed print weight · postage calculated for this basket.`)
  );
}
function Quantity({ value, onChange, label, max }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit() {
    const next = Number(draft);
    if (draft === '' || !Number.isInteger(next) || next < 0 || onChange(next) === false) setDraft(String(value));
  }
  return h('div', { className: 'quantity' },
    h('button', { type: 'button', 'aria-label': `Decrease ${label}`, disabled: value <= 0, onClick: () => onChange(value - 1) }, '−'),
    h('input', { type: 'number', min: 0, step: 1, value: draft, 'aria-label': `Quantity for ${label}`, onChange: event => setDraft(event.target.value), onBlur: commit, onKeyDown: event => { if (event.key === 'Enter') { event.preventDefault(); commit(); event.currentTarget.blur(); } } }),
    h('button', { type: 'button', 'aria-label': `Increase ${label}`, onClick: () => onChange(value + 1) }, '+')
  );
}
function PrintCard({ print, navigate }) {
  return h('article', { className: 'print-card' },
    h('button', { className: 'print-link', type: 'button', onClick: () => navigate(`/print/${print.sku}`), 'aria-label': `View ${print.title}` },
      h('div', { className: 'print-image' }, h('img', { src: print.image, alt: `${print.title}, risograph print`, loading: 'lazy' }), !print.buyable && h('span', { className: 'sold-stamp' }, 'Edition sold out')),
      h('div', { className: 'print-meta' }, h('span', { className: 'eyebrow' }, `${print.sku} / ${print.available_sizes.join(' + ')}`), h('span', { className: 'card-arrow' }, '↗')),
      h('div', { className: 'print-name' }, h('h2', null, print.title), h('span', null, `From ${money(print.from_price_pence)}`)),
      h('p', { className: `availability ${print.buyable ? '' : 'muted'}` }, h('span', { className: 'dot' }), print.buyable ? 'In stock' : 'Sold out')
    )
  );
}
function Catalogue({ catalogue, navigate }) {
  const [filters, setFilters] = useState({ search: '', size: '', paper: '', sort: 'title_asc' });
  const prints = catalogue.prints;
  const papers = [...new Set(prints.flatMap(print => print.paper_sheets))].sort();
  const shown = prints.filter(print => print.title.toLowerCase().includes(filters.search.trim().toLowerCase()) && (!filters.size || print.available_sizes.includes(filters.size)) && (!filters.paper || print.paper_sheets.includes(filters.paper))).sort((a, b) => {
    if (filters.sort.startsWith('price')) return (a.from_price_pence - b.from_price_pence) * (filters.sort === 'price_desc' ? -1 : 1) || a.title.localeCompare(b.title);
    return a.title.localeCompare(b.title) * (filters.sort === 'title_desc' ? -1 : 1);
  });
  const change = key => event => setFilters(current => ({ ...current, [key]: event.target.value }));
  return h(React.Fragment, null,
    h('section', { className: 'hero', 'aria-labelledby': 'shop-heading' },
      h('div', { className: 'hero-copy' }, h('p', { className: 'eyebrow' }, 'Independent editions / Printed in small runs'), h('h1', { id: 'shop-heading' }, 'A little ink.', h('br'), h('em', null, 'A different view.')), h('p', null, 'Original risograph prints for the places you make your own. Rich colour, honest paper, and the beautiful things in between.')),
      h('div', { className: 'edition-note' }, h('div', { className: 'registration-mark', 'aria-hidden': true }, '✳'), h('span', { className: 'eyebrow' }, 'The studio collection'), h('strong', null, '08'), h('span', null, 'prints, each with a point of view'), h('small', null, 'A3 + A2 / unframed editions'))
    ),
    h('section', { className: 'catalogue', 'aria-label': 'Print catalogue' },
      h('div', { className: 'collection-heading' }, h('h2', null, 'Find your print'), h('span', { className: 'muted' }, `${shown.length} of ${prints.length} editions`)),
      h('div', { className: 'filter-bar' },
        h('label', { className: 'search-field' }, h('span', { className: 'sr-only' }, 'Search prints'), h(Icon, { name: 'search', size: 18 }), h('input', { type: 'search', placeholder: 'Search by title', value: filters.search, onChange: change('search') })),
        h('label', null, h('span', null, 'Size'), h('select', { 'aria-label': 'Size', value: filters.size, onChange: change('size') }, h('option', { value: '' }, 'All sizes'), h('option', { value: 'A3' }, 'A3'), h('option', { value: 'A2' }, 'A2'))),
        h('label', null, h('span', null, 'Paper'), h('select', { 'aria-label': 'Paper', value: filters.paper, onChange: change('paper') }, h('option', { value: '' }, 'All paper stocks'), ...papers.map(paper => h('option', { key: paper, value: paper }, paper)))),
        h('label', null, h('span', null, 'Sort'), h('select', { 'aria-label': 'Sort', value: filters.sort, onChange: change('sort') }, h('option', { value: 'title_asc' }, 'Title · A–Z'), h('option', { value: 'title_desc' }, 'Title · Z–A'), h('option', { value: 'price_asc' }, 'Price · low to high'), h('option', { value: 'price_desc' }, 'Price · high to low')))
      ),
      shown.length ? h('div', { className: 'print-grid' }, ...shown.map(print => h(PrintCard, { key: print.sku, print, navigate }))) : h('div', { className: 'empty-state' }, h('h2', null, 'No prints found'), h('p', null, 'Try a different title, size or paper stock.'), h(Action, { secondary: true, onClick: () => setFilters({ search: '', size: '', paper: '', sort: 'title_asc' }) }, 'Clear filters'))
    ),
    h('section', { className: 'studio-strip' }, h('div', null, h('span', { className: 'eyebrow' }, 'Better together'), h('h2', null, 'A small run for your whole space.')), h('p', null, 'Choose more of the same print and size to unlock its trade price. The price break is shown on every edition, and applied to every print on that line.'))
  );
}
function Product({ sku, catalogue, cart, updateLine, navigate }) {
  const print = catalogue.prints.find(item => item.sku === sku);
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState('');
  if (!print) return h('section', { className: 'empty-state' }, h('h1', null, 'Print not found'), h(Action, { onClick: () => navigate('/') }, 'Browse prints'));
  const chosen = print.sizes.find(item => item.size === size) || print.sizes.find(item => item.in_stock > 0) || print.sizes[0];
  const currentQty = cart.find(line => line.sku === sku && line.size === chosen.size)?.qty || 0;
  function add() {
    if (updateLine(sku, chosen.size, currentQty + qty)) setMessage(`${qty} × ${print.title} (${chosen.size}) added to your basket.`);
  }
  return h('section', { className: 'product-section' },
    h('button', { className: 'text-button back-link', onClick: () => navigate('/') }, '← All prints'),
    h('div', { className: 'product-layout' },
      h('div', { className: 'product-art' }, h('img', { src: print.image, alt: `${print.title} risograph artwork` })),
      h('div', { className: 'product-details' }, h('p', { className: 'eyebrow' }, `${sku} / Ridgeline Press edition`), h('h1', null, print.title), h('p', { className: 'product-description' }, 'An original studio edition, printed in layers of colour on carefully chosen paper. Supplied unframed, ready for a place of its own.'),
        h('fieldset', { className: 'size-picker' }, h('legend', null, 'Choose a size'), ...print.sizes.map(variant => h('button', { key: variant.size, type: 'button', className: chosen.size === variant.size ? 'selected' : '', 'aria-pressed': chosen.size === variant.size, onClick: () => { setSize(variant.size); setMessage(''); setQty(1); } }, h('strong', null, variant.size), h('span', null, money(variant.price_pence)), h('small', null, variant.in_stock ? `${variant.in_stock} in stock` : 'Sold out')))),
        h('p', { className: 'paper-spec' }, chosen.stock_sheet),
        h('div', { className: 'trade-note' }, h('strong', null, `${chosen.tier_qty}+ of this size: ${money(chosen.tier_price_pence)} each`), h('p', null, 'Trade pricing applies to every unit of this print and size. Different lines stay separate.')),
        h('div', { className: 'product-buy' }, h('strong', { className: 'product-price' }, money(qty + currentQty >= chosen.tier_qty ? chosen.tier_price_pence : chosen.price_pence), h('small', null, ' per print after adding')), h('span', { className: 'availability' }, chosen.in_stock ? `${chosen.in_stock} available` : 'Sold out')),
        h('div', { className: 'buy-row' }, h(Quantity, { value: qty, label: `${print.title} ${chosen.size} to add`, onChange: next => { if (!Number.isInteger(next) || next < 1) return false; setQty(next); return true; } }), h(Action, { onClick: add, disabled: !chosen.in_stock }, chosen.in_stock ? 'Add to basket' : 'Sold out', h(Icon, { name: 'bag' }))),
        currentQty > 0 && h('p', { className: 'fine-print' }, `${currentQty} of this size already in your basket.`),
        message && h('div', { className: 'success-note', role: 'status' }, message, h('button', { className: 'text-button', onClick: () => navigate('/basket') }, 'View basket →')),
        h('p', { className: 'fine-print product-footnote' }, 'Postage from £1.75. Heavy baskets are collected from the studio. No account or payment card needed.')
      )
    )
  );
}
function Basket({ cart, pricing, pricingError, catalogue, updateLine, navigate, busy }) {
  return h('section', { className: 'page-section' },
    h('p', { className: 'eyebrow' }, 'Your collection'), h('div', { className: 'page-heading' }, h('h1', null, 'The basket.'), h('button', { className: 'text-button', onClick: () => navigate('/') }, 'Continue browsing →')),
    !cart.length ? h('div', { className: 'empty-state' }, h('h2', null, 'A little room for something good.'), h('p', null, 'Your basket is empty. Explore the studio collection to find your print.'), h(Action, { onClick: () => navigate('/') }, 'Explore the prints')) : h('div', { className: 'checkout-layout' },
      h('div', { className: 'basket-lines' }, ...cart.map(line => {
        const print = catalogue.prints.find(item => item.sku === line.sku);
        const variant = print?.sizes.find(item => item.size === line.size);
        const priced = pricing?.lines.find(item => item.sku === line.sku && item.size === line.size);
        return h('article', { className: 'basket-line', key: `${line.sku}-${line.size}` },
          h('button', { className: 'basket-image', 'aria-label': `View ${print?.title || line.sku}`, onClick: () => navigate(`/print/${line.sku}`) }, h('img', { src: print?.image, alt: print?.title || line.sku })),
          h('div', { className: 'basket-line-info' }, h('span', { className: 'eyebrow' }, `${line.sku} / ${line.size}`), h('h2', null, print?.title || line.sku), h('p', { className: 'fine-print' }, variant?.stock_sheet), h('p', null, priced ? `${money(priced.unit_price_pence)} each` : 'Awaiting a current price'), variant && h('p', { className: priced?.trade_applied ? 'trade-applied' : 'fine-print' }, priced?.trade_applied ? `Trade price applied · saving ${money(priced.saving_pence)}` : `Trade break: ${variant.tier_qty}+ at ${money(variant.tier_price_pence)} each`), h('div', { className: 'line-actions' }, h(Quantity, { value: line.qty, label: `${print?.title || line.sku} ${line.size}`, onChange: next => updateLine(line.sku, line.size, next) }), h('button', { className: 'text-button', 'aria-label': `Remove ${print?.title || line.sku} ${line.size}`, onClick: () => updateLine(line.sku, line.size, 0) }, 'Remove'))),
          h('strong', { className: 'line-total' }, priced ? money(priced.line_total_pence) : '—')
        );
      })),
      h('aside', { className: 'order-panel' }, h('h2', null, 'Order summary'), pricingError && h('p', { className: 'error-note', role: 'alert' }, pricingError), busy ? h('p', { role: 'status' }, 'Updating your basket…') : h(Summary, { pricing }), h(Action, { className: 'full-width', disabled: busy || !!pricingError || !pricing?.lines.length, onClick: () => navigate('/checkout') }, 'Continue to checkout', h(Icon, { name: 'arrow' })), h('p', { className: 'fine-print' }, 'Your basket stays in this browser. Stock is confirmed when you place your order.'))
    )
  );
}
function Checkout({ cart, pricing, pricingError, navigate, onPlaced, pendingCheckout, onPendingChange }) {
  const [address, setAddress] = useState(() => ({ ...emptyAddress, ...(pendingCheckout?.body.address || store.read(addressKey, {})) }));
  const [stage, setStage] = useState('address');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  useEffect(() => store.write(addressKey, address), [address]);
  function change(key, value) { setAddress(current => ({ ...current, [key]: value })); setError(''); }
  async function place() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    let intent = pendingCheckout;
    if (!intent) {
      const cleanAddress = Object.fromEntries(Object.entries(address).map(([key, value]) => [key, String(value).trim()]));
      const lines = cart.map(line => ({ sku: line.sku, size: line.size, qty: line.qty })).sort((a, b) => `${a.sku}:${a.size}`.localeCompare(`${b.sku}:${b.size}`));
      const id = crypto.randomUUID();
      intent = { id, body: { lines, address: cleanAddress, checkout_id: id }, pricing };
      onPendingChange(intent);
    }
    try {
      const order = await request('/api/orders', intent.body);
      onPendingChange(null);
      onPlaced(order);
    } catch (failure) {
      if (failure.status >= 400 && failure.status < 500) onPendingChange(null);
      setError(`${failure.message}${!failure.status || failure.status >= 500 ? ' Your checkout is saved; retrying will not place the same order twice.' : ''}`);
    } finally { locked.current = false; setBusy(false); }
  }
  if (pendingCheckout) {
    const saved = pendingCheckout.body.address;
    return h('section', { className: 'page-section' }, h('p', { className: 'eyebrow' }, 'Saved checkout'), h('h1', null, 'Let’s find your order.'),
      h('p', { className: 'muted' }, 'Your previous checkout may already have succeeded. Recover that exact order before changing the basket or starting another checkout. A retry will not create a second order.'),
      h('div', { className: 'checkout-layout' }, h('div', { className: 'address-panel' }, h('h2', null, 'The details you submitted'), h('address', null, saved.name, h('br'), saved.line1, saved.line2 && h(React.Fragment, null, h('br'), saved.line2), h('br'), `${saved.city}, ${saved.postcode}`, h('br'), saved.country),
        h('h2', { className: 'review-items-heading' }, 'Your saved prints'), h('ul', { className: 'review-lines' }, ...(pendingCheckout.pricing?.lines || []).map(line => h('li', { key: `${line.sku}-${line.size}` }, h('span', null, `${line.qty} × ${line.title} (${line.size})`), h('strong', null, money(line.line_total_pence))))),
        error && h('p', { role: 'alert', className: 'error-note' }, error), h(Action, { className: 'recovery-action', onClick: place, disabled: busy }, busy ? 'Finding your order…' : 'Recover saved order', !busy && h(Icon, { name: 'arrow' }))),
        h('aside', { className: 'order-panel' }, h('h2', null, 'Saved order summary'), h(Summary, { pricing: pendingCheckout.pricing }), h('p', { className: 'fine-print' }, 'These are the details of your original checkout. Current catalogue stock does not prevent recovery of an order already placed.'))));
  }
  if (!cart.length) return h('section', { className: 'empty-state' }, h('h1', null, 'Your basket is empty'), h(Action, { onClick: () => navigate('/') }, 'Find your print'));
  const fields = [['name', 'Full name', 'name'], ['line1', 'Address line 1', 'address-line1'], ['line2', 'Address line 2 (optional)', 'address-line2'], ['city', 'Town or city', 'address-level2'], ['postcode', 'Postcode', 'postal-code'], ['country', 'Country', 'country-name']];
  return h('section', { className: 'page-section' }, h('p', { className: 'eyebrow' }, 'Almost yours'), h('h1', null, 'Checkout.'),
    h('ol', { className: 'checkout-steps', 'aria-label': 'Checkout steps' }, h('li', { 'aria-current': stage === 'address' ? 'step' : undefined, className: stage === 'address' ? 'active' : '' }, '01 · Delivery details'), h('li', { 'aria-current': stage === 'review' ? 'step' : undefined, className: stage === 'review' ? 'active' : '' }, '02 · Review & place order')),
    h('div', { className: 'checkout-layout' },
      h('div', { className: 'address-panel' }, stage === 'address' ? h('form', { onSubmit: event => { event.preventDefault(); setStage('review'); setError(''); } }, h('h2', null, pricing?.postage.collection_only ? 'Your contact details' : 'Where shall we send it?'), h('p', { className: 'muted' }, pricing?.postage.collection_only ? 'This basket is collection only. We retain your contact address with the order.' : 'Tell us where your new prints will live.'), h('div', { className: 'address-fields' }, ...fields.map(([key, label, autocomplete]) => h('label', { className: key === 'city' || key === 'postcode' ? '' : 'wide', key }, h('span', null, label), h('input', { name: key, required: key !== 'line2', autoComplete: autocomplete, value: address[key], onChange: event => change(key, event.target.value) })))), h('div', { className: 'form-actions' }, h('button', { className: 'text-button', type: 'button', onClick: () => navigate('/basket') }, '← Back to basket'), h(Action, { type: 'submit', disabled: !!pricingError || !pricing }, 'Review order', h(Icon, { name: 'arrow' })))) : h('div', null,
        h('div', { className: 'review-heading' }, h('h2', null, pricing?.postage.collection_only ? 'Contact address' : 'Delivery address'), h('button', { className: 'text-button', onClick: () => setStage('address'), disabled: busy }, 'Edit details')),
        h('address', null, address.name, h('br'), address.line1, address.line2 && h(React.Fragment, null, h('br'), address.line2), h('br'), `${address.city}, ${address.postcode}`, h('br'), address.country),
        h('h2', { className: 'review-items-heading' }, 'Your prints'), h('ul', { className: 'review-lines' }, ...(pricing?.lines || []).map(line => h('li', { key: `${line.sku}-${line.size}` }, h('span', null, `${line.qty} × ${line.title} (${line.size})`, h('small', null, `${money(line.unit_price_pence)} each${line.trade_applied ? ' · Trade price' : ''}`)), h('strong', null, money(line.line_total_pence))))),
        error && h('p', { role: 'alert', className: 'error-note' }, error),
        h('div', { className: 'form-actions' }, h('button', { className: 'text-button', onClick: () => navigate('/basket'), disabled: busy }, '← Edit basket'), h(Action, { onClick: place, disabled: busy || !!pricingError || !pricing }, busy ? 'Placing your order…' : 'Place order', !busy && h(Icon, { name: 'arrow' }))),
        h('p', { className: 'fine-print' }, 'No payment is taken and no card details are collected. You can cancel a placed order from its receipt.')
      )),
      h('aside', { className: 'order-panel' }, h('h2', null, 'Order summary'), pricingError && h('p', { className: 'error-note', role: 'alert' }, pricingError), h(Summary, { pricing }), h('p', { className: 'fine-print' }, 'All prices include the applicable trade break. We confirm availability when you place the order.'))
    )
  );
}
function Order({ reference, navigate, refreshCatalogue }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelDialog = useRef(null);
  useEffect(() => {
    if (confirmCancel && !cancelDialog.current?.open) cancelDialog.current?.showModal();
    else if (!confirmCancel && cancelDialog.current?.open) cancelDialog.current.close();
  }, [confirmCancel]);
  useEffect(() => { let active = true; setOrder(null); setError(''); request(`/api/orders/${encodeURIComponent(reference)}`).then(value => { if (active) setOrder(value); }).catch(failure => { if (active) setError(failure.message); }); return () => { active = false; }; }, [reference]);
  async function cancel() {
    setBusy(true); setError('');
    try { const updated = await request(`/api/orders/${encodeURIComponent(reference)}/cancel`, {}); setOrder(updated); setConfirmCancel(false); await refreshCatalogue(); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  if (!order) return h('section', { className: 'empty-state' }, error ? h(React.Fragment, null, h('h1', null, 'Order not found'), h('p', { className: 'error-note', role: 'alert' }, error), h(Action, { onClick: () => navigate('/track') }, 'Try another reference')) : h('p', { role: 'status' }, 'Finding your order…'));
  const cancelled = order.status === 'cancelled';
  const statusLabel = cancelled ? 'Cancelled' : order.status === 'dispatched' ? 'Dispatched' : 'Placed';
  return h('section', { className: 'receipt-page' },
    h('p', { className: 'eyebrow' }, 'Your Ridgeline receipt'), h('div', { className: 'receipt-heading' }, h('h1', null, cancelled ? 'Order cancelled.' : order.status === 'dispatched' ? 'From the archive.' : 'Good things are on paper.'), h('span', { className: `status-pill ${cancelled ? 'cancelled' : ''}` }, h(Icon, { name: cancelled ? 'close' : 'check', size: 16 }), statusLabel)),
    h('p', { className: 'receipt-intro' }, cancelled ? 'This order is cancelled. Its prints have been returned to stock once; the original receipt is kept below.' : order.status === 'dispatched' ? 'This order has been dispatched. Its original prices are preserved in the receipt below.' : 'Your order is confirmed. Keep your reference to look it up or cancel it before dispatch.'),
    h('div', { className: 'reference-bar' }, h('div', null, h('span', { className: 'eyebrow' }, 'Order reference'), h('strong', null, order.reference)), h('div', null, h('span', { className: 'eyebrow' }, 'Placed'), h('span', null, new Date(order.placed_at).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })))),
    h('div', { className: 'checkout-layout' },
      h('div', null, h('h2', null, 'The original order'), h('ul', { className: 'receipt-lines' }, ...order.lines.map(line => h('li', { key: line.id || `${line.sku}-${line.size}` }, h('img', { src: `/images/${line.sku.toLowerCase()}.png`, alt: line.title }), h('div', null, h('span', { className: 'eyebrow' }, `${line.sku} / ${line.size}`), h('h3', null, line.title), h('p', null, `${line.qty} × ${money(line.unit_price_pence)} each`), !!line.trade_applied && h('span', { className: 'trade-applied' }, 'Trade price applied')), h('strong', null, money(line.line_total_pence))))),
        h('section', { className: 'receipt-address' }, h('h2', null, order.collection_only ? 'Contact address · collection only' : 'Delivery address'), h('address', null, order.address_name, h('br'), order.address_line1, order.address_line2 && h(React.Fragment, null, h('br'), order.address_line2), h('br'), `${order.address_city}, ${order.address_postcode}`, h('br'), order.address_country))
      ),
      h('aside', { className: 'order-panel' }, h('h2', null, 'Prices as confirmed'), h(Summary, { pricing: order, receipt: true }), h('p', { className: 'fine-print' }, 'No payment was taken. These figures are the original order amounts.'), cancelled && order.cancelled_at && h('p', { className: 'fine-print' }, `Cancelled ${new Date(order.cancelled_at).toLocaleString('en-GB')}.`))
    ),
    error && h('p', { role: 'alert', className: 'error-note' }, error),
    h('dialog', { ref: cancelDialog, className: 'cancel-confirm', role: 'alertdialog', 'aria-labelledby': 'cancel-title', 'aria-describedby': 'cancel-description', onCancel: event => { event.preventDefault(); if (!busy) setConfirmCancel(false); } }, h('h2', { id: 'cancel-title' }, 'Cancel this order?'), h('p', { id: 'cancel-description' }, 'All prints in this order will return to stock. You will keep the original receipt, marked as cancelled.'), h('div', { className: 'form-actions' }, h(Action, { secondary: true, onClick: () => setConfirmCancel(false), disabled: busy, autoFocus: true }, 'Keep order'), h(Action, { className: 'danger', onClick: cancel, disabled: busy }, busy ? 'Cancelling…' : 'Confirm cancellation'))),
    h('div', { className: 'receipt-actions' }, h(Action, { onClick: () => navigate('/') }, 'Continue browsing', h(Icon, { name: 'arrow' })), order.cancellable && h('button', { className: 'text-button', onClick: () => setConfirmCancel(true) }, 'Cancel order'))
  );
}
function Track({ navigate }) {
  const [reference, setReference] = useState('');
  return h('section', { className: 'track-page' }, h('p', { className: 'eyebrow' }, 'A print has a story'), h('h1', null, 'Find your order.'), h('p', { className: 'muted' }, 'Use the reference from your confirmation to view the original receipt, check its status or cancel a placed order.'), h('form', { className: 'track-form', onSubmit: event => { event.preventDefault(); navigate(`/order/${encodeURIComponent(reference.trim().toUpperCase())}`); } }, h('label', null, h('span', null, 'Order reference'), h('input', { type: 'text', required: true, value: reference, placeholder: 'RP-100001', onChange: event => setReference(event.target.value), autoCapitalize: 'characters', autoComplete: 'off' })), h(Action, { type: 'submit' }, 'Find order', h(Icon, { name: 'arrow' }))), h('p', { className: 'fine-print' }, 'No sign-in needed. Your reference is on your order confirmation.'));
}
function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [catalogue, setCatalogue] = useState(null);
  const [catalogueError, setCatalogueError] = useState('');
  const [cart, setCart] = useState(initialCart);
  const [pricing, setPricing] = useState(null);
  const [pricingError, setPricingError] = useState('');
  const [pricingBusy, setPricingBusy] = useState(true);
  const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState(() => store.read('ridgeline_theme_v2', 'light'));
  const [stockRevision, setStockRevision] = useState(0);
  const [pendingCheckout, setPendingCheckout] = useState(() => {
    const saved = store.read(intentKey, null);
    return saved?.body && saved.body.checkout_id ? saved : null;
  });
  const mainRef = useRef(null);
  async function refreshCatalogue() {
    try { const value = await request('/api/prints'); setCatalogue(value); setCatalogueError(''); setStockRevision(current => current + 1); }
    catch (failure) { setCatalogueError(failure.message); }
  }
  useEffect(() => { refreshCatalogue(); const focus = () => refreshCatalogue(); window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, []);
  useEffect(() => { const change = () => { setRoute(window.location.pathname); setNotice(''); }; window.addEventListener('popstate', change); return () => window.removeEventListener('popstate', change); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; store.write('ridgeline_theme_v2', theme); }, [theme]);
  useEffect(() => {
    store.write(cartKey, cart);
    let active = true;
    setPricingBusy(true);
    request('/api/basket/price', { lines: cart }).then(value => { if (active) { setPricing(value); setPricingError(''); } }).catch(failure => { if (active) { setPricing(null); setPricingError(failure.message); } }).finally(() => { if (active) setPricingBusy(false); });
    return () => { active = false; };
  }, [cart, stockRevision]);
  function navigate(path) {
    if (path !== window.location.pathname) window.history.pushState({}, '', path);
    setRoute(path); setNotice(''); window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
    if (path === '/') refreshCatalogue();
  }
  function updateLine(sku, size, qty) {
    if (pendingCheckout) { setNotice('Your previous checkout may have succeeded. Recover the saved order before changing your basket.'); return false; }
    if (!Number.isInteger(qty) || qty < 0) { setNotice('Choose a whole number of prints, or zero to remove the line.'); return false; }
    const print = catalogue?.prints.find(item => item.sku === sku);
    const variant = print?.sizes.find(item => item.size === size);
    if (qty > 0 && (!variant || qty > variant.in_stock)) { setNotice(variant ? `Only ${variant.in_stock} of ${print.title} (${size}) available. Your basket has not changed.` : 'That print is no longer available.'); return false; }
    setNotice('');
    setCart(current => { const other = current.filter(line => line.sku !== sku || line.size !== size); return qty ? [...other, { sku, size, qty }] : other; });
    return true;
  }
  function placed(order) {
    setCart([]); store.write(cartKey, []); store.write('ridgeline_last_order_v2', order.reference); refreshCatalogue(); navigate(`/order/${encodeURIComponent(order.reference)}`);
  }
  function pendingChanged(intent) {
    if (intent) store.write(intentKey, intent);
    else store.remove(intentKey);
    setPendingCheckout(intent);
  }
  let content;
  if (route.startsWith('/order/')) content = h(Order, { key: route, reference: decodeURIComponent(route.slice(7)), navigate, refreshCatalogue });
  else if (route === '/track') content = h(Track, { navigate });
  else if (!catalogue) content = h('div', { className: 'empty-state', role: 'status' }, catalogueError || 'Opening the studio collection…', catalogueError && h(Action, { onClick: refreshCatalogue }, 'Try again'));
  else if (route.startsWith('/print/')) content = h(Product, { key: route, sku: decodeURIComponent(route.slice(7)), catalogue, cart, updateLine, navigate });
  else if (route === '/basket') content = h(Basket, { cart, pricing, pricingError, catalogue, updateLine, navigate, busy: pricingBusy });
  else if (route === '/checkout') content = h(Checkout, { cart, pricing: pricingBusy ? null : pricing, pricingError, navigate, onPlaced: placed, pendingCheckout, onPendingChange: pendingChanged });
  else content = h(Catalogue, { catalogue, navigate });
  const count = cart.reduce((total, line) => total + line.qty, 0);
  return h(React.Fragment, null,
    h('a', { className: 'skip-link', href: '#main-content' }, 'Skip to content'),
    h('div', { className: 'announcement' }, 'Small editions. Lasting impressions.', h('span', null, 'Independent risograph studio')),
    h('header', { className: 'site-header' }, h('div', { className: 'header-inner' },
      h('button', { className: 'wordmark', onClick: () => navigate('/'), 'aria-label': 'Ridgeline Press home' }, h('span', { className: 'brand-mark', 'aria-hidden': true }, 'r/p'), h('span', null, 'ridgeline', h('small', null, 'PRESS & PRINT STUDIO'))),
      h('nav', { 'aria-label': 'Main navigation' }, h('button', { className: route === '/' || route.startsWith('/print/') ? 'nav-link active' : 'nav-link', onClick: () => navigate('/') }, 'The prints'), h('button', { className: route === '/track' || route.startsWith('/order/') ? 'nav-link active' : 'nav-link', onClick: () => navigate('/track') }, 'Track an order')),
      h('div', { className: 'header-actions' }, h('button', { className: 'theme-button', onClick: () => setTheme(current => current === 'light' ? 'dark' : 'light'), 'aria-label': `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`, title: `Switch to ${theme === 'light' ? 'dark' : 'light'} theme` }, h(Icon, { name: theme === 'light' ? 'moon' : 'sun' })), h('button', { className: 'basket-button', onClick: () => navigate('/basket'), 'aria-label': `Open basket, ${count} items` }, h(Icon, { name: 'bag' }), h('span', null, 'Basket'), h('span', { className: 'basket-count' }, count)))
    )),
    h('main', { className: 'main-content', id: 'main-content', ref: mainRef, tabIndex: -1 }, pendingCheckout && route !== '/checkout' && h('div', { role: 'status', className: 'success-note pending-banner' }, 'A previous checkout is awaiting confirmation. Your basket is saved until it is resolved.', h('button', { className: 'text-button', onClick: () => navigate('/checkout') }, 'Recover saved order →')), notice && h('div', { role: 'alert', className: 'error-note global-notice' }, notice, h('button', { 'aria-label': 'Dismiss message', className: 'text-button', onClick: () => setNotice('') }, h(Icon, { name: 'close', size: 16 }))), content),
    h('footer', { className: 'site-footer' }, h('div', null, h('strong', null, 'ridgeline press.'), h('p', null, 'Ink on paper. Something to keep.')), h('div', { className: 'footer-links' }, h('button', { onClick: () => navigate('/') }, 'Shop the collection'), h('button', { onClick: () => navigate('/track') }, 'Find an order')), h('p', { className: 'fine-print' }, 'Independent editions · Carefully printed · No account needed'))
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(h(App));
