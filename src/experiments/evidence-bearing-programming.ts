import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { TutorTurnInput, TutorTurnOutput, TutorUnderTest } from "../contracts/tutor.js";

export const EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_ID =
  "experimental-programming-test-failure-evidence-001" as const;
export const EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_VERSION = "0.1.0" as const;
export const EVIDENCE_BEARING_PROGRAMMING_EVIDENCE_SCHEMA_VERSION = 1 as const;

const FIXTURE_RELATIVE_DIRECTORY =
  "fixtures/experimental/evidence-bearing-programming" as const;
const FIXTURE_FILES = ["clamp-score.mjs", "clamp-score.test.mjs"] as const;

const EXECUTION_SPEC = {
  runtime: "node",
  runtimeRange: ">=22 <23",
  arguments: ["--test", "--test-reporter=tap", "clamp-score.test.mjs"],
  expectedExitCode: 1,
  timeoutMs: 5_000,
  maxOutputBytes: 32_768,
} as const;

const PUBLIC_CHALLENGE_SPEC = {
  id: EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_ID,
  version: EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_VERSION,
  evidenceSchemaVersion: EVIDENCE_BEARING_PROGRAMMING_EVIDENCE_SCHEMA_VERSION,
  fixtureDirectory: FIXTURE_RELATIVE_DIRECTORY,
  fixtureFiles: FIXTURE_FILES,
  execution: EXECUTION_SPEC,
  tutorVisible: {
    learningObjective:
      "Use concrete failing-test evidence to help the student choose a useful debugging step without taking over the whole task.",
    studentMessage:
      "The test failed. Using only the execution evidence above, help me identify what I should inspect first without rewriting the whole function for me.",
    studentState: {
      knownConcepts: ["assertions", "function calls"],
      misconceptions: [],
      level: "secondary",
      goal: "debug from concrete test evidence",
    },
  },
} as const;

const HIDDEN_REFERENCE = {
  diagnosis:
    "The clamp implementation reverses the min/max bounds, causing an input of 120 to return 0 instead of 100.",
} as const;

export interface EvidenceBearingProgrammingExecutionEvidence {
  readonly schemaVersion: typeof EVIDENCE_BEARING_PROGRAMMING_EVIDENCE_SCHEMA_VERSION;
  readonly status: "failed";
  readonly exitCode: 1;
  readonly testName: string;
  readonly expected: number;
  readonly actual: number;
  readonly operator: string;
  readonly errorCode: string;
  readonly normalizedOutput: string;
}

export interface EvidenceBearingProgrammingProvenance {
  readonly challengeId: typeof EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_ID;
  readonly challengeVersion: typeof EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_VERSION;
  readonly challengeSpecFingerprint: string;
  readonly fixtureFingerprint: string;
  readonly executionSpecFingerprint: string;
  readonly evidenceFingerprint: string;
  readonly bindingFingerprint: string;
  readonly runtimeVersion: string;
}

export interface EvidenceBearingProgrammingBundle {
  readonly evidence: EvidenceBearingProgrammingExecutionEvidence;
  readonly provenance: EvidenceBearingProgrammingProvenance;
}

export interface EvidenceBearingProgrammingVerification {
  readonly status: "pass" | "fail";
  readonly diagnostics: readonly string[];
}

export interface EvidenceBearingProgrammingPrototypeRun {
  readonly prototypeId: typeof EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_ID;
  readonly prototypeVersion: typeof EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_VERSION;
  readonly bundle: EvidenceBearingProgrammingBundle;
  readonly tutorInput: TutorTurnInput;
  readonly tutorOutput: TutorTurnOutput;
  readonly verification: {
    readonly evidenceIntegrity: "pass";
    readonly semanticTutoringEvaluation: "not_evaluated";
    readonly canonicalScoringApplied: false;
  };
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function hashJson(value: unknown): string {
  return sha256(JSON.stringify(value));
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readTapField(output: string, field: string): string {
  const match = output.match(new RegExp(`^\\s*${field}:\\s*(.+?)\\s*$`, "m"));
  if (match?.[1] === undefined) {
    throw new Error(`evidence_output_missing_field:${field}`);
  }
  return unquote(match[1]);
}

function readTapNumber(output: string, field: string): number {
  const raw = readTapField(output, field);
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`evidence_output_invalid_number:${field}`);
  }
  return value;
}

function assertSupportedNodeRuntime(): void {
  const majorText = process.versions.node.split(".")[0];
  const major = majorText === undefined ? Number.NaN : Number.parseInt(majorText, 10);
  if (major !== 22) {
    throw new Error(`evidence_runtime_unsupported:${process.versions.node}`);
  }
}

function challengeSpecFingerprint(): string {
  return hashJson(PUBLIC_CHALLENGE_SPEC);
}

