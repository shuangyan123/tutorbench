import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { parseTutorbenchArgs } from "../src/cli/tutorbench.js";
import { compareTutorHealthRuns, parseTutorHealthComparison, runTutorHealthEvaluation, type TutorHealthComparisonInput } from "../src/index.js";
import { syntheticDesignPartnerPilot } from "./helpers/design-partner-pilot.js";

function cli(args: readonly string[]) {
  return spawnSync(process.execPath, [resolve("dist/src/cli/tutorbench.js"), "health-compare", ...args], { encoding: "utf8" });
}

test("health-compare routes help and validates required/unknown/duplicate options", () => {
  assert.deepEqual(parseTutorbenchArgs(["health-compare", "--help"]), { help: true, helpCommand: "health-compare" });
  assert.equal(cli(["--help"]).status, 0);
  assert.match(cli(["--help"]).stdout, /No Tutor or Judge calls/);
  for (const args of [[], ["--unknown"], ["--baseline"], ["--baseline="], ["--baseline", "x", "--baseline", "y"]]) {
    assert.throws(() => parseTutorbenchArgs(["health-compare", ...args]));
    assert.equal(cli(args).status, 1);
  }
});

test("health-compare writes deterministic validated JSON, preserves sources, and exits 0/1/2 honestly", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tutor-health-comparison-"));
  try {
    const { suite, baseline, candidate } = await syntheticDesignPartnerPilot();
    async function save(role: string, source: TutorHealthComparisonInput) {
      await mkdir(join(directory, role), { recursive: true });
      await writeFile(join(directory, role, "evaluation.json"), JSON.stringify(source.evaluation));
      await writeFile(join(directory, role, "health-report.json"), JSON.stringify(source.report));
    }
    await save("baseline", baseline);
    await save("candidate", candidate);
    const suitePath = join(directory, "suite.json");
    await writeFile(suitePath, JSON.stringify(suite));
    const sourcePaths = [suitePath, ...["baseline", "candidate"].flatMap((role) =>
      ["evaluation.json", "health-report.json"].map((file) => join(directory, role, file)))];
    const before = await Promise.all(sourcePaths.map((path) => readFile(path, "utf8")));
    const args = ["--baseline", join(directory, "baseline"), "--candidate", join(directory, "candidate"),
      `--baseline-suite=${suitePath}`, "--candidate-suite", suitePath];
    const output = join(directory, "comparison.json");
    const first = cli([...args, "--output", output]);
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /resolved 1, persistent 1, new 1, unresolved 0/);
    const bytes = await readFile(output, "utf8");
    assert.deepEqual(parseTutorHealthComparison(JSON.parse(bytes)), compareTutorHealthRuns({ baseline, candidate }));
    const secondOutput = join(directory, "second.json");
    assert.equal(cli([...args, `--output=${secondOutput}`]).status, 0);
    assert.equal(await readFile(secondOutput, "utf8"), bytes);
    for (const existing of [...sourcePaths, output]) {
      const attempt = cli([...args, "--output", existing]);
      assert.equal(attempt.status, 1);
      assert.match(attempt.stderr, /new writable file/);
    }
    assert.deepEqual(await Promise.all(sourcePaths.map((path) => readFile(path, "utf8"))), before);
    assert.equal(await readFile(output, "utf8"), bytes);

    await save("candidate", { ...candidate, evaluation: { ...candidate.evaluation, judge: { ...candidate.evaluation.judge!, promptVersion: "incompatible" } } });
    const rejectedOutput = join(directory, "rejected.json");
    const rejected = cli([...args, "--output", rejectedOutput]);
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /not comparable: judge_configuration/);
    await assert.rejects(access(rejectedOutput));

    const run = async (runId: string) => ({ suite, ...await runTutorHealthEvaluation({
      suite, runId, tutor: { id: "fixture", respond: async () => ({ text: "Check your work." }) },
    }) });
    await save("baseline", await run("missing-judge-baseline"));
    await save("candidate", await run("missing-judge-candidate"));
    const unresolvedOutput = join(directory, "unresolved.json");
    const unresolved = cli([...args, "--output", unresolvedOutput]);
    assert.equal(unresolved.status, 2, unresolved.stderr);
    assert.equal(parseTutorHealthComparison(JSON.parse(await readFile(unresolvedOutput, "utf8"))).counts.unresolved, 4);

    await writeFile(suitePath, '{"private-sentinel":"broken');
    const invalid = cli([...args, "--output", rejectedOutput]);
    assert.equal(invalid.status, 1);
    assert.doesNotMatch(invalid.stderr, /private-sentinel/);
    await assert.rejects(access(rejectedOutput));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
