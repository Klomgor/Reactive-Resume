# ATS export evaluation

`evaluation.integration.test.ts` renders deterministic synthetic resume data through current
`ResumeDocument` and `buildDocx`, then measures extraction with installed PDF.js and DOCX XML.
`metrics.test.ts` locks raw distinct-token recall, order, duplicate, and semantic-grouping behavior,
including deliberate drop/duplicate regressions.

Run from repository root:

```sh
pnpm --filter @reactive-resume/tooling test
```

The integration test writes PDF/DOCX fixtures and raw-count reports to
`tooling/ats-export-evaluation/test-results/` (ignored test output). Results explicitly distinguish
local extraction measurements from vendor parser accuracy. Steps 1–2 add no ATS preset; a later
product decision can use measured deficiencies from `ats-export-report.md`.
