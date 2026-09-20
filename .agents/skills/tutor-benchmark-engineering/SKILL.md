---
name: tutor-benchmark-engineering
description: Build and maintain the independent Tutor Benchmark framework, including contracts, synthetic scenarios, rubrics, deterministic evaluators, adapters, runners, reports, tests, and release-ready Git workflows.
---

# Tutor Benchmark Engineering

This Skill governs engineering and repository/GitHub delivery for TutorBench. Keep changes small, typed, deterministic, auditable, provider-independent at core boundaries, and faithful to benchmark integrity and privacy requirements.

## 1. Product and architecture invariants

TutorBench evaluates a `TutorUnderTest`; it is not a tutor product, chat UI, prompt playground, or Review Workspace module.

Preserve the one-way flow:

```text
Scenario -> TutorUnderTest adapter -> Tutor output -> evaluator -> result -> report
```

Core contracts stay provider-independent. Provider-specific transport and metadata belong in adapters or provider-owned execution layers. Do not persist credentials, raw provider payloads, private prompts, or hidden chain-of-thought in benchmark results.

Treat benchmark failures as evidence. Never improve scores or CI by deleting cases, lowering thresholds, rewriting expected answers to match a model, adding model-specific exceptions, skipping failures, or weakening assertions.

## 2. Phase routing

TutorBench spans multiple completed and in-progress roadmap phases. `docs/roadmap.md` is the primary phase/status map; the user's explicit task scope determines which boundary applies.

Do not globally re-impose historical 0.1 Foundation limits on functionality that later roadmap phases already authorize. Conversely, do not start a later phase, make new live provider calls, open public intake, start a real reviewer campaign, add new calibration claims, or expand product scope unless the current task explicitly authorizes that boundary.

Stop at the requested phase.

## 3. Select exactly one workflow mode

Choose the mode before any mutation.

### A. Pure read-only

Use for audit, review, explain, inspect, or research when no external state should change.

- Do not create a branch.
- Do not create/edit/close issues or comments.
- Do not change labels, PR state, refs, files, releases, Actions, or other remote state.
- Read evidence and report only.

### B. Coordination metadata mutation

Use when the authorized action changes GitHub coordination metadata but not repository content, for example creating/updating an issue, comment, label, milestone, or issue state.

- This is a mutation and must be within explicit task scope.
- It does not by itself require a code branch.
- Verify repository + resource type + target number/name before the mutation.
- Do not treat metadata authorization as authorization to edit repository files, rerun workflows, merge, release, or close unrelated issues.

### C. New repository-content write task

Use for feature, fix, refactor, maintenance, rules/docs/Skill changes, tests, or any create/update/delete of repository files.

- Perform the hard preflight.
- Create a fresh short-lived task branch from the exact verified latest `origin/main` before the first repository-content edit.
- Never write task content directly to `main`.

### D. Existing PR continuation

Use only when the user explicitly asks to continue an existing open PR or address its review/CI/stabilization work.

- Verify PR base, head branch, exact PR HEAD SHA, and ownership before writing.
- Continue that exact branch; do not create a second PR for the same task.

## 4. Hard preflight for repository-content writes

Before mode C writes, establish the exact base and safe task location. With local Git, inspect at minimum:

```bash
git status --short
git status -sb
git branch --show-current
git rev-parse HEAD
git fetch origin
git rev-parse origin/main
git worktree list --porcelain
```

The preflight must establish:

- latest `origin/main` SHA is known;
- selected task location is clean, attached, and free of unfinished merge/rebase/cherry-pick/revert;
- unrelated WIP/worktrees do not need to be altered;
- task branch is fresh and based on the exact verified main SHA.

If the normal worktree is occupied by another verified task/PR, leave it untouched. A disposable task worktree may be used when isolation is materially useful. Never stash, reset, restore, clean, force-checkout, prune, or delete unknown/user-owned work to make the preflight pass.

For mode D, inspect the existing PR first and bind all writes to the exact verified PR head branch/HEAD SHA.

## 5. Branch and connector write invariant

Repository-content writes are branch-bound regardless of whether they use local Git, `gh`, the GitHub connector, or the Contents API.

For a new task:

```text
latest verified origin/main SHA
-> fresh feature|fix|refactor|chore branch
-> repository-content mutation
```

Hard rules:

- Never create/update/delete task files on `main`.
- For connector/API file create/update/delete calls, explicitly pass the verified task branch.
- Never omit a branch argument when omission would target the default branch.
- Never use an empty/null/default branch for a task content write.
- Before every connector file mutation verify repository, path, operation, target branch, and expected current blob SHA when applicable.
- A coordination metadata mutation does not create permission for repository-content writes.

If a desired branch already exists, inspect its history/ownership before using it. Never overwrite unknown history or force-push.

## 6. Worktree policy

Worktrees are optional isolation, not ceremony.

Default route:

```text
clean synchronized main worktree
-> fresh task branch
-> implement/test/PR
```

Use a disposable worktree when another task/PR must remain checked out or switching would disturb user work. Before creating/removing one, verify path, branch, HEAD, status, and ownership. Never force-remove or prune an unknown/user-owned worktree.

