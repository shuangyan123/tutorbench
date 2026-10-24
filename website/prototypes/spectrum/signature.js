/* Teachometry · spectral signature.
   One visual rule for the whole brand: every case is drawn as a line spectrum.
   The axis is fixed: the 27 capability tags of TutorBench, grouped into the five dimensions
   (λ1 Correctness … λ5 Actionability) in the order of the official taxonomy
   (src/contracts/tutor-eval-taxonomy.ts, mapping from src/audits/rubric-authoring-qa.ts).
   A case lights the lines for the capabilities it is built to measure. It shows what a case
   asks of a tutor. It is never a score. */
/* global window, document */
(function () {
  "use strict";

  var BANDS = [
    { k: "correctness", en: "Correctness", zh: "正确性", caps: ["factual_correctness", "conceptual_correctness", "procedural_correctness", "reasoning_consistency", "misleading_simplification"] },
    { k: "diagnosis", en: "Diagnosis", zh: "诊断能力", caps: ["error_detection", "error_localization", "misconception_identification", "knowledge_gap_identification", "correct_answer_wrong_reasoning", "uncertainty_detection"] },
    { k: "guidance", en: "Guidance", zh: "引导能力", caps: ["hint_calibration", "scaffolding", "student_agency", "answer_non_disclosure", "overhelping_avoidance", "conceptual_prompting", "procedural_prompting"] },
    { k: "adaptation", en: "Adaptation", zh: "适应能力", caps: ["prior_knowledge_adaptation", "difficulty_adaptation", "misconception_specific_adaptation", "explanation_depth_adaptation", "counterfactual_adaptation"] },
    { k: "actionability", en: "Actionability", zh: "可执行性", caps: ["clear_next_step", "student_executable_action", "check_for_understanding", "productive_question"] }
  ];
  var ZH = {
    factual_correctness: "事实正确性", conceptual_correctness: "概念正确性", procedural_correctness: "步骤正确性",
    reasoning_consistency: "推理一致性", misleading_simplification: "误导性简化", error_detection: "错误检测",
    error_localization: "错误定位", misconception_identification: "识别概念误解", knowledge_gap_identification: "识别知识缺口",
    correct_answer_wrong_reasoning: "答案正确但推理错误", uncertainty_detection: "不确定性检测", hint_calibration: "提示校准",
    scaffolding: "学习支架", student_agency: "学生自主性", answer_non_disclosure: "不泄露答案",
    overhelping_avoidance: "避免过度帮助", conceptual_prompting: "概念提示", procedural_prompting: "步骤提示",
    prior_knowledge_adaptation: "依据已有知识调整", difficulty_adaptation: "难度适应",
    misconception_specific_adaptation: "针对概念误解的适应", explanation_depth_adaptation: "解释深度适应",
    counterfactual_adaptation: "反事实适应", clear_next_step: "明确下一步", student_executable_action: "学生可执行的行动",
    check_for_understanding: "检查理解", productive_question: "有效提问"
  };

  // flat axis: slot index → { cap, band }
  var AXIS = [], SLOT = {};
  BANDS.forEach(function (b, bi) {
    b.start = AXIS.length;
    b.caps.forEach(function (c) { SLOT[c] = AXIS.length; AXIS.push({ cap: c, band: bi }); });
  });
  var U = 10, W = AXIS.length * U; // one slot = 10 user units

  function name(cap, lang) {
    return lang === "zh" ? (ZH[cap] || cap) : cap.replace(/_/g, " ");
  }

  /* Shared gradients, defined once per page (a gradient inside a hidden svg would not paint).
     Lines are drawn the way a spectrograph records them: a bright core that falls off to the
     sides and feathers out at both ends, over a soft continuous spectrum. */
  function defs() {
    if (typeof document === "undefined" || document.getElementById("sig-defs")) return;
    var d = ['<svg id="sig-defs" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>'];
    // continuum across the whole axis, hue stops at each band's centre
    d.push('<linearGradient id="sig-cont" x1="0" x2="1" y1="0" y2="0">');
    BANDS.forEach(function (b, bi) {
      d.push('<stop offset="' + ((b.start + b.caps.length / 2) / AXIS.length).toFixed(3) + '" style="stop-color:var(--s' + bi + ')"/>');
    });
    d.push("</linearGradient>");
    // vertical feather, used as a mask for continuum and lines
    d.push('<linearGradient id="sig-v" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".22" stop-color="#fff" stop-opacity="1"/><stop offset=".78" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>');
    d.push('<mask id="sig-m" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#sig-v)"/></mask>');
    // one emission profile per band: transparent → colour → near-white core → colour → transparent
    BANDS.forEach(function (b, bi) {
      d.push('<linearGradient id="sig-l' + bi + '" x1="0" x2="1" y1="0" y2="0">' +
        '<stop offset="0" style="stop-color:var(--s' + bi + ')" stop-opacity="0"/>' +
        '<stop offset=".3" style="stop-color:var(--s' + bi + ')" stop-opacity=".55"/>' +
        '<stop offset=".5" stop-color="#fff9f2" stop-opacity="1"/>' +
        '<stop offset=".7" style="stop-color:var(--s' + bi + ')" stop-opacity=".55"/>' +
        '<stop offset="1" style="stop-color:var(--s' + bi + ')" stop-opacity="0"/></linearGradient>');
      d.push('<linearGradient id="sig-c' + bi + '" x1="0" x2="1" y1="0" y2="0">' +
        '<stop offset="0" style="stop-color:var(--s' + bi + ')" stop-opacity="0"/>' +
        '<stop offset=".5" style="stop-color:var(--s' + bi + ')" stop-opacity="1"/>' +
        '<stop offset="1" style="stop-color:var(--s' + bi + ')" stop-opacity="0"/></linearGradient>');
    });
    d.push("</defs></svg>");
    document.body.insertAdjacentHTML("afterbegin", d.join(""));
  }

  /* svg(caps, { h, weights, ticks, cls })
     caps     the case's capability tags (lit lines)
     weights  optional { cap: 0..1 } → line width, used for the summed spectrum
     h        height in user units */
  function svg(caps, o) {
    defs();
    o = o || {};
    var h = o.h || 30, lit = {}, out = [];
    (caps || []).forEach(function (c) { if (c in SLOT) lit[c] = true; });
    out.push('<svg class="sig ' + (o.cls || "") + '" viewBox="0 0 ' + W + " " + h + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">');
    out.push('<rect class="sig-cont" x="0" y="0" width="' + W + '" height="' + h + '" fill="url(#sig-cont)" mask="url(#sig-m)"/>');
    out.push('<g mask="url(#sig-m)">');
    AXIS.forEach(function (a, i) {
      var x = i * U + U / 2;
      var wgt = o.weights ? (o.weights[a.cap] || 0) : (lit[a.cap] ? 1 : 0);
      if (wgt > 0) {
        var lw = o.weights ? 2.4 + wgt * 6.6 : 7;
        // wide coloured halo, then the hot core
        out.push('<rect class="sig-halo" x="' + (x - lw * 1.4) + '" y="0" width="' + (lw * 2.8) + '" height="' + h + '" fill="url(#sig-c' + a.band + ')"/>');
        out.push('<rect class="sig-line" data-slot="' + i + '" x="' + (x - lw / 2) + '" y="0" width="' + lw + '" height="' + h + '" fill="url(#sig-l' + a.band + ')"/>');
      }
    });
    out.push("</g>");
    if (o.ticks !== false) {
      AXIS.forEach(function (a, i) {
        if (o.weights || lit[a.cap]) return;
        var x = i * U + U / 2, th = Math.min(3.5, h * 0.2);
        out.push('<rect class="sig-tick" x="' + (x - 0.35) + '" y="' + (h - th) + '" width="0.7" height="' + th + '"/>');
      });
    }
    out.push("</svg>");
    return out.join("");
  }

  // which bands a case touches, e.g. [1, 2, 4]
  function bands(caps) {
    var seen = {};
    (caps || []).forEach(function (c) { if (c in SLOT) seen[AXIS[SLOT[c]].band] = true; });
    return Object.keys(seen).map(Number).sort();
  }

  window.Signature = { BANDS: BANDS, AXIS: AXIS, SLOT: SLOT, svg: svg, bands: bands, name: name };
})();
