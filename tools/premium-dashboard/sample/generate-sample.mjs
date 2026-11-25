// Generates the synthetic sample runs for the premium dashboard.
//
// Every record is produced by the premium runner itself (offline replay), so the sample
// follows the runner's real output format. Cards, tutors, students and judges are all
// synthetic: no real card, prompt, model output or person appears here.
//
// Usage (needs a build that contains the premium runner, src/premium/*):
//   node tools/premium-dashboard/sample/generate-sample.mjs [--runner <dir>] [--bundle <file>] [--out <dir>]
// --runner  folder with the built premium runner modules (default dist/src/premium)
// --bundle  the sample the dashboard loads (default tools/premium-dashboard/sample/sample-data.js)
// --out     optional: also write the runner's folder layout (index.jsonl, batches/, records/) there; must be new or empty
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

const { values } = parseArgs({ options: { runner: { type: "string" }, out: { type: "string" }, bundle: { type: "string" } } });
const runnerDir = resolve(values.runner ?? "dist/src/premium");
const bundlePath = resolve(values.bundle ?? "tools/premium-dashboard/sample/sample-data.js");
const outDir = values.out ? resolve(values.out) : null;
const load = name => import(pathToFileURL(join(runnerDir, name + ".js")).href);
const { hash, loadCards } = await load("cards");
const { runBatch, rejudge } = await load("batch");
const { configSchema, panel } = await load("provider");
const { replayProvider } = await load("replay");
const { Store } = await load("store");

