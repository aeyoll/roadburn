# Roadburn – project guide for AI assistants

This document describes what the repository is, how it is structured, and how to work on it safely and consistently.

## What this project is

Roadburn is a **festival companion app** for Roadburn (schedule, line-up, practical info). It is a **Vue 3 + Ionic** single-page application, packaged for **iOS and Android** with **Capacitor**. Festival content (stages, days, artists, gigs) is loaded from a **remote JSON API** at build/runtime, not embedded in the repo as the source of truth.

## Tech stack

| Layer | Choice |
|--------|--------|
| UI framework | Vue 3 (Composition API, `<script setup>`) |
| Mobile UI | Ionic Vue 8 (`@ionic/vue`, `@ionic/vue-router`) |
| Build | Vite 5, `@vitejs/plugin-vue`, `@vitejs/plugin-legacy` (older browsers) |
| Language | TypeScript (strict), `vue-tsc` on build |
| HTTP | `ky` – all API calls go through `src/services/api.ts` |
| Native shell | Capacitor 8 (`@capacitor/android`, `@capacitor/ios`) |
| Persistence | `@capacitor/preferences` for bookmark state and per-gig user notes |
| Notifications | `@capacitor/local-notifications` (native only) |
| Tests | Vitest + Vue Test Utils (unit), Cypress (e2e) |

## Repository layout

```
src/
  App.vue                 Root shell: ion-app + ion-router-outlet
  main.ts                 Vue/Ionic bootstrap, Ionic CSS, dark palette, theme
  router/index.ts         Routes and tab layout
  views/
    TabsPage.vue          Bottom tab bar: Timetable, Line-up, Info
    HomePage.vue          Timetable (day pills + multi-stage grid)
    LineupPage.vue        Searchable artist list + detail flow
    InfoPage.vue          Festival hero, tickets link, stats
  components/
    GigDetailModal.vue    Gig modal: stage, time, bookmarks, optional note field, artist HTML/links
  services/
    api.ts                Fetches festival JSON (`fetchFestivalDashboard`)
    bookmarks.ts          Gig bookmark state in Preferences (`roadburn-bookmarks`); JSON export/import (v1 legacy + v2 with notes)
    gigNotes.ts           Optional short text per gig id in Preferences (`roadburn-gig-notes`); included in bookmark export v2
    gigNotifications.ts   Schedules local notifications for bookmarked gigs
  types/
    festival.ts           TypeScript models: FestivalDashboard, Gig, Artist, etc.
  theme/
    variables.css         Ionic/CSS variables
capacitor.config.ts       App id, name, webDir (`dist`)
android/ / ios/           Native projects generated/maintained by Capacitor
tests/unit/               Vitest specs
tests/e2e/                Cypress specs and support
```

Path alias: `@/` maps to `src/` (see `vite.config.ts` and `tsconfig.json`).

## Data model and API

- **Endpoint:** `GET https://jp.bidega.in/roadburn.json`
- **Shape:** Top-level `{ data: FestivalDashboard }` (see `src/services/api.ts` and `src/types/festival.ts`).
- **FestivalDashboard** includes: festival metadata (`title`, `displayDate`, URLs), `stages`, `days`, `artists`, `gigs`.
- **Gigs** reference `artistId`, `stageId`, `dayId`, Unix `startTimestamp` / `endTimestamp`, `showInTimetable`, etc.
- **Bookmarks** are per **gig id**, not per artist: `BookmarkStatus` = `none` | `no` | `maybe` | `yes` | `mandatory`.
- **Gig notes** are per **gig id**: short plain text (max length in `gigNotes.ts`), edited in `GigDetailModal.vue`, shown on timetable blocks in `HomePage.vue`, stored locally only (not from the API).

Changing the API contract requires updating `festival.ts` and every consumer (views, notifications).

## Main product behavior

