/* Lønnsom – Pensjon: årlig opptjening i folketrygden og offentlig tjenestepensjon (påslagsmodellen) */
(() => {
  "use strict";
  const { kr, nf, nf1, num } = window.LS;
  const $ = (s) => document.querySelector(s);

  const FT_SATS = 0.181;        // folketrygden, opptil 7,1 G
  const OTP_LAV = 0.057;        // tjenestepensjon, opptil 7,1 G
  const OTP_HOY = 0.181;        // tjenestepensjon, 7,1–12 G
  const EGENANDEL = 0.02;       // medlemsinnskudd

  const el = { lonn: $("#pLonn"), fodt: $("#pFodt"), aar: $("#pAar"), G: $("#pG"), badge: $("#pBadge"), out: $("#pResult") };

  function cohort(y) {
    if (!y) return null;
    if (y >= 1963) return "new";
    if (y >= 1954) return "mid";
    return "old";
  }

  function update() {
    const lonn = num(el.lonn.value);
    const G = num(el.G.value) || 136549;
    const fodt = Number(el.fodt.value) || null;
    const aar = Math.max(1, Math.min(50, Number(el.aar.value) || 1));
    const g71 = 7.1 * G, g12 = 12 * G;
    const c = cohort(fodt);
    const paaslag = c === "new" || c == null;

    const ft = Math.min(lonn, g71) * FT_SATS;
    const otpLav = paaslag ? Math.min(lonn, g71) * OTP_LAV : 0;
    const otpHoy = paaslag ? Math.max(0, Math.min(lonn, g12) - g71) * OTP_HOY : 0;
    const otp = otpLav + otpHoy;
    const egen = Math.min(lonn, g12) * EGENANDEL;

    // Markér ordningen som gjelder
    document.querySelectorAll(".cohort").forEach((n) => n.classList.toggle("on", n.dataset.cohort === c));
    const badgeTxt = {
      new: "Født 1963 eller senere: påslagsmodellen gjelder.",
      mid: "Født 1954–1962: bruttoordning med overgangsregler. Tjenestepensjonen regnes ikke som påslag, så kalkulatoren viser bare folketrygden.",
      old: "Født før 1954: bruttoordning. Tjenestepensjonen regnes ikke som påslag, så kalkulatoren viser bare folketrygden.",
    };
    el.badge.innerHTML = c ? `<p class="out-note ${c === "new" ? "ok" : ""}">${badgeTxt[c]}</p>` : "";

    // Inntektsakse: 0 → maks(lønn, 12 G) + litt luft
    const axisMax = Math.max(lonn, g12) * 1.06;
    const pct = (v) => (Math.min(v, axisMax) / axisMax) * 100;

    el.out.innerHTML = `
      <div class="card-head">
        <div>
          <p class="eyebrow">Resultat</p>
          <h2>Dette gir ett år med lønn</h2>
        </div>
      </div>
      <div class="out-main">
        <span class="out-label">Ny pensjonsbeholdning per år</span>
        <b class="out-big">${kr(ft + otp)}</b>
        <span class="out-sub">${nf1.format(lonn ? ((ft + otp) / lonn) * 100 : 0)} % av lønnen · i dagens kroner</span>
      </div>

      <div class="axis" aria-hidden="true">
        <div class="axis-bar">
          <span class="seg-a" style="width:${pct(g71)}%"><i>18,1 % + ${paaslag ? "5,7 %" : "–"}</i></span>
          <span class="seg-b" style="width:${pct(g12) - pct(g71)}%"><i>${paaslag ? "18,1 %" : "–"}</i></span>
          <span class="seg-c" style="width:${100 - pct(g12)}%"></span>
          <b class="axis-marker" style="left:${pct(lonn)}%"><em>${kr(lonn)}</em></b>
        </div>
        <div class="axis-labels">
          <span style="left:0">0</span>
          <span style="left:${pct(g71)}%">7,1 G</span>
          <span style="left:${pct(g12)}%">12 G</span>
        </div>
      </div>

      <table class="out-table">
        <tr><td><span class="pill" style="background:var(--yellow)"></span>Folketrygden · 18,1 % av ${kr(Math.min(lonn, g71))}</td><td>${kr(ft)}</td></tr>
        ${paaslag ? `<tr><td><span class="pill" style="background:var(--green)"></span>Tjenestepensjon · 5,7 % opptil 7,1 G</td><td>${kr(otpLav)}</td></tr>
        <tr><td><span class="pill" style="background:var(--lime)"></span>Tjenestepensjon · 18,1 % mellom 7,1 og 12 G</td><td>${kr(otpHoy)}</td></tr>` : ""}
        <tr class="muted"><td>Egenandel 2 % trekkes av lønnen</td><td>${kr(egen)} / år · ${kr(egen / 12)} / mnd</td></tr>
      </table>

      <div class="stats">
        <div class="stat"><b>${kr((ft + otp) * aar)}</b><span>beholdning etter ${aar} år</span></div>
        <div class="stat"><b>${kr(ft * aar)}</b><span>av dette fra folketrygden</span></div>
        <div class="stat"><b>${kr(otp * aar)}</b><span>av dette fra tjenestepensjonen</span></div>
      </div>
      <p class="out-note">Forenklet: framskrivingen tar ikke med lønnsvekst, regulering eller tidligere opptjening. Beholdningen fordeles over forventet levealder når pensjonen tas ut. Se nav.no/dinpensjon og pensjonsleverandøren for en ordentlig prognose.</p>
    `;
  }

  function moneyMask(input) {
    input.addEventListener("input", () => {
      const pos = input.value.length - input.selectionStart;
      const n = num(input.value);
      input.value = n ? nf.format(n) : "";
      const p = Math.max(0, input.value.length - pos);
      input.setSelectionRange(p, p);
    });
  }
  moneyMask(el.lonn);
  moneyMask(el.G);
  $("#pForm").addEventListener("input", update);
  update();
})();