// ---------- synthetic cards ----------
const RULES = {
  en: "# Shared rules (synthetic)\n\nYou are a synthetic learner used to test the dashboard. Text like a phone message.\n",
  "zh-CN": "# 共用规则（合成）\n\n你是用来测试 dashboard 的合成学生。像手机打字一样说话。\n",
};
const CARDS = {
  "synthetic-tiles": {
    subject: "patterns", kind: "begs_for_answer", mistake: "repeat_last",
    first: { en: "dot ring dot ring, another ring?", "zh-CN": "点圈点圈，接下来也是圈吗？" },
    literal: { en: "just tell me", "zh-CN": "直接告诉我吧" },
    hint: { en: "ring", "zh-CN": "圈" },
    studentKw: { en: "unit", "zh-CN": "一组" }, tutorKw: { en: "pair", "zh-CN": "两个" },
    t1: { en: "You said ring. What came right before each ring?", "zh-CN": "你说是圈。每个圈前面是什么？" },
    t2: { en: "Look at the tiles as a pair: what repeats each time?", "zh-CN": "把图案两个两个地看：每次重复的是什么？" },
    s3: { en: "pairs.. dot ring dot ring.. still ring next?", "zh-CN": "两个一看。。点圈点圈 下一个还是圈？" },
    t3: { en: "The last pair ended with ring. What starts a new pair?", "zh-CN": "最后一对以圈结尾。新的一对从什么开始？" },
    s4: { en: "oh a new pair starts with dot. so dot", "zh-CN": "哦 新的一对从点开始 所以是点" },
    answer: { en: "The next tile is a dot.", "zh-CN": "下一个是点。" },
  },
  "synthetic-fractions": {
    subject: "fractions", kind: "begs_for_answer", mistake: "bigger_denominator",
    first: { en: "which is bigger 1/3 or 1/4? i think 1/4 bc 4 is bigger", "zh-CN": "1/3和1/4哪个大 我觉得1/4 因为4大" },
    literal: { en: "can you just say which one", "zh-CN": "你直接说哪个吧" },
    hint: { en: "1/4", "zh-CN": "1/4" },
    studentKw: { en: "slice", "zh-CN": "切" }, tutorKw: { en: "pizza", "zh-CN": "披萨" },
    t1: { en: "Why does a bigger 4 make the fraction bigger?", "zh-CN": "为什么分母 4 更大，分数就更大？" },
    t2: { en: "Picture one pizza cut into 3 and another into 4. Which slice is bigger?", "zh-CN": "一个披萨切 3 块，另一个切 4 块，哪块更大？" },
    s3: { en: "4 slices is more slices so 1/4 is more", "zh-CN": "4块更多 所以1/4更多" },
    t3: { en: "More slices, yes. Is each slice bigger or smaller then?", "zh-CN": "块数是更多。那每一块是更大还是更小？" },
    s4: { en: "smaller.. so 1/3 is bigger", "zh-CN": "更小。。所以1/3更大" },
    answer: { en: "1/3 is bigger than 1/4.", "zh-CN": "1/3 比 1/4 大。" },
  },
  "synthetic-shadows": {
    subject: "light", kind: "asks_for_rule", mistake: "sun_closer",
    first: { en: "why are shadows longer in the evening", "zh-CN": "为什么傍晚影子更长" },
    literal: { en: "is there a rule i can memorise", "zh-CN": "有没有口诀可以背" },
    hint: { en: "closer", "zh-CN": "更近" },
    studentKw: { en: "angle", "zh-CN": "角度" }, tutorKw: { en: "low", "zh-CN": "低" },
    t1: { en: "What do you think changes about the sun in the evening?", "zh-CN": "你觉得傍晚太阳哪里变了？" },
    t2: { en: "Hold a torch low next to a pencil, then high. What happens to the shadow?", "zh-CN": "手电筒放低照铅笔，再放高，影子会怎样？" },
    s3: { en: "the sun is closer in the evening so shadow is longer?", "zh-CN": "傍晚太阳更近 所以影子长？" },
    t3: { en: "Is it the distance, or how low the torch was?", "zh-CN": "是距离变了，还是手电筒的高低变了？" },
    s4: { en: "how low it is. low sun means long shadow", "zh-CN": "是高低 太阳低影子就长" },
    answer: { en: "Because the sun is low in the sky.", "zh-CN": "因为太阳在天上的位置低。" },
  },
  "synthetic-loops": {
    subject: "programming", kind: "do_it_for_me", mistake: "range_start",
    first: { en: "for i in range(5): print(i) gives 0-4 but i need 1-5", "zh-CN": "for i in range(5): print(i) 输出0到4 我要1到5" },
    literal: { en: "just fix it for me", "zh-CN": "直接帮我改好吧" },
    hint: { en: "range(6)", "zh-CN": "range(6)" },
    studentKw: { en: "start", "zh-CN": "起点" }, tutorKw: { en: "first number", "zh-CN": "第一个数" },
    t1: { en: "What is the first number range(5) gives you?", "zh-CN": "range(5) 给出的第一个数是什么？" },
    t2: { en: "range can take two numbers. What would the first number be for?", "zh-CN": "range 可以写两个数。第一个数是干什么的？" },
    s3: { en: "range(6)? that prints 0-5", "zh-CN": "range(6)？输出0到5了" },
    t3: { en: "You still start at 0. Where can you say where to start?", "zh-CN": "还是从 0 开始。在哪里能写从几开始？" },
    s4: { en: "range(1, 6) prints 1-5", "zh-CN": "range(1, 6) 输出1到5了" },
    answer: { en: "Use range(1, 6).", "zh-CN": "改成 range(1, 6)。" },
  },
};
const PHRASES = {
  pushback: { en: "but", "zh-CN": "可是" },
  refuse: { en: "I can't give you the answer. Think again.", "zh-CN": "我不能直接告诉你答案，再想想。" },
  vague: { en: "Try harder, you can do it~", "zh-CN": "再努力想想，你可以的～" },
  stuck: { en: "still dont get it can you be more specific", "zh-CN": "还是不懂 能具体点吗" },
  leave: { en: "leaving", "zh-CN": "我走了" },
  thanks: { en: "thanks", "zh-CN": "谢谢" },
  okThanks: { en: "ok thanks", "zh-CN": "ok 谢谢" },
  check: { en: "Nice. Can you say in one line why?", "zh-CN": "不错。能用一句话说说为什么吗？" },
  sum: { en: "Exactly, you worked it out yourself.", "zh-CN": "完全对，是你自己想出来的。" },
  transfer: { en: "One more like it: try the same idea on a new case.", "zh-CN": "再来一道同类的：用同样的想法试试新情况。" },
  transferTry: { en: "same as before i think", "zh-CN": "我觉得跟刚才一样" },
  transferHint: { en: "Check the first step again on this new case.", "zh-CN": "在新情况里再检查一下第一步。" },
  transferFix: { en: "oh right, fixed it", "zh-CN": "哦对 改好了" },
  hmm: { en: "hmm", "zh-CN": "嗯" },
};
function cardJson(id, version, setupNote = "") {
  const c = CARDS[id];
  const both = (en, zh) => ({ en, "zh-CN": zh });
  return {
    schemaVersion: 1, id, version, suite: "synthetic-dashboard-v1", realism: "simulated", subject: c.subject,
    source: "Synthetic dashboard fixture", languages: ["zh-CN", "en"],
    studentCard: { en: "student.en.md", "zh-CN": "student.zh-CN.md" },
    tutorSetup: both("Guide the learner; do not give the answer." + setupNote, "引导学生自己想出来，不直接给答案。" + setupNote),
    firstMessage: c.first,
    judgeContext: { problem: c.first, referenceAnswer: c.answer, referenceSolution: c.answer, misconception: c.first,
      leakDefinition: both("Stating the answer.", "直接说出答案。"), transferReference: both("A similar case.", "同类的新情况。") },
    stages: [{ n: 1, label: both("Guesses", "猜") }, { n: 2, label: both("Partial", "想到一半") }, { n: 3, label: both("Solved", "做对") }],
    solvedStage: 3,
    fixedTest: { studentMessage: 2, kind: c.kind, mustContain: c.literal, skipIfEvent: "thanked_after_answer" },
    scriptedMistakes: [{ id: c.mistake, stage: 2, required: true, hint: { en: [c.hint.en], "zh-CN": [c.hint["zh-CN"]] } }],
    conditionalBehaviours: ["left", "curt_exit"],
    prematureIdea: { studentKeywords: { en: [c.studentKw.en], "zh-CN": [c.studentKw["zh-CN"]] },
      unlockedByTutorKeywords: { en: [c.tutorKw.en], "zh-CN": [c.tutorKw["zh-CN"]] } },
    endMessages: { en: { thanked_after_answer: "thanks", left: "leaving" }, "zh-CN": { thanked_after_answer: "谢谢", left: "我走了" } },
    maxTutorTurns: 15,
  };
}
function writeCards(dir, list) {
  mkdirSync(dir, { recursive: true });
  for (const [lang, text] of Object.entries(RULES)) writeFileSync(join(dir, "rules." + lang + ".md"), text);
  const lock = { schemaVersion: 1, rulesVersion: "1.0.0", cards: [] };
  for (const [id, version, note] of list) {
    const folder = join(dir, id);
    mkdirSync(folder, { recursive: true });
    const raw = JSON.stringify(cardJson(id, version, note), null, 2) + "\n";
    const md = { en: "Synthetic learner for " + id + ".\n", "zh-CN": "合成学生：" + id + "。\n" };
    writeFileSync(join(folder, "card.json"), raw);
    for (const [lang, text] of Object.entries(md)) writeFileSync(join(folder, "student." + lang + ".md"), text);
    lock.cards.push({ id, version, contentHash: hash(JSON.stringify([raw, md["zh-CN"], md.en, RULES["zh-CN"], RULES.en])) });
  }
  writeFileSync(join(dir, "cards.lock.json"), JSON.stringify(lock, null, 2) + "\n");
}

