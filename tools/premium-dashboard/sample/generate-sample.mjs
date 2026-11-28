// Generates the synthetic sample runs for the premium dashboard.
//
// Every record is produced by the premium runner itself (offline replay), so the sample
// follows the runner's real output format. Cards, tutors, students and judges are all
// synthetic: no real card, prompt, model output or person appears here.
//
// Needs the record schema v6 runner (student protocol, single-step probes). The bundled sample also keeps history, the way
// a real folder grows across runner versions: with --legacy-runner the batches before 2026-11-25 are written by a record
// schema v2 runner, with --v3-runner the batches of 2026-11-25 and 2026-11-26 up to 05:00 by a record schema v3 runner,
// with --v5-runner the v5 calibration batches of 2026-11-26, and the newest runner then adds the v6 batches of 2026-11-27.
// Usage (needs a build that contains the premium runner, src/premium/*):
//   node tools/premium-dashboard/sample/generate-sample.mjs [--runner <dir>] [--v5-runner <dir>] [--v3-runner <dir>] [--legacy-runner <dir>]
//     [--checker <file>] [--bundle <file>] [--out <dir>]
// --runner         folder with the built premium runner modules, record schema v6 (default dist/src/premium)
// --v5-runner      optional: a record schema v5 build for the v5 calibration batches (default: --runner)
// --v3-runner      optional: a record schema v3 build for the batches of that era (default: --runner)
// --legacy-runner  optional: a record schema v2 build for the history batches (default: the v3 runner)
// --checker        the private calibration checker (check_calibration.py, v2). It is not in this repository. The runner's
//                  checkCalibration runs it on the synthetic calibration batches against the synthetic expectations below;
//                  without it every calibration report comes out as CANNOT_CHECK.
//                  The v6 batches need no checker: the real checker v3 is written for one private card, so the generator
//                  writes their v3 reports, content reviews and gate result itself, in the shapes the checker writes.
// --bundle  the sample the dashboard loads (default tools/premium-dashboard/sample/sample-data.js)
// --out     optional: also write the runner's folder layout (index.jsonl, batches/, records/, reports, expectations, the probe
//           file, content reviews and the gate result) there;
//           must be new or empty
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

const { values } = parseArgs({ options: { runner: { type: "string" }, "v5-runner": { type: "string" }, "v3-runner": { type: "string" }, "legacy-runner": { type: "string" }, checker: { type: "string" },
  out: { type: "string" }, bundle: { type: "string" } } });
const bundlePath = resolve(values.bundle ?? "tools/premium-dashboard/sample/sample-data.js");
const outDir = values.out ? resolve(values.out) : null;
async function runnerAt(dir) {
  const load = name => import(pathToFileURL(join(dir, name + ".js")).href);
  const [{ hash, loadCards }, { runBatch, rejudge, reconcile }, { configSchema, panel, TransportError }, { replayProvider }, { Store }] =
    await Promise.all(["cards", "batch", "provider", "replay", "store"].map(load));
  const checkCalibration = existsSync(join(dir, "check-calibration.js")) ? (await load("check-calibration")).checkCalibration : null;
  const loadProbes = existsSync(join(dir, "plan.js")) && existsSync(join(dir, "protocol.js")) ? (await load("plan")).loadProbes : null;
  return { hash, loadCards, runBatch, rejudge, reconcile, configSchema, panel, replayProvider, Store, TransportError, checkCalibration, loadProbes };
}
const newest = await runnerAt(resolve(values.runner ?? "dist/src/premium"));
if (!newest.loadProbes) throw new Error("--runner must be a build with record schema v6 (src/premium/plan, src/premium/protocol)");
const v5 = values["v5-runner"] ? await runnerAt(resolve(values["v5-runner"])) : newest;
if (!v5.checkCalibration) throw new Error("--v5-runner must be a build with record schema v5 (src/premium/check-calibration)");
const current = values["v3-runner"] ? await runnerAt(resolve(values["v3-runner"])) : newest;
const legacy = values["legacy-runner"] ? await runnerAt(resolve(values["legacy-runner"])) : current;
// The functions below use whichever runner is active; history batches switch to the legacy one.
let { hash, loadCards, runBatch, rejudge, reconcile, configSchema, panel, replayProvider, Store } = current;
const use = R => ({ hash, loadCards, runBatch, rejudge, reconcile, configSchema, panel, replayProvider, Store } = R);

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
function cardJson(id, version, setupNote = "", c = CARDS[id]) {
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
    solvedStage: 3, leaveNotBefore: 4,
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
    case "good": case "flawed": case "tie": case "incomplete": case "notDispatched": case "rejudgeFlip":
    case "verdictSplit": case "crosscheck": case "solvedClaim": case "repair": case "fenced": case "usageMissing": return good;
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
    // The student tries to leave at message 3, before the card's leaveNotBefore (4): the runner sends it back.
    case "rewriteLeft": return { ...good, rewriteAt: 3, rewriteWith: S(p("leave"), 1, ["left"], true) };
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
  let verdict = reasons.some(r => ["leak", "student_left", "unsolved_tutor_fault"].includes(r)) ? "fail" : !sc.solved ? "fail" :
    reasons.length || (kind === "rejudgeFlip" && version === 1 && judgeIndex !== 0) ? "flawed" : "good";
  // Judges' own verdicts are descriptive in v2: a three-way split or a majority against the rule verdict is a review flag.
  if (kind === "verdictSplit") verdict = ["good", "flawed", "fail"][judgeIndex];
  if (kind === "crosscheck" && judgeIndex !== 0) verdict = "flawed";
  const solvedByStudent = kind === "solvedClaim" && judgeIndex !== 2 ? false : sc.solved;
  const transfer = kind === "transfer" ? (judgeIndex === 2 ? "solved" : "solved_after_hint") : "not_offered";
  return JSON.stringify({
    turns,
    transitions: { consistent: true, repeatedDeadHint: { value: dead.length > 0, turns: dead }, helpFollowsStudent: !dead.length, note: "" },
    fixedTest: { outcome: delivered ? outcome : "not_reached", evidence: delivered ? ev(tutors[fixed - 1]) : "" },
    overall: { solvedByStudent, verdict, reasons, leakTurns: leaks, leakAfterFixedTest: delivered && leaks.some(x => x >= fixed),
      transfer, summary: "Synthetic ballot for " + cardLang + "." },
  });
}

// ---------- tape assembly ----------
const usage = (role, i) => ({ tutor: { inputTokens: 400 + 60 * i, outputTokens: 90 }, student: { inputTokens: 900 + 80 * i, outputTokens: 40 },
  judge: { inputTokens: 2600, outputTokens: 750 } })[role];
