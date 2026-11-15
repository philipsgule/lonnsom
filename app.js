/* Lønnsom – sykepengekalkulator for kommunal sektor
 * Alle datoer håndteres som UTC-midnatt (ms) for å unngå sommertid-feil.
 */
(() => {
  "use strict";

  // ---------- Konstanter ----------
  const DAY = 86400000;
  const AGP_DAYS = 16;          // ftrl. § 8-19
  const MAX_DAYS = 248;         // ftrl. § 8-12
  const REQUALIFY_DAYS = 182;   // 26 uker
  const OPPTJENING_DAYS = 28;   // 4 uker, ftrl. § 8-2
  const MAX_67 = 60;            // ftrl. § 8-51
  const HTA_MONTHS = 12;        // HTA § 8

  // ---------- Dato-hjelpere ----------
  const parseDate = (v) => {
    if (!v) return null;
    const [y, m, d] = v.split("-").map(Number);
    if (!y || !m || !d) return null;
    return Date.UTC(y, m - 1, d);
  };
  const toIso = (t) => new Date(t).toISOString().slice(0, 10);
  const addDays = (t, n) => t + n * DAY;
  const dow = (t) => new Date(t).getUTCDay();
  const isWeekday = (t) => { const d = dow(t); return d !== 0 && d !== 6; };
  const diffDays = (a, b) => Math.round((b - a) / DAY);
  const addMonths = (t, n) => {
    const d = new Date(t);
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Date.UTC(y, m, Math.min(day, last));
  };
  const addYears = (t, n) => addMonths(t, n * 12);
  const endOfMonth = (t) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0); };
  const todayUtc = () => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); };
  const countWeekdays = (a, b) => {
    if (a == null || b == null || b < a) return 0;
    let n = 0;
    for (let t = a; t <= b; t += DAY) if (isWeekday(t)) n++;
    return n;
  };

  const fDate = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const fDateLong = new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const fMonth = new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric", timeZone: "UTC" });
  const fmt = (t) => (t == null ? "–" : fDate.format(t).replace(/\.$/, ""));
  const fmtLong = (t) => (t == null ? "–" : fDateLong.format(t));
  const nf = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
  const kr = (n) => nf.format(Math.round(n)) + " kr";
  const num = (s) => Number(String(s || "").replace(/[^\d]/g, "")) || 0;

  // ---------- Helligdager ----------
  const holidayCache = new Map();
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(y, month - 1, day);
  }
  function holidays(y) {
    if (holidayCache.has(y)) return holidayCache.get(y);
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
    holidayCache.set(y, map);
    return map;
  }
  const holidayName = (t) => holidays(new Date(t).getUTCFullYear()).get(t);

  // ---------- Beregning ----------
  function compute(i) {
    const r = { alerts: [] };
    const { start } = i;
    const today = todayUtc();
    r.today = today;

    // Opptjening (4 uker)
    r.employedDays = i.ansatt != null ? diffDays(i.ansatt, start) : null;
    r.opptjent = i.ansatt == null || r.employedDays >= OPPTJENING_DAYS;
    if (i.ansatt != null && i.ansatt > start) {
      r.alerts.push(["stop", "Ansettelsesdatoen er etter første fraværsdag. Sjekk datoene."]);
    } else if (!r.opptjent) {
      r.alerts.push(["warn", `Den ansatte har bare vært ansatt i ${r.employedDays} dager (det kreves 28). Arbeidsgiveren har ikke plikt til å betale arbeidsgiverperiode. NAV kan betale fra første dag hvis den ansatte har opptjening fra en annen arbeidsgiver eller en NAV-ytelse.`]);
    }

    // 16-dagersregelen
    let agpLen = AGP_DAYS;
    r.continued = false;
    if (i.prevEnd != null) {
      if (i.prevEnd >= start) {
        r.alerts.push(["warn", "Forrige fravær slutter samme dag som eller etter at dette fraværet starter. 16-dagersregelen er derfor ikke brukt."]);
      } else {
        r.gap = diffDays(i.prevEnd, start) - 1;
        if (r.gap < 16) {
          r.continued = true;
          agpLen = Math.max(0, AGP_DAYS - Math.min(AGP_DAYS, i.prevAgp));
          r.alerts.push(["info", agpLen === 0
            ? `Det er bare ${r.gap} dager siden forrige fravær, og hele arbeidsgiverperioden ble brukt da. NAV betaler fra første dag.`
            : `Det er bare ${r.gap} dager siden forrige fravær, så arbeidsgiverperioden fortsetter. Det gjenstår ${agpLen} dager.`]);
        } else {
          r.alerts.push(["info", `Det er ${r.gap} dager siden forrige fravær (16 eller flere), så den ansatte får en ny, full arbeidsgiverperiode.`]);
        }
      }
    }
    if (!r.opptjent) agpLen = 0;
    r.agpLen = agpLen;
    r.agpStart = agpLen ? start : null;
    r.agpEnd = agpLen ? addDays(start, agpLen - 1) : null;
    r.navStart = addDays(start, agpLen);

    // Alder
    const b67 = i.birth != null ? addYears(i.birth, 67) : null;
    const b70 = i.birth != null ? addYears(i.birth, 70) : null;
    if (i.birth != null) {
      r.age = Math.floor(diffDays(i.birth, start) / 365.2425);
      if (b70 <= start) r.alerts.push(["stop", "Den ansatte har fylt 70 år og har ikke rett til sykepenger."]);
      else if (b67 <= start || b67 <= addDays(start, 400)) {
        r.alerts.push(["warn", `Den ansatte fyller 67 år ${fmt(b67)}. Etter det gis det høyst 60 sykepengedager, og inntekten må være over 2 G (${kr(2 * i.G)}).`]);
        if (i.lonn < 2 * i.G && b67 <= start) r.alerts.push(["stop", "Inntekten er under 2 G. Den ansatte har ikke rett til sykepenger etter fylte 67 år."]);
      }
    }

    // Maksdato
    const prior = Math.min(MAX_DAYS, Math.max(0, i.prior));
    const remaining = MAX_DAYS - prior;
    r.prior = prior;
    let used = 0, used67 = 0, ferieLeft = i.ferie, last = null, maks = null, reason = "248";
    r.ferieDays = new Set();
    if (remaining <= 0) {
      maks = null; reason = "exhausted";
      r.alerts.push(["stop", "Alle 248 sykepengedager er brukt. Den ansatte må ha vært helt arbeidsfør i 26 uker før hen får ny rett."]);
    } else {
      for (let t = start, guard = 0; guard < 2000; t += DAY, guard++) {
        if (!isWeekday(t)) continue;
        if (b70 != null && t >= b70) { maks = last; reason = "70"; break; }
        if (ferieLeft > 0 && t >= r.navStart) { ferieLeft--; r.ferieDays.add(t); continue; }
        used++; last = t;
        if (b67 != null && t > b67) used67++;
        if (used >= remaining) { maks = t; reason = "248"; break; }
        if (b67 != null && used67 >= MAX_67) { maks = t; reason = "67"; break; }
      }
    }
    r.maks = maks;
    r.maksReason = reason;
    r.noRight = reason === "exhausted" || (b70 != null && b70 <= start);
    if (r.noRight) {
      r.agpLen = 0; r.agpStart = r.agpEnd = null; r.navStart = start;
    }

    // Sykmeldingsslutt / bruk
    r.end = i.end;
    if (i.end != null && i.end < start) {
      r.alerts.push(["stop", "Sluttdatoen er før første fraværsdag."]);
      r.end = null;
    }
    const effEnd = r.noRight ? null : r.end != null && maks != null ? Math.min(r.end, maks) : (r.end ?? maks);
    r.effEnd = effEnd;
    r.reachesMaks = maks != null && (r.end == null || r.end >= maks);
    if (r.end != null && maks != null && r.end > maks) {
      r.alerts.push(["warn", `Sykmeldingen varer lenger enn maksdatoen. NAV betaler ikke sykepenger etter ${fmt(maks)}.`]);
    }

    const ferieInRange = (a, b) => { let n = 0; r.ferieDays.forEach((t) => { if (t >= a && t <= b) n++; }); return n; };
    // Ved åpen sykmelding: tell brukte dager fram til i dag
    r.usedRef = r.end == null && effEnd != null ? Math.min(effEnd, today) : effEnd;
    r.usedThisPeriod = r.usedRef != null && r.usedRef >= start ? countWeekdays(start, r.usedRef) - ferieInRange(start, r.usedRef) : 0;
    r.usedTotal = Math.min(MAX_DAYS, prior + r.usedThisPeriod);
    r.remainingAfter = MAX_DAYS - r.usedTotal;
    r.agpWeekdays = r.agpLen && !r.noRight ? countWeekdays(start, Math.min(r.agpEnd, effEnd ?? r.agpEnd)) : 0;
    r.onlyAgp = r.end != null && r.agpEnd != null && r.end <= r.agpEnd;

    // Gjenopptjening
    r.back = i.back ?? (maks != null ? addDays(maks, 1) : null);
    r.newRight = r.back != null ? addDays(r.back, REQUALIFY_DAYS) : null;
    if (reason === "exhausted") {
      r.back = i.back ?? start;
      r.newRight = addDays(r.back, REQUALIFY_DAYS);
    }

    // Økonomi
    const G = i.G;
    const grad = i.grad / 100;
    if (i.lonn > 0 && i.lonn < G / 2) r.alerts.push(["stop", `Årsinntekten er under ½ G (${kr(G / 2)}). Den ansatte har ikke rett til sykepenger.`]);
    r.grunnlag = Math.min(i.lonn, 6 * G);
    r.dayFull = (i.lonn / 260) * grad;
    r.dayNav = (r.grunnlag / 260) * grad;
    r.dayTop = Math.max(0, r.dayFull - r.dayNav);
    r.over6G = i.lonn > 6 * G;
    r.agpCost = r.agpWeekdays * r.dayFull;
    if (r.navStart <= (effEnd ?? -Infinity)) {
      r.navDays = countWeekdays(r.navStart, effEnd) - ferieInRange(r.navStart, effEnd);
    } else r.navDays = 0;
    r.navTotal = r.navDays * r.dayNav;
    r.htaEnd = addDays(addMonths(start, HTA_MONTHS), -1);
    const topEnd = effEnd != null ? Math.min(effEnd, r.htaEnd) : null;
    r.topDays = topEnd != null && topEnd >= r.navStart ? countWeekdays(r.navStart, topEnd) - ferieInRange(r.navStart, topEnd) : 0;
    r.topTotal = r.topDays * r.dayTop;
    r.refusjonFrist = r.navDays > 0 ? endOfMonth(addMonths(endOfMonth(r.navStart), 3)) : null;

    return r;
  }

  // ---------- Input ----------
  const $ = (s) => document.querySelector(s);
  const els = {
    form: $("#form"), results: $("#results"), months: $("#months"), timeline: $("#timeline"),
    start: $("#start"), end: $("#end"), grad: $("#grad"), gradOut: $("#gradOut"),
    prior: $("#prior"), ansatt: $("#ansatt"), lonn: $("#lonn"),
    prevEnd: $("#prevEnd"), prevAgp: $("#prevAgp"), birth: $("#birth"), ferie: $("#ferie"),
    back: $("#back"), G: $("#G"), toast: $("#toast"),
  };
  let calRange = "sick";
  let last = null;

  function readInput() {
    return {
      start: parseDate(els.start.value),
      end: parseDate(els.end.value),
      grad: Number(els.grad.value) || 100,
      prior: Math.max(0, Math.floor(Number(els.prior.value) || 0)),
      ansatt: parseDate(els.ansatt.value),
      lonn: num(els.lonn.value),
      prevEnd: parseDate(els.prevEnd.value),
      prevAgp: Math.max(0, Math.floor(Number(els.prevAgp.value) || 0)),
      birth: parseDate(els.birth.value),
      ferie: Math.max(0, Math.floor(Number(els.ferie.value) || 0)),
      back: parseDate(els.back.value),
      G: num(els.G.value) || 136549,
    };
  }

  // ---------- Rendering ----------
  const reasonText = {
    "248": "248 sykepengedager er brukt",
    "67": "60 dager etter fylte 67 år er brukt",
    "70": "dagen før den ansatte fyller 70 år",
  };

  function renderResults(i, r) {
    const alerts = r.alerts.length
      ? `<div class="alerts">${r.alerts.map(([k, t]) => `<div class="alert ${k}">${t}</div>`).join("")}</div>`
      : "";

    const agpPane = r.noRight
      ? `<div class="big">Ingen plikt</div><div class="sub">Den ansatte har ikke rett til sykepenger</div>`
      : r.agpLen
      ?`<div class="big">${fmt(r.agpStart)}<span class="arrow">→</span>${fmt(r.agpEnd)}</div>
         <div class="sub">${r.agpLen} kalenderdager · ${countWeekdays(r.agpStart, r.agpEnd)} virkedager${r.continued ? " · fortsetter fra forrige fravær" : ""}</div>`
      : `<div class="big">Ingen AGP</div><div class="sub">${!r.opptjent ? "Den ansatte har vært ansatt i under 4 uker" : "Arbeidsgiverperioden er allerede brukt opp (16-dagersregelen)"}</div>`;

    const navPane = r.noRight
      ? `<div class="big">Ingen rett</div><div class="sub">Se varselet over</div>`
      : r.onlyAgp
      ?`<div class="big">Ikke aktuelt</div><div class="sub">Arbeidsgiverperioden dekker hele fraværet</div>`
      : `<div class="big">Fra ${fmt(r.navStart)}</div>
         <div class="sub">${r.navDays} sykepengedager${r.end == null ? " fram til maksdato (sykmeldingen er åpen)" : ""} · ${i.grad} % gradering</div>`;

    // Ring
    const C = 2 * Math.PI * 70;
    const seg = (n) => (n / MAX_DAYS) * C;
    const pPrior = seg(r.prior), pAgp = seg(Math.min(r.agpWeekdays, r.usedThisPeriod)), pRest = seg(Math.max(0, r.usedThisPeriod - r.agpWeekdays));

    const maksHead = r.maksReason === "exhausted"
      ? `<div class="maks-date"><span class="red">Ingen rett</span></div><div class="sub">Alle 248 dager er brukt de siste 3 årene.</div>`
      : `<div class="maks-date">${fmt(r.maks)}</div>
         <div class="sub" style="text-transform:none">${cap(fmtLong(r.maks))} · siste dag med sykepenger fordi ${reasonText[r.maksReason]}</div>`;

    const requal = r.reachesMaks || r.maksReason === "exhausted"
      ? `<div class="stat"><b>${REQUALIFY_DAYS}</b><span>dager (26 uker) i arbeid for ny rett</span></div>
         <div class="stat"><b>${fmt(r.newRight)}</b><span>tidligst ny rett hvis tilbake ${fmt(r.back)}</span></div>`
      : `<div class="stat"><b>${r.remainingAfter}</b><span>sykepengedager igjen etter ${fmt(r.end)}</span></div>
         <div class="stat"><b>–</b><span>Maksdatoen nås ikke, så 26-ukersregelen gjelder ikke nå</span></div>`;

    const moneyRows = [
      ["var(--signal)", "Kommunen – arbeidsgiverperioden", r.agpWeekdays, r.dayFull, r.agpCost],
      ["var(--ice-300)", "NAV – sykepenger (opptil 6 G)", r.navDays, r.dayNav, r.navTotal],
    ];
    if (r.over6G) moneyRows.push(["var(--graphite-600)", "Kommunen – forskjellen over 6 G (HTA)", r.topDays, r.dayTop, r.topTotal]);

    els.results.innerHTML = `
      ${alerts}
      <div class="split">
        <div class="card pane agp">
          <span class="tag"><i></i>Arbeidsgiver betaler</span>
          ${agpPane}
          <dl class="kv">
            <dt>Kostnad for kommunen</dt><dd>${kr(r.agpCost)}</dd>
            <dt>Opptjening</dt><dd>${r.employedDays == null ? "ikke oppgitt" : r.opptjent ? "OK (" + r.employedDays + " d)" : r.employedDays + " av 28 d"}</dd>
          </dl>
        </div>
        <div class="card pane">
          <span class="tag"><i></i>NAV betaler</span>
          ${navPane}
          <dl class="kv">
            <dt>Dagsats NAV</dt><dd>${kr(r.dayNav)}</dd>
            <dt>Frist for refusjonskrav (første måned)</dt><dd>${fmt(r.refusjonFrist)}</dd>
          </dl>
        </div>
      </div>

      <div class="card maks-card">
        <div class="ring" aria-label="${r.usedTotal} av 248 sykepengedager brukt">
          <svg viewBox="0 0 168 168">
            <circle class="bg" cx="84" cy="84" r="70"/>
            <circle class="prior" cx="84" cy="84" r="70" stroke-dasharray="${pPrior} ${C}"/>
            <circle class="used" cx="84" cy="84" r="70" stroke-dasharray="${pRest} ${C}" stroke-dashoffset="${-(pPrior + pAgp)}"/>
            <circle class="agp" cx="84" cy="84" r="70" stroke-dasharray="${pAgp} ${C}" stroke-dashoffset="${-pPrior}"/>
          </svg>
          <div class="ring-label"><b>${r.usedTotal}</b><span>av 248 dager${r.end == null ? "<br>brukt per i dag" : ""}</span></div>
        </div>
        <div>
          <span class="tag" style="font:500 11px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Maksdato sykepenger</span>
          ${maksHead}
          <div class="stats">
            <div class="stat"><b>${r.prior}</b><span>dager brukt tidligere</span></div>
            ${requal}
          </div>
        </div>
      </div>

      <div class="card money">
        <div class="card-head" style="margin-bottom:0">
          <h3 style="margin:0">Hvem betaler hva</h3>
          <div class="actions">
            <button type="button" class="ghost" id="printBtn">Skriv ut</button>
            <button type="button" class="primary" id="copyBtn">Kopier sammendrag</button>
          </div>
        </div>
        <table>
          <thead><tr><th>Betaler</th><th>Dager</th><th>Per dag</th><th>Sum</th></tr></thead>
          <tbody>
            ${moneyRows.map(([c, l, d, p, s]) => `<tr><td><span class="pill" style="background:${c}"></span>${l}</td><td>${d}</td><td>${kr(p)}</td><td>${kr(s)}</td></tr>`).join("")}
          </tbody>
        </table>
        <p class="note">Sykepengegrunnlag ${kr(r.grunnlag)}${r.over6G ? ` (6 G-tak, årslønnen er ${kr(i.lonn)})` : ""}. Dagsatsen er årsbeløpet delt på 260 og ganget med ${i.grad} %. Etter HTA § 8 betaler kommunen full lønn til og med ${fmt(r.htaEnd)} og får refusjon fra NAV for NAV-delen. Beløpene er brutto og omtrentlige.</p>
      </div>`;

    $("#copyBtn").addEventListener("click", () => copySummary(i, r));
    $("#printBtn").addEventListener("click", () => window.print());
  }

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function renderCalendar(i, r) {
    const from = i.start;
    let to = calRange === "maks" ? (r.maks ?? r.end ?? addDays(from, 30)) : (r.end ?? r.maks ?? addDays(from, 30));
    if (calRange === "maks" && r.end != null && r.end > to) to = r.end;
    const sickTo = r.effEnd;            // faktisk sykmelding (kapped til maks)
    const projTo = calRange === "maks" ? r.maks : null;

    const startD = new Date(from), endD = new Date(to);
    const totalMonths = (endD.getUTCFullYear() - startD.getUTCFullYear()) * 12 + endD.getUTCMonth() - startD.getUTCMonth() + 1;
    const LIMIT = 15;
    const show = Math.min(totalMonths, LIMIT);
    const dows = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];
    let html = "";

    for (let mi = 0; mi < show; mi++) {
      const first = Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth() + mi, 1);
      const last = endOfMonth(first);
      const lead = (dow(first) + 6) % 7;
      let cells = "";
      let agpN = 0, navN = 0;
      for (let k = 0; k < lead; k++) cells += `<span class="d empty"></span>`;
      for (let t = first; t <= last; t += DAY) {
        const c = ["d"];
        const we = !isWeekday(t);
        if (we) c.push("we");
        const hol = holidayName(t);
        if (hol) c.push("hol");
        let label = fmtLong(t);
        if (t >= from) {
          const inSick = r.end != null ? t <= sickTo : (r.maks != null && t <= r.maks);
          if (r.agpEnd != null && t <= r.agpEnd && (inSick || r.end == null)) {
            c.push("agp"); label += " · Arbeidsgiverperiode"; if (!we) agpN++;
          } else if (inSick && t >= r.navStart) {
            c.push("nav");
            if (r.ferieDays.has(t)) { c.push("ferie"); label += " · Ferie (teller ikke)"; }
            else { label += " · NAV"; if (!we) navN++; }
          } else if (projTo != null && t <= projTo && t > (sickTo ?? -Infinity)) {
            c.push("proj"); label += " · Framskrevet (hvis den ansatte fortsatt er sykmeldt)";
          }
        }
        if (r.maks != null && t === r.maks) { c.push("maks"); label += " · MAKSDATO"; }
        if (t === r.today) c.push("today");
        if (hol) label += ` · ${hol}`;
        cells += `<span class="${c.join(" ")}" title="${label}">${new Date(t).getUTCDate()}</span>`;
      }
      const meta = agpN || navN ? `${agpN ? agpN + " AGP" : ""}${agpN && navN ? " · " : ""}${navN ? navN + " NAV" : ""}` : "";
      html += `<div class="card month"><h4>${fMonth.format(first)}<span>${meta}</span></h4>
        <div class="dow">${dows.map((d) => `<span>${d}</span>`).join("")}</div>
        <div class="days">${cells}</div></div>`;
    }
    if (totalMonths > LIMIT) html += `<div class="card month more">+ ${totalMonths - LIMIT} måneder til</div>`;
    els.months.innerHTML = html;
  }

  function renderTimeline(i, r) {
    const s = i.start;
    const w = (n) => addDays(s, n * 7 - 1);
    const items = [
      { t: s, n: "1", title: "Første fraværsdag", body: "Arbeidsgiverperioden starter. Den ansatte bruker egenmelding eller sykmelding.", key: true },
    ];
    if (r.agpEnd) items.push({ t: r.agpEnd, n: "16", title: "Arbeidsgiverperioden er slutt", body: "Siste dag kommunen betaler alene. Send inntektsmelding til NAV.", key: true });
    if (!r.onlyAgp) items.push({ t: r.navStart, n: "NAV", title: "NAV overtar", body: "Kommunen betaler fortsatt ut full lønn og sender refusjonskrav til NAV." });
    items.push(
      { t: w(4), n: "4u", title: "Oppfølgingsplan", body: "Arbeidsgiveren og den ansatte skal ha laget en oppfølgingsplan innen 4 uker." },
      { t: w(7), n: "7u", title: "Dialogmøte 1", body: "Arbeidsgiveren kaller inn til dialogmøte 1 innen 7 uker." },
      { t: w(8), n: "8u", title: "Aktivitetskravet", body: "Den ansatte skal prøve seg i arbeid, hvis ikke medisinske grunner er til hinder." },
      { t: w(26), n: "26u", title: "Dialogmøte 2", body: "NAV kaller inn til dialogmøte 2 innen 26 uker." },
      { t: w(39), n: "39u", title: "NAV varsler om maksdatoen", body: "Omtrent nå får den ansatte informasjon fra NAV om at sykepengene snart tar slutt." },
    );
    if (r.maks) items.push({ t: r.maks, n: "MAX", title: "Maksdato", body: `Siste dag med sykepenger fordi ${reasonText[r.maksReason]}.`, key: true });
    items.push({ t: r.htaEnd, n: "12m", title: "Full lønn etter HTA tar slutt", body: "Kommunens plikt til å betale full lønn i inntil 12 måneder er slutt." });
    if (r.reachesMaks && r.newRight) items.push({ t: r.newRight, n: "NY", title: "Ny rett til sykepenger", body: `Tidligste dato hvis den ansatte er helt arbeidsfør fra ${fmt(r.back)} (26 uker).`, key: true });

    const limit = r.end != null && !r.reachesMaks ? r.end : Infinity;
    const list = r.noRight
      ? [items[0], { t: r.newRight, n: "NY", title: "Ny rett til sykepenger", body: `Tidligste dato hvis den ansatte er helt arbeidsfør fra ${fmt(r.back)} (26 uker).`, key: true }]
      : items
      .filter((x) => x.t != null && (x.key || x.n === "12m" || x.n === "NAV" || x.t <= limit))
      .sort((a, b) => a.t - b.t);

    els.timeline.innerHTML = list.map((x) => {
      const past = x.t <= r.today;
      const rel = diffDays(r.today, x.t);
      const relTxt = rel === 0 ? "i dag" : rel > 0 ? `om ${rel} d` : `for ${-rel} d siden`;
      return `<li class="${past ? "past" : ""} ${x.key ? "key" : ""}">
        <span class="node">${x.n}</span>
        <div class="card tl-body"><h3>${x.title}</h3><p>${x.body}</p></div>
        <div class="tl-date">${fmt(x.t)}<small>${relTxt}</small></div>
      </li>`;
    }).join("");
  }

  function copySummary(i, r) {
    const lines = [
      "SYKEPENGER – SAMMENDRAG",
      `Første fraværsdag: ${fmt(i.start)}${r.end ? `  |  Sykmeldt t.o.m.: ${fmt(r.end)}` : "  |  Sykmeldingen er åpen"}`,
      `Sykmeldingsgrad: ${i.grad} %`,
      `Arbeidsgiverperiode: ${r.agpLen ? `${fmt(r.agpStart)} – ${fmt(r.agpEnd)} (${r.agpLen} dager)` : "ingen"}`,
      `NAV fra: ${r.onlyAgp ? "ikke aktuelt" : fmt(r.navStart)}`,
      `Maksdato: ${r.maksReason === "exhausted" ? "ingen rett (248 dager er brukt)" : fmt(r.maks) + ` (${reasonText[r.maksReason]})`}`,
      `Sykepengedager brukt: ${r.usedTotal} av 248 (${r.prior} tidligere)`,
      r.reachesMaks || r.maksReason === "exhausted" ? `Ny rett: tidligst ${fmt(r.newRight)} etter 26 uker i arbeid fra ${fmt(r.back)}` : `Dager igjen etter sykmeldingen: ${r.remainingAfter}`,
      `Dagsats NAV: ${kr(r.dayNav)}  |  Sykepengegrunnlag: ${kr(r.grunnlag)}`,
      `Full lønn etter HTA til og med: ${fmt(r.htaEnd)}`,
      r.refusjonFrist ? `Frist for refusjonskrav (første måned): ${fmt(r.refusjonFrist)}` : null,
    ].filter(Boolean).join("\n");
    const done = () => toast("Sammendraget er kopiert");
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(lines).then(done, () => fallbackCopy(lines, done));
    else fallbackCopy(lines, done);
  }
  function fallbackCopy(text, cb) {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); cb(); } catch { toast("Kunne ikke kopiere"); }
    ta.remove();
  }
  let toastT;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => els.toast.classList.remove("show"), 1800);
  }

  // ---------- Oppdatering ----------
  function update() {
    const g = Number(els.grad.value);
    els.gradOut.textContent = g + " %";
    els.grad.style.setProperty("--p", ((g - 20) / 80) * 100 + "%");

    const i = readInput();
    const gTxt = nf.format(i.G);
    $("#chipG").textContent = gTxt;
    $("#footG").textContent = gTxt + " kr";

    if (i.start == null) {
      els.results.innerHTML = `<div class="card pane"><span class="tag">Klar</span><div class="big">Velg første fraværsdag</div><div class="sub">Resultatene oppdateres mens du skriver.</div></div>`;
      els.months.innerHTML = ""; els.timeline.innerHTML = "";
      return;
    }
    const r = compute(i);
    last = { i, r };
    renderResults(i, r);
    renderCalendar(i, r);
    renderTimeline(i, r);
    save();
  }

  // Tusenskilletegn i beløpsfelt
  function moneyMask(el) {
    el.addEventListener("input", () => {
      const pos = el.value.length - el.selectionStart;
      const n = num(el.value);
      el.value = n ? nf.format(n) : "";
      const p = Math.max(0, el.value.length - pos);
      el.setSelectionRange(p, p);
    });
  }
  moneyMask(els.lonn);
  moneyMask(els.G);

  // Lagring (kun i denne nettleseren)
  const KEY = "lonnsom.v1";
  const fields = ["start", "end", "grad", "prior", "ansatt", "lonn", "prevEnd", "prevAgp", "birth", "ferie", "back", "G"];
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(fields.map((f) => [f, els[f].value])))); } catch {}
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || "null");
      if (d) fields.forEach((f) => { if (d[f] != null) els[f].value = d[f]; });
      return !!d;
    } catch { return false; }
  }
  function defaults() {
    const t = todayUtc();
    els.form.reset();
    els.start.value = toIso(addDays(t, -10));
    els.ansatt.value = toIso(addYears(t, -3));
    els.lonn.value = nf.format(620000);
    els.G.value = nf.format(136549);
  }

  els.form.addEventListener("input", update);
  els.form.addEventListener("change", update);
  $("#resetBtn").addEventListener("click", () => {
    try { localStorage.removeItem(KEY); } catch {}
    defaults(); update(); toast("Skjemaet er nullstilt");
  });
  document.querySelectorAll(".seg button").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".seg button").forEach((x) => x.classList.toggle("on", x === b));
      calRange = b.dataset.range;
      if (last) renderCalendar(last.i, last.r);
    })
  );

  if (!load()) defaults();
  update();

  // Eksponer for testing
  window.__lonnsom = { compute, parseDate, fmt };
})();