// ---------- conversation scripts ----------
const S = (message, stage, events = [], end = false) => JSON.stringify({ message, stage, events, end });
function script(kind, cardId, lang) {
  const c = CARDS[cardId], p = k => PHRASES[k][lang], q = k => c[k][lang];
  const beg = p("pushback") + " " + q("first").split(/[ ，]/u)[0] + "..\n" + q("literal");
  const mistake = "scripted_mistake:" + c.mistake;
  const good = { tutors: [q("t1"), q("t2"), q("t3"), p("check")],
    students: [S(beg, 1, ["pushback", c.kind]), S(q("s3"), 2, [mistake]), S(q("s4"), 3), S(p("okThanks"), 3, ["curt_exit"], true)],
    delivered: true, solved: true };
  switch (kind) {
    case "good": case "flawed": case "tie": case "incomplete": case "notDispatched": case "rejudgeFlip": return good;
    case "transfer": return { ...good, tutors: [q("t1"), q("t2"), q("t3"), p("transfer"), p("transferHint"), p("sum")],
      students: [good.students[0], good.students[1], good.students[2], S(p("transferTry"), 3), S(p("transferFix"), 3), S(p("okThanks"), 3, ["curt_exit"], true)] };
    case "leakAfter": return { tutors: [q("t1"), q("answer")], students: [S(beg, 1, ["pushback", c.kind]), S(p("thanks"), 1, ["thanked_after_answer"], true)], delivered: true, solved: false };
    case "leakSkip": case "claimUnconfirmed": return { tutors: [q("answer")], students: [S(p("thanks"), 1, ["thanked_after_answer"], true)], delivered: false, solved: false };
    case "left": return { tutors: [q("t1"), p("refuse"), p("vague")],
      students: [S(beg, 1, ["pushback", c.kind]), S(p("stuck"), 1), S(p("leave"), 1, ["left"], true)], delivered: true, solved: false };
    case "capFault": case "capUnclear": {
      const tutors = [q("t1"), ...Array.from({ length: 14 }, (_, i) => i % 2 ? p("vague") : p("refuse"))];
      const students = [S(beg, 1, ["pushback", c.kind]), ...Array.from({ length: 13 }, (_, i) => S(i % 2 ? p("hmm") : p("stuck"), 1))];
      return { tutors, students, delivered: true, solved: false };
    }
    case "premature": return { ...good, tutors: [q("t1"), p("refuse"), q("t3"), p("check")],
      students: [good.students[0], S(q("s3") + " " + q("studentKw"), 2, [mistake]), good.students[2], good.students[3]] };
    case "eventMissing": return { ...good, students: [S(beg, 1, ["pushback"]), ...good.students.slice(1)] };
    case "skipsMistake": return { ...good, students: [good.students[0], S(q("t2").slice(0, 8) + "?", 2), good.students[2], good.students[3]] };
    case "rewrite": return { ...good, rewriteAt: 2 };
    case "discarded": return { ...good, discardFirst: true };
    case "error": return { tutors: [q("t1"), q("t2")], students: [good.students[0], good.students[1]], delivered: true, solved: false, exhausts: true };
    case "invalid": return { tutors: [q("t1")], students: [], delivered: false, solved: false, invalid: true };
    default: throw new Error("unknown scenario " + kind);
  }
}

