// POST /api/checkout  {items:[{sku,qty,meta}], customer:{name,phone,email}, delivery:{method,address,city}, notes}
// -> records the order, opens a Grow payment page for the exact sum, returns {url}.
import { CATALOG, DELIVERY, json, growBase, siteUrl, recordOrder } from "./_shop.mjs";

const clean = (v, n = 120) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n);

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  const lines = []; let sum = 0;
  for (const it of (Array.isArray(b.items) ? b.items : []).slice(0, 60)) {
    const p = CATALOG[it?.sku]; if (!p) return json({ error: "unknown_item", sku: clean(it?.sku, 40) }, 400);
    const qty = Math.max(1, Math.min(50, parseInt(it.qty, 10) || 1));
    const extra = [it.meta?.text && `״${clean(it.meta.text, 20)}״`, it.meta?.color && clean(it.meta.color, 20)].filter(Boolean).join(", ");
    lines.push({ sku: it.sku, name: extra ? `${p.name}, ${extra}` : p.name, qty, price: p.price });
    sum += p.price * qty;
  }
  if (!lines.length) return json({ error: "empty" }, 400);

  const d = DELIVERY[b.delivery?.method];
  if (!d || d.price == null) return json({ error: "delivery" }, 400);
  if (d.price) { lines.push({ sku: "delivery", name: d.label, qty: 1, price: d.price }); sum += d.price; }
  sum = Math.round(sum * 100) / 100;

  const c = b.customer || {};
  const name = clean(c.name, 60), phone = clean(c.phone, 20).replace(/[^\d]/g, ""), email = clean(c.email, 80);
  if (name.split(/\s+/).length < 2) return json({ error: "name" }, 400);
  if (!/^05\d{8}$/.test(phone)) return json({ error: "phone" }, 400);
  if (b.delivery.method === "courier" && !clean(b.delivery.address)) return json({ error: "address" }, 400);

  const orderId = "CDM-" + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2, 5).toUpperCase();
  const itemsText = lines.map(l => `${l.name} × ${l.qty} = ${(l.price * l.qty).toFixed(2)} ₪`).join("\n");
  await recordOrder({
    order_id: orderId, status: "ממתין לתשלום", items: itemsText, total: sum.toFixed(2) + " ₪",
    full_name: name, phone, email, delivery: d.label,
    address: [clean(b.delivery.address), clean(b.delivery.city, 40)].filter(Boolean).join(", "), notes: clean(b.notes, 400)
  });

  const { GROW_USER_ID, GROW_PAGE_CODE } = process.env;
  if (!GROW_USER_ID || !GROW_PAGE_CODE) return json({ error: "not_configured", orderId }, 503);

  const site = siteUrl();
  const f = new FormData();
  f.set("pageCode", GROW_PAGE_CODE); f.set("userId", GROW_USER_ID);
  f.set("sum", sum.toFixed(2)); f.set("chargeType", "1");
  f.set("description", `הזמנה מהחנות ${orderId}`);
  f.set("successUrl", `${site}/shop/thanks/?order=${orderId}`);
  f.set("cancelUrl", `${site}/shop/cancel/`);
  f.set("notifyUrl", `${site}/api/grow-notify`);
  f.set("pageField[fullName]", name); f.set("pageField[phone]", phone);
  if (email) f.set("pageField[email]", email);
  f.set("cField1", orderId);
  if (sum >= 1000) f.set("maxPaymentNum", "3");
  lines.forEach((l, i) => {
    f.set(`productData[${i}][catalogNumber]`, l.sku); f.set(`productData[${i}][quantity]`, String(l.qty));
    f.set(`productData[${i}][price]`, l.price.toFixed(2)); f.set(`productData[${i}][itemDescription]`, l.name);
  });
  let j = null, status = 0;
  try { const r = await fetch(`${growBase()}/api/light/server/1.0/createPaymentProcess`, { method: "POST", body: f }); status = r.status; j = await r.json(); }
  catch (e) { console.error("grow", e); }
  if (!j || j.status !== 1 || !j.data?.url) { console.error("grow refused", status, JSON.stringify(j)); return json({ error: "payment_provider", orderId }, 502); }
  return json({ url: j.data.url, orderId });
};

export const config = { path: "/api/checkout" };
