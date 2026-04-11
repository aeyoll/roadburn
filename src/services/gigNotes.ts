import { Preferences } from '@capacitor/preferences';

const STORAGE_KEY = 'roadburn-gig-notes';

export const GIG_NOTE_MAX_LENGTH = 200;

let cache: Record<number, string> = {};

const gigNotesChangeListeners = new Set<() => void>();

export function subscribeGigNotesChanged(callback: () => void): () => void {
  gigNotesChangeListeners.add(callback);

  return () => {
    gigNotesChangeListeners.delete(callback);
  };
}

function notifyGigNotesChanged(): void {
  gigNotesChangeListeners.forEach((cb) => {
    cb();
  });
}

export async function initGigNotes(): Promise<void> {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    cache = value ? JSON.parse(value) : {};
  } catch {
    cache = {};
  }
}

async function persistGigNotes(): Promise<void> {
  await Preferences.set({
    key: STORAGE_KEY,
    value: JSON.stringify(cache),
  });
}

function normalizeNote(text: string): string {
  return text.trim().slice(0, GIG_NOTE_MAX_LENGTH);
}

export function getGigNote(gigId: number): string {
  return cache[gigId] ?? '';
}

export async function setGigNote(gigId: number, text: string): Promise<void> {
  const normalized = normalizeNote(text);

  if (normalized === '') {
    delete cache[gigId];
  } else {
    cache[gigId] = normalized;
  }

  await persistGigNotes();
  notifyGigNotesChanged();
}

export function getNotesForExport(): Record<string, string> {
  const notes: Record<string, string> = {};

  for (const [idStr, text] of Object.entries(cache)) {
    const id = Number(idStr);

    if (text !== '' && Number.isInteger(id) && id > 0) {
      notes[String(id)] = text;
    }
  }

  return notes;
}

export async function replaceAllGigNotesFromImport(next: Record<number, string>): Promise<void> {
  cache = { ...next };
  await persistGigNotes();
  notifyGigNotesChanged();
}
