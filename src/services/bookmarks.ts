import type { BookmarkStatus } from '@/types/festival';

const STORAGE_KEY = 'roadburn-bookmarks';

function loadBookmarks(): Record<number, BookmarkStatus> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveBookmarks(bookmarks: Record<number, BookmarkStatus>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

export function getBookmark(gigId: number): BookmarkStatus {
  const bookmarks = loadBookmarks();

  return bookmarks[gigId] ?? 'none';
}

export function setBookmark(gigId: number, status: BookmarkStatus): void {
  const bookmarks = loadBookmarks();

  if (status === 'none') {
    delete bookmarks[gigId];
  } else {
    bookmarks[gigId] = status;
  }

  saveBookmarks(bookmarks);
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
      return 'primary';
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
