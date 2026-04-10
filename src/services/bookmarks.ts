import { Preferences } from '@capacitor/preferences';
import type { BookmarkStatus } from '@/types/festival';

const STORAGE_KEY = 'roadburn-bookmarks';

let cache: Record<number, BookmarkStatus> = {};

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
