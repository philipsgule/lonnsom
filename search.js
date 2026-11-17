/* Lønnsom – søk på tvers av sidene, begrepsforklaringer, «til toppen» og «hopp til innhold» */
(() => {
  "use strict";
  const { PAGES, initialHash, onWeb, cleanHref } = window.LS;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const norm = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-̂̄-̉]/g, ""); // behold å (ring), æ, ø
  const slug = (s) => norm(s).replace(/[^a-z0-9æøå]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const currentFile = (() => {
    const cur = $(".page-menu")?.dataset.current;
    return cur || "index.html";
  })();

  // ---------- Begrepsforklaringer ----------
  const ORD = [
    ["AGP – arbeidsgiverperioden", "De første 16 kalenderdagene av et sykefravær, som arbeidsgiveren betaler selv.", "index.html"],
    ["G – grunnbeløpet", "Folketrygdens grunnbeløp, 136 549 kr fra 1. mai 2026. Brukes i mange grenser, som 6G-taket.", "index.html"],
    ["6G-tak", "NAV betaler sykepenger og foreldrepenger av inntekt opptil 6 G (819 294 kr fra 1. mai 2026).", "index.html"],
    ["HTA – Hovedtariffavtalen", "Tariffavtalen mellom KS og arbeidstakerorganisasjonene. Regulerer lønn, sykelønn, overtid og mer i kommunen.", "index.html"],
    ["KS", "Kommunesektorens organisasjon. Arbeidsgiver- og interesseorganisasjon for kommunene.", "index.html"],
    ["ftrl. – folketrygdloven", "Loven om ytelser fra NAV, blant annet sykepenger (kap. 8), omsorgs- og pleiepenger (kap. 9) og foreldrepenger (kap. 14).", "index.html"],
    ["aml. – arbeidsmiljøloven", "Loven om arbeidstid, permisjoner, overtid, hviletid og stillingsvern.", "overtid.html"],
    ["Maksdato", "Siste dag med sykepenger, når 248 sykepengedager er brukt (eller 60 dager etter fylte 67 år).", "index.html"],
    ["Sykepengegrunnlag", "Inntekten sykepengene regnes av: snittet av de tre siste kalendermånedene, omregnet til årsinntekt, høyst 6 G.", "index.html"],
    ["Refusjon", "Når kommunen betaler lønn og får pengene tilbake fra NAV, for eksempel etter arbeidsgiverperioden.", "index.html"],
    ["Inntektsmelding", "Melding fra arbeidsgiveren til NAV med inntekt og eventuelt krav om refusjon, ved sykdom og foreldrepenger.", "index.html"],
    ["Egenmelding", "Den ansatte melder selv fra om sykdom. Etter loven inntil 3 dager, ofte utvidet i kommunen.", "index.html"],
    ["Gradert sykmelding", "Delvis sykmelding, minst 20 %. Den ansatte jobber resten. Hver dag teller som en hel sykepengedag.", "index.html"],
    ["Feriepengegrunnlag", "Lønnen som er utbetalt i opptjeningsåret, og som feriepengene regnes av.", "ferie.html"],
    ["Opptjeningsår og ferieår", "Feriepenger tjenes opp ett år (opptjeningsåret) og utbetales og brukes året etter (ferieåret).", "ferie.html"],
    ["Virkedag", "Alle dager unntatt søndager og helligdager. Lørdag er en virkedag etter ferieloven.", "ferie.html"],
    ["Påslagsmodellen", "Tjenestepensjonen for dem som er født 1963 eller senere: 5,7 % opptil 7,1 G og 18,1 % mellom 7,1 og 12 G.", "pensjon.html"],
    ["Bruttoordning", "Den gamle tjenestepensjonen for dem som er født før 1963: omtrent 66 % av sluttlønn, samordnet med folketrygden.", "pensjon.html"],
    ["AFP – avtalefestet pensjon", "Pensjon i offentlig sektor. Livsvarig tillegg fra 62 år for født 1963 eller senere.", "pensjon.html"],
    ["Særaldersgrense", "Lavere aldersgrense for enkelte stillinger, for eksempel 65 år for sykepleiere og 60 år for brannkonstabler.", "pensjonist.html"],
    ["KLP", "Kommunal Landspensjonskasse. Pensjonsleverandør for de fleste kommuner.", "pensjon.html"],
    ["SPK – Statens pensjonskasse", "Pensjonsleverandør for blant annet lærere i kommunen.", "pensjon.html"],
    ["Merarbeid", "Ekstra timer for deltidsansatte opp til full stilling. Betales med vanlig timelønn, uten overtidstillegg.", "overtid.html"],
    ["Overtid", "Arbeid ut over den alminnelige arbeidstiden. Gir 50 % eller 100 % tillegg i kommunen.", "overtid.html"],
    ["Avspasering", "Overtid tas ut som fri, time for time. Overtidstillegget utbetales likevel.", "overtid.html"],
    ["Ubekvemstillegg", "Tillegg for arbeid på kveld og natt, i helgen og på helligdager. Satsene står i HTA kap. 1 § 5.", "turnus.html"],
    ["Pensjonistlønn", "Fast timesats for pensjonister (269 kr fra 1.1.2026). Gir ikke innmelding i pensjonsordningen.", "pensjonist.html"],
    ["Omsorgsdager", "Fri med lønn når barnet er sykt: 10 dager per forelder i året, 15 ved 3 eller flere barn.", "permisjon.html"],
    ["Pleiepenger", "Ytelse fra NAV ved pleie av alvorlig sykt barn, eller nærstående i livets sluttfase.", "permisjon.html"],
    ["Fellesperiode", "Delen av foreldrepengeperioden som foreldrene kan dele som de vil: 16 uker med 100 %.", "permisjon.html"],
    ["A-meldingen", "Månedlig rapport fra arbeidsgiveren til NAV, SSB og Skatteetaten om lønn, arbeidsforhold og skattetrekk.", "index.html"],
    ["Tilkallingsvikar", "Timelønnet som tar vakter ved behov. Mer enn 14 dager uten arbeid kan avbryte retten til sykepenger.", "index.html"],
  ].map(([title, text, page]) => ({ kind: "Begrep", title, text, page, id: "" }));

  // ---------- Indeks over innholdet ----------
  // Samme regler brukes for å lage id-er på sidene og i indeksen, så søketreff kan hoppe rett til kortet.
  const ITEM_RULES = [
    { sel: ".rule", title: "h3", text: "p", kind: "Regel" },
    { sel: ".example", title: "h3", text: ".ex-head p, .ex-tag, .ex-text", kind: "Eksempel" },
    { sel: ".checklist li", title: "b", text: "span", kind: "Sjekkliste" },
    { sel: ".ot-rate", title: ".rate-label", text: "p", kind: "Sats" },
    { sel: ".cohort", title: "h3", text: "p, .pj-list", kind: "Ordning" },
    { sel: ".layer", title: "h3", text: "p", kind: "Oversikt" },
  ];
  function extract(doc, page) {
    const items = [];
    const pageTitle = (PAGES.find((p) => p.href === page) || {}).title || "";
    doc.querySelectorAll("main section[id]").forEach((sec) => {
      const h2 = sec.querySelector(".section-head h2");
      if (h2) items.push({ kind: "Seksjon", title: h2.textContent.trim(), text: sec.querySelector(".section-head .eyebrow")?.textContent.trim() || "", page, id: sec.id, pageTitle });
    });
    ITEM_RULES.forEach((r) => {
      doc.querySelectorAll(`main ${r.sel}`).forEach((el) => {
        const t = el.querySelector(r.title)?.textContent.trim();
        if (!t) return;
        const text = [...el.querySelectorAll(r.text)].map((x) => x.textContent.trim()).join(" ").replace(/\s+/g, " ");
        items.push({ kind: r.kind, title: t, text, page, id: "s-" + slug(t), pageTitle });
      });
    });
    return items;
  }
  // Gi kortene på denne siden de samme id-ene som indeksen bruker
  function assignIds() {
    ITEM_RULES.forEach((r) => {
      document.querySelectorAll(`main ${r.sel}`).forEach((el) => {
        const t = el.querySelector(r.title)?.textContent.trim();
        if (t && !el.id) el.id = "s-" + slug(t);
      });
    });
  }

  let index = null, indexPromise = null, partial = false;
  function buildIndex() {
    if (indexPromise) return indexPromise;
    indexPromise = (async () => {
      const all = [...extract(document, currentFile)];
      // Eksempelkortene på enkelte sider lages av JavaScript og finnes ikke i HTML-en som hentes.
      // De tas derfor bare med for siden man står på.
      if (onWeb) {
        await Promise.all(PAGES.filter((p) => p.href !== currentFile).map(async (p) => {
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const res = await fetch(p.href, { cache: "no-cache" });
              if (!res.ok) throw new Error(res.status);
              const doc = new DOMParser().parseFromString(await res.text(), "text/html");
              all.push(...extract(doc, p.href));
              return;
            } catch { await new Promise((r) => setTimeout(r, 300 * (attempt + 1))); }
          }
          partial = true;
        }));
      } else {
        partial = true;
      }
      index = [...all, ...ORD.map((o) => ({ ...o, pageTitle: (PAGES.find((p) => p.href === o.page) || {}).title }))];
      return index;
    })();
    return indexPromise;
  }

  function search(q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const scored = [];
    for (const it of index) {
      const t = norm(it.title), x = norm(it.text);
      let score = 0, ok = true;
      for (const w of words) {
        const inT = t.includes(w), inX = x.includes(w);
        if (!inT && !inX) { ok = false; break; }
        score += inT ? (t.startsWith(w) ? 12 : 8) : 2;
      }
      if (!ok) continue;
      if (it.kind === "Begrep") score += 3;
      if (it.page === currentFile) score += 1;
      scored.push({ it, score });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 30).map((s) => s.it);
  }

  function highlight(text, q, max) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    let snippet = text;
    if (max && text.length > max) {
      const n = norm(text);
      const pos = Math.max(0, Math.min(...words.map((w) => { const i = n.indexOf(w); return i < 0 ? Infinity : i; })));
      const start = Number.isFinite(pos) ? Math.max(0, pos - 40) : 0;
      snippet = (start > 0 ? "…" : "") + text.slice(start, start + max) + (start + max < text.length ? "…" : "");
    }
    let html = esc(snippet);
    words.forEach((w) => {
      if (w.length < 2) return;
      const re = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      html = html.replace(re, "<mark>$1</mark>");
    });
    return html;
  }

  // ---------- Søkevindu ----------
  const right = document.createElement("div");
  right.className = "topbar-right";
  const menu = $(".page-menu");
  if (menu) { menu.parentNode.insertBefore(right, menu); right.appendChild(menu); }
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "search-btn";
  btn.setAttribute("aria-label", "Søk på nettsiden");
  btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><span>Søk</span><kbd>${isMac ? "⌘" : "Ctrl"} K</kbd>`;
  right.insertBefore(btn, right.firstChild);

  // ---------- Temabryter (lyst/mørkt) ----------
  const themeBtn = document.createElement("button");
  themeBtn.type = "button";
  themeBtn.className = "theme-btn";
  const SUN = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>`;
  const MOON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>`;
  const isLight = () => document.documentElement.dataset.theme === "light";
  function paintThemeBtn() {
    const light = isLight();
    themeBtn.innerHTML = light ? MOON : SUN;
    themeBtn.setAttribute("aria-label", light ? "Bytt til mørkt tema" : "Bytt til lyst tema");
    themeBtn.title = light ? "Mørkt tema" : "Lyst tema";
  }
  themeBtn.addEventListener("click", () => {
    const next = isLight() ? "dark" : "light";
    document.documentElement.classList.add("theme-switching");
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("lonnsom.tema", next); } catch {}
    paintThemeBtn();
    setTimeout(() => document.documentElement.classList.remove("theme-switching"), 400);
  });
  paintThemeBtn();
  right.insertBefore(themeBtn, btn.nextSibling);

  const dlg = document.createElement("div");
  dlg.className = "search";
  dlg.hidden = true;
  dlg.setAttribute("role", "dialog");
  dlg.setAttribute("aria-modal", "true");
  dlg.setAttribute("aria-label", "Søk");
  dlg.innerHTML = `
    <div class="search-panel">
      <div class="search-field">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
        <input type="search" id="searchInput" placeholder="Søk i regler, eksempler og begreper …" autocomplete="off" spellcheck="false" aria-controls="searchResults" />
        <kbd>Esc</kbd>
      </div>
      <div class="search-results" id="searchResults" role="listbox"></div>
      <div class="search-foot"><span><kbd>↑</kbd><kbd>↓</kbd> velg</span><span><kbd>↵</kbd> åpne</span><span><kbd>Esc</kbd> lukk</span></div>
    </div>`;
  document.body.appendChild(dlg);
  const input = $("#searchInput", dlg), list = $("#searchResults", dlg);
  let results = [], sel = 0;

  const SUGGEST = ["arbeidsgiverperiode", "maksdato", "feriepenger", "overtid", "omsorgsdager", "pensjonistlønn", "timelønnet", "6G"];
  function render() {
    const q = input.value.trim();
    if (!index) { list.innerHTML = `<p class="search-empty">Laster innhold …</p>`; return; }
    if (!q) {
      list.innerHTML = `<p class="search-hint">Prøv for eksempel: ${SUGGEST.map((s) => `<button type="button" class="search-chip" data-q="${s}">${s}</button>`).join("")}</p>` +
        (partial ? `<p class="search-note">Søket dekker bare denne siden og begrepene, fordi de andre sidene ikke kunne hentes${onWeb ? "" : " når nettsiden åpnes fra disk"}.</p>` : "");
      return;
    }
    results = search(q);
    sel = Math.min(sel, Math.max(0, results.length - 1));
    if (!results.length) { list.innerHTML = `<p class="search-empty">Ingen treff på «${esc(q)}».</p>`; return; }
    list.innerHTML = results.map((r, i) => `
      <a class="search-item${i === sel ? " on" : ""}" role="option" aria-selected="${i === sel}" data-i="${i}" href="${hrefFor(r)}">
        <span class="search-kind k-${slug(r.kind)}">${r.kind}</span>
        <span class="search-body">
          <b>${highlight(r.title, q)}</b>
          ${r.text ? `<small>${highlight(r.text, q, 150)}</small>` : ""}
        </span>
        <span class="search-page">${esc(r.pageTitle || "")}</span>
      </a>`).join("");
  }
  function hrefFor(r) {
    const base = onWeb ? cleanHref(r.page) : r.page;
    return r.id ? `${base}#${encodeURIComponent(r.id)}` : base;
  }
  function go(r) {
    if (!r) return;
    if (r.page === currentFile) {
      close();
      if (r.id) jumpTo(r.id);
      else window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      location.href = hrefFor(r);
    }
  }
  function open() {
    if (document.documentElement.classList.contains("locked")) return;
    dlg.hidden = false;
    document.documentElement.classList.add("search-open");
    input.value = ""; sel = 0;
    render();
    buildIndex().then(render);
    setTimeout(() => input.focus(), 20);
  }
  function close() {
    dlg.hidden = true;
    document.documentElement.classList.remove("search-open");
    btn.focus({ preventScroll: true });
  }
  btn.addEventListener("click", open);
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) return close();
    const chip = e.target.closest(".search-chip");
    if (chip) { input.value = chip.dataset.q; sel = 0; render(); input.focus(); return; }
    const a = e.target.closest(".search-item");
    if (a) { e.preventDefault(); go(results[Number(a.dataset.i)]); }
  });
  input.addEventListener("input", () => { sel = 0; render(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, results.length - 1); render(); scrollSel(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); render(); scrollSel(); }
    else if (e.key === "Enter") { e.preventDefault(); go(results[sel]); }
  });
  const scrollSel = () => list.querySelector(".search-item.on")?.scrollIntoView({ block: "nearest" });
  document.addEventListener("keydown", (e) => {
    const typing = /input|textarea|select/i.test(document.activeElement?.tagName || "") || document.activeElement?.isContentEditable;
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); dlg.hidden ? open() : close(); }
    else if (e.key === "/" && !typing && dlg.hidden) { e.preventDefault(); open(); }
    else if (e.key === "Escape" && !dlg.hidden) { e.preventDefault(); e.stopPropagation(); close(); }
  }, true);

  // ---------- Hopp til et kort (fra søk, også fra en annen side) ----------
  function jumpTo(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit");
    clearTimeout(el._hitTimer);
    el._hitTimer = setTimeout(() => el.classList.remove("hit"), 5000);
  }
  // Noen eksempelkort lages av sidens eget skript, som lastes etter denne filen.
  // Vent derfor til alt er lastet før id-ene settes og vi hopper til kortet.
  window.addEventListener("load", () => {
    assignIds();
    if (initialHash) setTimeout(() => jumpTo(initialHash), 250);
  });

  // ---------- Til toppen ----------
  const top = document.createElement("button");
  top.type = "button";
  top.className = "to-top";
  top.setAttribute("aria-label", "Til toppen");
  top.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>`;
  document.body.appendChild(top);
  top.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  const onScroll = () => top.classList.toggle("show", window.scrollY > window.innerHeight * 1.2);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---------- Hopp til innhold ----------
  const main = $("main");
  if (main) {
    main.id = main.id || "innhold";
    main.setAttribute("tabindex", "-1");
    const skip = document.createElement("a");
    skip.className = "skip-link";
    skip.href = "#" + main.id;
    skip.textContent = "Hopp til innhold";
    skip.addEventListener("click", (e) => { e.preventDefault(); main.focus(); main.scrollIntoView({ block: "start" }); });
    document.body.insertBefore(skip, document.body.firstChild);
  }

  window.__search = { buildIndex: () => buildIndex(), search: (q) => search(q), ORD };
})();