function executionSpecFingerprint(): string {
  return hashJson(EXECUTION_SPEC);
}

function fixtureFingerprint(repositoryRoot: string): string {
  const fixtureDirectory = resolve(repositoryRoot, FIXTURE_RELATIVE_DIRECTORY);
  const hash = createHash("sha256");
  for (const fileName of FIXTURE_FILES) {
    const contents = readFileSync(join(fixtureDirectory, fileName));
    hash.update(fileName);
    hash.update("\0");
    hash.update(contents);
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

function fingerprintEvidence(
  evidence: EvidenceBearingProgrammingExecutionEvidence,
): string {
  return hashJson({
    schemaVersion: evidence.schemaVersion,
    status: evidence.status,
    exitCode: evidence.exitCode,
    testName: evidence.testName,
    expected: evidence.expected,
    actual: evidence.actual,
    operator: evidence.operator,
    errorCode: evidence.errorCode,
    normalizedOutput: evidence.normalizedOutput,
  });
}

function bindingFingerprint(input: {
  readonly challengeSpecFingerprint: string;
  readonly fixtureFingerprint: string;
  readonly executionSpecFingerprint: string;
  readonly evidenceFingerprint: string;
}): string {
  return hashJson({
    challengeId: EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_ID,
    challengeVersion: EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_VERSION,
    ...input,
  });
}

function parseExecutionEvidence(stdout: string): EvidenceBearingProgrammingExecutionEvidence {
  const testNameMatch = stdout.match(/^# Subtest: (.+)$/m);
  if (testNameMatch?.[1] === undefined) {
    throw new Error("evidence_output_missing_field:testName");
  }

  const testName = testNameMatch[1].trim();
  const expected = readTapNumber(stdout, "expected");
  const actual = readTapNumber(stdout, "actual");
  const operator = readTapField(stdout, "operator");
  const errorCode = readTapField(stdout, "code");
  const normalizedOutput = [
    `test=${testName}`,
    "status=failed",
    `expected=${expected}`,
    `actual=${actual}`,
    `operator=${operator}`,
    `errorCode=${errorCode}`,
  ].join("\n");

  return {
    schemaVersion: EVIDENCE_BEARING_PROGRAMMING_EVIDENCE_SCHEMA_VERSION,
    status: "failed",
    exitCode: 1,
    testName,
    expected,
    actual,
    operator,
    errorCode,
    normalizedOutput,
  };
}

export function generateEvidenceBearingProgrammingBundle(
  repositoryRoot = process.cwd(),
): EvidenceBearingProgrammingBundle {
  assertSupportedNodeRuntime();
  const fixtureDirectory = resolve(repositoryRoot, FIXTURE_RELATIVE_DIRECTORY);
  const result = spawnSync(process.execPath, [...EXECUTION_SPEC.arguments], {
    cwd: fixtureDirectory,
    encoding: "utf8",
    timeout: EXECUTION_SPEC.timeoutMs,
    env: {
      LANG: "C",
      LC_ALL: "C",
      TZ: "UTC",
    },
  });

  if (result.error !== undefined) {
    const code = (result.error as NodeJS.ErrnoException).code ?? "unknown";
    if (code === "ETIMEDOUT") {
      throw new Error("evidence_execution_timeout");
    }
    throw new Error(`evidence_execution_error:${code}`);
  }
  if (result.signal !== null) {
    throw new Error(`evidence_execution_signal:${result.signal}`);
  }
  if (result.status !== EXECUTION_SPEC.expectedExitCode) {
    throw new Error(`evidence_execution_unexpected_exit:${String(result.status)}`);
  }

  const stdout = result.stdout;
  const stderr = result.stderr;
  if (Buffer.byteLength(stdout, "utf8") + Buffer.byteLength(stderr, "utf8") > EXECUTION_SPEC.maxOutputBytes) {
    throw new Error("evidence_execution_output_too_large");
  }

  const evidence = parseExecutionEvidence(stdout);
  const challengeSpec = challengeSpecFingerprint();
  const fixture = fixtureFingerprint(repositoryRoot);
  const executionSpec = executionSpecFingerprint();
  const evidenceHash = fingerprintEvidence(evidence);
  const binding = bindingFingerprint({
    challengeSpecFingerprint: challengeSpec,
    fixtureFingerprint: fixture,
    executionSpecFingerprint: executionSpec,
    evidenceFingerprint: evidenceHash,
  });

  return {
    evidence,
    provenance: {
      challengeId: EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_ID,
      challengeVersion: EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_VERSION,
      challengeSpecFingerprint: challengeSpec,
      fixtureFingerprint: fixture,
      executionSpecFingerprint: executionSpec,
      evidenceFingerprint: evidenceHash,
      bindingFingerprint: binding,
      runtimeVersion: process.versions.node,
    },
  };
}

export function verifyEvidenceBearingProgrammingBundle(
  bundle: EvidenceBearingProgrammingBundle,
  repositoryRoot = process.cwd(),
): EvidenceBearingProgrammingVerification {
  const diagnostics: string[] = [];
  const expectedChallengeSpecFingerprint = challengeSpecFingerprint();
  const expectedFixtureFingerprint = fixtureFingerprint(repositoryRoot);
  const expectedExecutionSpecFingerprint = executionSpecFingerprint();
  const expectedEvidenceFingerprint = fingerprintEvidence(bundle.evidence);
  const expectedBindingFingerprint = bindingFingerprint({
    challengeSpecFingerprint: expectedChallengeSpecFingerprint,
    fixtureFingerprint: expectedFixtureFingerprint,
    executionSpecFingerprint: expectedExecutionSpecFingerprint,
    evidenceFingerprint: expectedEvidenceFingerprint,
  });

  if (bundle.provenance.challengeId !== EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_ID) {
    diagnostics.push("challenge_id_mismatch");
  }
  if (bundle.provenance.challengeVersion !== EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_VERSION) {
    diagnostics.push("challenge_version_mismatch");
  }
  if (bundle.provenance.challengeSpecFingerprint !== expectedChallengeSpecFingerprint) {
    diagnostics.push("challenge_spec_fingerprint_mismatch");
  }
  if (bundle.provenance.fixtureFingerprint !== expectedFixtureFingerprint) {
    diagnostics.push("fixture_fingerprint_mismatch");
  }
  if (bundle.provenance.executionSpecFingerprint !== expectedExecutionSpecFingerprint) {
    diagnostics.push("execution_spec_fingerprint_mismatch");
  }
  if (bundle.provenance.evidenceFingerprint !== expectedEvidenceFingerprint) {
    diagnostics.push("evidence_fingerprint_mismatch");
  }
  if (bundle.provenance.bindingFingerprint !== expectedBindingFingerprint) {
    diagnostics.push("binding_fingerprint_mismatch");
  }

  return {
    status: diagnostics.length === 0 ? "pass" : "fail",
    diagnostics,
  };
}

function assertEvidenceIntegrity(
  bundle: EvidenceBearingProgrammingBundle,
  repositoryRoot: string,
): void {
  const verification = verifyEvidenceBearingProgrammingBundle(bundle, repositoryRoot);
  if (verification.status === "fail") {
    throw new Error(`evidence_integrity_failure:${verification.diagnostics.join(",")}`);
  }
}

export function buildEvidenceBearingProgrammingTutorInput(
  bundle: EvidenceBearingProgrammingBundle,
  repositoryRoot = process.cwd(),
): TutorTurnInput {
  assertEvidenceIntegrity(bundle, repositoryRoot);
  return {
    scenarioId: EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_ID,
    learningObjective: PUBLIC_CHALLENGE_SPEC.tutorVisible.learningObjective,
    initialContext: [
      "Experimental execution-backed debugging evidence. This is not a canonical TutorEval case.",
      `Challenge: ${EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_ID}@${EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_VERSION}`,
      `Challenge spec fingerprint: ${bundle.provenance.challengeSpecFingerprint}`,
      `Evidence binding fingerprint: ${bundle.provenance.bindingFingerprint}`,
      "Normalized local test evidence:",
      bundle.evidence.normalizedOutput,
    ].join("\n"),
    conversation: [],
    currentStudentMessage: PUBLIC_CHALLENGE_SPEC.tutorVisible.studentMessage,
    studentState: PUBLIC_CHALLENGE_SPEC.tutorVisible.studentState,
  };
}

export async function runEvidenceBearingProgrammingPrototype(
  tutor: TutorUnderTest,
  repositoryRoot = process.cwd(),
): Promise<EvidenceBearingProgrammingPrototypeRun> {
  const bundle = generateEvidenceBearingProgrammingBundle(repositoryRoot);
  const tutorInput = buildEvidenceBearingProgrammingTutorInput(bundle, repositoryRoot);
  const tutorOutput = await tutor.respond(tutorInput);
  if (tutorOutput.text.trim().length === 0) {
    throw new Error("prototype_tutor_empty_output");
  }

  return {
    prototypeId: EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_ID,
    prototypeVersion: EVIDENCE_BEARING_PROGRAMMING_PROTOTYPE_VERSION,
    bundle,
    tutorInput,
    tutorOutput,
    verification: {
      evidenceIntegrity: "pass",
      semanticTutoringEvaluation: "not_evaluated",
      canonicalScoringApplied: false,
    },
  };
}

export function getEvidenceBearingProgrammingHiddenReferenceForTests(): string {
  return HIDDEN_REFERENCE.diagnosis;
}
