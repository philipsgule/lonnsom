/* Lønnsom – Turnus: ubekvemstillegg per vakt og turnussjekk */
(() => {
  "use strict";
  const { DAY, parseDate, toIso, addDays, dow, todayUtc, holidayName, nf, nf1, num } = window.LS;
  const $ = (s) => document.querySelector(s);
  const DAGER = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];
  const nf2 = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kr2 = (n) => nf2.format(n) + " kr";
  const timer = (h) => (Number.isInteger(h) ? `${h} t` : `${nf1.format(h)} t`);

  // ---------- Fordeling av én vakt ----------
  // Kveld/natt: kl. 17–06. Helg: lørdag 00 – søndag 24. Helligdag: hele døgnet.
  const parseTime = (v) => { if (!v) return null; const [h, m] = v.split(":").map(Number); return h * 60 + (m || 0); };
  function split(dateIso, fra, til) {
    const d = parseDate(dateIso), a = parseTime(fra), b = parseTime(til);
    if (d == null || a == null || b == null || a === b) return null;
    const start = d + a * 60000, end = d + (b > a ? b : b + 1440) * 60000;
    let tot = 0, kveld = 0, helg = 0, hellig = 0;
    for (let t = start; t < end; t += 60000) {
      const day = t - (t % DAY), h = new Date(t).getUTCHours(), wd = dow(day);
      tot++;
      if (h >= 17 || h < 6) kveld++;
      if (wd === 6 || wd === 0) helg++;
      if (holidayName(day)) hellig++;
    }
    return { tot: tot / 60, kveld: kveld / 60, helg: helg / 60, hellig: hellig / 60, overMidnatt: b <= a };
  }
  function tillegg(lonn, div, satser, s) {
    const tl = div > 0 ? lonn / div : 0;
    const k = s.kveld * tl * (satser.kveld / 100);
    const h = s.helg * satser.helg;
    const hd = s.hellig * tl * (satser.hellig / 100);
    return { tl, k, h, hd, sum: k + h + hd };
  }

  // ---------- Rader ----------
  let rows = [];
  const rowsEl = $("#tuRows");
  function renderRows() {
    rowsEl.innerHTML = rows.map((r, i) => `
      <div class="ot-row" data-i="${i}">
        <input type="date" value="${r.dato}" data-k="dato" aria-label="Dato" />
        <input type="time" value="${r.fra}" data-k="fra" step="900" aria-label="Fra" />
        <input type="time" value="${r.til}" data-k="til" step="900" aria-label="Til" />
        <button type="button" class="ot-del" aria-label="Fjern vakt" ${rows.length < 2 ? "disabled" : ""}>×</button>
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
  $("#tuAdd").addEventListener("click", () => {
    const last = rows[rows.length - 1];
    const next = last && parseDate(last.dato) != null ? toIso(addDays(parseDate(last.dato), 1)) : toIso(todayUtc());
    rows.push({ dato: next, fra: last ? last.fra : "07:30", til: last ? last.til : "15:00" });
    renderRows(); update();
  });

  const satser = () => ({
    kveld: Number($("#tuKveld").value) || 0,
    helg: Number($("#tuHelg").value) || 0,
    hellig: Number($("#tuHellig").value) || 0,
  });

  function update() {
    const lonn = num($("#tuLonn").value), div = Number($("#tuDiv").value) || 1850, st = satser();
    const sum = { tot: 0, kveld: 0, helg: 0, hellig: 0 };
    rowsEl.querySelectorAll(".ot-row").forEach((el, i) => {
      const r = rows[i], s = split(r.dato, r.fra, r.til), chip = el.querySelector("[data-chip]");
      if (!s) { chip.textContent = "Fyll inn dato og tid"; chip.className = "ot-chip warn"; return; }
      for (const k in sum) sum[k] += s[k];
      const d = parseDate(r.dato), hol = holidayName(d);
      const parts = [timer(s.tot)];
      if (s.kveld) parts.push(`${timer(s.kveld)} kveld/natt`);
      if (s.helg) parts.push(`${timer(s.helg)} helg`);
      if (s.hellig) parts.push(`${timer(s.hellig)} helligdag`);
      chip.textContent = `${DAGER[dow(d)]}${hol ? " · " + hol : ""}${s.overMidnatt ? " · over midnatt" : ""} — ${parts.join(" · ")}`;
      chip.className = "ot-chip";
    });
    const t = tillegg(lonn, div, st, sum);
    $("#tuOut").innerHTML = sum.tot === 0 ? `<p class="out-note">Legg inn minst én vakt.</p>` : `
      <div class="out-main">
        <span class="out-label">Ubekvemstillegg · ${timer(sum.tot)} på ${rows.length} vakt${rows.length > 1 ? "er" : ""}</span>
        <b class="out-big">${kr2(t.sum)}</b>
        <span class="out-sub">Timelønn ${kr2(t.tl)} (${nf.format(lonn)} / ${div}) · kommer i tillegg til vanlig lønn</span>
      </div>
      <table class="out-table">
        <tr><td><span class="pill" style="background:var(--lime)"></span>Kveld/natt kl. 17–06<small>${timer(sum.kveld)} × ${nf1.format(st.kveld)} % av timelønn</small></td><td>${kr2(t.k)}</td></tr>
        <tr><td><span class="pill" style="background:var(--yellow)"></span>Helg lørdag–søndag<small>${timer(sum.helg)} × ${kr2(st.helg)}</small></td><td>${kr2(t.h)}</td></tr>
        <tr><td><span class="pill" style="background:var(--green)"></span>Helge- og høytidsdag<small>${timer(sum.hellig)} × ${nf2.format(st.hellig)} % av timelønn</small></td><td>${kr2(t.hd)}</td></tr>
      </table>
    `;
  }

  // ---------- Turnussjekk ----------
  let norm = 35.5;
  function updateSjekk() {
    const pct = Math.max(0, Math.min(100, Number($("#tsPct").value) || 0));
    const uker = Math.max(1, Math.floor(Number($("#tsUker").value) || 1));
    const plan = Math.max(0, Number($("#tsPlan").value) || 0);
    const helg = Number($("#tsHelg").value);
    const slider = $("#tsHelg");
    slider.style.setProperty("--p", ((helg - 2) / 4) * 100 + "%");
    $("#tsHelgOut").textContent = `hver ${helg}. helg`;

    const skal = norm * (pct / 100) * uker;
    const diff = plan - skal;
    const snitt = plan / uker;
    const helgerAar = Math.round(52 / helg);
    const helgerPeriode = uker / helg;
    const ok = Math.abs(diff) < 0.01;
    $("#tsOut").innerHTML = `
      <div class="out-main">
        <span class="out-label">${nf1.format(norm)} t × ${pct} % × ${uker} uker</span>
        <b class="out-big">${nf2.format(skal)} <small>timer skal turnusen ha</small></b>
        <span class="out-sub">${nf2.format(norm * pct / 100)} t i snitt per uke</span>
      </div>
      <table class="out-table">
        <tr><td>Planlagte timer i turnusen</td><td>${nf2.format(plan)} t</td></tr>
        <tr><td>Gjennomsnitt per uke</td><td>${nf2.format(snitt)} t</td></tr>
        <tr class="muted"><td>Avvik</td><td>${diff > 0 ? "+" : ""}${nf2.format(diff)} t</td></tr>
      </table>
      <p class="out-note ${ok ? "ok" : Math.abs(diff) > 1 ? "stop" : ""}">${ok
        ? "Turnusen går opp i timer."
        : diff > 0 ? `Turnusen har ${nf2.format(diff)} timer for mye. Timer ut over stillingen er merarbeid eller overtid.`
        : `Turnusen mangler ${nf2.format(-diff)} timer. De må legges inn eller avtales, for eksempel som timer til disposisjon.`}</p>
      <p class="out-note">Helg hver ${helg}. uke gir omtrent <b>${helgerAar} helger i året</b>${Number.isInteger(helgerPeriode) ? ` og ${helgerPeriode} helg${helgerPeriode > 1 ? "er" : ""} i denne turnusen` : ""}.${helg === 2 ? " Annenhver helg er det mest loven tillater uten avtale om gjennomsnitt." : ""}</p>
    `;
  }

  // ---------- Eksempler (regnes ut med samme funksjoner) ----------
  function renderExamples() {
    const ST = { kveld: 25, helg: 65, hellig: 133.33 };
    const i1 = split("2026-11-21", "15:00", "22:30"), i2 = split("2026-11-22", "07:30", "15:00");
    const iSum = { kveld: i1.kveld + i2.kveld, helg: i1.helg + i2.helg, hellig: 0 };
    const ingrid = tillegg(520000, 1850, ST, iSum);
    const m = split("2026-12-24", "21:30", "07:30");
    const mats = tillegg(640000, 1850, ST, m);
    const btn = (fill) => `<button type="button" class="primary ex-btn" data-tu='${JSON.stringify(fill)}'>Prøv i kalkulatoren</button>`;
    const card = (a, name, sub, tag, text, steps, note, button) => `
      <article class="card example">
        <header class="ex-head"><span class="ex-avatar">${a}</span><div><h3>${name}</h3><p>${sub}</p></div><span class="ex-tag">${tag}</span></header>
        <p class="ex-text">${text}</p>
        <ol class="ex-steps">${steps.map(([l, v]) => `<li><span>${l}</span><b>${v}</b></li>`).join("")}</ol>
        <p class="ex-note">${note}</p>
        ${button}
      </article>`;
    $("#tuExamples").innerHTML =
      card("I", "Ingrid, helsefagarbeider", "Helgevakter", "Kveld + helg",
        "Ingrid har 520 000 kr i årslønn. Hun jobber lørdag 21. november kl. 15.00–22.30 og søndag 22. november kl. 07.30–15.00.",
        [["Timelønn (520 000 / 1850)", kr2(ingrid.tl)],
         [`Kveld lørdag kl. 17.00–22.30: ${timer(iSum.kveld)} × 25 %`, kr2(ingrid.k)],
         [`Helg begge dager: ${timer(iSum.helg)} × 65 kr`, kr2(ingrid.h)],
         ["Ubekvemstillegg totalt", kr2(ingrid.sum)]],
        "Lørdagskvelden gir både kvelds- og helgetillegg, fordi tilleggene kommer i tillegg til hverandre. Satsene er eksempler.",
        btn({ lonn: "520 000", rows: [{ dato: "2026-11-21", fra: "15:00", til: "22:30" }, { dato: "2026-11-22", fra: "07:30", til: "15:00" }] })) +
      card("M", "Mats, sykepleier", "Nattevakt i julen", "Natt + helligdag",
        "Mats har 640 000 kr i årslønn og har nattevakt fra julaften kl. 21.30 til 1. juledag kl. 07.30.",
        [["Timelønn (640 000 / 1850)", kr2(mats.tl)],
         [`Kveld/natt: ${timer(m.kveld)} × 25 %`, kr2(mats.k)],
         [`1. juledag kl. 00.00–07.30: ${timer(m.hellig)} × 133,33 %`, kr2(mats.hd)],
         ["Ubekvemstillegg totalt", kr2(mats.sum)]],
        "Timene før midnatt på julaften kan gi eget høytidstillegg etter HTA. Det er ikke med i kalkulatoren.",
        btn({ lonn: "640 000", rows: [{ dato: "2026-12-24", fra: "21:30", til: "07:30" }] }));
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tu]"); if (!b) return;
    const d = JSON.parse(b.dataset.tu);
    $("#tuLonn").value = d.lonn; $("#tuDiv").value = "1850";
    $("#tuKveld").value = "25"; $("#tuHelg").value = "65"; $("#tuHellig").value = "133.33";
    rows = d.rows.map((r) => ({ ...r }));
    renderRows(); update();
    const f = $("#tuForm"); f.classList.remove("flash"); void f.offsetWidth; f.classList.add("flash");
    $("#verktoy").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---------- Input ----------
  const lonnEl = $("#tuLonn");
  lonnEl.addEventListener("input", () => {
    const pos = lonnEl.value.length - lonnEl.selectionStart;
    const n = num(lonnEl.value);
    lonnEl.value = n ? nf.format(n) : "";
    const p = Math.max(0, lonnEl.value.length - pos);
    lonnEl.setSelectionRange(p, p);
  });
  ["#tuLonn", "#tuDiv", "#tuKveld", "#tuHelg", "#tuHellig"].forEach((s) => $(s).addEventListener("input", update));
  $("#tsForm").addEventListener("input", updateSjekk);
  document.querySelectorAll("[data-norm]").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("[data-norm]").forEach((x) => x.classList.toggle("on", x === b));
      norm = Number(b.dataset.norm);
      updateSjekk();
    })
  );

  // Standard: en typisk aftenvakt og en helgevakt
  const t = todayUtc();
  const lor = addDays(t, (6 - dow(t) + 7) % 7);
  rows = [
    { dato: toIso(t), fra: "15:00", til: "22:30" },
    { dato: toIso(lor), fra: "07:30", til: "15:00" },
  ];
  renderRows();
  renderExamples();
  update();
  updateSjekk();

  window.__tu = { split, tillegg };
})();
