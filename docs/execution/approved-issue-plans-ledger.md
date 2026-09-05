# Approved issue plans execution ledger

Coordinator-owned record for plans approved in PR #3455. Implementation PRs remain unmerged. Issue comments and issue
state changes are outside scope.

## Run metadata

- Planning source: PR #3455, head `a2557b2ad40e06e1e63eb655f286e6a78fe6bf0d` (open, unmerged at bootstrap)
- Implementation source: `origin/main`, head `7a98f6662ffc6fd5a1a7281c30ab3829fe3722ec` at bootstrap
- Coordinator branch: `codex/issue-execution-ledger`
- Started: 2026-09-05, Europe/Berlin
- Status values: `pending`, `diagnosing`, `implementing`, `reviewing`, `published`, `no-change`, `blocked`, `declined`
- Evidence rule: each terminal disposition needs current source/GitHub proof, focused tests or reproduction evidence, and
  independent review when code changed.

## Dependency and ownership rules

- Every implementation unit starts from refreshed `origin/main` unless this ledger names a true stacked dependency.
- One active owner per overlapping source file. Rich-text ownership coordinates units 16/19; renderer ownership coordinates
  12/13/14/17/18/27/30/31; section/schema/layout ownership coordinates 20–24/31/32; image ownership coordinates 06/15/25;
  template ownership coordinates 26/28/29/34.
- Units 24 and 32 have shared-file exclusion, not a preset stacked dependency; stack only if current implementation proves
  unit 32 needs schema or interfaces introduced by unit 24. Units 30/31 wait for relevant renderer baselines. Unit 33 stops
  after reference research and concrete visual proposal until explicit visual approval.
- Worker reports separate verified facts from uncertainty and include reproduction, first failing boundary, exact commit,
  tests run, skipped gates, risks, issue coverage, and PR state.

## Units

