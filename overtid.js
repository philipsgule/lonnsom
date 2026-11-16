/* Lønnsom – Overtid: kalkulator med fordeling på 50/100 % og kontroll av grenser */
(() => {
  "use strict";
  const { DAY, parseDate, toIso, addDays, dow, todayUtc, holidayName, fmt, kr, nf, nf1, num } = window.LS;
  const $ = (s) => document.querySelector(s);
  const DAGER = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];
  // Timelønn og timesatser vises med øre, slik at regnestykkene går opp
  const nf2 = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kr2 = (n) => nf2.format(n) + " kr";

  // ---------- Fordeling av én overtidsøkt ----------
  // 100 % mellom kl. 21 og 06, og hele døgnet på søndager og helligdager. Ellers 50 %.
  const parseTime = (v) => { if (!v) return null; const [h, m] = v.split(":").map(Number); return h * 60 + (m || 0); };
  function split(dateIso, fra, til) {
    const d = parseDate(dateIso), a = parseTime(fra), b = parseTime(til);
    if (d == null || a == null || b == null || a === b) return null;
    const start = d + a * 60000;
    const end = d + (b > a ? b : b + 1440) * 60000; // over midnatt
    let m50 = 0, m100 = 0;
    for (let t = start; t < end; t += 60000) {
      const day = t - (t % DAY);
      const h = new Date(t).getUTCHours();
      const full = dow(day) === 0 || holidayName(day) || h >= 21 || h < 6;
      if (full) m100++; else m50++;
    }
    return { m50, m100, overMidnatt: b <= a };
  }
  function oppgjor(lonn, div, m50, m100, avsp) {
    const tl = div > 0 ? lonn / div : 0;
    const t50 = m50 / 60, t100 = m100 / 60;
    const tillegg = t50 * tl * 0.5 + t100 * tl * 1.0;
    const grunn = (t50 + t100) * tl;
    return { tl, t50, t100, tillegg, grunn, utbetalt: avsp ? tillegg : grunn + tillegg, avspTimer: avsp ? t50 + t100 : 0 };
  }
  const timer = (h) => (Number.isInteger(h) ? `${h} t` : `${nf1.format(h)} t`);

  // ---------- Rader ----------
  let rows = [];
  let avsp = false;
  const rowsEl = $("#otRows");

  function renderRows() {
    rowsEl.innerHTML = rows.map((r, i) => `
      <div class="ot-row" data-i="${i}">
        <input type="date" value="${r.dato}" data-k="dato" aria-label="Dato" />
        <input type="time" value="${r.fra}" data-k="fra" step="900" aria-label="Fra" />
        <input type="time" value="${r.til}" data-k="til" step="900" aria-label="Til" />
        <button type="button" class="ot-del" aria-label="Fjern rad" ${rows.length < 2 ? "disabled" : ""}>×</button>
        <span class="ot-chip" data-chip></span>
      </div>`).join("");
  }
  rowsEl.addEventListener("input", (e) => {
    const row = e.target.closest(".ot-row"); if (!row) return;
    rows[row.dataset.i][e.target.dataset.k] = e.target.value;
    update();
  });
  rowsEl.addEventListener("click", (e) => {
    if (!e.target.matches(".ot-del")) return;
    rows.splice(Number(e.target.closest(".ot-row").dataset.i), 1);
    renderRows(); update();
  });
  $("#otAdd").addEventListener("click", () => {
    const last = rows[rows.length - 1];
    const next = last && parseDate(last.dato) != null ? toIso(addDays(parseDate(last.dato), 1)) : toIso(todayUtc());
    rows.push({ dato: next, fra: "16:00", til: "19:00" });
    renderRows(); update();
  });

  function update() {
    const lonn = num($("#otLonn").value);
    const div = Number($("#otDiv").value) || 1850;
    let m50 = 0, m100 = 0;
    rowsEl.querySelectorAll(".ot-row").forEach((el, i) => {
      const r = rows[i], s = split(r.dato, r.fra, r.til);
      const chip = el.querySelector("[data-chip]");
      if (!s) { chip.textContent = "Fyll inn dato og tid"; chip.className = "ot-chip warn"; return; }
      m50 += s.m50; m100 += s.m100;
      const d = parseDate(r.dato), hol = holidayName(d);
      const parts = [];
      if (s.m50) parts.push(`${timer(s.m50 / 60)} 50 %`);
      if (s.m100) parts.push(`${timer(s.m100 / 60)} 100 %`);
      chip.textContent = `${DAGER[dow(d)]}${hol ? " · " + hol : ""}${s.overMidnatt ? " · over midnatt" : ""} — ${parts.join(" + ")}`;
      chip.className = "ot-chip";
    });

    const o = oppgjor(lonn, div, m50, m100, avsp);
    const total = o.t50 + o.t100;
    $("#otOut").innerHTML = total === 0 ? `<p class="out-note">Legg inn minst én overtidsøkt.</p>` : `
      <div class="out-main">
        <span class="out-label">${avsp ? "Utbetales (bare tillegget)" : "Utbetales"} · ${timer(total)} overtid</span>
        <b class="out-big">${kr2(o.utbetalt)}</b>
        <span class="out-sub">Timelønn ${kr2(o.tl)} (${nf.format(lonn)} / ${div})${avsp ? ` · ${timer(o.avspTimer)} til avspasering` : ""}</span>
      </div>
      <table class="out-table">
        <tr><td><span class="pill" style="background:var(--lime)"></span>${timer(o.t50)} × ${kr2(o.tl * (avsp ? 0.5 : 1.5))}<small>${avsp ? "50 % tillegg" : "timelønn + 50 %"}</small></td><td>${kr2(o.t50 * o.tl * (avsp ? 0.5 : 1.5))}</td></tr>
        <tr><td><span class="pill" style="background:var(--yellow)"></span>${timer(o.t100)} × ${kr2(o.tl * (avsp ? 1 : 2))}<small>${avsp ? "100 % tillegg" : "timelønn + 100 %"}</small></td><td>${kr2(o.t100 * o.tl * (avsp ? 1 : 2))}</td></tr>
        ${avsp ? `<tr class="muted"><td>Timer som tas ut som fritid</td><td>${timer(o.avspTimer)}</td></tr>` : ""}
      </table>
      <p class="out-note">Er den ansatte i deltid, er timene opp til full stilling merarbeid med vanlig timelønn, ikke overtid.</p>
    `;
  }

  // ---------- Grenser ----------
  let avtale = false;
  const GRENSER = { lov: [10, 25, 200], avtale: [20, 50, 300] };
  function updateGrenser() {
    const g = avtale ? GRENSER.avtale : GRENSER.lov;
    const vals = [$("#grUke").value, $("#gr4").value, $("#gr52").value].map((v) => Math.max(0, Number(v) || 0));
    const labels = ["Denne uken", "Siste 4 uker", "Siste 52 uker"];
    const over = vals.some((v, i) => v > g[i]);
    const near = !over && vals.some((v, i) => v >= g[i] * 0.8);
    $("#grOut").innerHTML = `
      ${labels.map((l, i) => {
        const pct = Math.min(100, (vals[i] / g[i]) * 100);
        const cls = vals[i] > g[i] ? "over" : vals[i] >= g[i] * 0.8 ? "near" : "";
        return `<div class="gr-row ${cls}">
          <div class="gr-top"><span>${l}</span><b>${nf1.format(vals[i])} / ${g[i]} t</b></div>
          <div class="gr-bar"><span style="width:${pct}%"></span></div>
        </div>`;
      }).join("")}
      <p class="out-note ${over ? "stop" : near ? "" : "ok"}">${over
        ? `Over grensen${avtale ? " i avtalen" : " i loven"}. Mer overtid krever ${avtale ? "tillatelse fra Arbeidstilsynet" : "skriftlig avtale med de tillitsvalgte"}.`
        : near ? "Nær grensen. Følg med før det pålegges mer overtid."
        : "Innenfor grensene."}</p>
    `;
  }

  // ---------- Eksempler (regnes ut med samme funksjoner) ----------
  function renderExamples() {
    const h1 = split("2026-11-17", "18:00", "22:00"), h2 = split("2026-11-22", "08:00", "12:00");
    const hanne = oppgjor(600000, 1850, h1.m50 + h2.m50, h1.m100 + h2.m100, false);
    const t1 = split("2026-11-19", "16:00", "22:00");
    const tomas = oppgjor(700000, 1850, t1.m50, t1.m100, true);
    const btn = (fill, opp) => `<button type="button" class="primary ex-btn" data-form="otForm" data-scroll="#verktoy" data-ot='${JSON.stringify(fill)}' data-opp-set="${opp}">Prøv i kalkulatoren</button>`;
    const card = (a, name, sub, tag, text, steps, note, button) => `
      <article class="card example">
        <header class="ex-head"><span class="ex-avatar">${a}</span><div><h3>${name}</h3><p>${sub}</p></div><span class="ex-tag">${tag}</span></header>
        <p class="ex-text">${text}</p>
        <ol class="ex-steps">${steps.map(([l, v]) => `<li><span>${l}</span><b>${v}</b></li>`).join("")}</ol>
        <p class="ex-note">${note}</p>
        ${button}
      </article>`;
    $("#otExamples").innerHTML =
      card("H", "Hanne, sykepleier", "Kveld og søndag", "Utbetaling",
        "Hanne har 600 000 kr i årslønn. Hun jobber overtid tirsdag 17. november kl. 18–22 og søndag 22. november kl. 08–12.",
        [["Timelønn (600 000 / 1850)", kr2(hanne.tl)],
         ["Tirsdag kl. 18–21 med 50 %", `${timer(h1.m50 / 60)}`],
         ["Tirsdag kl. 21–22 og søndag kl. 08–12 med 100 %", `${timer((h1.m100 + h2.m100) / 60)}`],
         [`${timer(hanne.t50)} × ${kr2(hanne.tl * 1.5)} + ${timer(hanne.t100)} × ${kr2(hanne.tl * 2)}`, kr2(hanne.utbetalt)]],
        "Timen etter kl. 21 på tirsdag gir 100 %, selv om resten av kvelden gir 50 %.",
        btn({ lonn: "600 000", div: "1850", rows: [{ dato: "2026-11-17", fra: "18:00", til: "22:00" }, { dato: "2026-11-22", fra: "08:00", til: "12:00" }] }, "ut")) +
      card("T", "Tomas, ingeniør", "Avspaserer overtiden", "Avspasering",
        "Tomas har 700 000 kr i årslønn og jobber overtid torsdag 19. november kl. 16–22. Han vil heller ha fri enn penger.",
        [["Timelønn (700 000 / 1850)", kr2(tomas.tl)],
         ["Kl. 16–21 med 50 % tillegg", `${timer(tomas.t50)} × ${kr2(tomas.tl * 0.5)}`],
         ["Kl. 21–22 med 100 % tillegg", `${timer(tomas.t100)} × ${kr2(tomas.tl)}`],
         ["Tillegget som utbetales", kr2(tomas.utbetalt)],
         ["Timer til avspasering", timer(tomas.avspTimer)]],
        "Ved avspasering tas selve timene ut som fri, men overtidstillegget skal fortsatt utbetales.",
        btn({ lonn: "700 000", div: "1850", rows: [{ dato: "2026-11-19", fra: "16:00", til: "22:00" }] }, "av"));
  }
  // Eksempelknappene fyller inn radene (egen håndtering fordi radene er dynamiske)
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ot]"); if (!b) return;
    const d = JSON.parse(b.dataset.ot);
    $("#otLonn").value = d.lonn; $("#otDiv").value = d.div;
    rows = d.rows.map((r) => ({ ...r }));
    setOpp(b.dataset.oppSet);
    renderRows(); update();
    const f = $("#otForm"); f.classList.remove("flash"); void f.offsetWidth; f.classList.add("flash");
    $("#verktoy").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---------- Input ----------
  function setOpp(v) {
    avsp = v === "av";
    document.querySelectorAll("[data-opp]").forEach((x) => x.classList.toggle("on", x.dataset.opp === v));
  }
  document.querySelectorAll("[data-opp]").forEach((b) => b.addEventListener("click", () => { setOpp(b.dataset.opp); update(); }));
  document.querySelectorAll("[data-avtale]").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("[data-avtale]").forEach((x) => x.classList.toggle("on", x === b));
      avtale = b.dataset.avtale === "1";
      updateGrenser();
    })
  );
  const lonnEl = $("#otLonn");
  lonnEl.addEventListener("input", () => {
    const pos = lonnEl.value.length - lonnEl.selectionStart;
    const n = num(lonnEl.value);
    lonnEl.value = n ? nf.format(n) : "";
    const p = Math.max(0, lonnEl.value.length - pos);
    lonnEl.setSelectionRange(p, p);
  });
  $("#otLonn").addEventListener("input", update);
  $("#otDiv").addEventListener("input", update);
  $("#grForm").addEventListener("input", updateGrenser);

  // Standard: to økter denne uken
  const t = todayUtc();
  rows = [
    { dato: toIso(t), fra: "16:00", til: "20:00" },
    { dato: toIso(addDays(t, (7 - dow(t)) % 7)), fra: "10:00", til: "14:00" }, // førstkommende søndag
  ];
  renderRows();
  renderExamples();
  update();
  updateGrenser();

  window.__ot = { split, oppgjor };
})();
