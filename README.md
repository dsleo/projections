## LLM-Based Scientific Discourse Structuring Pipeline

Upload a `.tex` research paper and this app will:

- **Pass 1 (LLM-SSC):** deterministically segment into sentences, build sliding windows (20, stride 3), and run parallel multi-label discourse classification.
- **Pass 2:** build 5 canonical sections (Problem/Motivation, Landscape, Contributions, Technical Core, Consequences), grounded with sentence IDs.
- **Pass 3:** generate 4 audience views (Domain Expert, Adjacent-field Researcher, Grad Student, Author Self), grounded with sentence IDs.
- **PDF preview:** compile and render the LaTeX source in-browser.
- **Audience PDF highlighting:** generate a highlighted PDF by injecting safe LaTeX macros around the selected supporting sentences.

All LLM calls are **server-only**.

### Setup

1) Install deps

```bash
cd discourse-pipeline
npm i
```

2) Configure env

```bash
cp .env.example .env.local
```

Set `OPENAI_API_KEY`. Default model is `gpt-5-mini` (override with `OPENAI_MODEL`).

### Vercel / production deployment (no TeX)

Vercel does not provide a TeX engine binary (like `tectonic`) in the runtime. For that reason, **TeX → PDF compilation is disabled by default in production**. Locally: you can keep PDF compilation (install `tectonic`).

To force-enable TeX compilation (only on runtimes that support native binaries), set:

```bash
NEXT_PUBLIC_ENABLE_TEX=1
```

3) Run

```bash
npm run dev
```

Open http://localhost:3000

### PDF preview with Tectonic

The side-by-side PDF preview uses the Tectonic TeX engine to compile the uploaded `.tex` file. You need the `tectonic` binary available in your PATH.

Recommended installs:

**macOS (Homebrew)**

```bash
brew install tectonic
```

**Linux / macOS (official install script)**

```bash
curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh
```

**Windows (PowerShell)**

```powershell
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://drop-ps1.fullyjustified.net'))
```

**Conda (cross-platform)**

```bash
conda install -c conda-forge tectonic
```

Verify the install:

```bash
tectonic --help
```

> Note: the compile endpoint currently uses `tectonic -X compile --synctex ...`
> (Tectonic-specific flags). If you want to use a different TeX engine, update
> `src/app/api/latex/compile/route.ts` accordingly.


### Highlighting status (PDF)

Current behavior (working):
- Highlights are injected directly into the LaTeX using `\dfhighlightword{...}` / `\dfhighlightmath{...}` macros.
- Audience PDF highlights use the same sentence/environment selection as the supporting-text panel.
- Environment propagation is supported for theorem-like environments (theorem/lemma/proposition/corollary/claim/conjecture/definition/example).
- Highlighting is **word-level** (not whitespace), which preserves line breaking and avoids overfull boxes.
- Display-math blocks are not highlighted (to avoid breaking `$$...$$` or `\begin{equation}`).

What we tried (and why it failed):
- **SyncTeX overlays (client-side boxes):** alignment drift and inconsistent mapping for sentences; brittle with font/layout changes.
- **`soul` / `\hl{}` full-span highlights:** frequent LaTeX errors with math-heavy text (`Reconstruction failed`) and unstable on complex macros.
- **Highlighting whitespace inside `\colorbox{}`:** caused line-breaking failures and text spilling into the margin.
- **Injecting highlights inside display math:** caused `Missing $ inserted` errors (now explicitly avoided).

Open improvements:
- Robust, line-level background highlighting that respects math and does not break line wrapping.
- A safer math-aware highlighter for display-math blocks (e.g., `\colorbox` in `\mathchoice`, or a true TeX parser).
- Optional post-processing or PDF-layer highlight approach if SyncTeX can be made reliable (might require a dedicated mapping library).
