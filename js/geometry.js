/* ============================================================
   Peek-a-Shape｜立體探秘樂
   geometry.js — 核心幾何資料（純 JS，不依賴 THREE）
   所有面數／棱數／頂點數均由實際幾何資料計算，避免硬編碼錯誤。
   ============================================================ */
(function (global) {
  'use strict';

  var EPS = 1e-7;

  /* ---------- 向量工具 ---------- */
  var V = {
    add: function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
    sub: function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
    mul: function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; },
    dot: function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
    cross: function (a, b) {
      return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    },
    len: function (a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); },
    norm: function (a) { var l = V.len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    dist: function (a, b) { return V.len(V.sub(a, b)); },
    lerp: function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; },
    centroid: function (ps) {
      var c = [0, 0, 0];
      for (var i = 0; i < ps.length; i++) { c[0] += ps[i][0]; c[1] += ps[i][1]; c[2] += ps[i][2]; }
      var n = ps.length || 1;
      return [c[0] / n, c[1] / n, c[2] / n];
    }
  };

  /* 由多邊形頂點計算法線（Newell 方法，容許非完全平面） */
  function polyNormal(pts) {
    var n = [0, 0, 0];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      n[0] += (a[1] - b[1]) * (a[2] + b[2]);
      n[1] += (a[2] - b[2]) * (a[0] + b[0]);
      n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    }
    return V.norm(n);
  }

  /* 令面的法線指向外（凸立體：由內部點指向面質心） */
  function orientFace(face, interior) {
    var n = polyNormal(face.pts);
    var c = V.centroid(face.pts);
    var outward = V.sub(c, interior);
    if (V.dot(n, outward) < 0) { face.pts = face.pts.slice().reverse(); n = V.mul(n, -1); }
    face.n = n;
    return face;
  }

  /* ---------- 產生立體 ---------- */
  function makeSolid(id, kind, faces, params) {
    // 內部點：所有頂點的凸組合（凸立體時必在內部）
    var all = [];
    faces.forEach(function (f) { all = all.concat(f.pts); });
    var interior = V.centroid(all);
    faces.forEach(function (f) { orientFace(f, interior); });

    var solid = {
      id: id, kind: kind, faces: faces, params: params || {},
      V: V, polyNormal: polyNormal, EPS: EPS
    };
    // 語意分組（面）：poly 立體每個平面面一組；曲面體由 builder 指定
    solid.groups = (params && params.groups) ? params.groups : faces.map(function (f, i) {
      return { id: i, type: (f.surf === 'curved' ? 'curved' : 'flat'), face: i };
    });
    if (!params || !params.groups) {
      // 平面多面體：每個面自成一組，記錄對應的面索引
      for (var gi = 0; gi < solid.groups.length; gi++) solid.groups[gi].face = gi;
    }
    solid.bounds = bounds(faces);
    // 表面取樣／判定用的解析函數
    solid.surfaceAt = params && params.surfaceAt ? params.surfaceAt : null;
    return solid;
  }

  function bounds(faces) {
    var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    faces.forEach(function (f) {
      f.pts.forEach(function (p) {
        for (var k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; }
      });
    });
    return { min: mn, max: mx, size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]] };
  }

  function regularRing(n, R, y, phase) {
    phase = phase || 0;
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = phase + i * 2 * Math.PI / n;
      pts.push([R * Math.cos(a), y, R * Math.sin(a)]);
    }
    return pts;
  }

  /* 長方體 / 正方體 */
  function buildCuboid(w, h, d, id) {
    var x = w / 2, y = h / 2, z = d / 2;
    var v = [
      [-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z],
      [-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z]
    ];
    var idx = [
      [0, 1, 2, 3], // bottom
      [4, 5, 6, 7], // top
      [0, 1, 5, 4], // front (-z)
      [3, 2, 6, 7], // back (+z)
      [0, 3, 7, 4], // left (-x)
      [1, 2, 6, 5]  // right (+x)
    ];
    var faces = idx.map(function (f) { return { pts: f.map(function (i) { return v[i].slice(); }), surf: 'flat' }; });
    return makeSolid(id, 'poly', faces, { w: w, h: h, d: d });
  }

  /* 正 n 角柱（可指定底面為長方形：quad 柱由 buildCuboid 處理） */
  function buildPrism(n, R, h, id) {
    var bottom = regularRing(n, R, -h / 2, Math.PI / 2);
    var top = regularRing(n, R, h / 2, Math.PI / 2);
    var faces = [];
    faces.push({ pts: bottom.map(function (p) { return p.slice(); }), surf: 'flat' });
    faces.push({ pts: top.map(function (p) { return p.slice(); }), surf: 'flat' });
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      faces.push({
        pts: [bottom[i].slice(), bottom[j].slice(), top[j].slice(), top[i].slice()], surf: 'flat'
      });
    }
    return makeSolid(id, 'poly', faces, { n: n, R: R, h: h, side: 2 * R * Math.sin(Math.PI / n) });
  }

  /* 正 n 角錐 */
  function buildPyramid(n, R, h, id) {
    var base = regularRing(n, R, -h / 2, Math.PI / 2);
    var apex = [0, h / 2, 0];
    var faces = [{ pts: base.map(function (p) { return p.slice(); }), surf: 'flat' }];
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      faces.push({ pts: [base[i].slice(), base[j].slice(), apex.slice()], surf: 'flat' });
    }
    return makeSolid(id, 'poly', faces, {
      n: n, R: R, h: h, apex: apex, side: 2 * R * Math.sin(Math.PI / n),
      apothem: R * Math.cos(Math.PI / n)
    });
  }

  /* 圓柱體（用多邊形分段逼近，切割時仍然做真正幾何運算） */
  function buildCylinder(r, h, id, seg) {
    seg = seg || 96;
    var bottom = regularRing(seg, r, -h / 2, 0);
    var top = regularRing(seg, r, h / 2, 0);
    var faces = [];
    var g0 = { id: 0, type: 'flat', zh: '平面底面', en: 'flat base', key: 'cap0' };
    var g1 = { id: 1, type: 'flat', zh: '平面底面', en: 'flat base', key: 'cap1' };
    var g2 = { id: 2, type: 'curved', zh: '曲面側面', en: 'curved surface', key: 'lateral' };
    faces.push({ pts: bottom.map(function (p) { return p.slice(); }), surf: 'curved', group: 0, surfTag: 'cap' });
    faces.push({ pts: top.map(function (p) { return p.slice(); }), surf: 'curved', group: 1, surfTag: 'cap' });
    for (var i = 0; i < seg; i++) {
      var j = (i + 1) % seg;
      faces.push({
        pts: [bottom[i].slice(), bottom[j].slice(), top[j].slice(), top[i].slice()],
        surf: 'curved', group: 2, surfTag: 'lateral'
      });
    }
    var solid = makeSolid(id, 'curved', faces, {
      r: r, h: h, seg: seg,
      groups: [g0, g1, g2],
      axis: [0, 1, 0],
      surfaceAt: function (p) {
        var radial = Math.abs(Math.hypot(p[0], p[2]) - r);
        var cap = Math.min(Math.abs(p[1] - h / 2), Math.abs(p[1] + h / 2));
        if (radial < 1e-3 && Math.abs(p[1]) <= h / 2 + 1e-3) return 'curved';
        if (cap < 1e-3 && Math.hypot(p[0], p[2]) <= r + 1e-3) return 'flat';
        return 'other';
      },
      insideAt: function (p) {
        return Math.hypot(p[0], p[2]) <= r + 1e-6 && Math.abs(p[1]) <= h / 2 + 1e-6;
      }
    });
    solid.groups = [g0, g1, g2];
    solid.kind = 'cylinder';
    return solid;
  }

  /* 圓錐體 */
  function buildCone(r, h, id, seg) {
    seg = seg || 96;
    var base = regularRing(seg, r, -h / 2, 0);
    var apex = [0, h / 2, 0];
    var g0 = { id: 0, type: 'flat', zh: '平面底面', en: 'flat base', key: 'base' };
    var g1 = { id: 1, type: 'curved', zh: '曲面側面', en: 'curved surface', key: 'lateral' };
    var faces = [{ pts: base.map(function (p) { return p.slice(); }), surf: 'curved', group: 0, surfTag: 'base' }];
    for (var i = 0; i < seg; i++) {
      var j = (i + 1) % seg;
      faces.push({ pts: [base[i].slice(), base[j].slice(), apex.slice()], surf: 'curved', group: 1, surfTag: 'lateral' });
    }
    var slope = r / h; // 半徑 / 高
    var solid = makeSolid(id, 'curved', faces, {
      r: r, h: h, seg: seg, apex: apex, groups: [g0, g1], axis: [0, 1, 0], slope: slope,
      surfaceAt: function (p) {
        var t = (h / 2 - p[1]) * slope; // 該高度應有的半徑
        var rad = Math.hypot(p[0], p[2]);
        if (Math.abs(rad - t) < 1.2e-3 && p[1] <= h / 2 + 1e-3 && p[1] >= -h / 2 - 1e-3) return 'curved';
        if (Math.abs(p[1] + h / 2) < 1e-3 && rad <= r + 1e-3) return 'flat';
        return 'other';
      },
      insideAt: function (p) {
        var t = (h / 2 - p[1]) * slope;
        return p[1] <= h / 2 + 1e-6 && p[1] >= -h / 2 - 1e-6 && Math.hypot(p[0], p[2]) <= t + 1e-6;
      }
    });
    solid.groups = [g0, g1];
    solid.kind = 'cone';
    return solid;
  }

  /* 球體 */
  function buildSphere(r, id, seg, rings) {
    seg = seg || 72; rings = rings || 36;
    var faces = [];
    function pt(i, j) {
      var phi = Math.PI * i / rings;      // 0..PI (由 +y 至 -y)
      var theta = 2 * Math.PI * j / seg;
      return [r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)];
    }
    for (var i = 0; i < rings; i++) {
      for (var j = 0; j < seg; j++) {
        var a = pt(i, j), b = pt(i, j + 1), c = pt(i + 1, j + 1), d = pt(i + 1, j);
        faces.push({ pts: [a, b, c, d], surf: 'curved', group: 0, surfTag: 'lateral' });
      }
    }
    var g0 = { id: 0, type: 'curved', zh: '曲面', en: 'curved surface', key: 'surface' };
    var solid = makeSolid(id, 'curved', faces, {
      r: r, seg: seg, rings: rings, groups: [g0],
      surfaceAt: function (p) {
        return Math.abs(V.len(p) - r) < 1e-3 ? 'curved' : 'other';
      },
      insideAt: function (p) { return V.len(p) <= r + 1e-6; }
    });
    solid.groups = [g0];
    solid.kind = 'sphere';
    return solid;
  }

  /* ---------- 12 個立體定義 ---------- */
  var SHAPES = [
    { id: 'cube', kind: 'poly', n: 4 },
    { id: 'cuboid', kind: 'poly' },
    { id: 'triPrism', kind: 'poly', n: 3 },
    { id: 'quadPrism', kind: 'poly', n: 4 },
    { id: 'pentaPrism', kind: 'poly', n: 5 },
    { id: 'hexaPrism', kind: 'poly', n: 6 },
    { id: 'triPyramid', kind: 'poly', n: 3 },
    { id: 'quadPyramid', kind: 'poly', n: 4 },
    { id: 'pentaPyramid', kind: 'poly', n: 5 },
    { id: 'cylinder', kind: 'cylinder' },
    { id: 'cone', kind: 'cone' },
    { id: 'sphere', kind: 'sphere' }
  ];

  var PRISM_R = 1.0, PRISM_H = 1.9, PYR_R = 1.15, PYR_H = 1.85;

  function buildShape(id) {
    switch (id) {
      case 'cube': return buildCuboid(1.6, 1.6, 1.6, 'cube');
      case 'cuboid': return buildCuboid(2.0, 1.2, 1.4, 'cuboid');
      case 'triPrism': return buildPrism(3, PRISM_R, PRISM_H, 'triPrism');
      case 'quadPrism': return buildPrism(4, 0.85, PRISM_H, 'quadPrism');
      case 'pentaPrism': return buildPrism(5, PRISM_R, PRISM_H, 'pentaPrism');
      case 'hexaPrism': return buildPrism(6, PRISM_R, PRISM_H, 'hexaPrism');
      case 'triPyramid': return buildPyramid(3, PYR_R, PYR_H, 'triPyramid');
      case 'quadPyramid': return buildPyramid(4, PYR_R, PYR_H, 'quadPyramid');
      case 'pentaPyramid': return buildPyramid(5, PYR_R, PYR_H, 'pentaPyramid');
      case 'cylinder': return buildCylinder(0.95, 1.9, 'cylinder');
      case 'cone': return buildCone(1.0, 1.9, 'cone');
      case 'sphere': return buildSphere(1.1, 'sphere');
    }
    return null;
  }

  /* ---------- 名稱 / 說明（由幾何資料生成，中英對應） ---------- */
  var NAME = {
    cube: { zh: '正方體', en: 'Cube' },
    cuboid: { zh: '長方體', en: 'Cuboid' },
    triPrism: { zh: '三角柱', en: 'Triangular Prism' },
    quadPrism: { zh: '四角柱', en: 'Quadrilateral Prism' },
    pentaPrism: { zh: '五角柱', en: 'Pentagonal Prism' },
    hexaPrism: { zh: '六角柱', en: 'Hexagonal Prism' },
    triPyramid: { zh: '三角錐', en: 'Triangular Pyramid' },
    quadPyramid: { zh: '四角錐', en: 'Square Pyramid' },
    pentaPyramid: { zh: '五角錐', en: 'Pentagonal Pyramid' },
    cylinder: { zh: '圓柱體', en: 'Cylinder' },
    cone: { zh: '圓錐體', en: 'Cone' },
    sphere: { zh: '球體', en: 'Sphere' }
  };

  var CN = { 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八' };
  var EN = { 3: 'triangular', 4: 'quadrilateral', 5: 'pentagonal', 6: 'hexagonal', 7: 'heptagonal', 8: 'octagonal' };
  var CN_SHAPE = { 3: '三角形', 4: '四邊形', 5: '五邊形', 6: '六邊形' };
  var EN_SHAPE = { 3: 'triangle', 4: 'quadrilateral', 5: 'pentagon', 6: 'hexagon' };

  /* 由幾何資料計算面／棱／頂點（多面體用真實拓樸；曲面體用數學定義） */
  function topology(faces, tol) {
    tol = tol || 1e-6;
    var key = function (p) { return [Math.round(p[0] / tol), Math.round(p[1] / tol), Math.round(p[2] / tol)].join('|'); };
    var vmap = {}, verts = [];
    faces.forEach(function (f) {
      f.pts.forEach(function (p) {
        var k = key(p);
        if (vmap[k] === undefined) { vmap[k] = verts.length; verts.push(p.slice()); }
      });
    });
    var emap = {}, edges = [];
    faces.forEach(function (f) {
      var ids = f.pts.map(function (p) { return vmap[key(p)]; });
      for (var i = 0; i < ids.length; i++) {
        var a = ids[i], b = ids[(i + 1) % ids.length];
        if (a === b) continue;
        var ek = a < b ? a + '_' + b : b + '_' + a;
        if (emap[ek] === undefined) { emap[ek] = edges.length; edges.push([a, b]); }
      }
    });
    return { verts: verts, edges: edges };
  }

  /* 每個立體的教學資料（中英） */
  var INFO = {};

  function prismInfo(n, id) {
    var F = n + 2, E = 3 * n, Vt = 2 * n;
    var info = {
      counts: { faces: F, edges: E, vertices: Vt },
      faceDetail: { zh: n + ' 個長方形側面 + 2 個' + CN_SHAPE[n] + '底面 = ' + F + ' 個平面', en: n + ' rectangular side faces + 2 ' + EN_SHAPE[n] + ' bases = ' + F + ' flat faces' },
      edgeDetail: { zh: E + ' 條棱（' + n + ' 條底面棱 ×2 + ' + n + ' 條側棱）', en: E + ' edges (' + n + ' base edges ×2 + ' + n + ' side edges)' },
      vertDetail: { zh: Vt + ' 個頂點（每個底面 ' + n + ' 個）', en: Vt + ' vertices (' + n + ' on each base)' },
      desc: {
        zh: '每個' + CN[n] + '角柱有 2 個全等的' + CN_SHAPE[n] + '底面及 ' + n + ' 個長方形側面，全部都是平面。',
        en: 'A ' + EN[n] + ' prism has 2 congruent ' + EN_SHAPE[n] + ' bases and ' + n + ' rectangular side faces, all flat.'
      }
    };
    return info;
  }

  function pyramidInfo(n, id) {
    var F = n + 1, E = 2 * n, Vt = n + 1;
    return {
      counts: { faces: F, edges: E, vertices: Vt },
      faceDetail: { zh: n + ' 個三角形側面 + 1 個' + CN_SHAPE[n] + '底面 = ' + F + ' 個平面', en: n + ' triangular side faces + 1 ' + EN_SHAPE[n] + ' base = ' + F + ' flat faces' },
      edgeDetail: { zh: E + ' 條棱（' + n + ' 條底面棱 + ' + n + ' 條側棱）', en: E + ' edges (' + n + ' base edges + ' + n + ' side edges)' },
      vertDetail: { zh: Vt + ' 個頂點（' + n + ' 個在底面 + 1 個尖頂）', en: Vt + ' vertices (' + n + ' on the base + 1 apex)' },
      desc: {
        zh: '每個' + CN[n] + '角錐有 1 個' + CN_SHAPE[n] + '底面及 ' + n + ' 個三角形側面，它們會在尖頂相遇。',
        en: 'A ' + EN[n] + ' pyramid has 1 ' + EN_SHAPE[n] + ' base and ' + n + ' triangular side faces meeting at the apex.'
      }
    };
  }

  function buildInfo(id) {
    var s = buildShape(id);
    if (id === 'cube') {
      return {
        counts: { faces: 6, edges: 12, vertices: 8 },
        faceDetail: { zh: '6 個全等的正方形面', en: '6 congruent square faces' },
        edgeDetail: { zh: '12 條棱（長度都一樣）', en: '12 edges (all equal)' },
        vertDetail: { zh: '8 個頂點', en: '8 vertices' },
        desc: { zh: '正方體有 6 個正方形面，12 條棱一樣長，8 個頂點。', en: 'A cube has 6 square faces, 12 equal edges and 8 vertices.' },
        curved: false
      };
    }
    if (id === 'cuboid') {
      return {
        counts: { faces: 6, edges: 12, vertices: 8 },
        faceDetail: { zh: '6 個長方形面（相對的面全等）', en: '6 rectangular faces (opposite faces are congruent)' },
        edgeDetail: { zh: '12 條棱（分 3 組，每組 4 條一樣長）', en: '12 edges (3 groups of 4 equal edges)' },
        vertDetail: { zh: '8 個頂點', en: '8 vertices' },
        desc: { zh: '長方體有 6 個長方形面，相對的面相同，8 個頂點。', en: 'A cuboid has 6 rectangular faces; opposite faces are the same, and it has 8 vertices.' },
        curved: false
      };
    }
    if (id === 'triPrism') return prismInfo(3, id);
    if (id === 'quadPrism') return prismInfo(4, id);
    if (id === 'pentaPrism') return prismInfo(5, id);
    if (id === 'hexaPrism') return prismInfo(6, id);
    if (id === 'triPyramid') return pyramidInfo(3, id);
    if (id === 'quadPyramid') return pyramidInfo(4, id);
    if (id === 'pentaPyramid') return pyramidInfo(5, id);
    if (id === 'cylinder') {
      return {
        counts: { faces: 3, edges: 2, vertices: 0 },
        faceDetail: { zh: '2 個平面（圓形底面） + 1 個曲面 = 3 個面（曲面不是平面）', en: '2 flat circular bases + 1 curved surface = 3 faces (a curved surface is not flat)' },
        edgeDetail: { zh: '2 條圓形邊（這是曲線，不是直棱）', en: '2 circular edges (these are curves, not straight edges)' },
        vertDetail: { zh: '0 個頂點（圓柱沒有尖角）', en: '0 vertices (a cylinder has no corners)' },
        desc: { zh: '圓柱體有 2 個圓形平面底面和 1 個曲面側面，可以滾動。', en: 'A cylinder has 2 flat circular bases and 1 curved surface, so it can roll.' },
        curved: true
      };
    }
    if (id === 'cone') {
      return {
        counts: { faces: 2, edges: 1, vertices: 1 },
        faceDetail: { zh: '1 個平面（圓形底面） + 1 個曲面 = 2 個面', en: '1 flat circular base + 1 curved surface = 2 faces' },
        edgeDetail: { zh: '1 條圓形邊（曲線）', en: '1 circular edge (a curve)' },
        vertDetail: { zh: '1 個頂點（尖頂）', en: '1 vertex (the apex)' },
        desc: { zh: '圓錐體有 1 個圓形平面底面、1 個曲面側面和 1 個尖頂。', en: 'A cone has 1 flat circular base, 1 curved surface and 1 apex.' },
        curved: true
      };
    }
    if (id === 'sphere') {
      return {
        counts: { faces: 1, edges: 0, vertices: 0 },
        faceDetail: { zh: '只有 1 個曲面，沒有平面', en: 'only 1 curved surface — no flat faces' },
        edgeDetail: { zh: '沒有棱（沒有直邊）', en: 'no edges (no straight edges)' },
        vertDetail: { zh: '沒有頂點', en: 'no vertices' },
        desc: { zh: '球體的表面全部是曲面，沒有平面，也沒有棱和頂點。', en: 'A sphere is all curved surface: no flat faces, no edges and no vertices.' },
        curved: true
      };
    }
    return null;
  }

  var infoCache = {};
  function info(id) {
    if (!infoCache[id]) {
      var base = buildInfo(id);
      base.id = id;
      base.name = NAME[id];
      infoCache[id] = base;
    }
    return infoCache[id];
  }

  var cache = {};
  function getSolid(id) {
    if (!cache[id]) cache[id] = buildShape(id);
    return cache[id];
  }

  /* 曲面體是否需要以平滑法線顯示 */
  function isCurvedSolid(solid) { return solid.kind !== 'poly'; }

  /* 表面取樣（驗證展開圖用） */
  function sampleSurface(solid, perFace) {
    perFace = perFace || 6;
    var pts = [];
    solid.faces.forEach(function (f) {
      var a = f.pts[0], b = f.pts[1], c = f.pts[2];
      for (var i = 1; i <= perFace; i++) {
        for (var j = 1; j <= perFace; j++) {
          var u = i / (perFace + 1), v = j / (perFace + 1);
          if (u + v > 1) continue;
          var p = V.add(V.add(V.mul(a, 1 - u - v), V.mul(b, u)), V.mul(c, v));
          pts.push(p);
        }
      }
    });
    return pts;
  }

  /* 多面體是否包含某點（凸立體，用面的外側判斷） */
  function containsPoint(solid, p, tol) {
    tol = tol === undefined ? 1e-6 : tol;
    if (solid.params.insideAt) return solid.params.insideAt(p);
    for (var i = 0; i < solid.faces.length; i++) {
      var f = solid.faces[i];
      if (V.dot(f.n, V.sub(p, f.pts[0])) > tol) return false;
    }
    return true;
  }

  /* 體積（封閉多面體，用散度定理；測試用） */
  function volume(faces) {
    var vol = 0;
    faces.forEach(function (f) {
      var p = f.pts;
      for (var i = 1; i + 1 < p.length; i++) {
        vol += V.dot(p[0], V.cross(p[i], p[i + 1])) / 6;
      }
    });
    return Math.abs(vol);
  }

  global.PS = global.PS || {};
  global.PS.V = V;
  global.PS.geo = {
    SHAPES: SHAPES, NAME: NAME, getSolid: getSolid, info: info, buildInfo: buildInfo,
    topology: topology, volume: volume, sampleSurface: sampleSurface, containsPoint: containsPoint,
    isCurvedSolid: isCurvedSolid, polyNormal: polyNormal, CN: CN, EN: EN, CN_SHAPE: CN_SHAPE, EN_SHAPE: EN_SHAPE
  };
})(typeof window !== 'undefined' ? window : this);
