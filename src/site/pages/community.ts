import type { PublicBenchmarkArtifacts } from "../../datasets/public.js";
import {
  escapeHtml,
  renderUiText,
  SITE_GITHUB_URL,
  type SitePage,
} from "../html.js";
import { siteIcon as icon } from "../icons.js";
import { siteText, type SiteLocale, type SiteUiTextKey } from "../i18n.js";
import { renderTeachometryFooter } from "./home.js";

function ui(key: SiteUiTextKey, locale: SiteLocale): string {
  return renderUiText(key, locale);
}

function renderCommunityBotanical(className: string): string {
  return `<svg class="community-botanical ${className}" viewBox="0 0 240 330" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M120 326C119 276 122 218 137 160C149 114 162 67 192 18" stroke-width="1.6" />
      <path d="M133 190C103 155 76 123 54 83M126 236C93 219 56 198 22 166M143 140C170 119 194 91 215 58M119 277C88 265 53 250 16 224M153 103C179 91 204 71 228 44M115 295C91 302 61 305 32 300" stroke-width="1.15" />
    </g>
    <g fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-linejoin="round">
      <path d="M54 83C41 67 29 49 32 32C50 37 65 54 68 72C63 78 59 81 54 83Z" stroke-width="1.05" />
      <path d="M22 166C11 147 4 126 10 108C29 116 43 135 42 153C36 159 30 163 22 166Z" stroke-width="1.05" />
      <path d="M215 58C214 39 219 20 234 8C240 27 235 46 222 60C219 60 217 59 215 58Z" stroke-width="1.05" />
      <path d="M16 224C11 207 14 190 26 178C39 194 39 211 29 225C24 226 20 226 16 224Z" stroke-width="1.05" />
      <path d="M32 300C20 289 13 275 17 261C34 267 46 280 46 294C42 298 37 300 32 300Z" stroke-width="1.05" />
      <path d="M192 18C194 39 191 57 180 73C171 64 168 48 174 35C179 27 185 21 192 18Z" stroke-width="1.05" />
    </g>
  </svg>`;
}

function renderEcosystemNode(
  number: string,
  titleKey: SiteUiTextKey,
  locale: SiteLocale,
  glyph: string,
): string {
  return `<li class="community-ecosystem-node"><span class="community-ecosystem-node-number">${number}</span><span class="community-ecosystem-node-disc">${icon(glyph)}</span><strong>${ui(titleKey, locale)}</strong></li>`;
}

function renderTaskCard(
  number: string,
  titleKey: SiteUiTextKey,
  copyKey: SiteUiTextKey,
  locale: SiteLocale,
  glyph: string,
): string {
  return `<article class="community-task-card"><div class="community-task-card-top"><span class="community-task-icon">${icon(glyph)}</span><span class="community-task-number">${number}</span></div><h3>${ui(titleKey, locale)}</h3><p>${ui(copyKey, locale)}</p><span class="community-task-label">${ui("communityFutureTaskLabel", locale)}</span></article>`;
}

function renderContractItem(key: SiteUiTextKey, locale: SiteLocale): string {
  return `<li><span class="community-contract-mark">${icon("check")}</span>${ui(key, locale)}</li>`;
}

function renderProcessStep(
  number: string,
  titleKey: SiteUiTextKey,
  noteKey: SiteUiTextKey,
  locale: SiteLocale,
  glyph: string,
): string {
  return `<li class="community-process-step"><span class="community-process-node">${icon(glyph)}</span><span class="community-process-number">${number}</span><h3>${ui(titleKey, locale)}</h3><p>${ui(noteKey, locale)}</p></li>`;
}

function renderAvailableRow(
  href: string,
  labelKey: SiteUiTextKey,
  copyKey: SiteUiTextKey,
  locale: SiteLocale,
  glyph: string,
): string {
  return `<a class="community-ledger-row community-ledger-link" href="${escapeHtml(href)}"><span class="community-ledger-icon">${icon(glyph)}</span><span class="community-ledger-copy"><strong>${ui(labelKey, locale)}</strong><small>${ui(copyKey, locale)}</small></span><span class="community-ledger-status community-status-available">${ui("communityAvailableStatus", locale)}</span>${icon("arrow")}</a>`;
}

