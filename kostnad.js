/* Lønnsom – Lønnskostnad: fra årslønn til total kostnad per år og per time, med forklaring */
(() => {
  "use strict";
  const { dow, todayUtc, holidayName, nf, nf1, num } = window.LS;
  const $ = (s) => document.querySelector(s);
  const nf2 = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kr = (n) => nf.format(Math.round(n)) + " kr";
  const kr2 = (n) => nf2.format(n) + " kr";
  const pct = (n) => nf1.format(n) + " %";
  const t = (n) => nf.format(Math.round(n)) + " t";

  // Helligdager som faller på en hverdag (mandag–fredag) i et gitt år
  function weekdayHolidays(year) {
    let n = 0;
    for (let d = Date.UTC(year, 0, 1); d <= Date.UTC(year, 11, 31); d += 864e5) {
      const w = dow(d);
      if (w !== 0 && w !== 6 && holidayName(d)) n++;
    }
    return n;
  }

  // ---------- Beregning ----------
  function compute(i) {
    const stilling = Math.max(0, Math.min(100, i.pct)) / 100;
    const lonn = i.lonn * stilling + i.tillegg;              // faktisk lønn per år
    const ferie = lonn * (i.ferieSats / 100);                 // feriepenger
    const pensjon = lonn * (i.pensjonSats / 100);             // arbeidsgivers pensjonspremie
    const forsikring = lonn * (i.forsikringSats / 100);       // forsikringer o.l.
    const agaGrunnlag = lonn + ferie + pensjon;               // avgiftspliktig
    const aga = agaGrunnlag * (i.agaSats / 100);
    const total = lonn + ferie + pensjon + forsikring + aga;

    const betalte = i.ukeTimer * 52 * stilling;               // alle timer i stillingen
    const ferieT = i.ukeTimer * i.ferieUker * stilling;
    const hellig = weekdayHolidays(i.aar);
    const helligT = hellig * (i.ukeTimer / 5) * stilling;
    const tilgjengelig = Math.max(0, betalte - ferieT - helligT);
    const sykT = tilgjengelig * (i.syk / 100);
    const produktive = Math.max(0, tilgjengelig - sykT);

    return {
      ...i, stilling, lonn, ferie, pensjon, forsikring, agaGrunnlag, aga, total,
      paslag: lonn > 0 ? total / lonn - 1 : 0,
      perKrone: lonn > 0 ? total / lonn : 0,
      betalte, ferieT, hellig, helligT, sykT, produktive,
      timelonn: betalte > 0 ? lonn / betalte : 0,
      prisBetalt: betalte > 0 ? total / betalte : 0,
      prisProduktiv: produktive > 0 ? total / produktive : 0,
      maaned: total / 12,
    };
  }

  function read() {
    return {
      lonn: num($("#kLonn").value),
      pct: Number($("#kPct").value) || 0,
      tillegg: num($("#kTillegg").value),
      agaSats: Number($("#kSone").value) || 0,
      soneNavn: $("#kSone").selectedOptions[0]?.textContent.split(" – ")[0] || "",
      ferieSats: Math.max(0, Number($("#kFerie").value) || 0),
      pensjonSats: Math.max(0, Number($("#kPensjon").value) || 0),
      forsikringSats: Math.max(0, Number($("#kForsikring").value) || 0),
      ukeTimer: Math.max(1, Number($("#kUke").value) || 37.5),
      ferieUker: Math.max(0, Number($("#kFerieUker").value) || 0),
      syk: Math.max(0, Math.min(90, Number($("#kSyk").value) || 0)),
      aar: Number($("#kAar").value) || new Date(todayUtc()).getUTCFullYear() + 1,
    };
  }

  // ---------- Visning ----------
  const PARTS = [
    { key: "lonn", label: "Lønn", color: "var(--yellow)" },
    { key: "ferie", label: "Feriepenger", color: "var(--lime)" },
    { key: "pensjon", label: "Pensjon", color: "var(--green)" },
    { key: "aga", label: "Arbeidsgiveravgift", color: "#14834a" },
    { key: "forsikring", label: "Forsikring o.l.", color: "rgba(150, 110, 255, 0.85)" },
  ];

  function renderResult(r) {
    const el = $("#kResult");
    if (r.lonn <= 0) { el.innerHTML = `<p class="out-note">Fyll inn årslønn for å se kostnaden.</p>`; return; }
    const bar = PARTS.filter((p) => r[p.key] > 0).map((p) => `<span style="flex:${r[p.key]};background:${p.color}" title="${p.label}: ${kr(r[p.key])}"></span>`).join("");
    el.innerHTML = `
      <div class="card-head">
        <div>
          <p class="eyebrow">Resultat</p>
          <h2>Total lønnskostnad</h2>
        </div>
      </div>
      <div class="out-main">
        <span class="out-label">Per år · ${r.soneNavn} · ${nf.format(r.stilling * 100)} % stilling</span>
        <b class="out-big">${kr(r.total)}</b>
        <span class="out-sub">${kr(r.maaned)} per måned · ${pct(r.paslag * 100)} på toppen av lønnen</span>
      </div>
      <div class="k-prices">
        <div class="stat"><b>${kr2(r.timelonn)}</b><span>timelønn til den ansatte</span></div>
        <div class="stat"><b>${kr2(r.prisBetalt)}</b><span>kostnad per betalt time</span></div>
        <div class="stat hl"><b>${kr2(r.prisProduktiv)}</b><span>kostnad per produktiv time</span></div>
      </div>
      <div class="k-bar" aria-hidden="true">${bar}</div>
      <table class="out-table">
        ${PARTS.map((p) => `<tr><td><span class="pill" style="background:${p.color}"></span>${p.label}<small>${partNote(p.key, r)}</small></td><td>${kr(r[p.key])}<small class="k-share">${pct((r[p.key] / r.total) * 100)}</small></td></tr>`).join("")}
        <tr class="k-total"><td>Sum per år</td><td>${kr(r.total)}</td></tr>
      </table>`;
  }
  function partNote(key, r) {
    switch (key) {
      case "lonn": return r.tillegg ? `${kr(r.lonn - r.tillegg)} + faste tillegg ${kr(r.tillegg)}` : `${kr(r.lonn)} for ${nf.format(r.stilling * 100)} % stilling`;
      case "ferie": return `${pct(r.ferieSats)} av lønnen`;
      case "pensjon": return `${pct(r.pensjonSats)} av lønnen (arbeidsgivers andel)`;
      case "aga": return `${pct(r.agaSats)} av lønn, feriepenger og pensjon`;
      case "forsikring": return `${pct(r.forsikringSats)} av lønnen`;
    }
    return "";
  }

  // Forklaring i klarspråk, laget ut fra tallene
  function explanation(r) {
    if (r.lonn <= 0) return { html: `<p class="out-note">Fyll inn årslønn for å få en forklaring.</p>`, text: "" };
    const p = [
      ["Kort fortalt", `En ansatt med ${kr(r.lonn)} i lønn i året koster kommunen omtrent <b>${kr(r.total)}</b> i året, eller <b>${kr(r.maaned)}</b> i måneden. For hver krone den ansatte får i lønn, betaler kommunen <b>${nf2.format(r.perKrone)} kr</b>.`],
      ["Hvorfor mer enn lønnen?", `I tillegg til lønnen kommer feriepenger (${kr(r.ferie)}), kommunens del av pensjonen (${kr(r.pensjon)}), arbeidsgiveravgift til staten (${kr(r.aga)}) og forsikringer (${kr(r.forsikring)}). Til sammen er dette ${kr(r.total - r.lonn)}, eller ${pct(r.paslag * 100)} på toppen av lønnen.`],
      ["Timelønn og timepris", `Den ansatte får ${kr2(r.timelonn)} per time i lønn. Når alle kostnadene tas med, koster hver time i stillingen ${kr2(r.prisBetalt)}. Det er tallet å bruke når man sammenligner med for eksempel innleie.`],
      ["Hvorfor er en produktiv time dyrere?", `Av ${t(r.betalte)} i stillingen går omtrent ${t(r.ferieT)} til ferie, ${t(r.helligT)} til ${r.hellig} helligdager på hverdager i ${r.aar}, og ${t(r.sykT)} til sykefravær (${pct(r.syk)}). Da står det igjen omtrent <b>${t(r.produktive)}</b> på jobb. Fordelt på disse timene koster hver time <b>${kr2(r.prisProduktiv)}</b>.`],
      ["Hva er ikke med?", `Overtid, ubekvemstillegg, vikarer ved fravær, opplæring, utstyr og lokaler er ikke med. Refusjon fra NAV ved sykefravær kan trekke kostnaden noe ned. Bruk tallet som grunnkostnad for stillingen.`],
    ];
    const html = p.map(([h, txt]) => `<div class="exp-item"><h3>${h}</h3><p>${txt}</p></div>`).join("");
    const text = p.map(([h, txt]) => `${h}\n${txt.replace(/<[^>]+>/g, "")}`).join("\n\n");
    return { html, text };
  }

  let lastText = "";
  function update() {
    const r = compute(read());
    renderResult(r);
    const e = explanation(r);
    $("#kExplain").innerHTML = e.html;
    lastText = e.text;
  }

  // ---------- Eksempler ----------
  function renderExamples() {
    const yr = new Date(todayUtc()).getUTCFullYear() + 1;
    const base = { tillegg: 0, ferieSats: 12, pensjonSats: 14, forsikringSats: 0.5, ukeTimer: 37.5, ferieUker: 5, syk: 8, aar: yr };
    const a = compute({ ...base, lonn: 520000, pct: 100, agaSats: 14.1, soneNavn: "Sone 1" });
    const b = compute({ ...base, lonn: 640000, pct: 80, agaSats: 5.1, soneNavn: "Sone 4", ukeTimer: 35.5, syk: 10 });
    const card = (av, name, sub, tag, text, steps, note, fill) => `
      <article class="card example">
        <header class="ex-head"><span class="ex-avatar">${av}</span><div><h3>${name}</h3><p>${sub}</p></div><span class="ex-tag">${tag}</span></header>
        <p class="ex-text">${text}</p>
        <ol class="ex-steps">${steps.map(([l, v]) => `<li><span>${l}</span><b>${v}</b></li>`).join("")}</ol>
        <p class="ex-note">${note}</p>
        <button type="button" class="primary ex-btn" data-form="kForm" data-scroll="#verktoy" data-fill='${JSON.stringify(fill)}'>Prøv i kalkulatoren</button>
      </article>`;
    $("#kExamples").innerHTML =
      card("H", "Helsefagarbeider, sone 1", "100 % stilling", "Sone 1",
        "En leder vil vite hva en ny helsefagarbeider i full stilling med 520 000 kr i årslønn koster, i en kommune i sone 1.",
        [["Lønn", kr(a.lonn)], ["Feriepenger 12 %", kr(a.ferie)], ["Pensjon 14 %", kr(a.pensjon)], ["Arbeidsgiveravgift 14,1 %", kr(a.aga)], ["Total per år", kr(a.total)], ["Per produktiv time", kr2(a.prisProduktiv)]],
        `For hver krone i lønn betaler kommunen ${nf2.format(a.perKrone)} kr.`,
        { kLonn: "520 000", kPct: "100", kTillegg: "", kSone: "14.1", kFerie: "12", kPensjon: "14", kForsikring: "0.5", kUke: "37.5", kFerieUker: "5", kSyk: "8", kAar: String(yr) }) +
      card("S", "Sykepleier i turnus, sone 4", "80 % stilling · 35,5 t", "Sone 4",
        "Sykepleier med 640 000 kr i årslønn (100 %), i 80 % turnusstilling med 35,5 timers uke, i en kommune i sone 4. Sykefraværet i avdelingen er 10 %.",
        [["Lønn (80 %)", kr(b.lonn)], ["Arbeidsgiveravgift 5,1 %", kr(b.aga)], ["Total per år", kr(b.total)], ["Per betalt time", kr2(b.prisBetalt)], ["Per produktiv time", kr2(b.prisProduktiv)]],
        "Lavere arbeidsgiveravgift i sone 4 gjør påslaget mindre enn i sone 1.",
        { kLonn: "640 000", kPct: "80", kTillegg: "", kSone: "5.1", kFerie: "12", kPensjon: "14", kForsikring: "0.5", kUke: "35.5", kFerieUker: "5", kSyk: "10", kAar: String(yr) });
  }

  // ---------- Input ----------
  ["#kLonn", "#kTillegg"].forEach((s) => {
    const el = $(s);
    el.addEventListener("input", () => {
      const pos = el.value.length - el.selectionStart;
      const n = num(el.value);
      el.value = n ? nf.format(n) : "";
      const q = Math.max(0, el.value.length - pos);
      el.setSelectionRange(q, q);
    });
  });
  $("#kForm").addEventListener("input", update);
  $("#kForm").addEventListener("change", update);
  $("#kCopy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(lastText); flash("Forklaringen er kopiert"); }
    catch { flash("Kunne ikke kopiere"); }
  });
  function flash(msg) {
    let tt = document.querySelector(".fun-toast");
    if (!tt) { tt = document.createElement("div"); tt.className = "fun-toast"; tt.setAttribute("role", "status"); document.body.appendChild(tt); }
    tt.textContent = msg; tt.classList.remove("show"); void tt.offsetWidth; tt.classList.add("show");
    clearTimeout(tt._h); tt._h = setTimeout(() => tt.classList.remove("show"), 2200);
  }

  $("#kAar").value = new Date(todayUtc()).getUTCFullYear() + 1;
  renderExamples();
  update();
  window.__kost = { compute, weekdayHolidays };
})();
