import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import { assessArtifactChain, type ArtifactBinding } from "../src/research/exam-artifact-chain.js";
import { assessSourceRecord, checkInstrumentRole, locateApplicability, verifyEvidenceDecision, type inspectSourceGovernance } from "../src/research/exam-source-governance.js";

const cli = (...args: string[]) => execFileSync(process.execPath, ["dist/src/cli/exam-specifications.js", "--requirements", ...args]);
const digest = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const binding: ArtifactBinding = { edition: "synthetic@1", issuer: "Synthetic issuing body",
  act: "S-1", title: "Synthetic curriculum", pages: 3, sha256: digest("synthetic attachment"), issuerDownload: null };
const receipt = { authority: binding.issuer, act: binding.act, recipientRole: "authorized-school",
  receivedOn: "2025-10-01", authorizationRecord: digest("synthetic authorization"),
  receiptRecord: digest("synthetic distribution log"), useRecord: digest("synthetic permission for inspection"),
  attachmentTitle: binding.title, edition: binding.edition, pages: binding.pages, sha256: binding.sha256 };
const controlled = (record: unknown) => assessArtifactChain({ channel: "controlled-distribution", receipt: record }, binding);

test("a documented controlled copy has a chain without a public issuer download", () => {
  const unknown = { status: "unknown", evidence: null };
  const report = assessSourceRecord({ role: "state-curriculum", acquisition: { channel: "controlled-distribution", receipt },
    evidence: { notice: { kind: "issuer-notice", location: "urn:sha256:" + receipt.authorizationRecord, locator: "S-1" },
      inspected: { kind: "copy-inspection", location: "artifact", locator: "page 2" } },
    applicability: [], inspection: "Synthetic page 2", wholeDocument: unknown, fullTextReuse: unknown },
  binding, 100, { artifact: null }, 0);
  assert.equal(report.issuance.status, "confirmed");
  assert.equal(report.artifact.location, null);
  assert.equal(report.evidence.inspected?.location, "urn:sha256:" + binding.sha256);
  assert.equal(report.use.fullTextPermission.status, "unknown");
  assert.equal(report.applicability.examSession.value, "unknown");
  const result = controlled(receipt);
  assert.equal(result.authentication, "corroborated-distribution-copy");
  assert.equal(result.access, "controlled-distribution");
  for (const change of [{ act: "other" }, { receivedOn: "2025-02-30" }, { edition: "other" }, { pages: 4 },
    { sha256: digest("other") }, { attachmentTitle: "other" }, { authorizationRecord: null }, { useRecord: null },
    { receiptRecord: binding.sha256 }, { recipientRole: "public-host" }, { recipientName: "synthetic identity" }, { attachmentBytes: "synthetic bytes" }])
    assert.throws(() => controlled({ ...receipt, ...change }), /exam_artifact_invalid/);
});

test("issuer release, interview, public school listing and identical mirror bytes have distinct effects", () => {
  const url = "https://issuer.example/standard.pdf";
  const official = { ...binding, issuerDownload: { url, sha256: binding.sha256 } };
  assert.equal(assessArtifactChain({ channel: "issuer-direct", url }, official).authentication, "verified-issuer-original");
  for (const channel of ["public-mirror", "school-hosted"]) {
    assert.equal(assessArtifactChain({ channel }, binding).authentication, "unverified-mirror-copy");
    assert.throws(() => assessArtifactChain({ channel, authentication: "verified-issuer-original" }, binding));
  }
  assert.throws(() => assessArtifactChain({ channel: "issuer-direct", url }, binding));
  assert.throws(() => assessArtifactChain({ channel: "issuer-direct", url: "https://issuer.example/interview" }, official));
  assert.throws(() => assessArtifactChain({ channel: "issuer-direct", url }, { ...official, sha256: digest("other") }));
  assert.equal(assessArtifactChain({ channel: "unknown" }, binding).authentication, "unknown");
  assert.throws(() => assessArtifactChain({}, binding));
});

test("permissions, pagination, applicability and normative units require separate evidence", () => {
  const evidence = { hash: { kind: "digest", location: "fixture", locator: "bytes" },
    release: { kind: "issued-instrument", location: "fixture", locator: "publication date" } } as const;
  assert.throws(() => verifyEvidenceDecision({ status: "complete", evidence: "hash" }, "wholeDocument", evidence));
  assert.throws(() => verifyEvidenceDecision({ status: "permitted", evidence: "hash" }, "fullTextReuse", evidence));
  assert.throws(() => locateApplicability([{ field: "teachingIntake", value: "2025", evidence: "release" }], evidence));
  assert.throws(() => locateApplicability([{ field: "examSession", value: "2025", evidence: "release" }], evidence));
  assert.deepEqual(locateApplicability([], evidence).examSession, { value: "unknown", evidence: null });
  for (const role of ["illustrative-task", "administered-paper"]) {
    assert.equal(checkInstrumentRole(role, 0), role);
    assert.throws(() => checkInstrumentRole(role, 1));
  }
});

test("offline governance joins five source editions to the frozen inventory and preserves historical output", () => {
  const bytes = cli("--source-governance");
  assert.deepEqual(bytes, cli("--source-governance"));
  const report = JSON.parse(bytes.toString()) as ReturnType<typeof inspectSourceGovernance>;
  assert.deepEqual(report.inventory, { requirements: 147, authorProposed: 22, unmapped: 125, independentlyReviewed: 0 });
  assert.equal(report.records.length, 5);
  const byRole = (role: string) => report.records.find(r => r.role === role)!;
  const china = byRole("national-curriculum");
  assert.equal(china.issuance.status, "confirmed");
  assert.deepEqual(china.issuance.evidence, ["issuance", "circular"]);
  assert.equal(china.artifact.authenticationStatus, "pending");
  assert.equal(china.integrity.sha256, "f520c1645c88819af0b190192e4b2fc49bbba7da156a82f04adec56c6131c3e1");
  assert.equal(china.integrity.pages, 171);
  assert.equal(china.integrity.bytes, 9959570);
  assert.equal(china.contentReview.editionComparisons?.status, "provisional");
  for (const field of ["teachingIntake", "textbookRollout", "examSession", "provincePaper"] as const)
    assert.equal(china.applicability[field].value, "unknown");
  assert.equal(byRole("common-standard").applicability.examSession.value, "unknown");
  assert.equal(byRole("state-curriculum").applicability.effectiveFrom.value, "2023-08-01");
  assert.equal(byRole("state-exam-focus").applicability.examSession.value, "2027");
  assert.equal(report.sourceRelationships[0]?.to, byRole("state-curriculum").edition);
  const sat = byRole("assessment-framework");
  assert.equal(sat.contentReview.requirements, 36);
  assert.equal(sat.applicability.examSession.value, "unknown");
  assert.equal(sat.applicability.track.value, "digital SAT");
  for (const row of report.records) {
    assert.equal(row.contentReview.independentlyReviewed, 0);
    assert.equal(row.use.fullTextPermission.status, "unknown");
    if (row !== china) assert.equal(row.artifact.authentication, "verified-issuer-original");
  }
  const old = cli("scenarios/case-system-vnext/exam-specifications/requirements-0.7.0.json");
  assert.equal(digest(old), "11484192aad66cd837b9365339efb1d39e489e0b2e5a2b038d679118a68cecd1");
  assert.equal(digest(cli("--edition-diff")), "7dbd6029f3b20cdf001c2b33f6f736a79c7c79944062d2540d81b8b2d349c6c1");
});
