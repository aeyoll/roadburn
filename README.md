# Roadburn

Festival companion app for Roadburn: timetable, line-up, practical info, bookmarks, optional per-gig notes, and (on native builds) local reminders before bookmarked shows.

The UI is a **Vue 3 + Ionic** web app built with **Vite** and wrapped for **iOS and Android** with **Capacitor**. Schedule and artist data are loaded at runtime from a public JSON API (not vendored in this repository).

## Requirements

- **Node.js** current or active LTS (the toolchain uses Vite 5, TypeScript 5.9, and Capacitor 8).
- **npm** (or another client compatible with `package-lock.json` if you use one).

## Quick start

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check (`vue-tsc`) and production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run test:unit` | Vitest unit tests |
| `npm run test:e2e` | Cypress end-to-end tests (headless) |
| `npm run assets:generate` | Regenerate app icons and splash screens (`@capacitor/assets`) |

## Native apps

After `npm run build`, sync web assets into the native projects (typical workflow):

```bash
npx cap sync
```

Open Xcode or Android Studio from the `ios/` and `android/` directories as needed. App id: `in.bidega.roadburn`. See `capacitor.config.ts` for `appId`, `appName`, and `webDir`.

## API and data

The client fetches festival JSON from the URL configured in `src/services/api.ts`. Types and consumers live under `src/types/` and `src/services/`; changing the API shape requires updating those types and all usages (views, notifications, export/import).

## Documentation

- **[AGENTS.md](./AGENTS.md)** — Repository layout, product behavior, bookmarks/notes/notifications rules, and conventions for contributors and tooling (including AI assistants).

For day-to-day web work, `npm run dev` and `npm run lint` are enough; before a store release, run `npm run build` and your Capacitor sync steps.
