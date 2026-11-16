/* Lønnsom – litt moro: nedtellinger i heroen og et påskeegg */
(() => {
  "use strict";
  const { DAY, addDays, dow, todayUtc, holidayName, fmt } = window.LS;
  const $ = (s) => document.querySelector(s);
  const DAGER = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];
  const PAYDAY_KEY = "lonnsom.lonningsdag";

  // ---------- Nedtellinger ----------
  const isBankDay = (t) => { const d = dow(t); return d !== 0 && d !== 6 && !holidayName(t); };
  const lastDayOf = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  // Lønningsdag i en gitt måned: valgt dag (eller siste dag), flyttet til virkedagen før ved helg/helligdag
  function paydayIn(y, m, day) {
    let t = Date.UTC(y, m, day === "siste" ? lastDayOf(y, m) : Math.min(Number(day), lastDayOf(y, m)));
    while (!isBankDay(t)) t = addDays(t, -1);
    return t;
  }
  function nextPayday(today, day) {
    const d = new Date(today);
    let y = d.getUTCFullYear(), m = d.getUTCMonth();
    for (let i = 0; i < 3; i++) {
      const t = paydayIn(y, m, day);
      if (t >= today) return t;
      m++; if (m > 11) { m = 0; y++; }
    }
    return null;
  }
  function nextFeriepenger(today, day) {
    const y = new Date(today).getUTCFullYear();
    const t = paydayIn(y, 5, day);
    return t >= today ? t : paydayIn(y + 1, 5, day);
  }
  function nextGreg(today) {
    const y = new Date(today).getUTCFullYear();
    const t = Date.UTC(y, 4, 1);
    return t >= today ? t : Date.UTC(y + 1, 4, 1);
  }
  const getDay = () => { try { return localStorage.getItem(PAYDAY_KEY) || "12"; } catch { return "12"; } };
  const setDay = (v) => { try { localStorage.setItem(PAYDAY_KEY, v); } catch {} };
  const rel = (n) => (n === 0 ? "i dag" : n === 1 ? "i morgen" : `om ${n} dager`);

  const hero = $(".hero");
  let box = null;
  function renderCountdowns() {
    if (!hero) return;
    const today = todayUtc(), day = getDay();
    const items = [
      { key: "pay", label: "Neste lønningsdag", t: nextPayday(today, day), edit: true },
      { key: "fp", label: "Feriepenger", t: nextFeriepenger(today, day) },
      { key: "g", label: "G-regulering", t: nextGreg(today) },
    ];
    if (!box) {
      box = document.createElement("div");
      box.className = "countdowns";
      hero.appendChild(box);
    }
    box.innerHTML = items.map((x) => {
      const n = Math.round((x.t - today) / DAY);
      return `<div class="cd${n === 0 ? " today" : ""}" data-key="${x.key}">
        <span class="cd-label">${x.label}${x.edit ? ` <button type="button" class="cd-edit" aria-label="Endre lønningsdag">den ${day === "siste" ? "siste" : day + "."} ✎</button>` : ""}</span>
        <b class="cd-num">${n === 0 ? "I dag" : n}<small>${n === 0 ? "" : n === 1 ? " dag" : " dager"}</small></b>
        <span class="cd-date">${DAGER[dow(x.t)]} ${fmt(x.t)} · ${rel(n)}</span>
      </div>`;
    }).join("") + `
      <div class="cd-pop" hidden>
        <label>Lønningsdag i kommunen
          <select id="cdDay">${Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}">Den ${i + 1}.</option>`).join("")}<option value="siste">Siste dag i måneden</option></select>
        </label>
        <small>Faller dagen på helg eller helligdag, brukes virkedagen før.</small>
      </div>`;
    const pop = box.querySelector(".cd-pop"), sel = box.querySelector("#cdDay");
    sel.value = day;
    box.querySelector(".cd-edit").addEventListener("click", (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; if (!pop.hidden) sel.focus(); });
    sel.addEventListener("change", () => { setDay(sel.value); renderCountdowns(); });
    pop.addEventListener("click", (e) => e.stopPropagation());
  }
  document.addEventListener("click", () => { const p = box && box.querySelector(".cd-pop"); if (p) p.hidden = true; });
  renderCountdowns();

  // ---------- Påskeegg: Konami-koden gir nordlys ----------
  const CODE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let pos = 0;
  document.addEventListener("keydown", (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = k === CODE[pos] ? pos + 1 : k === CODE[0] ? 1 : 0;
    if (pos === CODE.length) {
      pos = 0;
      const ok = window.LSParticles && window.LSParticles.aurora();
      toast(ok ? "Du fant påskeegget – god nordlystur!" : "Du fant påskeegget! (Nordlyset er av når redusert bevegelse er på.)");
    }
  });
  function toast(msg) {
    let t = $(".fun-toast");
    if (!t) { t = document.createElement("div"); t.className = "fun-toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.remove("show"); void t.offsetWidth; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3500);
  }

  window.__fun = { nextPayday, nextFeriepenger, nextGreg, paydayIn };
})();