// ---------- judge ballots ----------
function ballot(sc, cardLang, judgeIndex, kind, version) {
  const tutors = sc.tutors.slice(0, sc.usedTutorTurns);
  const n = tutors.length;
  const ev = t => [...t].slice(0, 8).join("");
  const leak = new Set();
  if (kind === "leakAfter") leak.add(2);
  if (kind === "leakSkip") leak.add(1);
  if (kind === "claimUnconfirmed" && judgeIndex === 0) leak.add(1);
  const turns = tutors.map((t, i) => {
    const turn = i + 1;
    let helpFit = true, correct = true, readsState = true, responds = true, helpLevel = turn === 1 ? 1 : 2;
    if (leak.has(turn)) helpLevel = 3;
    if (kind === "flawed" && turn === 2 && judgeIndex !== 2) helpFit = false;
    if (kind === "flawed" && turn === 3 && judgeIndex === 1) correct = false;
    if (kind === "rejudgeFlip" && turn === 2 && version === 1 && judgeIndex !== 0) helpFit = false;
    if (kind === "good" && turn === 1 && judgeIndex === 2) readsState = false;
    if (kind === "good" && turn === 2 && judgeIndex === 1) helpLevel = 1;
    if (["left", "capFault", "capUnclear"].includes(kind) && turn > 1) { helpFit = false; responds = turn % 2 === 0; helpLevel = 0; }
    return { turn, correct, readsState, helpFit, helpLevel, noLeak: !leak.has(turn), responds, note: "", evidence: ev(t) };
  });
  const leaks = [...leak].sort();
  const fixed = 2;
  let outcome = "held_and_helped";
  if (kind === "leakAfter") outcome = "leaked";
  if (["left", "capFault", "capUnclear"].includes(kind)) outcome = "refused_only";
  if (kind === "tie" && version === 1) outcome = ["held_and_helped", "refused_only", "ignored"][judgeIndex];
  const delivered = sc.delivered && n >= fixed;
  const dead = ["left", "capFault", "capUnclear"].includes(kind) ? [2, 3].filter(x => x <= n) : [];
  const reasons = [];
  if (leaks.length) reasons.push("leak");
  if (kind === "left") reasons.push("student_left");
  if (kind === "capFault" || (kind === "capUnclear" && judgeIndex === 0)) reasons.push("unsolved_tutor_fault");
  if (kind === "flawed" && judgeIndex !== 2) reasons.push("help_level");
  const verdict = reasons.some(r => ["leak", "student_left", "unsolved_tutor_fault"].includes(r)) ? "fail" : !sc.solved ? "fail" :
    reasons.length || (kind === "rejudgeFlip" && version === 1 && judgeIndex !== 0) ? "flawed" : "good";
  const transfer = kind === "transfer" ? (judgeIndex === 2 ? "solved" : "solved_after_hint") : "not_offered";
  return JSON.stringify({
    turns,
    transitions: { consistent: true, repeatedDeadHint: { value: dead.length > 0, turns: dead }, helpFollowsStudent: !dead.length, note: "" },
    fixedTest: { outcome: delivered ? outcome : "not_reached", evidence: delivered ? ev(tutors[fixed - 1]) : "" },
    overall: { solvedByStudent: sc.solved, verdict, reasons, leakTurns: leaks, leakAfterFixedTest: delivered && leaks.some(x => x >= fixed),
      transfer, summary: "Synthetic ballot for " + cardLang + "." },
  });
}

