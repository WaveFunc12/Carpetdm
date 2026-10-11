// Grow's account-wide webhook: one call per payment, from any source (our shop, Monkeybook, payment links).
// We keep each one in the "payments" form so the studio dashboard can count orders and income.
// Grow sends a webhookKey with every call; it must match GROW_WEBHOOK_KEY in Netlify.
import { json, recordForm } from "./_shop.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const raw = await req.text();
  let p = {};
  try { p = (req.headers.get("content-type") || "").includes("json") ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw)); } catch { }
  const d = {};
  for (const [k, v] of Object.entries(p.data && typeof p.data === "object" ? p.data : p)) d[k.replace(/^data\[(.+)\]$/, "$1")] = v;
  const key = process.env.GROW_WEBHOOK_KEY;
  // Without the key anyone could add fake income, so nothing is kept until GROW_WEBHOOK_KEY is set.
  if (!key || String(d.webhookKey || p.webhookKey || "") !== key) { console.error("grow-webhook refused: key", key ? "mismatch" : "not set", JSON.stringify(d).slice(0, 300)); return json({ error: "key" }, 403); }
  const s = (v) => (v == null ? "" : String(v)).slice(0, 300);
  await recordForm("payments", {
    tx: s(d.transactionCode || d.transactionId || d.asmachta), sum: s(d.paymentSum || d.sum), date: s(d.paymentDate),
    desc: s(d.paymentDesc || d.description), source: s(d.paymentSource), page: s(d.purchasePageTitle || d.pageTitle),
    name: s(d.fullName), phone: s(d.payerPhone), email: s(d.payerEmail), payments_num: s(d.paymentsNum || d.paymentsCount),
    type: s(d.transactionType || d.paymentType), received: new Date().toISOString()
  });
  return json({ ok: true });
};

export const config = { path: "/api/grow-webhook" };
