# Fix review findings: Plan 16 editable imported tables

Work only in `/Users/amruth/orca/workspaces/reactive-resume/issue-3196-editable-tables` from exact head
`83aca184e4eeb3a9ded36c1f222adf695ef6ca98`. Read current repository instructions, pinned approved Plan 16,
implementation report, and `.orchestration/plan-16-review.md` completely. Revalidate `origin/main`, issue #3196, and
overlap before editing. Run root Intent inventory and load matching local skills. No subagents.

Fix every review finding with TDD while preserving existing supported-table behavior:

1. Make unsupported-table detection fail closed before destructive Tiptap normalization. Conservatively reject any cell
   descendant element/attribute/structure that cannot round-trip through configured editor schema. Cover at least a nested
   `section` with `aria-label`, multiple `tbody` groups, malformed/repaired table markup, and other representative
   unrepresented descendants. Ordinary edits, prop updates, lock/keyboard paths, and cancel must preserve exact original
   HTML bytes for these cases. Do not widen unsafe HTML support.
2. Define successful conversion as explicit plain text, not normalized table HTML. Use boolean confirmation UI matching
   action; remove ignored text-prompt value. Test confirmed output exactly, cancellation, reopening/editability after
   conversion, and semantics for cells, rows, paragraphs, inline marks, captions, spans, and empty cells according to
   approved Plan 16 direction. Keep the operation explicit and irreversible only after confirmation.
3. Strengthen authenticated E2E so an unrelated Basics-name edit proves a real save transition and survives reload before
   table assertions. Avoid accepting a stale pre-existing Saved status.

Also preserve #3438 cases, supported 2x3 editing/paste/undo/redo/persistence, CSS precedence, PDF border geometry,
dependency minimality, SSR/accessibility, and package boundaries. Keep product commit scope to intended implementation,
tests, dependency/lockfile, and mandated orchestration report; do not push, publish, reply, or mutate issues.

Run focused and broad web/PDF tests, affected typechecks, boundaries, frozen install, production build, narrow non-writing
Biome, diff/scope gates, and dedicated isolated authenticated E2E. Commit fixes locally. Write findings resolved, RED/GREEN
evidence, exact head, test results, and remaining limits to `.orchestration/plan-16-review-fix.md`; send `worker_done`.
