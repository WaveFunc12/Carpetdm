/* Shop checkout on the home page: the cart from the shop section -> details -> Grow payment page.
   Prices are re-checked on the server (/api/checkout); this file only shows them. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  // keep in sync with netlify/functions/_shop.mjs (price null = not offered yet)
  const DELIVERY = { pickup: { label: "איסוף עצמי מהסטודיו, לבונטין 3 תל אביב", price: 0 }, courier: { label: "שליח עד הבית", price: null } };
  const dlg = $("#shopCo"); if (!dlg) return;
  const nis = (n) => { const c = Math.round(n * 100) / 100; return `${Number.isInteger(c) ? c : c.toFixed(2)} ₪`; };
  const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const cart = () => (window.CDM_CART && window.CDM_CART.items) || [];
  let method = "pickup";

  $("#shipOpts").innerHTML = Object.entries(DELIVERY).filter(([, d]) => d.price != null).map(([k, d]) => `<label class="${d.price == null ? "off" : ""}"><input type="radio" name="ship" value="${k}"${k === method ? " checked" : ""}${d.price == null ? " disabled" : ""}><span>${esc(d.label)}</span><b>${d.price == null ? "בקרוב" : d.price ? nis(d.price) : "חינם"}</b></label>`).join("");
  $("#shipOpts").addEventListener("change", (e) => { method = e.target.value; $("#addrBox").hidden = method !== "courier"; ["#sAddr", "#sCity"].forEach(s => $(s).required = method === "courier"); render(); });

  function total() { return cart().reduce((a, c) => a + c.price * c.qty, 0) + (DELIVERY[method].price || 0); }
  function render() {
    const items = cart();
    $("#shopLines").innerHTML = items.length ? items.map((c, i) => `<li><span class="nm">${esc(c.name)}</span><span class="qty"><button type="button" data-q="${i}" data-d="-1" aria-label="פחות ${esc(c.name)}">−</button><span aria-live="polite">${c.qty}</span><button type="button" data-q="${i}" data-d="1" aria-label="עוד ${esc(c.name)}">+</button></span><span class="pr">${nis(c.price * c.qty)}</span></li>`).join("")
      : `<li class="shop-empty">הסל ריק</li>`;
    const d = DELIVERY[method];
    $("#shopSum").innerHTML = `<div><span>מוצרים</span><span>${nis(total() - (d.price || 0))}</span></div><div><span>${esc(d.label)}</span><span>${d.price ? nis(d.price) : "חינם"}</span></div><div class="total"><span>סה״כ לתשלום</span><span>${nis(total())}</span></div>`;
    $("#shopGo").textContent = `לתשלום מאובטח · ${nis(total())}`;
    $("#shopGo").disabled = !items.length;
    window.CDM_CART && window.CDM_CART.render();
  }
  $("#shopLines").addEventListener("click", (e) => {
    const b = e.target.closest("[data-q]"); if (!b) return;
    const items = cart(), i = +b.dataset.q; items[i].qty += +b.dataset.d;
    if (items[i].qty < 1) items.splice(i, 1);
    render();
  });

  function open() {
    if (!cart().length) return;
    $("#shopCart").hidden = false; $("#shopPay").hidden = true; $("#growFrame").innerHTML = "";
    $("#shopErr").classList.remove("show");
    render(); dlg.showModal();
    try { window.fbq && fbq("track", "InitiateCheckout", { value: total(), currency: "ILS" }); window.gtag && gtag("event", "begin_checkout", { value: total(), currency: "ILS" }); } catch { }
  }
  $("#shopClose").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  // clear a field's error mark (and the message) as soon as it is being fixed
  $("#shopForm").addEventListener("input", (e) => { const f = e.target.closest(".field"); if (f) f.classList.remove("invalid"); $("#shopErr").classList.remove("show"); });
  const err = (html) => { const e = $("#shopErr"); e.innerHTML = html; e.classList.add("show"); e.scrollIntoView({ block: "nearest" }); };
  $("#shopForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, phone = $("#sPhone").value.replace(/[^\d]/g, "").replace(/^972/, "0");
    $("#shopErr").classList.remove("show");
    const fields = { sPhone: /^05\d{8}$/.test(phone), sEmail: /\S+@\S+\.\S+/.test($("#sEmail").value) };
    Object.entries(fields).forEach(([id, ok]) => $("#" + id).closest(".field").classList.toggle("invalid", !ok));
    if ($("#sName").value.trim().split(/\s+/).length < 2) return err("נא למלא שם פרטי ושם משפחה."), $("#sName").focus();
    if (!fields.sPhone) return $("#sPhone").focus();
    if (!fields.sEmail) return $("#sEmail").focus();
    if (method === "courier" && (!$("#sAddr").value.trim() || !$("#sCity").value.trim())) return err("נא למלא כתובת למשלוח."), $("#sAddr").focus();
    if (!$("#sTerms").checked) return err("כדי להמשיך צריך לאשר את תנאי השימוש והרכישה."), $("#sTerms").focus();
    const go = $("#shopGo"); go.disabled = true; go.textContent = "פותח את דף התשלום…";
    const payload = {
      items: cart().map(c => ({ sku: c.sku, qty: c.qty, meta: c.meta })),
      customer: { name: $("#sName").value.trim(), phone, email: $("#sEmail").value.trim() },
      delivery: { method, address: $("#sAddr").value.trim(), city: $("#sCity").value.trim() }, notes: $("#sNotes").value.trim()
    };
    let res = null, data = {};
    try { res = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); data = await res.json(); } catch { }
    go.disabled = false; render();
    if (res && res.ok && data.url) {
      try { sessionStorage.setItem("cdm_order", JSON.stringify({ id: data.orderId, value: total() })); } catch { }
      $("#shopCart").hidden = true; $("#shopPay").hidden = false;
      $("#growOpen").href = data.url;
      const fr = document.createElement("iframe"); fr.title = "תשלום מאובטח ב-Grow"; fr.allow = "payment"; fr.src = data.url;
      $("#growFrame").appendChild(fr); $("#shopSheet").scrollTo({ top: 0 });
      return;
    }
    if (data.error === "not_configured") return err(`התשלום באתר עוד לא מחובר. ההזמנה נשמרה אצלנו (מס׳ ${esc(data.orderId)}) ונחזור אליכם להשלמת התשלום.`);
    err(`לא הצלחנו לפתוח את דף התשלום. נסו שוב, או השלימו את ההזמנה <a class="link" href="https://wa.me/972542068815">בוואטסאפ</a>.`);
  });

  window.CDMShop = { open };
})();
