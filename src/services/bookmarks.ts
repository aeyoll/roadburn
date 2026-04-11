import { Preferences } from '@capacitor/preferences';
import type { BookmarkStatus } from '@/types/festival';

const STORAGE_KEY = 'roadburn-bookmarks';

const BOOKMARK_EXPORT_FORMAT = 'roadburn-bookmarks' as const;
const BOOKMARK_EXPORT_VERSION = 1 as const;

const VALID_STATUSES: BookmarkStatus[] = ['none', 'no', 'maybe', 'yes', 'mandatory'];

let cache: Record<number, BookmarkStatus> = {};

const bookmarkChangeListeners = new Set<() => void>();

export function subscribeBookmarksChanged(callback: () => void): () => void {
  bookmarkChangeListeners.add(callback);

  return () => {
    bookmarkChangeListeners.delete(callback);
  };
}

function notifyBookmarksChanged(): void {
  bookmarkChangeListeners.forEach((cb) => {
    cb();
  });
}

export async function initBookmarks(): Promise<void> {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    cache = value ? JSON.parse(value) : {};
  } catch {
    cache = {};
  }
}

async function persistBookmarks(): Promise<void> {
  await Preferences.set({
    key: STORAGE_KEY,
    value: JSON.stringify(cache),
  });
}

export function getBookmark(gigId: number): BookmarkStatus {
  return cache[gigId] ?? 'none';
}

export async function setBookmark(gigId: number, status: BookmarkStatus): Promise<void> {
  if (status === 'none') {
    delete cache[gigId];
  } else {
    cache[gigId] = status;
  }

  await persistBookmarks();
  notifyBookmarksChanged();
}

export function getBookmarkColor(status: BookmarkStatus): string {
  switch (status) {
    case 'no':
      return 'danger';
    case 'maybe':
      return 'warning';
    case 'yes':
      return 'success';
    case 'mandatory':
      return 'tertiary';
    default:
      return 'medium';
  }
}

export function getBookmarkLabel(status: BookmarkStatus): string {
  switch (status) {
    case 'no':
      return 'No';
    case 'maybe':
      return 'Maybe';
    case 'yes':
      return 'Yes';
    case 'mandatory':
      return 'Mandatory';
    default:
      return 'Not set';
  }
}

function isBookmarkStatus(value: unknown): value is BookmarkStatus {
  return typeof value === 'string' && VALID_STATUSES.includes(value as BookmarkStatus);
}

export function buildBookmarksExportJson(): string {
  const bookmarks: Record<string, BookmarkStatus> = {};

  for (const [idStr, status] of Object.entries(cache)) {
    const id = Number(idStr);

    if (status !== 'none' && Number.isInteger(id) && id > 0) {
      bookmarks[String(id)] = status;
    }
  }

  const payload = {
    bookmarks,
    exportedAt: new Date().toISOString(),
    format: BOOKMARK_EXPORT_FORMAT,
    version: BOOKMARK_EXPORT_VERSION,
  };

  return JSON.stringify(payload, null, 2);
}

export class BookmarksImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookmarksImportError';
  }
}

function parseBookmarksImportPayload(text: string): Record<number, BookmarkStatus> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new BookmarksImportError('The file is not valid JSON.');
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BookmarksImportError('Invalid bookmark file structure.');
  }

  const record = parsed as Record<string, unknown>;

  if (record.format !== BOOKMARK_EXPORT_FORMAT) {
    throw new BookmarksImportError('This file is not a Roadburn bookmarks export.');
  }

  if (record.version !== BOOKMARK_EXPORT_VERSION) {
    throw new BookmarksImportError('Unsupported bookmark file version.');
  }

  const rawBookmarks = record.bookmarks;

  if (rawBookmarks === null || typeof rawBookmarks !== 'object' || Array.isArray(rawBookmarks)) {
    throw new BookmarksImportError('Invalid bookmarks data in file.');
  }

  const next: Record<number, BookmarkStatus> = {};

  for (const [key, value] of Object.entries(rawBookmarks)) {
    if (!/^\d+$/.test(key)) {
      throw new BookmarksImportError(`Invalid gig id in file: ${key}`);
    }

    const gigId = Number(key);

    if (!Number.isInteger(gigId) || gigId < 1) {
      throw new BookmarksImportError(`Invalid gig id in file: ${key}`);
    }

    if (!isBookmarkStatus(value)) {
      throw new BookmarksImportError(`Invalid bookmark status for gig ${key}.`);
    }

    if (value !== 'none') {
      next[gigId] = value;
    }
  }

  return next;
}

export function validateBookmarksImportFile(text: string): void {
  parseBookmarksImportPayload(text);
}

export async function importBookmarksFromJson(text: string): Promise<void> {
  cache = parseBookmarksImportPayload(text);
  await persistBookmarks();
  notifyBookmarksChanged();
}

export function exportBookmarksFilenameDatePrefix(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${y}-${m}-${day}`;
}
