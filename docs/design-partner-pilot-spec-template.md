# Design Partner Pilot Spec Template

Use one copy of this template per design-partner pilot.

Default classification: **private**.

This is the project-level scope and execution record for a pilot. It does not
replace the per-scenario
[Design Partner Scenario Intake Template](design-partner-scenario-intake-template.md).
Use the Scenario Intake template once for each teaching-policy boundary that is
accepted into the pilot suite.

Do not paste partner credentials, private prompts, identifiable learner data,
raw production chats, confidential endpoint URLs, or other unnecessary private
material into this document.

---

## 1. Pilot identity and coordination

**Partner alias:**  
**Product / Tutor surface:**  
**Partner owner / contact:**  
**TutorBench pilot owner:**  
**Working language:**  
**Primary coordination channel:** email / X chat / other asynchronous channel  
**Secondary coordination channel, if any:**  
**Pilot specification date:**  
**Target baseline start:**  
**Target baseline report window:**  
**Partner product/configuration version naming convention:**  

## 2. Pilot question and boundary

State the product question in one sentence.

**Primary pilot question:**  

**Selected tutoring workflow or pedagogical problem:**  

**Subject / domain:**  
**Learner level:**  
**Learning objective:**  

**Observable tutoring decision(s) in scope:**  

Examples:

- increase support after repeated learner difficulty;
- ask a diagnostic question before choosing an intervention;
- escalate hint specificity without revealing the answer;
- preserve productive struggle while remaining helpful;
- check understanding before advancing.

**Explicitly out of scope:**  

Examples:

- whole-product quality claims;
- learner-outcome or causal learning-gain claims;
- unrelated Tutor workflows;
- new product surfaces not named above;
- dashboard or export-tool development unless separately scoped.

**Claim boundary:**  

Describe exactly what this pilot may support. The default is that the pilot
tests observable Tutor behavior against jointly authored criteria at specified
decision points. It does not establish general Tutor competence or learning
effectiveness.

## 3. Access and partner inputs

**Black-box access method:** product surface / API / frozen response set / other  

**Access owner:**  
**Access readiness condition:**  

Credentials, cookies, API keys, and private endpoint details must remain in the
partner's or pilot owner's secret store and must not be copied into this
document.

**Required product context:**

- learning objective for the selected workflow;
- relevant learner, subject, grade, or usage boundary;
- important tutoring constraints or policies;
- examples of behaviors the partner considers good, problematic, or uncertain;
- product/configuration version needed for provenance.

**Optional inputs:**

- non-identifying teacher feedback;
- synthetic examples;
- reviewed anonymized examples;
- product questions already under investigation.

**Inputs that are not required by default:**

- private system prompts;
- Tutor engine internals;
- skill/orchestration architecture;
- identifiable student data;
- unrelated production telemetry.

## 4. Joint evaluation contract

The partner owns the intended teaching-policy boundary. TutorBench owns the
repeatable test and evidence trail.

**Tutor Health dimensions in scope:**  

**Criteria to define jointly:**  

For each criterion, record:

- the observable behavior being evaluated;
- acceptable alternatives;
- prohibited behavior;
- what evidence is sufficient;
- what remains unresolved when evidence is insufficient;
- severity when the policy is violated.

**Criteria version:**  
**Scoring/profile version:**  
**Judge requirement and provider/model, if applicable:**  
**Known evaluator limitations:**  

Do not convert missing Judge evidence or missing required evidence into a
pedagogical pass.

## 5. Scenario plan

**Target scenario count:**  
**Private suite ID:**  
**Initial suite version:**  

| Scenario ID | Decision point | Primary health dimension | Intake status |
| --- | --- | --- | --- |
|  |  |  | draft / partner-confirmed |
|  |  |  | draft / partner-confirmed |
|  |  |  | draft / partner-confirmed |
|  |  |  | draft / partner-confirmed |
|  |  |  | draft / partner-confirmed |
|  |  |  | draft / partner-confirmed |

Each accepted scenario must have its own completed
[Scenario Intake](design-partner-scenario-intake-template.md).

## 6. Scope-freeze gate

Freeze the baseline suite only when all applicable items are confirmed.

