/* ============================================================
   AERION — Configuration
   All tuneable values in one place.
   ============================================================ */

const CONFIG = {
  /* ---- Design Tokens ---- */
  colors: {
    asphalt:   '#07080A',
    graphite:  '#121418',
    fog:       '#8A8F98',
    bone:      '#EDEAE4',
    xenon:     '#CFE3FF',
    taillight: '#E1251B',
    hairline:  'rgba(237,234,228,0.12)',
  },

  /* ---- Frame Sequences ---- */
  frameVersion: 3,   // bump after re-running rebuild_frames.py so browsers refetch frames
  hero: {
    frameCount: 572,
    path:       'assets/frames/hero/frame_',
    mobilePath: 'assets/frames/hero-mobile/frame_',
    height:     '600vh',    // wrapper height → scroll length
    preloadFirst: 40,       // load these frames before revealing the page

    /* chapter ranges (percentage of scroll) */
    chapters: [
      { start: 0.00, end: 0.12, id: 'hero-ch1' },
      { start: 0.22, end: 0.40, id: 'hero-ch2' },
      { start: 0.50, end: 0.68, id: 'hero-ch3' },
      { start: 0.78, end: 0.95, id: 'hero-ch4' },
    ],

    /* HUD speed/distance ranges */
    hud: {
      speed:    { min: 0,   max: 850 },   // km/h
      distance: { min: 0.0, max: 4.2 },   // km
    },

    /* fade-to-black over last N% of scroll */
    fadeOutStart: 0.96,
  },

  dismantle: {
    frameCount: 192,
    path:       'assets/frames/dismantle/frame_',
    mobilePath: 'assets/frames/dismantle-mobile/frame_',
    height:     '350vh',

    /* Callouts. Coordinates are in SOURCE-IMAGE pixels (imageSize below),
       so they stay locked to the plane whatever the viewport crop is.
       ax/ay = point on the part the arrow touches
       lx/ly = label card corner (top-left, or top-right when align:'right')
       bend  = arrow curvature direction (1 / -1) */
    imageSize: { w: 1600, h: 900 },
    calloutRevealProgress: 0.72,
    callouts: [
      { id: 'body',   ax: 880,  ay: 395, lx: 1340, ly: 175, align: 'left',  bend: -1 },
      { id: 'wings',  ax: 1260, ay: 452, lx: 1410, ly: 548, align: 'left',  bend: 1 },
      { id: 'engine', ax: 1150, ay: 592, lx: 1275, ly: 690, align: 'left',  bend: 1 },
      { id: 'light',  ax: 165,  ay: 506, lx: 26,   ly: 600, align: 'left',  bend: -1 },
    ],
  },

  /* ---- Lineup Section ---- */
  lineup: [
    {
      num: '01', name: 'GT-E', seats: 16, length: '38.2 m', delivery: '2028',
      tagline: 'The grand tourer of the skies.',
      range: '6400 km', speed: '850 km/h', engine: 'Twin engine',
      image: 'assets/aeroplanes/gt-e.webp',
      swatches: ['#2A2A2D', '#3D3936', '#1A1C22', '#0D0E10'],
    },
    {
      num: '02', name: 'S', seats: 12, length: '33.5 m', delivery: '2028',
      tagline: 'Executive aviation, refined.',
      range: '6000 km', speed: '820 km/h', engine: 'Twin engine',
      image: 'assets/aeroplanes/s.webp',
      swatches: ['#EDEAE4', '#C8C4BC', '#8A8F98', '#2A2A2D'],
    },
    {
      num: '03', name: 'X', seats: 10, length: '30.1 m', delivery: '2029',
      tagline: 'Higher, never heavier.',
      range: '5600 km', speed: '800 km/h', engine: 'Twin engine',
      image: 'assets/aeroplanes/x.webp',
      swatches: ['#0F1B2E', '#1A2840', '#2A3550', '#0A1420'],
    },
    {
      num: '04', name: 'R', seats: 8, length: '27.4 m', delivery: '2029',
      tagline: 'Built for performance.',
      range: '4200 km', speed: '900 km/h', engine: 'Twin engine',
      image: 'assets/aeroplanes/r.webp',
      swatches: ['#0D0E10', '#1A1A1A', '#E1251B', '#2A2A2D'],
    },
    {
      num: '05', name: 'ONE', seats: '—', length: '—', delivery: 'Concept',
      tagline: 'The future, early.',
      range: 'Concept', speed: '', engine: '',
      image: 'assets/aeroplanes/one.webp',
      swatches: ['#B8BCC4', '#8A8F98', '#CFE3FF', '#6A6E76'],
    },
  ],

  /* ---- Reduced-motion static frames (% of hero/dismantle) ---- */
  reducedMotion: {
    heroFrames:      [0, 0.35, 0.65, 1.0],
    dismantleFrames: [0, 1.0],
  },

  /* ---- Easing ---- */
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',

  /* ---- Cursor ---- */
  cursor: {
    dotSize:  6,
    ringSize: 28,
    barWidth: 44,
    barHeight: 2,
    lerp:     0.18,
  },

  /* ---- Grain ---- */
  grain: {
    tileSize:  128,
    opacity:   0.035,
    fps:       8,
  },
};