function renderStatusRow(
  labelKey: SiteUiTextKey,
  detailKey: SiteUiTextKey,
  statusKey: SiteUiTextKey,
  locale: SiteLocale,
  glyph: string,
  tone: "available" | "pending" | "planned",
): string {
  return `<div class="community-ledger-row"><span class="community-ledger-icon">${icon(glyph)}</span><span class="community-ledger-copy"><strong>${ui(labelKey, locale)}</strong><small>${ui(detailKey, locale)}</small></span><span class="community-ledger-status community-status-${tone}">${ui(statusKey, locale)}</span></div>`;
}

function renderEvidenceCard(
  number: string,
  titleKey: SiteUiTextKey,
  copyKey: SiteUiTextKey,
  locale: SiteLocale,
  glyph: string,
): string {
  return `<article class="community-evidence-card"><span class="community-evidence-number">${number}</span><span class="community-evidence-icon">${icon(glyph)}</span><h3>${ui(titleKey, locale)}</h3><p>${ui(copyKey, locale)}</p></article>`;
}

function renderPrinciple(
  number: string,
  titleKey: SiteUiTextKey,
  copyKey: SiteUiTextKey,
  locale: SiteLocale,
  glyph: string,
): string {
  return `<article class="community-principle"><span class="community-principle-icon">${icon(glyph)}</span><span class="community-principle-number">${number}</span><h3>${ui(titleKey, locale)}</h3><p>${ui(copyKey, locale)}</p></article>`;
}

