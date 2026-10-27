/* ============================================================
   Peek-a-Shape｜立體探秘樂
   viewer.js — 以 Three.js 顯示立體、切割結果與展開圖
   ・自製環繞相機（拖動旋轉、滾輪／雙指縮放、自動旋轉）
   ・每個面依語意分組上色，可高亮、可點選
   ・棱（藍線）與頂點（黃點）圖層
   ・切割成兩塊、截面（紫／粉）高亮
   ・切割平面預覽
   ・展開圖連續摺合
   ============================================================ */
(function (global) {
  'use strict';
  var THREE = global.THREE;
  var V = global.PS.V;
  var G = global.PS.geo;

  var PALETTE = [0x4ea8f2, 0xffb84d, 0x8bd17c, 0xb98cff, 0xff8fab, 0x59d3c8,
    0xffc2a0, 0xffe066, 0x9ad0ff, 0xff9f7f, 0xc5e86c, 0xf2a4d8];
  var HILITE = 0x9be36a;      // 淺綠（高亮面）
  var CAPCOL = 0xc46bff;      // 紫（截面）
  var CAPCOL2 = 0xff7fd0;     // 粉（另一塊的截面）
  var EDGECOL = 0x1e6fd0;     // 藍（棱）
  var VERTCOL = 0xffd400;     // 黃（頂點）
  var EDGER = 0.035;          // 棱的粗細（以圓柱／圓環繪製，確保真正加粗）

  function colorOf(g) { return PALETTE[((g % PALETTE.length) + PALETTE.length) % PALETTE.length]; }

  /* 頂點圓點貼圖：用 canvas 畫一個實心圓，
     讓 PointsMaterial 顯示成「圓點」而不是預設的方形點。 */
  var _dotTex = null;
  function vDotTexture() {
    if (_dotTex) return _dotTex;
    var s = 64;
    var cv = document.createElement('canvas');
    cv.width = cv.height = s;
    var ctx = cv.getContext('2d');
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    var tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    _dotTex = tex;
    return tex;
  }

  function disposeObj(o) {
    if (!o) return;
    o.traverse(function (n) {
      if (n.geometry) n.geometry.dispose();
      if (n.material) {
        if (Array.isArray(n.material)) n.material.forEach(function (m) { m.dispose(); });
        else n.material.dispose();
      }
    });
  }

  /* 計算多個 mesh 的世界邊界（幾何本身，不計父層位移） */
  function boundsOfMeshes(meshes) {
    var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], any = false;
    meshes.forEach(function (mesh) {
      var a = mesh.geometry && mesh.geometry.getAttribute && mesh.geometry.getAttribute('position');
      if (!a) return;
      for (var i = 0; i < a.count; i++) {
        any = true;
        var x = a.getX(i), y = a.getY(i), z = a.getZ(i);
        if (x < mn[0]) mn[0] = x; if (x > mx[0]) mx[0] = x;
        if (y < mn[1]) mn[1] = y; if (y > mx[1]) mx[1] = y;
        if (z < mn[2]) mn[2] = z; if (z > mx[2]) mx[2] = z;
      }
    });
    if (!any) return null;
    return {
      mn: mn, mx: mx,
      c: [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2],
      size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]]
    };
  }

  function Viewer(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    var cv = this.renderer.domElement;
    cv.style.width = '100%';
    cv.style.height = '100%';
    cv.style.display = 'block';
    cv.style.touchAction = 'none';
    container.appendChild(cv);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    var d1 = new THREE.DirectionalLight(0xffffff, 0.72); d1.position.set(5, 8, 7); this.scene.add(d1);
    var d2 = new THREE.DirectionalLight(0xffffff, 0.34); d2.position.set(-6, -4, -6); this.scene.add(d2);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.theta = 0.7; this.phi = 1.12; this.radius = 6.4;
    this.autoRotate = false;
    this._pointers = {};
    this._pinch = 0;
    this.overlayState = { edges: false, vertices: false };
    this.xray = false;

    this.meshes = [];
    this.triGroup = [];
    this.solidMesh = null;
    this.solid = null;
    this.hlGroup = null;
    this.cellMeshes = [];
    this.foldT = 0;
    this.net = null;
    this._content = new THREE.Group();
    this.root.add(this._content);

    this._bind();
    this.resize();
    var self = this;
    global.addEventListener('resize', function () { self.resize(); });
    this._loop = this._loop.bind(this);
    global.requestAnimationFrame(this._loop);
  }

  Viewer.prototype._bind = function () {
    var cv = this.renderer.domElement, self = this;
    function down(e) {
      if (cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (err) {} }
      self._pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(self._pointers).length === 2) self._pinch = self._pinchDist();
    }
    function move(e) {
      var p = self._pointers[e.pointerId];
      if (!p) return;
      var keys = Object.keys(self._pointers);
      if (keys.length >= 2) {
        p.x = e.clientX; p.y = e.clientY;
        var nd = self._pinchDist();
        if (self._pinch > 0 && nd > 0) {
          self.radius *= self._pinch / nd;
          self.radius = Math.max(2.2, Math.min(18, self.radius));
        }
        self._pinch = nd;
        return;
      }
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      self.theta -= dx * 0.008;
      self.phi -= dy * 0.008;
      self.phi = Math.max(0.08, Math.min(Math.PI - 0.08, self.phi));
    }
    function up(e) {
      delete self._pointers[e.pointerId];
      if (Object.keys(self._pointers).length < 2) self._pinch = 0;
    }
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', up);
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      self.radius *= Math.exp(e.deltaY * 0.0012);
      self.radius = Math.max(2.2, Math.min(18, self.radius));
    }, { passive: false });
  };

  Viewer.prototype._pinchDist = function () {
    var ks = Object.keys(this._pointers);
    if (ks.length < 2) return 0;
    var a = this._pointers[ks[0]], b = this._pointers[ks[1]];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  Viewer.prototype.resize = function () {
    var w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._w = w; this._h = h;
  };

  Viewer.prototype._applyCamera = function () {
    var r = this.radius, phi = this.phi, th = this.theta;
    this.camera.position.set(r * Math.sin(phi) * Math.sin(th), r * Math.cos(phi), r * Math.sin(phi) * Math.cos(th));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
  };

  Viewer.prototype._loop = function () {
    // 容器大小改變時自動調整（例如縮圖在加入 DOM 後才取得實際尺寸）
    if (this.container.clientWidth !== this._w || this.container.clientHeight !== this._h) this.resize();
    if (this.autoRotate && Object.keys(this._pointers).length === 0) this.theta += 0.006;
    this._applyCamera();
    this.renderer.render(this.scene, this.camera);
    global.requestAnimationFrame(this._loop);
  };

  Viewer.prototype.resetView = function () { this.theta = 0.7; this.phi = 1.12; this.radius = 6.4; };
  Viewer.prototype.zoom = function (factor) { this.radius = Math.max(2.2, Math.min(18, this.radius * factor)); };

  Viewer.prototype.clear = function () {
    if (this._content) { this.root.remove(this._content); disposeObj(this._content); }
    this._content = new THREE.Group();
    this.root.add(this._content);
    this.meshes = []; this.triGroup = []; this.solidMesh = null;
    this.solid = null; this.hlGroup = null;
    this.cellMeshes = []; this.net = null; this.pieces = null;
    this.pieceA = null; this.pieceB = null;
    this.planeObj = null;
    this.baseColors = null; this.colorAttr = null;
  };

  /* ---------- 建立面網格 ---------- */
  Viewer.prototype._faceTris = function (pts) {
    var out = [];
    for (var i = 1; i + 1 < pts.length; i++) out.push([pts[0], pts[i], pts[i + 1]]);
    return out;
  };

  Viewer.prototype._buildFaceMesh = function (faces, opts) {
    opts = opts || {};
    var pos = [], col = [], tri = [];
    var groupOf = opts.groupOf || function (f, i) { return (f.group !== undefined ? f.group : i); };
    var colorOfFace = opts.colorOfFace || function (g) { return colorOf(g); };
    faces.forEach(function (f, fi) {
      var g = groupOf(f, fi);
      var c = new THREE.Color(colorOfFace(g, f));
      this._faceTris(f.pts).forEach(function (t) {
        t.forEach(function (p) { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b); });
        tri.push(g);
      });
    }, this);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    var mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
    return { geo: geo, mat: mat, tri: tri, baseColors: col.slice() };
  };

  Viewer.prototype._overlays = function (solid) {
    var group = new THREE.Group();
    group.visible = false;
    var edgeMat = new THREE.MeshBasicMaterial({ color: EDGECOL });
    var up = new THREE.Vector3(0, 1, 0);

    // 以細圓柱表示一條直棱，確保在 WebGL 上真正加粗（linewidth 多數平台無效）
    function addTube(a, b) {
      var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-6) return;
      var mesh = new THREE.Mesh(new THREE.CylinderGeometry(EDGER, EDGER, len, 8, 1, false), edgeMat);
      mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      mesh.quaternion.setFromUnitVectors(up, new THREE.Vector3(dx, dy, dz).normalize());
      mesh.userData.overlay = 'edges';
      mesh.renderOrder = 0;
      group.add(mesh);
    }
    // 以圓環表示彎曲的圓邊（圓柱／圓錐的底）
    function addRing(radius, y) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(radius, EDGER, 8, 96), edgeMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      ring.userData.overlay = 'edges';
      ring.renderOrder = 0;
      group.add(ring);
    }

    var verts = [];
    if (solid.kind === 'poly') {
      var topo = G.topology(solid.faces);
      verts = topo.verts;
      topo.edges.forEach(function (e) { addTube(verts[e[0]], verts[e[1]]); });
    } else if (solid.kind === 'cylinder') {
      addRing(solid.params.r, solid.params.h / 2);
      addRing(solid.params.r, -solid.params.h / 2);
    } else if (solid.kind === 'cone') {
      addRing(solid.params.r, -solid.params.h / 2);
      verts = [[0, solid.params.h / 2, 0]];
    }

    if (verts.length) {
      var vg = new THREE.BufferGeometry();
      var vp = [];
      verts.forEach(function (p) { vp.push(p[0], p[1], p[2]); });
      vg.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3));
      var pts = new THREE.Points(vg, new THREE.PointsMaterial({
        color: VERTCOL, size: 0.26, sizeAttenuation: true,
        map: vDotTexture(), alphaTest: 0.5,
        depthWrite: false, depthTest: false, transparent: true
      }));
      pts.userData.overlay = 'vertices';
      pts.renderOrder = 100;
      group.add(pts);
    }
    group.children.forEach(function (c) { c.visible = false; });
    return group;
  };

  Viewer.prototype.showSolid = function (solid) {
    this.clear();
    this.shapeId = solid.id;
    this.solid = solid;
    var m = this._buildFaceMesh(solid.faces);
    var mesh = new THREE.Mesh(m.geo, m.mat);
    mesh.userData.kind = 'solid';
    this._content.add(mesh);
    this.solidMesh = mesh;
    this.meshes = [mesh];
    this.triGroup = m.tri;
    this.baseColors = m.baseColors;
    this.colorAttr = m.geo.getAttribute('color');
    this.overlay = this._overlays(solid);
    this._content.add(this.overlay);
    this.overlayState = { edges: false, vertices: false };
    this.highlight = {};
    this._applyHighlight();
    this._updateOverlayVisibility();
    this.setXRay(this.xray);
    return solid;
  };

  /* ---------- 透視模式 X-Ray ----------
     立體變半透明，棱（藍線）與頂點（黃點）自動顯示，以顏色區分結構。 */
  Viewer.prototype.setXRay = function (on) {
    this.xray = !!on;
    if (this.solidMesh) {
      var m = this.solidMesh.material;
      m.transparent = this.xray;
      m.opacity = this.xray ? 0.34 : 1;
      m.depthWrite = !this.xray;
      m.needsUpdate = true;
    }
    this._updateOverlayVisibility();
  };

  Viewer.prototype._updateOverlayVisibility = function () {
    if (!this.overlay) return;
    var showEdges = !!(this.overlayState.edges || this.xray);
    var showVerts = !!(this.overlayState.vertices || this.xray);
    this.overlay.children.forEach(function (c) {
      if (c.userData.overlay === 'edges') c.visible = showEdges;
      if (c.userData.overlay === 'vertices') c.visible = showVerts;
    });
    this.overlay.visible = showEdges || showVerts;
  };

  Viewer.prototype.setOverlay = function (kind, on) {
    this.overlayState[kind] = on;
    this._updateOverlayVisibility();
  };

  /* ---------- 高亮 ----------
     面：半透明綠色（另建覆蓋層，可看穿棱與頂點）。
     棱：藍色線段。頂點：黃色小圓點。 */
  Viewer.prototype._applyHighlight = function () {
    // 1) 底色：被選的面塗成綠色，確保清楚看見「面變色」
    if (this.colorAttr && this.baseColors) {
      var arr = this.colorAttr.array;
      var hc = new THREE.Color(HILITE);
      for (var i = 0; i < this.triGroup.length; i++) {
        if (this.highlight[this.triGroup[i]]) {
          arr[i * 3] = hc.r; arr[i * 3 + 1] = hc.g; arr[i * 3 + 2] = hc.b;
        } else {
          arr[i * 3] = this.baseColors[i * 3];
          arr[i * 3 + 1] = this.baseColors[i * 3 + 1];
          arr[i * 3 + 2] = this.baseColors[i * 3 + 2];
        }
      }
      this.colorAttr.needsUpdate = true;
    }
    // 2) 半透明綠色覆蓋層（可看穿棱與頂點；透視模式下更明顯）
    if (this.hlGroup) { this._content.remove(this.hlGroup); disposeObj(this.hlGroup); this.hlGroup = null; }
    if (!this.solid) return;
    var faces = this.solid.faces || [];
    var self = this;
    var group = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({
      color: HILITE, transparent: true, opacity: 0.55,
      side: THREE.DoubleSide, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    faces.forEach(function (f, i) {
      var g = (f.group !== undefined ? f.group : i);
      if (!self.highlight[g]) return;
      var pos = [];
      self._faceTris(f.pts).forEach(function (t) {
        t.forEach(function (p) { pos.push(p[0], p[1], p[2]); });
      });
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      group.add(new THREE.Mesh(geo, mat));
    });
    this.hlGroup = group;
    this._content.add(group);
  };
  Viewer.prototype.setHighlight = function (groupIds) {
    this.highlight = {};
    (groupIds || []).forEach(function (g) { this.highlight[g] = true; }, this);
    this._applyHighlight();
  };
  Viewer.prototype.toggleHighlight = function (g) {
    if (this.highlight[g]) delete this.highlight[g]; else this.highlight[g] = true;
    this._applyHighlight();
  };
  Viewer.prototype.clearHighlight = function () { this.highlight = {}; this._applyHighlight(); };

  /* ---------- 選取 ---------- */
  Viewer.prototype.pick = function (clientX, clientY) {
    var rect = this.renderer.domElement.getBoundingClientRect();
    var ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    var ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    var hits = ray.intersectObjects(this.meshes, true);
    if (!hits.length) return null;
    var h = hits[0];
    if (h.object.userData.cellId) return { type: 'cell', cellId: h.object.userData.cellId, group: h.object.userData.group };
    var tri = h.faceIndex;
    if (tri != null && this.triGroup[tri] !== undefined) return { type: 'face', group: this.triGroup[tri], tri: tri };
    return null;
  };

  Viewer.prototype.toScreen = function (p) {
    var v = new THREE.Vector3(p[0], p[1], p[2]).project(this.camera);
    var rect = this.renderer.domElement.getBoundingClientRect();
    return { x: (v.x * 0.5 + 0.5) * rect.width, y: (-v.y * 0.5 + 0.5) * rect.height, visible: v.z < 1 };
  };

  /* ---------- 切割平面預覽 ---------- */
  Viewer.prototype.showPlane = function (plane, size) {
    var basis = global.PS.clip.planeBasis(plane.n);
    var s = (size || 2.2);
    var center = [plane.n[0] * plane.d, plane.n[1] * plane.d, plane.n[2] * plane.d];
    var corners = [
      [1, 1], [1, -1], [-1, -1], [-1, 1]
    ].map(function (sgn) {
      return [
        center[0] + (basis[0][0] * sgn[0] + basis[1][0] * sgn[1]) * s,
        center[1] + (basis[0][1] * sgn[0] + basis[1][1] * sgn[1]) * s,
        center[2] + (basis[0][2] * sgn[0] + basis[1][2] * sgn[1]) * s
      ];
    });
    this.showPlaneQuad(corners);
  };

  Viewer.prototype.showPlaneQuad = function (corners) {
    if (this.planeObj) { this._content.remove(this.planeObj); disposeObj(this.planeObj); }
    var g = new THREE.Group();
    var geo = new THREE.BufferGeometry();
    var pos = [];
    this._faceTris(corners).forEach(function (t) { t.forEach(function (p) { pos.push(p[0], p[1], p[2]); }); });
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xffb300, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false
    })));
    var lg = new THREE.BufferGeometry();
    var lp = [];
    corners.forEach(function (p) { lp.push(p[0], p[1], p[2]); });
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    g.add(new THREE.LineLoop(lg, new THREE.LineBasicMaterial({ color: 0xff9800 })));
    this.planeObj = g;
    this._content.add(g);
  };

  Viewer.prototype.hidePlane = function () {
    if (this.planeObj) { this._content.remove(this.planeObj); disposeObj(this.planeObj); this.planeObj = null; }
  };

  /* ---------- 切割成兩塊 ---------- */
  Viewer.prototype.showPieces = function (result) {
    this.clear();
    this.pieces = {};
    this._lastPlaneNormal = result.plane.n.slice();
    ['A', 'B'].forEach(function (side) {
      var m = this._buildFaceMesh(result[side].faces, {
        groupOf: function (f, i) { return (f.group !== undefined ? f.group : i); },
        colorOfFace: function (g, f) { return f.isCap ? (side === 'B' ? CAPCOL2 : CAPCOL) : colorOf(g); }
      });
      var mesh = new THREE.Mesh(m.geo, m.mat);
      mesh.userData.kind = 'piece';
      this._content.add(mesh);
      this.meshes.push(mesh);
      for (var i = 0; i < m.tri.length; i++) this.triGroup.push(m.tri[i]);
      if (side === 'A') this.pieceA = mesh; else this.pieceB = mesh;
    }, this);
    this.colorAttr = null; this.baseColors = null;
    this.setSeparation(0);
    return result;
  };

  Viewer.prototype.setSeparation = function (sep) {
    if (!this.pieceA || !this.pieceB) return;
    var n = this._lastPlaneNormal || [0, 1, 0];
    this.pieceA.position.set(-n[0] * sep, -n[1] * sep, -n[2] * sep);
    this.pieceB.position.set(n[0] * sep, n[1] * sep, n[2] * sep);
  };

  /* ---------- 展開圖 ---------- */
  Viewer.prototype.showNet = function (net, t) {
    this.clear();
    this.net = net;
    this.foldT = (t === undefined ? 0 : t);
    if (!net || net.kind === 'none' || !net.cells.length) return;
    var self = this;
    net.cells.forEach(function (cell) {
      var geo = self._netGeometry(net, cell, self.foldT);
      var mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
        vertexColors: true, flatShading: true, side: THREE.DoubleSide
      }));
      mesh.userData.cellId = cell.id;
      mesh.userData.group = cell.group;
      this._content.add(mesh);
      this.cellMeshes.push(mesh);
      this.meshes.push(mesh);
    }, this);
    this._recenterNet();
    this.colorAttr = null; this.baseColors = null;
  };

  /* 回傳一個世界平移量，使這組點投影後的「畫面邊界中心」落在舞台正中。
     透視投影下世界中心 ≠ 畫面中心，需要這個補正。 */
  function screenCenterOffset(points, camera) {
    if (!points.length) return [0, 0];
    var tmp = new THREE.Vector3();
    function centre(dx, dy) {
      var mnx = 9, mxx = -9, mny = 9, mxy = -9;
      for (var i = 0; i < points.length; i++) {
        tmp.set(points[i][0] + dx, points[i][1] + dy, points[i][2]).project(camera);
        if (tmp.x < mnx) mnx = tmp.x; if (tmp.x > mxx) mxx = tmp.x;
        if (tmp.y < mny) mny = tmp.y; if (tmp.y > mxy) mxy = tmp.y;
      }
      return [(mnx + mxx) / 2, (mny + mxy) / 2];
    }
    var c0 = centre(0, 0);
    if (Math.abs(c0[0]) < 2e-4 && Math.abs(c0[1]) < 2e-4) return [0, 0];
    var mn = [1e9, 1e9], mx = [-1e9, -1e9];
    points.forEach(function (p) {
      if (p[0] < mn[0]) mn[0] = p[0]; if (p[0] > mx[0]) mx[0] = p[0];
      if (p[1] < mn[1]) mn[1] = p[1]; if (p[1] > mx[1]) mx[1] = p[1];
    });
    var h = Math.max(0.02, Math.max(mx[0] - mn[0], mx[1] - mn[1]) * 0.01);
    var px = centre(h, 0), py = centre(0, h);
    var j11 = (px[0] - c0[0]) / h, j21 = (px[1] - c0[1]) / h;
    var j12 = (py[0] - c0[0]) / h, j22 = (py[1] - c0[1]) / h;
    var det = j11 * j22 - j12 * j21;
    if (Math.abs(det) < 1e-12) return [0, 0];
    return [(-c0[0] * j22 + c0[1] * j12) / det, (c0[0] * j21 - c0[1] * j11) / det];
  }

  /* 把展開圖整體平移到舞台正中（依目前摺合程度重新計算） */
  Viewer.prototype._recenterNet = function () {
    if (!this._content) return;
    var b = boundsOfMeshes(this.cellMeshes);
    if (!b) { this._content.position.set(0, 0, 0); return; }
    var local = [];
    this.cellMeshes.forEach(function (mesh) {
      var a = mesh.geometry && mesh.geometry.getAttribute && mesh.geometry.getAttribute('position');
      if (!a) return;
      for (var i = 0; i < a.count; i++) {
        local.push([a.getX(i) - b.c[0], a.getY(i) - b.c[1], a.getZ(i) - b.c[2]]);
      }
    });
    var off = screenCenterOffset(local, this.camera);
    // 再修正一次（平移後「最外側的頂點」可能改變，線性估價會有殘差）
    var local2 = local.map(function (p) { return [p[0] + off[0], p[1] + off[1], p[2]]; });
    var off2 = screenCenterOffset(local2, this.camera);
    off = [off[0] + off2[0], off[1] + off2[1]];
    this._content.position.set(-b.c[0] + off[0], -b.c[1] + off[1], -b.c[2]);
  };

  /* 依展開圖（0% 攤平狀態）的大小與目前鏡頭角度，算出「剛好完整入鏡」的相機距離。
     只量度、不改動目前鏡頭狀態。 */
  Viewer.prototype._fitRadius = function (net, margin) {
    margin = margin || 0.82;
    if (!net || !net.cells || !net.cells.length) return null;
    this.resize();
    if (!this._w || !this._h) return null;

    var pts = [];
    net.cells.forEach(function (cell) {
      (cell.poly || []).forEach(function (p) {
        pts.push(net.warp(cell.id, 0, [p[0], p[1], 0]));
      });
    });
    if (!pts.length) return null;

    var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    pts.forEach(function (p) {
      for (var k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; }
    });
    var c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    var local = pts.map(function (p) { return [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; });

    var self = this, tmp = new THREE.Vector3();
    function projHalf(off) {
      var mnx = 9, mxx = -9, mny = 9, mxy = -9;
      local.forEach(function (p) {
        tmp.set(p[0] + off[0], p[1] + off[1], p[2]).project(self.camera);
        if (tmp.x < mnx) mnx = tmp.x; if (tmp.x > mxx) mxx = tmp.x;
        if (tmp.y < mny) mny = tmp.y; if (tmp.y > mxy) mxy = tmp.y;
      });
      return Math.max((mxx - mnx) / 2, (mxy - mny) / 2);
    }

    var saved = this.radius;
    var r = Math.max(2.6, Math.min(30, saved));
    for (var round = 0; round < 3; round++) {
      this.radius = r;
      this._applyCamera();
      var off = screenCenterOffset(local, this.camera);
      for (var i = 0; i < 10; i++) {
        this.radius = r;
        this._applyCamera();
        var m = projHalf(off);
        if (Math.abs(m - margin) < 0.005) break;
        r = Math.max(2.6, Math.min(30, r * (m / margin)));
      }
    }
    this.radius = saved;
    this._applyCamera();
    return r;
  };

  /* 依展開圖（0% 攤平狀態）的大小與目前鏡頭角度，調整相機距離使之完整入鏡 */
  Viewer.prototype.frameNet = function (net, margin) {
    var r = this._fitRadius(net, margin);
    if (r === null) return;
    this.radius = r;
    this._applyCamera();
    // 鏡頭距離改了，重新置中（目前摺合狀態）
    this._recenterNet();
  };

  /* 同一個立體的所有展開圖「共用一個鏡頭距離」：
     取最闊／最高的那個展開圖所需的距離，令切換展開圖時立體大小完全不變。 */
  Viewer.prototype.frameNets = function (nets, margin) {
    var best = null, self = this;
    (nets || []).forEach(function (n) {
      var r = self._fitRadius(n, margin);
      if (r !== null && (best === null || r > best)) best = r;
    });
    if (best === null) return;
    this.radius = best;
    this._applyCamera();
    this._recenterNet();
  };

  /* 圓柱側面需要沿圓周細分，否則只用 4 個角去摺合會退化成一條線（看起來像透明） */
  function rollGridTris(net, cell, t) {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    cell.poly.forEach(function (p) {
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    });
    var nx = 72, ny = 2, out = [], pts = [];
    for (var i = 0; i <= nx; i++) {
      pts[i] = [];
      for (var j = 0; j <= ny; j++) {
        var u = x0 + (x1 - x0) * i / nx, v = y0 + (y1 - y0) * j / ny;
        pts[i][j] = net.warp(cell.id, t, [u, v, 0]);
      }
    }
    for (i = 0; i < nx; i++) {
      for (j = 0; j < ny; j++) {
        out.push([pts[i][j], pts[i + 1][j], pts[i + 1][j + 1]]);
        out.push([pts[i][j], pts[i + 1][j + 1], pts[i][j + 1]]);
      }
    }
    return out;
  }

  Viewer.prototype._netGeometry = function (net, cell, t) {
    var pos = [], col = [];
    var g = cell.group;
    var base = new THREE.Color(g >= 0 ? colorOf(g) : 0xdfe7ef);
    var tris;
    if (cell.type === 'roll') {
      tris = rollGridTris(net, cell, t);
    } else {
      var poly = cell.poly.map(function (p) { return net.warp(cell.id, t, [p[0], p[1], 0]); });
      tris = this._faceTris(poly);
    }
    tris.forEach(function (tr) {
      tr.forEach(function (p) { pos.push(p[0], p[1], p[2]); col.push(base.r, base.g, base.b); });
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    return geo;
  };

  Viewer.prototype.setFold = function (t) {
    this.foldT = t;
    if (!this.net || !this.cellMeshes.length) return;
    var self = this;
    this.cellMeshes.forEach(function (mesh) {
      var cell = null;
      self.net.cells.forEach(function (c) { if (c.id === mesh.userData.cellId) cell = c; });
      if (!cell) return;
      mesh.geometry.dispose();
      mesh.geometry = self._netGeometry(self.net, cell, t);
    });
    this._recenterNet();
  };

  Viewer.prototype.highlightCell = function (groupId) {
    this.cellMeshes.forEach(function (mesh) {
      var g = mesh.userData.group;
      var col = mesh.geometry.getAttribute('color');
      if (!col) return;
      var c = (g >= 0 && g === groupId) ? new THREE.Color(HILITE) : new THREE.Color(g >= 0 ? colorOf(g) : 0xdfe7ef);
      var a = col.array;
      for (var i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
      col.needsUpdate = true;
    });
  };

  global.PS = global.PS || {};
  global.PS.Viewer = Viewer;
})(typeof window !== 'undefined' ? window : this);