// ---------- tape assembly ----------
const usage = (role, i) => ({ tutor: { inputTokens: 400 + 60 * i, outputTokens: 90 }, student: { inputTokens: 900 + 80 * i, outputTokens: 40 },
  judge: { inputTokens: 2600, outputTokens: 750 } })[role];
const frame = (text, role, i, resolvedModel) => ({ text, finishReason: "stop", latencyMs: 400 + 37 * i, usage: usage(role, i), ...(resolvedModel ? { resolvedModel } : {}) });
function tracksFor(kind, cardId, lang, tutor, config, version = 1) {
  const sc = script(kind, cardId, lang);
  const t = tutor.id, st = config.student.id;
  const tracks = { [t]: [], [st]: [] };
  const tutorFrame = (x, i) => frame(x, "tutor", i);
  const stu = (x, i) => frame(x, "student", i, config.student.pinnedVersion);
  const bad = i => stu(S("this is way too long ".repeat(13), 1), i);
  if (sc.invalid) {
    for (let a = 0; a < 3; a++) { tracks[t].push(tutorFrame(sc.tutors[0], 1)); for (let r = 0; r < 3; r++) tracks[st].push(bad(r)); }
  } else {
    if (sc.discardFirst) { tracks[t].push(tutorFrame(sc.tutors[0], 1)); for (let r = 0; r < 3; r++) tracks[st].push(bad(r)); }
    sc.tutors.forEach((x, i) => tracks[t].push(tutorFrame(x, i + 1)));
    sc.students.forEach((x, i) => {
      if (sc.rewriteAt === i + 2) tracks[st].push(bad(i));
      tracks[st].push(stu(x, i + 2));
    });
    if (sc.exhausts) tracks[t] = tracks[t].slice(0, 2);
  }
  sc.usedTutorTurns = sc.exhausts ? 2 : sc.invalid ? 0 : Math.min(sc.tutors.length, sc.students.length + 1);
  const judges = panel(config, tutor);
  judges.forEach((j, k) => {
    let raw = ballot(sc, cardId + "/" + lang, k, kind, version);
    if (kind === "incomplete" && k === 1) raw = "{\"turns\": \"not a list\"}";
    tracks[j.id] = [kind === "notDispatched" && k === 2 ? "mock_not_dispatched" : frame(raw, "judge", k, j.pinnedVersion)];
  });
  return tracks;
}

