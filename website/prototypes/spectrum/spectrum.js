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
  var papers = Array.prototype.slice.call(document.querySelectorAll(".paper"));
  function updateBar() {
    if (!bar) return;
    if (window.scrollY > 40) bar.setAttribute("data-scrolled", ""); else bar.removeAttribute("data-scrolled");
    var probe = bar.offsetHeight - 2;
    var onPaper = papers.some(function (el) { var r = el.getBoundingClientRect(); return r.top <= probe && r.bottom >= probe; });
    if (onPaper) bar.setAttribute("data-on-paper", ""); else bar.removeAttribute("data-on-paper");
  }

  /* ------------------------------------------------------------ 3 hero prism */
  var hero = document.querySelector(".hero");
  var canvas = document.querySelector("[data-hero-canvas]");
  var VERT = "#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  var FRAG = [
    "#version 300 es",
    "precision highp float;",
    "uniform vec2 uRes; uniform float uTime; uniform vec2 uPtr; uniform float uIntro; uniform float uScroll;",
    "uniform vec2 uC; uniform float uS; uniform float uPlate; uniform float uBase; uniform float uSpread; uniform float uAng;",
    "out vec4 o;",
    "const vec3 C0=vec3(1.0,.50,.30), C1=vec3(.98,.80,.36), C2=vec3(.45,.90,.68), C3=vec3(.26,.52,1.0), C4=vec3(.62,.40,1.0);",
    "vec3 band(int i){ return i==0?C0:i==1?C1:i==2?C2:i==3?C3:C4; }",
    "float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }",
    "float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);",
    "  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }",
    "float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }",
    "mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }",
    "float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2){",
    "  vec2 e0=p1-p0, e1=p2-p1, e2=p0-p2; vec2 v0=p-p0, v1=p-p1, v2=p-p2;",
    "  vec2 pq0=v0-e0*clamp(dot(v0,e0)/dot(e0,e0),0.,1.);",
    "  vec2 pq1=v1-e1*clamp(dot(v1,e1)/dot(e1,e1),0.,1.);",
    "  vec2 pq2=v2-e2*clamp(dot(v2,e2)/dot(e2,e2),0.,1.);",
    "  float s=sign(e0.x*e2.y-e0.y*e2.x);",
    "  vec2 d=min(min(vec2(dot(pq0,pq0),s*(v0.x*e0.y-v0.y*e0.x)), vec2(dot(pq1,pq1),s*(v1.x*e1.y-v1.y*e1.x))), vec2(dot(pq2,pq2),s*(v2.x*e2.y-v2.y*e2.x)));",
    "  return -sqrt(d.x)*sign(d.y); }",
    "float beam(vec2 p, vec2 org, vec2 dir, float w0, float grow, float reach, out float along){",
    "  vec2 q=p-org; along=dot(q,dir); float perp=dot(q,vec2(-dir.y,dir.x));",
    "  if(along<0.) return 0.;",
    "  float w=w0+grow*along;",
    "  float core=exp(-perp*perp/(w*w));",
    "  float glow=exp(-abs(perp)/(w*5.))*.16;",
    "  float energy=pow(w0/w,.5);",
    "  float rev=smoothstep(reach,reach-.006,along);",
    "  return (core+glow)*energy*rev*smoothstep(0.,.02,along); }",
    // round dust motes drifting through the air
    "float motes(vec2 p, float t){",
    "  vec2 g=p*70.+vec2(t*.35,t*.08); vec2 id=floor(g); vec2 f=fract(g)-.5;",
    "  vec2 off=(vec2(hash(id),hash(id+7.31))-.5)*.7;",
    "  float on=step(.86,hash(id+3.7));",
    "  float tw=.5+.5*sin(t*1.3+hash(id+1.9)*6.28);",
    "  return smoothstep(.07,.0,length(f-off))*on*tw; }",
    "void main(){",
    "  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;",
    "  float t=uTime;",
    "  mat2 R=rot(uAng);",
    "  vec2 v0=uC+R*vec2(0.,uS), v1=uC+R*vec2(-.866*uS,-.5*uS), v2=uC+R*vec2(.866*uS,-.5*uS);",
    "  vec2 E=mix(v0,v1,.56), X=mix(v0,v2,.56);",
    "  vec2 din=normalize(vec2(1.,-.11));",
    "  vec2 S=E-din*3.;",
    "  float lenIn=length(E-S);",
    "  vec3 col=vec3(.026,.03,.041);",
    "  col+=vec3(.045,.05,.07)*exp(-length((p-uC)*vec2(.6,1.))*2.2);",
    "  float haze=.75+.5*fbm(p*vec2(5.,7.)+vec2(-t*.035,t*.012));",
    "  float dust=motes(p,t)*1.8;",
    // incident white beam
    "  float alongIn; float reachIn=uIntro*1.6*lenIn;",
    "  float bi=beam(p,S,din,.0024,.0006,reachIn,alongIn); bi*=step(alongIn,lenIn+.002);",
    "  col+=vec3(1.,.98,.95)*bi*(haze+dust)*1.1;",
    // inside the glass
    "  float dTri=sdTri(p,v0,v1,v2);",
    "  float lit=smoothstep(.6,.72,uIntro);",
    "  float ain; vec2 dg=normalize(X-E);",
    "  float bg=beam(p,E,dg,.004,.02,length(X-E)*lit+.0001,ain);",
    "  col+=vec3(.95,.93,1.)*bg*.5*step(dTri,0.)*lit;",
    // five spectral lines ending on a measuring plate
    "  float reachT=max(0.,(uIntro-.7))*5.;",
    "  vec2 face=normalize(v2-v0);",
    "  float plateTop=1e3, plateBot=-1e3;",
    "  vec3 plateLight=vec3(0.);",
    "  for(int i=0;i<5;i++){",
    "    vec3 c=band(i);",
    "    float th=uBase-uSpread*(float(i)/4.);",
    "    vec2 d=vec2(cos(th),sin(th));",
    "    vec2 org=X+face*(float(i)-2.)*.003;",
    "    float toPlate=(uPlate-org.x)/d.x;",
    "    float reach=min(reachT,toPlate);",
    "    float acc=0.;",
    "    for(int k=0;k<2;k++){",
    "      float sub=(float(k)-.5)*.006;",
    "      vec2 dd=vec2(cos(th+sub),sin(th+sub));",
    "      float al; acc+=beam(p,org,dd,.0022,.0045,reach,al);",
    "    }",
    "    float flick=.92+.08*sin(t*.7+float(i)*1.7);",
    "    col+=c*acc*(haze+dust*.7)*.62*flick*step(0.,dTri);",
    "    vec2 hit=org+d*toPlate;",
    "    float arrived=smoothstep(toPlate-.02,toPlate+.02,reachT);",
    "    plateTop=min(plateTop,hit.y); plateBot=max(plateBot,hit.y);",
    "    plateLight+=c*arrived*(exp(-length((p-hit)*vec2(1.,.6))/.006)*1.2 + exp(-abs(p.y-hit.y)/.004)*.35*step(uPlate,p.x)*step(p.x,uPlate+.006));",
    "    col+=c*arrived*exp(-length(p-hit)/.045)*.07;",
    "  }",
    // plate body + ticks
    "  float pTop=max(plateTop,plateBot)+.07, pBot=min(plateTop,plateBot)-.07;",
    "  float inPlate=step(uPlate,p.x)*step(p.x,uPlate+.006)*step(pBot,p.y)*step(p.y,pTop);",
    "  float plateEdge=exp(-abs(p.x-uPlate)/.0007)*step(pBot,p.y)*step(p.y,pTop);",
    "  col+=vec3(.93,.9,.84)*(inPlate*.05+plateEdge*.10)*smoothstep(.55,.8,uIntro);",
    "  float tk=step(fract((p.y-pBot)/.02),.08)*step(uPlate-.007,p.x)*step(p.x,uPlate)*step(pBot,p.y)*step(p.y,pTop);",
    "  col+=vec3(.7)*tk*.14*smoothstep(.55,.8,uIntro);",
    "  col+=plateLight;",
    // prism edges
    "  float edge=exp(-abs(dTri)/.0011);",
    "  float edgeHi=.32+.68*smoothstep(.0,.6,1.-length(p-mix(E,X,.5))/uS);",
    "  col+=vec3(.85,.88,1.)*edge*.38*edgeHi*smoothstep(.0,.5,uIntro);",
    "  if(dTri<0.){",
    "    col+=vec3(.06,.065,.08)*(.6+.4*smoothstep(-uS*.5,0.,dTri));",
    "    col+=vec3(.9,.92,1.)*exp(-abs(dTri+.006)/.0008)*.07;",
    "    col+=mix(C3,C4,.5)*exp(-length(p-X)/(uS*.35))*.09*lit;",
    "  }",
    "  col+=vec3(1.)*exp(-length(p-E)/.011)*.5*smoothstep(.55,.68,uIntro);",
    "  col+=vec3(1.,.95,.9)*exp(-length(p-X)/.014)*.38*lit;",
    // short mount under the prism
    "  float baseY=uC.y-uS*.5;",
    "  float post=step(abs(p.x-uC.x),uS*.035)*step(baseY-uS*.55,p.y)*step(p.y,baseY-.004);",
    "  float foot=step(abs(p.x-uC.x),uS*.32)*step(baseY-uS*.6,p.y)*step(p.y,baseY-uS*.55);",
    "  col+=vec3(.55,.57,.65)*(post*.06+foot*.09);",
    "  col*=1.-.42*length(p*vec2(.55,.95));",
    "  col=1.-exp(-col*1.35);",
    "  col+=(hash(gl_FragCoord.xy+fract(t*.37)*91.)-.5)*.022;",
    "  o=vec4(col,1.);",
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
    ["uRes", "uTime", "uPtr", "uIntro", "uScroll", "uC", "uS", "uPlate", "uBase", "uSpread", "uAng"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    hero.setAttribute("data-gl", "on");

    var lineLabels = Array.prototype.slice.call(hero.querySelectorAll("[data-line]"));
    var ptr = { x: 0, y: 0 }, ptrT = { x: 0, y: 0 };
    var start = performance.now();
    var visible = true, raf = 0, labelsShown = false;
    var L = { cx: 0, cy: .24, s: .13, plate: .5, base: -.04, spread: .45 };

    function resize() {
      var w = hero.clientWidth, h = hero.clientHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5) * (w < 700 ? .8 : .9);
      canvas.width = Math.max(2, Math.round(w * dpr)); canvas.height = Math.max(2, Math.round(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      var a = w / h;
      // 棱镜放在标题上方，量板在右侧，留出标签的位置
      if (a > 1.15) L = { cx: a * .015, cy: .25, s: Math.min(.14, .08 + a * .035), plate: a / 2 - Math.max(.2, 210 / h), base: -.03, spread: .46 };
      else if (a > .8) L = { cx: -a * .1, cy: .27, s: .11, plate: a / 2 - .2, base: -.05, spread: .5 };
      else L = { cx: -a * .2, cy: .31, s: .075, plate: a / 2 - .05, base: -.1, spread: .55 };
      if (a <= .8) hero.setAttribute("data-narrow", ""); else hero.removeAttribute("data-narrow");
      if (reduced()) draw(performance.now());
    }
    function geometry(ang, base, spread, w, h) {
      // 与着色器同一套几何：算出五条谱线落在量板上的位置（CSS 像素）
      var c = Math.cos(ang), s = Math.sin(ang);
      function R(x, y) { return [c * x + s * y, -s * x + c * y]; }
      var r0 = R(0, L.s), r2 = R(.866 * L.s, -.5 * L.s);
      var v0 = [L.cx + r0[0], L.cy + r0[1]], v2 = [L.cx + r2[0], L.cy + r2[1]];
      var X = [v0[0] + (v2[0] - v0[0]) * .56, v0[1] + (v2[1] - v0[1]) * .56];
      var fl = Math.hypot(v2[0] - v0[0], v2[1] - v0[1]), face = [(v2[0] - v0[0]) / fl, (v2[1] - v0[1]) / fl];
      var out = [];
      for (var i = 0; i < 5; i++) {
        var th = base - spread * (i / 4);
        var org = [X[0] + face[0] * (i - 2) * .003, X[1] + face[1] * (i - 2) * .003];
        var tp = (L.plate - org[0]) / Math.cos(th);
        var hy = org[1] + Math.sin(th) * tp;
        out.push([L.plate * h + w / 2, h / 2 - hy * h]);
      }
      return out;
    }
    function draw(now) {
      var t = (now - start) / 1000;
      var rm = reduced();
      var intro = rm ? 1 : Math.min(1, t / 2.8);
      ptr.x += (ptrT.x - ptr.x) * .05; ptr.y += (ptrT.y - ptr.y) * .05;
      var r = hero.getBoundingClientRect();
      var sc = rm ? 0 : Math.max(0, Math.min(1, -r.top / Math.max(1, r.height)));
      var px = rm ? 0 : ptr.x, py = rm ? 0 : ptr.y;
      var ang = -.1 + px * .06 + sc * .16;
      var base = L.base - px * .03;
      var spread = L.spread + py * .05;
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, rm ? 4 : t);
      gl.uniform2f(U.uPtr, px, py);
      gl.uniform1f(U.uIntro, intro);
      gl.uniform1f(U.uScroll, sc);
      gl.uniform2f(U.uC, L.cx, L.cy);
      gl.uniform1f(U.uS, L.s);
      gl.uniform1f(U.uPlate, L.plate);
      gl.uniform1f(U.uBase, base);
      gl.uniform1f(U.uSpread, spread);
      gl.uniform1f(U.uAng, ang);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      var pts = geometry(ang, base, spread, r.width, r.height);
      lineLabels.forEach(function (el, i) { el.style.transform = "translate(" + (pts[i][0] + 16).toFixed(1) + "px," + pts[i][1].toFixed(1) + "px)"; });
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

  /* ------------------------------------------------------------ 4 dispersion */
  var disp = document.querySelector("[data-disp]");
  var dispWide = window.matchMedia("(min-width: 900px) and (min-height: 600px)");
  var bands = disp ? disp.querySelectorAll(".band") : [];
  var labels = disp ? disp.querySelectorAll(".band-labels li") : [];
  var readings = disp ? disp.querySelectorAll(".reading") : [];
  var dots = disp ? disp.querySelectorAll(".disp-progress i") : [];
  function dispMode() {
    if (!disp) return;
    var sticky = dispWide.matches && !reduced();
    disp.setAttribute("data-mode", sticky ? "sticky" : "static");
    updateDisp();
  }
  function mark(list, idx) {
    Array.prototype.forEach.call(list, function (el, i) {
      if (i === idx) el.setAttribute("data-active", ""); else el.removeAttribute("data-active");
      if (i < idx) el.setAttribute("data-lit", ""); else el.removeAttribute("data-lit");
    });
  }
  function updateDisp() {
    if (!disp || disp.getAttribute("data-mode") !== "sticky") {
      if (disp) { disp.removeAttribute("data-phase"); mark(bands, -1); mark(labels, -1); mark(readings, -1); }
      return;
    }
    var r = disp.getBoundingClientRect();
    var span = Math.max(1, r.height - window.innerHeight);
    var p = Math.max(0, Math.min(1, -r.top / span));
    if (p < .06) { disp.setAttribute("data-phase", "pre"); mark(bands, -1); mark(labels, -1); mark(readings, -1); }
    else {
      disp.setAttribute("data-phase", "split");
      var idx = Math.min(4, Math.floor((p - .06) / .88 * 5));
      mark(bands, idx); mark(labels, idx); mark(readings, idx);
      Array.prototype.forEach.call(dots, function (d, i) { if (i <= idx) d.setAttribute("data-on", ""); else d.removeAttribute("data-on"); });
    }
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
    all: ["All", "全部"], state: ["Learner state", "学生状态"], no: ["No.", "No."],
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
    var colors = ["#ff8a5b", "#f2cf6a", "#7edfb4", "#4c8dff", "#9a6bff"];
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
