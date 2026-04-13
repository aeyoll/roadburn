<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Roadburn 2026</ion-title>
      </ion-toolbar>
      <ion-toolbar class="day-toolbar">
        <div class="day-pills" role="tablist" aria-label="Select day">
          <button
            v-for="day in days"
            :key="day.id"
            role="tab"
            class="day-pill"
            :class="{ 'day-pill-active': day.id === selectedDayId }"
            :aria-selected="day.id === selectedDayId"
            @click="selectDay(day.id)"
          >
            <span class="day-pill-name">{{ day.titleShort }}</span>
            <span class="day-pill-date">{{ day.subtitleShort }}</span>
          </button>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-spinner v-if="loading" name="crescent" class="timetable-spinner" />

      <div v-if="error" class="timetable-error">
        <ion-text color="danger">
          <p>{{ error }}</p>
        </ion-text>
        <ion-button @click="loadData">Retry</ion-button>
      </div>

      <div
        v-if="!loading && !error && timelineStart !== null"
        class="timetable-scroll"
        @touchstart="pinchStart"
        @touchmove="pinchMove"
        @wheel.ctrl="zoomWheel"
      >
        <div
            class="timetable-grid"
            :aria-label="'Timetable for ' + selectedDayLabel" role="grid"
            :style="{
              transform: `scaleX(${scale})`
            }"
        >
          <div
            class="timetable-header"
            role="row"
          >
            <div class="timetable-time-header" role="columnheader">
              <span class="sr-only">Time</span>
            </div>
            <div
              v-for="stage in activeStages"
              :key="stage.id"
              class="timetable-stage-header"
              role="columnheader"
              :style="{
                transform: `scaleX(${1 / scale})`
              }"
            >
              {{ stage.title }}
            </div>
          </div>

          <div
            class="timetable-body"
            :style="{
              height: timelineHeight + 'px',
              transform: `scaleY(${scale}) scaleX(${1 /scale})`
            }"
          >
            <div class="timetable-time-column">
              <div
                v-for="slot in timeSlots"
                :key="slot.timestamp"
                class="timetable-time-marker"
                :style="{
                  top: timestampToPixels(slot.timestamp) + 'px',
                  transform: `scaleY(${1 / scale})`
                }"
              >
                {{ slot.label }}
              </div>
            </div>

            <div class="timetable-lanes" :style="{
                height: timelineHeight + 'px',
                  transform: `scaleX(${scale})`
                }">
              <div class="timetable-gridlines">
                <div
                  v-for="slot in timeSlots"
                  :key="slot.timestamp"
                  class="timetable-gridline"
                  :style="{
                    top: timestampToPixels(slot.timestamp) + 'px',
                    transform: `scaleY(${1 / scale})`
                  }"
                />
              </div>

              <div
                v-for="(stage, stageIdx) in activeStages"
                :key="stage.id"
                class="timetable-lane"
                :style="{ left: stageIdx * stageColumnWidth + 'px', width: stageColumnWidth + 'px' }"
              >
                <button
                  v-for="gig in gigsForStage(stage.id)"
                  :key="gig.id"
                  class="timetable-gig"
                  :class="'timetable-gig--bookmark-' + getGigBookmarkColor(gig.id)"
                  :style="{
                    ...gigStyle(gig),
                    // transform: `scaleX(${scale})`
                  }"
                  :aria-label="gigAriaLabel(gig, stage.title)"
                  @click="openGigDetail(gig)"
                >
                  <span class="timetable-gig-title">{{ gig.title }}</span>
                  <span class="timetable-gig-time">{{ formatTime(gig.startTimestamp) }} - {{ formatTime(gig.endTimestamp) }}</span>
                  <span
                    v-if="gigNotePreview(gig.id)"
                    class="timetable-gig-note"
                  >{{ gigNotePreview(gig.id) }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSpinner,
  IonText,
  IonButton,
  modalController,
} from '@ionic/vue';
import type { Day, Stage, Gig, Artist, BookmarkStatus } from '@/types/festival';
import { fetchFestivalDashboard } from '@/services/api';
import { initBookmarks, getBookmark, getBookmarkColor, subscribeBookmarksChanged } from '@/services/bookmarks';
import { initGigNotes, getGigNote, subscribeGigNotesChanged } from '@/services/gigNotes';
import { syncGigReminders } from '@/services/gigNotifications';
import GigDetailModal from '@/components/GigDetailModal.vue';

const PIXELS_PER_MINUTE = 2;
const SLOT_INTERVAL = 30;
const stageColumnWidth = 150;

const loading = ref(true);
const error = ref<string | null>(null);

const days = ref<Day[]>([]);
const stages = ref<Stage[]>([]);
const gigs = ref<Gig[]>([]);
const artists = ref<Artist[]>([]);
const selectedDayId = ref<number | undefined>();

