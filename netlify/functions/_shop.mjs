// Prices live here, on the server: the browser only says what was picked, never what it costs.
const YARN = ["6165", "2197", "4079", "11071", "219", "1450", "6383", "482", "99064", "208", "217"];
export const CATALOG = {
  "cloth": { name: "בד טאפטינג 5×1 מ׳", price: 178.5 },
  "ak1": { name: "אקדח טאפטינג AK-1", price: 700 },
  "ak5": { name: "אקדח טאפטינג AK-5", price: 780 },
  "shaver": { name: "מכונת גילוח", price: 470 },
  "namerug-XS": { name: "שטיח שם XS", price: 170 },
  "namerug-S": { name: "שטיח שם S", price: 250 },
  "namerug-M": { name: "שטיח שם M", price: 330 },
  "namerug-L": { name: "שטיח שם L", price: 390 },
  "namerug-XL": { name: "שטיח שם XL", price: 450 },
  "namerug-XXL": { name: "שטיח שם XXL", price: 520 },
  ...Object.fromEntries(YARN.map(c => [`yarn-${c}`, { name: `צמר אקרילי 100 גרם, צבע ${c}`, price: 14 }]))
};
// price: null = not offered yet (waiting for the studio's shipping price)
export const DELIVERY = {
  pickup: { label: "איסוף עצמי מהסטודיו, לבונטין 3 תל אביב", price: 0 },
  courier: { label: "שליח עד הבית", price: null }
};

export const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
export const growBase = () => process.env.GROW_BASE || (process.env.GROW_ENV === "production" ? "https://secure.meshulam.co.il" : "https://sandbox.meshulam.co.il");
export const siteUrl = () => (process.env.URL || "https://www.carpet-dm.com").replace(/\/$/, "");

// Every order (and every payment) is posted to the Netlify form "orders"; Netlify emails it to the studio.
export async function recordOrder(fields) {
  const body = new URLSearchParams({ "form-name": "orders", ...fields });
  try { await fetch(siteUrl() + "/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body }); }
  catch (e) { console.error("recordOrder failed", e); }
}