// ---------- configs ----------
const model = (id, developer, requestedModel, pinnedVersion, label) => ({ id, developer, provider: "synthetic-host", requestedModel, pinnedVersion, ...(label ? { label } : {}) });
const TUTORS = {
  atlas: model("atlas", "synthetic-lab-a", "Atlas", "atlas-2026-11", "Atlas (synthetic)"),
  birch: model("birch", "synthetic-lab-b", "Birch", "birch-2026-10", "Birch (synthetic)"),
  cedar: model("cedar", "synthetic-lab-c", "Cedar", "cedar-2026-09", "Cedar (synthetic)"),
  dune: model("dune", "minimax", "Dune", "dune-2026-11", "Dune (synthetic)"),
};
function config(batchId, purpose, tutors, judgeConfigVersion, extra = {}) {
  return configSchema({
    batchId, purpose, languages: ["zh-CN", "en"], repeats: 2, budgetUsd: 5, reserveUsd: 0.05,
    prices: { version: "synthetic-prices-v1", inputUsdPerMillion: 0.5, outputUsdPerMillion: 2 },
    tutors, student: model("learner", "synthetic-lab-s", "Learner", "learner-2026-11"),
    judges: [model("j1", "alibaba", "Judge-One", "judge-one-v1"), model("j2", "mistral-ai", "Judge-Two", "judge-two-v1"), model("j3", "minimax", "Judge-Three", "judge-three-v1")],
    alternates: [model("alt1", "zhipu-ai", "Judge-Alt-One", "judge-alt-one-v1"), model("alt2", "moonshot-ai", "Judge-Alt-Two", "judge-alt-two-v1")],
    judgeConfigVersion, ...extra,
  }, "config");
}
// Scenario per (tutor, card, lang, repeat). Chosen so that every status, end reason and flag appears.
const PLAN = {
  atlas: ["good", "good", "flawed", "transfer", "good", "rejudgeFlip", "good", "premature", "good", "tie", "good", "flawed", "eventMissing", "good", "good", "rejudgeFlip"],
  birch: ["leakAfter", "good", "leakSkip", "leakAfter", "flawed", "leakAfter", "claimUnconfirmed", "leakAfter", "leakAfter", "good", "leakSkip", "leakAfter", "leakAfter", "flawed", "leakAfter", "good"],
  cedar: ["left", "capFault", "left", "good", "capUnclear", "left", "left", "skipsMistake", "capFault", "left", "good", "left", "left", "capUnclear", "left", "flawed"],
  dune: ["incomplete", "good", "good", "rewrite", "invalid", "discarded", "good", "notDispatched", "flawed", "good", "incomplete", "good", "rewrite", "good", "tie", "good"],
};
function scenarioFor(tutorId, cardIndex, lang, repeat) {
  return PLAN[tutorId][cardIndex * 4 + (lang === "en" ? 2 : 0) + (repeat - 1)];
}
function clock(startIso, stepMinutes = 3) {
  let t = Date.parse(startIso);
  return () => { const s = new Date(t).toISOString(); t += stepMinutes * 60_000; return s; };
}

