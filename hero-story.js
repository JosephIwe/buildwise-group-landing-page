/*
 * Hero story: three articulated silhouettes turn a problem into a delivered system.
 * One playhead drives everything. Autoplay advances it; scrolling through the hero
 * pushes it forward or rewinds it proportionally, so the two never fight.
 */
(() => {
  const stage = document.getElementById('heroStage');
  const svg = document.getElementById('story');
  const img = document.getElementById('heroImg');
  if (!stage || !svg || !img || !('requestAnimationFrame' in window)) return;

  const NS = 'http://www.w3.org/2000/svg';
  const root = document.documentElement;
  const wrap = document.querySelector('.hero-wrap');
  const toggle = document.getElementById('storyToggle');
  const toggleText = document.getElementById('storyToggleText');
  const railItems = [...document.querySelectorAll('#storyRail li')];
  const reduceQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopQ = window.matchMedia('(min-width: 900px)');

  const T = 26;
  const CHAPTERS = [0, 9, 13.6, 20.4, T];
  const $ = id => document.getElementById(id);

  /* ---------- Timing helpers ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const EASE = {
    io: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    out: k => 1 - Math.pow(1 - k, 3),
    in: k => k * k * k,
    sine: k => -(Math.cos(Math.PI * k) - 1) / 2,
    lin: k => k
  };
  // Keyframes: [[time, value, easeIntoThisKey?], ...]
  const track = keys => t => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        return v0 + (v1 - v0) * EASE[e || 'io']((t - t0) / (t1 - t0 || 1));
      }
    }
    return keys[keys.length - 1][1];
  };
  const rot = (x, y, deg) => {
    const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return [x * c - y * s, x * s + y * c];
  };
  const el = (name, attrs = {}, parent) => {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  };

  /* ---------- Cast ---------- */
  // Rig units: feet at y=0, facing +x. Angles in degrees, forward positive.
  const RIG = { hip: 84, thigh: 42, shin: 42, shoulder: -50, upper: 30, fore: 28 };
  // Torso paths are drawn around the hip (0,0), shoulders near y=-54, chest facing +x.
  const BUILDS = {
    suit: {
      torso: 'M-8.5 7C-9.5 -8 -11.5 -26 -11.5 -42C-11.5 -51 -6 -55.5 0 -55.5C7.5 -55.5 12.5 -51 12.5 -43C12.5 -30 10.5 -12 9.5 7Z',
      leg: [13, 11, 8.6], arm: [8.4, 7, 5.6], hip: 3.6, head: [8.6, 10.4], foot: 'M-4 -3.5H8Q12.5 -3.5 12.5 0.5H-4.5Z', hair: ''
    },
    lean: {
      torso: 'M-8 8C-9 -8 -11 -27 -11 -42C-11 -51 -5.5 -55 0 -55C7 -55 12 -51 12 -43C12 -30 10 -12 9 8Z',
      leg: [12.4, 10.4, 8.2], arm: [8, 6.8, 5.4], hip: 3.4, head: [8.4, 10.2], foot: 'M-4 -3.5H8Q12.5 -3.5 12.5 0.5H-4.5Z', hair: ''
    },
    blazer: {
      torso: 'M-8.5 9C-8 -6 -9 -26 -9.5 -40C-10 -50 -5 -53.5 0 -53.5C6.5 -53.5 10.5 -50 10 -41C9.5 -28 9.5 -8 9 9Z',
      leg: [10.6, 8.6, 6.6], arm: [7, 6, 4.8], hip: 3, head: [7.8, 9.6], foot: 'M-2.5 -4L8 -1.2L9 1H-3.5Z',
      hair: 'M-9.2 -6Q-9 -20.5 1 -21Q10 -20.5 9.4 -9Q5 -14 -3 -10.5L-5.5 0.5Q-10 -0.5 -9.2 -6Z'
    }
  };

  const CAST = {
    a: {
      build: 'suit', swingArms: t => t > 12 ? 1 : 0,
      x: track([[0, 770], [1.6, 770], [6.2, 1060], [7.9, 1060], [9.3, 1108], [22.4, 1108], [24.4, 1074]]),
      y: track([[0, 748], [6.2, 752], [9.3, 754]]),
      face: () => 1,
      nS: track([[0, 16], [9.3, 16], [10.5, 62], [11.7, 62], [12.6, 6], [13.2, 6], [13.8, 30], [14.6, 30], [15.4, 6], [17.6, 6], [18.4, 34], [19.8, 34], [20.6, 6]]),
      nE: track([[0, 74], [9.3, 74], [10.5, 22], [11.7, 22], [12.6, 10], [13.2, 10], [13.8, 55], [14.6, 55], [15.4, 10], [17.6, 10], [18.4, 48], [19.8, 48], [20.6, 10]]),
      fS: track([[0, 12], [9.3, 12], [10.5, 56], [11.6, 56], [12.4, -4]]),
      fE: track([[0, 78], [9.3, 78], [10.5, 28], [11.6, 28], [12.4, 12]]),
      head: track([[0, 4], [6.3, 4], [6.9, -14], [7.4, -14], [7.9, -4], [8.3, 6], [10, 2], [12.8, 10], [17.6, 6], [18.4, 14], [19.6, 4], [20.6, -6], [21.6, -6], [23, 4]]),
      lean: track([[0, 2], [9.3, 2], [10.5, 7], [11.7, 7], [12.6, 1], [17.6, 1], [18.4, 6], [20.6, 1]])
    },
    b: {
      build: 'lean', swingArms: () => 0,
      x: track([[0, 1238], [8.6, 1238], [9.6, 1214], [11.7, 1214], [12.7, 1230], [22.4, 1230], [24.2, 1250]]),
      y: () => 757,
      face: track([[0, 1], [7.5, 1], [8.5, -1]]),
      nS: track([[0, 4], [9.6, 4], [10.8, 58], [11.7, 58], [12.7, 30], [18, 30], [18.8, 44], [19.4, 44], [20.4, 14], [22.4, 8]]),
      nE: track([[0, 8], [9.6, 8], [10.8, 18], [11.7, 18], [12.7, 82], [18, 82], [18.8, 70], [19.4, 70], [20.4, 30], [22.4, 12]]),
      fS: track([[0, -3], [10, -3], [11, 48], [11.7, 48], [12.7, 26], [18, 26], [18.8, 40], [19.4, 40], [20.4, 6]]),
      fE: track([[0, 10], [10, 10], [11, 24], [11.7, 24], [12.7, 86], [18, 86], [18.8, 72], [19.4, 72], [20.4, 16]]),
      head: track([[0, -2], [7.5, -2], [8.6, 4], [11.7, 6], [12.5, 18], [13.6, 14], [17.6, 14], [18.6, 10], [19.5, -6], [21, -10], [22.6, 2]]),
      lean: track([[0, 0], [9.6, 0], [10.8, 6], [11.7, 6], [12.3, -3], [12.9, 1], [17.6, 1], [18.4, 4], [19.6, -2], [22.6, 0]])
    },
    c: {
      build: 'blazer', swingArms: () => 1,
      x: track([[0, 1720], [13.4, 1720], [17.2, 1300, 'out'], [22.6, 1300], [24.4, 1316]]),
      y: () => 761,
      face: () => -1,
      nS: track([[0, 4], [18, 4], [18.8, 36], [19.8, 36], [20.6, 4]]),
      nE: track([[0, 8], [18, 8], [18.8, 52], [19.8, 52], [20.6, 8]]),
      fS: () => -3,
      fE: () => 10,
      head: track([[0, 0], [17.2, 0], [17.9, 12], [19.4, 8], [19.9, -8], [21.6, -8], [22.3, 8], [22.7, 2], [23.1, 8], [23.6, 2]]),
      lean: track([[0, 0], [17.2, 0], [17.9, 5], [19.6, 2], [20.2, -1], [22.6, 0]])
    }
  };

  const castLayer = $('stCast');
  const shadowLayer = $('stShadows');
  const reflLayer = $('stReflections');
  const INK = '#0B0C0E';

  // Tapered limb segment from width w1 to w2 over length len, with rounded joints.
  const taper = (w1, w2, len) => `M${-w1 / 2} 0L${-w2 / 2} ${len}A${w2 / 2} ${w2 / 2} 0 0 0 ${w2 / 2} ${len}L${w1 / 2} 0A${w1 / 2} ${w1 / 2} 0 0 0 ${-w1 / 2} 0Z`;
  const buildLimb = (parent, w, l1, l2, foot) => {
    const top = el('g', {}, parent);
    el('path', { d: taper(w[0], w[1], l1), fill: INK }, top);
    const joint = el('g', {}, top);
    el('path', { d: taper(w[1], w[2], l2), fill: INK }, joint);
    if (foot) el('path', { d: foot, fill: INK, transform: `translate(0 ${l2})` }, joint);
    else el('ellipse', { cx: 0.6, cy: l2 + 2.2, rx: w[2] * 0.62, ry: w[2] * 0.85, fill: INK }, joint);
    return { top, joint };
  };

  for (const id in CAST) {
    const c = CAST[id];
    const b = BUILDS[c.build];
    const g = el('g', { id: `ch-${id}` }, castLayer);
    const legF = buildLimb(g, b.leg, RIG.thigh, RIG.shin, b.foot);
    const legN = buildLimb(g, b.leg, RIG.thigh, RIG.shin, b.foot);
    const upper = el('g', {}, g);
    const armF = buildLimb(upper, b.arm, RIG.upper, RIG.fore);
    el('path', { d: b.torso, fill: INK }, upper);
    el('path', { d: 'M-3.6 -50L-3.2 -60H4.4L4.8 -50Z', fill: INK }, upper);
    const head = el('g', {}, upper);
    el('ellipse', { cx: 1.4, cy: -10.5, rx: b.head[0], ry: b.head[1], fill: INK }, head);
    el('path', { d: `M${b.head[0] - 0.4} -13L${b.head[0] + 2.6} -9.2L${b.head[0]} -7.8Z`, fill: INK }, head);
    if (b.hair) {
      el('path', { d: b.hair, fill: INK }, head);
      el('circle', { cx: -7.6, cy: -15.5, r: 4.6, fill: INK }, head);
    }
    const armN = buildLimb(upper, b.arm, RIG.upper, RIG.fore);
    c.hipW = b.hip;
    c.node = { g, legF, legN, upper, armF, armN, head };
    c.shadow = el('ellipse', { rx: 20, ry: 3.2, fill: '#000', opacity: 0.55 }, shadowLayer);
    c.cast = el('path', { fill: 'url(#st-shadow)', opacity: 0.45 }, shadowLayer);
    c.refl = el('use', { href: `#ch-${id}` }, reflLayer);
  }

  /* ---------- Object, lines, light ---------- */
  const obj = $('stObject');
  const objGlow = $('stObjGlow');
  const tablet = $('stTablet');
  const form = $('stForm');
  const objFloor = $('stObjFloor');
  const veil = $('stVeil');
  const halo = $('stHalo');
  const shaft = $('stShaft');
  const aperture = $('stAperture');
  const linesG = $('stLines');

  const FLOAT = { x: 1176, y: 604 };
  const staticLines = [
    { d: 'M1072 762L1176 744L1290 762L1176 782Z', from: 14.2, to: 16.6, rest: 0.35 },
    { d: 'M1072 762V646M1290 762V646M1176 744V640', from: 15.6, to: 17.8, rest: 0.18 },
    { d: 'M1136 568H1216V640H1136Z', from: 17.4, to: 19.4, rest: 0.0 },
    { d: 'M1136 568L1176 548L1256 548L1216 568M1216 640L1256 620V548', from: 18.2, to: 20.0, rest: 0.0 },
    { d: 'M1040 740L1176 604L1332 740', from: 19.4, to: 21, rest: 0.12 }
  ].map(l => ({ ...l, node: el('path', { d: l.d, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0 }, linesG) }));
  const links = ['a', 'b', 'c'].map(() => el('line', { pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, opacity: 0, 'stroke-width': 0.9 }, linesG));

  const glowT = track([[0, 0], [1.2, 0.3], [6, 0.5], [9.3, 0.55], [11.2, 0.95], [12.8, 0.6], [17.4, 0.6], [19.4, 0.85], [20.8, 1.15], [22.4, 0.85]]);
  const veilT = track([[0, 0.5], [6, 0.4], [11, 0.22], [17, 0.18], [21.2, 0.02], [26, 0]]);
  const haloT = track([[0, 0.15], [8, 0.35], [11.4, 0.7], [16, 0.55], [21.4, 0.95], [26, 0.85]]);
  const apertureT = track([[0, 0], [20.4, 0], [22.2, 0.3], [26, 0.22]]);
  const shaftT = track([[0, 0], [20.6, 0], [22.6, 0.12], [26, 0.09]]);
  const handoff = t => EASE.io(seg(t, 10.9, 11.7));
  const lift = t => EASE.io(seg(t, 19.2, 20.6));
  const resolve = t => EASE.io(seg(t, 20.5, 21.9));

  /* ---------- Camera ---------- */
  const camX = track([[0, 1080], [6, 1110], [10.6, 1168], [15, 1214], [19.5, 1196], [24, 1180], [26, 1180]]);
  const camY = track([[0, 640], [6, 650], [10.6, 664], [15, 664], [19.5, 640], [24, 640]]);
  const camZ = track([[0, 1], [6, 1.05], [10.6, 1.16], [13, 1.15], [15, 1.1], [19.5, 1.15], [24, 1.03], [26, 1.03]]);
  let W = 0, H = 0;
  const measure = () => { W = stage.clientWidth; H = stage.clientHeight; };

  const applyCamera = t => {
    const mobile = !desktopQ.matches;
    const ax = mobile ? 0.5 : 0.7;
    const ay = mobile ? 0.6 : 0.6;
    const zBase = mobile ? 2.1 : 1;
    const k0 = Math.max(W / 1600, H / 1000);
    const k = k0 * camZ(t) * zBase;
    let tx = ax * W - camX(t) * k;
    let ty = ay * H - camY(t) * k;
    tx = clamp(tx, W - 1600 * k, 0);
    ty = clamp(ty, H - 1000 * k, 0);
    img.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${k.toFixed(4)})`;
    svg.setAttribute('viewBox', `${(-tx / k).toFixed(2)} ${(-ty / k).toFixed(2)} ${(W / k).toFixed(2)} ${(H / k).toFixed(2)}`);
  };

  /* ---------- Pose ---------- */
  const legAngles = (phase, walk) => {
    const s = Math.sin(phase), c = Math.cos(phase);
    const thigh = 24 * s * walk + 2;
    const knee = 3 + walk * 32 * Math.pow(Math.max(0, c), 1.4);
    return [thigh, knee];
  };
  const footY = (thigh, knee) => {
    const [kx, ky] = rot(0, RIG.thigh, -thigh);
    const [sx, sy] = rot(0, RIG.shin, -thigh + knee);
    return ky + sy;
  };
  const handPoint = (shoulderDeg, elbowDeg, lean, side) => {
    const [ex, ey] = rot(0, RIG.upper, -shoulderDeg);
    const [hx, hy] = rot(0, RIG.fore + 2, -(shoulderDeg + elbowDeg));
    return rot(side + ex + hx, RIG.shoulder + ey + hy, lean);
  };

  const pose = (c, t, idle) => {
    const x = c.x(t);
    const y = c.y(t);
    const speed = Math.abs(c.x(t + 0.06) - c.x(t - 0.06)) / 0.12;
    const walk = clamp(speed / 36);
    const s = 0.98 + (y - 750) * 0.004;
    const face = c.face(t);
    const sx = face >= 0 ? Math.max(face, 0.32) : Math.min(face, -0.32);
    const phase = (x - 700) / 30 * Math.PI * (face >= 0 ? 1 : -1);
    const [tN, kN] = legAngles(phase, walk);
    const [tF, kF] = legAngles(phase + Math.PI, walk);
    const drop = RIG.hip - Math.max(footY(tN, kN), footY(tF, kF));
    const lean = c.lean(t) + walk * 3;
    const breath = Math.sin(idle * 1.6 + x) * 0.5;
    const swing = 18 * Math.sin(phase) * walk * c.swingArms(t);
    const pz = {
      nS: c.nS(t) - swing, nE: c.nE(t) + Math.abs(swing) * 0.4,
      fS: c.fS(t) + swing, fE: c.fE(t) + Math.abs(swing) * 0.4
    };
    const n = c.node;
    n.g.setAttribute('transform', `translate(${x.toFixed(2)} ${(y + drop * s).toFixed(2)}) scale(${(sx * s).toFixed(3)} ${s.toFixed(3)})`);
    const setLeg = (leg, th, kn, off) => {
      leg.top.setAttribute('transform', `translate(${off} ${-RIG.hip}) rotate(${(-th).toFixed(2)})`);
      leg.joint.setAttribute('transform', `translate(0 ${RIG.thigh}) rotate(${kn.toFixed(2)})`);
    };
    setLeg(n.legN, tN, kN, c.hipW);
    setLeg(n.legF, tF, kF, -c.hipW);
    n.upper.setAttribute('transform', `translate(0 ${(-RIG.hip + breath * 0.3).toFixed(2)}) rotate(${lean.toFixed(2)})`);
    const setArm = (arm, sh, elb, off) => {
      arm.top.setAttribute('transform', `translate(${off} ${RIG.shoulder}) rotate(${(-sh).toFixed(2)})`);
      arm.joint.setAttribute('transform', `translate(0 ${RIG.upper}) rotate(${(-elb).toFixed(2)})`);
    };
    setArm(n.armN, pz.nS, pz.nE, 2.5);
    setArm(n.armF, pz.fS, pz.fE, -3.5);
    n.head.setAttribute('transform', `translate(0 -58) rotate(${c.head(t).toFixed(2)})`);

    // world-space hands (midpoint of both) and head
    const hN = handPoint(pz.nS, pz.nE, lean, 2.5);
    const hF = handPoint(pz.fS, pz.fE, lean, -3.5);
    const baseY = y + drop * s - RIG.hip * s;
    const toWorld = ([lx, ly]) => [x + lx * sx * s, baseY + ly * s];
    const hand = toWorld([(hN[0] + hF[0]) / 2, (hN[1] + hF[1]) / 2]);

    c.shadow.setAttribute('cx', x.toFixed(1));
    c.shadow.setAttribute('cy', (y + 1).toFixed(1));
    c.shadow.setAttribute('rx', (20 * s).toFixed(1));
    const lean2 = (x - 1186) * 0.28;
    c.cast.setAttribute('d', `M${x - 9 * s} ${y}L${x + 9 * s} ${y}L${x + 22 * s + lean2} ${y + 80 * s}L${x - 22 * s + lean2} ${y + 80 * s}Z`);
    c.refl.setAttribute('transform', `matrix(1 0 0 -1 0 ${(2 * (y + 0.5)).toFixed(1)})`);
    return { x, y, hand };
  };

  /* ---------- Render ---------- */
  const render = (t, idle = 0) => {
    applyCamera(t);
    const A = pose(CAST.a, t, idle);
    const B = pose(CAST.b, t, idle);
    const C = pose(CAST.c, t, idle);

    // object follows the hands that hold it
    const h = handoff(t);
    let ox = A.hand[0] + (B.hand[0] - A.hand[0]) * h;
    let oy = A.hand[1] + (B.hand[1] - A.hand[1]) * h - 4;
    const up = lift(t);
    const bob = Math.sin(idle * 1.3) * 2.2 * up;
    ox += (FLOAT.x - ox) * up;
    oy += (FLOAT.y - oy) * up + bob;
    const tilt = (-12 * (1 - h) + 10 * h) * (1 - up);
    const rv = resolve(t);
    const pulse = 1 + Math.sin(idle * 2.1) * 0.06 * up;
    obj.setAttribute('transform', `translate(${ox.toFixed(2)} ${oy.toFixed(2)})`);
    tablet.setAttribute('transform', `rotate(${(tilt + rv * 30).toFixed(2)}) scale(${(1 - rv * 0.9).toFixed(3)} ${(1 - rv).toFixed(3)})`);
    tablet.setAttribute('opacity', (1 - rv).toFixed(3));
    form.setAttribute('transform', `rotate(${((1 - rv) * -30).toFixed(2)}) scale(${(rv * pulse * 1.45).toFixed(3)})`);
    form.setAttribute('opacity', rv.toFixed(3));
    const glow = glowT(t) * (1 + Math.sin(idle * 2.1) * 0.08);
    objGlow.setAttribute('opacity', clamp(glow, 0, 1.2).toFixed(3));
    objGlow.setAttribute('r', (34 + glow * 22).toFixed(1));
    objFloor.setAttribute('cx', ox.toFixed(1));
    objFloor.setAttribute('opacity', (glow * 0.45 * (1 - up * 0.3)).toFixed(3));

    // system lines
    for (const l of staticLines) {
      const p = EASE.out(seg(t, l.from, l.to));
      const fade = 1 - seg(t, 21.2, 22.6) * (1 - l.rest);
      l.node.setAttribute('stroke-dashoffset', (1 - p).toFixed(3));
      l.node.setAttribute('opacity', (p > 0 ? 0.75 * fade : 0).toFixed(3));
    }
    [A, B, C].forEach((who, i) => {
      const line = links[i];
      const p = EASE.out(seg(t, 18.4 + i * 0.25, 19.6 + i * 0.25));
      const fade = 1 - seg(t, 21.4, 22.6);
      line.setAttribute('x1', who.hand[0].toFixed(1));
      line.setAttribute('y1', who.hand[1].toFixed(1));
      line.setAttribute('x2', ox.toFixed(1));
      line.setAttribute('y2', oy.toFixed(1));
      line.setAttribute('stroke-dashoffset', (1 - p).toFixed(3));
      line.setAttribute('opacity', (p * fade * 0.6).toFixed(3));
    });

    // light
    veil.setAttribute('opacity', veilT(t).toFixed(3));
    halo.setAttribute('opacity', (haloT(t) * (1 + Math.sin(idle * 0.9) * 0.05)).toFixed(3));
    aperture.setAttribute('opacity', apertureT(t).toFixed(3));
    shaft.setAttribute('opacity', shaftT(t).toFixed(3));

    // chapter rail
    railItems.forEach((li, i) => {
      const a = CHAPTERS[i], b = CHAPTERS[i + 1];
      li.style.setProperty('--p', seg(t, a, b).toFixed(3));
      li.classList.toggle('is-active', t >= a && (t < b || (i === railItems.length - 1)));
      li.classList.toggle('is-done', t >= b && i < railItems.length - 1);
    });
  };

  /* ---------- Playhead ---------- */
  const state = { time: 0, target: 0, playing: true, idle: 0, lastScroll: 0, visible: true };
  let raf = 0;
  let last = 0;
  let still = reduceQ.matches;

  const pinned = () => !still && desktopQ.matches;
  const scrollProgress = () => {
    if (!wrap) return 0;
    const r = wrap.getBoundingClientRect();
    const span = pinned() ? wrap.offsetHeight - window.innerHeight : wrap.offsetHeight * 0.8;
    return clamp(-r.top / Math.max(1, span));
  };
  const setToggle = () => {
    if (!toggle) return;
    const ended = state.time >= T - 0.05;
    const mode = still ? 'play' : ended ? 'replay' : state.playing ? 'pause' : 'play';
    toggle.dataset.state = mode === 'pause' ? 'playing' : 'paused';
    toggle.setAttribute('aria-label', `See how we work (${mode === 'pause' ? 'pause the story' : mode === 'replay' ? 'replay the story' : 'play the story'})`);
  };

  const onScroll = () => {
    if (still) return;
    const p = scrollProgress();
    const d = p - state.lastScroll;
    if (d > 0) state.target += d * (T - state.target) / Math.max(1e-3, 1 - state.lastScroll);
    else if (d < 0) state.target *= p / Math.max(1e-3, state.lastScroll);
    state.target = clamp(state.target, 0, T);
    state.lastScroll = p;
    wake();
  };

  const frame = now => {
    raf = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (state.playing && state.target < T) state.target = Math.min(T, state.target + dt);
    const gap = state.target - state.time;
    state.time += Math.abs(gap) < 0.0005 ? gap : gap * (1 - Math.exp(-dt * 6));
    // Paused or finished means fully still, ambient motion included, once the
    // camera settles; scrolling or the controls wake the loop again.
    const moving = state.playing && state.time < T - 0.05;
    if (moving) state.idle += dt;
    render(state.time, state.idle);
    setToggle();
    if (state.visible && !document.hidden && (moving || state.time !== state.target)) raf = requestAnimationFrame(frame);
  };
  function wake() {
    if (still || raf || !state.visible || document.hidden) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  const goStill = t => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    state.time = state.target = t;
    render(t, 0);
    setToggle();
  };

  const setMode = () => {
    still = reduceQ.matches;
    root.classList.toggle('pin', pinned());
    measure();
    state.lastScroll = scrollProgress();
    if (still) goStill(T);
    else wake();
  };

  /* ---------- Controls ---------- */
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      if (still) {
        // Reduced motion: step through the story as still frames.
        const i = CHAPTERS.findIndex(c => c > state.time + 0.01);
        goStill(i > 0 && i < CHAPTERS.length - 1 ? CHAPTERS[i] + 2.2 : 2.2);
        return;
      }
      if (state.time >= T - 0.05) {
        state.time = state.target = 0;
        state.playing = true;
      } else {
        state.playing = !state.playing;
      }
      wake();
      setToggle();
    });
  }
  railItems.forEach((li, i) => {
    const btn = li.querySelector('button');
    if (!btn) return;
    btn.tabIndex = 0;
    btn.setAttribute('aria-label', `${btn.querySelector('.rail-t').textContent}: show this step of the story`);
    btn.addEventListener('click', () => {
      if (still) { goStill(i === CHAPTERS.length - 2 ? T : CHAPTERS[i + 1] - 0.4); return; }
      state.target = CHAPTERS[i] + 0.01;
      state.playing = true;
      wake();
    });
  });

  root.classList.add('has-story');
  stage.classList.add('cam');
  if (!desktopQ.matches) {
    objFloor.removeAttribute('filter');
    reflLayer.remove();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measure(); still ? render(state.time, 0) : wake(); });
  reduceQ.addEventListener('change', setMode);
  desktopQ.addEventListener('change', setMode);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      state.visible = entry.isIntersecting;
      if (state.visible) wake();
    }).observe(stage);
  }

  setMode();
  render(state.time, 0);

  // ?story=12.5 freezes the story at that second, for design review.
  const review = new URLSearchParams(location.search).get('story');
  if (review !== null && !Number.isNaN(+review)) { still = true; goStill(clamp(+review, 0, T)); }
})();