After an authorized merge, use the repository-owned guard rather than relying
on prose-only cleanup:

```bash
npm run worktree:audit
npm run worktree:cleanup
npm run worktree:audit
```

The first and last commands are read-only verification. Apply mode rechecks
each candidate and can remove only `SAFE_TO_REMOVE` registered worktrees. The
guard fails closed for dirty, detached, current, default-branch, unresolved,
unknown-ownership, open-PR, dependent-PR, or ambiguous GitHub state. It uses
`git worktree remove` without `--force`, never deletes branches, and does not
prune metadata unless a future change provides a separate justified need.

## 7. Load only relevant context

Read the actual contracts, adapters, evaluator, runner, reports, tests, and directly relevant docs. Do not implement from filenames or assumptions.

When docs and verified implementation disagree, determine whether docs are stale. Do not silently change benchmark semantics to make implementation or model output easier.

## 8. Proportional architecture audit

For contract/evaluator/adapter/runner/workflow changes identify as applicable:

```text
entry point
call chain
runtime validation
TutorUnderTest boundary
evaluator/result flow
report boundary
privacy/security boundary
partial/failure semantics
retry safety
external effects
test coverage
```

Do not pretend remote provider effects and local persistence form one ACID transaction.

## 9. Minimum sufficient design

Prefer pure functions, small orchestration functions, typed contracts, JSON fixtures, and minimal dependencies. Add an abstraction only when it represents a real benchmark or substitution boundary.

Do not perform unrelated refactors or introduce broad frameworks without evidence.

## 10. Preserve benchmark/privacy boundaries

Unless the scoped phase explicitly requires it, do not add:

- new real model/provider calls;
- new LLM voting or calibration claims;
- Review Workspace internal imports;
- unrelated databases/dashboards/large datasets;
- complex statistical claims;
- major dependency/toolchain upgrades.

Commit only synthetic, public, properly licensed, or reviewed anonymized assets. Never commit secrets, production chats, production exports, identifiable datasets, raw credentials, provider reasoning, or private hidden data.

## 11. Implement incrementally

Keep scenario loading, validation, adapter execution, evaluation, result construction, and reporting separated.

For contracts:

- keep IDs stable/versionable;
- validate runtime input;
- keep provider metadata outside core contracts;
- keep errors stable and privacy-safe.

For runners/evaluators:

- preserve deterministic ordering;
- isolate per-case failures;
- retain criterion-level diagnostics;
- never label a proxy as complete teaching-quality evidence.

## 12. Tests

Prefer behavior tests using real functions/runners plus synthetic fixtures. Assert relevant inputs, ordering, outputs, failure semantics, validation, reproducibility, and privacy boundaries.

Architecture/source checks can supplement but not replace behavior tests. Do not rely only on whole-result snapshots.

## 13. Quality gates

For rules/AGENTS/Skill-only changes, run at least structural validation plus:

```bash
git diff --check
```

Do not mechanically run unrelated runtime suites when no runtime boundary changed; state exactly what was run.

