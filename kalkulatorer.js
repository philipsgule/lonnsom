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

  // ---------- Dager per måned ----------
  const MND = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
  const cap = (x) => x.replace(/^./, (c) => c.toUpperCase());
  const MND3 = ["jan.", "feb.", "mar.", "apr.", "mai", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "des."];
  const span = (a, b) => { const x = new Date(a), y = new Date(b); return `${x.getUTCDate()}.${a === b ? "" : "–" + y.getUTCDate() + "."} ${MND3[x.getUTCMonth()]}`; };
  function perMonth(fra, til) {
    let a = fra, b = til, swapped = false;
    if (b < a) { [a, b] = [b, a]; swapped = true; }
    const months = [];
    let cur = null;
    for (let t = a; t <= b; t += DAY) {
      const d = new Date(t), y = d.getUTCFullYear(), m = d.getUTCMonth();
      if (!cur || cur.y !== y || cur.m !== m) { cur = { y, m, kal: 0, arbeid: 0, fra: t, til: t }; months.push(cur); }
      cur.kal++; cur.til = t;
      const w = dow(t);
      if (w !== 0 && w !== 6) cur.arbeid++;
    }
    const kal = months.reduce((s, x) => s + x.kal, 0), arbeid = months.reduce((s, x) => s + x.arbeid, 0);
    return { a, b, swapped, months, kal, arbeid };
  }

  let mSel = 0, mKey = "", mLast = null;
  function monthCal(r, mo) {
    const first = Date.UTC(mo.y, mo.m, 1), days = new Date(Date.UTC(mo.y, mo.m + 1, 0)).getUTCDate();
    const off = (dow(first) + 6) % 7;
    let cells = "";
    for (let i = 0; i < off; i++) cells += `<span class="mc-cell empty"></span>`;
    for (let n = 1; n <= days; n++) {
      const t = Date.UTC(mo.y, mo.m, n), w = dow(t), h = holidayName(t);
      const inn = t >= r.a && t <= r.b;
      const cls = ["mc-cell", inn ? "in" : "", w === 0 || w === 6 ? "we" : "", h ? "hol" : "", t === r.a ? "first" : "", t === r.b ? "last" : ""].filter(Boolean).join(" ");
      cells += `<span class="${cls}"${h ? ` title="${h}"` : ""}>${n}</span>`;
    }
    const many = r.months.length > 1;
    return `
      <div class="mcal">
        <div class="mc-head">
          <button type="button" class="mc-nav" data-mnav="-1" aria-label="Forrige måned"${mSel === 0 ? " disabled" : ""}>‹</button>
          <b>${cap(MND[mo.m])} ${mo.y}</b>
          <button type="button" class="mc-nav" data-mnav="1" aria-label="Neste måned"${mSel === r.months.length - 1 ? " disabled" : ""}>›</button>
        </div>
        ${many ? `<p class="mc-pos">Måned ${mSel + 1} av ${r.months.length}</p>` : ""}
        <div class="mc-grid" aria-hidden="true">${["ma", "ti", "on", "to", "fr", "lø", "sø"].map((d) => `<span class="mc-dow">${d}</span>`).join("")}${cells}</div>
        <div class="mc-sum">
          <div><b>${mo.arbeid}</b><span>arbeidsdager</span></div>
          <div><b>${mo.kal}</b><span>kalenderdager</span></div>
        </div>
        <p class="mc-range">Perioden i ${MND[mo.m]}: ${span(mo.fra, mo.til)}</p>
      </div>`;
  }
  function renderMonths() {
    const r = mLast, out = $("#mOut");
    const mo = r.months[mSel];
    const rows = r.months.map((x, i) => `<tr class="mrow${i === mSel ? " on" : ""}" data-mi="${i}" tabindex="0" aria-current="${i === mSel}"><td>${cap(MND[x.m])} ${x.y}<small>${span(x.fra, x.til)}</small></td><td>${x.arbeid}</td><td>${x.kal}</td></tr>`).join("");
    out.innerHTML = `
      ${r.swapped ? `<p class="out-note">Datoene var i omvendt rekkefølge og er byttet om.</p>` : ""}
      <div class="dato-main dato-two">
        <div class="dm hl"><b>${nf0.format(r.arbeid)}</b><span>arbeidsdager<small>mandag–fredag i hele perioden</small></span></div>
        <div class="dm"><b>${nf0.format(r.kal)}</b><span>kalenderdager<small>første og siste dag telles med</small></span></div>
      </div>
      <div class="m-layout">
        ${monthCal(r, mo)}
        <table class="out-table m-table"><thead><tr><th>Måned</th><th><span class="th-full">Arbeidsdager</span><span class="th-short">Arbeid</span></th><th><span class="th-full">Kalenderdager</span><span class="th-short">Kalender</span></th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="k-total"><td>Sum</td><td>${nf0.format(r.arbeid)}</td><td>${nf0.format(r.kal)}</td></tr></tfoot></table>
      </div>`;
  }
  function updateMaaned() {
    const fra = parseDate($("#mFra").value), til = parseDate($("#mTil").value);
    const out = $("#mOut");
    if (fra == null || til == null) { out.innerHTML = `<p class="out-note">Velg begge datoene.</p>`; return; }
    if (Math.abs(til - fra) / DAY > 3660) { out.innerHTML = `<p class="out-note stop">Velg en periode på høyst 10 år.</p>`; return; }
    const key = fra + ":" + til;
    if (key !== mKey) { mKey = key; mSel = 0; }
    mLast = perMonth(fra, til);
    mSel = Math.min(mSel, mLast.months.length - 1);
    renderMonths();
  }
  $("#mOut").addEventListener("click", (e) => {
    const nav = e.target.closest("[data-mnav]"), row = e.target.closest("[data-mi]");
    if (nav) mSel = Math.max(0, Math.min(mLast.months.length - 1, mSel + Number(nav.dataset.mnav)));
    else if (row) mSel = Number(row.dataset.mi);
    else return;
    renderMonths();
    if (nav) $(`#mOut [data-mnav="${nav.dataset.mnav}"]`)?.focus();
  });
  $("#mOut").addEventListener("keydown", (e) => {
    const row = e.target.closest("[data-mi]");
    if (!row || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault(); mSel = Number(row.dataset.mi); renderMonths();
    $(`#mOut [data-mi="${mSel}"]`)?.focus();
  });

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
  $("#mForm").addEventListener("input", updateMaaned);
  $("#mForm").addEventListener("change", updateMaaned);

  // Standard: inneværende år og i dag + 10 arbeidsdager
  const t = todayUtc(), y = new Date(t).getUTCFullYear();
  $("#dFra").value = toIso(Date.UTC(y, 0, 1));
  $("#dTil").value = toIso(Date.UTC(y, 11, 31));
  $("#aStart").value = toIso(t);
  $("#mFra").value = toIso(t);
  $("#mTil").value = toIso(Date.UTC(y, new Date(t).getUTCMonth() + 1, 12));
  updateDager();
  updateArbeid();
  updateMaaned();

  window.__kalk = { between, addWorkdays, perMonth, CALC, parseNum };
})();
