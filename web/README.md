# ExpiryLens dashboard

The public site at https://dhiraj-tapkir.github.io/expirylens/

A static Next.js app with D3 charts. It reads three JSON files of derived
results from `public/data/` (exported by `pipelines/export_site_data.py`), so
it needs no server and no raw market data.

## Pages

| Page | What it shows |
|---|---|
| Overview | Every day's late move, split by settlement era |
| Findings | The four permutation tests, with every day behind each one |
| Explorer | Zoomable timeline with axis value tags and a detail card per day |
| Calendar | One square per session, expiries outlined, holidays dashed |
| Method | The pipeline, step by step, with real numbers |

Every chart is clickable, both themes follow the system setting (or the toggle
in the dock), and URLs like `/explorer/?index=NIFTY&day=2026-08-04` open
straight onto a day.

## Run it

```bash
npm ci
npm run dev     # http://localhost:3000/expirylens/
npm run build   # static files in out/
```

Pushing to `main` builds and deploys the site through
`.github/workflows/pages.yml`.

## Layout

| Path | What's in it |
|---|---|
| `app/` | One folder per page, plus the shared layout and page transition |
| `components/` | Dock, crosshair cursor, logo |
| `components/charts/` | The D3 charts |
| `lib/data.ts` | Types, test results and formatting helpers |
| `public/data/` | Exported results the site reads |