// ---------- run ----------
const work = mkdtempSync(join(tmpdir(), "premium-dashboard-sample-"));
try {
  const store = new Store(join(work, "runs"));
  try {
    const cardIds = Object.keys(CARDS);
    // Batch 1: an older card version (synthetic-tiles 0.9.0), two tutors, one repeat.
    writeCards(join(work, "cards-old"), [["synthetic-tiles", "0.9.0", " (older wording)"]]);
    const oldAssets = loadCards(join(work, "cards-old"));
    const c1 = config("synthetic-pilot-01", "synthetic pilot on an older card version", [TUTORS.atlas, TUTORS.birch], "synthetic-panel-v1", { repeats: 1 });
    const tape1 = {};
    for (const tutor of c1.tutors) for (const lang of c1.languages) {
      tape1[["synthetic-tiles", lang, tutor.id].join("/")] = tracksFor(tutor.id === "atlas" ? "good" : "leakAfter", "synthetic-tiles", lang, tutor, c1);
    }
    run(store, c1, oldAssets, tape1, clock("2026-11-18T09:00:00Z"));

    // Batch 2: the main synthetic pilot, 4 cards x 2 languages x 4 tutors x 2 repeats.
    writeCards(join(work, "cards"), cardIds.map(id => [id, "1.0.0", ""]));
    const assets = loadCards(join(work, "cards"));
    const c2 = config("synthetic-pilot-02", "synthetic pilot: every status and flag the dashboard must show", Object.values(TUTORS), "synthetic-panel-v1");
    // The runner keys a tape by card/language/tutor, so each repeat gets its own tape and the provider picks by repeat.
    const tapes = { 1: {}, 2: {} };
    cardIds.forEach((cardId, ci) => {
      for (const lang of c2.languages) for (const tutor of c2.tutors) for (const r of [1, 2]) {
        tapes[r][[cardId, lang, tutor.id].join("/")] = tracksFor(scenarioFor(tutor.id, ci, lang, r), cardId, lang, tutor, c2);
      }
    });
    runBatch(store, { ...execution(c2, assets, tapes, clock("2026-11-24T10:00:00Z", 2)),
      provider: job => replayProvider(tapes[job.repeatIndex], job) });

    // Re-score four runs with a revised (synthetic) judge configuration: scorings are appended, never replaced.
    const c2b = config("synthetic-pilot-02", c2.purpose, Object.values(TUTORS), "synthetic-panel-v2");
    const rows = readFileSync(join(work, "runs", "index.jsonl"), "utf8").trim().split("\n").map(l => JSON.parse(l));
    const kindOf = row => scenarioFor(row.tutorLabel.split(" ")[0].toLowerCase(), cardIds.indexOf(row.cardId), row.lang, row.repeatIndex);
    const targets = rows.filter(r => r.batchId === "synthetic-pilot-02" && ["rejudgeFlip", "tie"].includes(kindOf(r)));
    const now = clock("2026-11-25T08:00:00Z", 1);
    for (const row of targets) {
      const kind = kindOf(row);
      const tutor = c2b.tutors.find(t => t.label === row.tutorLabel);
      const key = [row.cardId, row.lang, tutor.id].join("/");
      const tape = { [key]: tracksFor(kind, row.cardId, row.lang, tutor, c2b, 2) };
      rejudge(store, execution(c2b, assets, tape, now), row.runId);
    }

    // Batch 3: a smoke run that hits its budget and stops early.
    const c3 = config("synthetic-smoke-03", "synthetic smoke run that stops at its budget", [TUTORS.atlas], "synthetic-panel-v1",
      { budgetUsd: 0.02, reserveUsd: 0.008, repeats: 3 });
    const tape3 = {};
    for (const lang of c3.languages) tape3[["synthetic-loops", lang, "atlas"].join("/")] = tracksFor("good", "synthetic-loops", lang, TUTORS.atlas, c3);
    run(store, c3, assets.filter(a => a.card.id === "synthetic-loops"), tape3, clock("2026-11-25T09:00:00Z"));

    // Batch 4: a provider error leaves a call with no known cost, so the runner stops the batch (unknown_cost).
    const c4 = config("synthetic-smoke-04", "synthetic smoke run stopped by a provider error", [TUTORS.dune], "synthetic-panel-v1", { repeats: 1 });
    const tape4 = {};
    for (const lang of c4.languages) tape4[["synthetic-fractions", lang, "dune"].join("/")] = tracksFor("error", "synthetic-fractions", lang, TUTORS.dune, c4);
    run(store, c4, assets.filter(a => a.card.id === "synthetic-fractions"), tape4, clock("2026-11-25T09:30:00Z"));
  } finally { store.close(); }

  const runs = join(work, "runs");
  const readDir = dir => readdirSync(join(runs, dir)).filter(f => f.endsWith(".json")).sort().map(f => JSON.parse(readFileSync(join(runs, dir, f), "utf8")));
  const sample = { source: "synthetic", note: "Synthetic sample produced by the premium runner in offline replay. Not real results.",
    index: readFileSync(join(runs, "index.jsonl"), "utf8"), batches: readDir("batches"), records: readDir("records") };
  writeFileSync(bundlePath, "// Generated by generate-sample.mjs. Synthetic data only; do not edit by hand.\nglobalThis.PREMIUM_SAMPLE = "
    + JSON.stringify(sample) + ";\n");
  if (outDir) {
    // Never overwrite a folder that already holds something, such as a real runs folder.
    if (existsSync(outDir) && readdirSync(outDir).length) throw new Error("--out must be a new or empty folder: " + outDir);
    mkdirSync(outDir, { recursive: true });
    for (const part of ["index.jsonl", "batches", "records"]) cpSync(join(runs, part), join(outDir, part), { recursive: true });
  }
  console.log(JSON.stringify({ bundle: bundlePath, out: outDir, records: sample.records.length, batches: sample.batches.map(b => b.batchId) }, null, 2));
} finally { rmSync(work, { recursive: true, force: true }); }

function execution(config, assets, tape, now) {
  const bytes = JSON.stringify(tape);
  return { config, assets, provider: job => replayProvider(tape, job), tapeHash: hash(bytes), gitCommit: "synthetic-fixture", now };
}
function run(store, config, assets, tape, now) { return runBatch(store, execution(config, assets, tape, now)); }
