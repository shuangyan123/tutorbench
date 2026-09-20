# Tutor Benchmark Repository Rules

## Product boundary

Tutor Benchmark is an independent evaluation framework. It evaluates a `TutorUnderTest`; it is not a tutor implementation, chat product, prompt playground, model leaderboard, or Review Workspace submodule.

Review Workspace (`shuangyan123/demo`) may become an adapter in a later phase, but this repository must remain independent and must not import its internal services, repositories, UI, Electron code, or Dexie database.

## Architecture

Keep the dependency flow:

```text
Scenario -> TutorUnderTest adapter -> Tutor output -> evaluator -> result -> report
```

Core contracts are provider-independent. Provider-specific metadata belongs in an adapter and must not leak into core result contracts.

## Data and privacy

- Commit only synthetic, public, properly licensed, or reviewed anonymized evaluation assets.
- Never commit real user data, production chat logs, API keys, cookies, tokens, private system prompts, commercial prompts, production database exports, or identifiable datasets.
- Use ignored local data or a separate private repository/storage for future private evaluations.
- Do not persist raw provider payloads, credentials, or hidden chain-of-thought in benchmark results.
- `.env`, results, build output, and `data/private/` are ignored. Do not create real private data in this repository.

## Benchmark integrity

Benchmark failures are evidence to investigate, not reasons to weaken the benchmark. Do not delete failing scenarios, lower thresholds, change expected answers to match a model, add model-specific exceptions, skip failing cases, or weaken assertions merely to improve scores or CI.

Change a scenario or rubric only with independent evidence that the benchmark itself is wrong. Explain why the new criterion is more correct, not why a score becomes higher. Deterministic string/keyword evaluators are proxies and must not be presented as complete measures of teaching quality.

## Engineering workflow

This repository uses `.agents/skills/tutor-benchmark-engineering/SKILL.md` as the required repo-local engineering Skill for implementation, refactor, maintenance, rules, documentation, tests, release tasks, and repository/GitHub mutations. Read it before any mutation and select the workflow mode before acting.

The Skill owns architecture audit, implementation, validation, GitHub delivery, CI/review, merge eligibility, merge authorization, cleanup, incident recovery, and final reporting. Keep procedural workflow there; do not duplicate it here.

### Hard invariants and routing

- Pure read-only work does not create a branch and must not mutate GitHub state.
- GitHub coordination metadata mutations such as creating or editing issues, comments, labels, milestones, or issue state are mutations even though they do not modify repository files. Perform them only when they are within the user's authorized scope; they do not by themselves require a code branch.
- New repository-content write tasks start from the exact verified latest `origin/main` and enter a fresh short-lived `feature/`, `fix/`, `refactor/`, or `chore/` branch before the first file edit. Existing PR work continues on the exact verified PR head branch.
- Repository-content writes through a connector/API are subject to the same branch rule as local Git. Any file create/update/delete call must explicitly name the verified task branch. Never omit the branch argument, rely on a default branch, or target `main` for a task write.
- Preserve unrelated user changes, WIP branches, and worktrees. STOP on unknown dirty changes, detached HEAD, unfinished merge/rebase, ambiguous ownership, or conflicting worktree. Never stash, reset, restore, clean, `git checkout -- .`, delete or prune user work, overwrite WIP, or commit unrelated changes.
- Normal scoped delivery may proceed through commit, push, PR creation, task-related CI fixes, and merge-readiness verification unless the user limits the phase. Technical readiness does not itself authorize Merge.
- Merge requires both technical eligibility and explicit authorization for the current task. Authorization may be given in advance or immediately before Merge, but it must be unambiguous and task-specific. Green CI, mergeability, or prior authorization for a different task is not Merge authorization.
- Merge eligibility requires green required checks, unblocked review, no conflict, unchanged verified PR HEAD, no sensitive files, and no scope expansion. Do not force-push, direct-push `main`, admin-bypass protections, or merge an unverified PR.
- Prefer the GitHub connector for structured remote metadata, PRs, issues, patches, comments, reviews, and labels. Use local `git` for checkout and local history operations, and `gh` for authentication, current-PR discovery, Actions checks/logs, and connector gaps.

### Accidental-mutation safety

If an unauthorized or unintended repository mutation occurs:

1. STOP the original task immediately.
2. Record the pre-mutation SHA, accidental mutation SHA, target branch, and affected paths/state.
3. Do not force-push, rewrite history, reset shared refs, or hide the incident.
4. Apply only the minimum safe recovery needed to restore repository content/state, preferably as an ordinary forward recovery commit when shared history has moved.
5. Verify the recovered tree/state against the pre-mutation baseline.
6. Report the incident and recovery evidence to the user.
7. Do not resume the original task until the recovery state is accepted or new explicit scope is provided.

## Project and phase routing

TutorBench now spans multiple completed and in-progress roadmap phases. Do not treat the whole repository as if it were still limited to the 0.1 Foundation phase.

- `docs/roadmap.md` is the primary status map for completed, partial, blocked, and not-started phases.
- The user's explicit task scope determines which phase boundary applies.
- Historical Foundation restrictions remain binding when work is scoped to Foundation-era contracts or when a later phase has not explicitly authorized the relevant capability.
- Existing later-phase functionality such as Judge providers, Community Review service components, or other roadmap-approved boundaries is not invalid merely because it exceeds the original 0.1 Foundation scope.
- Do not start a later roadmap phase, open public intake, make live provider calls, start a real reviewer campaign, or make calibration/validity claims unless the current task explicitly authorizes that boundary.
- Use Node 24 in CI and run the applicable quality gates from the repo-local Skill, normally `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run benchmark`, and `git diff --check` for runtime changes; use proportional structural checks for rules-only changes.
- Stop at the explicitly requested phase.