| Unit | Issues | Status / current validity | Owner | Worktree / branch | Base → head | Dependencies | Evidence | Tests | PR | Next action | Blockers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 account login/recovery | #3166, #3164, #3078, #3046, #2897, #2837 | pending | unassigned | — | `7a98f6662` → — | none | live revalidation pending | — | — | inspect full plan, issue history, current auth seams; reproduce per gates | private/hosted evidence may gate historical claims |
| 02 hosted v4 recovery | #3181, #2760 | pending | unassigned | — | `7a98f6662` → — | unit 01 evidence | live revalidation pending | — | — | validate scoped ownership/recovery direction | legitimate private recovery access and backups |
| 03 MCP registration | #3398, #3153 | pending | unassigned | — | `7a98f6662` → — | none | live revalidation pending | — | — | verify OAuth persistence fix and residual registration path | hosted/provider access may limit end-to-end proof |
| 04 AI provider compatibility | #2732, #2766, #2723, #2708 | pending | unassigned | — | `7a98f6662` → — | none | live revalidation pending | — | — | isolate connect, enablement, and import causes | provider credentials/fixtures may gate cases |
| 05 AI provider migrations | #3152 | pending | unassigned | — | `7a98f6662` → — | coordinate with 04 | live revalidation pending | — | — | inspect deployment migration path and current schema | self-hosted deployment evidence may gate historical claim |
| 06 image storage delivery | #2684, #2778 | pending | unassigned | — | `7a98f6662` → — | coordinate with 15/25 | live revalidation pending | — | — | verify local/S3 upload and PDF delivery boundaries | backend fixtures/infrastructure |
| 07 AIO deployment | #2722 | pending | unassigned | — | `7a98f6662` → — | none | Q12: PostgreSQL remains separate | — | — | record declined AIO direction; inspect Compose/Unraid docs; improve only proven gaps | no AIO implementation permitted |
| 08 root public resume | #2669 | pending | unassigned | — | `7a98f6662` → — | none | live revalidation pending | — | — | verify self-hosted root routing proposal against current routes | — |
| 09 external version backup | #2705 | pending | unassigned | — | `7a98f6662` → — | none | live revalidation pending | — | — | document explicit JSON backup in user-controlled Git | no automatic sync scope |
| 10 legacy link routing | #2836 | pending | unassigned | — | `7a98f6662` → — | none | live revalidation pending | — | — | validate owner-only notice/public 404 scope | prospective behavior only where historical data absent |
| 11 job search policy | #3010 | pending | unassigned | — | `7a98f6662` → — | none | live revalidation pending | — | — | document JSearch removal/current tailoring workflow | — |
| 12 preview/export failures | #3323, #3290, #3033, #3007, #2609 | pending | unassigned | — | `7a98f6662` → — | renderer ownership | live revalidation pending | — | — | reproduce first failing boundary per issue | missing historical fixtures possible |
| 13 font/glyph/spacing | #3249, #3159, #3147, #3093, #3089, #2988 | pending | unassigned | — | `7a98f6662` → — | coordinates 14/17/18/27 | live revalidation pending | — | — | verify residuals without reverting existing fixes | fonts/fixtures/network paths |
| 14 RTL export layout | #3275 | pending | unassigned | — | `7a98f6662` → — | renderer owner shared with 13/17/18 | live revalidation pending | — | — | separate shaping/layout from canvas display | renderer feasibility gate |
| 15 picture fitting/style | #3168, #3088, #2794, #2782 | pending | unassigned | — | `7a98f6662` → — | coordinate 06/25 | live revalidation pending | — | — | diagnose delivery, square preview, non-square fitting separately | image fixtures/backends |
| 16 imported table borders | #3196 | pending | unassigned | — | `7a98f6662` → — | shared rich-text owner with 19 | Q11 approves editable Tiptap tables | — | — | reproduce flattening and implement supported table editing/persistence/export | reporter fixture unavailable may limit historical equivalence |
| 17 list/skill pagination | #2751, #3040 | pending | unassigned | — | `7a98f6662` → — | renderer owner shared with 13/14/18 | live revalidation pending | — | — | reproduce causes separately | renderer feasibility |
| 18 preview/export geometry | #2683 | pending | unassigned | — | `7a98f6662` → — | renderer owner shared with 13/14/17 | live revalidation pending | — | — | measure identical resume data in preview/download | real render required |
| 19 literal rich-text whitespace | #3397 | pending | unassigned | — | `7a98f6662` → — | shared rich-text owner with 16 | approved ordinary paragraph/heading preservation; four-space tabs | — | — | revalidate editor/export normalization and compatibility boundary | renderer feasibility for literal whitespace |
| 20 section restoration | #3378, #3265, #2921 | pending | unassigned | — | `7a98f6662` → — | shared section/layout owner 21–24/32 | live revalidation pending | — | — | distinguish hidden from missing layout placement | — |
| 21 section heading visibility | #3060 | pending | unassigned | — | `7a98f6662` → — | coordinates 20/31 | Q1–Q3 approved; current main already contains partial `showHeading` seams | — | — | compare full plan to current implementation and prove preview/PDF/DOCX/accessibility behavior | — |
| 22 skill keyword presentation | #2785 | pending | unassigned | — | `7a98f6662` → — | shared section/layout owner | live revalidation pending | — | — | implement explicit approved mode after plan revalidation | — |
| 23 pagination controls | #3350, #3090 | pending | unassigned | — | `7a98f6662` → — | shared section/layout owner | Q10 preserves independent authored-page controls; overflow-page UI deferred | — | — | validate guidance with Azurill scenario | renderer scenario |
| 24 date layout | #3155, #2841 | pending | unassigned | — | `7a98f6662` → — | shared schema/section/template owner; before 32 integration | Q4–Q9 approved across all free-text-date sections/templates | — | — | inspect full plan and current schema/template seams | real layout validation required |
| 25 experience company logos | #3379 | pending | unassigned | — | `7a98f6662` → — | image contract from 06/15 | live revalidation pending | — | — | add through existing image ownership contract | storage compatibility proof |
| 26 secondary color | #3373 | pending | unassigned | — | `7a98f6662` → — | template owner coordinates 28/29/34 | live revalidation pending | — | — | define token, consumers, compatibility per plan | visual render review |
| 27 offline fonts | #3377 | pending | unassigned | — | `7a98f6662` → — | font diagnostics from 13/14 | live revalidation pending | — | — | measure all font network paths before distribution choice | network/font licensing/size evidence |
| 28 basics custom styles | #3137 | pending | unassigned | — | `7a98f6662` → — | template owner coordinates 26/29/34 | live revalidation pending | — | — | verify existing styles and isolate residuals | visual render review |
| 29 Onyx profile header | #2812 | pending | unassigned | — | `7a98f6662` → — | template owner coordinates 26/28/34 | live revalidation pending | — | — | add optional placement without duplicate content | visual render review |
| 30 ATS export evaluation | #2845 | pending | unassigned | — | `7a98f6662` → — | after renderer baselines | live revalidation pending | — | — | evaluate current PDF/DOCX before ATS preset decision | tooling/criteria may limit claims |
| 31 document accessibility | #2844 | pending | unassigned | — | `7a98f6662` → — | after renderer baselines; coordinates 21 | Q3 retains accessible section labels when visible heading hidden | — | — | verify current PDF/DOCX/HTML gaps only | tagged-PDF feasibility not assumed |
| 32 section date sorting | #2725 | pending | unassigned | — | `7a98f6662` → — | section/schema owner; coordinate 24 | approved one-time stable sort, not autosort | — | — | implement stable unknown-date behavior per full plan | — |
| 33 Europass template | #2689 | pending | unassigned | — | `7a98f6662` → — | renderer/template baselines | approved research and concrete visual proposal only | — | — | research official reference and publish reviewable visual artifact, then mark blocked at gate | future concrete visual approval required before template code |
| 34 Gengar skill layout | #2611 | pending | unassigned | — | `7a98f6662` → — | template owner coordinates 26/28/29 | live revalidation pending | — | — | restore Gengar-only rating placement | visual render review |
| 35 resume import errors | #2768 | pending | unassigned | — | `7a98f6662` → — | none | live revalidation pending | — | — | reproduce before changing parser/dialog lifecycle | source fixture may be missing |

