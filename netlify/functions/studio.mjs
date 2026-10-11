// The studio dashboard's data. Reads the site's own forms (orders, payments, declarations, cancellations,
// newsletter) through the Netlify API and hands the page one tidy bundle. Nothing here is public:
// a password (STUDIO_PASSWORD) gets a signed token, and only the token opens the data.
// Needs two settings in Netlify: STUDIO_PASSWORD and NETLIFY_TOKEN (a personal access token).
import { createHmac, timingSafeEqual } from "node:crypto";
import { json } from "./_shop.mjs";

const API = "https://api.netlify.com/api/v1";
const DAYS = 30;
const secret = () => `${process.env.STUDIO_PASSWORD}|${process.env.NETLIFY_TOKEN}`;
const sign = (s) => createHmac("sha256", secret()).update(s).digest("base64url");
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const makeToken = () => { const exp = String(Date.now() + DAYS * 864e5); return `${exp}.${sign(exp)}`; };
const goodToken = (t) => { const [exp, sig] = String(t || "").split("."); return exp && sig && Number(exp) > Date.now() && same(sig, sign(exp)); };

async function api(path) {
  const r = await fetch(API + path, { headers: { authorization: `Bearer ${process.env.NETLIFY_TOKEN}` } });
  if (!r.ok) throw new Error(`netlify ${path} ${r.status}`);
  return r.json();
}
async function submissions(formId) {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await api(`/forms/${formId}/submissions?per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

const num = (s) => { const n = parseFloat(String(s || "").replace(/[^\d.]/g, "")); return isFinite(n) ? n : 0; };
// Grow writes dates as 11/10/2026 15:03 (Israel time); anything unreadable falls back to when we got it.
const toIso = (s, fallback) => { const m = String(s || "").match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})(?:\D+(\d{1,2}):(\d{2}))?/);
  if (!m) return fallback; const d = new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T${(m[4] || "12").padStart(2, "0")}:${m[5] || "00"}:00+03:00`); return isNaN(d) ? fallback : d.toISOString(); };
const isTest = (d) => /בדיקה מערכת/.test(`${d.full_name || ""} ${d.fullName || ""}`);
// What a payment was for, from its description. Shir can see the raw text next to it.
export function kindOf(desc) {
  const t = String(desc || "");
  if (/גיפט|gift|שובר|מתנה|voucher/i.test(t)) return "gift";
  if (/CDM-|חנות|אקדח|צמר|בד טאפטינג|שטיח שם|מכונת גילוח|shop/i.test(t)) return "shop";
  if (/סדנ|workshop|monkey|מאנקי|זוג|הורה|ילד|פרטית/i.test(t)) return "workshop";
  return "other";
}

async function bundle(siteId) {
  const forms = await api(`/sites/${siteId}/forms`);
  const byName = {};
  await Promise.all(forms.map(async (f) => { byName[f.name] = (await submissions(f.id)).filter((s) => !isTest(s.data || {})); }));
  const rows = (n) => byName[n] || [];

  const log = rows("studio-log").map((s) => s.data);
  const done = (type, ref) => log.some((l) => l.type === type && l.ref === ref);

  // Orders: one row per status message; keep the newest status for each order number.
  const orders = {};
  for (const s of rows("orders").sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const d = s.data, id = d.order_id || `#${s.number}`;
    const o = orders[id] || (orders[id] = { id, at: s.created_at, items: "", total: 0, name: "", phone: "", status: "wait" });
    if (d.items) o.items = d.items;
    if (d.total) o.total = num(d.total);
    if (d.full_name) o.name = d.full_name;
    if (d.phone) o.phone = d.phone;
    if (/שולם/.test(d.status || "")) { o.status = "paid"; o.paidAt = s.created_at; o.tx = d.transaction || ""; }
  }
  for (const o of Object.values(orders)) if (o.status === "paid" && done("picked", o.id)) o.status = "picked";

  // Payments: every charge Grow tells us about (needs Grow's webhook switched on). Until then, the paid shop orders.
  const seen = new Set();
  let payments = rows("payments").map((s) => s.data).filter((d) => { const k = d.tx || d.ref; if (!k || seen.has(k)) return false; seen.add(k); return true; })
    .map((d) => ({ id: d.tx, at: toIso(d.date, d.received), sum: num(d.sum), desc: d.desc || "", kind: kindOf(`${d.desc} ${d.page} ${d.source}`), name: d.name || "", phone: d.phone || "", email: d.email || "", count: num(d.payments_num) || 1 }));
  const fromWebhook = payments.length > 0;
  if (!fromWebhook) payments = Object.values(orders).filter((o) => o.status !== "wait").map((o) => ({ id: o.id, at: o.paidAt || o.at, sum: o.total, desc: o.items, kind: "shop", name: o.name, phone: o.phone, email: "" }));

  const decls = [...rows("declaration-60").map((s) => [s, 60]), ...rows("declaration-40").map((s) => [s, 40])].map(([s, size]) => {
    const d = s.data;
    return { at: s.created_at, date: d.workshop_date || d.date_from_link || "", name: d.full_name || "", phone: d.phone || "", age: num(d.age), size,
      source: d.rug_source || "", sketch: d.sketch && d.sketch.url ? d.sketch.url : "", sketchNo: [d.sketch_category, d.sketch_number].filter(Boolean).join(" "),
      shape: d.rug_shape || "", parent: d.parent_name ? `${d.parent_name} ${d.parent_phone || ""}`.trim() : "", gift: d.gift_code || "" };
  });
  const cancels = rows("cancellation").map((s) => ({ id: String(s.number), at: s.created_at, what: s.data.what || "", order: s.data.order_number || "", orderDate: s.data.order_date || "",
    name: s.data.full_name || "", phone: s.data.phone || "", reason: s.data.reason || "", done: done("handled", String(s.number)) }));
  const news = rows("newsletter").map((s) => ({ at: s.created_at, email: s.data.email || "" })).filter((n) => n.email);
  return { demo: false, fromWebhook, payments, orders: Object.values(orders), decls, cancels, news, updated: new Date().toISOString() };
}

export default async (req, context) => {
  const ready = !!(process.env.STUDIO_PASSWORD && process.env.NETLIFY_TOKEN);
  if (req.method === "POST") {
    if (!ready) return json({ error: "not_configured" }, 503);
    let body = {}; try { body = await req.json(); } catch { }
    if (!same(body.password || "", process.env.STUDIO_PASSWORD)) { await new Promise((r) => setTimeout(r, 900)); return json({ error: "wrong_password" }, 401); }
    return json({ token: makeToken() });
  }
  const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!token) return json({ configured: ready });
  if (!ready || !goodToken(token)) return json({ error: "login" }, 401);
  try { return json(await bundle(context.site?.id || process.env.SITE_ID)); }
  catch (e) { console.error("studio", e); return json({ error: "netlify_api" }, 502); }
};

export const config = { path: "/api/studio" };
