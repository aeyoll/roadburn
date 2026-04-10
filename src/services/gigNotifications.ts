import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getBookmark } from '@/services/bookmarks';
import type { BookmarkStatus, Gig } from '@/types/festival';

const REMINDER_LEAD_SECONDS = 15 * 60;
const ANDROID_CHANNEL_ID = 'gig-reminders';

const REMINDER_STATUSES: BookmarkStatus[] = ['maybe', 'yes', 'mandatory'];

function reminderAtMs(gig: Gig): number {
  return (gig.startTimestamp - REMINDER_LEAD_SECONDS) * 1000;
}

export async function syncGigReminders(gigs: Gig[]): Promise<void> {
  if (!Capacitor.isNativePlatform() || gigs.length === 0) {
    return;
  }

  try {
    const checked = await LocalNotifications.checkPermissions();

    if (checked.display !== 'granted') {
      const requested = await LocalNotifications.requestPermissions();

      if (requested.display !== 'granted') {
        return;
      }
    }

    if (Capacitor.getPlatform() === 'android') {
      await LocalNotifications.createChannel({
        description: 'Reminders before bookmarked gigs start',
        id: ANDROID_CHANNEL_ID,
        importance: 4,
        name: 'Gig reminders',
      });
    }

    const nowMs = Date.now();

    await LocalNotifications.cancel({
      notifications: gigs.map((g) => ({ id: g.id })),
    });

    const notifications = [];

    for (const gig of gigs) {
      const status = getBookmark(gig.id);

      if (!REMINDER_STATUSES.includes(status)) {
        continue;
      }

      const atMs = reminderAtMs(gig);

      if (atMs <= nowMs) {
        continue;
      }

      notifications.push({
        body: `${gig.title} — ${gig.stageTitle}`,
        channelId: Capacitor.getPlatform() === 'android' ? ANDROID_CHANNEL_ID : undefined,
        id: gig.id,
        schedule: { at: new Date(atMs) },
        title: 'Gig starts in 15 minutes',
      });
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch (e) {
    console.error('syncGigReminders failed', e);
  }
}
