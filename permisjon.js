/* Lønnsom – Permisjoner: foreldrepermisjonsplan og omsorgsdager */
(() => {
  "use strict";
  const { parseDate, toIso, addDays, dow, todayUtc, fmt, kr, nf, num } = window.LS;
  const $ = (s) => document.querySelector(s);

  // Stønadsdager (mandag–fredag) for barn født/adoptert etter 1. juli 2024
  const KVOTER = {
    100: { mor: 75, far: 75, felles: 80, label: "49 uker" },
    80: { mor: 95, far: 95, felles: 101, label: "61 uker og 1 dag" },
  };
  const isWeekday = (t) => { const d = dow(t); return d !== 0 && d !== 6; };
  const nextWeekday = (t) => { let x = t; while (!isWeekday(x)) x = addDays(x, 1); return x; };
  const uker = (d) => { const w = Math.floor(d / 5), r = d % 5; return r ? `${w} uker og ${r} dag${r > 1 ? "er" : ""}` : `${w} uker`; };

  // ---------- Foreldrepermisjon ----------
  function plan(termin, dek, morFellesUker) {
    const q = KVOTER[dek];
    const morFelles = Math.min(q.felles, morFellesUker * 5);
    const segs = [];
    // 3 uker før termin (forbeholdt mor)
    segs.push({ key: "pre", who: "Mor", title: "3 uker før termin", days: 15, start: addDays(termin, -21), end: addDays(termin, -1) });
    let t = nextWeekday(termin);
    const add = (key, who, title, days) => {
      if (days <= 0) return;
      let n = 0, start = t, end = t;
      while (n < days) { if (isWeekday(t)) { n++; end = t; } t = addDays(t, 1); }
      t = nextWeekday(t);
      segs.push({ key, who, title, days, start, end });
    };
    add("mor", "Mor", "Mødrekvote (de første 6 ukene må tas rett etter fødselen)", q.mor);
    add("fmor", "Mor", "Fellesperiode", morFelles);
    add("ffar", "Far/medmor", "Fellesperiode", q.felles - morFelles);
    add("far", "Far/medmor", "Fedrekvote", q.far);
    const totalDays = segs.reduce((s, x) => s + x.days, 0);
    return { segs, totalDays, label: q.label, end: segs[segs.length - 1].end, morFelles, farFelles: q.felles - morFelles };
  }

  let dek = 100;
  function updateFperm() {
    const termin = parseDate($("#fpTermin").value);
    const lonn = num($("#fpLonn").value);
    const G = num($("#fpG").value) || 136549;
    const slider = $("#fpFelles");
    const maxUker = dek === 100 ? 16 : 20;
    slider.max = maxUker;
    if (Number(slider.value) > maxUker) slider.value = maxUker;
    const morUker = Number(slider.value);
    slider.style.setProperty("--p", (morUker / maxUker) * 100 + "%");

    const out = $("#fpermOut");
    if (termin == null) { out.innerHTML = `<p class="out-note">Velg termindato.</p>`; $("#fpFellesOut").textContent = morUker + " uker"; return; }
    const p = plan(termin, dek, morUker);
    $("#fpFellesOut").textContent = `${morUker} av ${maxUker}${dek === 80 ? " uker + 1 dag" : " uker"}`;

    // Penger per måned
    const d = dek / 100;
    const navAar = Math.min(lonn, 6 * G) * d;
    const kommuneAar = lonn * d;
    const topp = kommuneAar - navAar;

    const bar = p.segs.map((s) => `<span class="pl-${s.key}" style="flex:${s.days}" title="${s.who}: ${s.title} · ${fmt(s.start)} – ${fmt(s.end)}"></span>`).join("");
    const rows = p.segs.map((s) => `
      <li class="pl-row">
        <i class="pl-dot pl-${s.key}"></i>
        <span><b>${s.who}</b> · ${s.title}<small>${uker(s.days)}</small></span>
        <em>${fmt(s.start)} – ${fmt(s.end)}</em>
      </li>`).join("");

    out.innerHTML = `
      <div class="out-main">
        <span class="out-label">${p.label} med ${dek} % · termin ${fmt(termin)}</span>
        <b class="out-big">${fmt(p.end)}</b>
        <span class="out-sub">Siste dag med foreldrepenger hvis permisjonen tas samlet</span>
      </div>
      <div class="pl-bar" aria-hidden="true">${bar}</div>
      <ol class="pl-list">${rows}</ol>
      <table class="out-table">
        <tr><td>NAV per måned (opptil 6 G × ${dek} %)</td><td>${kr(navAar / 12)}</td></tr>
        <tr><td>Kommunen betaler ut per måned (${dek} % av lønn)</td><td>${kr(kommuneAar / 12)}</td></tr>
        <tr class="muted"><td>Kommunen dekker selv (lønn over 6 G)</td><td>${kr(topp / 12)} / mnd</td></tr>
      </table>
      ${dek === 80 ? `<p class="out-note">Med 80 % blir utbetalingen per måned lavere, men perioden blir lengre. Samlet utbetaling blir omtrent den samme.</p>` : ""}
    `;
  }

  // ---------- Omsorgsdager ----------
  let alene = false;
  function omsorg(barn, brukt, aleneomsorg) {
    if (barn <= 0) return { rett: 0 };
    let rett = barn >= 3 ? 15 : 10;
    if (aleneomsorg) rett *= 2;
    const innenfor = Math.min(brukt, rett);
    return { rett, egen: Math.min(innenfor, 10), refusjon: Math.max(0, innenfor - 10), igjen: Math.max(0, rett - brukt), over: Math.max(0, brukt - rett) };
  }
  function updateOms() {
    const barn = Math.max(0, Math.floor(Number($("#omsBarn").value) || 0));
    const brukt = Math.max(0, Math.floor(Number($("#omsBrukt").value) || 0));
    const r = omsorg(barn, brukt, alene);
    const out = $("#omsOut");
    if (!r.rett) { out.innerHTML = `<p class="out-note">Ingen omsorgsdager uten barn til og med 12 år, med mindre barnet er kronisk sykt eller har nedsatt funksjonsevne (søkes hos NAV).</p>`; return; }
    const pct = (n) => (n / r.rett) * 100;
    out.innerHTML = `
      <div class="out-main">
        <span class="out-label">${barn} barn · ${alene ? "aleneomsorg" : "delt omsorg"}</span>
        <b class="out-big">${r.igjen} <small>av ${r.rett} dager igjen</small></b>
        <span class="out-sub">${brukt} brukt i år${alene ? " · ekstra dager ved aleneomsorg må søkes hos NAV" : ""}</span>
      </div>
      <div class="oms-bar" aria-hidden="true">
        <span class="oms-egen" style="width:${pct(r.egen)}%"></span>
        <span class="oms-ref" style="width:${pct(r.refusjon)}%"></span>
        <span class="oms-10" style="left:${pct(Math.min(10, r.rett))}%"><em>10</em></span>
      </div>
      <table class="out-table">
        <tr><td><span class="pill" style="background:var(--yellow)"></span>Arbeidsgiveren dekker selv (de første 10)</td><td>${r.egen} dager</td></tr>
        <tr><td><span class="pill" style="background:var(--green)"></span>Arbeidsgiveren kan kreve refusjon fra NAV</td><td>${r.refusjon} dager</td></tr>
      </table>
      ${r.over ? `<p class="out-note stop">${r.over} dag${r.over > 1 ? "er" : ""} er over kvoten. Fravær utover omsorgsdagene må dekkes på annen måte, for eksempel med ferie, avspasering eller permisjon uten lønn.</p>` : ""}
    `;
  }

  // ---------- Eksempler (regnes ut med samme funksjoner) ----------
  function renderExamples() {
    const G = 136549;
    const termin = Date.UTC(2027, 4, 14); // fredag 14. mai 2027
    const p = plan(termin, 100, 8);
    const lonn = 900000;
    const nav = Math.min(lonn, 6 * G), topp = (lonn - nav) / 12;
    const seg = (k) => p.segs.find((s) => s.key === k);
    const o = omsorg(3, 12, false);
    const btn = (form, fill, click) => `<button type="button" class="primary ex-btn" data-form="${form}" data-scroll="#verktoy" data-fill='${JSON.stringify(fill)}'${click ? ` data-click='${click}'` : ""}>Prøv i kalkulatoren</button>`;
    const card = (a, name, sub, tag, text, steps, note, button) => `
      <article class="card example">
        <header class="ex-head"><span class="ex-avatar">${a}</span><div><h3>${name}</h3><p>${sub}</p></div><span class="ex-tag">${tag}</span></header>
        <p class="ex-text">${text}</p>
        <ol class="ex-steps">${steps.map(([l, v]) => `<li><span>${l}</span><b>${v}</b></li>`).join("")}</ol>
        <p class="ex-note">${note}</p>
        ${button}
      </article>`;
    $("#permExamples").innerHTML =
      card("S", "Sara og Jonas", "Venter barn i mai 2027", "Foreldrepermisjon",
        `Sara har termin fredag 14. mai 2027 og 900 000 kr i årslønn. De velger 100 % og deler fellesperioden likt, 8 uker hver.`,
        [["Sara: 3 uker før termin", `fra ${fmt(seg("pre").start)}`],
         ["Sara: mødrekvote + 8 uker fellesperiode", `til ${fmt(seg("fmor").end)}`],
         ["Jonas: 8 uker fellesperiode + fedrekvote", `${fmt(seg("ffar").start)} – ${fmt(seg("far").end)}`],
         ["NAV per måned for Sara (6 G)", kr(nav / 12)],
         ["Kommunen dekker over 6 G (HTA)", `${kr(topp)} / mnd`]],
        "Jonas har i tillegg rett til 2 uker med lønn i forbindelse med fødselen. De kan også ta permisjonen mer fleksibelt enn i én samlet periode.",
        btn("fpermForm", { fpTermin: toIso(termin), fpLonn: "900 000", fpFelles: "8", fpG: "136 549" }, '[data-dek="100"]')) +
      card("A", "Ahmed, renholder", "Tre barn under 12 år", "Omsorgsdager",
        `Ahmed har tre barn på 4, 7 og 10 år og deler omsorgen med partneren. I år har han brukt 12 omsorgsdager.`,
        [["Rett med 3 barn eller flere", `${o.rett} dager`],
         ["Arbeidsgiveren dekker selv de første 10", `${o.egen} dager`],
         ["Arbeidsgiveren kan kreve refusjon fra NAV", `${o.refusjon} dager`],
         ["Dager igjen i år", `${o.igjen} dager`]],
        "Partneren har like mange omsorgsdager. Foreldre som bor sammen, kan ikke overføre dager til hverandre.",
        btn("omsForm", { omsBarn: "3", omsBrukt: "12" }, '[data-alene="0"]'));
  }

  // ---------- Filter i oversikten ----------
  document.querySelectorAll("[data-filter]").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("[data-filter]").forEach((x) => x.classList.toggle("on", x === b));
      const f = b.dataset.filter;
      document.querySelectorAll(".leave").forEach((c) => { c.hidden = !(f === "alle" || c.dataset.type === f); });
    })
  );

  // ---------- Input ----------
  function moneyMask(input) {
    input.addEventListener("input", () => {
      const pos = input.value.length - input.selectionStart;
      const n = num(input.value);
      input.value = n ? nf.format(n) : "";
      const q = Math.max(0, input.value.length - pos);
      input.setSelectionRange(q, q);
    });
  }
  moneyMask($("#fpLonn"));
  moneyMask($("#fpG"));
  document.querySelectorAll("[data-dek]").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("[data-dek]").forEach((x) => x.classList.toggle("on", x === b));
      dek = Number(b.dataset.dek);
      updateFperm();
    })
  );
  document.querySelectorAll("[data-alene]").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("[data-alene]").forEach((x) => x.classList.toggle("on", x === b));
      alene = b.dataset.alene === "1";
      updateOms();
    })
  );
  $("#fpermForm").addEventListener("input", updateFperm);
  $("#fpermForm").addEventListener("change", updateFperm);
  $("#omsForm").addEventListener("input", updateOms);

  // Standard: termin om ca. 5 måneder
  $("#fpTermin").value = toIso(addDays(todayUtc(), 150));
  renderExamples();
  updateFperm();
  updateOms();

  window.__perm = { plan, omsorg };
})();
