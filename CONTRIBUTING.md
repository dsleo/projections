# Contributing

## Development setup

```bash
cd discourse-pipeline
npm i
cp .env.example .env.local
```

Run the dev server:

```bash
npm run dev
```

Run checks:

```bash
npm run lint
npm test
npm run build
```

## Notes about TeX compilation

This repo can compile LaTeX to PDF locally using `tectonic`.

- In production (e.g. Vercel) TeX compilation is **disabled by default**.
- To force-enable it (only if your runtime supports native binaries), set:

```bash
NEXT_PUBLIC_ENABLE_TEX=1
```

