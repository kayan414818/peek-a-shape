/* ============================================================
   Peek-a-Shape｜立體探秘樂
   i18n.js — 介面所有文字的繁體中文 / English 對照
   只使用繁體中文；英文版全為英文。
   ============================================================ */
(function (global) {
  'use strict';

  var DICT = {
    /* ---------- 立體特徵（所有提示與解釋都以這些特徵為依據） ---------- */
    'solid.feature.cube': { zh: '正方體有 6 個相同的正方形面、12 條棱、8 個頂點。', en: 'A cube has 6 identical square faces, 12 edges and 8 vertices.' },
    'solid.feature.cuboid': { zh: '長方體有 6 個長方形面（對面相同）、12 條棱、8 個頂點。', en: 'A cuboid has 6 rectangular faces (opposite faces are equal), 12 edges and 8 vertices.' },
    'solid.feature.triPrism': { zh: '三角柱有 2 個三角形底面和 3 個長方形側面，共 5 個面、9 條棱、6 個頂點。', en: 'A triangular prism has 2 triangular bases and 3 rectangular sides: 5 faces, 9 edges and 6 vertices.' },
    'solid.feature.quadPrism': { zh: '四角柱有 2 個四邊形底面和 4 個長方形側面，共 6 個面、12 條棱、8 個頂點。', en: 'A quadrilateral prism has 2 quadrilateral bases and 4 rectangular sides: 6 faces, 12 edges and 8 vertices.' },
    'solid.feature.pentaPrism': { zh: '五角柱有 2 個五邊形底面和 5 個長方形側面，共 7 個面、15 條棱、10 個頂點。', en: 'A pentagonal prism has 2 pentagonal bases and 5 rectangular sides: 7 faces, 15 edges and 10 vertices.' },
    'solid.feature.hexaPrism': { zh: '六角柱有 2 個六邊形底面和 6 個長方形側面，共 8 個面、18 條棱、12 個頂點。', en: 'A hexagonal prism has 2 hexagonal bases and 6 rectangular sides: 8 faces, 18 edges and 12 vertices.' },
    'solid.feature.triPyramid': { zh: '三角錐有 1 個三角形底面和 3 個三角形側面，共 4 個面、6 條棱、4 個頂點。', en: 'A triangular pyramid has 1 triangular base and 3 triangular sides: 4 faces, 6 edges and 4 vertices.' },
    'solid.feature.quadPyramid': { zh: '四角錐有 1 個四邊形底面和 4 個三角形側面，共 5 個面、8 條棱、5 個頂點。', en: 'A square pyramid has 1 quadrilateral base and 4 triangular sides: 5 faces, 8 edges and 5 vertices.' },
    'solid.feature.pentaPyramid': { zh: '五角錐有 1 個五邊形底面和 5 個三角形側面，共 6 個面、10 條棱、6 個頂點。', en: 'A pentagonal pyramid has 1 pentagonal base and 5 triangular sides: 6 faces, 10 edges and 6 vertices.' },
    'solid.feature.cylinder': { zh: '圓柱有 2 個圓形平面（上、下）和 1 個曲面（側面），共 3 個面；圓形的邊是曲線，不是直棱。', en: 'A cylinder has 2 circular flat faces (top and bottom) and 1 curved side: 3 faces. Its circular rims are curves, not straight edges.' },
    'solid.feature.cone': { zh: '圓錐有 1 個圓形底面和 1 個曲面（側面），共 2 個面；尖頂是 1 個頂點，底圓的邊是曲線。', en: 'A cone has 1 circular base and 1 curved side: 2 faces. The apex is 1 vertex and the rim of the base is a curve.' },
    'solid.feature.sphere': { zh: '球體整個表面都是曲面：沒有平面、沒有棱、也沒有頂點。', en: 'A sphere is all curved surface: no flat faces, no edges and no vertices.' },

    /* ---------- 導覽 ---------- */
    'app.name': { zh: '立體探秘樂', en: 'Peek-a-Shape' },
    'app.title': { zh: '立體探秘樂｜Peek-a-Shape', en: 'Peek-a-Shape' },
    'nav.home': { zh: '主頁', en: 'Home' },
    'nav.inspect': { zh: '觀察', en: 'Inspect' },
    'nav.unfold': { zh: '展開', en: 'Unfold' },
    'nav.cut': { zh: '切割', en: 'Cut' },
    'nav.lang.toEn': { zh: 'English', en: '中文' },
    'stage.zoomIn': { zh: '放大', en: 'Zoom in' },
    'stage.zoomOut': { zh: '縮小', en: 'Zoom out' },
    'stage.reset': { zh: '重設視角', en: 'Reset view' },

    /* ---------- 主頁 ---------- */
    'home.title': { zh: '立體探秘樂', en: 'Peek-a-Shape' },
    'home.subtitle': { zh: '一起來觀察、展開、切割立體圖形！', en: "Let's observe, unfold and cut 3D shapes together!" },
    'home.start': { zh: '開始探索', en: 'Start Exploring' },
    'home.card.inspect.title': { zh: '立體模型庫', en: '3D Model Library' },
    'home.card.inspect.desc': { zh: '轉動立體、數一數面、棱和頂點。', en: 'Rotate solids and count faces, edges and vertices.' },
    'home.card.unfold.title': { zh: '展開圖魔法', en: 'Net Magic' },
    'home.card.unfold.desc': { zh: '把立體攤平成展開圖，再摺回立體。', en: 'Flatten a solid into a net, then fold it back.' },
    'home.card.cut.title': { zh: '切一刀看看', en: 'Cross-Section Cutter' },
    'home.card.cut.desc': { zh: '用平面切開立體，看看截面是甚麼形狀。', en: 'Slice a solid with a plane and see the cross-section.' },
    'home.choose': { zh: '選一個來玩', en: 'Choose one to play' },

    /* ---------- 通用 ---------- */
    'common.back': { zh: '返回', en: 'Back' },
    'common.reset': { zh: '重設', en: 'Reset' },
    'common.resetView': { zh: '重設視角', en: 'Reset view' },
    'common.next': { zh: '下一題', en: 'Next question' },
    'common.check': { zh: '檢查答案', en: 'Check answer' },
    'common.show': { zh: '顯示', en: 'Show' },
    'common.hide': { zh: '隱藏', en: 'Hide' },
    'common.on': { zh: '開', en: 'On' },
    'common.off': { zh: '關', en: 'Off' },
    'common.faces': { zh: '面', en: 'faces' },
    'common.edges': { zh: '棱', en: 'edges' },
    'common.vertices': { zh: '頂點', en: 'vertices' },
    'common.face': { zh: '面', en: 'face' },
    'common.edge': { zh: '棱', en: 'edge' },
    'common.vertex': { zh: '頂點', en: 'vertex' },
    'common.question': { zh: '問題', en: 'Question' },
    'common.correct': { zh: '答對了！', en: 'Correct!' },
    'common.correctMsg': { zh: '做得好！你答對了！', en: 'Well done! That is correct!' },
    'common.incorrect': { zh: '再想一想', en: 'Not quite' },
    'common.comingSoon': { zh: '此切法稍後開放', en: 'This cutting mode is coming soon' },
    'common.unsupported': { zh: '這個組合暫時不支援，為免顯示錯誤的截面，我們先不顯示。', en: 'This combination is not supported yet. To avoid showing a wrong section, it is disabled for now.' },
    'common.chooseSolid': { zh: '選擇立體', en: 'Choose a solid' },
    'common.choose': { zh: '選擇立體', en: 'Choose a solid' },
    'common.pleaseChoose': { zh: '請先選一個立體。', en: 'Please choose a solid first.' },

    /* ---------- 模組一：觀察 ---------- */
    'inspect.title': { zh: '立體模型庫', en: '3D Model Library' },
    'inspect.intro': { zh: '選一個立體，拖動來轉動它、滾輪或雙指來縮放。', en: 'Choose a solid, drag to rotate it, and use the wheel or pinch to zoom.' },
    'inspect.xray': { zh: '顯示棱和頂點', en: 'Show edges & vertices' },
    'inspect.highlightFaces': { zh: '點面來數一數', en: 'Click faces to count' },
    'inspect.countTotal': { zh: '共 {0} 個面', en: '{0} faces in total' },
    'inspect.countLabel': { zh: '已數的面', en: 'Faces counted' },
    'inspect.infoTitle': { zh: '圖形小檔案', en: 'Shape facts' },
    'inspect.faceDetail': { zh: '面', en: 'Faces' },
    'inspect.edgeDetail': { zh: '棱', en: 'Edges' },
    'inspect.vertDetail': { zh: '頂點', en: 'Vertices' },
    'inspect.zoom': { zh: '放大 / 縮小', en: 'Zoom' },
    'inspect.curvedNote.cylinder': { zh: '圓柱的側面是曲面，不算平面；圓形的邊是曲線，不是直棱。', en: 'The side of a cylinder is curved and is not a flat face; its circular edges are curves, not straight edges.' },
    'inspect.curvedNote.cone': { zh: '圓錐有一個曲面側面和一個圓形平面底面，尖頂是 1 個頂點。', en: 'A cone has one curved surface, one flat circular base, and its apex is a single vertex.' },
    'inspect.curvedNote.sphere': { zh: '球體整個表面都是曲面，沒有平面、沒有棱、也沒有頂點。', en: 'A sphere is all curved surface: no flat faces, no edges and no vertices.' },

    /* ---------- 模組二：展開 ---------- */
    'unfold.title': { zh: '展開圖魔法', en: 'Net Magic' },
    'unfold.intro': { zh: '拉動滑桿，看看立體怎樣攤平成展開圖，再摺回立體。', en: 'Drag the slider to flatten the solid into a net, then fold it back.' },
    'unfold.slider': { zh: '摺合 ↔ 攤平', en: 'Fold ↔ Flatten' },
    'unfold.flat': { zh: '展開圖', en: 'Flat net' },
    'unfold.solid': { zh: '立體', en: 'Solid' },
    'unfold.correspond': { zh: '點展開圖上的面，對應的立體面會亮起來。', en: 'Click a face on the net; the matching solid face glows.' },
    'unfold.pickCell': { zh: '這塊面對應立體上的：', en: 'This piece matches the solid face:' },
    'unfold.variant': { zh: '換一個展開圖', en: 'Another net' },
    'unfold.autoFold': { zh: '▶ 自動摺合', en: '▶ Auto fold' },
    'unfold.autoUnfold': { zh: '▶ 自動展開', en: '▶ Auto unfold' },
    'unfold.cannotNet.title': { zh: '球體不能做成展開圖', en: 'A sphere cannot be a net' },
    'unfold.cannotNet.body': { zh: '球體的表面全部是曲面，不能攤平成由直邊組成的展開圖。我們可以轉動球體來觀察它的曲面。', en: 'A sphere is all curved surface. It cannot be flattened into a net of straight edges. We can rotate the sphere to explore its curved surface.' },
    'unfold.noNetHint': { zh: '在舞台上拖動可轉動，滾輪或雙指可放大縮小。', en: 'Drag in the stage to rotate; scroll or pinch to zoom.' },
    'unfold.quiz.title': { zh: '展開圖大考驗', en: 'Net challenge' },
    'unfold.quiz.matchQ': { zh: "哪一個展開圖可以摺成「{0}」？", en: 'Which net folds into {0}?' },
    'unfold.quiz.invalidQ': { zh: '哪一個展開圖不能摺成「{0}」？', en: 'Which net cannot fold into {0}?' },
    'unfold.quiz.whyFits': { zh: '這個展開圖剛好有 {0} 塊面，跟立體的每一個面一一對應；摺起來每塊面都貼在表面上，沒有重疊、也沒有缺口。', en: 'This net has exactly {0} pieces, one for each face of the solid; when folded, every piece lands on the surface with no overlap and no gap.' },
    'unfold.quiz.othersFold': { zh: '另外兩個展開圖都可以完整摺成它，只有這一個不行。', en: 'The other two nets all fold into it completely — only this one cannot.' },
    'unfold.quiz.explainOverlap': { zh: '這個展開圖摺起來時，有些面會互相重疊，所以摺不出完整的立體。', en: 'When this net folds, some faces overlap each other, so it cannot form the solid.' },
    'unfold.quiz.explainGap': { zh: '這個展開圖摺起來後會留下缺口，表面積也跟立體不同，所以不能完整包住立體。', en: 'This net leaves a gap when folded and its area differs from the solid, so it cannot cover it completely.' },
    'unfold.quiz.explainWrong': { zh: '這個展開圖的面數或大小跟目標立體不同，所以摺不成它。', en: 'This net has a different number or size of faces, so it does not fold into the target solid.' },
    'unfold.quiz.showFold': { zh: '看摺合動畫', en: 'Show fold animation' },
    'unfold.quiz.showCorrectFold': { zh: '看正確答案的摺合動畫', en: 'Show the correct net folding' },
    'unfold.quiz.pickOne': { zh: '選一個展開圖：', en: 'Pick a net:' },
    'unfold.quiz.netLabel': { zh: '展開圖 {0}', en: 'Net {0}' },
    // 第一次答錯：只給提示（以目標立體自身的特徵引導），不揭示答案
    'unfold.quiz.hintOverlapFeat': { zh: '提示：{0} 你選的展開圖摺起來時有面會互相重疊——先數一數它的面數和形狀，再找一個能剛好包住這個立體的。', en: 'Hint: {0} The net you chose would overlap itself when folded — count its faces and name their shapes, then find the net that wraps the solid exactly.' },
    'unfold.quiz.hintGapFeat': { zh: '提示：{0} 你選的展開圖摺起來會留下缺口——先看看它有沒有齊全的面，大小是否配合。', en: 'Hint: {0} The net you chose leaves a gap when folded — check that every face of the solid is there and the right size.' },
    'unfold.quiz.hintFacesFeat': { zh: '提示：{0} 先數一數你選的展開圖有幾塊面、是甚麼形狀，再跟這個立體的特徵比較。', en: 'Hint: {0} Count the pieces in the net you chose and name their shapes, then compare them with this solid.' },
    'unfold.quiz.hintValidFeat': { zh: '提示：{0} 你選的這個展開圖其實可以完整摺成它，所以不是答案——再找找哪一個的面數或形狀跟它不符。', en: 'Hint: {0} The net you chose actually folds into it completely, so it is not the answer. Look for the one whose faces do not match.' },
    'unfold.quiz.hintTryAgain': { zh: '再想一想，然後再選一次。', en: 'Think again, then choose once more.' },
    // 第二次答錯：揭示答案 + 解釋
    'unfold.quiz.answerReveal': { zh: '正確答案是 {0}。', en: 'The correct answer is {0}.' },
    'unfold.quiz.chosenNotFolds': { zh: '你選的 {0} 摺不成：{1}。', en: '{0} does not fold up: {1}.' },
    'unfold.quiz.chosenFolds': { zh: '你選的 {0} 其實可以完整摺成立體，所以它不是答案。', en: '{0} actually folds into the solid, so it is not the answer.' },
    'unfold.quiz.correctFolds': { zh: '{0} 才是摺得成的展開圖。', en: '{0} is the net that folds up correctly.' },
    'unfold.quiz.correctNotFolds': { zh: '{0} 才是摺不成的那一個：{1}。', en: '{0} is the one that cannot fold up: {1}.' },
    'unfold.quiz.rOverlap': { zh: '摺起來時有面會互相重疊', en: 'some faces overlap when it folds' },
    'unfold.quiz.rGap': { zh: '摺起來會留下缺口，包不住整個立體', en: 'a gap is left, so it cannot cover the solid' },
    'unfold.quiz.rWrong': { zh: '面的數目或大小跟立體不合', en: 'its faces do not match the solid' },

    /* ---------- 模組三：切割 ---------- */
    'cut.title': { zh: '切一刀看看', en: 'Cross-Section Cutter' },
    'cut.intro': { zh: '先想想截面會是甚麼形狀，再按「切下去」看看實際結果。', en: 'First guess the cross-section shape, then press "Cut" to see the real result.' },
    'cut.mode': { zh: '切法', en: 'Cut direction' },
    'cut.mode.horizontal': { zh: '水平切', en: 'Horizontal' },
    'cut.mode.vertical': { zh: '垂直切', en: 'Vertical' },
    'cut.mode.slant': { zh: '斜切', en: 'Slanted' },
    'cut.mode.diagonal': { zh: '對角切', en: 'Diagonal' },
    'cut.angle': { zh: '角度', en: 'Angle' },
    'cut.height': { zh: '切的位置', en: 'Cut position' },
    'cut.doCut': { zh: '切下去', en: 'Cut' },
    'cut.step1': { zh: '第 1 步：預覽平面', en: 'Step 1: Preview the plane' },
    'cut.step2': { zh: '第 2 步：切開並分開兩塊', en: 'Step 2: Cut and separate the pieces' },
    'cut.stepNext': { zh: '下一步', en: 'Next step' },
    'cut.predict.title': { zh: '先猜一猜：截面是甚麼形狀？', en: 'Guess first: what shape is the cross-section?' },
    'cut.sectionIs': { zh: '截面是：', en: 'The cross-section is:' },
    'cut.targetQ': { zh: '請調整切法，切出「{0}」。', en: 'Adjust the cut to make {0}.' },
    'cut.targetDone': { zh: '做得好！你切出了{0}。', en: 'Well done! You made {0}.' },
    'cut.targetHint': { zh: '用上面的切法和滑桿調整，切出目標形狀吧！', en: 'Use the cut direction and sliders above to make the target shape!' },
    'cut.stamp.title': { zh: '把截面印下來', en: 'Stamp the cross-section' },
    'cut.stamp.rotate': { zh: '旋轉', en: 'Rotate' },
    'cut.stamp.zoom': { zh: '縮放', en: 'Zoom' },
    'cut.stamp.empty': { zh: '切一刀，截面就會出現在這裡。', en: 'Cut once and the cross-section will appear here.' },
    'cut.cannotCut': { zh: '這個方向切不到立體，請調整位置或角度。', en: 'This direction does not cut through the solid. Adjust the position or angle.' },
    'cut.unsupported': { zh: '此切法稍後開放', en: 'This cutting mode is coming soon' },
    'cut.unsupportedBody': { zh: '這一刀會切出「曲線加直邊」的組合截面，為了不顯示錯誤的圖形，我們暫時不開放這種切法。', en: 'This cut would produce a mixed curve-and-straight-edge section. To avoid showing a wrong shape, we keep this mode closed for now.' },
    'cut.stepByStepNote': { zh: '逐步模式：先看平面，再切開，最後看兩塊分開。', en: 'Step mode: see the plane, then cut, then watch the two pieces separate.' },
    'cut.position': { zh: '位置', en: 'Position' },
    'cut.quiz.title': { zh: '切割大考驗', en: 'Cut challenge' },
    // 提示（rule-based，全部由幾何計算得出）
    'cut.hintPrefix': { zh: '提示：{0}', en: 'Hint: {0}' },
    'cut.modeHint.horizontal': { zh: '水平切與底面平行，截面會跟底面同一個形狀（大小可能不同）。先想一想它的底面是甚麼形狀。', en: 'A horizontal cut is parallel to the base, so the section has the same shape as the base (maybe a different size). First think what shape its base is.' },
    'cut.modeHint.vertical': { zh: '垂直切由頂到底貫穿；如果刀面切過曲面，截面的邊界就會有曲線。先想一想這一刀會穿過哪些面。', en: 'A vertical cut runs from top to bottom. If the plane passes through the curved surface, the boundary of the section becomes curved. Think about which faces this cut passes through.' },
    'cut.modeHint.slant': { zh: '斜切與底面斜交，截面會被拉長；切到曲面（例如圓柱、圓錐的側面）就會變成橢圓。', en: 'A slanted cut meets the base at an angle and stretches the section; cutting a curved surface (such as the side of a cylinder or cone) gives an ellipse.' },
    'cut.modeHint.diagonal': { zh: '對角切沿對角方向穿過，會比水平、垂直切更長，也會穿過更多面。', en: 'A diagonal cut runs corner-to-corner, so it is longer than a horizontal or vertical cut and passes through more faces.' },
    'cut.predict.reveal': { zh: '正確答案是{0}。', en: 'The correct answer is {0}.' },
    'cut.predict.hintAgain': { zh: '再想一想，然後再按「切下去」。', en: 'Think again, then press "Cut".' },
    'cut.whySides': { zh: '截面的邊界由 {0} 條邊圍成，所以是{1}。', en: 'The boundary of this section is made of {0} edges, so it is {1}.' },
    'cut.whyCurve': { zh: '這一刀切到曲面，邊界是曲線，所以是{0}。', en: 'This cut goes through a curved surface, so the section is {0}.' },
    'cut.quiz.hintTryAgain': { zh: '還有一次機會，再選一次。', en: 'One more try — choose again.' },
    'cut.quiz.matchReveal': { zh: '正確答案：截面是{0}。', en: 'Answer: the section is {0}.' },
    'cut.quiz.judgeReveal': { zh: '正確答案：「{0}」，截面是{1}。', en: 'Answer: "{0}" — the section is {1}.' },
    'cut.quiz.correctSection': { zh: '截面是{0}。', en: 'The cross-section is {0}.' },
    'cut.quiz.targetHint1': { zh: '提示：{0} 目標是{1}——先數一數目標形狀有幾條邊，再試試另一種切法。', en: 'Hint: {0} The target is {1} — count the edges of the target, then try another cut direction.' },
    'cut.quiz.targetAnswer': { zh: '正確做法：用「{0}」，把位置滑桿調到 {1}，就會切出{2}。', en: 'The answer: use "{0}" and set the position slider to {1}; that makes {2}.' },
    'cut.quiz.targetHint2': { zh: '這個立體要用另一種切法才做得到，四個切法都試試看。', en: 'This solid needs a different cut direction — try all four.' },
    'quiz.true': { zh: '對', en: 'True' },
    'quiz.false': { zh: '不對', en: 'False' },

    /* ---------- 題目 / 回饋 ---------- */
    'q.correct': { zh: '答對了！', en: 'Correct!' },
    'q.wrong': { zh: '再試一次。', en: 'Try again.' },
    'q.explain': { zh: '解釋', en: 'Explanation' },
    'hint.0': { zh: '提示：先想想這個立體有幾個面。', en: 'Hint: first think about how many faces this solid has.' },
    'hint.1': { zh: '提示：看看切面跟哪些面相交。', en: 'Hint: look at which faces the cutting plane meets.' },
    'hint.2': { zh: '提示：數一數截面的邊數，再想想邊的長度和角度。', en: 'Hint: count the edges of the section, then think about their lengths and angles.' },

    /* ---------- 狀態列 ---------- */
    'status.ready': { zh: '可以開始了！', en: 'Ready!' },
    'status.geometry': { zh: '所有答案都由真實幾何計算得出。', en: 'Every answer is judged by real geometry.' },
    'status.aiNote': { zh: '提示由內置的規則產生（未連接外部 AI）。', en: 'Hints come from built-in rules (no external AI connected).' }
  };

  var listeners = [];
  var state = { lang: 'zh' };

  function t(key, lang) {
    var e = DICT[key];
    if (!e) return key;
    return e[lang || state.lang] || e.zh || key;
  }
  function tf(key, args, lang) {
    var s = t(key, lang);
    if (args) {
      for (var i = 0; i < args.length; i++) s = s.replace('{' + i + '}', args[i]);
    }
    return s;
  }
  function setLang(lang) {
    state.lang = (lang === 'en') ? 'en' : 'zh';
    listeners.forEach(function (fn) { try { fn(state.lang); } catch (e) {} });
  }
  function onChange(fn) { listeners.push(fn); }
  function lang() { return state.lang; }

  global.PS = global.PS || {};
  global.PS.i18n = {
    t: t, tf: tf, setLang: setLang, lang: lang, onChange: onChange, DICT: DICT
  };
})(typeof window !== 'undefined' ? window : this);