For ordinary TypeScript/runtime changes, normally run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run benchmark
git diff --check
```

Use Node 24 in CI and keep the repository Node engine requirement intact. Never claim an unrun check passed.

## 14. Failure classification

If a gate fails, classify it as task regression, existing repository failure, environment failure, or external-service failure. Fix only in-scope regressions/minimal blockers. Never weaken benchmark/test/security rules to get green CI.

If correctness cannot be restored safely, stop at the last safe state and report the blocker.

## 15. Review the complete diff

Before commit, inspect status, `git diff --check`, and the complete patch. Look for unrelated changes, temporary/debug code, dead code, unsafe retries, secret leakage, unexpected contract changes, generated output, missing tests, stale docs, and scope expansion.

## 16. Commit and push

Commit only after applicable local gates pass. Use Conventional Commits and a small number of logically complete commits.

Push only the task branch. Force pushes (`--force` and `--force-with-lease`) are prohibited. On non-fast-forward rejection, inspect remote history; do not overwrite it.

## 17. Pull Request

Create the PR with:

```text
base: main
head: verified task branch
```

PR body should include Summary, Architecture/Behavior, Compatibility, Testing (only commands actually run), and Residual risks.

Creating a PR is not Merge authorization.

## 18. Remote verification

After each push inspect:

```text
PR HEAD SHA
base/head branches
mergeability/conflicts
required checks
Actions runs
reviews / Changes Requested
blocking unresolved threads
sensitive/unexpected files
```

Remote CI must be bound to the current exact PR HEAD. If HEAD changes, old CI cannot authorize the new HEAD.

Workflow reruns are remote mutations; rerun only when authorized by task scope or explicit user instruction. Do not silently rerun a failed/cancelled workflow merely to seek green status.

## 19. Merge eligibility is not Merge authorization

A PR is **merge-eligible** only when all applicable technical conditions are true:

```text
applicable local gates PASS
required remote checks PASS
GitHub Actions PASS
no merge conflict
no Changes Requested
no unresolved blocking review
no sensitive files
no unexpected scope expansion
PR base = main
PR HEAD = exact validated HEAD
```

Immediately before Merge, re-read PR HEAD SHA. If it changed, validate the new HEAD first.

These conditions establish technical eligibility only. They do not authorize Merge.

## 20. Merge authorization gate

Merge requires explicit, unambiguous authorization for the current task. Authorization may be given in advance for that task or immediately before Merge, but must clearly cover the Merge action.

Do not infer Merge authorization from:

- green CI;
- PR creation;
- approval to implement/fix/push;
- approval to create an issue;
- authorization from another task;
- silence or lack of objections.

If technical eligibility is satisfied but Merge authorization is absent, stop at **READY TO MERGE** and ask/wait for authorization.

## 21. Never bypass protections

Do not admin-bypass, force merge, disable protections, remove required checks, direct-push task changes to `main`, merge failing/conflicting/unverified HEADs, or rewrite shared history to hide mistakes.

When authorized and eligible, prefer Squash and Merge with a clear Conventional Commit-style title unless repository evidence requires another strategy.

## 22. Accidental mutation incident protocol

If an unintended or unauthorized mutation occurs, including a direct `main` file write:

1. STOP the original task immediately.
2. Record repository, target branch/resource, pre-mutation SHA/state, accidental mutation SHA/state, and affected paths/resources.
3. Do not force-push, reset shared refs, delete evidence, or rewrite history to conceal the mutation.
4. Apply only the minimum safe recovery necessary to restore the prior content/state. For shared branch history, prefer a normal forward recovery commit over history rewriting.
5. Verify recovery against the pre-mutation baseline. For repository content, compare trees/diffs and confirm there are no residual file changes.
6. Report the incident, exact recovery evidence, and any unavoidable history effect.
7. Do not resume the original task until the user accepts the recovered state or gives new explicit scope.

Recovery authorization is limited to undoing the accidental effect; it is not permission for unrelated edits.

## 23. Cleanup after an authorized Merge

Begin cleanup only after remote evidence confirms:

- PR state `MERGED`;
- base `main`;
- merged PR HEAD equals the exact pre-merge validated HEAD;
- merge result SHA is known and final main contains it.

From a safe final-main location, run `npm run worktree:audit` and retain its
stable classification, reason, path, branch, and HEAD output. Only
when the audit identifies a candidate as `SAFE_TO_REMOVE` may the completed
task invoke `npm run worktree:cleanup`; the command itself is the explicit
apply-mode entry point, re-audits each candidate immediately before calling
`git worktree remove <path>`, and verifies that the registration is gone. Run
`npm run worktree:audit` again afterward.

Apply mode is additionally enforced in code: it first fetches `origin`, then
requires the invoking worktree to be attached, clean, free of unfinished Git
state, checked out on the GitHub default branch, with GitHub's default branch
equal to `main`, and with `HEAD` exactly equal to the freshly resolved
`origin/main`. Audit mode remains read-only and may run from a feature branch.

Preserve any branch/worktree still referenced by another open/stacked PR or
worktree. A failed or ambiguous audit is a hard stop, not permission to use
`--force`, manually delete a directory, prune metadata, or remove a branch.

Delete task branches only when proven owned by the current completed task and unreferenced. Never delete unknown/user WIP branches.

## 24. Final main verification

After Merge/cleanup, verify final `main` from a safe location:

```bash
git fetch origin
git pull --ff-only origin main
git rev-parse main
git rev-parse origin/main
git status --short --branch
```

Do not reset/stash/force-switch unknown dirty state merely to synchronize main.

Run proportional post-merge checks against the actual final main. Rules-only changes need applicable structural checks; runtime changes normally need the relevant project gates.

## 25. Stop boundary

Do not automatically begin the next roadmap task after completing the requested one. A completed R3 does not authorize R4; a rules fix does not authorize benchmark implementation; a merged PR does not authorize release/public launch.

## 26. Final reporting

Report concisely:

```text
Implementation
- what changed

Validation
- commands/checks actually run and PASS/FAIL

Git
- base SHA
- task branch
- task HEAD SHA

Pull Request
- number/title/URL
- validated exact HEAD
- remote checks/review state

Merge
- READY TO MERGE / MERGED / NOT AUTHORIZED / BLOCKED
- if merged: method, merge SHA, final main SHA

Cleanup/post-merge
- only if Merge occurred

Residual risks
- real unresolved issues only
```

Never claim pushed, tested, merged, synchronized, or cleaned up unless verified.

## 27. Completion rule

Normal repository-content delivery is:

```text
Understand scope
-> select workflow mode
-> audit
-> exact-base preflight
-> fresh task branch
-> implement
-> direct tests
-> applicable gates
-> complete diff review
-> commit
-> push
-> PR
-> exact-head remote CI/review
-> establish merge eligibility
-> obtain/verify current-task Merge authorization
-> Merge
-> verify merge result/final main
-> npm run worktree:audit
-> npm run worktree:cleanup when SAFE_TO_REMOVE is proven
-> npm run worktree:audit again
-> post-merge verification
-> STOP
```

If Merge authorization is not present, stop at `READY TO MERGE` rather than merging.

If any critical condition fails, preserve the last safe continuation state instead of bypassing the guardrail.
