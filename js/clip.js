/* ============================================================
   Peek-a-Shape｜立體探秘樂
   clip.js — 真實 3D 幾何切割、截面提取與截面判定
   ・半空間裁剪：逐個平面多邊形裁剪（多面體與曲面網格一視同仁）
   ・由切割線段縫合成截面環，再三角化封蓋
   ・截面形狀由幾何規則判定（非硬編碼答案）
   ============================================================ */
(function (global) {
  'use strict';
  var V = global.PS.V;
  var G = global.PS.geo;
  var EPS = 1e-7;

  /* ---------- 平面 ---------- */
  function makePlane(normal, point) {
    var n = V.norm(normal);
    return { n: n, d: V.dot(n, point) };
  }
  function signed(plane, p) { return V.dot(plane.n, p) - plane.d; }

  /* ---------- 多邊形裁剪（Sutherland–Hodgman，保留 s<=0 一側） ---------- */
  function clipPolygon(pts, plane, side) {
    // side = +1 : 保留 signed<=0 ; side = -1 : 保留 signed>=0
    var out = [], cuts = [];
    var n = pts.length;
    for (var i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      var sa = signed(plane, a) * side, sb = signed(plane, b) * side;
      if (sa <= EPS) out.push(a.slice());
      if ((sa < -EPS && sb > EPS) || (sa > EPS && sb < -EPS)) {
        var t = sa / (sa - sb);
        var p = V.lerp(a, b, t);
        p[0] += plane.n[0] * 0; // no-op，保持數值一致
        out.push(p);
        cuts.push(p);
      }
    }
    return { pts: out, cuts: cuts };
  }

  /* ---------- 截面環：由立體棱與平面的交點 + 落在平面上的頂點組成 ---------- */
  function keyOf(p) { return [Math.round(p[0] * 1e6), Math.round(p[1] * 1e6), Math.round(p[2] * 1e6)].join(','); }

  function dedupeByKey(pts) {
    var seen = {}, out = [];
    for (var i = 0; i < pts.length; i++) {
      var k = keyOf(pts[i]);
      if (!seen[k]) { seen[k] = 1; out.push(pts[i].slice()); }
    }
    return out;
  }

  // 收集立體表面與平面相交的所有點（凸立體：這些點正好構成截面多邊形的邊界）
  function sectionBoundaryPoints(solid, plane) {
    var pts = [], seenV = {}, seenE = {};
    solid.faces.forEach(function (f) {
      var n = f.pts.length;
      for (var i = 0; i < n; i++) {
        var a = f.pts[i], b = f.pts[(i + 1) % n];
        var ka = keyOf(a);
        if (!seenV[ka]) { seenV[ka] = 1; if (Math.abs(signed(plane, a)) < 1e-6) pts.push(a.slice()); }
        var kb = keyOf(b);
        var ek = ka < kb ? ka + '|' + kb : kb + '|' + ka;
        if (seenE[ek]) continue;
        seenE[ek] = 1;
        var sa = signed(plane, a), sb = signed(plane, b);
        if ((sa > 1e-6 && sb < -1e-6) || (sa < -1e-6 && sb > 1e-6)) {
          pts.push(V.lerp(a, b, sa / (sa - sb)));
        }
      }
    });
    return dedupeByKey(pts);
  }

  // 凸截面：以平面內質心為中心按極角排序，即為正確的環繞順序
  function buildLoop(pts, plane) {
    var uniq = dedupeByKey(pts);
    if (uniq.length < 3) return null;
    var basis = planeBasis(plane.n);
    var c = V.centroid(uniq);
    var arr = uniq.map(function (p) {
      var d = V.sub(p, c);
      return { p: p, a: Math.atan2(V.dot(d, basis[1]), V.dot(d, basis[0])) };
    });
    arr.sort(function (x, y) { return x.a - y.a; });
    var loop = arr.map(function (o) { return o.p; });
    return loop.length >= 3 ? loop : null;
  }

  function dedupe(loop) {
    var out = [];
    for (var i = 0; i < loop.length; i++) {
      var p = loop[i];
      if (out.length === 0 || V.dist(out[out.length - 1], p) > 1e-6) out.push(p);
    }
    while (out.length > 1 && V.dist(out[0], out[out.length - 1]) < 1e-6) out.pop();
    return out;
  }

  /* ---------- 主切割函數 ---------- */
  function clipSolid(solid, plane) {
    var A = [], B = [];             // A: signed<=0 一側；B: signed>=0 一側
    var nA = 0, nB = 0;

    for (var fi = 0; fi < solid.faces.length; fi++) {
      var f = solid.faces[fi];
      var pts = f.pts, all = true, none = true;
      var s = [];
      for (var i = 0; i < pts.length; i++) {
        var sv = signed(plane, pts[i]);
        s.push(sv);
        if (sv > EPS) all = false;
        if (sv < -EPS) none = false;
      }
      var meta = { surf: f.surf, group: f.group, surfTag: f.surfTag, srcFace: fi };
      if (all) { A.push({ pts: pts.map(function (p) { return p.slice(); }), n: f.n.slice(), surf: f.surf, group: f.group, surfTag: f.surfTag, srcFace: fi, cut: false }); nA++; continue; }
      if (none) { B.push({ pts: pts.map(function (p) { return p.slice(); }), n: f.n.slice(), surf: f.surf, group: f.group, surfTag: f.surfTag, srcFace: fi, cut: false }); nB++; continue; }

      var ra = clipPolygon(pts, plane, 1);   // A 側：signed<=0
      var rb = clipPolygon(pts, plane, -1);  // B 側：signed>=0
      if (ra.pts.length >= 3) {
        A.push({ pts: ra.pts, n: f.n.slice(), surf: f.surf, group: f.group, surfTag: f.surfTag, srcFace: fi, cut: true });
        nA++;
      }
      if (rb.pts.length >= 3) {
        B.push({ pts: rb.pts, n: f.n.slice(), surf: f.surf, group: f.group, surfTag: f.surfTag, srcFace: fi, cut: true });
        nB++;
      }
    }

    if (nA === 0 || nB === 0) {
      return { ok: false, reason: 'miss' };   // 平面只是擦過或沒有切穿立體
    }

    // 兩塊共用同一條截面環；分別依外法線定向（A 側 +n、B 側 −n）
    var loop = buildLoop(sectionBoundaryPoints(solid, plane), plane);
    if (!loop || loop.length < 3) return { ok: false, reason: 'miss' };

    function orientLoop(lp, target) {
      var nl = G.polyNormal(lp);
      if (V.dot(nl, target) < 0) return lp.slice().reverse();
      return lp;
    }
    var loopA = orientLoop(loop, plane.n);
    var loopB = orientLoop(loop, V.mul(plane.n, -1));

    var capA = { pts: loopA.map(function (p) { return p.slice(); }), n: plane.n.slice(), surf: 'cut', group: -1, surfTag: 'cut', cut: false, isCap: true };
    var capB = { pts: loopB.map(function (p) { return p.slice(); }), n: V.mul(plane.n, -1), surf: 'cut', group: -1, surfTag: 'cut', cut: false, isCap: true };
    A.push(capA); B.push(capB);

    return {
      ok: true, plane: plane,
      A: { faces: A }, B: { faces: B },
      section: { pts: loopA, normal: plane.n.slice(), plane: plane }
    };
  }

  /* ---------- 極簡單耳切三角化（純 JS，供封蓋及印章用） ---------- */
  function triangulate2D(pts) {
    // pts: [[x,y],...] 逆時針或順時針；回傳索引三元組
    var n = pts.length;
    if (n < 3) return [];
    var idx = [];
    for (var i = 0; i < n; i++) idx.push(i);
    var area = 0;
    for (i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      area += a[0] * b[1] - b[0] * a[1];
    }
    if (area < 0) idx.reverse();
    var out = [];
    var guard = 0;
    while (idx.length > 3 && guard++ < 4000) {
      var earFound = false;
      for (i = 0; i < idx.length; i++) {
        var i0 = idx[(i + idx.length - 1) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length];
        var p0 = pts[i0], p1 = pts[i1], p2 = pts[i2];
        var cross = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
        if (cross <= 1e-12) continue; // 反射角或退化
        var okEar = true;
        for (var j = 0; j < idx.length; j++) {
          var q = idx[j];
          if (q === i0 || q === i1 || q === i2) continue;
          if (pointInTri(pts[q], p0, p1, p2)) { okEar = false; break; }
        }
        if (!okEar) continue;
        out.push([i0, i1, i2]);
        idx.splice(i, 1);
        earFound = true;
        break;
      }
      if (!earFound) {
        // 退化情況：直接扇形分割，避免無限迴圈
        for (i = 1; i + 1 < idx.length; i++) out.push([idx[0], idx[i], idx[i + 1]]);
        return out;
      }
    }
    if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
    return out;
  }

  function pointInTri(p, a, b, c) {
    var d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
    var d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1]);
    var d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1]);
    var neg = (d1 < -1e-12) || (d2 < -1e-12) || (d3 < -1e-12);
    var pos = (d1 > 1e-12) || (d2 > 1e-12) || (d3 > 1e-12);
    return !(neg && pos);
  }

  /* 平面座標系 */
  function planeBasis(n) {
    var up = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    var u = V.norm(V.cross(up, n));
    var v = V.cross(n, u);
    return [u, v];
  }
  function to2D(pts3, basis, origin) {
    return pts3.map(function (p) {
      var d = V.sub(p, origin);
      return [V.dot(d, basis[0]), V.dot(d, basis[1])];
    });
  }

  /* 三角化一個平面多邊形（3D 點） */
  function triangulatePlanar(pts3, normal) {
    var basis = planeBasis(normal);
    var origin = V.centroid(pts3);
    var p2 = to2D(pts3, basis, origin);
    var tris = triangulate2D(p2);
    return tris.map(function (t) {
      return [pts3[t[0]].slice(), pts3[t[1]].slice(), pts3[t[2]].slice()];
    });
  }

  /* ---------- 截面形狀判定（幾何規則） ---------- */
  var SHAPE_NAME = {
    triangle: { zh: '三角形', en: 'Triangle' },
    rightTriangle: { zh: '直角三角形', en: 'Right-angled triangle' },
    isoTriangle: { zh: '等腰三角形', en: 'Isosceles triangle' },
    equiTriangle: { zh: '等邊三角形', en: 'Equilateral triangle' },
    square: { zh: '正方形', en: 'Square' },
    rectangle: { zh: '長方形', en: 'Rectangle' },
    parallelogram: { zh: '平行四邊形', en: 'Parallelogram' },
    trapezium: { zh: '梯形', en: 'Trapezium' },
    isoTrapezium: { zh: '等腰梯形', en: 'Isosceles trapezium' },
    quadrilateral: { zh: '四邊形', en: 'Quadrilateral' },
    pentagon: { zh: '五邊形', en: 'Pentagon' },
    hexagon: { zh: '六邊形', en: 'Hexagon' },
    heptagon: { zh: '七邊形', en: 'Heptagon' },
    octagon: { zh: '八邊形', en: 'Octagon' },
    circle: { zh: '圓形', en: 'Circle' },
    ellipse: { zh: '橢圓形', en: 'Ellipse' },
    composite: { zh: '曲線與直邊組成的截面', en: 'Curve + straight edges' },
    none: { zh: '沒有截面', en: 'No cross-section' }
  };

  function simplifyContour(pts, angleTolDeg) {
    // 先移除距離過近的點，再移除共線點
    var p = dedupe(pts.slice());
    var tol = Math.cos((angleTolDeg || 1.5) * Math.PI / 180);
    var changed = true;
    var guard = 0;
    while (changed && guard++ < 50) {
      changed = false;
      var out = [];
      for (var i = 0; i < p.length; i++) {
        var prev = p[(i + p.length - 1) % p.length];
        var cur = p[i];
        var next = p[(i + 1) % p.length];
        var d1 = V.norm(V.sub(cur, prev)), d2 = V.norm(V.sub(next, cur));
        if (V.dot(d1, d2) > tol) { changed = true; continue; } // 共線 → 移除
        out.push(cur);
      }
      if (out.length < 3) break;
      p = out;
    }
    return p;
  }

  /* 檢查一段連續點是否為直線 */
  function runIsStraight(pts, tol) {
    if (pts.length < 3) return true;
    tol = tol || 2e-3;
    var a = pts[0], b = pts[pts.length - 1];
    var dir = V.sub(b, a);
    var l = V.len(dir);
    if (l < 1e-9) return false;
    dir = V.mul(dir, 1 / l);
    for (var i = 1; i < pts.length - 1; i++) {
      var d = V.sub(pts[i], a);
      var perp = V.sub(d, V.mul(dir, V.dot(d, dir)));
      if (V.len(perp) > tol) return false;
    }
    return true;
  }

  /* 平面是否切到立體的平面底／蓋（決定曲面截面是否含直弦 → 複合截面） */
  function planeCutsFlatFace(solid, plane) {
    var r = solid.params.r, h = solid.params.h;
    if (!r || !h) return false;
    var caps = solid.kind === 'cone' ? [-h / 2] : [-h / 2, h / 2];
    var nx = plane.n[0], ny = plane.n[1], nz = plane.n[2];
    var hor = Math.sqrt(nx * nx + nz * nz);
    if (hor < 1e-9) return false;                 // 平面平行於底／蓋
    for (var i = 0; i < caps.length; i++) {
      var C = plane.d - ny * caps[i];
      if (Math.abs(C) / hor < r - 1e-6) return true;
    }
    return false;
  }

  /* 主判定：solid + 截面環 → 截面形狀 */
  function classifySection(solid, sectionPts, plane) {
    var pts = dedupe(sectionPts);
    if (pts.length < 3) return { key: 'none', sides: 0 };

    var kind = solid.kind;
    var axis = solid.params.axis;
    function parallelToAxis(n) {
      if (!axis) return false;
      return Math.abs(Math.abs(V.dot(V.norm(n), V.norm(axis))) - 1) < 1e-3;
    }

    // 曲面體：若簡化後邊數少（例如圓柱沿軸切 → 4 個角），交由一般多邊形判定；
    // 否則屬真正的曲線截面（圓／橢圓），或切到平面底蓋形成的「曲線＋直弦」複合截面。
    var curvedSolid = (kind === 'cylinder' || kind === 'cone' || kind === 'sphere');
    if (curvedSolid) {
      if (kind === 'sphere') return mk('circle', pts, plane);          // 球的任何截面都是圓
      var coarse = simplifyContour(pts, 2.0);
      if (coarse.length > 8) {
        // 平面法線平行軸 → 平面垂直於軸，切出圓
        if (parallelToAxis(plane.n)) return mk('circle', pts, plane);
        // 切到平面底／蓋 → 圓弧加直弦的複合截面（不支援）
        if (planeCutsFlatFace(solid, plane)) return mk('composite', pts, plane);
        return mk('ellipse', pts, plane);
      }
      // 邊數少 → 落入下方多邊形判定（長方形、三角形等）
    }

    // 2. 多邊形：簡化後用邊數與角度判定
    var poly = simplifyContour(pts, 2.0);
    var n = poly.length;
    var info = { key: 'quadrilateral', sides: n, poly: poly, pts2D: null };

    function edgeLens(p) {
      var L = [];
      for (var k = 0; k < p.length; k++) L.push(V.dist(p[k], p[(k + 1) % p.length]));
      return L;
    }
    function isParallel(v1, v2) {
      var c = V.cross(V.norm(v1), V.norm(v2));
      return V.len(c) < 1e-2;
    }
    function rightAngles(p) {
      var ok = true;
      for (var k = 0; k < p.length; k++) {
        var a = V.norm(V.sub(p[(k + p.length - 1) % p.length], p[k]));
        var b = V.norm(V.sub(p[(k + 1) % p.length], p[k]));
        if (Math.abs(V.dot(a, b)) > 1e-2) { ok = false; break; }
      }
      return ok;
    }

    if (n === 3) {
      var L = edgeLens(poly);
      var sorted = L.slice().sort(function (a, b) { return a - b; });
      var eq = function (a, b) { return Math.abs(a - b) < 1e-3 * Math.max(a, b, 1e-6); };
      var squareSum = L.map(function (x) { return x * x; }).sort(function (a, b) { return a - b; });
      var isRight = Math.abs(squareSum[0] + squareSum[1] - squareSum[2]) < 1e-3 * squareSum[2];
      if (eq(L[0], L[1]) && eq(L[1], L[2])) return mk('equiTriangle', pts, plane, poly);
      if (eq(L[0], L[1]) || eq(L[1], L[2]) || eq(L[0], L[2])) return mk(isRight ? 'rightTriangle' : 'isoTriangle', pts, plane, poly);
      if (isRight) return mk('rightTriangle', pts, plane, poly);
      return mk('triangle', pts, plane, poly);
    }
    if (n === 4) {
      var e1 = V.sub(poly[1], poly[0]), e2 = V.sub(poly[2], poly[1]);
      var e3 = V.sub(poly[3], poly[2]), e4 = V.sub(poly[0], poly[3]);
      var p1 = isParallel(e1, e3), p2 = isParallel(e2, e4);
      var Ls = edgeLens(poly);
      var eqL = function (a, b) { return Math.abs(a - b) < 1e-3 * Math.max(a, b); };
      if (p1 && p2) {
        if (rightAngles(poly)) return mk(eqL(Ls[0], Ls[1]) ? 'square' : 'rectangle', pts, plane, poly);
        return mk('parallelogram', pts, plane, poly);
      }
      if (p1 || p2) {
        var legsEq = p1 ? eqL(Ls[1], Ls[3]) : eqL(Ls[0], Ls[2]);
        return mk(legsEq ? 'isoTrapezium' : 'trapezium', pts, plane, poly);
      }
      return mk('quadrilateral', pts, plane, poly);
    }
    var map = { 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon' };
    return mk(map[n] || 'quadrilateral', pts, plane, poly);

    function mk(key, pts3, pl, polyPts) {
      var nm = SHAPE_NAME[key] || SHAPE_NAME.none;
      return {
        key: key, zh: nm.zh, en: nm.en, sides: key === 'circle' ? 0 : (polyPts ? polyPts.length : 0),
        contour: pts3.map(function (p) { return p.slice(); }),
        poly: polyPts || null,
        planar: true, normal: pl ? pl.n.slice() : null,
        curved: key === 'circle' || key === 'ellipse',
        unsupported: key === 'composite'
      };
    }
  }

  /* ---------- 驗證工具（測試用） ---------- */
  function watertight(faces, tol) {
    tol = tol || 1e-6;
    var map = {};
    function k(p) { return [Math.round(p[0] / tol), Math.round(p[1] / tol), Math.round(p[2] / tol)].join(','); }
    var bad = 0, count = 0;
    faces.forEach(function (f) {
      var n = f.pts.length;
      for (var i = 0; i < n; i++) {
        var a = k(f.pts[i]), b = k(f.pts[(i + 1) % n]);
        if (a === b) continue;
        var key = a < b ? a + '|' + b : b + '|' + a;
        map[key] = (map[key] || 0) + 1;
        count++;
      }
    });
    for (var kk in map) { if (map[kk] !== 2) bad++; }
    return { ok: bad === 0, unmatched: bad, edges: count };
  }

  function faceArea(f) {
    var a = 0, p = f.pts;
    for (var i = 1; i + 1 < p.length; i++) {
      a += V.len(V.cross(V.sub(p[i], p[0]), V.sub(p[i + 1], p[0]))) / 2;
    }
    return a;
  }
  function surfaceArea(faces) { return faces.reduce(function (s, f) { return s + faceArea(f); }, 0); }

  global.PS.clip = {
    makePlane: makePlane, signed: signed, clipSolid: clipSolid, clipPolygon: clipPolygon,
    classifySection: classifySection, triangulatePlanar: triangulatePlanar,
    triangulate2D: triangulate2D, planeBasis: planeBasis, to2D: to2D,
    simplifyContour: simplifyContour, watertight: watertight,
    sectionBoundaryPoints: sectionBoundaryPoints, buildLoop: buildLoop,
    faceArea: faceArea, surfaceArea: surfaceArea, SHAPE_NAME: SHAPE_NAME
  };
})(typeof window !== 'undefined' ? window : this);
