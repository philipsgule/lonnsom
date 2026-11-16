/* Lønnsom – partikler
 * 1) Heroen: myke lyspartikler som stiger rolig og reagerer på musen.
 * 2) Resten av siden: et felt bak innholdet som vokser mens man scroller.
 *    Flere og større partikler, fargen glir fra grønt mot gult, tynne linjer
 *    mellom nære partikler, dybde-parallakse og lysstriper ved rask scrolling.
 * Ren dekor: ingen klikk, pauses når fanen er skjult, statisk ved «redusert bevegelse».
 */
(() => {
  "use strict";
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  // ---------- Farger: grønn → lime → gul ----------
  const GREEN = [31, 168, 94], LIME = [155, 217, 74], YELLOW = [254, 237, 101];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const colorAt = (t) => (t < 0.5 ? mix(GREEN, LIME, t * 2) : mix(LIME, YELLOW, (t - 0.5) * 2));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  // Ferdigtegnede glød-sprites (raskere enn å tegne gradienter for hver partikkel)
  const STEPS = 16, SR = 64;
  const sprites = Array.from({ length: STEPS }, (_, i) => {
    const c = colorAt(i / (STEPS - 1)).join(",");
    const s = document.createElement("canvas");
    s.width = s.height = SR * 2;
    const g = s.getContext("2d");
    const grd = g.createRadialGradient(SR, SR, 0, SR, SR, SR);
    grd.addColorStop(0, `rgba(${c},1)`);
    grd.addColorStop(0.18, `rgba(${c},0.75)`);
    grd.addColorStop(0.45, `rgba(${c},0.18)`);
    grd.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, SR * 2, SR * 2);
    return { canvas: s, rgb: c };
  });
  const sprite = (t) => sprites[clamp(Math.round(t * (STEPS - 1)), 0, STEPS - 1)];

  // ---------- Felles ----------
  const mouse = { x: -9999, y: -9999 };
  window.addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  document.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });

  function makeLayer(canvas) {
    return { canvas, ctx: canvas.getContext("2d"), w: 0, h: 0, parts: [] };
  }
  function sizeLayer(L, w, h) {
    L.w = w; L.h = h;
    L.canvas.width = Math.max(1, Math.round(w * DPR));
    L.canvas.height = Math.max(1, Math.round(h * DPR));
    L.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // ---------- 1) Heroen ----------
  const heroCanvas = document.querySelector(".hero-particles");
  const hero = heroCanvas ? makeLayer(heroCanvas) : null;
  let heroVisible = true;

  function seedHero() {
    const n = clamp(Math.round((hero.w * hero.h) / 16000), 22, 70);
    hero.parts = Array.from({ length: n }, () => {
      const big = Math.random() < 0.18; // noen store, uskarpe «bokeh»-lys
      const z = big ? rand(0.7, 1) : rand(0.2, 0.8);
      return {
        x: rand(0, hero.w), y: rand(0, hero.h), z,
        r: big ? rand(16, 34) : rand(2.5, 9),
        a: big ? rand(0.12, 0.26) : rand(0.35, 0.8),
        vy: -rand(0.12, 0.45) * (0.4 + z),
        t: Math.random() < 0.6 ? rand(0.65, 1) : rand(0.3, 0.7),
        ph: rand(0, Math.PI * 2),
        ox: 0, oy: 0,
      };
    });
  }

  function drawHero(time, dt) {
    const { ctx, w, h } = hero;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    const rect = hero.canvas.getBoundingClientRect();
    const mx = mouse.x - rect.left, my = mouse.y - rect.top;
    const inside = mx > 0 && my > 0 && mx < w && my < h;
    const px = inside ? (mx / w - 0.5) : 0, py = inside ? (my / h - 0.5) : 0;
    for (const p of hero.parts) {
      if (!reduce) {
        p.y += p.vy * dt;
        p.x += Math.sin(time * 0.0004 + p.ph) * 0.18 * dt;
        if (p.y < -p.r * 2) { p.y = h + p.r * 2; p.x = rand(0, w); }
        // Myk frastøtning fra musepekeren
        if (inside) {
          const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy, R = 130;
          if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 3; p.ox += (dx / d) * f; p.oy += (dy / d) * f; }
        }
        p.ox *= 0.92; p.oy *= 0.92;
      }
      const x = p.x + p.ox - px * 26 * p.z, y = p.y + p.oy - py * 18 * p.z;
      const twinkle = reduce ? 1 : 0.75 + 0.25 * Math.sin(time * 0.0015 + p.ph);
      const s = sprite(p.t), size = p.r * 2.6;
      ctx.globalAlpha = p.a * twinkle;
      ctx.drawImage(s.canvas, x - size, y - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // ---------- 2) Resten av siden ----------
  const pageCanvas = document.createElement("canvas");
  pageCanvas.className = "page-particles";
  pageCanvas.setAttribute("aria-hidden", "true");
  document.body.prepend(pageCanvas);
  const page = makeLayer(pageCanvas);
  let lastScroll = window.scrollY, vel = 0;

  function seedPage() {
    const n = clamp(Math.round((page.w * page.h) / 9500), 40, 150);
    page.parts = Array.from({ length: n }, () => ({
      x: rand(0, page.w),
      yb: rand(0, page.h + 80),        // grunnposisjon (før parallakse)
      z: rand(0.25, 1),                // dybde: nære partikler beveger seg raskere og er større
      th: Math.pow(Math.random(), 0.85), // når partikkelen dukker opp (andel av siden)
      r: rand(0.7, 2.1),
      t: Math.random(),
      ph: rand(0, Math.PI * 2),
      ox: 0, oy: 0, sx: 0, sy: 0,
    }));
  }

  function drawPage(time, dt) {
    const { ctx, w, h } = page;
    const sy = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - h);
    const prog = clamp(sy / max, 0, 1);
    // Utjevnet scrollhastighet (px per bilde)
    const raw = (sy - lastScroll) / Math.max(dt, 0.5);
    lastScroll = sy;
    vel += (raw - vel) * (1 - Math.pow(0.78, dt)); // tidsbasert utjevning
    if (Math.abs(vel) < 0.05) vel = 0;
    const v = reduce ? 0 : clamp(vel, -40, 40);

    ctx.clearRect(0, 0, w, h);
    const span = h + 80;
    const grow = 0.75 + 2.1 * prog;          // størrelse vokser nedover siden
    const reveal = 0.1 + prog * 1.05;         // andel synlige partikler vokser
    const link = (90 + 70 * prog);            // maks lengde på linjer

    for (const p of page.parts) {
      let y = ((p.yb - sy * p.z * 0.45) % span + span) % span - 40;
      let x = p.x + (reduce ? 0 : Math.sin(time * 0.00025 * (0.5 + p.z) + p.ph) * 14 * p.z);
      if (!reduce) {
        const dx = x - mouse.x, dy = y - mouse.y, d2 = dx * dx + dy * dy, R = 150;
        if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 2.4; p.ox += (dx / d) * f; p.oy += (dy / d) * f; }
        p.ox *= 0.93; p.oy *= 0.93;
      }
      p.sx = x + p.ox; p.sy = y + p.oy;
      p.vis = clamp((reveal - p.th) / 0.14, 0, 1);
    }

    // Linjer mellom nære partikler (stjernebilde) – blir tydeligere nedover
    if (prog > 0.04) {
      ctx.lineWidth = 0.7;
      const P = page.parts, L2 = link * link;
      for (let i = 0; i < P.length; i++) {
        const a = P[i]; if (a.vis < 0.3) continue;
        for (let j = i + 1; j < P.length; j++) {
          const b = P[j]; if (b.vis < 0.3 || Math.abs(a.z - b.z) > 0.35) continue;
          const dx = a.sx - b.sx, dy = a.sy - b.sy, d2 = dx * dx + dy * dy;
          if (d2 > L2) continue;
          const al = (1 - Math.sqrt(d2) / link) * 0.17 * Math.min(a.vis, b.vis) * Math.min(1, prog * 2.2) * (0.5 + a.z * 0.5);
          ctx.strokeStyle = `rgba(${sprite(clamp(a.t * 0.55 + prog * 0.6, 0, 1)).rgb},${al.toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
        }
      }
    }

    // Partiklene (glød + lysstripe ved rask scrolling)
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (const p of page.parts) {
      if (p.vis <= 0) continue;
      const tcol = clamp(p.t * 0.55 + prog * 0.6, 0, 1);
      const s = sprite(tcol);
      const r = p.r * p.z * grow;
      const tw = reduce ? 1 : 0.7 + 0.3 * Math.sin(time * 0.002 * (0.6 + p.z) + p.ph);
      const alpha = Math.min(1, p.vis * (0.28 + 0.47 * p.z) * tw * (1 + auroraLevel() * 1.4));
      const streak = Math.min(26, Math.abs(v) * p.z * 0.7);
      if (streak > 4) {
        ctx.strokeStyle = `rgba(${s.rgb},${(alpha * 0.3).toFixed(3)})`;
        ctx.lineWidth = Math.max(0.6, r * 0.9);
        ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p.sx, p.sy + Math.sign(v) * streak); ctx.stroke();
      }
      const size = r * 5;
      ctx.globalAlpha = alpha;
      ctx.drawImage(s.canvas, p.sx - size, p.sy - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // ---------- Påskeegg: nordlys ----------
  // Startes utenfra med window.LSParticles.aurora(). Tegnes som lysgardiner over hele siden.
  let auroraStart = 0, auroraEnd = 0;
  const AURORA_MS = 8000;
  // Bruker klokka direkte: tidsstempelet fra requestAnimationFrame kan ligge litt før start.
  function auroraLevel() {
    const t = performance.now();
    if (t >= auroraEnd || t < auroraStart) return 0;
    const k = (t - auroraStart) / (auroraEnd - auroraStart);
    return Math.min(1, k / 0.15, (1 - k) / 0.25); // myk inn og ut
  }
  // Ferdigtegnet gardin-sprite: gjennomsiktig topp, sterk farge, falmende bunn
  function curtain(rgb) {
    const c = document.createElement("canvas"); c.width = 4; c.height = 256;
    const g = c.getContext("2d"), grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, `rgba(${rgb},0)`);
    grd.addColorStop(0.18, `rgba(${rgb},0.9)`);
    grd.addColorStop(0.45, `rgba(${rgb},0.35)`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    return c;
  }
  // Grønt, turkis, gult, fiolett og en rosa underkant – som ekte nordlys, og synlig mot den grønne heroen
  const CURTAINS = [curtain("60,235,140"), curtain("70,225,215"), curtain("254,237,101"), curtain("150,110,255"), curtain("255,110,190")];
  const auroraCanvas = document.createElement("canvas");
  auroraCanvas.className = "aurora-layer";
  auroraCanvas.setAttribute("aria-hidden", "true");
  const actx = auroraCanvas.getContext("2d");
  let auroraRunning = false;
  function drawAurora(t) {
    const lvl = auroraLevel();
    const w = window.innerWidth, h = window.innerHeight;
    if (auroraCanvas.width !== Math.round(w * DPR)) { auroraCanvas.width = Math.round(w * DPR); auroraCanvas.height = Math.round(h * DPR); }
    actx.setTransform(DPR, 0, 0, DPR, 0, 0);
    actx.clearRect(0, 0, w, h);
    if (lvl <= 0) return false;
    actx.globalCompositeOperation = "lighter";
    const bands = [
      { y: 0.14, amp: 70, f: 0.0035, sp: 0.0007, c: 0, hgt: 0.55, a: 0.7 },
      { y: 0.24, amp: 55, f: 0.0052, sp: -0.0009, c: 1, hgt: 0.45, a: 0.55 },
      { y: 0.08, amp: 90, f: 0.0024, sp: 0.0005, c: 3, hgt: 0.55, a: 0.6 },
      { y: 0.40, amp: 45, f: 0.0061, sp: 0.0011, c: 4, hgt: 0.22, a: 0.45 },
      { y: 0.32, amp: 40, f: 0.0071, sp: 0.0012, c: 2, hgt: 0.3, a: 0.3 },
    ];
    const step = 6;
    for (const b of bands) {
      for (let x = -step; x < w + step; x += step) {
        const y = h * b.y + Math.sin(x * b.f + t * b.sp) * b.amp + Math.sin(x * b.f * 2.7 - t * b.sp * 1.6) * b.amp * 0.35;
        // Jevn, langsom variasjon i styrke (ingen striper), og overlappende strimler
        const shimmer = 0.6 + 0.4 * Math.sin(x * 0.006 + t * 0.0018 + b.y * 10);
        actx.globalAlpha = lvl * b.a * shimmer * 0.55;
        actx.drawImage(CURTAINS[b.c], x - step, y - 30, step * 3, h * b.hgt);
      }
    }
    actx.globalAlpha = 1;
    actx.globalCompositeOperation = "source-over";
    return true;
  }
  function auroraLoop(t) {
    if (drawAurora(t)) requestAnimationFrame(auroraLoop);
    else { auroraRunning = false; auroraCanvas.remove(); }
  }
  window.LSParticles = {
    aurora() {
      if (reduce) return false;
      const now = performance.now();
      auroraStart = now; auroraEnd = now + AURORA_MS;
      if (!auroraCanvas.isConnected) document.body.appendChild(auroraCanvas);
      drawAurora(now); // første bilde med en gang
      if (!auroraRunning) { auroraRunning = true; requestAnimationFrame(auroraLoop); }
      return true;
    },
  };

  // ---------- Størrelser ----------
  function resizeAll() {
    sizeLayer(page, window.innerWidth, window.innerHeight);
    seedPage();
    if (hero) {
      const r = hero.canvas.parentElement.getBoundingClientRect();
      sizeLayer(hero, r.width, r.height);
      seedHero();
    }
    if (reduce) frame(performance.now());
  }
  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resizeAll, 150); });

  if (hero && "IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero.canvas);
  }

  // ---------- Animasjonsløkke ----------
  let last = performance.now(), running = false;
  function frame(now) {
    const dt = clamp((now - last) / 16.67, 0.25, 3);
    last = now;
    if (hero && heroVisible) drawHero(now, dt);
    drawPage(now, dt);
  }
  function loop(now) {
    if (!running) return;
    frame(now);
    requestAnimationFrame(loop);
  }
  function start() { if (running || reduce) return; running = true; last = performance.now(); requestAnimationFrame(loop); }
  function stop() { running = false; }
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

  // Redusert bevegelse: tegn ett stillbilde, og oppdater bare ved scrolling
  if (reduce) {
    let queued = false;
    window.addEventListener("scroll", () => {
      if (queued) return; queued = true;
      requestAnimationFrame((t) => { queued = false; frame(t); });
    }, { passive: true });
  }

  resizeAll();
  start();
})();
