## FourFold, transform your scientific paper into audience-specific summaries

FourFold is a small web app for researchers that helps you *re-express the same paper for different readers*.

Upload a LaTeX (`.tex`) paper and FourFold will generate:

- **4 audience views**: Domain Expert, Adjacent-field Researcher, Grad Student, and “Future Author Self”.
- **A canonical structure** of the paper (5 sections: Problem/Motivation, Landscape, Contributions, Technical Core, Consequences).
- **Grounding**: generated outputs reference the paper’s sentences via stable sentence IDs.
- **Optional PDF preview + highlighting**: compile the LaTeX and produce a highlighted PDF for the selected supporting sentences (local by default).

### Who is this for?

- **Researchers** who want to quickly produce variants of the same story: for a lab mate, an advisor, or a broader research audience.
- **Reviewers / readers** who want a fast, structured understanding of a paper.
- **Contributors** who want to iterate on a grounded “discourse → sections → audience views” pipeline.

### Typical use cases

- Producing a clean “adjacent-field” explanation for collaborators.
- Checking whether the paper’s *contributions* and *technical core* are actually supported by the text.

---

## Quickstart

1) Install dependencies

```bash
npm i
```

2) Configure environment

```bash
cp .env.example .env.local
```

Set `OPENAI_API_KEY`.

Default model is `gpt-5-mini` (override with `OPENAI_MODEL`).

3) Run

```bash
npm run dev
```

Open http://localhost:3000

---

## How it works - at a  high level

The pipeline is intentionally simple and grounded:

- **Pass 1**: deterministically segment the paper into sentences, build sliding windows, and run parallel multi-label discourse classification.
- **Pass 2**: build 5 canonical sections (Problem/Motivation, Landscape, Contributions, Technical Core, Consequences), grounded with sentence IDs.
- **Pass 3**: generate 4 audience views (Domain Expert, Adjacent-field Researcher, Grad Student, Author Self), grounded with sentence IDs.

### Production deployment (no TeX)

Vercel does not provide a TeX engine binary (like `tectonic`) in the runtime. For that reason, **TeX → PDF compilation is disabled by default in production**. Locally: you can keep PDF compilation (install `tectonic`).

To force-enable TeX compilation (only on runtimes that support native binaries), set:

```bash
NEXT_PUBLIC_ENABLE_TEX=1
```

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

### Highlighting notes

Implementation details, tradeoffs, and known limitations live in:

- `docs/highlighting.md`
