/* Lønnsom – Ferie: feriepengekalkulator, feriedagteller og ferieår */
(() => {
  "use strict";
  const { DAY, parseDate, toIso, addDays, dow, todayUtc, holidayName, fmt, kr, nf, nf1, num } = window.LS;
  const $ = (s) => document.querySelector(s);

  const SATS = { hta: 0.12, lov: 0.102 };
  const TILLEGG_60 = 0.023;

  const today = todayUtc();
  const nowY = new Date(today).getUTCFullYear();
  const nowM = new Date(today).getUTCMonth();
  // Etter sommeren er det neste års ferie som er aktuell
  const defaultYear = nowM >= 8 ? nowY + 1 : nowY;

  const el = {
    grunnlag: $("#fpGrunnlag"), aar: $("#fpAar"), fodt: $("#fpFodt"), G: $("#fpG"), fpOut: $("#fpOut"),
    fra: $("#fdFra"), til: $("#fdTil"), fdOut: $("#fdOut"), timeline: $("#ferieTimeline"),
  };
  let sats = "hta";

  // ---------- Feriepenger ----------
  function feriepenger() {
    const grunnlag = num(el.grunnlag.value);
    const aar = Number(el.aar.value) || defaultYear;
    const fodt = Number(el.fodt.value) || null;
    const G = num(el.G.value) || 136549;
    const is60 = fodt != null && aar - fodt >= 60;
    const grunn = grunnlag * SATS[sats];
    const tilleggGrunnlag = Math.min(grunnlag, 6 * G);
    const tillegg = is60 ? tilleggGrunnlag * TILLEGG_60 : 0;
    const total = grunn + tillegg;
    const lovTotal = grunnlag * SATS.lov + tillegg;
    const effektiv = grunnlag ? (total / grunnlag) * 100 : 0;

    const rows = [
      [`${nf1.format(SATS[sats] * 100)} % av ${kr(grunnlag)}`, grunn],
    ];
    if (is60) rows.push([`2,3 % tillegg (60+) av ${kr(tilleggGrunnlag)}${grunnlag > 6 * G ? " (6G-tak)" : ""}`, tillegg]);

    el.fpOut.innerHTML = `
      <div class="out-main">
        <span class="out-label">Feriepenger utbetales i juni ${aar}</span>
        <b class="out-big">${kr(total)}</b>
        <span class="out-sub">Effektiv sats ${nf1.format(effektiv)} % · opptjent i ${aar - 1}</span>
      </div>
      <table class="out-table">
        ${rows.map(([l, v]) => `<tr><td>${l}</td><td>${kr(v)}</td></tr>`).join("")}
        ${sats === "hta" ? `<tr class="muted"><td>Mer enn ferielovens minimum</td><td>+${kr(total - lovTotal)}</td></tr>` : ""}
      </table>
      ${is60 ? `<p class="out-note ok">Den ansatte fyller ${aar - fodt} år i ${aar} og får også en <b>ekstra ferieuke</b> (6 virkedager).</p>` : ""}
      ${fodt != null && !is60 && aar - fodt >= 55 ? `<p class="out-note">Den ansatte fyller 60 år i ${fodt + 60} og får da 60+-tillegget og en ekstra ferieuke.</p>` : ""}
    `;
    renderTimeline(aar);
  }

  // ---------- Feriedager ----------
  function feriedager() {
    const fra = parseDate(el.fra.value), til = parseDate(el.til.value);
    if (fra == null || til == null) { el.fdOut.innerHTML = `<p class="out-note">Velg første og siste feriedag.</p>`; return; }
    if (til < fra) { el.fdOut.innerHTML = `<p class="out-note stop">Siste feriedag er før første feriedag.</p>`; return; }
    const days = Math.round((til - fra) / DAY) + 1;
    if (days > 120) { el.fdOut.innerHTML = `<p class="out-note stop">Velg en periode på maks 120 dager.</p>`; return; }

    let virke = 0, arbeid = 0, lor = 0;
    const hol = [];
    let strip = "";
    const lead = (dow(fra) + 6) % 7;
    for (let k = 0; k < lead; k++) strip += `<span class="d empty"></span>`;
    for (let t = fra; t <= til; t += DAY) {
      const d = dow(t), h = holidayName(t);
      const c = ["d"];
      let label = fmt(t);
      if (h) { hol.push([t, h]); c.push("hol"); label += ` · ${h} (teller ikke)`; }
      else if (d === 0) { c.push("we"); label += " · søndag (teller ikke)"; }
      else {
        virke++;
        if (d === 6) { lor++; c.push("nav", "we"); label += " · lørdag (virkedag)"; }
        else { arbeid++; c.push("nav"); label += " · virkedag"; }
      }
      strip += `<span class="${c.join(" ")}" title="${label}">${new Date(t).getUTCDate()}</span>`;
    }

    const y = new Date(fra).getUTCFullYear();
    const inMain = fra >= Date.UTC(y, 5, 1) && til <= Date.UTC(y, 8, 30);
    const hovedferie = inMain && virke >= 18
      ? `<p class="out-note ok">Ferien ligger i hovedferieperioden og har minst 18 virkedager, så retten til hovedferie er oppfylt.</p>`
      : inMain ? `<p class="out-note">Ferien ligger i hovedferieperioden, men har færre enn 18 virkedager.</p>` : "";

    el.fdOut.innerHTML = `
      <div class="out-main">
        <span class="out-label">${fmt(fra)} – ${fmt(til)} · ${days} dager</span>
        <b class="out-big">${virke} <small>virkedager</small></b>
        <span class="out-sub">≈ ${nf1.format(virke / 6)} ferieuker · ${arbeid} arbeidsdager (man–fre)${lor ? ` · ${lor} lørdager` : ""}</span>
      </div>
      <div class="strip-wrap">
        <div class="dow">${["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"].map((d) => `<span>${d}</span>`).join("")}</div>
        <div class="days">${strip}</div>
      </div>
      <div class="legend mini">
        <span><i class="sw nav"></i>Virkedag</span>
        <span><i class="sw sat"></i>Lørdag (virkedag)</span>
        <span><i class="sw hol"></i>Helligdag</span>
      </div>
      ${hol.length ? `<p class="out-note">Helligdager som ikke teller som feriedager: ${hol.map(([t, h]) => `<b>${h}</b> (${fmt(t)})`).join(", ")}.</p>` : ""}
      ${hovedferie}
    `;
  }

  // ---------- Ferieåret ----------
  function renderTimeline(Y) {
    const items = [
      { t: Date.UTC(Y - 1, 0, 1), n: Y - 1 + "", date: `1. jan – 31. des ${Y - 1}`, title: "Opptjeningsåret", body: "Lønnen som utbetales i løpet av året, gir feriepenger til neste år." },
      { t: Date.UTC(Y, 0, 1), n: "JAN", date: `1. jan ${Y}`, title: "Ferieåret starter", body: "Ferien for året kan tas fra nå, og den betales med feriepengene som ble opptjent i fjor." },
      { t: Date.UTC(Y, 3, 1), n: "APR", date: `1. apr ${Y}`, title: "Siste frist for varsel om sommerferie", body: "Starter hovedferien 1. juni, må den ansatte ha fått beskjed senest nå (2 måneder før)." },
      { t: Date.UTC(Y, 5, 1), n: "JUN", date: `juni ${Y}`, title: "Feriepenger utbetales", body: "Vanlig praksis i kommunen er at feriepengene utbetales i juni, og at det samtidig trekkes lønn for feriedagene.", key: true },
      { t: Date.UTC(Y, 5, 1), n: "SOM", date: `1. jun – 30. sep`, title: "Hovedferieperioden", body: "Den ansatte kan kreve 18 virkedager sammenhengende ferie i denne perioden.", key: true },
      { t: Date.UTC(Y, 8, 30), n: "SEP", date: `30. sep ${Y}`, title: "Hovedferieperioden er slutt", body: "Den som begynner i jobben etter denne datoen, kan bare kreve 6 virkedager ferie i år." },
      { t: Date.UTC(Y, 11, 31), n: "DES", date: `31. des ${Y}`, title: "Ferieåret er slutt", body: "Ferie som ikke er tatt, kan bare overføres etter skriftlig avtale (inntil 12 virkedager) eller hvis den ansatte var syk." },
    ];
    el.timeline.innerHTML = items.map((x) => {
      const past = x.t <= today;
      return `<li class="${past ? "past" : ""} ${x.key ? "key" : ""}">
        <span class="node">${x.n}</span>
        <div class="card tl-body"><h3>${x.title}</h3><p>${x.body}</p></div>
        <div class="tl-date">${x.date}</div>
      </li>`;
    }).join("");
  }

  // ---------- Input ----------
  function moneyMask(input) {
    input.addEventListener("input", () => {
      const pos = input.value.length - input.selectionStart;
      const n = num(input.value);
      input.value = n ? nf.format(n) : "";
      const p = Math.max(0, input.value.length - pos);
      input.setSelectionRange(p, p);
    });
  }
  moneyMask(el.grunnlag);
  moneyMask(el.G);

  document.querySelectorAll("[data-sats]").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("[data-sats]").forEach((x) => x.classList.toggle("on", x === b));
      sats = b.dataset.sats;
      feriepenger();
    })
  );
  $("#fpForm").addEventListener("input", feriepenger);
  $("#fdForm").addEventListener("input", feriedager);
  $("#fdForm").addEventListener("change", feriedager);

  // Standardverdier: tre uker fra første mandag i juli
  el.aar.value = defaultYear;
  let start = Date.UTC(defaultYear, 6, 1);
  while (dow(start) !== 1) start = addDays(start, 1);
  el.fra.value = toIso(start);
  el.til.value = toIso(addDays(start, 20));

  feriepenger();
  feriedager();
})();
