/* Lønnsom – Pensjonister i jobb: aldersoversikt og pensjonistlønn */
(() => {
  "use strict";
  const { parseDate, toIso, todayUtc, fmt, nf, nf1 } = window.LS;
  const $ = (s) => document.querySelector(s);
  const nf2 = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kr2 = (n) => nf2.format(n) + " kr";

  const addYears = (t, n) => {
    const d = new Date(t), y = d.getUTCFullYear() + n, m = d.getUTCMonth();
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Date.UTC(y, m, Math.min(d.getUTCDate(), last));
  };

  // ---------- Aldersoversikt ----------
  function milestones(birth, saer) {
    const by = new Date(birth).getUTCFullYear();
    const ny = by >= 1963;
    const items = [
      { age: 62, title: "Kan ta ut alderspensjon", body: ny ? "Folketrygden og tjenestepensjonen etter påslagsmodellen kan tas ut fra 62 år, også ved siden av full jobb." : "Folketrygden og eventuell AFP kan tas ut. Tjenestepensjonen fra KLP kommer normalt fra 67 år eller særaldersgrensen." },
    ];
    if (saer) items.push({ age: saer, title: `Særaldersgrense ${saer} år`, body: "Den ansatte kan gå av med pensjon fra stillingen." + (ny ? " Med særaldersgrense kan pensjonistlønn brukes også for dem født 1963 eller senere." : ""), key: true });
    items.push(
      { age: 67, title: "Sykepenger i høyst 60 dager", body: "Fra 67 år gis det sykepenger i høyst 60 dager, og inntekten må være over 2 G." + (ny ? "" : " Ordinær pensjonsalder i den gamle ordningen."), key: !ny },
      { age: 70, title: "Ingen sykepenger fra NAV", body: "Fra og med 70 år gis det ikke sykepenger fra folketrygden." },
      { age: 72, title: "Aldersgrense i offentlig sektor", body: "Den alminnelige aldersgrensen er 72 år fra 2026. Etter dette kan pensjonisten jobbe på pensjonistlønn eller i kortere oppdrag.", key: true },
      { age: 75, title: "Siste mulige uttak", body: "Alderspensjonen fra folketrygden må være tatt ut senest ved 75 år, og opptjeningen i folketrygden stopper." },
    );
    return { ny, by, items: items.sort((a, b) => a.age - b.age).map((x) => ({ ...x, date: addYears(birth, x.age) })) };
  }

  let saer = 0;
  function updateAlder() {
    const birth = parseDate($("#alBirth").value);
    const out = $("#alOut");
    if (birth == null) { out.innerHTML = `<p class="out-note">Velg fødselsdato.</p>`; return; }
    const today = todayUtc();
    if (birth > today) { out.innerHTML = `<p class="out-note stop">Fødselsdatoen er frem i tid. Sjekk datoen.</p>`; return; }
    const m = milestones(birth, saer);
    let age = new Date(today).getUTCFullYear() - m.by;
    if (addYears(birth, age) > today) age--;
    const pensjonistlonn = !m.ny || saer > 0;
    document.querySelectorAll(".pj-cohorts .cohort").forEach((c) => c.classList.toggle("on", c.dataset.cohort === (m.ny ? "new" : "old")));
    out.innerHTML = `
      <div class="out-main">
        <span class="out-label">Født ${fmt(birth)} · ${m.ny ? "påslagsmodellen" : "gammel ordning (født før 1963)"}</span>
        <b class="out-big">${age} år <small>i dag</small></b>
        <span class="out-sub">${m.ny ? "Pensjonen reduseres ikke ved arbeid." : "Vanlig ansettelse med medlemskap kan redusere KLP-pensjonen."} Pensjonistlønn: ${pensjonistlonn ? "<b>kan brukes</b>" : "kan ikke brukes (krever særaldersgrense)"}.</span>
      </div>
      <ol class="timeline pj-timeline">
        ${m.items.map((x) => {
          const past = x.date <= today;
          const years = (x.date - today) / (365.2425 * 864e5);
          const rel = past ? "passert" : years < 1 ? `om ${Math.ceil(years * 12)} mnd` : `om ${nf1.format(years)} år`;
          return `<li class="${past ? "past" : ""} ${x.key ? "key" : ""}">
            <span class="node">${x.age}</span>
            <div class="card tl-body"><h3>${x.title}</h3><p>${x.body}</p></div>
            <div class="tl-date">${fmt(x.date)}<small>${rel}</small></div>
          </li>`;
        }).join("")}
      </ol>`;
  }

  // ---------- Pensjonistlønn ----------
  let pltype = "vanlig";
  function pensjonistlonn(timer, sats, und, ramme) {
    const tsats = und && ramme > 0 ? (sats * 1400) / ramme : sats;
    return { tsats, mnd: timer * tsats, aar: timer * tsats * 12 };
  }
  function updateLonn() {
    const timer = Math.max(0, Number($("#plTimer").value) || 0);
    const sats = Math.max(0, Number($("#plSats").value) || 0);
    const ramme = Number($("#plRamme").value) || 0;
    const und = pltype === "und";
    $("#plForm").dataset.type = pltype;
    const r = pensjonistlonn(timer, sats, und, ramme);
    $("#plOut").innerHTML = `
      <div class="out-main">
        <span class="out-label">${nf1.format(timer)} timer per måned${und ? " · undervisning" : ""}</span>
        <b class="out-big">${kr2(r.mnd)}</b>
        <span class="out-sub">${und ? `Omregnet sats ${kr2(r.tsats)} (${sats} × 1400 / ${ramme})` : `Sats ${kr2(r.tsats)} per time`}</span>
      </div>
      <table class="out-table">
        <tr><td>Per time${und ? "<small>omregnet for undervisning</small>" : ""}</td><td>${kr2(r.tsats)}</td></tr>
        <tr><td>Per måned<small>${nf1.format(timer)} t × ${kr2(r.tsats)}</small></td><td>${kr2(r.mnd)}</td></tr>
        <tr class="muted"><td>Per år med samme timetall</td><td>${kr2(r.aar)}</td></tr>
      </table>
      <p class="out-note">Pensjonistlønn er ikke pensjonsgivende, og pensjonisten meldes ikke inn i KLP. Derfor reduseres ikke pensjonen. Sjekk KS-rundskrivet for feriepenger og eventuelt rekrutteringstillegg.</p>`;
  }

  // ---------- Eksempler ----------
  function renderExamples() {
    const randi = pensjonistlonn(40, 269, false, 0);
    const m1 = milestones(parseDate("1960-03-08"), 0);
    const m2 = milestones(parseDate("1963-09-21"), 0);
    const age = (b) => Math.floor((todayUtc() - parseDate(b)) / (365.2425 * 864e5));
    const card = (a, name, sub, tag, text, steps, note, btn) => `
      <article class="card example">
        <header class="ex-head"><span class="ex-avatar">${a}</span><div><h3>${name}</h3><p>${sub}</p></div><span class="ex-tag">${tag}</span></header>
        <p class="ex-text">${text}</p>
        <ol class="ex-steps">${steps.map(([l, v]) => `<li><span>${l}</span><b>${v}</b></li>`).join("")}</ol>
        <p class="ex-note">${note}</p>
        ${btn}
      </article>`;
    const btn = (fill) => `<button type="button" class="primary ex-btn" data-pj='${JSON.stringify(fill)}'>Prøv i kalkulatoren</button>`;
    $("#pjExamples").innerHTML =
      card("R", "Randi, pensjonert sykepleier", `Født 1960 · ${age("1960-03-08")} år`, "Pensjonistlønn",
        "Randi har tatt ut pensjon fra KLP og vil ta ekstravakter på sykehjemmet, omtrent 40 timer i måneden.",
        [["Født før 1963", "gammel ordning"],
         ["Vanlig ansettelse med medlemskap i KLP", "pensjonen reduseres"],
         ["Pensjonistlønn: 40 t × 269 kr", kr2(randi.mnd) + " / mnd"],
         ["Pensjonen fra KLP", "reduseres ikke"],
         ["Sykepenger etter 67 år", `høyst 60 dager (fra ${fmt(m1.items.find((x) => x.age === 67).date)})`]],
        "Pensjonistlønn er det vanlige valget for pensjonister født før 1963 som vil jobbe litt. Begge parter må være enige om det.",
        btn({ birth: "1960-03-08", saer: "0", timer: "40", sats: "269" })) +
      card("B", "Bjørn, helsefagarbeider", `Født 1963 · ${age("1963-09-21")} år`, "Påslagsmodell",
        "Bjørn har ikke særaldersgrense. Han tar ut pensjon fra 62 år, men vil fortsette å jobbe i full stilling.",
        [["Født 1963 eller senere", "påslagsmodellen"],
         ["Pensjonen reduseres av arbeid", "nei"],
         ["Lønn", "vanlige lønnsvilkår"],
         ["Pensjonistlønn", "kan ikke brukes"],
         ["Aldersgrense i offentlig sektor", fmt(m2.items.find((x) => x.age === 72).date)]],
        "Bjørn tjener fortsatt opp pensjon mens han jobber. Hadde han hatt særaldersgrense, kunne han også valgt pensjonistlønn.",
        btn({ birth: "1963-09-21", saer: "0" }));
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pj]"); if (!b) return;
    const d = JSON.parse(b.dataset.pj);
    $("#alBirth").value = d.birth; setSaer(Number(d.saer));
    if (d.timer) { $("#plTimer").value = d.timer; $("#plSats").value = d.sats; setType("vanlig"); }
    updateAlder(); updateLonn();
    ["#alForm", "#plForm"].forEach((s) => { const f = $(s); f.classList.remove("flash"); void f.offsetWidth; f.classList.add("flash"); });
    $("#verktoy").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---------- Input ----------
  function setSaer(v) {
    saer = v;
    $("#alSaer").value = String(v);
    document.querySelectorAll("[data-saer]").forEach((x) => x.classList.toggle("on", Number(x.dataset.saer) === v));
  }
  function setType(v) {
    pltype = v;
    document.querySelectorAll("[data-pltype]").forEach((x) => x.classList.toggle("on", x.dataset.pltype === v));
  }
  document.querySelectorAll("[data-saer]").forEach((b) => b.addEventListener("click", () => { setSaer(Number(b.dataset.saer)); updateAlder(); }));
  document.querySelectorAll("[data-pltype]").forEach((b) => b.addEventListener("click", () => { setType(b.dataset.pltype); updateLonn(); }));
  $("#alForm").addEventListener("input", updateAlder);
  $("#alForm").addEventListener("change", updateAlder);
  $("#plForm").addEventListener("input", updateLonn);

  renderExamples();
  updateAlder();
  updateLonn();
  window.__pj = { milestones, pensjonistlonn };
})();
