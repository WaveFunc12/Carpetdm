// Grow calls this after a payment. We confirm it back to Grow (approveTransaction) and only then
// tell the studio "paid", so a fake call to this address can never produce a "paid" email.
import { json, growBase, recordOrder } from "./_shop.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const raw = await req.text();
  let p = {};
  try { p = (req.headers.get("content-type") || "").includes("json") ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw)); } catch { }
  // fields can arrive flat or as data[...]
  const d = {};
  for (const [k, v] of Object.entries(p.data && typeof p.data === "object" ? p.data : p)) d[k.replace(/^data\[(.+)\]$/, "$1")] = v;
  // our order number travels as cField1; Grow may send it flat or nested, so look for it by name
  const cf = Object.entries(d).find(([k]) => /cField1\]?$/.test(k));
  const orderId = String((cf && cf[1]) || (d.customFields && d.customFields.cField1) || "").slice(0, 40);

  let approved = false;
  if (process.env.GROW_PAGE_CODE && d.transactionId) {
    const f = new FormData();
    f.set("pageCode", process.env.GROW_PAGE_CODE);
    for (const [k, v] of Object.entries(d)) if (typeof v === "string") f.set(k, v);
    try { const r = await fetch(`${growBase()}/api/light/server/1.0/approveTransaction`, { method: "POST", body: f }); const j = await r.json(); approved = j && j.status === 1; if (!approved) console.error("approve refused", JSON.stringify(j)); }
    catch (e) { console.error("approve failed", e); }
  }
  await recordOrder({
    order_id: orderId, status: approved ? "שולם ✓" : "התקבלה הודעת תשלום שלא אומתה, לבדוק ב-Grow",
    total: d.sum ? d.sum + " ₪" : "", full_name: d.fullName || "", phone: d.payerPhone || "", email: d.payerEmail || "",
    transaction: [d.transactionId && `עסקה ${d.transactionId}`, d.asmachta && `אסמכתא ${d.asmachta}`, d.paymentsNum && `${d.paymentsNum} תשלומים`].filter(Boolean).join(" · ")
  });
  return json({ ok: true });
};

export const config = { path: "/api/grow-notify" };
