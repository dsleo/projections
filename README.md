## LLM-Based Scientific Discourse Structuring Pipeline

Upload a `.tex` research paper and this app will:

- **Pass 1 (LLM-SSC):** deterministically segment into sentences, build sliding windows (20, stride 3), and run parallel multi-label discourse classification.
- **Pass 2:** build 5 canonical sections (Problem/Motivation, Landscape, Contributions, Technical Core, Consequences), grounded with sentence IDs.

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

Set `OPENAI_API_KEY`.

Default model is `gpt-5-mini` (override with `OPENAI_MODEL`).

If you don’t set `OPENAI_API_KEY`, the app will still run, but `/api/analyze` will return 500.

3) Run

```bash
npm run dev
```

Open http://localhost:3000

### Notes

- Minimal LaTeX preprocessing only: comment stripping, macro-definition removal, and bibliography removal.
- Sentence IDs are global and strictly increasing.
- Pass 1 aggregation is **union** across windows (no majority vote).
- Outputs are validated with Zod schemas; invalid JSON is retried.
