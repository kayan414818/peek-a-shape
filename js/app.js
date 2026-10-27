/* ============================================================
   Peek-a-Shape｜立體探秘樂
   app.js — 主頁、三個模組的互動與中英切換
   三個模組：一、立體模型庫（觀察）；二、展開圖魔法（展開）；三、切一刀看看（切割）
   ============================================================ */
(function (global) {
  'use strict';
  var doc = global.document;
  var PS = global.PS, T = PS.i18n, G = PS.geo, C = PS.clip, N = PS.nets;

  var SOLIDS = [
    { id: 'cube' }, { id: 'cuboid' },
    { id: 'triPrism' }, { id: 'quadPrism' },
    { id: 'pentaPrism' }, { id: 'hexaPrism' },
    { id: 'triPyramid' }, { id: 'quadPyramid' },
    { id: 'pentaPyramid' }, { id: 'cylinder' },
    { id: 'cone' }, { id: 'sphere' }
  ];

  // 主頁三張卡上的小型 3D 縮圖（用真正的立體渲染，而非平面圖示）
  var _thumbBoxes = null;

  function txt(k) { return T.t(k); }
  function tf(k, a) { return T.tf(k, a); }
  function shapeName(id) { return G.NAME[id][T.lang()]; }

  function el(tag, attrs, kids) {
    var n = doc.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'disabled') n.disabled = !!attrs[k];
      else if (k === 'checked' || k === 'selected' || k === 'readonly') n[k] = !!attrs[k];
      else if (k === 'value') n.value = attrs[k];
      else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    }
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
    });
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  /* ---------- 狀態 ---------- */
  var state = {
    view: 'home', shape: 'cube',
    inspect: { xray: false, counted: {}, order: [], _shape: null },
    unfold: { t: 1, variant: 0, pickGroup: -1, quiz: null, animating: false },
    cut: {
      mode: 'horizontal', angle: 35, spin: 0, pos: 0, sep: 0,
      result: null, section: null, predicted: null, quiz: null, lastCutKey: null
    }
  };

  /* ---------- DOM ---------- */
  var stageEl, panelEl, stageWrapEl, labelEl, hintEl, viewer, homeEl;
  var stageBtns = null;

  function markActivity() {}
  // 畫面上顯示「展開程度」：0% = 立體（已摺合），100% = 展開圖（已攤平）
  function foldPct(t) { return Math.round((1 - t) * 100); }
  function autoBtnLabel() {
    var t = state.unfold.t;
    var key;
    if (Math.abs(t - 1) < 0.01) key = 'unfold.autoUnfold';
    else if (Math.abs(t) < 0.01) key = 'unfold.autoFold';
    else key = (t > 0.5 ? 'unfold.autoFold' : 'unfold.autoUnfold');
    return txt(key) + ' (' + foldPct(t) + '%)';
  }
  function startUnfoldAuto() {
    if (state.unfold._anim) return;
    var start = state.unfold.t;
    var target = start > 0.5 ? 0 : 1;
    var dur = 900;
    var t0 = Date.now();
    state.unfold._anim = true;
    var ab0 = doc.getElementById('btn-auto-fold');
    if (ab0) ab0.disabled = true;
    function step() {
      var p = Math.min(1, (Date.now() - t0) / dur);
      var v = start + (target - start) * p;
      state.unfold.t = v;
      viewer.setFold(v);
      var pctEl = panelEl && panelEl.querySelector('.pct');
      if (pctEl) pctEl.textContent = foldPct(v) + '%';
      var sld = panelEl && panelEl.querySelector('.slider');
      if (sld) sld.value = String(foldPct(v));
      var ab = doc.getElementById('btn-auto-fold');
      if (ab) ab.textContent = autoBtnLabel();
      if (p < 1) requestAnimationFrame(step);
      else { state.unfold._anim = false; render(); }
    }
    step();
  }

  /* ============================================================
     啟動
     ============================================================ */
  function init() {
    stageEl = doc.getElementById('stage');
    panelEl = doc.getElementById('panel');
    stageWrapEl = doc.getElementById('stage-wrap');
    viewer = new PS.Viewer(stageEl);

    labelEl = el('div', { class: 'stage-label' });
    stageEl.appendChild(labelEl);

    var tools = el('div', { class: 'stage-tools' });
    stageBtns = [
      el('button', { class: 'tbtn', onclick: function () { viewer.zoom(0.85); markActivity(); } }, '+'),
      el('button', { class: 'tbtn', onclick: function () { viewer.zoom(1.18); markActivity(); } }, '−'),
      el('button', { class: 'tbtn', onclick: function () { viewer.resetView(); markActivity(); } }, '⟳')
    ];
    stageBtns.forEach(function (b) { tools.appendChild(b); });
    stageEl.appendChild(tools);

    hintEl = el('div', { class: 'hint-badge' });
    stageEl.appendChild(hintEl);

    // 點擊舞台（非拖動）→ 交給各模組處理
    var dn = null;
    viewer.renderer.domElement.addEventListener('pointerdown', function (e) { dn = { x: e.clientX, y: e.clientY }; markActivity(); });
    viewer.renderer.domElement.addEventListener('pointerup', function (e) {
      markActivity();
      if (!dn) return;
      var moved = Math.hypot(e.clientX - dn.x, e.clientY - dn.y);
      dn = null;
      if (moved > 7) return;
      var hit = viewer.pick(e.clientX, e.clientY);
      if (hit) onPick(hit);
    });

    // 頂列
    doc.getElementById('btn-home').addEventListener('click', function () { markActivity(); go('home'); });
    doc.getElementById('btn-lang').addEventListener('click', function () {
      T.setLang(T.lang() === 'zh' ? 'en' : 'zh');
    });
    Array.prototype.forEach.call(doc.querySelectorAll('#topbar [data-mode]'), function (b) {
      b.addEventListener('click', function () { markActivity(); go(b.getAttribute('data-mode')); });
    });

    T.onChange(function () {
      updateChrome();
      render();
      if (homeEl) renderHome();
    });
    updateChrome();

    buildHome();
    go('home');
    window.addEventListener('pointerdown', markActivity, true);
    window.addEventListener('keydown', markActivity, true);
  }

  function updateChrome() {
    var bh = doc.getElementById('btn-home');
    if (bh) bh.textContent = txt('nav.home');
    var bl = doc.getElementById('btn-lang');
    if (bl) bl.textContent = txt('nav.lang.toEn');
    var bn = doc.getElementById('brand-name');
    if (bn) bn.textContent = txt('app.name');
    try { doc.title = txt('app.title'); } catch (e) {}
    if (stageBtns) {
      stageBtns[0].title = txt('stage.zoomIn');
      stageBtns[1].title = txt('stage.zoomOut');
      stageBtns[2].title = txt('stage.reset');
    }
  }

  function go(view) {
    state.view = view;
    Array.prototype.forEach.call(doc.querySelectorAll('#topbar [data-mode]'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === view);
    });
    if (view === 'home') homeEl.style.display = 'grid';
    else homeEl.style.display = 'none';
    if (state.view !== 'home') {
      viewer.clear();
      if (panelEl) panelEl.style.display = 'block';
      if (stageWrapEl) stageWrapEl.style.flex = '1 1 64%';
    } else {
      if (panelEl) panelEl.style.display = 'none';
      if (stageWrapEl) stageWrapEl.style.flex = '1 1 100%';
    }
    render();
  }

  /* ============================================================
     主頁
     ============================================================ */
  // 三張卡各放一個小型 3D 縮圖（旋轉的立體／半摺的展開圖／切開的兩塊）
  var _thumbViewers = null;
  function homeThumbs() {
    if (_thumbBoxes) return _thumbBoxes;
    _thumbBoxes = []; _thumbViewers = [];
    [['solid', 'cube'], ['fold', 'cube'], ['cut', 'cube']].forEach(function (s) {
      var t = makeThumb(s[0], s[1]);
      _thumbBoxes.push(t.box);
      _thumbViewers.push(t.viewer);
    });
    return _thumbBoxes;
  }
  function makeThumb(kind, shapeId) {
    var box = el('div', { class: 'thumb3d' });
    var v = new PS.Viewer(box);
    v.autoRotate = true;
    v.phi = 1.16; v.theta = 0.7;
    var solid = G.getSolid(shapeId);
    try {
      if (kind === 'fold') {
        v.showNet(N.build(shapeId, 0), 0.45);
      } else if (kind === 'cut') {
        var res = C.clipSolid(solid, C.makePlane([1, 0.85, 0.5], [0, 0, 0]));
        if (res.ok) { v.showPieces(res); v.setSeparation(0.16); } else { v.showSolid(solid); }
      } else {
        v.showSolid(solid);
      }
    } catch (e) { v.showSolid(solid); }
    fitThumb(v);
    return { box: box, viewer: v };
  }
  // 把縮圖內容置中，並依內容大小自動調整相機距離
  function fitThumb(v) {
    var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], any = false;
    v._content.traverse(function (n) {
      if (!n.geometry || !n.geometry.getAttribute) return;
      var a = n.geometry.getAttribute('position');
      if (!a) return;
      for (var i = 0; i < a.count; i++) {
        any = true;
        var x = a.getX(i), y = a.getY(i), z = a.getZ(i);
        if (x < mn[0]) mn[0] = x; if (y < mn[1]) mn[1] = y; if (z < mn[2]) mn[2] = z;
        if (x > mx[0]) mx[0] = x; if (y > mx[1]) mx[1] = y; if (z > mx[2]) mx[2] = z;
      }
    });
    if (!any) { v.radius = 4.3; return; }
    var c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    v._content.position.set(-c[0], -c[1], -c[2]);
    var r = 0;
    v._content.traverse(function (n) {
      if (n.geometry && n.geometry.getAttribute) {
        var a = n.geometry.getAttribute('position');
        for (var i = 0; i < a.count; i++) {
          var dx = a.getX(i) - c[0], dy = a.getY(i) - c[1], dz = a.getZ(i) - c[2];
          var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d > r) r = d;
        }
      }
    });
    v.radius = Math.max(3.0, r * 2.6);
  }

  // 展開圖大考驗：每個選項一個小型 3D 展開圖縮圖（可重用，避免不斷建立新的 WebGL 環境）
  var _quizViewers = null;
  function quizViewers(n) {
    if (!_quizViewers) _quizViewers = [];
    while (_quizViewers.length < n) {
      var box = el('div', { class: 'opt-net' });
      var v = new PS.Viewer(box);
      v.autoRotate = false;
      v.phi = 0.95; v.theta = 0.0;
      _quizViewers.push({ box: box, viewer: v });
    }
    return _quizViewers.slice(0, n);
  }
  function showQuizNet(slot, net) {
    var v = slot.viewer;
    try {
      v.showNet(net, 0);
      fitThumb(v);
    } catch (e) {}
    return slot.box;
  }

  function buildHome() {
    homeEl = el('div', { id: 'home' });
    doc.getElementById('stage-wrap').appendChild(homeEl);
    renderHome();
  }
  function renderHome() {
    var thumbs = homeThumbs();
    clear(homeEl);
    var cards = [
      { cls: 'i1', v: 'inspect', tk: 'home.card.inspect.title', dk: 'home.card.inspect.desc' },
      { cls: 'i2', v: 'unfold', tk: 'home.card.unfold.title', dk: 'home.card.unfold.desc' },
      { cls: 'i3', v: 'cut', tk: 'home.card.cut.title', dk: 'home.card.cut.desc' }
    ];
    var grid = el('div', { class: 'cards' });
    cards.forEach(function (c, i) {
      grid.appendChild(el('button', { class: 'hcard ' + c.cls, onclick: function () { markActivity(); go(c.v); } }, [
        thumbs[i],
        el('div', { class: 't', text: txt(c.tk) }),
        el('div', { class: 'd', text: txt(c.dk) })
      ]));
    });
    homeEl.appendChild(el('div', { class: 'inner' }, [
      el('h1', {}, [el('span', { class: 'zh', text: txt('home.title') })]),
      el('div', { class: 'tag', text: txt('home.subtitle') }),
      el('div', { class: 'sub', text: txt('home.choose'), style: 'margin-bottom:10px;font-weight:700;color:#2a7fbf' }),
      grid,
      el('div', { class: 'start' }, [
        el('button', { class: 'btn orange', text: txt('home.start'), onclick: function () { markActivity(); go('inspect'); } })
      ])
    ]));
  }

  /* ============================================================
     路由：面板
     ============================================================ */
  function render() {
    clear(panelEl);
    if (state.view === 'inspect') renderInspect();
    else if (state.view === 'unfold') renderUnfold();
    else if (state.view === 'cut') renderCut();
    updateLabel();
  }

  function updateLabel() {
    clear(labelEl);
    if (state.view === 'home') { labelEl.style.display = 'none'; return; }
    labelEl.style.display = 'block';
    var id = state.shape;
    var info = G.info(id);
    labelEl.appendChild(el('div', { class: 'name', text: shapeName(id) }));
    labelEl.appendChild(el('div', { class: 'desc', text: info.desc ? info.desc[T.lang()] : '' }));
  }

  function showHint(msg, ms) {
    hintEl.textContent = msg;
    hintEl.classList.add('show');
    clearTimeout(hintEl._t);
    hintEl._t = setTimeout(function () { hintEl.classList.remove('show'); }, ms || 3200);
  }

  function solidChips(onPick) {
    var wrap = el('div', { class: 'chips' });
    SOLIDS.forEach(function (s) {
      wrap.appendChild(el('button', {
        class: 'chip' + (state.shape === s.id ? ' active' : ''),
        onclick: function () { markActivity(); state.shape = s.id; onPick && onPick(); }
      }, [el('span', { text: shapeName(s.id) })]));
    });
    return wrap;
  }

  /* ============================================================
     模組一：觀察
     ============================================================ */
  function renderInspect() {
    var solid = G.getSolid(state.shape);
    var info = G.info(state.shape);
    if (state.inspect._shape !== state.shape) {
      state.inspect.counted = {};
      state.inspect.order = [];
      state.inspect._shape = state.shape;
    }
    viewer.showSolid(solid);
    viewer.setHighlight(Object.keys(state.inspect.counted).map(Number));
    viewer.setXRay(state.inspect.xray);
    viewer.autoRotate = false;

    var card = el('div', { class: 'card' });
    card.appendChild(el('h2', { text: txt('inspect.title') }));
    card.appendChild(el('div', { class: 'sub', text: txt('inspect.intro') }));
    card.appendChild(el('h3', { text: txt('common.choose') }));
    card.appendChild(solidChips(function () { render(); }));

    // 透視模式 X-Ray：同步顯示棱（藍）與頂點（黃） — 只在觀察模組顯示
    var toggles = el('div', { style: 'margin-top:10px' });
    var xrBtn = el('button', { class: 'big-toggle alt' + (state.inspect.xray ? ' on' : ''), text: txt('inspect.xray') });
    xrBtn.addEventListener('click', function () {
      markActivity();
      state.inspect.xray = !state.inspect.xray;
      viewer.setXRay(state.inspect.xray);
      render();
    });
    toggles.appendChild(xrBtn);
    card.appendChild(toggles);

    card.appendChild(el('div', { class: 'note', text: txt('status.geometry') }));

    // 圖形小檔案
    var facts = el('div', { class: 'card' });
    facts.appendChild(el('h2', { text: txt('inspect.infoTitle') }));
    facts.appendChild(factRow('f', '🟦', txt('inspect.faceDetail'), info.faceDetail[T.lang()]));
    facts.appendChild(factRow('e', '📏', txt('inspect.edgeDetail'), info.edgeDetail[T.lang()]));
    facts.appendChild(factRow('v', '🟡', txt('inspect.vertDetail'), info.vertDetail[T.lang()]));
    if (info.curved) {
      var nk = 'inspect.curvedNote.' + state.shape;
      facts.appendChild(el('div', { class: 'feedback ok', text: txt(nk) }));
    }

    panelEl.appendChild(card);
    panelEl.appendChild(facts);
  }
  function factRow(cls, ico, label, text) {
    return el('div', { class: 'fact' }, [
      el('div', { class: 'bg ' + cls, text: ico }),
      el('div', { class: 'txt' }, [el('b', { text: label + '：' }), doc.createTextNode(text)])
    ]);
  }

  // 「1, 2, 3…」計數序列文字
  function countSeqText(total) {
    var n = state.inspect.order.length;
    if (!n) return '';
    var a = [];
    for (var i = 1; i <= n; i++) a.push(i);
    return a.join(', ') + (n < total ? '…' : '');
  }

  /* ============================================================
     模組二：展開
     ============================================================ */
  function renderUnfold() {
    var id = state.shape;
    var net = N.build(id, state.unfold.variant);
    var info = G.info(id);

    // 立體不支援展開圖
    if (!net || net.kind === 'none') {
      viewer.clear();
      var c0 = el('div', { class: 'card' });
      c0.appendChild(el('h2', { text: txt('unfold.cannotNet.title') }));
      c0.appendChild(el('div', { class: 'sub', text: txt('unfold.cannotNet.body') }));
      c0.appendChild(el('h3', { text: txt('common.choose') }));
      c0.appendChild(solidChips(function () { state.unfold.variant = 0; render(); }));
      panelEl.appendChild(c0);
      return;
    }

    if (state.unfold.variant >= N.variants(id)) state.unfold.variant = 0;
    viewer.setXRay(false);   // 展開圖不使用透視／棱／頂點，也不與立體模型庫連動
    viewer.showNet(net, state.unfold.t);
    viewer.setFold(state.unfold.t);

    var card = el('div', { class: 'card' });
    card.appendChild(el('h2', { text: txt('unfold.title') }));
    card.appendChild(el('div', { class: 'sub', text: txt('unfold.intro') }));
    card.appendChild(el('h3', { text: txt('common.choose') }));
    card.appendChild(solidChips(function () { state.unfold.variant = 0; state.unfold.t = 1; render(); }));

    // 展開滑桿（0% 立體 ↔ 100% 展開圖，連續變化）
    card.appendChild(el('h3', { text: txt('unfold.slider') }));
    var pctEl = el('div', { class: 'sub pct', style: 'text-align:center;font-weight:800;color:#2a7fbf', text: foldPct(state.unfold.t) + '%' });
    var row = el('div', { class: 'slider-row' }, [
      el('label', { text: txt('unfold.solid') }),
      el('input', { class: 'slider', type: 'range', min: '0', max: '100', value: String(foldPct(state.unfold.t)) })
    ]);
    var rng = row.querySelector('input');
    rng.addEventListener('input', function () {
      markActivity();
      state.unfold.t = 1 - (+rng.value) / 100;   // 0% = 立體、100% = 展開圖
      viewer.setFold(state.unfold.t);
      pctEl.textContent = foldPct(state.unfold.t) + '%';
      var ab = doc.getElementById('btn-auto-fold');
      if (ab) ab.textContent = autoBtnLabel();
    });
    card.appendChild(row);
    card.appendChild(pctEl);

    if (N.variants(id) > 1) {
      card.appendChild(el('button', {
        class: 'btn ghost block', text: txt('unfold.variant'),
        onclick: function () { markActivity(); state.unfold.variant = (state.unfold.variant + 1) % N.variants(id); render(); }
      }));
    }
    var toggleBtn = el('button', {
      class: 'btn teal block', id: 'btn-auto-fold',
      text: autoBtnLabel(),
      onclick: function () { markActivity(); startUnfoldAuto(); }
    });
    if (state.unfold._anim) toggleBtn.disabled = true;
    card.appendChild(toggleBtn);
    card.appendChild(el('div', { class: 'note', text: txt('unfold.correspond') }));

    panelEl.appendChild(card);

    // 對應顯示（點選展開圖上的面時，確認它對應的立體面）
    if (state.unfold.pickGroup >= 0) {
      var grp = solidGroupInfo(G.getSolid(id), state.unfold.pickGroup);
      if (grp) panelEl.appendChild(el('div', { class: 'pick-note', text: '👉 ' + grp[T.lang()] }));
    }

    // 展開圖大考驗
    panelEl.appendChild(unfoldQuizCard());
  }

  function setFoldValue(v, input) {
    state.unfold.t = Math.max(0, Math.min(1, 1 - v / 100));
    viewer.setFold(state.unfold.t);
    render();
  }

  function solidGroupInfo(solid, gi) {
    var g = null;
    (solid.groups || []).forEach(function (x) { if (x.id === gi) g = x; });
    if (g && g.zh) return { zh: g.zh, en: g.en };
    if (solid.kind === 'poly' && solid.faces[gi]) {
      var n = solid.faces[gi].pts.length;
      var zh = n === 3 ? '三角形面' : (n === 4 ? '四邊形面' : n + ' 邊形面');
      var en = n === 3 ? 'triangular face' : (n === 4 ? 'quadrilateral face' : n + '-sided face');
      return { zh: zh + '（第 ' + (gi + 1) + ' 面）', en: en + ' (face ' + (gi + 1) + ')' };
    }
    return null;
  }

  function onPick(hit) {
    if (state.view === 'inspect' && hit.type === 'face') {
      var g = hit.group;
      if (state.inspect.counted[g]) {
        delete state.inspect.counted[g];
        var oi = state.inspect.order.indexOf(g);
        if (oi >= 0) state.inspect.order.splice(oi, 1);
      } else {
        state.inspect.counted[g] = true;
        if (state.inspect.order.indexOf(g) < 0) state.inspect.order.push(g);
      }
      viewer.toggleHighlight(g);
      var total = G.info(state.shape).counts.faces;
      var cnt = Object.keys(state.inspect.counted).length;
      // 更新計數機（數字、序列、總數）
      var num = panelEl.querySelector('.count-num');
      if (num) num.textContent = String(cnt);
      var seq = panelEl.querySelector('.count-seq');
      if (seq) seq.textContent = countSeqText(total);
      markActivity();
    } else if (state.view === 'unfold' && hit.type === 'cell') {
      state.unfold.pickGroup = hit.group;
      viewer.highlightCell(hit.group);
      markActivity();
      render();
    }
  }

  /* ---------- 展開圖考驗 ---------- */
  function unfoldQuizCard() {
    var card = el('div', { class: 'card' });
    card.appendChild(el('h2', { text: txt('unfold.quiz.title') }));
    var q = state.unfold.quiz;
    if (!q) {
      card.appendChild(el('button', {
        class: 'btn green block', text: txt('unfold.quiz.title') + ' ▶',
        onclick: function () { markActivity(); newUnfoldQuiz(); }
      }));
      return card;
    }
    card.appendChild(el('div', { class: 'sub', text: unfoldQuestion(q) }));
    card.appendChild(el('div', { class: 'sub', style: 'font-weight:700;color:#2a7fbf', text: txt('unfold.quiz.pickOne') }));
    var slots = quizViewers(q.options.length);
    var opts = el('div', { class: 'options nets' });
    q.options.forEach(function (o, i) {
      var cls = 'opt net-opt';
      if (q.answered) {
        if (o.correct) cls += ' ok';
        else if (i === q.chosen) cls += ' no';
      }
      var thumb = showQuizNet(slots[i], o.net);
      opts.appendChild(el('button', {
        class: cls,
        onclick: function () { if (!q.answered) answerUnfold(i); }
      }, [
        thumb,
        el('div', { class: 'opt-label', text: tf('unfold.quiz.netLabel', [o.letter || String.fromCharCode(65 + i)]) })
      ]));
    });
    card.appendChild(opts);
    if (q.answered) {
      card.appendChild(el('div', { class: 'feedback ' + (q.correctAnswer ? 'ok' : 'no'), text: unfoldExplain(q) }));
      card.appendChild(el('button', { class: 'btn teal block', text: txt('unfold.quiz.showFold') + ' ▶', onclick: function () { markActivity(); playFold(q.options[q.chosen].net, q.options[q.chosen].id); } }));
      card.appendChild(el('button', { class: 'btn orange block', text: txt('common.next'), onclick: function () { markActivity(); state.unfold.quiz = null; render(); } }));
    }
    return card;
  }

  function unfoldQuestion(q) {
    return tf(q.type === 'invalid' ? 'unfold.quiz.invalidQ' : 'unfold.quiz.matchQ', [shapeName(q.target)]);
  }
  function unfoldExplain(q) {
    var chosen = q.options[q.chosen];
    if (q.type === 'invalid') {
      return chosen.correct ? explainInvalidNet(chosen.res) : txt('unfold.quiz.explainOk');
    }
    return chosen.correct ? txt('unfold.quiz.explainOk') : explainInvalidNet(chosen.res);
  }

  // 可以攤平成展開圖的立體（球體除外）
  var NETTABLE = ['cube', 'cuboid', 'triPrism', 'quadPrism', 'pentaPrism', 'hexaPrism',
    'triPyramid', 'quadPyramid', 'pentaPyramid', 'cylinder', 'cone'];

  function netOf(id, variant) {
    try {
      var n = N.build(id, variant || 0);
      return (n && n.kind !== 'none' && n.cells && n.cells.length) ? n : null;
    } catch (e) { return null; }
  }
  function verifyFor(net, target) {
    try { return N.verifyNet(net, target) || { ok: false }; } catch (e) { return { ok: false }; }
  }
  // 收集「不能摺成 target」的干擾展開圖
  function distractorNets(target) {
    var bad = [];
    NETTABLE.forEach(function (id) {
      if (id === target) return;
      var n = netOf(id, 0);
      if (n && !verifyFor(n, target).ok) bad.push(n);
    });
    if (target === 'cube') {
      ['block23', 'five', 'other'].forEach(function (k) {
        try { var n = N.distractorNet('cube', k); if (n) bad.push(n); } catch (e) {}
      });
    }
    return shuffle(bad);
  }

  function newUnfoldQuiz() {
    var target = NETTABLE[Math.floor(Math.random() * NETTABLE.length)];
    var badNets = distractorNets(target);
    // 若不夠干擾選項，退回到正方體（干擾圖最齊全）
    if (badNets.length < 2) { target = 'cube'; badNets = distractorNets('cube'); }

    var vcount = N.variants(target) || 1;
    var correctNets = [];
    for (var v = 0; v < vcount; v++) { var n = netOf(target, v); if (n) correctNets.push(n); }
    if (!correctNets.length) correctNets.push(netOf('cube', 0) || { id: 'cube' });

    function wrap(net) {
      var res = verifyFor(net, target);
      return { net: net, id: net.id, res: res, ok: !!res.ok, correct: false, letter: '' };
    }

    var canInvalid = correctNets.length >= 2;
    var askInvalid = canInvalid && Math.random() < 0.5;
    var opts;
    if (askInvalid) {
      // 兩個真的可以摺成 + 一個不可以 → 只有一個是「不能摺成」
      opts = [wrap(correctNets[0]), wrap(correctNets[1]), wrap(badNets[0])];
      opts.forEach(function (o) { o.correct = !o.ok; });
      state.unfold.quiz = {
        type: 'invalid', answered: false, target: target, options: opts
      };
    } else {
      // 一個真的可以摺成 + 兩個不可以 → 只有一個是「可以摺成」（展開圖配對）
      opts = [wrap(correctNets[0]), wrap(badNets[0]), wrap(badNets[1])];
      opts.forEach(function (o) { o.correct = o.ok; });
      state.unfold.quiz = {
        type: 'match', answered: false, target: target, options: opts
      };
    }
    // 打亂並重新命名 A/B/C（字母在畫面渲染時才組成本地化文字）
    state.unfold.quiz.options = shuffle(state.unfold.quiz.options);
    state.unfold.quiz.options.forEach(function (o, i) { o.letter = String.fromCharCode(65 + i); });
    render();
  }

  function explainInvalidNet(res) {
    if (res.overlaps && res.overlaps.length) return txt('unfold.quiz.explainOverlap');
    if (res.watertight === false) return txt('unfold.quiz.explainGap');
    return txt('unfold.quiz.explainWrong');
  }

  function answerUnfold(i) {
    var q = state.unfold.quiz;
    q.answered = true; q.chosen = i;
    var chosen = q.options[i];
    q.correctAnswer = !!chosen.correct;
    render();
    // 選擇後，系統在舞台上播放動態摺合動畫作驗證
    playFold(chosen.net, chosen.id);
  }

  function playFold(net, name) {
    // 在舞台上連續摺合一次（0 → 1）
    state.unfold.animating = true;
    viewer.showNet(net, 0);
    var t0 = performance.now();
    function step(now) {
      var k = Math.min(1, (now - t0) / 900);
      viewer.setFold(k);
      if (k < 1) global.requestAnimationFrame(step);
      else { state.unfold.animating = false; }
    }
    global.requestAnimationFrame(step);
    showHint(txt('unfold.quiz.showFold') + ' → ' + name);
  }

  /* ============================================================
     模組三：切割
     ============================================================ */
  function solidBounds(solid) {
    var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    solid.faces.forEach(function (f) { f.pts.forEach(function (p) {
      for (var d = 0; d < 3; d++) { if (p[d] < mn[d]) mn[d] = p[d]; if (p[d] > mx[d]) mx[d] = p[d]; }
    }); });
    return { mn: mn, mx: mx, size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]] };
  }

  function cutPlane(solid) {
    var b = solidBounds(solid);
    var cx = (b.mn[0] + b.mx[0]) / 2, cy = (b.mn[1] + b.mx[1]) / 2, cz = (b.mn[2] + b.mx[2]) / 2;
    var p = state.cut;
    var A = p.angle * Math.PI / 180;
    var n, pt;
    if (p.mode === 'horizontal') {
      n = [0, 1, 0]; pt = [cx, cy + p.pos * b.size[1] * 0.42, cz];
    } else if (p.mode === 'vertical') {
      n = [1, 0, 0]; pt = [cx + p.pos * b.size[0] * 0.42, cy, cz];
    } else if (p.mode === 'diagonal') {
      // 對角切：固定 45° 對角平面（不設角度）
      n = [1, 1, 0]; pt = [cx, cy + p.pos * b.size[1] * 0.3, cz];
    } else { // 斜切：以角度決定傾斜方向
      n = [Math.sin(A), Math.cos(A), 0]; pt = [cx, cy + p.pos * b.size[1] * 0.3, cz];
    }
    return C.makePlane(n, pt);
  }

  // 只更新舞台預覽，不重建右側面板（供拖動滑桿時即時反應）
  function refreshCutPreview() {
    var solid = G.getSolid(state.shape);
    var plane = cutPlane(solid);
    var res = C.clipSolid(solid, plane);
    var sec = res.ok ? C.classifySection(solid, res.section.pts, plane) : null;
    state.cut.result = res.ok ? res : null;
    state.cut.section = sec;
    state.cut.plane = plane;
    if (state.cut.showResult && res.ok) {
      viewer.showPieces(res);
      viewer.setSeparation(state.cut.sep);
    } else {
      viewer.showSolid(solid);
      viewer.setXRay(false);
      viewer.showPlane(plane);
    }
  }

  function renderCut() {
    var solid = G.getSolid(state.shape);
    viewer.showSolid(solid);
    viewer.setXRay(false);   // 切一刀看看不顯示透視／棱／頂點，且不與立體模型庫連動
    viewer.autoRotate = false;

    var plane = cutPlane(solid);
    var res = C.clipSolid(solid, plane);
    var sec = res.ok ? C.classifySection(solid, res.section.pts, plane) : null;
    state.cut.result = res.ok ? res : null;
    state.cut.section = sec;
    state.cut.plane = plane;

    // 目標挑戰：用真實截面判定是否達成
    var cq = state.cut.quiz;
    if (cq && cq.type === 'target' && !cq.answered && sec && !sec.unsupported && sec.key !== 'none') {
      if (targetMatch(cq.target, sec.key)) {
        cq.answered = true; cq.correctAnswer = true;
      }
    }

    // 舞台：顯示平面（未切之前）或已切結果
    if (state.cut.showResult && res.ok) {
      viewer.showPieces(res);
      viewer.setSeparation(state.cut.sep);
    } else if (state.cut.showResult && !res.ok) {
      viewer.showSolid(solid);
      viewer.showPlane(plane);
      state.cut.showResult = false;
    } else {
      viewer.showPlane(plane);
    }

    // 選立體
    var card = el('div', { class: 'card' });
    card.appendChild(el('h2', { text: txt('cut.title') }));
    card.appendChild(el('div', { class: 'sub', text: txt('cut.intro') }));
    card.appendChild(el('h3', { text: txt('common.choose') }));
    card.appendChild(solidChips(function () { state.cut.showResult = false; state.cut.sep = 0; state.cut.quiz = null; render(); }));

    // 切法
    card.appendChild(el('h3', { text: txt('cut.mode') }));
    var modes = el('div', { class: 'chips' });
    ['horizontal', 'vertical', 'slant', 'diagonal'].forEach(function (m) {
      modes.appendChild(el('button', {
        class: 'chip' + (state.cut.mode === m ? ' active' : ''),
        text: txt('cut.mode.' + m),
        onclick: function () { markActivity(); state.cut.mode = m; state.cut.showResult = false; state.cut.sep = 0; render(); }
      }));
    });
    card.appendChild(modes);

    // 滑桿
    var sl = el('div');
    function sliderRow(label, min, max, val, step, fn) {
      var span = el('span', { class: 'sub', style: 'min-width:42px;text-align:right', text: String(val) });
      var inp = el('input', { type: 'range', class: 'slider', min: min, max: max, value: val, step: step || 1 });
      inp.addEventListener('input', function () { markActivity(); span.textContent = inp.value; fn(parseFloat(inp.value)); });
      return el('div', { class: 'slider-row' }, [el('label', { text: label }), inp, span]);
    }
    // 只有「斜切」需要角度；水平切、垂直切、對角切都是固定方向
    if (state.cut.mode === 'slant') {
      sl.appendChild(sliderRow(txt('cut.angle'), 0, 90, state.cut.angle, 1, function (v) { state.cut.angle = v; state.cut.showResult = false; refreshCutPreview(); }));
    }
    card.appendChild(sl);
    card.appendChild(el('div', { class: 'slider-row' }, [
      el('label', { text: txt('cut.position') }),
      (function () {
        var inp = el('input', { type: 'range', class: 'slider', min: -100, max: 100, value: Math.round(state.cut.pos * 100) });
        inp.addEventListener('input', function () { markActivity(); state.cut.pos = +inp.value / 100; state.cut.showResult = false; refreshCutPreview(); });
        return inp;
      })()
    ]));

    // 預測
    card.appendChild(el('h3', { text: txt('cut.predict.title') }));
    var shapes = ['triangle', 'square', 'rectangle', 'circle', 'ellipse', 'pentagon', 'hexagon', 'trapezium', 'parallelogram'];
    var popts = el('div', { class: 'options' });
    shapes.forEach(function (key) {
      var cls = 'opt';
      if (state.cut.predicted === key) cls += ' ok';
      popts.appendChild(el('button', {
        class: cls, text: C.SHAPE_NAME[key][T.lang()],
        onclick: function () { markActivity(); state.cut.predicted = key; render(); }
      }));
    });
    card.appendChild(popts);

    // 切 / 重設
    var canCut = res.ok && (!sec || !sec.unsupported);
    card.appendChild(el('div', {}, [
      el('button', {
        class: 'btn green', text: txt('cut.doCut'), disabled: !canCut,
        onclick: function () { markActivity(); doCut(); }
      }),
      el('button', {
        class: 'btn ghost', text: txt('common.reset'),
        onclick: function () { markActivity(); state.cut.showResult = false; state.cut.sep = 0; state.cut.predicted = null; state.cut.section = null; render(); }
      })
    ]));
    if (!res.ok) card.appendChild(el('div', { class: 'feedback no', text: txt('cut.cannotCut') }));
    if (sec && sec.unsupported) card.appendChild(el('div', { class: 'feedback no', text: txt('cut.unsupported') + '：' + txt('cut.unsupportedBody') }));

    // 截面結果
    if (state.cut.showResult && sec) {
      card.appendChild(el('h3', { text: txt('cut.sectionIs') }));
      var label = sec.unsupported ? txt('cut.unsupported') : (C.SHAPE_NAME[sec.key] ? C.SHAPE_NAME[sec.key][T.lang()] : sec.key);
      card.appendChild(el('div', { class: 'feedback ok', text: label }));
      if (state.cut.predicted) {
        var okPred = state.cut.predicted === sec.key ||
          (state.cut.predicted === 'rectangle' && sec.key === 'square') ||
          (state.cut.predicted === 'triangle' && (sec.key === 'isoTriangle' || sec.key === 'equiTriangle' || sec.key === 'rightTriangle')) ||
          (state.cut.predicted === 'ellipse' && sec.key === 'ellipse');
        card.appendChild(el('div', { class: 'feedback ' + (okPred ? 'ok' : 'no'),
          text: okPred ? txt('q.correct') + ' ' + label : txt('q.wrong') + ' ' + txt('cut.sectionIs') + label }));
      }
    }

    panelEl.appendChild(card);
    panelEl.appendChild(stampCard(sec));
    panelEl.appendChild(cutQuizCard());
  }

  function doCut() {
    var solid = G.getSolid(state.shape);
    var res = state.cut.result;
    if (!res) return;
    state.cut.showResult = true;
    state.cut.sep = 0;
    render();
    // 動畫：兩塊分開
    var t0 = performance.now();
    (function sepStep(now) {
      var k = Math.min(1, (now - t0) / 900);
      state.cut.sep = k * 0.9;
      viewer.setSeparation(state.cut.sep);
      if (k < 1) global.requestAnimationFrame(sepStep);
    })(performance.now());
  }

  function stampCard(sec) {
    var card = el('div', { class: 'card' });
    card.appendChild(el('h2', { text: txt('cut.stamp.title') }));
    if (!sec || !state.cut.showResult) {
      card.appendChild(el('div', { class: 'sub', text: txt('cut.stamp.empty') }));
      return card;
    }
    var wrap = el('div', { class: 'stamp-wrap' });
    var cv = el('canvas', { id: 'stamp', width: 360, height: 360 });
    wrap.appendChild(cv);
    card.appendChild(wrap);
    var rot = { v: state.cut.stampRot || 0 }, zoom = { v: state.cut.stampZoom || 1 };
    function draw() {
      drawStamp(cv, sec, rot.v, zoom.v);
    }
    card.appendChild(el('div', { class: 'slider-row' }, [
      el('label', { text: txt('cut.stamp.rotate') }),
      (function () { var i = el('input', { type: 'range', class: 'slider', min: 0, max: 360, value: rot.v }); i.addEventListener('input', function () { markActivity(); rot.v = +i.value; state.cut.stampRot = rot.v; draw(); }); return i; })()
    ]));
    card.appendChild(el('div', { class: 'slider-row' }, [
      el('label', { text: txt('cut.stamp.zoom') }),
      (function () { var i = el('input', { type: 'range', class: 'slider', min: 50, max: 220, value: zoom.v * 100 }); i.addEventListener('input', function () { markActivity(); zoom.v = +i.value / 100; state.cut.stampZoom = zoom.v; draw(); }); return i; })()
    ]));
    setTimeout(draw, 0);
    return card;
  }

  function drawStamp(cv, sec, rotDeg, zoom) {
    var ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    var pts = sec.contour || sec.pts || [];
    if (!pts.length) return;
    var basis = C.planeBasis(sec.normal || [0, 1, 0]);
    var origin = [0, 0, 0];
    pts.forEach(function (p) { origin[0] += p[0]; origin[1] += p[1]; origin[2] += p[2]; });
    origin = origin.map(function (v) { return v / pts.length; });
    var p2 = C.to2D(pts, basis, origin);
    var r = Math.max(1e-6, Math.max.apply(null, p2.map(function (q) { return Math.hypot(q[0], q[1]); })));
    var scale = (Math.min(W, H) * 0.42 / r) * zoom;
    var a = rotDeg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.beginPath();
    p2.forEach(function (q, i) {
      var x = (q[0] * ca - q[1] * sa) * scale;
      var y = -(q[0] * sa + q[1] * ca) * scale;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(196,107,255,.35)';
    ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#8a3fd0'; ctx.stroke();
    ctx.restore();
  }

  /* ---------- 切割題目（三種題型） ---------- */
  function cutQuizCard() {
    var card = el('div', { class: 'card' });
    card.appendChild(el('h2', { text: txt('cut.quiz.title') }));
    var q = state.cut.quiz;
    if (!q) {
      card.appendChild(el('button', { class: 'btn green block', text: txt('cut.quiz.title') + ' ▶', onclick: function () { markActivity(); newCutQuiz(); } }));
      card.appendChild(el('div', { class: 'note', text: txt('status.geometry') }));
      return card;
    }
    card.appendChild(el('div', { class: 'sub', text: cutQuestion(q) }));
    if (q.type === 'target') {
      if (q.answered) {
        card.appendChild(el('div', { class: 'feedback ok', text: cutExplain(q) }));
        card.appendChild(el('button', { class: 'btn orange block', text: txt('common.next'), onclick: function () { markActivity(); state.cut.quiz = null; render(); } }));
      } else {
        card.appendChild(el('div', { class: 'note', text: txt('cut.targetHint') }));
        card.appendChild(el('button', { class: 'btn ghost block', text: txt('common.next'), onclick: function () { markActivity(); state.cut.quiz = null; render(); } }));
      }
      return card;
    }
    var opts = el('div', { class: 'options' });
    q.options.forEach(function (o, i) {
      var cls = 'opt';
      if (q.answered) { if (o.correct) cls += ' ok'; else if (i === q.chosen) cls += ' no'; }
      opts.appendChild(el('button', { class: cls, text: cutOptionLabel(q, o), onclick: function () { if (!q.answered) answerCut(i); } }));
    });
    card.appendChild(opts);
    if (q.answered) {
      card.appendChild(el('div', { class: 'feedback ' + (q.correctAnswer ? 'ok' : 'no'), text: cutExplain(q) }));
      card.appendChild(el('button', { class: 'btn orange block', text: txt('common.next'), onclick: function () { markActivity(); state.cut.quiz = null; render(); } }));
    }
    return card;
  }

  function cutQuestion(q) {
    if (q.type === 'target') {
      return q.target ? tf('cut.targetQ', [shapeLabel(q.target)]) : txt('status.geometry');
    }
    var head = txt('cut.mode.' + q.mode) + '：' + txt('cut.sectionIs');
    if (q.type === 'judge') return head + shapeLabel(q.claim) + '？';
    return head + '？';
  }
  function cutOptionLabel(q, o) {
    if (q.type === 'judge') return txt(o.label === 'true' ? 'quiz.true' : 'quiz.false');
    return shapeLabel(o.key);
  }
  function cutExplain(q) {
    var base;
    if (q.type === 'target') base = q.target ? tf('cut.targetDone', [shapeLabel(q.target)]) : txt('status.geometry');
    else base = txt('cut.sectionIs') + shapeLabel(q.answerKey);
    if (q.answered) base += '　' + (q.correctAnswer ? txt('q.correct') : txt('hint.2'));
    return base;
  }

  function candidateCuts(solid) {
    var cands = [];
    var save = { mode: state.cut.mode, pos: state.cut.pos, angle: state.cut.angle, spin: state.cut.spin };
    ['horizontal', 'vertical', 'slant', 'diagonal'].forEach(function (mode) {
      [-0.5, 0, 0.5].forEach(function (pos) {
        state.cut.mode = mode; state.cut.pos = pos; state.cut.angle = 40; state.cut.spin = 0;
        var pl = cutPlane(solid);
        var r = C.clipSolid(solid, pl);
        if (r.ok) {
          var s = C.classifySection(solid, r.section.pts, pl);
          if (s && !s.unsupported && s.key !== 'none') cands.push({ mode: mode, pos: pos, key: s.key, plane: pl });
        }
      });
    });
    state.cut.mode = save.mode; state.cut.pos = save.pos; state.cut.angle = save.angle; state.cut.spin = save.spin;
    return cands;
  }

  function shapeLabel(key) { return C.SHAPE_NAME[key] ? C.SHAPE_NAME[key][T.lang()] : key; }

  function targetMatch(target, actual) {
    if (target === actual) return true;
    if (target === 'triangle') return /triangle$/i.test(actual) || actual === 'triangle';
    if (target === 'quadrilateral') return ['square', 'rectangle', 'parallelogram', 'trapezium', 'isoTrapezium', 'quadrilateral'].indexOf(actual) >= 0;
    return false;
  }

  function newCutQuiz() {
    var solid = G.getSolid(state.shape);
    var cands = candidateCuts(solid);
    if (!cands.length) {
      state.cut.quiz = { type: 'target', target: null, answered: true, correctAnswer: true };
      render(); return;
    }
    var kinds = ['match', 'judge', 'target'];
    var kind = kinds[Math.floor(Math.random() * 3)];

    if (kind === 'target') {
      // 目標挑戰：請調整切法，切出指定形狀
      var targets = [];
      cands.forEach(function (c) { if (targets.indexOf(c.key) < 0) targets.push(c.key); });
      var target = targets[Math.floor(Math.random() * targets.length)];
      state.cut.quiz = {
        type: 'target', target: target, answered: false, correctAnswer: false
      };
      render(); return;
    }

    // 需要幾何判定的兩種：先挑一個具體切法
    var A = cands[Math.floor(Math.random() * cands.length)];
    // 舞台顯示這個切法的平面（尚未切開）
    state.cut.mode = A.mode; state.cut.pos = A.pos; state.cut.angle = 40;
    state.cut.showResult = false; state.cut.sep = 0;

    if (kind === 'judge') {
      // 判斷題：這一刀切出的截面是不是某形狀？
      var wrongKeys = ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'circle', 'trapezium'];
      var claim;
      var sayTrue = Math.random() < 0.5;
      if (sayTrue) claim = A.key;
      else { var wc = wrongKeys.filter(function (k) { return k !== A.key; }); claim = wc[Math.floor(Math.random() * wc.length)]; }
      var isTrue = (claim === A.key);
      state.cut.quiz = {
        type: 'judge', answered: false, mode: A.mode, claim: claim, answerKey: A.key,
        options: [
          { label: 'true', correct: isTrue },
          { label: 'false', correct: !isTrue }
        ]
      };
    } else {
      // 配對題：這一刀切出的截面是甚麼形狀？
      var pool = ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'circle', 'trapezium', 'parallelogram'];
      var wrongs = pool.filter(function (k) { return k !== A.key; });
      var opts = [{ key: A.key, correct: true }];
      while (opts.length < 3 && wrongs.length) {
        var w = wrongs.splice(Math.floor(Math.random() * wrongs.length), 1)[0];
        opts.push({ key: w, correct: false });
      }
      state.cut.quiz = {
        type: 'match', answered: false, mode: A.mode, answerKey: A.key,
        options: shuffle(opts)
      };
    }
    render();
  }

  function answerCut(i) {
    var q = state.cut.quiz;
    q.answered = true; q.chosen = i;
    q.correctAnswer = !!q.options[i].correct;
    render();
  }

  /* ---------- 工具 ---------- */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  global.PS = global.PS || {};
  global.PS.app = {
    init: init, state: state,
    _test: {
      cutPlane: cutPlane, solidBounds: solidBounds, drawStamp: drawStamp,
      go: go, render: render, buildHome: buildHome,
      newUnfoldQuiz: newUnfoldQuiz, answerUnfold: answerUnfold,
      newCutQuiz: newCutQuiz, answerCut: answerCut,
      candidateCuts: candidateCuts, targetMatch: targetMatch, shapeLabel: shapeLabel,
      doCut: doCut, getViewer: function () { return viewer; },
      onPick: onPick,
      getThumbs: function () { return _thumbViewers || []; }
    }
  };
  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
    else init();
  }
})(typeof window !== 'undefined' ? window : this);
