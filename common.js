/* Lønnsom – felles for alle sider: topbar, dato-hjelpere og helligdager */
(() => {
  "use strict";

  // ---------- Sidene på nettstedet (legg nye sider til her) ----------
  const PAGES = [
    { href: "index.html", title: "Sykepenger", desc: "Arbeidsgiverperiode, NAV og maksdato" },
    { href: "ferie.html", title: "Ferie", desc: "Ferie og feriepenger" },
    { href: "pensjon.html", title: "Pensjon", desc: "Folketrygd, tjenestepensjon og AFP" },
    { href: "permisjon.html", title: "Permisjoner", desc: "Foreldrepermisjon, sykt barn og mer" },
    { href: "overtid.html", title: "Overtid", desc: "Satser, utbetaling og grenser" },
  ];

  // ---------- Sidemeny oppe til høyre ----------
  const menu = document.querySelector(".page-menu");
  if (menu) {
    const current = PAGES.find((p) => p.href === menu.dataset.current) || PAGES[0];
    menu.innerHTML = `
      <button type="button" class="menu-btn" aria-expanded="false" aria-controls="pageMenuPanel" aria-haspopup="true">
        <span class="menu-label">Side</span>${current.title}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="menu-panel" id="pageMenuPanel" hidden>
        <p class="menu-head">Velg side</p>
        ${PAGES.map((p, i) => `
          <a href="${p.href}"${p === current ? ' aria-current="page"' : ""}>
            <span class="menu-n">0${i + 1}</span>
            <span class="menu-text"><b>${p.title}</b><small>${p.desc}</small></span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </a>`).join("")}
      </div>`;
    const btn = menu.querySelector(".menu-btn");
    const panel = menu.querySelector(".menu-panel");
    const setOpen = (open) => {
      btn.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
      menu.classList.toggle("open", open);
    };
    btn.addEventListener("click", (e) => { e.stopPropagation(); setOpen(panel.hidden); });
    document.addEventListener("click", (e) => { if (!menu.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { setOpen(false); btn.focus(); } });
  }

  // ---------- Topbar: frostet bakgrunn + aktiv seksjon i nav-pillen ----------
  const topbar = document.querySelector(".topbar");
  const navLinks = [...document.querySelectorAll('.nav-pill a[href^="#"]')];
  const setActive = (link) => navLinks.forEach((a) => a.classList.toggle("on", a === link));

  // Mens siden scroller etter et klikk i menyen, holdes markeringen fast på lenken
  // man klikket, så den ikke «går gjennom» alle seksjonene på veien.
  let locked = false, unlockTimer = null;
  const scheduleUnlock = () => {
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => { locked = false; }, 160);
  };
  function lockNavTo(hash) {
    const link = navLinks.find((a) => a.getAttribute("href") === hash);
    if (!link) return;
    setActive(link);
    locked = true;
    scheduleUnlock(); // frigjøres også hvis siden ikke trenger å scrolle
  }
  navLinks.forEach((a) => a.addEventListener("click", () => lockNavTo(a.getAttribute("href"))));

  const onScroll = () => {
    if (topbar) topbar.classList.toggle("scrolled", window.scrollY > 40);
    if (!navLinks.length) return;
    if (locked) { scheduleUnlock(); return; }
    let currentLink = navLinks[0];
    for (const a of navLinks) {
      const sec = document.querySelector(a.getAttribute("href"));
      if (sec && sec.getBoundingClientRect().top < window.innerHeight * 0.4) currentLink = a;
    }
    // Helt nederst på siden: marker siste seksjon, selv om den er for kort til å nå terskelen
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (atBottom) currentLink = navLinks[navLinks.length - 1];
    setActive(currentLink);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---------- Rene adresser ----------
  // På nettet (GitHub Pages) vises /lonnsom/ferie i stedet for /lonnsom/ferie.html,
  // og /lonnsom/ i stedet for /lonnsom/index.html. Lokalt (file://) beholdes .html,
  // fordi lenker uten filendelse ikke virker direkte fra disk.
  const onWeb = location.protocol === "http:" || location.protocol === "https:";
  const cleanHref = (href) => (href === "index.html" ? "./" : href.replace(/\.html$/, ""));
  function cleanLinks(root = document) {
    if (!onWeb) return;
    root.querySelectorAll('a[href$=".html"]').forEach((a) => {
      const href = a.getAttribute("href");
      if (!/^[a-z0-9-]+\.html$/i.test(href)) return; // bare interne sider
      a.setAttribute("href", cleanHref(href));
    });
  }

  // Lenker innad på siden (#kalender osv.) scroller uten å legge #… i adressen
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const hash = a.getAttribute("href");
    const target = hash === "#top" || hash === "#" ? document.body : document.querySelector(hash);
    if (!target) return;
    e.preventDefault();
    if (target === document.body) window.scrollTo({ top: 0, behavior: "smooth" });
    else target.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Rydd adressen ved innlasting: fjern index.html, .html og #…
  {
    let path = location.pathname;
    if (onWeb) path = path.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
    if (path !== location.pathname || location.hash) {
      history.replaceState(null, "", path + location.search);
    }
  }

  // Rene lenker til sidene (brand-lenken og sidemenyen, som er tegnet over)
  cleanLinks();

  // ---------- «Prøv i kalkulatoren» i eksemplene ----------
  // Knappen har data-fill (felt-id → verdi), data-form (skjemaet) og data-scroll (hvor man skal).
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fill]");
    if (!b) return;
    let data;
    try { data = JSON.parse(b.dataset.fill); } catch { return; }
    for (const [id, v] of Object.entries(data)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.value = v;
      const det = el.closest("details");
      if (det && v !== "" && v !== "0") det.open = true;
    }
    if (b.dataset.click) document.querySelector(b.dataset.click)?.click();
    const form = document.getElementById(b.dataset.form);
    if (form) {
      form.dispatchEvent(new Event("input", { bubbles: true }));
      form.dispatchEvent(new Event("change", { bubbles: true }));
      form.classList.remove("flash");
      void form.offsetWidth; // start animasjonen på nytt
      form.classList.add("flash");
    }
    const target = document.querySelector(b.dataset.scroll);
    if (target) {
      lockNavTo(b.dataset.scroll);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  // ---------- Dato-hjelpere (UTC-midnatt i ms) ----------
  const DAY = 86400000;
  const parseDate = (v) => {
    if (!v) return null;
    const [y, m, d] = v.split("-").map(Number);
    return y && m && d ? Date.UTC(y, m - 1, d) : null;
  };
  const toIso = (t) => new Date(t).toISOString().slice(0, 10);
  const addDays = (t, n) => t + n * DAY;
  const dow = (t) => new Date(t).getUTCDay();
  const todayUtc = () => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); };

  // ---------- Norske helligdager ----------
  const cache = new Map();
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(y, month - 1, day);
  }
  function holidays(y) {
    if (cache.has(y)) return cache.get(y);
    const e = easter(y);
    const map = new Map([
      [Date.UTC(y, 0, 1), "Første nyttårsdag"],
      [addDays(e, -3), "Skjærtorsdag"],
      [addDays(e, -2), "Langfredag"],
      [e, "Første påskedag"],
      [addDays(e, 1), "Andre påskedag"],
      [Date.UTC(y, 4, 1), "Arbeidernes dag"],
      [Date.UTC(y, 4, 17), "Grunnlovsdag"],
      [addDays(e, 39), "Kristi himmelfartsdag"],
      [addDays(e, 49), "Første pinsedag"],
      [addDays(e, 50), "Andre pinsedag"],
      [Date.UTC(y, 11, 25), "Første juledag"],
      [Date.UTC(y, 11, 26), "Andre juledag"],
    ]);
    cache.set(y, map);
    return map;
  }
  const holidayName = (t) => holidays(new Date(t).getUTCFullYear()).get(t);

  // ---------- Formatering ----------
  const fDate = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const nf = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 1 });

  window.LS = {
    DAY, parseDate, toIso, addDays, dow, todayUtc, holidayName,
    fmt: (t) => (t == null ? "–" : fDate.format(t).replace(/\.$/, "")),
    kr: (n) => nf.format(Math.round(n)) + " kr",
    nf, nf1,
    num: (s) => Number(String(s || "").replace(/[^\d]/g, "")) || 0,
  };
})();