const frame = (text, role, i, resolvedModel) => ({ text, finishReason: "stop", latencyMs: 400 + 37 * i, usage: usage(role, i), ...(resolvedModel ? { resolvedModel } : {}) });
// A tutor with a prompt of its own reads that prompt on every call, so its input is a little longer.
const withPrompt = (f, tutor) => (tutor.prompt && f.usage ? { ...f, usage: { ...f.usage, inputTokens: f.usage.inputTokens + 120 } } : f);
function tracksFor(kind, cardId, lang, tutor, config, version = 1) {
  const sc = script(kind, cardId, lang);
  const t = tutor.id, st = config.student.id;
  const tracks = { [t]: [], [st]: [] };
  // Each synthetic tutor answers at its own typical speed, so the value plate has something to show.
  const tutorFrame = (x, i) => withPrompt({ ...frame(x, "tutor", i), latencyMs: (TUTOR_SPEED_MS[t] || 400) + 53 * i }, tutor);
  const stu = (x, i) => frame(x, "student", i, config.student.pinnedVersion);
  const bad = i => stu(S("this is way too long ".repeat(13), 1), i);
  const rejectedReply = i => (sc.rewriteWith ? stu(sc.rewriteWith, i) : bad(i));
  if (sc.invalid) {
    for (let a = 0; a < 3; a++) { tracks[t].push(tutorFrame(sc.tutors[0], 1)); for (let r = 0; r < 3; r++) tracks[st].push(bad(r)); }
  } else {
    if (sc.discardFirst) { tracks[t].push(tutorFrame(sc.tutors[0], 1)); for (let r = 0; r < 3; r++) tracks[st].push(bad(r)); }
    sc.tutors.forEach((x, i) => tracks[t].push(kind === "usageMissing" && i === 1 ? { ...tutorFrame(x, i + 1), usage: null } : tutorFrame(x, i + 1)));
    sc.students.forEach((x, i) => {
      if (sc.rewriteAt === i + 2) tracks[st].push(rejectedReply(i));
      tracks[st].push(stu(x, i + 2));
    });
    if (sc.exhausts) tracks[t] = tracks[t].slice(0, 2);
  }
  sc.usedTutorTurns = sc.exhausts ? 2 : sc.invalid ? 0 : Math.min(sc.tutors.length, sc.students.length + 1);
  const judges = panel(config, tutor);
  judges.forEach((j, k) => {
    let raw = ballot(sc, cardId + "/" + lang, k, kind, version);
    if (kind === "incomplete" && k === 1) raw = "{\"turns\": \"not a list\"}";
    if (kind === "fenced" && k === 0) raw = "\u0060\u0060\u0060json\n" + raw + "\n\u0060\u0060\u0060";
    tracks[j.id] = [kind === "notDispatched" && k === 2 ? "mock_not_dispatched" : frame(raw, "judge", k, j.pinnedVersion)];
    if (kind === "repair" && k === 2) {
      // First ballot names a leak turn that no turn marks; the runner sends it back once and keeps the rejected reply.
      const broken = JSON.parse(raw);
      broken.overall.leakTurns = [1];
      tracks[j.id].unshift(frame(JSON.stringify(broken), "judge", k, j.pinnedVersion));
    }
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
// v2 per-model price table (used by the newer batches; the older batches keep the legacy flat rates).
const priced = (model, input, output) => ({ model, inputUsdPerMillion: input, outputUsdPerMillion: output, date: "2026-11-25", source: "https://example.com/synthetic-prices" });
// Tutors differ in price and speed on purpose: Atlas is mid-priced and slow, Dune cheap and fast, Cedar expensive.
// Atlas · coach is the same Atlas model with a teaching prompt of its own, so it has Atlas's price and speed.
const TUTOR_SPEED_MS = { atlas: 2300, "atlas-coach": 2300, birch: 900, cedar: 3400, dune: 650 };
const modelPrices = { version: "synthetic-prices-v2", models: [priced("atlas", 0.5, 2), priced("birch", 0.4, 1.6), priced("cedar", 2.5, 10), priced("dune", 0.15, 0.6),
  priced("learner", 0.3, 1.2), priced("j1", 0.5, 2), priced("j2", 0.5, 2), priced("j3", 0.5, 2), priced("alt1", 0.5, 2), priced("alt2", 0.5, 2)] };
// The prompt batches add an entry for Atlas · coach, so they have a table of their own.
const coachPrices = { version: "synthetic-prices-v3", models: [...modelPrices.models, priced("atlas-coach", 0.5, 2)] };
// Synthetic teaching prompts of the tutor's own (record schema v3). Both languages are one prompt with one
// language-independent hash; 1.1.0 adds one sentence, so its hash differs.
const COACH = {
  "1.0.0": { id: "synthetic-coach", version: "1.0.0", text: {
    en: "You are a patient tutor. Ask one short question at a time and let the learner do the thinking.",
    "zh-CN": "你是一位耐心的导师。每次只问一个简短的问题，让学生自己思考。" } },
  "1.1.0": { id: "synthetic-coach", version: "1.1.0", text: {
    en: "You are a patient tutor. Ask one short question at a time and let the learner do the thinking. When the learner asks for the answer, first ask what they have tried.",
    "zh-CN": "你是一位耐心的导师。每次只问一个简短的问题，让学生自己思考。学生要答案时，先问他已经试过什么。" } },
};
const coach = version => ({ ...TUTORS.atlas, id: "atlas-coach", label: "Atlas · coach (synthetic)", prompt: COACH[version] });
// Scenario per (tutor, card, lang, repeat). Chosen so that every status, end reason and flag appears.
const PLAN = {
  atlas: ["good", "good", "flawed", "transfer", "verdictSplit", "rejudgeFlip", "good", "premature", "crosscheck", "tie", "good", "flawed", "eventMissing", "good", "good", "rejudgeFlip"],
  birch: ["leakAfter", "good", "leakSkip", "leakAfter", "flawed", "leakAfter", "claimUnconfirmed", "leakAfter", "leakAfter", "good", "leakSkip", "leakAfter", "leakAfter", "flawed", "leakAfter", "good"],
  cedar: ["left", "capFault", "left", "good", "capUnclear", "left", "left", "skipsMistake", "capFault", "left", "solvedClaim", "left", "left", "capUnclear", "left", "flawed"],
  dune: ["incomplete", "good", "repair", "rewrite", "invalid", "discarded", "fenced", "notDispatched", "flawed", "good", "incomplete", "usageMissing", "rewrite", "good", "tie", "good"],
};
function scenarioFor(tutorId, cardIndex, lang, repeat) {
  return PLAN[tutorId][cardIndex * 4 + (lang === "en" ? 2 : 0) + (repeat - 1)];
}
function clock(startIso, stepMinutes = 3) {
  let t = Date.parse(startIso);
  return () => { const s = new Date(t).toISOString(); t += stepMinutes * 60_000; return s; };
}

// ---------- record schema v5: calibration batches with a checker report ----------
// The scripted calibration tutors answer from the tape and use no tokens, as in a real calibration. The simulated
// student's frames carry the provider's model name, a system fingerprint and the cache split of the input, so the
// records hold what record schema v5 adds: requested and returned model, fingerprint, call time and cache receipt.
function scripted(id, label) { return { id, developer: "synthetic-scripted", provider: "synthetic-tape", requestedModel: id, pinnedVersion: id + "-v1", label }; }
const CALIB = [scripted("calib-steady", "Steady · scripted (synthetic)"), scripted("calib-leaky", "Leaks at turn 2 · scripted (synthetic)"), scripted("calib-vague", "Vague hints · scripted (synthetic)")];
const CALIB_SCRIPT = { "calib-steady": "good", "calib-leaky": "leakAfter", "calib-vague": "left" };
// The first budget of batch 13: it runs out in the middle of calib-leaky zh-CN #2, which the top-up then restarts.
const CALIB_BUDGET_STOP = 0.006;
const LEARNER = model("learner", "synthetic-lab-s", "Learner", "learner-2026-11");
const calibPrices = { version: "synthetic-prices-v5", models: [...CALIB.map(t => priced(t.id, 0, 0)),
  { ...priced("learner", 0.3, 1.2), cacheHitInputUsdPerMillion: 0.03 }] };
// Twists per run: replies the runner sends back (by message), a discarded attempt, a reply in a ```json fence, deviations
// the checker finds, a call whose cache split the provider did not report, and a timeout retried after the provider's wait.
function calibTape(tutor, lang, twists, fp) {
  const card = "synthetic-tiles", c = CARDS[card], p = k => PHRASES[k][lang], q = k => c[k][lang];
  const sc = script(CALIB_SCRIPT[tutor.id], card, lang);
  const on = k => twists.includes(k);
  const beg = p("pushback") + " " + q("first").split(/[ ，]/u)[0] + "..\n" + q("literal");
  const students = sc.students.slice();
  if (on("noKind")) students[0] = S(beg, 1, ["pushback"]);
  if (on("noMistake")) students[1] = S(q("s3"), 2);
  if (on("paraphraseLeave")) students[students.length - 1] = S(lang === "en" ? "ok bye" : "算了 拜拜", 1, ["left"], true);
  if (on("fence")) students[students.length - 1] = "```json\n" + students[students.length - 1] + "\n```";
  const before = {
    plain2: [2, [beg]],
    stage2: [2, [S(beg, 3, ["pushback", c.kind])]],
    stage2x2: [2, [S(beg, 3, ["pushback", c.kind]), S("this is way too long ".repeat(13), 1, ["pushback", c.kind])]],
    missing2: [2, [S(p("pushback") + " " + q("first").split(/[ ，]/u)[0] + "..", 1, ["pushback", c.kind])]],
    unknownEvt3: [3, [(() => { const x = JSON.parse(students[1]); return S(x.message, x.stage, [...x.events, "confused"], x.end); })()]],
    leaveEarly3: [3, [S(p("leave"), 1, ["left"], true)]],
  };
  let k = 0;
  const stu = text => {
    k++;
    const input = 1500 + 160 * k, split = !on("noSplit"), hit = Math.min(input - 64, 1280 + 128 * (k - 1));
    return { text, resolvedModel: LEARNER.pinnedVersion, system_fingerprint: fp, finishReason: "stop", latencyMs: 700 + 41 * k,
      usage: { inputTokens: input, outputTokens: 38 + (k % 5) * 6, ...(split ? { cacheHitTokens: hit, cacheMissTokens: input - hit } : {}) } };
  };
  const tut = text => ({ text, finishReason: "stop", latencyMs: 0, usage: { inputTokens: 0, outputTokens: 0 } });
  const tutors = sc.tutors.slice(0, students.length + 1).map(tut), learner = [];
  let timeoutAt = null;
  if (on("discard")) { tutors.unshift(tut(sc.tutors[0])); learner.push(stu(beg), stu("this is way too long ".repeat(13)), stu(beg)); }
  students.forEach((text, i) => {
    const n = i + 2;
    if (on("timeout3") && n === 3) timeoutAt = learner.length + 1;
    for (const [name, [at, list]] of Object.entries(before)) if (on(name) && at === n) for (const x of list) learner.push(stu(x));
    learner.push(stu(text));
  });
  return { tracks: { [tutor.id]: tutors, [LEARNER.id]: learner }, timeoutAt };
}
// The provider for one job: the tape, plus one timeout (retryable, with the provider's own wait) where the tape asks.
function calibProvider(R, tapes, timeouts) {
  return job => {
    const base = R.replayProvider(tapes[job.repeatIndex], job), at = timeouts[[job.lang, job.tutor.id, job.repeatIndex].join("/")];
    let n = 0, failed = false;
    return req => {
      if (req.role === "student" && ++n === at && !failed) { failed = true; n--; throw new R.TransportError("timeout", true, 1500); }
      return base(req);
    };
  };
}
// Synthetic expectations in the checker's v2 format. The real ones are private; these describe the synthetic card only.
function calibExpectations(asset) {
  const c = CARDS["synthetic-tiles"], terminal = ["left", "curt_exit", "thanked_after_answer"];
  const msg = (n, stage, mustEvents, end, extra = {}) => ({ n, stage: [stage], stageSoft: [], mustEvents, expectEvents: [], forbidEvents: end ? [] : terminal,
    end, endAlsoOk: false, mustContain: [], expectContain: [], mustNotContain: [], human: "synthetic", softNotes: null, ...extra });
  const groups = {};
  for (const lang of ["zh-CN", "en"]) {
    const opening = msg(2, 1, ["pushback", c.kind], false, { mustContain: [c.literal[lang]] });
    groups["calib-steady"] = { ...groups["calib-steady"], [lang]: { messages: [opening, msg(3, 2, ["scripted_mistake:" + c.mistake], false), msg(4, 3, [], false), msg(5, 3, ["curt_exit"], true)],
      end: { reason: ["curt_exit"], fixedTestDelivered: true, scriptedMistakesMade: [c.mistake] } } };
    groups["calib-leaky"] = { ...groups["calib-leaky"], [lang]: { messages: [opening, msg(3, 1, ["thanked_after_answer"], true)],
      end: { reason: ["thanked_after_answer"], fixedTestDelivered: true, scriptedMistakesMade: [] } } };
    groups["calib-vague"] = { ...groups["calib-vague"], [lang]: { messages: [opening, msg(3, 1, [], false), msg(4, 1, ["left"], true, { expectContain: [PHRASES.leave[lang]] })],
      end: { reason: ["left"], fixedTestDelivered: true, scriptedMistakesMade: [] } } };
  }
  return { schemaVersion: 2, purpose: "Synthetic: calibrate the simulated student on the synthetic tiles card with scripted tutors. Dashboard fixture only.",
    card: { id: asset.card.id, version: asset.card.version, contentHash: asset.contentHash, leaveNotBefore: asset.card.leaveNotBefore }, rulesVersion: asset.rulesVersion,
    tape: "synthetic", repeats: 3, languages: ["zh-CN", "en"], plannedGroups: CALIB.map(t => t.id), optionalGroups: [],
    pass: { run: { maxHard: 0, maxSoft: 1 }, group: { runs: 3, minPassingRuns: 2 }, calibration: "every planned group passes", rewriteRateMax: 0.2 },
    globalHard: ["student_invalid (3 attempts failed)"], groups };
}
// The runner stamps each call with the wall clock (calledAt); a fixed clock keeps the sample deterministic.
function withClock(startIso, fn) {
  const Real = Date;
  let t = Real.parse(startIso);
  class Fixed extends Real {
    constructor(...a) { if (a.length) super(...a); else { super(t); t += 1000; } }
    static now() { const v = t; t += 1000; return v; }
  }
  globalThis.Date = Fixed;
  try { return fn(); } finally { globalThis.Date = Real; }
}
function calibrationV5(work, runs) {
  const R = v5;
  const asset = R.loadCards(join(work, "cards")).find(a => a.card.id === "synthetic-tiles");
  const expectations = calibExpectations(asset);
  const expPath = join(work, "calibration-expectations.json");
  writeFileSync(expPath, JSON.stringify(expectations, null, 2) + "\n");
  const checker = values.checker ? resolve(values.checker) : join(work, "no-checker.py");
  const cfg = (batchId, purpose, tutors, languages, repeats, budgetUsd) => R.configSchema({
    batchId, purpose, kind: "calibration", languages, repeats, budgetUsd, reserveUsd: 0, prices: calibPrices, servingIdentity: "alias",
    tutors, student: LEARNER, judges: [model("j1", "alibaba", "Judge-One", "judge-one-v1"), model("j2", "mistral-ai", "Judge-Two", "judge-two-v1"), model("j3", "minimax", "Judge-Three", "judge-three-v1")],
    alternates: [], judgeConfigVersion: "synthetic-panel-v1" }, "config");
  // Each batch runs in a runs folder of its own, because the checker reads a folder that holds one batch; its files are
  // then added to the sample's folder, and its index lines appended.
  const batch = (c, at, plan, fps, dry, phases, checkerPath = checker) => {
    const dir = join(work, "calib-" + c.batchId), tapes = {}, timeouts = {};
    for (let r = 1; r <= c.repeats; r++) tapes[r] = {};
    for (const tutor of c.tutors) for (const lang of c.languages) for (let r = 1; r <= c.repeats; r++) {
      const x = calibTape(tutor, lang, plan[[tutor.id, lang, r].join("/")] || [], fps[r - 1] ?? fps[0]);
      tapes[r][["synthetic-tiles", lang, tutor.id].join("/")] = x.tracks;
      if (x.timeoutAt) timeouts[[lang, tutor.id, r].join("/")] = x.timeoutAt;
    }
    const store = new R.Store(dir);
    try {
      const now = clock(at, 2);
      withClock(at, () => {
        for (const [i, budgetUsd] of (phases || [c.budgetUsd]).entries()) {
          const e = execution({ ...c, budgetUsd }, [asset], tapes, now);
          R.runBatch(store, { ...e, provider: calibProvider(R, tapes, timeouts), ...(i ? { topUp: true } : {}) });
        }
      });
    } finally { store.close(); }
    R.checkCalibration(dir, checkerPath, expPath, c.batchId, dry);
    for (const part of ["records", "batches"]) cpSync(join(dir, part), join(runs, part), { recursive: true });
    for (const f of readdirSync(dir).filter(f => f.startsWith("calibration-report-"))) cpSync(join(dir, f), join(runs, f));
    writeFileSync(join(runs, "index.jsonl"), readFileSync(join(runs, "index.jsonl"), "utf8") + readFileSync(join(dir, "index.jsonl"), "utf8"));
  };
  const langs = ["zh-CN", "en"];
  // Batch 11: the checker could not run (it is given no checker), so the runner writes a CANNOT_CHECK report.
  batch(cfg("synthetic-cannot-check-11", "synthetic calibration whose checker could not run", [CALIB[0]], ["en"], 1, 0.05),
    "2026-11-26T06:00:00Z", {}, ["fp_synth_7c1e"], false, null, join(work, "no-checker.py"));
  // Batch 12: a dry run, one run per group, every group passes.
  batch(cfg("synthetic-dryrun-12", "synthetic calibration dry run", CALIB, langs, 1, 0.05), "2026-11-26T07:00:00Z",
    { ["calib-steady/en/1"]: ["fence"], ["calib-vague/zh-CN/1"]: ["plain2"] }, ["fp_synth_7c1e"], true);
  // Batch 13: the full calibration. It fails: one group falls short and the rewrite rate is over the limit. The budget
  // runs out in the middle of a conversation; after a top-up the runner restarts it and the interrupted record is
  // superseded. The provider's backend changes before the third repeats, so two fingerprints appear.
  batch(cfg("synthetic-calibration-13", "synthetic calibration of the simulated student, three scripted tutors", CALIB, langs, 3, 0.05), "2026-11-26T08:00:00Z", {
    "calib-steady/zh-CN/1": ["plain2", "fence"], "calib-steady/zh-CN/2": ["stage2x2", "timeout3"], "calib-steady/zh-CN/3": ["leaveEarly3", "plain2"],
    "calib-steady/en/1": ["discard"], "calib-steady/en/2": ["noMistake"], "calib-steady/en/3": ["missing2", "noSplit"],
    "calib-leaky/zh-CN/3": ["unknownEvt3"], "calib-leaky/en/1": ["plain2"], "calib-leaky/en/2": ["stage2"],
    "calib-vague/zh-CN/1": ["noKind"], "calib-vague/zh-CN/2": ["noKind", "plain2"], "calib-vague/zh-CN/3": ["paraphraseLeave"],
    "calib-vague/en/1": ["missing2"], "calib-vague/en/2": ["noKind"],
  }, ["fp_synth_7c1e", "fp_synth_7c1e", "fp_synth_9a40"], false, [CALIB_BUDGET_STOP, 0.05]);
  return { expectations };
}

// ---------- record schema v6: the student protocol, single-step probes and checker v3 ----------
// Record schema v6 adds a versioned student protocol: the student answers in JSON mode, and on a card whose fixed test is
// "injected" the runner writes the fixed sentence itself and drops the event if the model reports it. A probe starts
// from a fixed history prefix (cut from a calibration tutor tape) and asks the student for one message only. The card,
// protocol, probes, tapes, checker reports, content reviews and gate result below are synthetic, in this fixture's own words.
const BEADS = {
  subject: "patterns", kind: "begs_for_answer", mistake: "count_pairs",
  first: { en: "red blue red blue.. is the 9th bead blue?", "zh-CN": "红蓝红蓝。。第9颗是蓝的吗？" },
  literal: { en: "just tell me the colour, it's due tomorrow", "zh-CN": "直接告诉我颜色吧 明天要交" },
  echo: { en: ["tell me the colour", "due tomorrow"], "zh-CN": ["告诉我颜色", "明天要交"] },
  hint: { en: "pairs", "zh-CN": "一对" },
  studentKw: { en: "odd", "zh-CN": "单数" }, tutorKw: { en: "odd", "zh-CN": "单数" },
  t1: { en: "What colour are the 1st, 3rd and 5th beads?", "zh-CN": "第1、3、5颗是什么颜色？" },
  s2: { en: "but thats a lot of counting..", "zh-CN": "可是这样要数好久。。" },
  t2: { en: "Look at the beads two at a time. What does each pair look like?", "zh-CN": "两颗两颗地看，每一对是什么样的？" },
  s3: { en: "4 pairs is 8 beads, the 9th ends a pair so blue", "zh-CN": "4对是8颗 第9颗是一对的最后 所以是蓝" },
  t3: { en: "Which beads are red: the odd ones or the even ones?", "zh-CN": "红的是单数颗还是双数颗？" },
  s4: { en: "odd ones are red.. 9 is odd so its red", "zh-CN": "单数是红 9是单数 所以是红的" },
  t3v: { en: "Keep looking at the pattern.", "zh-CN": "再看看规律。" },
  answer: { en: "The 9th bead is red.", "zh-CN": "第9颗是红的。" },
};
const RULES_V2 = {
  en: RULES.en + "\nAnswer with one JSON object. When the runner adds the fixed sentence, leave it out of your message.\n",
  "zh-CN": RULES["zh-CN"] + "\n只回一个 JSON 对象。固定那句由 runner 来加时，你的话里不要写。\n",
};
const both = (en, zh) => ({ "zh-CN": zh, en });
const PROTOCOL = {
  schemaVersion: 1, id: "synthetic-student-protocol", version: "1.0.0", rulesVersion: "2.0.0",
  studentRequest: { responseFormat: { type: "json_object" }, thinking: { type: "disabled" }, temperature: 0.7, maxOutputTokens: 512 },
  instruction: both("Reply with one JSON object: message, stage, events, end. Events you may use: {events}.",
    "只回一个 JSON 对象：message、stage、events、end。可以用的事件：{events}。"),
  instructionEvents: "the card's events; the fixed test's event is left out when the runner injects it",
  turnNote: { separator: "\n\n", default: both("[your message {k}]", "[你的第 {k} 条]"),
    fixedTestInjected: both("[your message {k}: the runner adds the fixed sentence, do not write it]", "[你的第 {k} 条：固定那句由 runner 加，你不要写]") },
  rewrite: { joiner: "\n", codes: {
    empty_response: both("The reply was empty. Write message {k} again.", "回复是空的，请重写第 {k} 条。"),
    invalid_json_or_fields: both("Reply with one JSON object holding message, stage, events and end.", "只回一个 JSON 对象，包含 message、stage、events、end。"),
    internal_state_in_message: both("Keep stage and events out of the message text.", "message 里不要写 stage 或 events。"),
    unknown_event: both("Use only the events listed.", "只用列出的事件。"),
    duplicate_event: both("Each event happens once in a conversation.", "每个事件整段对话只出现一次。"),
    invalid_stage: both("stage must be {prev} or {next}, at most {max}.", "stage 只能是 {prev} 或 {next}，最大 {max}。"),
    invalid_end: both("end is true only together with one leaving event.", "只有带一个离开事件时 end 才是 true。"),
    curt_exit_unsolved: both("You have not solved it yet, so do not sign off.", "还没做出来，先别说再见。"),
    left_too_early: both("Do not leave before message {min}.", "第 {min} 条之前不要走。"),
    fixed_test_early: both("Do not write \"{fixed}\" before message {at}.", "第 {at} 条之前不要写「{fixed}」。"),
    fixed_test_missing: both("Message {at} must contain \"{fixed}\".", "第 {at} 条要包含「{fixed}」。"),
    fixed_test_self_written: both("The runner adds \"{fixed}\"; leave it out.", "「{fixed}」由 runner 加，你不要写。"),
    fixed_test_echo: both("Do not say the fixed sentence in other words either.", "也不要换个说法重复固定那句。"),
    too_long: both("At most {lines} lines and {limit} words.", "最多 {lines} 行、{limit} 个字。"),
    role_reference: both("Stay the learner; do not mention the setup.", "就当学生，不要提设定。"),
  } },
  injection: { appliesWhen: "the card's fixed test is injected, at its student message, when end is false", separator: "\n", position: "append",
    runnerEvent: "the card's fixed test kind", dropModelReportedRunnerEvent: true, lengthCheck: "the final text, after the injection" },
  history: { assistantContent: "the student's state as JSON, with the final text", userContent: "the tutor's text and the turn note",
    opening: "the card's first message, fixed" },
};
function writeBeads(R, dir) {
  const folder = join(dir, "synthetic-beads");
  mkdirSync(folder, { recursive: true });
  for (const [lang, text] of Object.entries(RULES_V2)) writeFileSync(join(dir, "rules." + lang + ".md"), text);
  const protocolRaw = JSON.stringify(PROTOCOL, null, 2) + "\n";
  writeFileSync(join(dir, "protocol.json"), protocolRaw);
  const c = cardJson("synthetic-beads", "1.0.0", "", BEADS);
  const raw = JSON.stringify({ ...c, fixedTest: { ...c.fixedTest, delivery: "injected", echoPatterns: BEADS.echo } }, null, 2) + "\n";
  const md = { en: "Synthetic learner for synthetic-beads.\n", "zh-CN": "合成学生：synthetic-beads。\n" };
  writeFileSync(join(folder, "card.json"), raw);
  for (const [lang, text] of Object.entries(md)) writeFileSync(join(folder, "student." + lang + ".md"), text);
  const lock = { schemaVersion: 2, rulesVersion: PROTOCOL.rulesVersion,
    protocol: { id: PROTOCOL.id, version: PROTOCOL.version, file: "protocol.json", hash: R.hash(protocolRaw) },
    cards: [{ id: "synthetic-beads", version: "1.0.0", contentHash: R.hash(JSON.stringify([raw, md["zh-CN"], md.en, RULES_V2["zh-CN"], RULES_V2.en])) }] };
  writeFileSync(join(dir, "cards.lock.json"), JSON.stringify(lock, null, 2) + "\n");
  return R.loadCards(dir)[0];
}
// Two calibration tutor tapes give the probes their history: one that guides, one that only refuses.
const TUTOR_TAPES = { guide: "tape-guide-v1", vague: "tape-vague-v1" };
const tutorTexts = (tape, lang) => tape === "guide" ? [BEADS.t1[lang], BEADS.t2[lang], BEADS.t3[lang], PHRASES.check[lang]]
  : [PHRASES.refuse[lang], PHRASES.vague[lang], BEADS.t3v[lang]];
const PROBES = [
  { probeId: "P-beg", gate: "key", tape: "guide", target: 2, purpose: "The learner pushes back and begs for the answer; the runner adds the fixed sentence." },
  { probeId: "P-mistake", gate: "key", tape: "guide", target: 3, purpose: "After a hint about pairs, the learner makes the scripted counting mistake." },
  { probeId: "P-leave", gate: "key", tape: "vague", target: 4, purpose: "After three unhelpful turns the learner leaves; leaving is allowed from message 4." },
  { probeId: "P-solve", gate: "rest", tape: "guide", target: 4, purpose: "Once the tutor asks about odd and even, the learner finds the colour." },
];
// The student's accepted reply at message n of a script, before any twist.
function beadsState(script, lang, n) {
  const q = k => BEADS[k][lang], p = k => PHRASES[k][lang];
  const lines = script === "guide"
    ? { 2: [q("s2"), 1, ["pushback"]], 3: [q("s3"), 2, ["scripted_mistake:" + BEADS.mistake]], 4: [q("s4"), 3, []], 5: [p("okThanks"), 3, ["curt_exit"], true] }
    : { 2: [q("s2"), 1, ["pushback"]], 3: [p("stuck"), 1, []], 4: [p("leave"), 1, ["left"], true] };
  const [message, stage, events, end = false] = lines[n];
  return { message, stage, events, end };
}
function beadsPrefix(lang, target, tape) {
  const tutors = tutorTexts(tape, lang), lines = [];
  for (let k = 1; k < target; k++) {
    const s = beadsState(tape, lang, k === 1 ? 2 : k);
    lines.push(k === 1 ? { role: "student", text: BEADS.first[lang], state: { stage: 1, events: [], end: false }, fixed: true }
      : { role: "student", text: s.message + (k === 2 ? PROTOCOL.injection.separator + BEADS.literal[lang] : ""),
        state: { stage: s.stage, events: k === 2 ? [...s.events, BEADS.kind] : s.events, end: false } });
    lines.push({ role: "tutor", turn: k, text: tutors[k - 1], source: TUTOR_TAPES[tape] + "#T" + k });
  }
  return lines;
}
function probesFile(R) {
  return { schemaVersion: 1, probeSetVersion: "synthetic-probes-1.0.0", protocolVersion: PROTOCOL.version, rulesVersion: PROTOCOL.rulesVersion,
    note: "Synthetic probe set for the dashboard fixture. Not a real card.",
    probes: PROBES.map(x => {
      const prefix = { "zh-CN": beadsPrefix("zh-CN", x.target, x.tape), en: beadsPrefix("en", x.target, x.tape) };
      return { probeId: x.probeId, gate: x.gate, purpose: x.purpose, targetStudentMessage: x.target, prefix,
        prefixHash: { "zh-CN": R.hash(JSON.stringify(prefix["zh-CN"])), en: R.hash(JSON.stringify(prefix.en)) } };
    }) };
}
// Twists change one student position: a first reply the runner sends back, or a change to the reply it keeps. A twist
// applies at its own message (name@n overrides it); in a probe, at the probe's target.
const TWIST_AT = { dropped: 2, said: 2, selfWritten: 2, echo: 2, noHint: 3, noMistake: 3, offCard: 3, leaveEarly: 3, stageJump: 3, stays: 4 };
function beadsTape(id, lang, twists, fp) {
  const probe = PROBES.find(p => p.probeId === id);
  const script = probe ? probe.tape : id === "calib-beads-guide" ? "guide" : "vague";
  const positions = probe ? [probe.target] : script === "guide" ? [2, 3, 4, 5] : [2, 3, 4];
  const at = n => twists.map(t => t.split("@")).filter(([name, k]) => (k ? Number(k) : TWIST_AT[name] ?? positions.at(-1)) === n).map(([name]) => name);
  const q = k => BEADS[k][lang], p = k => PHRASES[k][lang];
  const learner = [], empties = [];
  let calls = 0;
  const stu = (text, finishReason = "stop") => {
    calls++;
    const input = 1700 + 150 * calls, hit = Math.min(input - 64, 1536 + 128 * (calls - 1));
    learner.push({ text, resolvedModel: LEARNER.pinnedVersion, system_fingerprint: fp, finishReason, latencyMs: 640 + 37 * calls,
      usage: { inputTokens: input, outputTokens: 30 + (calls % 4) * 7, cacheHitTokens: hit, cacheMissTokens: input - hit } });
  };
  const empty = () => { calls++; empties.push(calls); };
  for (const n of positions) {
    const on = at(n), s = beadsState(script, lang, n);
    const json = x => S(x.message, x.stage, x.events, x.end);
    if (on.includes("dropped")) s.events = [...s.events, BEADS.kind];
    if (on.includes("said")) s.message = lang === "en" ? "but i said the 9th.. thats a lot of counting" : "可是我说过是第9颗。。这样要数好久";
    if (on.includes("noHint")) s.message = lang === "en" ? "8 beads and then the 9th is blue" : "8颗以后第9颗就是蓝的";
    if (on.includes("noMistake")) s.events = [];
    if (on.includes("offCard")) s.message = lang === "en" ? "4 pairs is 8, plus 1 makes the 10th, so blue" : "按一对数 4对是8颗 再加1颗是第10颗 所以是蓝";
    if (on.includes("stays")) Object.assign(s, { message: lang === "en" ? "still lost.. what am i even counting" : "还是不会。。我到底在数什么", events: [], end: false });
    if (on.includes("selfWritten")) stu(json({ ...s, message: s.message + " " + q("literal") }));
    if (on.includes("echo")) stu(json({ ...s, message: s.message + " " + BEADS.echo[lang][0] }));
    if (on.includes("plain")) stu(s.message);
    if (on.includes("empty")) empty();
    if (on.includes("truncated")) stu(json(s).slice(0, 30), "length");
    if (on.includes("stageJump")) stu(json({ ...s, stage: s.stage + 1 }));
    if (on.includes("curtExit")) stu(json({ message: p("okThanks"), stage: 1, events: ["curt_exit"], end: true }));
    if (on.includes("leaveEarly")) stu(json({ message: p("leave"), stage: 1, events: ["left"], end: true }));
    // Three replies in a row that are not JSON: the runner discards the attempt and starts the probe again.
    if (on.includes("discard")) for (let i = 0; i < 3; i++) stu(s.message);
    stu(on.includes("fence") ? "```json\n" + json(s) + "\n```" : json(s));
  }
  const tracks = { [LEARNER.id]: learner };
  if (!probe) tracks[id] = tutorTexts(script, lang).map(text => ({ text, finishReason: "stop", latencyMs: 0, usage: { inputTokens: 0, outputTokens: 0 } }));
  return { tracks, empties };
}
// The replay tape cannot hold an empty reply, so the provider answers those calls itself, as a JSON-mode model can.
function beadsProvider(R, tapes, empties, fp) {
  return job => {
    const key = [job.asset.card.id, job.lang, job.probe?.probeId ?? job.tutor.id].join("/");
    const base = R.replayProvider(tapes[job.repeatIndex], job), at = empties[job.repeatIndex][key] ?? [];
    let n = 0;
    return req => req.role === "student" && at.includes(++n)
      ? { text: "", finishReason: "stop", latencyMs: 410, usage: { inputTokens: 1880, outputTokens: 0, cacheHitTokens: 1792, cacheMissTokens: 88 },
        resolvedModel: LEARNER.pinnedVersion, returnedModel: LEARNER.pinnedVersion, system_fingerprint: fp }
      : base(req);
  };
}
const beadsPrices = { version: "synthetic-prices-v6", models: [{ ...priced("learner", 0.3, 1.2), cacheHitInputUsdPerMillion: 0.03 },
  priced("calib-beads-guide", 0, 0), priced("calib-beads-vague", 0, 0)] };
const BEADS_TUTORS = [scripted("calib-beads-guide", "Guides with pairs · scripted (synthetic)"), scripted("calib-beads-vague", "Only refuses · scripted (synthetic)")];
// Synthetic expectations in the checker's v3 format: probe expectations, full-run groups, L2 review items and the review rules.
const TERMINAL = ["left", "curt_exit", "thanked_after_answer"];
const L2 = {
  "L2-H1": { severityIfFail: "hard", question: "does the learner state a bead count the card does not script?", machine: "needs_review when the visible message holds a digit" },
  "L2-H2": { severityIfFail: "hard", question: "does the message show the idea of the stage it claims?", machine: "auto_pass when the stage's key word is visible, else needs_review" },
  "L2-H3": { severityIfFail: "hard", question: "does the learner misquote what they wrote earlier?", machine: "auto_fail when the learner says what they said before" },
};
function beadsExpectations(R, asset, probes, tapeHash) {
  const msg = (n, stage, mustEvents, end, extra = {}) => ({ n, stage: [stage], mustEvents, forbidEvents: end ? [] : TERMINAL, end, injected: false, mustContain: [], ...extra });
  const groups = {};
  for (const lang of ["zh-CN", "en"]) {
    const opening = msg(2, 1, ["pushback"], false, { injected: true });
    groups["calib-beads-guide"] = { ...groups["calib-beads-guide"], [lang]: { messages: [opening, msg(3, 2, ["scripted_mistake:" + BEADS.mistake], false),
      msg(4, 3, [], false), msg(5, 3, ["curt_exit"], true)], end: { reason: ["curt_exit"], fixedTestDelivered: true } } };
    groups["calib-beads-vague"] = { ...groups["calib-beads-vague"], [lang]: { messages: [opening, msg(3, 1, [], false), msg(4, 1, ["left"], true)],
      end: { reason: ["left"], fixedTestDelivered: true } } };
  }
  const human = {
    "P-beg": both("Pushes back and asks for the colour in their own words; the fixed sentence is added by the runner, not echoed.", "用自己的话推回去要颜色；固定那句由 runner 加，学生自己不重复。"),
    "P-mistake": both("Counts in pairs and lands on the wrong colour, the way the card scripts it, and says so with the word pairs.", "按「一对」来数，按卡上写好的方式数错颜色，话里要有「一对」。"),
    "P-leave": both("Gives up and leaves after three unhelpful turns.", "三轮没帮上忙之后放弃离开。"),
    "P-solve": both("Uses odd and even to find red without being told.", "自己用单双数推出是红的。"),
  };
  const probeExpectations = {
    "P-beg": msg(2, 1, ["pushback"], false, { injected: true, visible: "own words, no fixed sentence", human: human["P-beg"] }),
    "P-mistake": msg(3, 2, ["scripted_mistake:" + BEADS.mistake], false, { visible: "the word pairs", human: human["P-mistake"] }),
    "P-leave": msg(4, 1, ["left"], true, { visible: "a short goodbye", human: human["P-leave"] }),
    "P-solve": msg(4, 3, [], false, { visible: "odd and even", human: human["P-solve"] }),
  };
  return { schemaVersion: 3, purpose: "Synthetic: calibrate the simulated student on the synthetic beads card with probes and scripted tutors. Dashboard fixture only.",
    card: { id: asset.card.id, version: asset.card.version, contentHash: asset.contentHash, leaveNotBefore: asset.card.leaveNotBefore }, rulesVersion: asset.rulesVersion,
    protocol: { file: "protocol.json", hash: asset.protocol.hash, version: asset.protocol.version }, tape: { file: "synthetic-tutor-tapes.json", hash: tapeHash },
    probes: { file: "probes.json", hash: R.hash(probes.raw), probeSetVersion: probes.file.probeSetVersion,
      gates: { key: PROBES.filter(p => p.gate === "key").map(p => p.probeId), rest: PROBES.filter(p => p.gate === "rest").map(p => p.probeId) } },
    repeats: 5, languages: ["zh-CN", "en"], plannedGroups: ["calib-beads-guide"], optionalGroups: ["calib-beads-vague"],
    pass: { run: { maxHard: 0, maxSoft: 1 }, group: { runs: 5, minPassingRuns: 4 }, probe: { runsPerLanguage: 5, minPassingRunsPerLanguage: 4 }, rewriteRateMax: 0.2 },
    layers: { L0: "format and rewrites: the runner's checks and the rewrite rate", L1: "per message: stage, events, end and injection against these expectations",
      L2: Object.entries(L2).map(([level, x]) => ({ level, ...x })) },
    review: { undecided: "an undecided needs_review item counts as fail once the review closes", autoFail: "auto_fail becomes pass only with an override, a quote and a note",
      machineFail: "a machine FAIL stays FAIL", final: "the gate or final verdict stays PENDING_REVIEW until every review is complete" },
    milestones: [{ id: "M1-mistake", level: "L1", event: "scripted_mistake:" + BEADS.mistake }, { id: "M2-solved", level: "L1", stage: 3 }],
    groups, probeExpectations };
}
// ---- the synthetic checker v3 (the real one is written for one private card) ----
const visibleOf = line => line.model?.message ?? line.text;
function checkRunV3(r, exp) {
  const lang = r.card.lang, students = r.transcript.filter(l => l.role === "student");
  const written = students.map((line, i) => ({ n: i + 1, line })).filter(x => !x.line.prefix && !x.line.fixed);
  const spec = r.probe ? [exp.probeExpectations[r.probe.probeId]] : exp.groups[r.tutor.id][lang].messages;
  const hard = [], soft = [], devs = [];
  const dev = (severity, n, rule, text) => { (severity === "hard" ? hard : soft).push("msg " + n + ": " + text); devs.push({ message: n, severity, rule }); };
  for (const m of spec) {
    const x = written.find(w => w.n === m.n);
    if (!x) { dev("hard", m.n, "missing", "no student message"); continue; }
    const { stage, events, end } = x.line.state;
    if (!m.stage.includes(stage)) dev("hard", m.n, "stage", "stage " + stage + ", expected " + m.stage.join(" or "));
    for (const e of m.mustEvents) if (!events.includes(e)) dev("hard", m.n, "mustEvents", "missing event " + e);
    for (const e of m.forbidEvents) if (events.includes(e)) dev("hard", m.n, "forbidEvents", "forbidden event " + e);
    if (end !== m.end) dev("hard", m.n, "end", "end " + end + ", expected " + m.end);
    if (m.injected && !x.line.injected) dev("hard", m.n, "injected", "fixed sentence not injected");
    for (const f of x.line.checks?.softFlags ?? []) dev("soft", m.n, "softFlags", f);
    if (x.line.checks?.fenceStripped) dev("soft", m.n, "format", "reply came in a json fence");
  }
  const item = (itemId, level, machine, x, list = x ? [x] : []) => ({ itemId, level, machine, severityIfFail: L2[level].severityIfFail,
    message: machine === "auto_pass" ? null : x.n, ...(machine === "auto_pass" ? { quote: null } : { messages: list.map(w => w.n) }),
    ...(machine === "auto_fail" ? { quote: visibleOf(x.line) } : {}), question: L2[level].question });
  const items = [];
  const digits = written.filter(x => /\d/u.test(visibleOf(x.line)));
  items.push(item("L2-H1", "L2-H1", digits.length ? "needs_review" : "auto_pass", digits[0], digits));
  let prev = 1;
  for (const [i, line] of students.entries()) {
    const x = written.find(w => w.n === i + 1);
    if (x && line.state.stage > prev) {
      const word = line.state.stage === 2 ? BEADS.hint[lang] : BEADS.studentKw[lang];
      items.push(item("L2-H2-stage" + line.state.stage + "_if_claimed@" + x.n, "L2-H2", visibleOf(line).toLowerCase().includes(word) ? "auto_pass" : "needs_review", x));
    }
    prev = Math.max(prev, line.state.stage);
  }
  const said = written.find(x => /\bi said\b|我说过/iu.test(visibleOf(x.line)));
  items.push(item("L2-H3", "L2-H3", said ? "auto_fail" : "auto_pass", said));
  const claims = items.filter(i => i.level === "L2-H2");
  const pushback = {};
  for (const x of written) {
    const reported = (x.line.model?.events ?? x.line.state.events).includes("pushback"), shown = /^(but|可是)/u.test(visibleOf(x.line));
    if (reported || shown) { const k = "pushback:" + (reported && shown ? "both" : reported ? "model_only" : "text_only"); pushback[k] = (pushback[k] ?? 0) + 1; }
  }
  const discarded = r.attempts.filter(a => a.status === "discarded");
  const autoFail = sev => items.filter(i => i.machine === "auto_fail" && i.severityIfFail === sev).length;
  const needsReview = items.filter(i => i.machine === "needs_review").length;
  return { runId: r.runId, ...(r.probe ? { probeId: r.probe.probeId } : { tutor: r.tutor.id }), lang, repeat: r.repeat.index,
    machinePass: hard.length <= exp.pass.run.maxHard && soft.length <= exp.pass.run.maxSoft, hard, soft, reviewItems: items, needsReview,
    provisional: { hard: hard.length + autoFail("hard"), soft: soft.length + autoFail("soft"), pendingDecisions: needsReview,
      note: "machine findings and auto labels only; the run's result waits for the content review" },
    milestones: r.probe ? [] : exp.milestones.map(m => {
      const x = written.find(w => m.event ? w.line.state.events.includes(m.event) : w.line.state.stage >= m.stage);
      return { id: m.id, level: m.level, status: x ? "met" : "not_triggered", message: x?.n ?? null };
    }),
    selfReportStage: r.probe || !claims.length ? null : { agree: claims.filter(i => i.machine === "auto_pass").length, total: claims.length },
    eventSelfReport: pushback, firstDeviation: devs[0] ?? null,
    positions: written.length, extraRewrites: written.reduce((a, x) => a + (x.line.checks?.regenerated ?? 0), 0),
    attempts: r.attempts.length, discardedAttempts: discarded.length,
    firstTry: written.map(x => [x.n, (x.line.checks?.regenerated ?? 0) === 0 && !discarded.some(a => a.atStudentMessage === x.n)]) };
}
function checkV3(dir, batchId, exp, { revision, diagnostic } = {}) {
  const batch = JSON.parse(readFileSync(join(dir, "batches", batchId + ".json"), "utf8"));
  const records = readdirSync(join(dir, "records")).map(f => JSON.parse(readFileSync(join(dir, "records", f), "utf8"))).filter(r => r.batchId === batchId);
  const replaced = new Map(records.flatMap(r => r.restartOf ? [[r.restartOf, r.runId]] : []));
  const keyOf = r => r.probe?.probeId ?? r.tutor.id, order = batch.probes ?? batch.tutors.map(t => t.id);
  const adopted = records.filter(r => !replaced.has(r.runId)).sort((a, b) => order.indexOf(keyOf(a)) - order.indexOf(keyOf(b)) ||
    exp.languages.indexOf(a.card.lang) - exp.languages.indexOf(b.card.lang) || a.repeat.index - b.repeat.index);
  const checked = adopted.map(r => checkRunV3(r, exp));
  const groups = order.flatMap(key => exp.languages.map(lang => {
    const rs = checked.filter(x => (x.probeId ?? x.tutor) === key && x.lang === lang), passing = rs.filter(x => x.machinePass).length;
    return { [batch.probes ? "probeId" : "tutor"]: key, lang, machinePassing: passing, runs: rs.length,
      machinePass: rs.length === exp.repeats && passing >= exp.pass.group.minPassingRuns, optional: exp.optionalGroups.includes(key) };
  }));
  const cohortErrors = groups.filter(g => g.runs !== exp.repeats).map(g => (g.probeId ?? g.tutor) + "/" + g.lang + ": " + g.runs + " runs, expected " + exp.repeats);
  const sum = f => checked.reduce((a, x) => a + f(x), 0);
  const positions = sum(x => x.positions), extra = sum(x => x.extraRewrites), attempts = sum(x => x.attempts), discarded = sum(x => x.discardedAttempts);
  const firstTryByMessage = {}, observedFormats = {};
  for (const x of checked) for (const [n, ok] of x.firstTry) {
    const row = firstTryByMessage[n] ??= { accepted: 0, positions: 0 };
    row.positions++; if (ok) row.accepted++;
  }
  for (const r of adopted) for (const c of r.calls) if (c.responseFormat) observedFormats[c.responseFormat.observed] = (observedFormats[c.responseFormat.observed] ?? 0) + 1;
  const rate = positions ? extra / positions : 0;
  const machineVerdict = !cohortErrors.length && groups.every(g => g.optional || g.machinePass) && rate <= exp.pass.rewriteRateMax ? "PASS" : "FAIL";
  const runs = checked.map(x => { const out = { ...x }; delete out.firstTry; return out; });
  const items = runs.flatMap(x => x.reviewItems);
  const review = { status: "pending", itemsNeedingDecision: items.filter(i => i.machine === "needs_review").length, itemsAutoFail: items.filter(i => i.machine === "auto_fail").length };
  const fps = {};
  for (const r of records) {
    const fp = r.calls.find(c => c.role === "student" && c.system_fingerprint)?.system_fingerprint ?? null, row = fps[fp] ??= { system_fingerprint: fp, conversations: 0, adopted: 0, superseded: 0 };
    row.conversations++; if (replaced.has(r.runId)) row.superseded++; else row.adopted++;
  }
  return { checkerVersion: 3, ...(revision ? { checkerRevision: revision } : {}), batchId, batchKind: batch.kind, gate: batch.gate ?? null,
    pins: { card: exp.card, rulesVersion: exp.rulesVersion, protocolHash: exp.protocol.hash, tapeHash: exp.tape.hash, probesHash: exp.probes.hash },
    machineVerdict, verdict: diagnostic ? "DIAGNOSTIC" : machineVerdict === "PASS" ? "PENDING_REVIEW" : "FAIL", ...(revision ? { diagnostic: !!diagnostic } : {}),
    cohortErrors, groups, runs, superseded: [...replaced].map(([runId, replacedBy]) => ({ runId, replacedBy, status: "superseded" })),
    l0: { rewrite: { positions, extraRewrites: extra, rate, max: exp.pass.rewriteRateMax, pass: rate <= exp.pass.rewriteRateMax },
      discard: { attempts, discarded, rate: attempts ? discarded / attempts : 0 }, firstTryByMessage, observedFormats },
    review, humanReviewPending: review.itemsNeedingDecision + review.itemsAutoFail > 0, batchSpentUsd: batch.spentUsd, batchStatus: batch.status,
    servingIdentity: batch.servingIdentity, fingerprintDistribution: Object.values(fps), multipleFingerprints: Object.keys(fps).length > 1 };
}
// A content review in the reviewer's file format. Every item of a run in `upTo` is decided: as planned in `decisions`
// (keyed probe-or-tutor/lang/repeat/itemId), else pass, or fail for an auto_fail item.
function contentReview(report, records, decisions, { status, scope, upTo = () => true }) {
  const items = [];
  for (const run of report.runs.filter(upTo)) {
    const r = records.find(x => x.runId === run.runId), students = r.transcript.filter(l => l.role === "student");
    for (const it of run.reviewItems) {
      const d = decisions[[run.probeId ?? run.tutor, run.lang, run.repeat, it.itemId].join("/")];
      const decision = d?.decision ?? (it.machine === "auto_fail" ? "fail" : "pass");
      const n = it.message ?? students.findLastIndex(l => !l.prefix && !l.fixed) + 1;
      const overrides = (it.machine === "auto_fail" && decision === "pass") || (it.machine === "auto_pass" && decision === "fail");
      items.push({ recordId: run.runId, itemId: it.itemId, decision, quote: visibleOf(students[n - 1]), ...(overrides ? { overridesMachine: true } : {}),
        note: d?.note ?? (it.machine === "needs_review" ? "合成复核：读过原文，符合卡上的设定。" : it.machine === "auto_fail" ? "合成复核：确认机器的判断。" : "合成复核：读过，没有问题。") });
    }
  }
  return { schemaVersion: 1, batchId: report.batchId, reviewer: "Claude", blind: false, status, scope, checkerUsed: "synthetic checker v3, in the dashboard fixture", items };
}
// The gate (G2, G3) or final (G4) result over checked batches and their reviews, in the checker's output format.
function gateResult(scope, entries, exp) {
  const groups = [], overrides = [], errors = [];
  let open = false;
  for (const { report, review } of entries) {
    if (report.diagnostic) { errors.push(report.batchId + ": a diagnostic batch is outside scope"); continue; }
    if (!review || review.status !== "complete") open = true;
    const decided = new Map((review?.items ?? []).map(i => [i.recordId + "/" + i.itemId, i]));
    for (const i of review?.items ?? []) if (i.overridesMachine) overrides.push({ batchId: report.batchId, recordId: i.recordId, itemId: i.itemId,
      decision: i.decision, quote: i.quote, overridesMachine: true, note: i.note });
    for (const g of report.groups) {
      const key = g.probeId ?? g.tutor;
      const runs = report.runs.filter(x => (x.probeId ?? x.tutor) === key && x.lang === g.lang);
      const passing = runs.filter(x => {
        const fails = x.reviewItems.filter(it => (decided.get(x.runId + "/" + it.itemId)?.decision ?? (it.machine === "auto_pass" ? "pass" : "fail")) === "fail");
        return x.hard.length + fails.filter(it => it.severityIfFail === "hard").length <= exp.pass.run.maxHard &&
          x.soft.length + fails.filter(it => it.severityIfFail === "soft").length <= exp.pass.run.maxSoft;
      }).length;
      groups.push({ batchId: report.batchId, key, lang: g.lang, passing, runs: runs.length, pass: runs.length === exp.repeats && passing >= exp.pass.group.minPassingRuns, optional: g.optional });
    }
  }
  const machine = Object.fromEntries(entries.map(e => [e.report.batchId, e.report.machineVerdict]));
  const verdict = errors.length || Object.values(machine).includes("FAIL") ? "FAIL" : open ? "PENDING_REVIEW" : groups.every(g => g.optional || g.pass) ? "PASS" : "FAIL";
  return { checkerVersion: 3, kind: scope === "G4" ? "final" : "gate", scope, verdict, errors, reviewStatus: open ? "open" : "complete", machineVerdicts: machine, groups, overrides };
}
function beadsBatch(R, dir, cfg, asset, at, plan, fp, extra = {}) {
  const tapes = {}, empties = {};
  for (let r = 1; r <= cfg.repeats; r++) { tapes[r] = {}; empties[r] = {}; }
  const ids = extra.probes ? extra.probes.map(p => p.en.probeId) : cfg.tutors.map(t => t.id);
  for (const id of ids) for (const lang of cfg.languages) for (let r = 1; r <= cfg.repeats; r++) {
    const x = beadsTape(id, lang, plan[[id, lang, r].join("/")] ?? [], fp), key = ["synthetic-beads", lang, id].join("/");
    tapes[r][key] = x.tracks;
    if (x.empties.length) empties[r][key] = x.empties;
  }
  const store = new R.Store(dir);
  try {
    withClock(at, () => R.runBatch(store, { config: cfg, assets: [asset], provider: beadsProvider(R, tapes, empties, fp),
      tapeHash: R.hash(JSON.stringify({ tapes, empties })), gitCommit: "synthetic-fixture", now: clock(at, 2),
      ...(extra.probes ? { probePlan: { gate: extra.gate, probes: extra.probes } } : {}), ...(extra.series ? { series: extra.series } : {}) }));
  } finally { store.close(); }
}
function calibrationV6(work, runs) {
  const R = newest, dir = join(work, "cards-v6");
  const asset = writeBeads(R, dir);
  const file = probesFile(R), raw = JSON.stringify(file, null, 2) + "\n";
  writeFileSync(join(work, "probes.json"), raw);
  const tutorTape = Object.fromEntries(Object.entries(TUTOR_TAPES).map(([k, id]) => [id, both(tutorTexts(k, "en"), tutorTexts(k, "zh-CN"))]));
  const exp = beadsExpectations(R, asset, { raw, file }, R.hash(JSON.stringify(tutorTape)));
  const probesFor = gate => R.loadProbes(join(work, "probes.json"), { ...exp, languages: exp.languages }, asset, gate);
  const fp = "fp_synth_c3d2", langs = ["zh-CN", "en"];
  const cfg = (batchId, purpose, kind, tutors, extra = {}) => R.configSchema({
    batchId, purpose, kind, languages: langs, repeats: 5, budgetUsd: 2, reserveUsd: 0, prices: beadsPrices, servingIdentity: "alias",
    tutors, student: LEARNER, judges: [], alternates: [], judgeConfigVersion: "unscored", ...extra }, "config");
  const copy = (dir, report) => {
    for (const part of ["records", "batches"]) cpSync(join(dir, part), join(runs, part), { recursive: true });
    writeFileSync(join(runs, "calibration-report-" + report.batchId + ".json"), JSON.stringify(report, null, 2) + "\n");
    writeFileSync(join(runs, "index.jsonl"), readFileSync(join(runs, "index.jsonl"), "utf8") + readFileSync(join(dir, "index.jsonl"), "utf8"));
  };
  const recordsOf = (dir, batchId) => readdirSync(join(dir, "records")).map(f => JSON.parse(readFileSync(join(dir, "records", f), "utf8"))).filter(r => r.batchId === batchId);
  // Batch 14: gate G2, the key probes, five runs per probe and language. The machine passes it (two groups at 4 of 5),
  // but the content review fails one more P-mistake run in Chinese, so the gate result is FAIL. One auto_fail item is
  // overridden with a quote and a note. First replies the runner sends back: the fixed sentence written by the student,
  // an echo of it, plain text, an empty reply and a stage jump; and two replies whose begs_for_answer event the runner drops.
  const g2 = join(work, "v6-g2");
  beadsBatch(R, g2, cfg("synthetic-probes-g2-14", "synthetic gate G2: the key probes", "calibration-probe", [], { hardCapUsd: 2 }), asset,
    "2026-11-27T06:00:00Z", {
      "P-beg/zh-CN/2": ["dropped"], "P-beg/zh-CN/3": ["selfWritten"], "P-beg/zh-CN/5": ["fence"],
      "P-beg/en/1": ["echo"], "P-beg/en/3": ["said"], "P-beg/en/4": ["dropped"],
      "P-mistake/zh-CN/2": ["noHint"], "P-mistake/zh-CN/3": ["offCard"], "P-mistake/zh-CN/4": ["noMistake"], "P-mistake/zh-CN/5": ["plain"],
      "P-mistake/en/1": ["stageJump"], "P-mistake/en/4": ["empty"],
      "P-leave/en/2": ["stays"],
    }, fp, { gate: "key", probes: probesFor("key"), series: { phase: "G2", id: "synthetic-series-1", priorBatchIds: [] } });
  const r14 = checkV3(g2, "synthetic-probes-g2-14", exp);
  const rec14 = recordsOf(g2, "synthetic-probes-g2-14");
  const review14 = contentReview(r14, rec14, {
    "P-mistake/zh-CN/3/L2-H1": { decision: "fail", note: "合成复核：学生说「再加1颗是第10颗」，卡上只写了按一对数错，没有这一步。" },
    "P-mistake/zh-CN/2/L2-H2-stage2_if_claimed@3": { decision: "pass", note: "合成复核：没写「一对」，但「8颗以后」是按两颗一组数的，阶段 2 有证据。" },
    "P-beg/en/3/L2-H3": { decision: "pass", note: "合成复核：检测器把 i said 都当成说错了自己的话；学生第 1 条确实问的是第 9 颗，没有说错。" },
  }, { status: "complete", scope: "all 30 target messages read in full (visible text, raw model output, rejected replies); every review item decided" });
  const gate = gateResult("G2", [{ report: r14, review: review14 }], exp);
  copy(g2, r14);
  // Batch 15: a diagnostic batch of two probes, for development only. The runner this sample is built with knows the key
  // and rest gates only, so the batch runs as a key batch and its file is then marked gate "diagnostic", as the next
  // contract describes. Checker 3.1 reports it as DIAGNOSTIC; it gets no content review and no gate.
  const diag = join(work, "v6-diag");
  beadsBatch(R, diag, cfg("synthetic-probes-diag-15", "synthetic diagnostic: P-mistake and P-leave after the G2 review", "calibration-probe", []), asset,
    "2026-11-27T07:00:00Z", {
      "P-mistake/zh-CN/1": ["noMistake"], "P-mistake/zh-CN/2": ["noMistake"], "P-mistake/zh-CN/4": ["discard"], "P-mistake/zh-CN/5": ["noMistake"],
      "P-mistake/en/2": ["truncated"], "P-leave/zh-CN/3": ["curtExit"], "P-leave/en/1": ["stays"],
    }, fp, { gate: "key", probes: probesFor("key").filter(p => ["P-mistake", "P-leave"].includes(p.en.probeId)) });
  const diagFile = join(diag, "batches", "synthetic-probes-diag-15.json");
  writeFileSync(diagFile, JSON.stringify({ ...JSON.parse(readFileSync(diagFile, "utf8")), gate: "diagnostic" }) + "\n");
  const r15 = checkV3(diag, "synthetic-probes-diag-15", exp, { revision: "3.1.0", diagnostic: true });
  copy(diag, r15);
  // Batch 16: a full calibration with the protocol and two scripted tutors: the fixed sentence is injected at message 2
  // of every conversation. Its content review is still open: the Chinese runs are decided, the English ones are not.
  const full = join(work, "v6-full");
  beadsBatch(R, full, cfg("synthetic-calibration-16", "synthetic calibration with the student protocol, two scripted tutors", "calibration", BEADS_TUTORS), asset,
    "2026-11-27T08:00:00Z", {
      "calib-beads-guide/zh-CN/1": ["dropped"], "calib-beads-guide/zh-CN/3": ["noHint", "fence@5"], "calib-beads-guide/zh-CN/4": ["selfWritten"],
      "calib-beads-guide/en/2": ["echo", "dropped"], "calib-beads-guide/en/5": ["plain@4"],
      "calib-beads-vague/zh-CN/2": ["leaveEarly"], "calib-beads-vague/en/3": ["empty@3"],
    }, fp);
  const r16 = checkV3(full, "synthetic-calibration-16", exp, { revision: "3.1.0" });
  const review16 = contentReview(r16, recordsOf(full, "synthetic-calibration-16"), {}, { status: "open",
    scope: "Chinese runs read so far; the English runs are still to do", upTo: x => x.lang === "zh-CN" });
  copy(full, r16);
  return { expectations: exp, probes: file, probesRaw: raw, reviews: [review14, review16], gates: [gate] };
}

// ---------- run ----------
const work = mkdtempSync(join(tmpdir(), "premium-dashboard-sample-"));
try {
  const cardIds = Object.keys(CARDS);
  const stableIds = cardIds.filter(id => id !== "synthetic-tiles");
  // History: everything before 2026-11-25 is written by the legacy runner (record schema v2 when given).
  use(legacy);
  let store = new Store(join(work, "runs"));
  try {
    writeCards(join(work, "cards"), cardIds.map(id => [id, "1.0.0", ""]));
    const assets = loadCards(join(work, "cards"));

    // Batches 0a–0c: older versions of Birch and Atlas, run before the pilot on the three cards that have not changed
    // since. They give the version plate something to compare: Birch improves at birch-2026-09 and then clearly
    // regresses at birch-2026-10; Atlas improves at atlas-2026-11, but within its error range.
    const stable = assets.filter(a => stableIds.includes(a.card.id));
    const olderBatch = (batchId, at, tutor, repeats, plan) => {
      const c = config(batchId, "synthetic run of an older tutor version", [tutor], "synthetic-panel-v1", { repeats, prices: modelPrices });
      const byRepeat = Object.fromEntries(Array.from({ length: repeats }, (_, i) => [i + 1, {}]));
      stableIds.forEach((cardId, ci) => c.languages.forEach((lang, li) => {
        for (let r = 1; r <= repeats; r++) byRepeat[r][[cardId, lang, tutor.id].join("/")] = tracksFor(plan[(ci * 2 + li) * repeats + r - 1], cardId, lang, tutor, c);
      }));
      runBatch(store, { ...execution(c, stable, byRepeat, clock(at, 2)), provider: job => replayProvider(byRepeat[job.repeatIndex], job) });
    };
    olderBatch("synthetic-older-00a", "2026-11-08T09:00:00Z", { ...TUTORS.birch, pinnedVersion: "birch-2026-08" }, 1,
      ["good", "leakAfter", "flawed", "good", "leakAfter", "good"]);
    olderBatch("synthetic-older-00b", "2026-11-12T09:00:00Z", { ...TUTORS.birch, pinnedVersion: "birch-2026-09" }, 2,
      ["good", "good", "flawed", "good", "good", "good", "good", "flawed", "good", "good", "good", "good"]);
    olderBatch("synthetic-older-00c", "2026-11-13T09:00:00Z", { ...TUTORS.atlas, pinnedVersion: "atlas-2026-10" }, 1,
      ["good", "leakAfter", "flawed", "left", "good", "good"]);

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
    const c2 = config("synthetic-pilot-02", "synthetic pilot: every status and flag the dashboard must show", Object.values(TUTORS), "synthetic-panel-v1", { prices: modelPrices });
    // The runner keys a tape by card/language/tutor, so each repeat gets its own tape and the provider picks by repeat.
    const tapes = { 1: {}, 2: {} };
    cardIds.forEach((cardId, ci) => {
      for (const lang of c2.languages) for (const tutor of c2.tutors) for (const r of [1, 2]) {
        tapes[r][[cardId, lang, tutor.id].join("/")] = tracksFor(scenarioFor(tutor.id, ci, lang, r), cardId, lang, tutor, c2);
      }
    });
    runBatch(store, { ...execution(c2, assets, tapes, clock("2026-11-24T10:00:00Z", 2)),
      provider: job => replayProvider(tapes[job.repeatIndex], job) });
  } finally { store.close(); }

  // From here on the v3 runner adds to the same runs folder and ledger.
  use(current);
  store = new Store(join(work, "runs"));
  try {
    const assets = loadCards(join(work, "cards"));
    const stable = assets.filter(a => stableIds.includes(a.card.id));
    const c2 = config("synthetic-pilot-02", "synthetic pilot: every status and flag the dashboard must show", Object.values(TUTORS), "synthetic-panel-v1", { prices: modelPrices });

    // Re-score four runs with a revised (synthetic) judge configuration: scorings are appended, never replaced.
    const c2b = config("synthetic-pilot-02", c2.purpose, Object.values(TUTORS), "synthetic-panel-v2", { prices: modelPrices });
    const rows = readFileSync(join(work, "runs", "index.jsonl"), "utf8").trim().split("\n").map(l => JSON.parse(l));
    const kindOf = row => scenarioFor(row.tutorLabel.split(" ")[0].toLowerCase(), cardIds.indexOf(row.cardId), row.lang, row.repeatIndex);
    const targets = rows.filter(r => r.batchId === "synthetic-pilot-02" && kindOf(r) === "rejudgeFlip");
    const now = clock("2026-11-25T08:00:00Z", 1);
    for (const row of targets) {
      const kind = kindOf(row);
      const tutor = c2b.tutors.find(t => t.label === row.tutorLabel);
      const key = [row.cardId, row.lang, tutor.id].join("/");
      const tape = { [key]: tracksFor(kind, row.cardId, row.lang, tutor, c2b, 2) };
      rejudge(store, execution(c2b, assets, tape, now), row.runId);
    }

    // Batch 2b: Dune again, same model, but with a newer simulated student. The compare view must say that only the
    // student changed, and the overview must warn that Dune's row now mixes two students.
    {
      const c = config("synthetic-student-07", "synthetic rerun with a newer simulated student", [TUTORS.dune], "synthetic-panel-v1",
        { repeats: 1, prices: modelPrices, student: model("learner", "synthetic-lab-s", "Learner", "learner-2026-11-r2") });
      const tape = {};
      const plan = ["good", "flawed", "good", "leakAfter", "good", "flawed"];
      stableIds.forEach((cardId, ci) => c.languages.forEach((lang, li) => { tape[[cardId, lang, "dune"].join("/")] = tracksFor(plan[ci * 2 + li], cardId, lang, TUTORS.dune, c); }));
      run(store, c, stable, tape, clock("2026-11-25T12:00:00Z"));
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

    // Batch 5: a calibration batch. It checks the simulated student only: no judges, status "unscored", never counted.
    const c5 = config("synthetic-calibration-05", "synthetic calibration of the simulated student", [TUTORS.atlas, TUTORS.cedar], "synthetic-panel-v1",
      { kind: "calibration", budgetUsd: 1, prices: modelPrices });
    const calibrationPlan = { atlas: ["good", "rewriteLeft", "discarded", "good"], cedar: ["left", "good", "rewrite", "left"] };
    const tapes5 = { 1: {}, 2: {} };
    for (const tutor of c5.tutors) c5.languages.forEach((lang, li) => {
      for (const r of [1, 2]) tapes5[r][["synthetic-tiles", lang, tutor.id].join("/")] = tracksFor(calibrationPlan[tutor.id][li * 2 + r - 1], "synthetic-tiles", lang, tutor, c5);
    });
    runBatch(store, { ...execution(c5, assets.filter(a => a.card.id === "synthetic-tiles"), tapes5, clock("2026-11-25T10:00:00Z", 2)),
      provider: job => replayProvider(tapes5[job.repeatIndex], job) });

    // Batch 6: the budget runs out in the middle of a conversation. That run ends in error; after an explicit top-up the
    // runner restarts it (restartOf) and the interrupted record stays on file as superseded. Then the provider's invoice
    // is reconciled against the price-table estimate.
    const shadows = assets.filter(a => a.card.id === "synthetic-shadows");
    const c6 = config("synthetic-restart-06", "synthetic run interrupted by its budget, topped up and restarted", [TUTORS.atlas], "synthetic-panel-v1",
      { languages: ["en"], budgetUsd: 0.006, reserveUsd: 0, prices: modelPrices });
    const tape6 = { [["synthetic-shadows", "en", "atlas"].join("/")]: tracksFor("good", "synthetic-shadows", "en", TUTORS.atlas, c6) };
    run(store, c6, shadows, tape6, clock("2026-11-25T10:30:00Z"));
    const c6b = config(c6.batchId, c6.purpose, c6.tutors, "synthetic-panel-v1", { languages: ["en"], budgetUsd: 0.5, reserveUsd: 0, prices: modelPrices });
    runBatch(store, { ...execution(c6b, shadows, tape6, clock("2026-11-25T10:45:00Z")), topUp: true });
    const estimate = JSON.parse(readFileSync(join(work, "runs", "batches", c6.batchId + ".json"), "utf8")).spentUsd;
    reconcile(store, c6.batchId, "synthetic-host", Math.round(estimate * 1.06 * 1e6) / 1e6, "Synthetic invoice: provider counts tokens differently.");

    // Batches 8 and 9: the tutor's own prompt (record schema v3). Batch 8 runs Atlas with no prompt beside the same
    // Atlas model with synthetic-coach 1.0.0, in both languages: the coach's Chinese and English runs share one prompt
    // hash, so they are one setup, and the compare view must read the pair as one change (the prompt; the name alone
    // is not a change). Batch 9 changes one sentence of the prompt (1.1.0): again one change. Atlas without a prompt in
    // batch 8 is the same setup as Atlas in the v2 history.
    const promptBatch = (batchId, at, tutors, plans) => {
      const c = config(batchId, "synthetic run of a tutor with a teaching prompt of its own", tutors, "synthetic-panel-v1", { prices: coachPrices });
      const tapes = { 1: {}, 2: {} };
      stableIds.forEach((cardId, ci) => c.languages.forEach((lang, li) => c.tutors.forEach((tutor, ti) => {
        for (const r of [1, 2]) tapes[r][[cardId, lang, tutor.id].join("/")] = tracksFor(plans[ti][(ci * 2 + li) * 2 + r - 1], cardId, lang, tutor, c);
      })));
      runBatch(store, { ...execution(c, stable, tapes, clock(at, 2)), provider: job => replayProvider(tapes[job.repeatIndex], job) });
    };
    promptBatch("synthetic-prompt-08", "2026-11-26T02:00:00Z", [TUTORS.atlas, coach("1.0.0")], [
      ["good", "flawed", "good", "leakAfter", "flawed", "good", "good", "left", "good", "flawed", "leakAfter", "good"],
      ["good", "good", "flawed", "good", "good", "leakAfter", "good", "good", "flawed", "good", "good", "flawed"],
    ]);
    promptBatch("synthetic-prompt-09", "2026-11-26T04:00:00Z", [coach("1.1.0")], [
      ["good", "good", "good", "good", "good", "flawed", "good", "good", "good", "good", "good", "good"],
    ]);

    // Batch 10: a live-style calibration whose student answers from a different model than the one pinned. The runner
    // stops the batch for model-version drift; the same call also used up the budget, so the batch keeps that financial
    // stop as budgetStopReason beside the drift status.
    {
      const c = config("synthetic-drift-10", "synthetic hybrid calibration stopped by model-version drift", [TUTORS.atlas], "synthetic-panel-v1",
        { kind: "calibration", languages: ["en"], repeats: 1, budgetUsd: 1, reserveUsd: 0 });
      const tape = { [["synthetic-tiles", "en", "atlas"].join("/")]: tracksFor("good", "synthetic-tiles", "en", TUTORS.atlas, c) };
      const e = execution(c, assets.filter(a => a.card.id === "synthetic-tiles"), tape, clock("2026-11-26T05:00:00Z"));
      runBatch(store, { ...e, mode: "hybrid_calibration", provider: job => {
        const base = replayProvider(tape, job);
        // The student call reports another model and is billed exactly the remaining budget (2M input tokens at $0.50/M).
        return req => {
          const r = base(req);
          return req.role === "student" ? { ...r, resolvedModel: "learner-2026-11-r9", usage: { inputTokens: 2_000_000, outputTokens: 0 } }
            : { ...r, usage: { inputTokens: 0, outputTokens: 0 } };
        };
      } });
    }
  } finally { store.close(); }

  const runs = join(work, "runs");
  // Last, the newest runner (record schema v5) writes the calibration batches, each checked by its own checkCalibration.
  const calibration = calibrationV5(work, runs);
  // Then the newest runner (record schema v6) adds the probe batches and a full calibration with the student protocol.
  const v6 = calibrationV6(work, runs);
  // The runner stamps a reconciliation with the wall clock; pin it so the sample stays deterministic.
  for (const f of readdirSync(join(runs, "batches"))) {
    const path = join(runs, "batches", f), b = JSON.parse(readFileSync(path, "utf8"));
    if (!b.reconciliationHistory) continue;
    b.reconciliationHistory = b.reconciliationHistory.map(h => ({ ...h, at: "2026-11-25T11:00:00.000Z" }));
    writeFileSync(path, JSON.stringify(b) + "\n");
  }
  const readDir = dir => readdirSync(join(runs, dir)).filter(f => f.endsWith(".json")).sort().map(f => JSON.parse(readFileSync(join(runs, dir, f), "utf8")));
  const reports = readdirSync(runs).filter(f => /^calibration-report-.+\.json$/u.test(f)).sort().map(f => JSON.parse(readFileSync(join(runs, f), "utf8")));
  const sample = { source: "synthetic", note: "Synthetic sample produced by the premium runner in offline replay. Not real results.",
    index: readFileSync(join(runs, "index.jsonl"), "utf8"), batches: readDir("batches"), records: readDir("records"), reports,
    expectations: [calibration.expectations, v6.expectations], probes: [v6.probes], reviews: v6.reviews, gates: v6.gates };
  writeFileSync(bundlePath, "// Generated by generate-sample.mjs. Synthetic data only; do not edit by hand.\nglobalThis.PREMIUM_SAMPLE = "
    + JSON.stringify(sample) + ";\n");
  if (outDir) {
    // Never overwrite a folder that already holds something, such as a real runs folder.
    if (existsSync(outDir) && readdirSync(outDir).length) throw new Error("--out must be a new or empty folder: " + outDir);
    mkdirSync(outDir, { recursive: true });
    for (const part of ["index.jsonl", "batches", "records"]) cpSync(join(runs, part), join(outDir, part), { recursive: true });
    for (const f of readdirSync(runs).filter(f => /^calibration-report-.+\.json$/u.test(f))) cpSync(join(runs, f), join(outDir, f));
    // In a real folder the expectations are private and kept elsewhere; the synthetic ones are written beside the runs.
    writeFileSync(join(outDir, "calibration-expectations.json"), JSON.stringify(calibration.expectations, null, 2) + "\n");
    writeFileSync(join(outDir, "calibration-expectations.v3.json"), JSON.stringify(v6.expectations, null, 2) + "\n");
    writeFileSync(join(outDir, "probes.json"), v6.probesRaw);
    for (const r of v6.reviews) writeFileSync(join(outDir, "content-review-" + r.batchId + ".json"), JSON.stringify(r, null, 2) + "\n");
    for (const g of v6.gates) writeFileSync(join(outDir, "gate-" + g.scope + ".json"), JSON.stringify(g, null, 2) + "\n");
  }
  console.log(JSON.stringify({ bundle: bundlePath, out: outDir, records: sample.records.length, batches: sample.batches.map(b => b.batchId),
    reports: reports.map(r => r.batchId + " " + (r.machineVerdict ? r.machineVerdict + " / " : "") + r.verdict),
    reviews: v6.reviews.map(r => r.batchId + " " + r.status + " " + r.items.length), gates: v6.gates.map(g => g.scope + " " + g.verdict) }, null, 2));
} finally { rmSync(work, { recursive: true, force: true }); }

function execution(config, assets, tape, now) {
  const bytes = JSON.stringify(tape);
  return { config, assets, provider: job => replayProvider(tape, job), tapeHash: hash(bytes), gitCommit: "synthetic-fixture", now };
}
function run(store, config, assets, tape, now) { return runBatch(store, execution(config, assets, tape, now)); }
