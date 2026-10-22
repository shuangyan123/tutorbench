/* global window, document, navigator, history, location, performance, requestAnimationFrame, setTimeout, console, IntersectionObserver, URL */
/* Teachometry · Spectrum — prototype interactions.
   1) 语言切换  2) 顶栏状态  3) 首页棱镜（WebGL2）  4) 分光滚动叙事  5) 标本架  6) 进场与复制 */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  function reduced() { return reduceQuery.matches || root.getAttribute("data-motion") === "reduce"; }
  function lang() { return root.getAttribute("data-lang") === "zh" ? "zh" : "en"; }

  /* ------------------------------------------------------------ 1 language */
  var langListeners = [];
  function setLang(next) {
    root.setAttribute("data-lang", next);
    root.lang = next === "zh" ? "zh-CN" : "en";
    try {
      var url = new URL(location.href);
      url.searchParams.set("lang", next);
      history.replaceState(null, "", url);
    } catch { /* 预览环境可能不允许改地址，忽略 */ }
    langListeners.forEach(function (fn) { fn(next); });
  }
  var toggle = document.querySelector("[data-lang-toggle]");
  if (toggle) toggle.addEventListener("click", function () { setLang(lang() === "zh" ? "en" : "zh"); });

  /* ------------------------------------------------------------ 2 bar */
  var bar = document.querySelector("[data-bar]");
  function updateBar() {
    if (!bar) return;
    if (window.scrollY > 24) bar.setAttribute("data-scrolled", ""); else bar.removeAttribute("data-scrolled");
  }

  /* ------------------------------------------------------------ 3 cover prism */
  var hero = document.querySelector("[data-hero]");
  var canvas = document.querySelector("[data-hero-canvas]");
  var VERT = "#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  var FRAG = [
    "#version 300 es",
    "precision highp float;",
    "uniform vec2 uRes; uniform float uTime; uniform float uIntro;",
    "uniform vec2 uC; uniform float uS; uniform float uPlate; uniform float uBase; uniform float uSpread; uniform float uAng;",
    "out vec4 o;",
    // 白天的工作室：一面纸墙，左边一道窄窄的阳光，一块玻璃棱镜，右边五条谱线落在印刷标尺上
    "const vec3 C0=vec3(1.0,.42,.22), C1=vec3(1.0,.74,.12), C2=vec3(.16,.78,.50), C3=vec3(.20,.46,1.0), C4=vec3(.52,.32,.98);",
    "vec3 band(int i){ return i==0?C0:i==1?C1:i==2?C2:i==3?C3:C4; }",
    "float A; vec2 V0,V1,V2,E,X,DIN,FACE; float LIT, REACH_IN, REACH_T;",
    "float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }",
    "mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }",
    "float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2){",
    "  vec2 e0=p1-p0, e1=p2-p1, e2=p0-p2; vec2 v0=p-p0, v1=p-p1, v2=p-p2;",
    "  vec2 pq0=v0-e0*clamp(dot(v0,e0)/dot(e0,e0),0.,1.);",
    "  vec2 pq1=v1-e1*clamp(dot(v1,e1)/dot(e1,e1),0.,1.);",
    "  vec2 pq2=v2-e2*clamp(dot(v2,e2)/dot(e2,e2),0.,1.);",
    "  float s=sign(e0.x*e2.y-e0.y*e2.x);",
    "  vec2 d=min(min(vec2(dot(pq0,pq0),s*(v0.x*e0.y-v0.y*e0.x)), vec2(dot(pq1,pq1),s*(v1.x*e1.y-v1.y*e1.x))), vec2(dot(pq2,pq2),s*(v2.x*e2.y-v2.y*e2.x)));",
    "  return -sqrt(d.x)*sign(d.y); }",
    "float ray(vec2 p, vec2 org, vec2 dir, float w0, float grow, float reach){",
    "  vec2 q=p-org; float al=dot(q,dir); float pp=dot(q,vec2(-dir.y,dir.x));",
    "  if(al<0.) return 0.;",
    "  float w=w0+grow*al;",
    "  return exp(-pp*pp/(w*w))*smoothstep(reach,reach-.01,al)*smoothstep(0.,.015,al); }",
    // the wall, without the prism
    "vec3 wall(vec2 p){",
    "  vec3 c=vec3(.966,.957,.94);",
    "  c=mix(c,vec3(.875,.91,.962),smoothstep(1.35,0.,length((p-vec2(-A*.55,.6))*vec2(.75,1.)))*.7);",
    "  c=mix(c,vec3(.998,.95,.86),smoothstep(1.1,0.,length(p-vec2(A*.5,-.62)))*.6);",
    "  c=mix(c,vec3(.985,.9,.94),smoothstep(.9,0.,length(p-vec2(A*.42,.55)))*.35);",
    "  c*=.94+.06*smoothstep(-A*.5,-.05,p.x);",
    "  return c; }",
    "vec3 scene(vec2 p){",
    "  vec3 c=wall(p);",
    // incoming sunlight
    "  float lenIn=length(E-(E-DIN*3.));",
    "  float halo=ray(p,E-DIN*3.,DIN,.05,.0,REACH_IN);",
    "  float core=ray(p,E-DIN*3.,DIN,.008,.0,REACH_IN);",
    "  vec2 qq=p-E; float behind=step(dot(qq,DIN),0.);",
    "  c=mix(c,vec3(1.,.99,.955),clamp(halo*.3+core*.7,0.,1.)*behind);",
    // dispersed light: a soft pastel fan on the wall, then five crisp lines
    "  vec2 q=p-X; float r=length(q);",
    "  float stopAt=smoothstep(uPlate+.004,uPlate-.03,p.x);",
    "  if(q.x>0.){",
    "    float ang=atan(q.y,q.x); float sig=uSpread*.2;",
    "    float fall=smoothstep(0.,.1,r)*exp(-r*.9)*stopAt*LIT;",
    "    for(int i=0;i<5;i++){",
    "      float th=uBase-uSpread*(float(i)/4.);",
    "      float w=exp(-pow((ang-th)/sig,2.));",
    "      c*=mix(vec3(1.),mix(vec3(1.),band(i),.55),w*fall*.85);",
    "    }",
    "  }",
    "  for(int i=0;i<5;i++){",
    "    float th=uBase-uSpread*(float(i)/4.);",
    "    vec2 d=vec2(cos(th),sin(th));",
    "    vec2 org=X+FACE*(float(i)-2.)*.003;",
    "    float toPlate=(uPlate-org.x)/d.x;",
    "    float b=ray(p,org,d,.0024,.004,min(REACH_T,toPlate+.006));",
    "    vec3 inkc=band(i)*vec3(.82,.78,.82);",
    "    c=mix(c,inkc,clamp(b,0.,1.)*.92);",
    "  }",
    "  return c; }",
    "void main(){",
    "  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;",
    "  A=uRes.x/uRes.y;",
    "  mat2 R=rot(uAng);",
    "  V0=uC+R*vec2(0.,uS); V1=uC+R*vec2(-.866*uS,-.5*uS); V2=uC+R*vec2(.866*uS,-.5*uS);",
    "  E=mix(V0,V1,.56); X=mix(V0,V2,.56); FACE=normalize(V2-V0);",
    "  DIN=normalize(vec2(1.,-.08));",
    "  REACH_IN=uIntro*1.8*3.; LIT=smoothstep(.55,.8,uIntro); REACH_T=max(0.,uIntro-.6)*4.;",
    "  float dTri=sdTri(p,V0,V1,V2);",
    "  vec3 col=scene(p);",
    // soft contact shadow + a faint coloured caustic under the glass
    "  float dSh=sdTri(p-vec2(.006,-.012),V0,V1,V2);",
    "  float sh=smoothstep(.035,-.01,dSh)*step(0.,dTri);",
    "  col*=1.-sh*.07;",
    // printed ruler at the plate
    "  vec2 ht=X+vec2(cos(uBase),sin(uBase))*((uPlate-X.x)/cos(uBase));",
    "  vec2 hb=X+vec2(cos(uBase-uSpread),sin(uBase-uSpread))*((uPlate-X.x)/cos(uBase-uSpread));",
    "  float yT=ht.y+.07, yB=hb.y-.07;",
    "  float inY=step(yB,p.y)*step(p.y,yT);",
    "  float ruler=smoothstep(.5,.8,uIntro);",
    "  float axis=exp(-abs(p.x-uPlate)/.0007)*inY;",
    "  float fy=(p.y-yB)/.0125;",
    "  float tMin=step(fract(fy),.1)*step(uPlate,p.x)*step(p.x,uPlate+.007)*inY;",
    "  float tMaj=step(fract(fy/5.),.02)*step(uPlate,p.x)*step(p.x,uPlate+.015)*inY;",
    "  col=mix(col,vec3(.13,.12,.10),clamp(axis*.8+tMin*.45+tMaj*.7,0.,1.)*ruler);",
    // glass: refracts the scene behind it, splitting the channels a little
    "  if(dTri<0.){",
    "    float depth=clamp(-dTri/(uS*.5),0.,1.);",
    "    vec2 off=(p-uC)*-.55+vec2(.0,.02);",
    "    vec3 g=vec3(scene(p+off).r, scene(p+off*1.05+vec2(.004,0.)).g, scene(p+off*1.1+vec2(.008,0.)).b);",
    "    g*=vec3(.94,.958,.985)*(.965+.07*clamp((p.y-uC.y)/uS+.5,0.,1.));",
    "    g=mix(g,vec3(1.),.22*(1.-smoothstep(0.,.35,depth)));",
    "    float inner=ray(p,E,normalize(X-E),.006,.025,length(X-E)*smoothstep(.45,.6,uIntro)+.0001);",
    "    g=mix(g,vec3(1.,.99,.95),inner*.7);",
    "    g+=mix(C3,C4,.5)*exp(-length(p-X)/(uS*.18))*.1*LIT;",
    "    g+=C1*exp(-length(p-V1)/(uS*.25))*.04;",
    "    col=g;",
    "  }",
    "  float edge=exp(-abs(dTri)/.0011);",
    "  col=mix(col,vec3(.17,.19,.25),edge*.7*smoothstep(0.,.35,uIntro));",
    "  col+=vec3(1.)*exp(-abs(dTri+.004)/.0012)*.45*step(dTri,0.);",
    "  col+=vec3(1.,.99,.95)*exp(-length(p-E)/.014)*.25*LIT;",
    "  col+=(hash(gl_FragCoord.xy+fract(uTime*.37)*91.)-.5)*.014;",
    "  o=vec4(clamp(col,0.,1.),1.);",
    "}"
  ].join("\n");

  function startHero() {
    if (!canvas || !hero) return;
    var gl = null;
    try { gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" }); } catch { gl = null; }
    if (!gl) { hero.setAttribute("data-gl", "off"); return; }
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { hero.setAttribute("data-gl", "off"); return; }
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { hero.setAttribute("data-gl", "off"); return; }
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ["uRes", "uTime", "uIntro", "uC", "uS", "uPlate", "uBase", "uSpread", "uAng"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    hero.setAttribute("data-gl", "on");

    var lineLabels = Array.prototype.slice.call(hero.querySelectorAll("[data-line]"));
    var annA = hero.querySelector('[data-annot="a"]'), annB = hero.querySelector('[data-annot="b"]');
    var ptr = { x: 0, y: 0 }, ptrT = { x: 0, y: 0 };
    var start = performance.now();
    var visible = true, raf = 0, labelsShown = false;
    var L = { cx: 0, cy: .14, s: .22, plate: .5, base: -.02, spread: .42 };
    var W = 1, H = 1;

    function resize() {
      W = hero.clientWidth; H = hero.clientHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5) * (W < 700 ? .85 : .8);
      canvas.width = Math.max(2, Math.round(W * dpr)); canvas.height = Math.max(2, Math.round(H * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      var a = W / H;
      // 棱镜是首屏唯一的主角：桌面上占画面上半部；文字留在左下；标签留在量板右侧
      if (a > 1.2) L = { cx: -a * .03, cy: .15, s: Math.min(.25, .15 + a * .05), plate: a / 2 - Math.max(.16, 200 / H), base: -.01, spread: .42 };
      else if (a > .8) L = { cx: -a * .1, cy: .2, s: .18, plate: a / 2 - 180 / H, base: -.03, spread: .46 };
      else L = { cx: -a * .16, cy: .18, s: .15, plate: a / 2 - 44 / H, base: -.14, spread: .66 };
      if (a <= .8) hero.setAttribute("data-narrow", ""); else hero.removeAttribute("data-narrow");
      if (reduced()) draw(performance.now());
    }
    function geometry(ang, base, spread) {
      // 与着色器同一套几何（CSS 像素）：五个落点、A（入射光）与 B（棱镜底边）的位置
      var c = Math.cos(ang), s = Math.sin(ang);
      function R(x, y) { return [c * x + s * y, -s * x + c * y]; }
      var r0 = R(0, L.s), r1 = R(-.866 * L.s, -.5 * L.s), r2 = R(.866 * L.s, -.5 * L.s);
      var v0 = [L.cx + r0[0], L.cy + r0[1]], v1 = [L.cx + r1[0], L.cy + r1[1]], v2 = [L.cx + r2[0], L.cy + r2[1]];
      var X = [v0[0] + (v2[0] - v0[0]) * .56, v0[1] + (v2[1] - v0[1]) * .56];
      var E = [v0[0] + (v1[0] - v0[0]) * .56, v0[1] + (v1[1] - v0[1]) * .56];
      var fl = Math.hypot(v2[0] - v0[0], v2[1] - v0[1]), face = [(v2[0] - v0[0]) / fl, (v2[1] - v0[1]) / fl];
      function px(u) { return [u[0] * H + W / 2, H / 2 - u[1] * H]; }
      var hits = [];
      for (var i = 0; i < 5; i++) {
        var th = base - spread * (i / 4);
        var org = [X[0] + face[0] * (i - 2) * .003, X[1] + face[1] * (i - 2) * .003];
        var tp = (L.plate - org[0]) / Math.cos(th);
        hits.push(px([L.plate, org[1] + Math.sin(th) * tp]));
      }
      var dl = Math.hypot(1, -.08), din = [1 / dl, -.08 / dl];
      var ax = -W / H / 2 + Math.min(.22, (E[0] + W / H / 2) * .3);
      var aPt = px([ax, E[1] + (ax - E[0]) * din[1] / din[0]]);
      var bPt = px([(v1[0] + v2[0]) / 2, (v1[1] + v2[1]) / 2]);
      return { hits: hits, a: aPt, b: bPt };
    }
    function draw(now) {
      var t = (now - start) / 1000;
      var rm = reduced();
      var intro = rm ? 1 : Math.min(1, t / 2.6);
      ptr.x += (ptrT.x - ptr.x) * .05; ptr.y += (ptrT.y - ptr.y) * .05;
      var r = hero.getBoundingClientRect();
      var sc = rm ? 0 : Math.max(0, Math.min(1, -r.top / Math.max(1, r.height)));
      var px = rm ? 0 : ptr.x, py = rm ? 0 : ptr.y;
      var ang = -.06 + px * .07 + sc * .22;
      var base = L.base - px * .03 + sc * .05;
      var spread = L.spread * (1 + sc * .55) + py * .05;
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, rm ? 4 : t);
      gl.uniform1f(U.uIntro, intro);
      gl.uniform2f(U.uC, L.cx, L.cy);
      gl.uniform1f(U.uS, L.s);
      gl.uniform1f(U.uPlate, L.plate);
      gl.uniform1f(U.uBase, base);
      gl.uniform1f(U.uSpread, spread);
      gl.uniform1f(U.uAng, ang);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      var g = geometry(ang, base, spread);
      lineLabels.forEach(function (el, i) { el.style.transform = "translate(" + (g.hits[i][0] + 18).toFixed(1) + "px," + g.hits[i][1].toFixed(1) + "px)"; });
      if (annA) annA.style.transform = "translate(" + g.a[0].toFixed(1) + "px," + (g.a[1] - 30).toFixed(1) + "px)";
      if (annB) annB.style.transform = "translate(" + (g.b[0] - 40).toFixed(1) + "px," + (g.b[1] + 22).toFixed(1) + "px)";
      if (!labelsShown && intro >= 1) { labelsShown = true; hero.setAttribute("data-lines", "on"); }
    }
    function loop(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      draw(now);
      if (!reduced()) raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop); }
    window.addEventListener("resize", function () { resize(); kick(); });
    window.addEventListener("pointermove", function (e) {
      ptrT.x = (e.clientX / window.innerWidth - .5) * 2;
      ptrT.y = (e.clientY / window.innerHeight - .5) * 2;
    }, { passive: true });
    document.addEventListener("visibilitychange", kick);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (ents) { visible = ents[0].isIntersecting; kick(); }).observe(hero);
    }
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); hero.setAttribute("data-gl", "off"); });
    resize(); kick();
    if (reduceQuery.addEventListener) reduceQuery.addEventListener("change", function () { resize(); kick(); });
  }

  /* ------------------------------------------------------------ 4 dispersion (figure stays, readings scroll) */
  var disp = document.querySelector("[data-disp]");
  var dispWide = window.matchMedia("(min-width: 961px) and (min-height: 600px)");
  var bands = disp ? disp.querySelectorAll(".band") : [];
  var labels = disp ? disp.querySelectorAll(".band-labels li") : [];
  var readings = disp ? disp.querySelectorAll(".reading") : [];
  function dispMode() {
    if (!disp) return;
    disp.setAttribute("data-mode", dispWide.matches ? "scrolly" : "static");
    updateDisp();
  }
  function mark(list, idx) {
    Array.prototype.forEach.call(list, function (el, i) {
      if (i === idx) el.setAttribute("data-active", ""); else el.removeAttribute("data-active");
      if (i < idx) el.setAttribute("data-lit", ""); else el.removeAttribute("data-lit");
    });
  }
  function updateDisp() {
    if (!disp) return;
    if (disp.getAttribute("data-mode") !== "scrolly") { mark(bands, -1); mark(labels, -1); mark(readings, -1); return; }
    var line = window.innerHeight * .58, idx = 0;
    Array.prototype.forEach.call(readings, function (el, i) { if (el.getBoundingClientRect().top < line) idx = i; });
    mark(bands, idx); mark(labels, idx); mark(readings, idx);
  }

  /* ------------------------------------------------------------ 5 specimen shelf */
  var SUBJ = {
    mathematics: ["Mathematics", "数学"], programming: ["Programming", "编程"], science: ["Science", "科学"],
    history_or_social_studies: ["History & social studies", "历史与社会"], language: ["Language", "语言"]
  };
  var LEVEL = {
    beginner: ["Beginner", "入门"], elementary: ["Elementary", "小学低年级"], "upper-elementary": ["Upper elementary", "小学高年级"],
    "middle-school": ["Middle school", "初中"], secondary: ["Secondary", "高中"]
  };
  var STATE = {
    conceptual_misconception: ["Conceptual misconception", "概念误解"], procedural_error: ["Procedural error", "步骤错误"],
    overconfident_incorrect: ["Overconfident, incorrect", "自信但有错"], partial_understanding: ["Partial understanding", "部分理解"],
    novice: ["Novice", "初学"], stuck_without_attempt: ["Stuck, no attempt yet", "卡住，尚未尝试"],
    uncertain_but_correct: ["Correct but unsure", "做对了但不确定"], correct_answer_wrong_reasoning: ["Right answer, wrong reasoning", "答案对，推理错"]
  };
  var T = {
    all: ["All", "全部"], state: ["Learner state", "学生状态"], no: ["Plate", "图版"],
    count: function (n, total) { return lang() === "zh" ? ("显示 " + n + " / " + total + " 个情境 · 每个都有中英两版，共 48 个案例") : ("Showing " + n + " of " + total + " situations · each in English and 简体中文, 48 cases"); }
  };
  function L(pair) { return pair ? pair[lang() === "zh" ? 1 : 0] : ""; }
  var shelf = document.querySelector("[data-shelf]");
  var filters = document.querySelector("[data-filters]");
  var countEl = document.querySelector("[data-shelf-count]");
  var current = "all";
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  function renderShelf() {
    if (!shelf || !window.SPECIMENS) return;
    var all = window.SPECIMENS;
    var counts = {}; all.forEach(function (s) { counts[s.subject] = (counts[s.subject] || 0) + 1; });
    var keys = Object.keys(SUBJ).filter(function (k) { return counts[k]; });
    filters.setAttribute("aria-label", lang() === "zh" ? "按学科筛选" : "Filter by subject");
    filters.innerHTML = ["all"].concat(keys).map(function (k) {
      var label = k === "all" ? L(T.all) : L(SUBJ[k]);
      var n = k === "all" ? all.length : counts[k];
      return '<button type="button" class="chip" data-subj="' + k + '" aria-pressed="' + (k === current) + '">' + esc(label) + "<b>" + n + "</b></button>";
    }).join("");
    var list = all.filter(function (s) { return current === "all" || s.subject === current; });
    var lk = lang() === "zh" ? "zh" : "en";
    var colors = ["var(--c0)", "var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)"];
    shelf.setAttribute("aria-label", lang() === "zh" ? "公开案例" : "Public cases");
    shelf.innerHTML = list.map(function (s) {
      var v = s[lk] || s.en;
      var idx = all.indexOf(s) + 1;
      return '<li class="spec">' +
        '<p class="spec-meta"><span class="no">' + L(T.no) + " " + String(idx).padStart(2, "0") + "</span><span>" + esc(L(SUBJ[s.subject])) + " · " + esc(L(LEVEL[s.level]) || s.level) + "</span></p>" +
        "<h3>" + esc(v.topic) + "</h3>" +
        '<blockquote lang="' + (lk === "zh" ? "zh-CN" : "en") + '">' + esc(v.msg) + "</blockquote>" +
        '<p class="spec-state">' + esc(L(T.state)) + " · <b>" + esc(L(STATE[s.state]) || s.state) + "</b></p>" +
        '<span class="slots5" role="img" aria-label="' + (lang() === "zh" ? "五个维度均未评分" : "Five dimensions, not scored") + '">' + colors.map(function (c) { return '<i style="--c:' + c + '"></i>'; }).join("") + '<em aria-hidden="true">' + (lang() === "zh" ? "未评分" : "not scored") + "</em></span>" +
        "</li>";
    }).join("");
    if (countEl) countEl.textContent = T.count(list.length, all.length);
  }
  if (filters) filters.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-subj]"); if (!b) return;
    current = b.getAttribute("data-subj"); renderShelf(); shelf.scrollTo({ left: 0, behavior: reduced() ? "auto" : "smooth" });
  });
  function shelfStep(dir) {
    if (!shelf) return;
    var card = shelf.querySelector(".spec"); var w = card ? card.getBoundingClientRect().width + 22 : 400;
    shelf.scrollBy({ left: dir * w * (window.innerWidth > 900 ? 2 : 1), behavior: reduced() ? "auto" : "smooth" });
  }
  var prev = document.querySelector("[data-shelf-prev]"), next = document.querySelector("[data-shelf-next]");
  if (prev) prev.addEventListener("click", function () { shelfStep(-1); });
  if (next) next.addEventListener("click", function () { shelfStep(1); });
  function navLabels() {
    if (prev) prev.setAttribute("aria-label", lang() === "zh" ? "上一组" : "Previous");
    if (next) next.setAttribute("aria-label", lang() === "zh" ? "下一组" : "Next");
  }

  /* ------------------------------------------------------------ 6 reveal + copy */
  var reveals = document.querySelectorAll("[data-reveal], .rail");
  if ("IntersectionObserver" in window && !reduced()) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { en.target.setAttribute("data-in", ""); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -12% 0px" });
    Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });
  } else {
    Array.prototype.forEach.call(reveals, function (el) { el.setAttribute("data-in", ""); });
  }
  var copyBtn = document.querySelector("[data-copy]");
  if (copyBtn) copyBtn.addEventListener("click", function () {
    var code = document.querySelector("[data-term] code");
    var text = code ? code.textContent.split("\n").filter(function (l) { return l.trim().indexOf("#") !== 0; }).join("\n") : "";
    var done = function () {
      var en = copyBtn.querySelector(".en"), zh = copyBtn.querySelector(".zh");
      if (en) en.textContent = "Copied"; if (zh) zh.textContent = "已复制";
      setTimeout(function () { if (en) en.textContent = "Copy"; if (zh) zh.textContent = "复制"; }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done); else done();
  });

  /* ------------------------------------------------------------ wiring */
  langListeners.push(renderShelf, navLabels);
  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { ticking = false; updateBar(); updateDisp(); });
  }, { passive: true });
  window.addEventListener("resize", function () { dispMode(); updateBar(); });
  if (dispWide.addEventListener) dispWide.addEventListener("change", dispMode);
  if (reduceQuery.addEventListener) reduceQuery.addEventListener("change", dispMode);

  renderShelf(); navLabels(); dispMode(); updateBar(); startHero();
})();