- [ ] The selected workflow and learning objective are unambiguous.
- [ ] Learner/domain boundaries are recorded.
- [ ] Evaluation criteria have been jointly reviewed.
- [ ] Acceptable alternatives and prohibited behavior are represented.
- [ ] Each scenario has sufficient Tutor-visible learner evidence.
- [ ] Partner-confirmed policy is separated from TutorBench assumptions.
- [ ] Severity assignments are justified.
- [ ] Private source material remains outside tracked public repository content.
- [ ] Access works for the intended Tutor configuration.
- [ ] Suite ID, suite version, scoring profile, and Tutor provenance are frozen.
- [ ] Report limitations and claim boundaries are understood.

**Scope frozen by:**  
**Scope freeze date:**  
**Open issues that do not block baseline:**  

## 7. Baseline execution record

**Baseline run ID:**  
**Run date:**  
**Tutor provider / product alias:**  
**Tutor model / deployment / configuration identifier:**  
**Prompt or policy version:**  
**Suite ID / version:**  
**Scoring profile ID / version:**  
**Judge provider / model, if used:**  
**Artifact storage location:**  

Preserve the source evaluation artifact and Tutor Health report. Do not rely on
filenames alone for run identity.

## 8. Baseline deliverables

Unless a separate agreement says otherwise, a pilot report should include:

- evaluation date;
- tested product/configuration identity;
- criteria and suite version;
- scenario and coverage summary;
- individual assessments;
- relevant conversation evidence excerpts;
- observed versus expected behavior;
- evidence-backed Findings;
- severity and confidence only where supported by the evaluation contract;
- actionable diagnostic recommendations;
- explicit regression targets;
- limitations and unresolved evidence.

**Additional agreed deliverables:**  

**Explicitly excluded deliverables:**  

Examples: production dashboard, automated PDF/Excel export pipeline, learner
outcome study, new scenario families, or additional product surfaces.

## 9. Regression rerun contract

A regression rerun should test a changed Tutor against the same frozen scenario
suite and evaluation criteria whenever the purpose is before/after comparison.

**Included rerun count, if any:**  
**Rerun eligibility window, if any:**  
**Candidate product/configuration version:**  
**Candidate run ID:**  
**Candidate run date:**  

**Comparison record:**

- resolved Findings;
- persistent Findings;
- new Findings;
- criteria or evidence that became unresolved;
- partner interpretation.

A request requires new scope when it materially changes the evaluation contract,
for example:

- new scenario authoring;
- a new tutoring workflow or subject boundary;
- materially changed evaluation criteria;
- a new product surface;
- a learner-outcome study;
- dashboard or export-tool development;
- analysis that cannot be answered from the frozen suite.

## 10. Privacy and publication

Private pilot material remains private by default.

**Private storage location:**  
**Retention / deletion requirement, if any:**  
**Who may access partner material:**  
**Publication permission:** private only / anonymized discussion approved / public attribution approved  

Publishing a partner name, scenario, result, score, Finding, screenshot,
before/after claim, or case study requires a separate explicit authorization and
privacy/content review.

Receiving partner material does not imply permission to publish it.

## 11. Pilot acceptance and start gate

Before baseline work begins:

- [ ] Partner has confirmed the pilot question.
- [ ] Partner has confirmed the black-box access method.
- [ ] Partner has confirmed the evaluation criteria boundary.
- [ ] Partner has confirmed the planned scenario count.
- [ ] Deliverables and exclusions are understood.
- [ ] Communication channel is agreed.
- [ ] Privacy/storage boundary is agreed.
- [ ] Commercial or administrative prerequisites, if any, are resolved outside
      this methodology template.

**Partner confirmation:**  
**TutorBench confirmation:**  
**Pilot start date:**  
**Unresolved items:**  

## 12. Post-pilot outcome record

Complete after the baseline and any included rerun.

**Findings accepted as actionable:**  
**Product or policy changes made:**  
**Regression result:**  
**What the partner found useful:**  
**What was not useful or reliable enough:**  
**Changes needed before another pilot:**  
**Whether a broader follow-up is justified:**  

A successful pilot is not defined by a high Tutor Health score. The strongest
signal is that the evidence is credible enough to support a concrete product or
policy decision and that the same decision point can be retested after change.
