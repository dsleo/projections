# PDF Highlighting (status + implementation notes)

This document tracks the current behavior of the **audience PDF highlighting** feature, plus approaches we tried and why they did/didn’t work.

## Current behavior (working)

- Highlights are injected directly into the LaTeX using `\dfhighlightword{...}` / `\dfhighlightmath{...}` macros.
- Audience PDF highlights use the same sentence/environment selection as the supporting-text panel.
- Environment propagation is supported for theorem-like environments:
  `theorem`, `lemma`, `proposition`, `corollary`, `claim`, `conjecture`, `definition`, `example`.
- Highlighting is **word-level** (not whitespace), which preserves line breaking and avoids overfull boxes.
- Display-math blocks are not highlighted (to avoid breaking `$$...$$` or `\begin{equation}`).

## What we tried (and why it failed)

- **SyncTeX overlays (client-side boxes):** alignment drift and inconsistent mapping for sentences; brittle with font/layout changes.
- **`soul` / `\hl{}` full-span highlights:** frequent LaTeX errors with math-heavy text (`Reconstruction failed`) and unstable on complex macros.
- **Highlighting whitespace inside `\colorbox{}`:** caused line-breaking failures and text spilling into the margin.
- **Injecting highlights inside display math:** caused `Missing $ inserted` errors (now explicitly avoided).

## Open improvements

- Robust, line-level background highlighting that respects math and does not break line wrapping.
- A safer math-aware highlighter for display-math blocks (e.g., `\colorbox` in `\mathchoice`, or a true TeX parser).
- Optional post-processing or PDF-layer highlight approach if SyncTeX can be made reliable (might require a dedicated mapping library).
