# Design Partner Scenario Intake Template

Use one copy of this template per teaching-policy boundary.

Default classification: **private**.

Do not paste raw production chats, student identifiers, credentials, private
system prompts, or unrelated internal documents into this file. Prefer an
authored abstraction of the minimum learner state and history needed to test
the decision.

---

## 1. Pilot metadata

**Partner alias:**  
**Product surface:**  
**Internal owner / contact:**  
**Intake date:**  
**Policy/profile version:**  
**Intended Tutor configuration:**  
**Source classification:** authored description / reviewed anonymized example / synthetic reconstruction  
**Storage location:**  
**Publication permission:** private only / anonymized discussion approved / public attribution approved  
**Retention or deletion note, if applicable:**  

## 2. Scenario identity

**Scenario ID:**  
**Scenario title:**  
**Subject / domain:**  
**Topic:**  
**Learner level:**  
**Learning objective:**  

## 3. Why this scenario matters

Describe the product risk or teaching decision in one or two sentences.

**Decision boundary:**  

Examples:

- preserve productive struggle after an initial mistake;
- increase support after repeated failure;
- probe false confidence before advancing;
- fade support after demonstrated progress;
- protect learning integrity without becoming unhelpful.

## 4. Tutor-visible learner context

Record only information the production Tutor is legitimately allowed to know.

**Known concepts:**  

**Tutor-owned learner model / memory, if any:**  

**Confidence / engagement / mastery state exposed to the Tutor, if any:**  

Do not place evaluator-only misconception truth or expected behavior here
unless the production Tutor actually receives it.

## 5. Authored conversation history

Use the smallest history that makes the decision point unambiguous.

| Turn | Role | Authored content | Why this turn is needed |
| --- | --- | --- | --- |
| 1 | learner / tutor |  |  |
| 2 | learner / tutor |  |  |
| 3 | learner / tutor |  |  |

**Current learner message / decision point:**  

## 6. Partner teaching policy

State the policy in behavioral terms.

**At this decision point, the Tutor should:**  

**It may also acceptably:**  

**It should not:**  

**What changes the decision?**  
For example: attempt count, explicit help request, frustration, demonstrated
mastery, assessment mode, or a repeated misconception.

**Disclosure boundary:** no answer / hint only / partial solution / full solution allowed / full solution required

## 7. Evaluator reference state

This section is evaluator-only.

**Known misconception or reasoning issue:**  

**Observable learner turn(s) supporting that reference:**  

**Reference confidence / engagement / mastery, if authored:**  

Do not infer internal Tutor state or hidden model reasoning.

## 8. Expected observable behavior

Describe what a reviewer should be able to observe in the Tutor response.

**Required behavior:**  

**Desirable behavior:**  

**Prohibited behavior:**  

Avoid implementation-specific wording unless the product policy itself is
implementation-specific.

## 9. Failure definition

**Finding title if the policy is violated:**  

**Health dimension:** content_correctness / learner_diagnosis / intervention_strategy / adaptation / learning_integrity / interaction_quality / reliability_policy  

**Severity:** info / minor / major / critical  

**Why this severity is appropriate:**  

**Expected evidence location:** Tutor response / specific learner turn / rubric result / critical-failure record  

**What user or product harm would this failure create?**  

## 10. Recommendation boundary

**Diagnostic recommendation:**  
What should the team inspect or verify?

**Possible implementation suggestion, if useful:**  
Keep this explicitly separate from the diagnosis. Do not present it as a
proven root cause.

**Regression target:**  
What exact behavior should be retested after a change?

## 11. Partner confirmation

Before the scenario is treated as partner-specific policy evidence, confirm:

- [ ] Learner context is realistic enough for the intended product.
- [ ] Conversation history is sufficient and no longer than necessary.
- [ ] Expected behavior reflects the partner's policy.
- [ ] Acceptable alternatives are represented.
- [ ] Prohibited behavior is observable.
- [ ] Severity is appropriate.
- [ ] Evaluator-only truth is supported by visible learner evidence.
- [ ] No confidential source material is being copied into the public repo.
- [ ] The partner understands that the result tests this authored decision
      boundary, not general learning effectiveness.

**Confirmed by:**  
**Confirmation date:**  
**Notes / unresolved disagreement:**  

## 12. Baseline / candidate follow-up

Leave this blank during initial intake.

**Baseline run ID:**  
**Baseline Finding IDs:**  
**Which Findings were accepted as actionable:**  
**Product change made:**  
**Candidate Tutor configuration:**  
**Candidate run ID:**  
**Resolved Findings:**  
**Persistent Findings:**  
**New Findings:**  
**Partner interpretation:**  