## Active orchestration

| Scope | Task / dispatch | Owner worktree | State | Deliverable |
| --- | --- | --- | --- | --- |
| Plans 01–06 | `task_855fbee0a803` / `ctx_949458744061` | `codex-audit-backend-01-06` | diagnosing | current issue/source/PR audit and executable unit split |
| Plans 07–11, 35 | `task_9f27829ca50f` / `ctx_11f7d7cf6d17` | `codex-audit-backend-07-11-35` | diagnosing | current issue/source/PR audit and executable unit split |
| Plans 12–19 | `task_1c6582ccdeae` / `ctx_795fced595ef` | `codex-audit-rendering-12-19` | diagnosing | current issue/source/PR audit and renderer overlap map |
| Plans 20–34 | `task_47ed7eb02d48` / `ctx_50d8257459ab` | `codex-audit-builder-20-34` | diagnosing | current issue/source/PR audit and schema/template overlap map |
| Plan 07 implementation | `task_aee702e37eae` / not dispatched | planned `codex/issue-2722-postgres-docs` | waits on plans 07–11 audit | two-file docs change, verification, commit, independent review |

## Existing PR and residual accounting

| Item | Live state | Exact head | Evidence / checks | Next action |
| --- | --- | --- | --- | --- |
| PR #3453 | open, non-draft, mergeable, approved | `ccd111da894cf7d44cc3dee06c937f70d91fef24` | live 2026-09-05: E2E/autofix/Codacy/CodeRabbit/Greptile successful on exact head | monitor only; keep unmerged |
| PR #3454 | open, non-draft, mergeable, approved | `80b0d3ab02cc4292f8a4514db8c2516adc1f9dc3` | live 2026-09-05: E2E/autofix/Codacy/CodeRabbit/Greptile successful on exact head | monitor only; keep unmerged |
| Residual #2828 | pending product direction | — | stale whole-document concurrent-tab overwrite reproduced in Chromium/PostgreSQL; excluded from 63 | account for separately; do not implement conflict UI until product policy selected |

## Rulings and blockers log

- 2026-09-05 — No rulings yet. Approved Q1–Q12 and blanket directions are binding inputs, not coordinator rulings.

## Publication log

- Coordinator ledger: PR #3456 (`codex/issue-execution-ledger` → `main`), open and intentionally unmerged.
- No implementation PRs published by this run yet.