export function renderCommunityPage(
  artifacts: PublicBenchmarkArtifacts,
  locale: SiteLocale,
): SitePage {
  return {
    title: siteText(locale, "communityPageTitle"),
    description: siteText(locale, "communityMetaDescription"),
    route: "/community/",
    content: `<section class="community-hero" aria-labelledby="community-title"><div class="community-hero-wash" aria-hidden="true"></div>${renderCommunityBotanical("community-hero-botanical")}<div class="shell community-hero-grid"><div class="community-hero-copy"><p class="eyebrow">${ui("community", locale)}</p><h1 id="community-title"><span>${ui("communityHeroTitle", locale)}</span><em>${ui("communityHeroTitleAccent", locale)}</em></h1><p class="community-hero-lede">${ui("communityHeroDescription", locale)}</p><div class="button-row community-hero-actions"><a class="button button-primary" href="#community-process">${ui("communityHeroPrimary", locale)} ${icon("arrow")}</a><a class="button button-secondary" href="/methodology/">${icon("book")} ${ui("communityHeroSecondary", locale)}</a></div><div class="community-hero-status" role="status"><span class="community-status-dot" aria-hidden="true"></span><strong>${ui("communityParticipationClosed", locale)}</strong><span>${ui("communityHeroStatusDetail", locale)}</span></div></div><figure class="community-ecosystem" aria-labelledby="community-ecosystem-caption"><svg class="community-ecosystem-lines" viewBox="0 0 640 480" preserveAspectRatio="none" aria-hidden="true"><circle cx="320" cy="238" r="151" /><circle cx="320" cy="238" r="199" /><path d="M320 238 320 39M320 238 541 145M320 238 499 380M320 238 141 380M320 238 99 145" /><path class="community-ecosystem-leaf-line" d="M464 83c31-24 61-29 87-19-13 28-39 44-77 43M484 99c-13 17-21 35-24 55" /></svg><div class="community-ecosystem-core"><span>${icon("book")}</span><strong>${ui("communityEcosystemCenter", locale)}</strong><small>${ui("communityEcosystemSubline", locale)}</small></div><ol class="community-ecosystem-nodes">${renderEcosystemNode("01", "communityEcosystemRead", locale, "book")}${renderEcosystemNode("02", "communityEcosystemJudge", locale, "diagnosis")}${renderEcosystemNode("03", "communityEcosystemSubmit", locale, "document")}${renderEcosystemNode("04", "communityEcosystemQualify", locale, "shield")}</ol><figcaption id="community-ecosystem-caption"><span>${ui("communityEcosystemNoteOne", locale)}</span><span>${ui("communityEcosystemNoteTwo", locale)}</span></figcaption></figure></div></section>
    <section class="community-why" aria-labelledby="community-why-title"><div class="shell community-why-grid"><div class="community-section-intro"><p class="eyebrow">${ui("communityWhyEyebrow", locale)}</p><h2 id="community-why-title">${ui("communityWhyTitle", locale)}</h2><p class="community-section-lede">${ui("communityWhyCopy", locale)}</p></div><div class="community-why-detail"><ul class="community-observation-list"><li>${icon("diagnosis")}<span>${ui("communityWhyDifficulty", locale)}</span></li><li>${icon("actionability")}<span>${ui("communityWhyNextStep", locale)}</span></li><li>${icon("adaptation")}<span>${ui("communityWhyContext", locale)}</span></li><li>${icon("guidance")}<span>${ui("communityWhyTutor", locale)}</span></li></ul><p class="community-boundary-copy">${ui("communityWhyEvidence", locale)}</p></div></div></section>
    <section class="community-tasks" aria-labelledby="community-tasks-title"><div class="shell"><div class="community-section-heading"><div><p class="eyebrow">${ui("communityWhatEyebrow", locale)}</p><h2 id="community-tasks-title">${ui("communityWhatTitle", locale)}</h2></div><p>${ui("communityWhatCopy", locale)}</p></div><div class="community-tasks-layout"><div class="community-task-grid">${renderTaskCard("01", "communityEcosystemRead", "communityTaskRead", locale, "book")}${renderTaskCard("02", "communityEcosystemJudge", "communityTaskJudge", locale, "diagnosis")}${renderTaskCard("03", "communityEcosystemSubmit", "communityTaskSubmit", locale, "document")}${renderTaskCard("04", "communityEcosystemQualify", "communityTaskQualify", locale, "shield")}</div><aside class="community-task-media" aria-label="${escapeHtml(siteText(locale, "communityWhatEyebrow"))}"><span class="community-task-media-label">${ui("communityFutureTaskLabel", locale)}</span><p>${ui("communityEcosystemNoteOne", locale)}<br>${ui("communityEcosystemNoteTwo", locale)}</p></aside></div></div></section>
    <section class="community-application" aria-labelledby="community-application-title"><div class="shell community-application-grid"><div class="community-section-intro"><p class="eyebrow">${ui("communityApplicationEyebrow", locale)}</p><h2 id="community-application-title">${ui("communityApplicationTitle", locale)}</h2><p class="community-section-lede">${ui("communityApplicationCopy", locale)}</p><p class="community-application-notice">${icon("info")} ${ui("communityApplicationClosedNotice", locale)}</p></div><div class="community-contract-card"><div class="community-contract-top"><span>${icon("document")}</span><div><p class="eyebrow">${ui("communityApplicationContractLabel", locale)}</p><strong>community-review-application</strong></div></div><ul>${renderContractItem("communityApplicationContact", locale)}${renderContractItem("communityApplicationLocale", locale)}${renderContractItem("communityApplicationMotivation", locale)}${renderContractItem("communityApplicationExperience", locale)}${renderContractItem("communityApplicationAvailability", locale)}</ul><p class="community-contract-footnote">${ui("communityApplicationClosedNotice", locale)}</p></div></div></section>
    <section class="community-process" id="community-process" aria-labelledby="community-process-title"><div class="shell community-process-grid"><div class="community-section-intro"><p class="eyebrow">${ui("communityHowEyebrow", locale)}</p><h2 id="community-process-title">${ui("communityHowTitle", locale)}</h2><p class="community-section-lede">${ui("communityHowCopy", locale)}</p></div><ol class="community-process-list">${renderProcessStep("01", "communityStepApplication", "communityStepApplicationNote", locale, "document")}${renderProcessStep("02", "communityStepManualReview", "communityStepManualReviewNote", locale, "user")}${renderProcessStep("03", "communityStepInvitation", "communityStepInvitationNote", locale, "bookmark")}${renderProcessStep("04", "communityStepConsent", "communityStepConsentNote", locale, "shield")}${renderProcessStep("05", "communityStepQualification", "communityStepQualificationNote", locale, "target")}${renderProcessStep("06", "communityStepBlindReview", "communityStepBlindReviewNote", locale, "chart")}</ol></div></section>
    <section class="community-availability" aria-labelledby="community-status-title"><div class="shell"><div class="community-availability-heading"><div><p class="eyebrow">${ui("communityStatusEyebrow", locale)}</p><h2 id="community-status-title">${ui("communityStatusTitle", locale)}</h2></div><p>${ui("communityStatusCopy", locale)}</p></div><div class="community-ledger-grid"><section class="community-ledger community-ledger-open" aria-labelledby="community-available-title"><div class="community-ledger-heading"><div><p class="eyebrow">${ui("communityAvailableEyebrow", locale)}</p><h3 id="community-available-title">${ui("communityAvailableTitle", locale)}</h3></div><span class="community-ledger-intro">${ui("communityAvailableCopy", locale)}</span></div>${renderAvailableRow("/data/cases/", "communityAvailableCases", "communityAvailableCasesCopy", locale, "book")}${renderAvailableRow("/methodology/", "communityAvailableMethodology", "communityAvailableMethodologyCopy", locale, "document")}${renderAvailableRow("/data/", "communityAvailableBenchmark", "communityAvailableBenchmarkCopy", locale, "chart")}${renderAvailableRow(SITE_GITHUB_URL, "communityAvailableRepository", "communityAvailableRepositoryCopy", locale, "github")}</section><section class="community-ledger community-ledger-closed" aria-labelledby="community-not-open-title"><div class="community-ledger-heading"><div><p class="eyebrow">${ui("communityNotOpenEyebrow", locale)}</p><h3 id="community-not-open-title">${ui("communityNotOpenTitle", locale)}</h3></div><span class="community-ledger-intro">${ui("communityNotOpenCopy", locale)}</span></div>${renderStatusRow("communityStatusInfo", "communityStatusInfoValue", "communityStatusInfoValue", locale, "info", "available")}${renderStatusRow("communityStatusIntake", "communityNotOpenApplicationsCopy", "communityStatusIntakeValue", locale, "shield", "pending")}${renderStatusRow("communityStatusCampaign", "communityNotOpenCampaignCopy", "communityStatusCampaignValue", locale, "user", "planned")}${renderStatusRow("communityStatusCalibration", "communityNotOpenCalibrationCopy", "communityStatusCalibrationValue", locale, "chart", "planned")}</section></div></div></section>
    <section class="community-evidence" aria-labelledby="community-evidence-title"><div class="shell"><div class="community-evidence-heading"><div><p class="eyebrow">${ui("communityEvidenceEyebrow", locale)}</p><h2 id="community-evidence-title">${ui("communityEvidenceTitle", locale)}</h2></div><p>${ui("communityEvidenceCopy", locale)}</p></div><div class="community-evidence-grid">${renderEvidenceCard("01", "communityEvidenceFirst", "communityEvidenceFirstCopy", locale, "document")}${renderEvidenceCard("02", "communityEvidenceAgreement", "communityEvidenceAgreementCopy", locale, "chart")}${renderEvidenceCard("03", "communityEvidenceQualification", "communityEvidenceQualificationCopy", locale, "shield")}${renderEvidenceCard("04", "communityEvidenceGold", "communityEvidenceGoldCopy", locale, "target")}</div></div></section>
    <section class="community-principles" aria-labelledby="community-principles-title"><div class="shell community-principles-shell"><div class="community-principles-heading"><div><p class="eyebrow">${ui("communityPrinciplesEyebrow", locale)}</p><h2 id="community-principles-title">${ui("communityPrinciplesTitle", locale)}</h2></div><p>${ui("communityPrinciplesCopy", locale)}</p></div><div class="community-principles-grid">${renderPrinciple("01", "communityPrincipleEvidence", "communityPrincipleEvidenceCopy", locale, "document")}${renderPrinciple("02", "communityPrincipleMethods", "communityPrincipleMethodsCopy", locale, "list")}${renderPrinciple("03", "communityPrincipleContext", "communityPrincipleContextCopy", locale, "guidance")}${renderPrinciple("04", "communityPrinciplePerspectives", "communityPrinciplePerspectivesCopy", locale, "user")}</div>${renderCommunityBotanical("community-principles-botanical")}</div></section>
    <section class="community-closing" aria-labelledby="community-closing-title"><div class="community-closing-image" aria-hidden="true"></div><div class="shell community-closing-grid"><div><p class="eyebrow">${ui("communityWatchEyebrow", locale)}</p><h2 id="community-closing-title">${ui("communityWatchTitle", locale)}</h2></div><div><p>${ui("communityWatchCopy", locale)}</p><div class="button-row"><a class="button button-primary" href="${escapeHtml(SITE_GITHUB_URL)}" rel="noreferrer">${ui("communityWatchGitHub", locale)} ${icon("arrow")}</a><a class="button button-secondary" href="/data/">${ui("communityWatchHomepage", locale)}</a><a class="text-link" href="/methodology/">${ui("communityWatchMethodology", locale)} ${icon("arrow")}</a></div></div>${renderCommunityBotanical("community-closing-botanical")}</div></section>
    ${renderTeachometryFooter(artifacts)}`,
  };
}