const bookmarkVersion = ref(0);
const notesVersion = ref(0);

const selectedDayLabel = computed(() => {
  const day = days.value.find((d) => d.id === selectedDayId.value);

  return day?.description ?? '';
});

const gigsForDay = computed(() =>
  gigs.value.filter((g) => g.dayId === selectedDayId.value),
);

const activeStages = computed(() => {
  const stageIds = new Set(gigsForDay.value.map((g) => g.stageId));

  return stages.value
    .filter((s) => stageIds.has(s.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);
});

const timelineStart = computed<number | null>(() => {
  if (gigsForDay.value.length === 0) {
    return null;
  }

  const earliest = Math.min(...gigsForDay.value.map((g) => g.startTimestamp));
  const step = SLOT_INTERVAL * 60;

  return Math.floor(earliest / step) * step;
});

const timelineEnd = computed<number>(() => {
  if (gigsForDay.value.length === 0) {
    return 0;
  }

  return Math.max(...gigsForDay.value.map((g) => g.endTimestamp));
});

interface TimeSlot {
  timestamp: number;
  label: string;
}

const timeSlots = computed<TimeSlot[]>(() => {
  if (timelineStart.value === null) {
    return [];
  }

  const slots: TimeSlot[] = [];
  const step = SLOT_INTERVAL * 60;

  for (let t = timelineStart.value; t <= timelineEnd.value; t += step) {
    slots.push({
      timestamp: t,
      label: formatTime(t),
    });
  }

  return slots;
});

const timelineHeight = computed(() => {
  if (timelineStart.value === null) {
    return 0;
  }

  const minutes = (timelineEnd.value - timelineStart.value) / 60;

  return minutes * PIXELS_PER_MINUTE;
});

const scale = ref(1);
const initialDistance = ref(0);

const pinchStart = (event: TouchEvent) => {
    if (event.touches.length === 2) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];

        initialDistance.value = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
    }
};

const pinchMove = (event: TouchEvent) => {
    if (event.touches.length === 2) {
        event.preventDefault();
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const currentDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );

        scale.value = Math.max(0.5, Math.min(3, currentDistance / initialDistance.value));
        if (scale.value < 0.5) {
            scale.value = 0.5;
        }
    }
};

const zoomWheel = ($event: WheelEvent) => {
    $event.preventDefault();

    scale.value += $event.deltaY * -0.01;
    if (scale.value < 0.5) {
        scale.value = 0.5;
    }
};

function timestampToPixels(timestamp: number): number {
  if (timelineStart.value === null) {
    return 0;
  }

  const minutes = (timestamp - timelineStart.value) / 60;

  return minutes * PIXELS_PER_MINUTE;
}

function gigStyle(gig: Gig): Record<string, string> {
  const top = timestampToPixels(gig.startTimestamp);
  const height = timestampToPixels(gig.endTimestamp) - top;

  return {
    top: top + 'px',
    height: height + 'px',
  };
}

function gigsForStage(stageId: number): Gig[] {
  return gigsForDay.value
    .filter((g) => g.stageId === stageId)
    .sort((a, b) => a.startTimestamp - b.startTimestamp);
}

function getGigBookmarkColor(gigId: number): string {
  void bookmarkVersion.value;

  return getBookmarkColor(getBookmark(gigId));
}

function gigNotePreview(gigId: number): string {
  void notesVersion.value;
  const text = getGigNote(gigId);

  if (!text) {
    return '';
  }

  const max = 48;

  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function gigAriaLabel(gig: Gig, stageTitle: string): string {
  void notesVersion.value;
  const base = `${gig.title} at ${stageTitle}, ${gig.displayDate}`;
  const note = getGigNote(gig.id);

  if (!note) {
    return base;
  }

  return `${base}. Note: ${note}`;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);

  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });
}

function selectDay(dayId: number) {
  selectedDayId.value = dayId;
}

async function openGigDetail(gig: Gig) {
  const artist = artists.value.find((a) => a.id === gig.artistId);
  const modal = await modalController.create({
    component: GigDetailModal,
    componentProps: {
      gig,
      artist,
    },
  });

  await modal.present();

  await modal.onDidDismiss<BookmarkStatus>();
}

