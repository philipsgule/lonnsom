/* Lønnsom – Kalkulatorer: dager mellom datoer, arbeidsdager og prosent */
(() => {
  "use strict";
  const { DAY, parseDate, toIso, addDays, dow, todayUtc, holidayName, fmt } = window.LS;
  const $ = (s, r = document) => r.querySelector(s);
  const DAGER = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];
  const DAGER_LANG = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
  const nf0 = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 });
  const nfFix2 = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Tall med mellomrom og komma: «620 000», «12,5», «-4,5»
  const parseNum = (s) => {
    const t = String(s || "").replace(/[\s  ]/g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  };

  // ---------- Dager mellom to datoer ----------
  function between(fra, til, incl) {
    let a = fra, b = til, swapped = false;
    if (b < a) { [a, b] = [b, a]; swapped = true; }
    const last = incl ? b : addDays(b, -1);
    let kal = 0, arbeid = 0, virke = 0, helg = 0, helligHverdag = 0;
    const hellig = [];
    for (let t = a; t <= last; t += DAY) {
      kal++;
      const d = dow(t), h = holidayName(t);
      const weekend = d === 0 || d === 6;
      if (weekend) helg++;
      if (h) { hellig.push([t, h]); if (!weekend) helligHverdag++; }
      if (!weekend && !h) arbeid++;
      if (d !== 0 && !h) virke++;
    }
    return { a, b, swapped, kal, arbeid, virke, helg, hellig, helligHverdag, uker: Math.floor(kal / 7), rest: kal % 7 };
  }

  let incl = true;
  function updateDager() {
    const fra = parseDate($("#dFra").value), til = parseDate($("#dTil").value);
    const out = $("#dOut");
    if (fra == null || til == null) { out.innerHTML = `<p class="out-note">Velg begge datoene.</p>`; return; }
    if (Math.abs(til - fra) / DAY > 36600) { out.innerHTML = `<p class="out-note stop">Velg en periode på høyst 100 år.</p>`; return; }
    const r = between(fra, til, incl);
    const list = r.hellig.length
      ? `<ul class="hol-list">${r.hellig.slice(0, 40).map(([t, h]) => `<li class="${dow(t) === 0 || dow(t) === 6 ? "we" : ""}"><span>${h}</span><em>${DAGER[dow(t)]} ${fmt(t)}</em></li>`).join("")}</ul>${r.hellig.length > 40 ? `<p class="out-note">… og ${r.hellig.length - 40} til.</p>` : ""}`
      : "";
    out.innerHTML = `
      ${r.swapped ? `<p class="out-note">Datoene var i omvendt rekkefølge og er byttet om.</p>` : ""}
      <div class="dato-main">
        <div class="dm"><b>${nf0.format(r.kal)}</b><span>kalenderdager</span></div>
        <div class="dm hl"><b>${nf0.format(r.arbeid)}</b><span>arbeidsdager<small>uten helger og helligdager</small></span></div>
        <div class="dm"><b>${nf0.format(r.hellig.length)}</b><span>helligdager<small>${r.helligHverdag} på hverdager</small></span></div>
      </div>
      <table class="out-table">
        <tr><td>Periode<small>${fmt(r.a)} – ${fmt(r.b)}, sluttdatoen ${incl ? "telles med" : "telles ikke med"}</small></td><td>${nf0.format(r.uker)} uker og ${r.rest} d</td></tr>
        <tr><td>Helgedager<small>lørdager og søndager</small></td><td>${nf0.format(r.helg)}</td></tr>
        <tr><td>Virkedager etter ferieloven<small>mandag–lørdag uten helligdager</small></td><td>${nf0.format(r.virke)}</td></tr>
      </table>
      ${list}`;
  }

  // ---------- Legg til arbeidsdager ----------
  const isWork = (t) => { const d = dow(t); return d !== 0 && d !== 6 && !holidayName(t); };
  function addWorkdays(start, n) {
    let t = start, left = Math.abs(n);
    const step = n < 0 ? -1 : 1;
    const skipped = [];
    while (left > 0) {
      t = addDays(t, step);
      if (isWork(t)) left--;
      else if (holidayName(t)) skipped.push([t, holidayName(t)]);
    }
    return { t, skipped };
  }
  function updateArbeid() {
    const start = parseDate($("#aStart").value);
    const n = Math.trunc(Number($("#aAntall").value) || 0);
    const out = $("#aOut");
    if (start == null) { out.innerHTML = `<p class="out-note">Velg startdato.</p>`; return; }
    if (Math.abs(n) > 1000) { out.innerHTML = `<p class="out-note stop">Velg høyst 1000 arbeidsdager.</p>`; return; }
    const r = addWorkdays(start, n);
    const kal = Math.round((r.t - start) / DAY);
    out.innerHTML = `
      <div class="out-main">
        <span class="out-label">${fmt(start)} ${n < 0 ? "minus" : "pluss"} ${Math.abs(n)} arbeidsdag${Math.abs(n) === 1 ? "" : "er"}</span>
        <b class="out-big">${fmt(r.t)}</b>
        <span class="out-sub">${DAGER_LANG[dow(r.t)].replace(/^./, (c) => c.toUpperCase())} · ${Math.abs(kal)} kalenderdager ${kal < 0 ? "tilbake" : "frem"}</span>
      </div>
      ${r.skipped.length ? `<p class="out-note">Hoppet over helligdager: ${r.skipped.map(([t, h]) => `<b>${h}</b> (${fmt(t)})`).join(", ")}.</p>` : ""}`;
  }

  // ---------- Prosent ----------
  const CALC = {
    avY: (a, b) => b == null || a == null ? null : [`${nf2.format(a)} % av ${nf2.format(b)} er`, nf2.format((a / 100) * b), ""],
    andel: (a, b) => a == null || !b ? null : [`${nf2.format(a)} av ${nf2.format(b)} er`, `${nf2.format((a / b) * 100)} %`, ""],
    endring: (a, b) => a == null || b == null || a === 0 ? null : (() => {
      const p = ((b - a) / Math.abs(a)) * 100;
      return [p >= 0 ? "Økning på" : "Reduksjon på", `${nf2.format(Math.abs(p))} %`, `Differanse ${b - a >= 0 ? "+" : "−"}${nf2.format(Math.abs(b - a))}`];
    })(),
    pluss: (a, b) => a == null || b == null ? null : [`${nf2.format(b)} ${a >= 0 ? "+" : "−"} ${nf2.format(Math.abs(a))} % blir`, nf2.format(b * (1 + a / 100)), `Endring ${a >= 0 ? "+" : "−"}${nf2.format(Math.abs(b * a / 100))}`],
    stilling: (a, b) => a == null || !b ? null : [`${nf2.format(a)} av ${nf2.format(b)} timer er`, `${nf2.format((a / b) * 100)} %`, `stillingsprosent`],
    lonn: (a, b) => a == null || b == null ? null : [`${nf2.format(a)} % av ${nf2.format(b)} kr er`, `${nf0.format((a / 100) * b)} kr`, `${nf0.format(((a / 100) * b) / 12)} kr per måned`],
  };
  function updatePct(form) {
    const v = {};
    form.querySelectorAll(".pin").forEach((i) => { v[i.dataset.k] = parseNum(i.value); });
    const r = CALC[form.dataset.calc](v.a, v.b);
    form.querySelector(".pct-out").innerHTML = r
      ? `<span class="pct-label">${r[0]}</span><b class="pct-big">${r[1]}</b>${r[2] ? `<span class="pct-sub">${r[2]}</span>` : ""}`
      : `<span class="pct-label">Fyll inn begge tallene</span>`;
  }
  document.querySelectorAll(".pct").forEach((f) => {
    f.addEventListener("input", () => updatePct(f));
    updatePct(f);
  });

  // ---------- Input ----------
  document.querySelectorAll("[data-incl]").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("[data-incl]").forEach((x) => x.classList.toggle("on", x === b));
      incl = b.dataset.incl === "1";
      updateDager();
    })
  );
  $("#dForm").addEventListener("input", updateDager);
  $("#dForm").addEventListener("change", updateDager);
  $("#aForm").addEventListener("input", updateArbeid);
  $("#aForm").addEventListener("change", updateArbeid);

  // Standard: inneværende år og i dag + 10 arbeidsdager
  const t = todayUtc(), y = new Date(t).getUTCFullYear();
  $("#dFra").value = toIso(Date.UTC(y, 0, 1));
  $("#dTil").value = toIso(Date.UTC(y, 11, 31));
  $("#aStart").value = toIso(t);
  updateDager();
  updateArbeid();

  window.__kalk = { between, addWorkdays, CALC, parseNum };
})();
