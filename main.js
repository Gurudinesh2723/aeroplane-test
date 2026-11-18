/* ============================================================
   AERION — Main Script
   Vanilla JS: scroll-scrubbed canvas, custom cursor,
   film grain, lineup accordion, line reveals.
   ============================================================ */

(function () {
  'use strict';

  /* ---- Utilities ---- */
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const pad = (n, len) => String(n).padStart(len, '0');
  const isMobile = () => window.innerWidth < 768;
  const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  /* ---- State ---- */
  let pageRevealed = false;
  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const cursorPos = { x: mouse.x, y: mouse.y };
  let lastScrollY = 0;

  /* ============================================================
     FRAME SEQUENCE MANAGER
     Handles loading, caching and drawing for a canvas.
     ============================================================ */
  class FrameSequence {
    constructor(canvas, cfg) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cfg = cfg;
      this.frameCount = cfg.frameCount;
      this.frames = new Array(this.frameCount).fill(null);
      this.loaded = new Set();
      this.currentFrame = -1;
      this.smoothFrame = 0;
      this._resizeCanvas();
    }

    /** Get the right path prefix depending on viewport */
    _basePath() {
      return isMobile() ? this.cfg.mobilePath : this.cfg.path;
    }

    /** Frame number → file path */
    _framePath(i) {
      return this._basePath() + pad(i + 1, 4) + '.webp?v=' + (CONFIG.frameVersion || 1);
    }

    /** Load a single frame, return a promise */
    _loadFrame(i) {
      if (this.frames[i]) return Promise.resolve(this.frames[i]);
      return new Promise((resolve) => {
        const img = new Image();
        img.src = this._framePath(i);
        img.onload = () => {
          img.decode().then(() => {
            this.frames[i] = img;
            this.loaded.add(i);
            resolve(img);
          }).catch(() => {
            this.frames[i] = img;
            this.loaded.add(i);
            resolve(img);
          });
        };
        img.onerror = () => resolve(null);
      });
    }

    /** Load a range of frames sequentially, calling progress callback */
    async loadRange(start, end, onProgress) {
      for (let i = start; i <= end && i < this.frameCount; i++) {
        await this._loadFrame(i);
        if (onProgress) onProgress(i, end);
      }
    }

    /** Load remaining frames in background (after initial batch) */
    async loadRemaining(startAfter) {
      for (let i = startAfter; i < this.frameCount; i++) {
        await this._loadFrame(i);
      }
    }

    /** Resize the canvas for DPR */
    _resizeCanvas() {
      this.canvas.width = this.canvas.offsetWidth * dpr;
      this.canvas.height = this.canvas.offsetHeight * dpr;
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
    }

    /** Draw a specific frame index (cover or contain) */
    draw(frameIdx) {
      const idx = clamp(Math.round(frameIdx), 0, this.frameCount - 1);
      if (idx === this.currentFrame) return;
      this.currentFrame = idx;

      // Find nearest loaded frame if this one isn't ready
      let img = this.frames[idx];
      if (!img) {
        for (let d = 1; d < this.frameCount; d++) {
          if (this.frames[idx - d]) { img = this.frames[idx - d]; break; }
          if (this.frames[idx + d]) { img = this.frames[idx + d]; break; }
        }
      }
      if (!img) return;

      const ctx = this.ctx;
      const cw = this.canvas.width;
      const ch = this.canvas.height;
      ctx.clearRect(0, 0, cw, ch);

      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const isPortrait = window.innerHeight > window.innerWidth;

      let dw, dh, dx, dy;
      if (isPortrait) {
        // contain-fit, centred vertically
        const scale = Math.min(cw / iw, ch / ih);
        dw = iw * scale;
        dh = ih * scale;
        dx = (cw - dw) / 2;
        dy = (ch - dh) / 2;
      } else {
        // cover-fit
        const scale = Math.max(cw / iw, ch / ih);
        dw = iw * scale;
        dh = ih * scale;
        dx = (cw - dw) / 2;
        dy = (ch - dh) / 2;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, dx, dy, dw, dh);
    }

    /** Handle window resize */
    onResize() {
      this._resizeCanvas();
      if (this.currentFrame >= 0) {
        const saved = this.currentFrame;
        this.currentFrame = -1;
        this.draw(saved);
      }
    }
  }

  /* ============================================================
     PRELOADER
     ============================================================ */
  const preloader = $('#preloader');
  const preloadFill = $('#preload-fill');
  const preloadCounter = $('#preload-counter');

  function updatePreloader(pct) {
    const p = Math.round(clamp(pct, 0, 100));
    preloadFill.style.width = p + '%';
    preloadCounter.textContent = pad(p, 3);
  }

  function hidePreloader() {
    preloadFill.classList.add('bright');
    setTimeout(() => {
      preloader.classList.add('done');
      pageRevealed = true;
      // Trigger initial line reveals
      observeLineReveals();
      observeStatementWords();
      observeLineupEntrance();
      observeRevealUps();
    }, 300);
    setTimeout(() => {
      preloader.style.display = 'none';
    }, 1200);
  }

  /* ============================================================
     FILM GRAIN
     ============================================================ */
  function initGrain() {
    if (prefersReduced()) return;
    const grainCanvas = $('#grain');
    const ctx = grainCanvas.getContext('2d');
    const size = CONFIG.grain.tileSize;

    // Create a small noise tile
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = size;
    tileCanvas.height = size;
    const tileCtx = tileCanvas.getContext('2d');
    const imageData = tileCtx.createImageData(size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = Math.random() * 255;
      imageData.data[i] = v;
      imageData.data[i + 1] = v;
      imageData.data[i + 2] = v;
      imageData.data[i + 3] = 255;
    }
    tileCtx.putImageData(imageData, 0, 0);

    function resize() {
      grainCanvas.width = window.innerWidth;
      grainCanvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Redraw grain at ~8fps
    setInterval(() => {
      ctx.clearRect(0, 0, grainCanvas.width, grainCanvas.height);
      const ox = Math.random() * size;
      const oy = Math.random() * size;
      for (let x = -size; x < grainCanvas.width + size; x += size) {
        for (let y = -size; y < grainCanvas.height + size; y += size) {
          ctx.drawImage(tileCanvas, x + ox, y + oy);
        }
      }
    }, 1000 / CONFIG.grain.fps);
  }

  /* ============================================================
     CUSTOM CURSOR
     ============================================================ */
  function initCursor() {
    // Custom cursor disabled — standard browser cursor used
  }

  /* ============================================================
     NAV — hide/show on scroll
     ============================================================ */
  function initNav() {
    const nav = $('#nav');
    let ticking = false;

    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y > lastScrollY && y > 100) {
          nav.classList.add('hidden');
        } else {
          nav.classList.remove('hidden');
        }
        lastScrollY = y;
        ticking = false;
      });
    });
  }

  /* ============================================================
     SCROLL PROGRESS HELPER
     Returns 0–1 based on how far a wrapper has scrolled.
     ============================================================ */
  function getScrollProgress(wrapper) {
    const rect = wrapper.getBoundingClientRect();
    const scrollDist = wrapper.offsetHeight - window.innerHeight;
    if (scrollDist <= 0) return 0;
    return clamp(-rect.top / scrollDist, 0, 1);
  }

  /* ============================================================
     HERO SECTION
     ============================================================ */
  let heroSeq;

  function initHero() {
    const wrapper = $('#hero-wrapper');
    const canvas = $('#hero-canvas');
    const fade = $('#hero-fade');
    const progressLine = $('#hero-progress');

    wrapper.style.height = CONFIG.hero.height;
    heroSeq = new FrameSequence(canvas, CONFIG.hero);

    // Store for RAF loop
    heroSeq._wrapper = wrapper;
    heroSeq._fade = fade;
    heroSeq._progressLine = progressLine;
  }

  function updateHero() {
    if (!heroSeq) return;
    const progress = getScrollProgress(heroSeq._wrapper);

    // Smooth frame interpolation
    const targetFrame = progress * (heroSeq.frameCount - 1);
    heroSeq.smoothFrame = lerp(heroSeq.smoothFrame, targetFrame, 0.15);
    heroSeq.draw(Math.round(heroSeq.smoothFrame));

    // Progress line
    heroSeq._progressLine.style.width = (progress * 100) + '%';

    // Fade-to-black
    if (progress >= CONFIG.hero.fadeOutStart) {
      const fadeP = (progress - CONFIG.hero.fadeOutStart) / (1 - CONFIG.hero.fadeOutStart);
      heroSeq._fade.style.opacity = fadeP;
    } else {
      heroSeq._fade.style.opacity = 0;
    }

    // Chapters visibility
    CONFIG.hero.chapters.forEach((ch, i) => {
      const el = document.getElementById(ch.id);
      if (!el) return;
      const visible = progress >= ch.start && progress <= ch.end;
      el.classList.toggle('visible', visible);

      // Trigger line reveals within visible chapters
      if (visible) {
        $$('.line-reveal', el).forEach((lr) => lr.classList.add('revealed'));
      }
    });

    // Lift the dark final shot so the GT-E reads clearly
    const lift = clamp((progress - 0.70) / 0.08, 0, 1);
    const filter = lift > 0 ? `brightness(${(1 + 0.45 * lift).toFixed(3)}) contrast(${(1 + 0.08 * lift).toFixed(3)})` : '';
    if (heroSeq.canvas.style.filter !== filter) heroSeq.canvas.style.filter = filter;

    // Count-up stats when chapter 4 appears
    const ch4 = CONFIG.hero.chapters[3];
    if (progress >= ch4.start && !heroSeq._counted) {
      heroSeq._counted = true;
      runCountUps($('#hero-ch4'));
    } else if (progress < ch4.start - 0.05 && heroSeq._counted) {
      heroSeq._counted = false;
      $$('#hero-ch4 .count').forEach(el => { el.textContent = '0'; });
    }

    // HUD
    updateHUD(progress);
  }

  function formatCount(n, fmt) {
    return fmt === 'comma' ? n.toLocaleString('en-US') : String(n);
  }

  function runCountUps(root) {
    $$('.count', root).forEach((el, i) => {
      const target = Number(el.dataset.target) || 0;
      const fmt = el.dataset.format;
      if (prefersReduced()) { el.textContent = formatCount(target, fmt); return; }
      const dur = 1400, start = performance.now() + i * 120;
      const step = (now) => {
        const t = clamp((now - start) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = formatCount(Math.round(target * eased), fmt);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function updateHUD(progress) {
    // Chapter ticks
    const ticks = $$('#hud-chapters .tick');
    // Current chapter = last one whose start we've passed (stays lit between chapters)
    let current = 0;
    CONFIG.hero.chapters.forEach((ch, i) => { if (progress >= ch.start) current = i; });
    ticks.forEach((t, i) => t.classList.toggle('active', i === current));
    const countEl = $('#hud-count');
    if (countEl) countEl.textContent = pad(current + 1, 2);

    // Speed
    const speed = Math.round(lerp(CONFIG.hero.hud.speed.min, CONFIG.hero.hud.speed.max, progress));
    const speedEl = $('#hud-speed');
    if (speedEl) speedEl.textContent = pad(speed, 3);

    // Distance
    const dist = lerp(CONFIG.hero.hud.distance.min, CONFIG.hero.hud.distance.max, progress);
    const distEl = $('#hud-distance');
    if (distEl) distEl.textContent = dist.toFixed(1);
  }

  /* ============================================================
     STATEMENT SECTION — word-by-word opacity
     ============================================================ */
  function initStatement() {
    const container = $('#statement-text');
    const text = 'Every part was designed to disappear into one line of light.';
    const words = text.split(' ');
    container.innerHTML = words.map(w =>
      `<span class="statement-word">${w}</span> `
    ).join('');
  }

  function observeStatementWords() {
    const section = $('#statement');
    if (!section) return;

    const words = $$('.statement-word', section);
    if (!words.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Drive word opacity by scroll position within section
          const updateWords = () => {
            const rect = section.getBoundingClientRect();
            const sectionProgress = clamp(
              1 - (rect.bottom / (window.innerHeight + rect.height)),
              0, 1
            );
            words.forEach((w, i) => {
              const wordThreshold = i / words.length;
              const wordProgress = clamp((sectionProgress - wordThreshold * 0.6) / 0.3, 0, 1);
              if (wordProgress > 0.5) {
                w.classList.add('lit');
              } else {
                w.classList.remove('lit');
              }
            });
          };
          // Check on scroll
          window.addEventListener('scroll', updateWords, { passive: true });
          updateWords();
        }
      });
    }, { threshold: 0.1 });

    observer.observe(section);
  }

  /* ============================================================
     DISMANTLE SECTION
     ============================================================ */
  let dismantleSeq;

  function initDismantle() {
    const wrapper = $('#dismantle-wrapper');
    const canvas = $('#dismantle-canvas');
    const progressLine = $('#dismantle-progress');

    wrapper.style.height = CONFIG.dismantle.height;
    dismantleSeq = new FrameSequence(canvas, CONFIG.dismantle);

    dismantleSeq._wrapper = wrapper;
    dismantleSeq._progressLine = progressLine;

    layoutCallouts();
    // Fonts change card sizes; re-layout once they're ready
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutCallouts);
  }

  /* Map source-image coords to stage pixels using the same fit as FrameSequence.draw */
  function layoutCallouts() {
    const stage = $('#dismantle-stage');
    const group = $('#callout-arrows');
    const svg = $('#callout-svg');
    if (!stage || !group || !svg) return;

    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const { w: iw, h: ih } = CONFIG.dismantle.imageSize;
    const portrait = window.innerHeight > window.innerWidth;
    const s = portrait ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
    const ox = (W - iw * s) / 2;
    const oy = (H - ih * s) / 2;
    const map = (x, y) => ({ x: ox + x * s, y: oy + y * s });

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const pad = W < 768 ? 10 : 20;
    const topLimit = 84; // keep clear of the nav
    let out = '';

    CONFIG.dismantle.callouts.forEach((c, i) => {
      const el = document.getElementById('callout-' + c.id);
      if (!el) return;
      const a = map(c.ax, c.ay);
      const l = map(c.lx, c.ly);
      const bw = el.offsetWidth;
      const bh = el.offsetHeight;

      let left = c.align === 'right' ? l.x - bw : l.x;
      let top = l.y;
      left = clamp(left, pad, W - bw - pad);
      top = clamp(top, topLimit, H - bh - pad);
      el.style.left = left + 'px';
      el.style.top = top + 'px';

      // Start point: where the line from card centre to anchor leaves the card
      const cx = left + bw / 2, cy = top + bh / 2;
      let dx = a.x - cx, dy = a.y - cy;
      const t = Math.min(
        dx !== 0 ? (bw / 2) / Math.abs(dx) : Infinity,
        dy !== 0 ? (bh / 2) / Math.abs(dy) : Infinity
      );
      const sx = cx + dx * t, sy = cy + dy * t;

      // Curved path with a perpendicular bend
      dx = a.x - sx; dy = a.y - sy;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const bend = (c.bend || 1) * Math.min(len * 0.22, 70);
      const qx = (sx + a.x) / 2 + nx * bend;
      const qy = (sy + a.y) / 2 + ny * bend;

      // Arrowhead: 3D cone ending just short of the anchor node
      let tx = a.x - qx, ty = a.y - qy;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      const px = -ty, py = tx;
      const tipX = a.x - tx * 9, tipY = a.y - ty * 9;
      const coneL = 18, coneW = 7.5;
      const bx = tipX - tx * coneL, by = tipY - ty * coneL;
      const lx = bx + px * coneW, ly = by + py * coneW;
      const rx = bx - px * coneW, ry = by - py * coneW;
      const f = n => n.toFixed(1);
      const d = `M${f(sx)},${f(sy)} Q${f(qx)},${f(qy)} ${f(bx)},${f(by)}`;
      const angle = Math.atan2(ty, tx) * 180 / Math.PI;

      out += `
        <g class="cl-arrow" style="--delay:${i * 0.15}s">
          <g filter="url(#cl-shadow)">
            <path class="cl-tube" pathLength="1" d="${d}" stroke="#3A2A10" stroke-width="5.5"/>
            <path class="cl-tube" pathLength="1" d="${d}" stroke="#B88A3E" stroke-width="3.6"/>
            <path class="cl-tube" pathLength="1" d="${d}" stroke="#F5DDA6" stroke-width="1.1" transform="translate(${f(-px * 0.9)},${f(-py * 0.9)})"/>
            <g class="cl-head">
              <polygon points="${f(tipX)},${f(tipY)} ${f(lx)},${f(ly)} ${f(bx)},${f(by)}" fill="#F3D79A"/>
              <polygon points="${f(tipX)},${f(tipY)} ${f(bx)},${f(by)} ${f(rx)},${f(ry)}" fill="#7A5A24"/>
              <ellipse cx="${f(bx)}" cy="${f(by)}" rx="2.6" ry="${coneW}" transform="rotate(${f(angle)} ${f(bx)} ${f(by)})" fill="#4A3512"/>
            </g>
            <circle class="cl-ball" cx="${f(sx)}" cy="${f(sy)}" r="4.5" fill="url(#cl-ball)"/>
          </g>
          <g class="cl-node">
            <circle class="cl-pulse" cx="${f(a.x)}" cy="${f(a.y)}" r="7"/>
            <circle cx="${f(a.x)}" cy="${f(a.y)}" r="5.5" fill="url(#cl-node)" stroke="#07080A" stroke-width="1.5"/>
          </g>
        </g>`;
    });

    group.innerHTML = out;
  }

  function updateDismantle() {
    if (!dismantleSeq) return;
    const progress = getScrollProgress(dismantleSeq._wrapper);

    const targetFrame = progress * (dismantleSeq.frameCount - 1);
    dismantleSeq.smoothFrame = lerp(dismantleSeq.smoothFrame, targetFrame, 0.15);
    dismantleSeq.draw(Math.round(dismantleSeq.smoothFrame));

    dismantleSeq._progressLine.style.width = (progress * 100) + '%';

    // Callouts
    const calloutThreshold = CONFIG.dismantle.calloutRevealProgress;
    const callouts = $$('.callout');
    const showCallouts = progress >= calloutThreshold;
    callouts.forEach(c => {
      c.classList.toggle('visible', showCallouts);
    });
    const calloutSvg = $('#callout-svg');
    if (calloutSvg) calloutSvg.classList.toggle('visible', showCallouts);

    // Section title line reveal
    if (progress > 0.05) {
      $$('#dismantle-wrapper .line-reveal').forEach(lr => lr.classList.add('revealed'));
    }
  }

  /* ============================================================
     LINEUP SECTION — hover accordion
     ============================================================ */
  function initLineup() {
    const container = $('#lineup-container');
    if (!container) return;

    let hoverTimeout = null;
    let currentOpen = 0; // GT-E open by default

    CONFIG.lineup.forEach((item, i) => {
      const slide = document.createElement('button');
      slide.className = 'lineup-slide';
      slide.setAttribute('role', 'tab');
      slide.setAttribute('aria-expanded', i === currentOpen ? 'true' : 'false');
      slide.setAttribute('aria-label', `${item.name} — ${item.tagline}`);
      slide.style.setProperty('--stagger', (i * 0.08) + 's');

      slide.innerHTML = `
        <div class="slide-image-bg">
          <img src="${item.image}" alt="${item.name} aeroplane" loading="lazy" width="1600" height="900">
        </div>
        <span class="slide-num font-mono">${item.num}</span>
        <span class="slide-name-rotated font-mono">${item.name}</span>
        <div class="slide-content">
          <h3 class="font-display--sm model-name">${item.name}</h3>
          <p class="font-body tagline">${item.tagline}</p>
          ${item.range !== 'Concept' ? `
            <div class="spec-row font-mono">
              <span>${item.range}</span>
              <span>&middot;</span>
              <span>${item.speed}</span>
              <span>&middot;</span>
              <span>${item.engine}</span>
            </div>
          ` : '<div class="spec-row font-mono"><span>Concept</span></div>'}
          <div class="swatch-row">
            ${item.swatches.map((s, si) =>
              `<div class="swatch ${si === 0 ? 'active' : ''}" style="background:${s};" aria-label="Color ${si + 1}"></div>`
            ).join('')}
          </div>
          <a href="#reserve" class="configure-link" data-cursor="CONFIGURE">Configure &rarr;</a>
        </div>
      `;

      // Hover / click handler
      const openSlide = () => {
        $$('.lineup-slide', container).forEach((s, si) => {
          s.setAttribute('aria-expanded', si === i ? 'true' : 'false');
        });
        currentOpen = i;
      };

      // Desktop: hover with debounce
      slide.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(openSlide, 80);
      });

      // Touch/keyboard
      slide.addEventListener('click', (e) => {
        e.preventDefault();
        openSlide();
      });

      // Keyboard nav
      slide.addEventListener('keydown', (e) => {
        const slides = $$('.lineup-slide', container);
        let targetIdx = i;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          targetIdx = (i + 1) % slides.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          targetIdx = (i - 1 + slides.length) % slides.length;
        } else {
          return;
        }
        e.preventDefault();
        slides[targetIdx].focus();
        slides.forEach((s, si) => {
          s.setAttribute('aria-expanded', si === targetIdx ? 'true' : 'false');
        });
        currentOpen = targetIdx;
      });

      container.appendChild(slide);
    });
  }

  function observeLineupEntrance() {
    const container = $('#lineup-container');
    if (!container) return;
    const slides = $$('.lineup-slide', container);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          slides.forEach(s => s.classList.add('entered'));
          observer.disconnect();
        }
      });
    }, { threshold: 0.1 });

    observer.observe(container);
  }

  /* ============================================================
     LINE REVEAL — IntersectionObserver
     ============================================================ */
  function observeLineReveals() {
    const reveals = $$('.line-reveal');

    // For elements NOT inside pinned sections, use IntersectionObserver
    reveals.forEach((el, i) => {
      const inPinned = el.closest('.pinned-wrapper');
      if (inPinned) return; // These are driven by scroll progress

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Stagger within parent
            const siblings = $$('.line-reveal', el.parentElement);
            const idx = siblings.indexOf(el);
            setTimeout(() => el.classList.add('revealed'), idx * 80);
            observer.unobserve(el);
          }
        });
      }, { threshold: 0.2 });

      observer.observe(el);
    });
  }

  /* ============================================================
     CABIN — staggered reveal of feature items
     ============================================================ */
  function observeRevealUps() {
    const items = $$('.reveal-up');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const idx = items.indexOf(entry.target);
        entry.target.style.transitionDelay = ((idx % 4) * 0.1) + 's';
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.2 });
    items.forEach(el => observer.observe(el));
  }

  /* ============================================================
     SPECS COMPARISON TABLE
     ============================================================ */
  function initSpecs() {
    const table = $('#specs-table');
    if (!table) return;
    const rows = [
      ['Range',        m => m.range],
      ['Cruise speed', m => m.speed || '—'],
      ['Engines',      m => m.engine || '—'],
      ['Seats',        m => m.seats],
      ['Length',       m => m.length],
      ['Delivery',     m => m.delivery],
    ];
    const models = CONFIG.lineup;
    table.innerHTML = `
      <thead><tr><th class="font-mono">Model</th>${models.map((m, i) =>
        `<th><a href="#lineup" data-open-model="${i}">${m.name}</a></th>`).join('')}</tr></thead>
      <tbody>${rows.map(([label, get]) => `
        <tr><th class="font-mono" scope="row">${label}</th>${models.map(m => `<td>${get(m)}</td>`).join('')}</tr>`).join('')}
      </tbody>`;
  }

  /* ============================================================
     MODEL LINKS — open a lineup slide / preselect in the form
     ============================================================ */
  function openLineupSlide(i) {
    $$('#lineup-container .lineup-slide').forEach((s, si) => {
      s.setAttribute('aria-expanded', si === i ? 'true' : 'false');
    });
  }

  function initModelLinks() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-open-model]');
      if (link) openLineupSlide(Number(link.dataset.openModel));

      // "Configure" inside a lineup slide preselects that model in the form
      const configure = e.target.closest('.configure-link');
      if (configure) {
        const slides = $$('#lineup-container .lineup-slide');
        const idx = slides.indexOf(configure.closest('.lineup-slide'));
        const select = $('#rf-model');
        if (select && idx >= 0) select.value = CONFIG.lineup[idx].name;
      }
    });
  }

  /* ============================================================
     RESERVE FORM (front-end only: no data is sent anywhere)
     ============================================================ */
  function initReserveForm() {
    const form = $('#reserve-form');
    const select = $('#rf-model');
    const msg = $('#form-msg');
    if (!form || !select) return;

    select.innerHTML = '<option value="" disabled selected>Choose a model</option>' +
      CONFIG.lineup.map(m => `<option value="${m.name}">AERION ${m.name}</option>`).join('');

    const viewing = $('#btn-viewing');
    let mode = 'reserve';
    if (viewing) viewing.addEventListener('click', (e) => {
      e.preventDefault();
      mode = 'viewing';
      form.requestSubmit();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameEl = form.elements.name;
      const emailEl = form.elements.email;
      const name = nameEl.value.trim();
      const email = emailEl.value.trim();
      const model = select.value;
      form.querySelectorAll('.field').forEach(f => f.classList.remove('invalid'));

      const bad = [];
      if (!name) bad.push(nameEl);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad.push(emailEl);
      if (!model) bad.push(select);
      if (bad.length) {
        bad.forEach(el => el.closest('.field').classList.add('invalid'));
        bad[0].focus();
        msg.textContent = 'Please complete the highlighted fields.';
        msg.className = 'form-msg font-mono error';
        mode = 'reserve';
        return;
      }

      const first = name.split(' ')[0];
      msg.textContent = mode === 'viewing'
        ? `Thank you, ${first}. Our team will contact you to arrange a private viewing of the AERION ${model}.`
        : `Thank you, ${first}. Your AERION ${model} reservation request has been received.`;
      msg.className = 'form-msg font-mono success';
      mode = 'reserve';
    });
  }

  /* ============================================================
     RESIZE HANDLER
     ============================================================ */
  function onResize() {
    if (heroSeq) heroSeq.onResize();
    if (dismantleSeq) dismantleSeq.onResize();
    layoutCallouts();
  }

  /* ============================================================
     MAIN ANIMATION LOOP
     ============================================================ */
  function tick() {
    requestAnimationFrame(tick);
    if (!pageRevealed) return;

    updateHero();
    updateDismantle();

    // Cursor
    const cursor = $('#cursor');
    if (cursor && cursor._update) cursor._update();
  }

  /* ============================================================
     REDUCED MOTION — static frames
     ============================================================ */
  function initReducedMotion() {
    // Show static frames instead of scroll-scrubbed sequences
    const heroWrapper = $('#hero-wrapper');
    const dismantleWrapper = $('#dismantle-wrapper');

    if (heroWrapper) heroWrapper.style.height = 'auto';
    if (dismantleWrapper) dismantleWrapper.style.height = 'auto';

    // Show first hero frame
    if (heroSeq && heroSeq.frameCount > 0) {
      heroSeq.draw(0);
    }
    if (dismantleSeq && dismantleSeq.frameCount > 0) {
      dismantleSeq.draw(0);
    }

    // Show all chapters
    $$('.hero-chapter').forEach(ch => ch.classList.add('visible'));
    $$('.line-reveal').forEach(lr => lr.classList.add('revealed'));
    $$('.callout').forEach(c => c.classList.add('visible'));
    $$('.reveal-up').forEach(el => el.classList.add('in'));
    runCountUps($('#hero-ch4'));
    const calloutSvg = $('#callout-svg');
    if (calloutSvg) calloutSvg.classList.add('visible');
  }

  /* ============================================================
     INIT
     ============================================================ */
  async function init() {
    initStatement();
    initHero();
    initDismantle();
    initLineup();
    initSpecs();
    initReserveForm();
    initModelLinks();
    initGrain();
    initCursor();
    initNav();

    // Start the RAF loop
    requestAnimationFrame(tick);
    window.addEventListener('resize', onResize);

    // Handle reduced motion
    if (prefersReduced()) {
      // Load just the key frames
      await heroSeq._loadFrame(0);
      await dismantleSeq._loadFrame(0);
      hidePreloader();
      initReducedMotion();
      return;
    }

    // Load first batch of hero frames (for preloader)
    const firstBatch = CONFIG.hero.preloadFirst;
    await heroSeq.loadRange(0, firstBatch - 1, (i) => {
      const pct = ((i + 1) / firstBatch) * 100;
      updatePreloader(pct);
    });

    // Draw the first frame immediately
    heroSeq.draw(0);

    // Reveal the page
    hidePreloader();

    // Continue loading remaining hero frames in background
    await heroSeq.loadRemaining(firstBatch);

    // Then load dismantle frames
    await dismantleSeq.loadRange(0, dismantleSeq.frameCount - 1);
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
