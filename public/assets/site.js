/* Inner pages: header, phone menu, reveal, contents spy, newsletter, and the health-declaration form. No libraries. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const motion = matchMedia("(prefers-reduced-motion: no-preference)").matches;
  if (motion) document.documentElement.classList.add("motion");

  // ===== Header: tuck away on scroll down (phones) =====
  const head = $("#siteHead");
  let lastY = scrollY;
  addEventListener("scroll", () => { const y = scrollY; if (Math.abs(y - lastY) < 8) return; head.classList.toggle("is-down", y > lastY && y > 240); lastY = y; }, { passive: true });

  // ===== Phone menu =====
  const menuBtn = $("#menuBtn"), menu = $("#siteMenu");
  let open = false;
  const setInert = (on) => [...document.body.children].forEach(el => { if (el !== head && el !== menu && el.tagName !== "SCRIPT") el.inert = on; });
  function openMenu() {
    open = true; menu.hidden = false; head.classList.add("menu-open"); menuBtn.setAttribute("aria-expanded", "true");
    setInert(true); document.documentElement.classList.add("menu-lock");
    if (motion) menu.animate([{ clipPath: "circle(0% at 12% 4%)" }, { clipPath: "circle(150% at 12% 4%)" }], { duration: 600, easing: "cubic-bezier(.65,0,.35,1)" });
    requestAnimationFrame(() => menu.querySelector("a").focus({ preventScroll: true }));
  }
  function closeMenu(focus) {
    if (!open) return; open = false; head.classList.remove("menu-open"); menuBtn.setAttribute("aria-expanded", "false");
    setInert(false); document.documentElement.classList.remove("menu-lock");
    const done = () => { menu.hidden = true; };
    if (motion) menu.animate([{ clipPath: "circle(150% at 12% 4%)" }, { clipPath: "circle(0% at 12% 4%)" }], { duration: 380, easing: "ease-in" }).onfinish = done; else done();
    if (focus) menuBtn.focus({ preventScroll: true });
  }
  menuBtn.addEventListener("click", () => open ? closeMenu(true) : openMenu());
  document.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); closeMenu(true); return; }
    if (e.key !== "Tab") return;
    const f = [$(".brand"), menuBtn, ...menu.querySelectorAll("a[href]")], i = f.indexOf(document.activeElement);
    if (i === -1) { e.preventDefault(); f[0].focus(); }
    else if (e.shiftKey && i === 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  });
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) closeMenu(false); });
  matchMedia("(min-width: 1000px)").addEventListener("change", (e) => { if (e.matches) closeMenu(false); });
  const mn = $("#menuNext");
  if (mn) mn.innerHTML = `<p class="mc-k">סדנאות כל יום, גם בסופ״ש</p><p class="mc-d">לבונטין 3, תל אביב</p><a class="btn btn-cta btn-sm" href="/#book">לבחירת תאריך</a>`;
  const hn = $("#headNext"); if (hn) hn.remove();

  // ===== Reveal on scroll =====
  if (motion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    $$(".rv").forEach(el => io.observe(el));
  } else $$(".rv").forEach(el => el.classList.add("in"));

  // ===== Contents list: mark the section being read =====
  const tocLinks = $$(".toc a");
  if (tocLinks.length) {
    const spy = new IntersectionObserver((es) => es.forEach(e => {
      if (!e.isIntersecting) return;
      tocLinks.forEach(a => a.getAttribute("href") === "#" + e.target.id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current"));
    }), { rootMargin: "-30% 0px -60% 0px" });
    tocLinks.forEach(a => { const t = document.getElementById(a.getAttribute("href").slice(1)); if (t) spy.observe(t); });
  }

  // ===== Netlify Forms: send without leaving the page =====
  async function send(form, data) {
    const r = await fetch("/", { method: "POST", body: data || new FormData(form) });
    if (!r.ok) throw new Error("form " + r.status);
  }
  const news = $("#newsForm");
  if (news) news.addEventListener("submit", async (e) => {
    e.preventDefault();
    const i = $("#nEmail");
    if (!/\S+@\S+\.\S+/.test(i.value)) { i.focus(); return; }
    try { await send(news); news.innerHTML = `<p>תודה, נרשמת לניוזלטר!</p>`; }
    catch { news.insertAdjacentHTML("beforeend", `<p style="width:100%;font-size:.88rem">לא הצלחנו לרשום. נסו שוב או כתבו לנו בוואטסאפ.</p>`); }
  });

  // ===== Copy the ChatGPT prompt =====
  $$("[data-copy]").forEach(b => b.addEventListener("click", async () => {
    const t = $(b.dataset.copy).textContent.trim();
    try { await navigator.clipboard.writeText(t); b.textContent = "הועתק ✓"; }
    catch { const r = document.createRange(); r.selectNodeContents($(b.dataset.copy)); getSelection().removeAllRanges(); getSelection().addRange(r); b.textContent = "מסומן, העתיקו"; }
    setTimeout(() => b.textContent = "העתקת הפרומפט", 2200);
  }));

  // ===== Cancel a purchase =====
  const cancel = $("#cancelForm");
  if (cancel) {
    cancel.addEventListener("input", () => $(".form-err", cancel).classList.remove("show"));
    cancel.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $(".form-err", cancel), bad = cancel.querySelector(":invalid");
      if (bad) { err.textContent = "חסר משהו בטופס."; err.classList.add("show"); bad.reportValidity(); return; }
      const btn = $("button[type=submit]", cancel); btn.disabled = true; btn.textContent = "שולח…";
      try {
        await send(cancel);
        $("#cancelStamp").textContent = `נשלח ב-${new Date().toLocaleString("he-IL")} · הזמנה ${cancel.elements.order_number.value}`;
        cancel.hidden = true; $("#cancelSent").hidden = false; $("#cancelSent").focus();
      } catch {
        err.innerHTML = `השליחה לא הצליחה. נסו שוב, או שלחו את הבקשה במייל studio.shaket@gmail.com.`; err.classList.add("show");
        btn.disabled = false; btn.textContent = "שליחת בקשת הביטול";
      }
    });
  }

  // ===== Health declaration + rug choice =====
  const form = $("#declForm");
  if (!form) return;
  const q = new URLSearchParams(location.search);
  // Monkeybook's emails link here with ?ordernumber=…&date=…
  const ord = q.get("ordernumber"), dt = q.get("date");
  if (ord && !/[{}]/.test(ord)) { const f = form.elements.order_number; f.value = ord; f.classList.add("prefilled"); }
  if (dt && !/[{}]/.test(dt)) {
    const m = dt.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/) || dt.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    const iso = !m ? "" : m[1].length === 4 ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const f = form.elements.workshop_date;
    if (iso) { f.value = iso; f.classList.add("prefilled"); }
    form.elements.date_from_link.value = dt;
  }
  const path = location.pathname.match(/^\/router\/([^/?#]+)/);
  if (path) form.elements.order_page.value = decodeURIComponent(path[1]);

  // catalog sketch or your own design
  const modes = $$("input[name=rug_source]", form);
  const showMode = () => {
    const v = (modes.find(m => m.checked) || {}).value;
    $$("[data-mode]", form).forEach(p => {
      const on = p.dataset.mode === v; p.hidden = !on;
      $$("[data-req]", p).forEach(i => i.required = on);
    });
  };
  modes.forEach(m => m.addEventListener("change", showMode)); showMode();

  // under 18: a parent fills in their details and approves
  const age = form.elements.age, parent = $("#parentBox", form);
  const showParent = () => {
    const minor = +age.value > 0 && +age.value < 18;
    parent.hidden = !minor; $$("[data-preq]", parent).forEach(i => i.required = minor);
  };
  age.addEventListener("input", showParent); showParent();

  // declarations: "agree" or "other" with a note
  $$(".decl", form).forEach(d => {
    const other = $(".other-in", d);
    $$("input[type=radio]", d).forEach(r => r.addEventListener("change", () => { d.classList.remove("invalid"); if (other) { other.disabled = r.value !== "אחר"; if (!other.disabled) other.focus(); } }));
  });

  // image upload: preview, and shrink big photos so the whole form stays under Netlify's 8 MB
  const drop = $(".drop", form), file = $("#sketchFile", form);
  let upload = null;
  if (drop) {
    ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => { if (e.dataTransfer.files[0]) take(e.dataTransfer.files[0]); });
    file.addEventListener("change", () => file.files[0] && take(file.files[0]));
  }
  async function take(f) {
    if (!/^image\//.test(f.type)) { $(".drop-msg", drop).textContent = "אפשר להעלות רק קובץ תמונה"; return; }
    upload = f;
    if (f.size > 6.5e6) upload = await shrink(f);
    const url = URL.createObjectURL(upload);
    $(".drop-msg", drop).innerHTML = `<b>${esc(f.name)}</b> · ${(upload.size / 1e6).toFixed(1)}MB · להחלפה לחצו שוב<img src="${url}" alt="הסקיצה שנבחרה">`;
  }
  function shrink(f) {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 2800 / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => res(new File([b], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })), "image/jpeg", .9);
      };
      img.onerror = () => res(f);
      img.src = URL.createObjectURL(f);
    });
  }
  const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  form.addEventListener("input", () => $(".form-err", form).classList.remove("show"));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $(".form-err", form); err.classList.remove("show");
    let bad = null;
    $$(".decl", form).forEach(d => {
      const r = $("input[type=radio]:checked", d), o = $(".other-in", d);
      const ok = r && (r.value !== "אחר" || (o && o.value.trim()));
      d.classList.toggle("invalid", !ok); if (!ok && !bad) bad = d;
    });
    const fin = form.elements.final_declaration;
    if (!bad && !form.checkValidity()) bad = form.querySelector(":invalid");
    if (!bad && fin && !fin.checked) bad = fin;
    const own = (modes.find(m => m.checked) || {}).value === "עיצוב שלי";
    if (!bad && own && !upload) { bad = drop; $(".drop-msg", drop).innerHTML = `<b>צריך לצרף את הסקיצה</b>`; }
    if (bad) {
      err.textContent = "חסר משהו בטופס. סימנו לכם איפה."; err.classList.add("show");
      bad.scrollIntoView({ behavior: motion ? "smooth" : "auto", block: "center" });
      if (bad.reportValidity) setTimeout(() => bad.reportValidity(), 350);
      return;
    }
    const data = new FormData(form);
    data.delete("sketch");
    if (own && upload) data.append("sketch", upload, upload.name);
    const btn = $("button[type=submit]", form); btn.disabled = true; btn.textContent = "שולח…";
    try {
      await send(form, data);
      const box = $("#declSent");
      form.hidden = true; box.hidden = false; box.scrollIntoView({ behavior: motion ? "smooth" : "auto", block: "start" });
    } catch {
      err.innerHTML = `השליחה לא הצליחה. נסו שוב, ואם זה חוזר כתבו לנו <a class="link" href="https://wa.me/972542068815">בוואטסאפ</a>.`; err.classList.add("show");
      btn.disabled = false; btn.textContent = "שליחת הטופס";
    }
  });
})();
