/* ============================================================
   Peek-a-Shape｜立體探秘樂
   nets.js — 展開圖資料、連續摺合引擎與展開圖驗證
   ・展開圖由立體的真實尺寸生成（面數、形狀、邊長一致）
   ・摺合為連續剛體運動（繞摺線旋轉），不是兩張靜態圖切換
   ・驗證：摺合後每個面必須完全落在立體表面上，無缺口、無重疊
   ============================================================ */
(function (global) {
  'use strict';
  var V = global.PS.V;
  var G = global.PS.geo;
  var EPS = 1e-9;
  var DEG = Math.PI / 180;

  /* ---------- 4x4 矩陣（列主序） ---------- */
  function m4id() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function m4mul(a, b) {
    var o = new Array(16);
    for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) {
      o[r * 4 + c] = a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c] + a[r * 4 + 3] * b[12 + c];
    }
    return o;
  }
  function m4trans(x, y, z) { var m = m4id(); m[3] = x; m[7] = y; m[11] = z; return m; }
  function m4apply(m, p) {
    return [
      m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
      m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
      m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]
    ];
  }
  /* 繞任意軸線旋轉（單位向量 d，角 angle 弧度） */
  function m4rotAxis(px, py, pz, d, angle) {
    var x = d[0], y = d[1], z = d[2], c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
    var R = [
      t * x * x + c, t * x * y - s * z, t * x * z + s * y, 0,
      t * x * y + s * z, t * y * y + c, t * y * z - s * x, 0,
      t * x * z - s * y, t * y * z + s * x, t * z * z + c, 0,
      0, 0, 0, 1
    ];
    return m4mul(m4mul(m4trans(px, py, pz), R), m4trans(-px, -py, -pz));
  }

  /* ---------- 2D 多邊形工具 ---------- */
  function polyCentroid(p) {
    var x = 0, y = 0;
    for (var i = 0; i < p.length; i++) { x += p[i][0]; y += p[i][1]; }
    return [x / p.length, y / p.length];
  }
  function regularPoly2D(n, R, cx, cy, angle0) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var a = (angle0 || Math.PI / 2) + i * 2 * Math.PI / n;
      out.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    return out;
  }
  function arcPoly(cx, cy, R, a0, a1, steps) {
    var out = [];
    for (var i = 0; i <= steps; i++) {
      var a = a0 + (a1 - a0) * i / steps;
      out.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    return out;
  }
  function circlePoly(cx, cy, R, steps) {
    steps = steps || 72;
    var out = [];
    for (var i = 0; i < steps; i++) {
      var a = 2 * Math.PI * i / steps;
      out.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    return out;
  }

  /* 兩種單位方格的展開圖（正方體用），cells: [[col,row],...] */
  function gridNet(side, cells, tree) {
    var map = {};
    cells.forEach(function (c) { map[c[0] + ',' + c[1]] = true; });
    var out = cells.map(function (c, i) {
      var x = c[0] * side, y = c[1] * side;
      return {
        id: 'c' + i, grid: c, group: -1, type: 'poly',
        poly: [[x, y], [x + side, y], [x + side, y + side], [x, y + side]]
      };
    });
    var hinges = tree.map(function (e) {
      var a = out[e[0]], b = out[e[1]];
      var ca = polyCentroid(a.poly), cb = polyCentroid(b.poly);
      // 摺線 = 兩格共用的邊
      var shared = sharedEdge(a.poly, b.poly);
      return { parent: a.id, child: b.id, p: [shared[0][0], shared[0][1]], d: [shared[1][0] - shared[0][0], shared[1][1] - shared[0][1]], angle: 90 };
    });
    return { kind: 'hinge', cells: out, hinges: hinges };
  }

  function sharedEdge(pa, pb) {
    var res = [];
    for (var i = 0; i < pa.length; i++) {
      for (var j = 0; j < pb.length; j++) {
        if (Math.abs(pa[i][0] - pb[j][0]) < 1e-9 && Math.abs(pa[i][1] - pb[j][1]) < 1e-9) res.push(pa[i]);
      }
    }
    if (res.length >= 2) return [res[0], res[1]];
    return [pa[0], pa[1]];
  }

  /* ---------- 展開圖建立 ---------- */
  function buildPrismNet(solid) {
    var n = solid.params.n, R = solid.params.R, h = solid.params.h;
    var s = 2 * R * Math.sin(Math.PI / n);
    var apothem = R * Math.cos(Math.PI / n);
    var cells = [], hinges = [];
    for (var i = 0; i < n; i++) {
      var x = i * s;
      cells.push({ id: 'side' + i, type: 'poly', group: 2 + i, poly: [[x, 0], [x + s, 0], [x + s, h], [x, h]] });
    }
    for (i = 0; i < n - 1; i++) {
      hinges.push({ parent: 'side' + i, child: 'side' + (i + 1), p: [(i + 1) * s, 0], d: [0, 1], angle: 360 / n });
    }
    // 兩個底面：分別接在第一個側面的上邊與下邊
    var base1 = basePolygonOnEdge([0, h], [s, h], n, apothem, 1);
    var base2 = basePolygonOnEdge([0, 0], [s, 0], n, apothem, -1);
    cells.push({ id: 'base1', type: 'poly', group: 1, poly: base1 });
    cells.push({ id: 'base2', type: 'poly', group: 0, poly: base2 });
    hinges.push({ parent: 'side0', child: 'base1', p: [0, h], d: [1, 0], angle: 90 });
    hinges.push({ parent: 'side0', child: 'base2', p: [0, 0], d: [1, 0], angle: 90 });
    return { kind: 'hinge', cells: cells, hinges: hinges };
  }

  /* 在指定邊上長出正 n 邊形（用於柱體底面）
     dirSign = +1：圓心在邊的左側法線方向；-1：右側 */
  function basePolygonOnEdge(p0, p1, n, apothem, dirSign) {
    dirSign = dirSign || 1;
    var ex = [p1[0] - p0[0], p1[1] - p0[1]];
    var len = Math.hypot(ex[0], ex[1]);
    ex = [ex[0] / len, ex[1] / len];
    var left = [-ex[1], ex[0]];
    var cx = (p0[0] + p1[0]) / 2 + left[0] * apothem * dirSign;
    var cy = (p0[1] + p1[1]) / 2 + left[1] * apothem * dirSign;
    var R = apothem / Math.cos(Math.PI / n);
    var start = Math.atan2(p0[1] - cy, p0[0] - cx);
    var step = 2 * Math.PI / n * dirSign; // 圓心在左 → 逆時針
    var out = [];
    for (var i = 0; i < n; i++) {
      var a = start + i * step;
      out.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    return out;
  }

  function buildExtrudedNet(solid) {
    // 長方體：4 個側面 + 2 個底面（十字形展開圖）
    var w = solid.params.w, h = solid.params.h, d = solid.params.d;
    var cells = [], hinges = [];
    var widths = [w, d, w, d];
    var x = 0;
    for (var i = 0; i < 4; i++) {
      cells.push({ id: 'side' + i, type: 'poly', group: 2 + i, poly: [[x, 0], [x + widths[i], 0], [x + widths[i], h], [x, h]] });
      if (i < 3) hinges.push({ parent: 'side' + i, child: 'side' + (i + 1), p: [x + widths[i], 0], d: [0, 1], angle: 90 });
      x += widths[i];
    }
    cells.push({ id: 'base1', type: 'poly', group: 1, poly: [[0, h], [w, h], [w, h + d], [0, h + d]] });
    cells.push({ id: 'base2', type: 'poly', group: 0, poly: [[0, -d], [w, -d], [w, 0], [0, 0]] });
    hinges.push({ parent: 'side0', child: 'base1', p: [0, h], d: [1, 0], angle: 90 });
    hinges.push({ parent: 'side0', child: 'base2', p: [0, 0], d: [1, 0], angle: 90 });
    return { kind: 'hinge', cells: cells, hinges: hinges };
  }

  function buildPyramidNet(solid) {
    var n = solid.params.n, R = solid.params.R, h = solid.params.h, apothem = solid.params.apothem;
    var base = regularPoly2D(n, R, 0, 0, Math.PI / 2);
    var incline = Math.atan2(h, apothem) / DEG;
    var foldAngle = 180 - incline;
    var cells = [{ id: 'base', type: 'poly', group: 0, poly: base }];
    var hinges = [];
    var L = Math.sqrt(apothem * apothem + h * h);
    for (var i = 0; i < n; i++) {
      var a = base[i], b = base[(i + 1) % n];
      var mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      var ex = [b[0] - a[0], b[1] - a[1]];
      var el = Math.hypot(ex[0], ex[1]); ex = [ex[0] / el, ex[1] / el];
      // 由中心指向邊中點的方向（向外）
      var od = [mid[0] - 0, mid[1] - 0];
      var ol = Math.hypot(od[0], od[1]); od = [od[0] / ol, od[1] / ol];
      var apex = [mid[0] + od[0] * L, mid[1] + od[1] * L];
      cells.push({ id: 'tri' + i, type: 'poly', group: 1 + i, poly: [a.slice(), b.slice(), apex] });
      hinges.push({ parent: 'base', child: 'tri' + i, p: a.slice(), d: [b[0] - a[0], b[1] - a[1]], angle: foldAngle });
    }
    return { kind: 'hinge', cells: cells, hinges: hinges };
  }

  function buildCylinderNet(solid) {
    var r = solid.params.r, h = solid.params.h;
    var w = 2 * Math.PI * r;
    var cells = [
      { id: 'side', type: 'roll', group: 2, poly: [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] },
      { id: 'cap0', type: 'circle', group: 0, center: [0, -h / 2 - r], r: r, poly: circlePoly(0, -h / 2 - r, r, 72) },
      { id: 'cap1', type: 'circle', group: 1, center: [0, h / 2 + r], r: r, poly: circlePoly(0, h / 2 + r, r, 72) }
    ];
    return { kind: 'roll', cells: cells, r: r, h: h, w: w };
  }

  function buildConeNet(solid) {
    var r = solid.params.r, h = solid.params.h;
    var L = Math.sqrt(r * r + h * h);
    var alpha = 2 * Math.PI * r / L;
    var steps = 72;
    var a0 = -Math.PI / 2 - alpha / 2, a1 = -Math.PI / 2 + alpha / 2;
    var sector = [[0, 0]].concat(arcPoly(0, 0, L, a0, a1, steps));
    var bearingCenter = [0, -L - r];
    var cells = [
      { id: 'side', type: 'cone-side', group: 1, poly: sector, L: L, alpha: alpha },
      { id: 'base', type: 'circle', group: 0, center: bearingCenter, r: r, poly: circlePoly(bearingCenter[0], bearingCenter[1], r, 72) }
    ];
    return { kind: 'conic', cells: cells, r: r, h: h, L: L, alpha: alpha };
  }

  /* ---------- 摺合矩陣（hinge 類型） ---------- */
  function hingeTransforms(net, t) {
    var byId = {};
    net.cells.forEach(function (c) { byId[c.id] = c; });
    var M = {};
    var root = net.cells[0].id;
    M[root] = m4id();
    // 由根逐層展開
    var childrenOf = {};
    net.hinges.forEach(function (hg) {
      (childrenOf[hg.parent] = childrenOf[hg.parent] || []).push(hg);
    });
    var queue = [root];
    while (queue.length) {
      var cur = queue.shift();
      (childrenOf[cur] || []).forEach(function (hg) {
        var parentM = M[cur] || m4id();
        var child = byId[hg.child];
        var cc = polyCentroid(child.poly);
        var d3 = [hg.d[0], hg.d[1], 0];
        var dl = Math.hypot(d3[0], d3[1]) || 1;
        d3 = [d3[0] / dl, d3[1] / dl, 0];
        var w = [cc[0] - hg.p[0], cc[1] - hg.p[1], 0];
        var along = w[0] * d3[0] + w[1] * d3[1];
        w = [w[0] - along * d3[0], w[1] - along * d3[1], 0];
        // d × w 的 z 分量：決定旋轉正負，使面永遠向 +z 摺起
        var crossZ = d3[0] * w[1] - d3[1] * w[0];
        var sign = crossZ >= 0 ? 1 : -1;
        var ang = sign * hg.angle * DEG * t;
        var R = m4rotAxis(hg.p[0], hg.p[1], 0, d3, ang);
        M[hg.child] = m4mul(parentM, R);
        queue.push(hg.child);
      });
    }
    return M;
  }

  /* 由「摺合後的位置」找出每個 cell 對應的立體面（多面體用）。
     用途：正方體等以方格組成的展開圖，資料本身沒有記錄每個面屬於哪一組，
     我們就在摺合後用面法線與位置做幾何配對，確保對應關係正確。 */
  function matchCellsToFaces(net) {
    var solid = net.solid;
    if (!solid || solid.kind !== 'poly') return;
    var need = net.cells.some(function (c) { return !(c.group >= 0); });
    if (!need) return;
    // 把摺合後的展開圖平移到與立體同一位置（兩者的「面中心平均」對齊）
    function meanC(list) {
      var s = [0, 0, 0], n = 0;
      list.forEach(function (c) { s = V.add(s, c); n++; });
      return [s[0] / n, s[1] / n, s[2] / n];
    }
    var folded = net.cells.map(function (c) {
      return c.poly.map(function (p) { return net.warp(c.id, 1, [p[0], p[1], 0]); });
    });
    var cf = meanC(folded.map(function (p) { return V.centroid(p); }));
    var cs = meanC(solid.faces.map(function (f) { return V.centroid(f.pts); }));
    var shift = [cs[0] - cf[0], cs[1] - cf[1], cs[2] - cf[2]];

    var used = {};
    net.cells.forEach(function (c) { if (c.group >= 0) used[c.group] = true; });
    net.cells.forEach(function (c, idx) {
      if (c.group >= 0) return;
      var pts = folded[idx].map(function (p) { return V.add(p, shift); });
      var cn = G.polyNormal(pts);
      var cc = V.centroid(pts);
      var best = -1, bestD = Infinity;
      for (var fi = 0; fi < solid.faces.length; fi++) {
        if (used[fi]) continue;
        var f = solid.faces[fi];
        if (Math.abs(V.dot(cn, f.n)) < 0.9) continue;           // 方向（允許正負，因摺線定向可能相反）
        var d = Math.abs(V.dot(f.n, V.sub(cc, f.pts[0])));       // 必須共平面
        if (d > 5e-3) continue;
        var inPlane = V.dist(cc, V.centroid(f.pts));            // 面中心要重合
        if (inPlane < bestD) { bestD = inPlane; best = fi; }
      }
      if (best >= 0) { c.group = best; used[best] = true; }
    });
  }

  /* ---------- 展開圖物件 ---------- */
  function finalize(net, solid, shapeId, meta) {
    net.shapeId = shapeId;
    net.solid = solid;
    net.id = (meta && meta.id) || shapeId + '-net';
    net.label = meta && meta.label ? meta.label : null;
    net.solidToCell = {};
    net.cellToSolid = {};
    net.cells.forEach(function (c) { if (c.group >= 0) { net.solidToCell[c.group] = c.id; net.cellToSolid[c.id] = c.group; } });

    if (net.kind === 'hinge') {
      var cache = {};
      net.transforms = function (t) {
        var k = Math.round(t * 1000);
        if (!cache[k]) cache[k] = hingeTransforms(net, t);
        return cache[k];
      };
      net.warp = function (cellId, t, p) { return m4apply(net.transforms(t)[cellId] || m4id(), p); };
    } else if (net.kind === 'roll') {
      var r = net.r, h = net.h;
      var centerOf = function (id) { return cellCenter(net, id); };
      net.warp = function (cellId, t, p) {
        if (cellId === 'side') {
          if (t < 1e-4) return [p[0], p[1], 0];
          var R = r / t;
          var th = p[0] / R;
          return [R * Math.sin(th), p[1], R * Math.cos(th) - R + t * r];
        }
        var c0 = centerOf(cellId);
        var targetY = cellId === 'cap0' ? -h / 2 : h / 2;
        var dx = p[0] - c0[0], dy = p[1] - c0[1];
        var flat = [c0[0] + dx, c0[1] + dy, 0];
        var fin = [dx, targetY, dy];            // 平面圓（法線 z）→ 水平圓（法線 y）
        return [flat[0] + t * (fin[0] - flat[0]), flat[1] + t * (fin[1] - flat[1]), t * fin[2]];
      };
    } else if (net.kind === 'conic') {
      var hh = net.h, L = net.L, alpha = net.alpha;
      var centerOf2 = function (id) { return cellCenter(net, id); };
      // 可展曲面（developable）連續彎曲：
      //   t=0 → 平面展開圖（z=0），t=1 → 完整圓錐面。
      // 過程中每一點到錐頂的距離（斜邊長）保持不變，所以看起來是真的把扇形「捲」成圓錐，
      // 而不是把頂點線性拉過去（舊做法會把紙片壓扁）。
      net.warp = function (cellId, t, p) {
        var psi = alpha + (2 * Math.PI - alpha) * t;      // 目前捲起的總角度
        var s = Math.min(1, alpha / psi);                 // sin(半頂角)
        var c = Math.sqrt(Math.max(0, 1 - s * s));        // cos(半頂角)
        var om = -Math.PI / 2 * (1 - t);                  // 由「水平面」轉回直立的展開圖平面
        var co = Math.cos(om), si = Math.sin(om);
        var ay = hh / 2 * t;                              // 錐頂由展開圖原點升到 h/2
        var rot = function (q) {
          return [q[0], q[1] * co - q[2] * si, q[1] * si + q[2] * co];
        };
        if (cellId === 'side') {
          var rho = Math.hypot(p[0], p[1]);
          if (rho < 1e-9) return [0, ay, 0];              // 錐頂
          var beta = Math.atan2(p[0], -p[1]);
          var phi = -Math.PI / 2 + beta / s;
          var q1 = rot([rho * s * Math.cos(phi), -rho * c, rho * s * Math.sin(phi)]);
          return [q1[0], q1[1] + ay, q1[2]];
        }
        // 底圓：保持剛體（大小不變），由攤平位置平滑移到錐底
        var c0 = centerOf2(cellId);
        var dx = p[0] - c0[0], dy = p[1] - c0[1];
        var rr = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
        var ctr = rot([0, -L * c, 0]);                    // 錐底圓心
        var e2 = rot([0, 0, 1]);                          // 錐底圓所在的平面方向
        var tx = ctr[0] + rr * Math.cos(ang) + e2[0] * rr * Math.sin(ang);
        var ty = ctr[1] + ay + e2[1] * rr * Math.sin(ang);
        var tz = ctr[2] + e2[2] * rr * Math.sin(ang);
        var fx = c0[0] + dx, fy = c0[1] + dy;             // 攤平位置（z=0）
        return [fx + (tx - fx) * t, fy + (ty - fy) * t, tz * t];
      };
    } else {
      net.warp = function (cellId, t, p) { return [p[0], p[1], 0]; };
    }

    /* 每個 cell 的三角形（攤平座標，z=0） */
    net.cellTris = function (cellId) {
      var cell = null;
      net.cells.forEach(function (c) { if (c.id === cellId) cell = c; });
      if (!cell) return [];
      var out = [];
      var poly = cell.poly;
      for (var i = 1; i + 1 < poly.length; i++) {
        out.push([[poly[0][0], poly[0][1], 0], [poly[i][0], poly[i][1], 0], [poly[i + 1][0], poly[i + 1][1], 0]]);
      }
      return out;
    };
    net.warpTri = function (cellId, t, tri) {
      return tri.map(function (p) { return net.warp(cellId, t, p); });
    };

    // 補上以幾何配對得出的「展開圖面 ↔ 立體面」對應
    matchCellsToFaces(net);
    net.solidToCell = {};
    net.cellToSolid = {};
    net.cells.forEach(function (c) {
      if (c.group >= 0) { net.solidToCell[c.group] = c.id; net.cellToSolid[c.id] = c.group; }
    });
    return net;
  }

  function cellCenter(net, id) {
    var c = null;
    net.cells.forEach(function (x) { if (x.id === id) c = x; });
    return c ? c.center : [0, 0];
  }

  /* ---------- 對外 API ---------- */
  var cache = {};
  function build(shapeId, variant) {
    var solid = G.getSolid(shapeId);
    var key = shapeId + '#' + (variant || 0);
    if (cache[key]) return cache[key];

    if (shapeId === 'sphere') {
      var netS = {
        kind: 'none', shapeId: 'sphere', solid: solid, cells: [], variants: 0,
        message: {
          zh: '球體的表面是曲面，不能像正方體一樣攤平成由直邊組成的展開圖。我們可以轉動球體，觀察它的曲面。',
          en: 'The surface of a sphere is curved. It cannot be flattened into a net made of straight edges like a cube. Turn the sphere to explore its curved surface.'
        }
      };
      return (cache[key] = netS);
    }
    var raw, meta, variants = 1;
    if (shapeId === 'cube') {
      variants = 3;
      var side = solid.params.w;
      var v = variant || 0;
      if (v === 0) {
        raw = gridNet(side, [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [1, -1]], [[0, 1], [1, 2], [2, 3], [1, 4], [1, 5]]);
      } else if (v === 1) {
        raw = gridNet(side, [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [3, -1]], [[0, 1], [1, 2], [2, 3], [0, 4], [3, 5]]);
      } else {
        raw = gridNet(side, [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]);
      }
      meta = { id: 'cube-net' + v, label: { zh: '正方體展開圖 ' + (v + 1), en: 'Cube net ' + (v + 1) } };
    } else if (shapeId === 'cuboid') {
      raw = buildExtrudedNet(solid);
    } else if (shapeId === 'cylinder') {
      raw = buildCylinderNet(solid);
    } else if (shapeId === 'cone') {
      raw = buildConeNet(solid);
    } else if (shapeId.indexOf('Prism') >= 0) {
      if (shapeId === 'quadPrism') {
        // 四角柱用正方形底（與立體一致）
        raw = buildPrismNet(solid);
      } else {
        raw = buildPrismNet(solid);
      }
    } else if (shapeId.indexOf('Pyramid') >= 0) {
      raw = buildPyramidNet(solid);
    }
    if (!raw) return null;
    raw.variants = variants;
    var net = finalize(raw, solid, shapeId, meta);
    cache[key] = net;
    return net;
  }

  function variants(shapeId) {
    if (shapeId === 'cube') return 3;
    if (shapeId === 'sphere') return 0;
    return 1;
  }

  /* ---------- 展開圖驗證（幾何） ---------- */
  function polyPointInside3D(pt, poly, normal, tol) {
    tol = tol || 2e-3;
    var p0 = poly[0];
    var dn = V.dot(V.sub(pt, p0), normal);
    if (Math.abs(dn) > tol) return false;
    var basis = global.PS.clip.planeBasis(normal);
    var x0 = 0, y0 = 0;
    var pts = poly.map(function (p) { var d = V.sub(p, p0); return [V.dot(d, basis[0]), V.dot(d, basis[1])]; });
    var target = [V.dot(V.sub(pt, p0), basis[0]), V.dot(V.sub(pt, p0), basis[1])];
    // 射線法
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > target[1]) !== (yj > target[1])) &&
        (target[0] < (xj - xi) * (target[1] - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  function onSolidSurface(solid, pt, tol) {
    tol = tol || 3e-3;
    var P = solid.params || {};
    // 曲面體：用解析式配合給定容差判斷，避免硬編碼容差過嚴而誤判摺合後的面
    if (solid.kind === 'cylinder') {
      var rad = Math.hypot(pt[0], pt[2]);
      if (Math.abs(rad - P.r) <= tol && Math.abs(pt[1]) <= P.h / 2 + tol) return true;
      if (Math.min(Math.abs(pt[1] - P.h / 2), Math.abs(pt[1] + P.h / 2)) <= tol && rad <= P.r + tol) return true;
      return false;
    }
    if (solid.kind === 'cone') {
      var rad2 = Math.hypot(pt[0], pt[2]);
      var tt = (P.h / 2 - pt[1]) * P.slope; // 該高度應有的半徑
      if (Math.abs(rad2 - tt) <= tol && pt[1] <= P.h / 2 + tol && pt[1] >= -P.h / 2 - tol) return true;
      if (Math.abs(pt[1] + P.h / 2) <= tol && rad2 <= P.r + tol) return true;
      return false;
    }
    if (solid.kind === 'sphere') {
      return Math.abs(V.len(pt) - P.r) <= tol;
    }
    var maxd = -Infinity;
    for (var i = 0; i < solid.faces.length; i++) {
      var f = solid.faces[i];
      var d = V.dot(f.n, V.sub(pt, f.pts[0]));
      if (d > tol) return false;
      if (d > maxd) maxd = d;
    }
    return Math.abs(maxd) <= tol;
  }

  /* 摺合後以「無向邊出現次數」檢查水密性（封閉曲面每個邊恰被兩個面共用） */
  function foldedEdgeCheck(cellPolys, quantum) {
    quantum = quantum || 1e-6;
    function rk(v) { return Math.round(v / quantum); }
    function keyOf3(p) { return rk(p[0]) + ',' + rk(p[1]) + ',' + rk(p[2]); }
    var counts = {};
    cellPolys.forEach(function (cp) {
      var p = cp.pts;
      for (var i = 0; i < p.length; i++) {
        var a = keyOf3(p[i]), b = keyOf3(p[(i + 1) % p.length]);
        var k = a < b ? a + '|' + b : b + '|' + a;
        counts[k] = (counts[k] || 0) + 1;
      }
    });
    var bad = [], total = 0;
    for (var k in counts) { total++; if (counts[k] !== 2) bad.push({ e: k, n: counts[k] }); }
    return { watertight: bad.length === 0, bad: bad, edges: total };
  }

  /* 展開圖驗證：
     ・多面體：摺合後必須拼成封閉曲面（水密，每個邊恰共用兩次）、面與面不得重疊、面積守恆。
       （摺合是繞摺線的剛體運動，不需再對齊；摺後形狀最多與立體差一個剛體運動）
     ・曲面體（圓柱／圓錐）：先平移對齊，再檢查每個取樣點都落在立體表面上，且面積守恆。 */
  function verifyNet(net, shapeId, opts) {
    opts = opts || {};
    shapeId = shapeId || net.shapeId;
    var solid = G.getSolid(shapeId);
    var t = 1;
    var cellPolys = [];
    net.cells.forEach(function (c) {
      var pts = c.poly.map(function (p) { return net.warp(c.id, t, [p[0], p[1], 0]); });
      var nrm = G.polyNormal(pts);
      cellPolys.push({ id: c.id, pts: pts, n: nrm });
    });

    // 面積守恆：展開圖面積應等於立體表面積
    var netArea = 0;
    net.cells.forEach(function (c) {
      var p = c.poly, a = 0;
      for (var i = 0; i < p.length; i++) {
        var q = p[(i + 1) % p.length];
        a += p[i][0] * q[1] - q[0] * p[i][1];
      }
      netArea += Math.abs(a) / 2;
    });
    var solArea = global.PS.clip.surfaceArea(solid.faces);
    var areaErr = Math.abs(netArea - solArea) / solArea;
    var areaOk = areaErr <= (opts.areaTol || 0.02);

    if (solid.kind === 'poly') {
      var edgeRes = foldedEdgeCheck(cellPolys, opts.quantum);

      // 重疊：只有真正共平面（法線同向且同一平面）的面帶才可能重疊；相鄰面只共邊不算。
      var overlaps = [];
      for (var i = 0; i < cellPolys.length; i++) {
        for (var j = i + 1; j < cellPolys.length; j++) {
          var A = cellPolys[i], B = cellPolys[j];
          if (V.dot(A.n, B.n) < 0.999) continue;
          if (Math.abs(V.dot(A.n, V.sub(B.pts[0], A.pts[0]))) > 1e-3) continue;
          var aPts = samplePoly(A.pts, opts.perCell || 6);
          var bPts = samplePoly(B.pts, opts.perCell || 6);
          var hit = 0;
          aPts.forEach(function (p) { if (polyPointInside3D(p, B.pts, B.n, 1e-3)) hit++; });
          bPts.forEach(function (p) { if (polyPointInside3D(p, A.pts, A.n, 1e-3)) hit++; });
          if (hit > 0) overlaps.push({ id: A.id + 'x' + B.id, a: A.id, b: B.id, hit: hit });
        }
      }

      var okPoly = edgeRes.watertight && overlaps.length === 0 && areaOk;
      return {
        ok: okPoly, kind: 'poly', offSolid: [], overlaps: overlaps,
        uncovered: 0, samples: 0, areaErr: areaErr, netArea: netArea, solArea: solArea,
        watertight: edgeRes.watertight, badEdges: edgeRes.bad, edges: edgeRes.edges,
        solid: solid, cellPolys: cellPolys
      };
    }

    // 曲面體：把摺合後的展開圖平移，使兩者中心重合後再比對
    function bbCenter(ptsList) {
      var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      ptsList.forEach(function (pts) {
        pts.forEach(function (p) {
          for (var d = 0; d < 3; d++) { if (p[d] < mn[d]) mn[d] = p[d]; if (p[d] > mx[d]) mx[d] = p[d]; }
        });
      });
      return [0, 1, 2].map(function (d) { return (mn[d] + mx[d]) / 2; });
    }
    var allCellPts = [];
    cellPolys.forEach(function (c) { allCellPts = allCellPts.concat(c.pts); });
    var allSolidPts = [];
    solid.faces.forEach(function (f) { allSolidPts = allSolidPts.concat(f.pts); });
    var netC = bbCenter([allCellPts]), solC = bbCenter([allSolidPts]);
    var shift = [0, 1, 2].map(function (d) { return solC[d] - netC[d]; });
    cellPolys.forEach(function (c) { c.pts = c.pts.map(function (p) { return V.add(p, shift); }); });

    var offSolid = [];
    cellPolys.forEach(function (cp) {
      var pts = samplePoly(cp.pts, opts.perCell || 6);
      var bad = 0;
      pts.forEach(function (p) { if (!onSolidSurface(solid, p, opts.tol || 3e-3)) bad++; });
      if (bad > 0) offSolid.push({ id: cp.id, bad: bad, total: pts.length });
    });

    return {
      ok: offSolid.length === 0 && areaOk, kind: solid.kind, offSolid: offSolid, overlaps: [],
      uncovered: 0, samples: 0, areaErr: areaErr, netArea: netArea, solArea: solArea,
      watertight: null, badEdges: [], edges: 0,
      solid: solid, cellPolys: cellPolys
    };
  }

  function samplePoly(pts, n) {
    n = n || 5;
    var out = [];
    // 以頂點 0 作扇形三角化，逐個三角形取樣（適用於任意凸多邊形 cell）
    for (var k = 1; k + 1 < pts.length; k++) {
      var a = pts[0], b = pts[k], c = pts[k + 1];
      for (var i = 1; i <= n; i++) {
        for (var j = 1; j <= n; j++) {
          var u = i / (n + 1), v = j / (n + 1);
          if (u + v > 1) continue;
          out.push(V.add(V.add(V.mul(a, 1 - u - v), V.mul(b, u)), V.mul(c, v)));
        }
      }
    }
    // 注意：不要加入多邊形質心。曲面 length（例如圓錐側面攤平後繞成整圈）
    // 的質心會落在立體內部（例如圓錐的中軸上），並非在表面上，會造成誤判。
    return out;
  }

  /* ---------- 錯誤展開圖（示範用）：保證幾何上不能摺成目標立體 ---------- */
  function distractorNet(shapeId, kind) {
    if (shapeId === 'cube') {
      var side = G.getSolid('cube').params.w;
      if (kind === 'block23') {
        var raw = gridNet(side, [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
          [[0, 1], [1, 2], [0, 3], [3, 4], [4, 5]]);
        return finalize(raw, G.getSolid('cube'), 'cube', { id: 'cube-block23' });
      }
      if (kind === 'five') {
        var raw5 = gridNet(side, [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1]],
          [[0, 1], [1, 2], [2, 3], [1, 4]]);
        return finalize(raw5, G.getSolid('cube'), 'cube', { id: 'cube-five' });
      }
    }
    if (kind === 'other') {
      // 用另一個立體的展開圖當錯誤選項（保證不是本立體的展開圖）
      var other = shapeId === 'cube' ? 'triPrism' : 'cube';
      return build(other, 0);
    }
    return null;
  }

  global.PS.nets = {
    build: build, variants: variants, verifyNet: verifyNet,
    distractorNet: distractorNet, onSolidSurface: onSolidSurface,
    __internal: { gridNet: gridNet, finalize: finalize, hingeTransforms: hingeTransforms }
  };
})(typeof window !== 'undefined' ? window : this);
