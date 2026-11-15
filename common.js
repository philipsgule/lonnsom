/* Lønnsom – felles for alle sider: topbar, dato-hjelpere og helligdager */
(() => {
  "use strict";

  // ---------- Sidene på nettstedet (legg nye sider til her) ----------
  const PAGES = [
    { href: "index.html", title: "Sykepenger", desc: "Arbeidsgiverperiode, NAV og maksdato" },
    { href: "ferie.html", title: "Ferie", desc: "Ferie og feriepenger" },
    { href: "pensjon.html", title: "Pensjon", desc: "Folketrygd, tjenestepensjon og AFP" },
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
  const onScroll = () => {
    if (topbar) topbar.classList.toggle("scrolled", window.scrollY > 40);
    if (!navLinks.length) return;
    let currentLink = navLinks[0];
    for (const a of navLinks) {
      const sec = document.querySelector(a.getAttribute("href"));
      if (sec && sec.getBoundingClientRect().top < window.innerHeight * 0.4) currentLink = a;
    }
    navLinks.forEach((a) => a.classList.toggle("on", a === currentLink));
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

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
