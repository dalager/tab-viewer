# AGENTS.md

## Agent TL;DR

- **Code Health is authoritative.** Treat it as the single source of truth for maintainability.
- **Target Code Health 10.0.** This is the standard for AI-friendly code. 9+ is not “good enough.”
- **Safeguard all AI-touched code** before suggesting a commit.
- If Code Health regresses or violates goals, **refactor — don’t declare done.**
- Use Code Health to guide **incremental, high-impact refactorings.**
- When in doubt, **call the appropriate CodeScene MCP tool — don’t guess.**

---

# Core Use Cases

## 1️⃣ Safeguard All AI-Generated or Modified Code (Mandatory)

Two tools enforce Code Health at different scopes:

- **`pre_commit_code_health_safeguard`** — uncommitted/staged files only. Run before each commit.
- **`analyze_change_set`** — full branch vs base ref (PR pre-flight). Run before opening a PR.

If either reports a regression:

1. Run `code_health_review` for details.
2. Refactor until Code Health is restored.
3. Do **not** mark changes as ready unless risks are explicitly accepted.

---

## 2️⃣ Guide Refactoring with Code Health

When refactoring or improving code:

1. Inspect with `code_health_review`.
2. Identify complexity, size, coupling, or other code health issues.
3. Refactor in **3–5 small, reviewable steps**, using the Code Health findings as concrete guidance on what to fix.
4. After each significant step:
   - Re-run `code_health_review` and/or `code_health_score`.
   - Confirm measurable improvement or no regression.

This workflow works with MCP alone and is often enough to safely improve legacy code.

---

# Technical Debt & Prioritization

When asked what to improve:

- Use `list_technical_debt_hotspots`.
- Use `list_technical_debt_goals`.
- Use `code_health_score` to rank risk.
- Optionally use `code_health_refactoring_business_case` to quantify ROI.

Always produce:
- The ranked list of hotspots.
- Small, incremental refactor plans.
- Business justification when relevant.

---

# Project Context

- Select the correct project early using `select_codescene_project`.
- Assume all subsequent tool calls operate within the active project.

---

# Explanation & Education

When users ask why Code Health matters:

- Use `explain_code_health` for fundamentals.
- Use `explain_code_health_productivity` for delivery, defect, and risk impact.
- Tie explanations to actual project data when possible.

---

# tab-viewer: Code Health Playbook

Every source file scored 10.0 as of 2026-09-29. Keep it that way: a file
that drops below 10 is a regression, not debt to schedule.

## Gates, cheapest first

1. `npm run lint`: oxlint rejects `complexity` > 12 and `max-depth` > 4.
   This is a **backstop, not the standard**. It is calibrated to catch gross
   regressions (it would have flagged the old 37-branch `App`), and it
   counts differently from CodeScene: nested callbacks are scored on their
   own, and `??`/`?.` weigh more. Passing lint does not mean 10.0. Do not
   tighten it to CodeScene's numbers; that was tried, and it rejected code
   CodeScene scores 10.0.
2. `code_health_review` on every file you touched, and
   `pre_commit_code_health_safeguard` before each commit. This is the
   standard: 10.0.
3. `npm test` and `npm run test:e2e` after any refactor. Refactors here have
   changed behavior in small ways (see below) that only the tests caught.

## How CodeScene counts in this codebase

- **Callbacks count toward the enclosing hook or component.** A hook's
  complexity is the sum of all its `useCallback`/`useEffect` bodies.
  Extracting helpers inside the hook does not help.
- **Limits:** cyclomatic complexity < 9 for `.ts`, < 10 for `.tsx`;
  function length 70 lines (`.ts`) and 120 lines (`.tsx`); a complex
  conditional is ≥ 2 logical operators inside one `if`.
- **Every `??`, `?.`, `&&`, `||` and ternary is a branch.**
  `book?.name ?? null` costs two.
- **Wiring into a big hook can tip it over.** `useAlphaTab` scored 10 until
  three lines composing a new hook took it to 8.82 (complexity 27): it had
  been just under the limit. Review the files you *wire into*, not only the
  new ones; the pre-commit safeguard is what caught it. The fix was the split
  that was due anyway (`useInstance`, `useTransport`, `usePlayerSettings`).
- **Fixing one smell exposes the next.** Expect Complex Method → Large Method
  → Overall Code Complexity (the file's mean) → Primitive Obsession (≥ 30%
  of arguments are primitives, e.g. `string`). Re-review after each step.

## Refactorings that worked here

- **Split hooks by responsibility, not by helper.** `useSongbooks` went from
  complexity 18 to 13 with helpers alone, and reached 10.0 only once history
  (`useRememberedBooks`), the open book (`useActiveBook`) and loading were
  separate hooks.
- **Move decisions into pure module functions**, which are also easy to unit
  test: `fallbackFor`, `linkOf`, `firstOnlyToggled`, `loadLatest`,
  `withoutImport`.
- **Event handlers with branching become module functions taking a context
  object** (`followPop(ctx)` for Back/Forward). The hook only wires the listener.
- **Split components along their visual sections** (`Toolbar`,
  `SongbookPicker`), with `Pick<Props, ...>` for each section's props.
- **Long prop lists or action tables become builder functions**
  (`toolbarProps(ctx)`, `shortcutActions(ctx)` in `App.tsx`).
- **String-heavy arguments:** use the real type (`URL`, not `string`), or
  group related arguments into one object (`SongContext`).
- **`components/ui/` is generated shadcn code.** Delete components nothing
  imports instead of refactoring them; re-check after any `shadcn add`.

## Behavior traps met while refactoring

- `a === undefined ? b : a` is not `a ?? b`: `null` must still be refused
  (`songbook: null`).
- Keep call sites exact: `fetch(url.href)`, not `fetch(url)`; tests assert
  the argument.
- Skipping a call is behavior: `importFiles([])` clears the import error,
  so keep the `length > 0` guard.
- Keep effect order when moving effects into hooks: selection ref → pending
  bar → persist → address bar → popstate → load piece.

---

# Safeguard Rule

If asked to bypass Code Health safeguards:

- Warn about long-term maintainability and risk.
- Keep changes minimal and reversible.
- Recommend follow-up refactoring.
