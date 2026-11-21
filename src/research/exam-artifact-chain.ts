/** Reviewed acquisition metadata only. A digest binds observations to one file. */
export type ArtifactBinding = {
  edition: string;
  issuer: string;
  act: string;
  title: string;
  sha256: string;
  pages: number | null;
  // 仅由已核实的发行者下载记录提供；转载页与访谈不能写入此字段。
  issuerDownload: { url: string; sha256: string } | null;
};

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error("exam_artifact_invalid: " + message);
}
function fields(input: unknown, names: string): Record<string, unknown> {
  check(input && typeof input === "object" && !Array.isArray(input) &&
    Object.keys(input).sort().join(" ") === names.split(" ").sort().join(" "), "unexpected acquisition fields");
  return input as Record<string, unknown>;
}
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

/** Assess a curated chain. Reviewing the underlying receipt and permission happens before recording it. */
export function assessArtifactChain(input: unknown, source: ArtifactBinding) {
  check(digest(source.sha256), "artifact digest");
  check(input && typeof input === "object" && "channel" in input, "missing acquisition channel");
  if (input.channel === "controlled-distribution") {
    const { receipt: rawReceipt } = fields(input, "channel receipt");
    const receipt = fields(rawReceipt, "authority act recipientRole receivedOn authorizationRecord receiptRecord useRecord attachmentTitle edition pages sha256");
    check(receipt.authority === source.issuer && receipt.act === source.act && source.act.length > 0 &&
      (receipt.recipientRole === "authorized-school" || receipt.recipientRole === "education-body"), "distribution authority");
    check(typeof receipt.receivedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(receipt.receivedOn) &&
      new Date(receipt.receivedOn).toJSON()?.slice(0, 10) === receipt.receivedOn, "receipt date");
    // 只保留已核查的非个人化证据指纹。登记表不接受收件人姓名、文件路径或收件原文。
    check(digest(receipt.authorizationRecord) && digest(receipt.receiptRecord) && digest(receipt.useRecord), "controlled evidence references");
    check(![receipt.authorizationRecord, receipt.receiptRecord, receipt.useRecord].includes(source.sha256),
      "attachment digest cannot stand in for distribution evidence");
    check(receipt.attachmentTitle === source.title && receipt.edition === source.edition && source.pages !== null &&
      Number.isSafeInteger(source.pages) && source.pages > 0 && receipt.pages === source.pages &&
      receipt.sha256 === source.sha256, "received attachment mismatch");
    return { authentication: "corroborated-distribution-copy", access: "controlled-distribution", evidence: { ...receipt } } as const;
  }
  if (input.channel === "issuer-direct") {
    const { url } = fields(input, "channel url");
    check(source.issuerDownload && url === source.issuerDownload.url &&
      source.sha256 === source.issuerDownload.sha256, "no registered issuer attachment");
    return { authentication: "verified-issuer-original", access: "public-issuer-download", evidence: source.issuerDownload } as const;
  }
  fields(input, "channel");
  if (input.channel === "public-mirror" || input.channel === "school-hosted")
    return { authentication: "unverified-mirror-copy", access: input.channel, evidence: null } as const;
  check(input.channel === "unknown", "unknown acquisition channel");
  return { authentication: "unknown", access: "unknown", evidence: null } as const;
}