1. **Timetable (`HomePage.vue`):** Loads dashboard once (with error/retry). Day selector pills filter by `dayId`. Renders a **time-based grid** across **active stages**; gig blocks are positioned from timestamps. Tapping a gig opens **GigDetailModal**. Bookmark colors on blocks come from `bookmarks` + `getBookmarkColor`. If a gig has a user note, a truncated line is shown on the block (`gigNotes` + `subscribeGigNotesChanged` for live updates).
2. **Line-up (`LineupPage.vue`):** Lists artists (with search), shows stage hint and bookmark color from that artist’s **first matching gig** (`artistId`). Tapping an artist opens **GigDetailModal** only if a gig exists for that artist; otherwise the row does nothing.
3. **Info (`InfoPage.vue`):** Hero image from API, ticket link when `ticketUrl` is set, static location copy, counts from loaded data. **Export/import** writes or reads JSON with `format: "roadburn-bookmarks"`: **version 1** files contain bookmarks only (import does not alter notes). **Version 2** files add a `notes` object keyed by gig id string; importing v2 replaces all stored gig notes with the file contents (empty object clears notes).
4. **Bookmarks:** `initBookmarks()` should run before relying on in-memory cache; `setBookmark` persists to Capacitor Preferences.
5. **Gig notes:** `initGigNotes()` should run before relying on notes in the UI; `setGigNote` persists to Preferences. Export uses `buildBookmarksExportJson()` which embeds notes for v2.
6. **Reminders (`gigNotifications.ts`):** On **native** platforms only, if notification permission is granted: cancels/reschedules notifications for gigs whose bookmark is `maybe`, `yes`, or `mandatory`, firing **15 minutes before** `startTimestamp`. Uses stable numeric `id` per gig for notification ids. Android uses a dedicated channel.

## Routing

- `/` redirects to `/tabs/timetable`.
- Tab container: `/tabs/` → `TabsPage.vue` with child routes `timetable`, `lineup`, `info` (`createWebHistory`).

## Theming and styling

- Ionic **dark mode always** is enabled via `@ionic/vue/css/palettes/dark.always.css` in `main.ts`.
- Component-specific layout and timetable styling live in `<style scoped>` blocks in the Vue SFCs (and `theme/variables.css` for tokens).
- Follow existing patterns when adding UI; workspace rules prefer semantic class names and accessibility (labels, roles where used).

## Capacitor / native

- **App ID:** `in.bidega.roadburn`  
- **App name:** Roadburn  
- **Web assets:** `dist` after `npm run build`  
- Regenerate icons/splash: `npm run assets:generate` (uses `@capacitor/assets`).

After web changes that should ship in the store, run `npm run build` then sync with Capacitor as your workflow requires (`npx cap sync` is typical).

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | `vue-tsc` + production Vite build → `dist` |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm run test:unit` | Vitest |
| `npm run test:e2e` | Cypress headless |
| `npm run assets:generate` | PWA/icon/splash assets for Capacitor |

## Conventions for contributors and AI edits

- Prefer **`ky`** for new HTTP calls (already the project standard).
- Keep **types** in sync with the real JSON; prefer small, explicit interfaces in `festival.ts`.
- **Bookmarks, notes, and notifications:** Changing bookmark statuses or lead time must stay consistent between `bookmarks.ts`, UI (e.g. `GigDetailModal`), `gigNotifications.ts` (`REMINDER_STATUSES`, `REMINDER_LEAD_SECONDS`), and any user-facing copy. Changing note length limits or export shape must stay consistent between `gigNotes.ts`, `bookmarks.ts` (export `version` / `notes` field), and Info import copy.
- **Security / content:** Artist `text` is rendered with `v-html` in the gig modal; treat API as trusted or sanitize if the source changes.
- Do not commit secrets; the API URL is currently public in `api.ts`.
- Match existing **Vue + Ionic** patterns: `script setup`, Ionic components, `modalController` where modals are used.

## Related docs

There is no root `README.md` in this repo at time of writing; this file is the high-level orientation for humans and coding agents.