async function loadData() {
  loading.value = true;
  error.value = null;

  try {
    const [data] = await Promise.all([
      fetchFestivalDashboard(),
      initBookmarks(),
      initGigNotes(),
    ]);
    days.value = data.days.sort((a, b) => a.sortOrder - b.sortOrder);
    stages.value = data.stages.sort((a, b) => a.sortOrder - b.sortOrder);
    gigs.value = data.gigs;
    artists.value = data.artists;

    if (days.value.length > 0) {
      selectedDayId.value = days.value[0].id;
    }

    await syncGigReminders(gigs.value);
  } catch (e) {
    error.value = 'Failed to load festival data. Please try again.';
    console.error(e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
});

onUnmounted(
  subscribeBookmarksChanged(() => {
    bookmarkVersion.value++;
    void syncGigReminders(gigs.value);
  }),
);

onUnmounted(
  subscribeGigNotesChanged(() => {
    notesVersion.value++;
  }),
);
</script>

<style scoped>
.day-toolbar {
  --background: var(--ion-background-color, #121220);
  --border-width: 0;
  --padding-start: 0;
  --padding-end: 0;
}

.day-pills {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 4px 12px 10px;
  scrollbar-width: none;
}

.day-pills::-webkit-scrollbar {
  display: none;
}

.day-pill {
  align-items: center;
  background: var(--ion-color-light, #2a2a3e);
  border: 2px solid transparent;
  border-radius: 10px;
  color: var(--ion-text-color, #f0f0f5);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 1px;
  padding: 8px 16px;
  transition: background 0.2s, border-color 0.2s;
}

.day-pill:focus-visible {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: 2px;
}

.day-pill-active {
  background: var(--ion-color-primary);
  border-color: var(--ion-color-primary);
}

.day-pill-name {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.day-pill-date {
  font-size: 10px;
  opacity: 0.8;
}

.timetable-spinner {
  display: block;
  margin: 40vh auto 0;
}

.timetable-error {
  padding: 32px;
  text-align: center;
}

.timetable-scroll {
  height: 100%;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.timetable-grid {
  display: flex;
  flex-direction: column;
  min-width: max-content;
  transform-origin: left top;

  * {
    transform-origin: left top;
  }
}

.timetable-header {
  position: sticky;
  top: 0;
  z-index: 4;
  display: flex;
  background: var(--ion-toolbar-background, #1a1a2e);
}

.timetable-time-header {
  position: sticky;
  left: 0;
  z-index: 5;
  flex-shrink: 0;
  min-width: 54px;
}

.timetable-stage-header {
  background: var(--ion-toolbar-background, #1a1a2e);
  box-sizing: border-box;
  color: var(--ion-text-color, #f0f0f5);
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  min-width: 150px;
  padding: 10px 6px;
  text-align: center;
  text-transform: uppercase;
  white-space: nowrap;
  width: 150px;
}

.timetable-body {
  display: flex;
  position: relative;
}

.timetable-time-column {
  background: var(--ion-background-color, #121220);
  flex-shrink: 0;
  min-width: 54px;
  position: sticky;
  left: 0;
  z-index: 2;
}

.timetable-time-marker {
  box-sizing: border-box;
  color: var(--ion-color-medium, #6b6b80);
  font-size: 11px;
  font-weight: 600;
  padding: 0 6px;
  position: absolute;
  text-align: right;
  transform: translateY(-50%);
  white-space: nowrap;
  width: 100%;
}

.timetable-lanes {
  flex: 1;
  position: relative;
}

.timetable-gridlines {
  inset: 0;
  pointer-events: none;
  position: absolute;
  z-index: 0;
}

.timetable-gridline {
  border-top: 1px solid rgba(255, 255, 255, 0.16);
  left: 0;
  position: absolute;
  right: 0;
}

.timetable-lane {
  position: absolute;
  top: 0;
  bottom: 0;
}

.timetable-gig {
  background: #0f0f0f;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-left: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  box-sizing: border-box;
  color: var(--ion-text-color, #f0f0f5);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  left: 3px;
  overflow: hidden;
  padding: 4px 8px;
  position: absolute;
  right: 3px;
  text-align: left;
  transition: box-shadow 0.15s;
}

.timetable-gig:active {
  transform: scale(0.97);
}

.timetable-gig:focus-visible {
  outline: 2px solid var(--ion-color-primary, #e53935);
  outline-offset: 1px;
}

.timetable-gig--bookmark-danger {
  border-left-color: var(--ion-color-danger, #ef5350);
  border-left-width: 3px;
}

.timetable-gig--bookmark-warning {
  border-left-color: var(--ion-color-warning, #ffb300);
  border-left-width: 3px;
}

.timetable-gig--bookmark-success {
  border-left-color: var(--ion-color-success, #4caf50);
  border-left-width: 3px;
}

.timetable-gig--bookmark-tertiary {
  border-left-color: var(--ion-color-tertiary, #42a5f5);
  border-left-width: 3px;
}


.timetable-gig-title {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timetable-gig-time {
  font-size: 10px;
  line-height: 1.2;
  opacity: 0.7;
}

.timetable-gig-note {
  color: var(--ion-color-medium, #a0a0b8);
  font-size: 9px;
  font-style: italic;
  line-height: 1.2;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sr-only {
  border: 0;
  clip: rect(0, 0, 0, 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}
</style>
