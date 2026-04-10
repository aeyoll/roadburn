<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Roadburn 2026</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment
          :value="selectedDayId"
          @ion-change="onDayChange"
          scrollable
        >
          <ion-segment-button
            v-for="day in days"
            :key="day.id"
            :value="day.id"
          >
            <ion-label>
              <strong>{{ day.titleShort }}</strong>
              <br />
              {{ day.subtitleShort }}
            </ion-label>
          </ion-segment-button>
        </ion-segment>
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
      >
        <div class="timetable-grid" :aria-label="'Timetable for ' + selectedDayLabel" role="grid">
          <div class="timetable-header" role="row">
            <div class="timetable-time-header" role="columnheader">
              <span class="sr-only">Time</span>
            </div>
            <div
              v-for="stage in activeStages"
              :key="stage.id"
              class="timetable-stage-header"
              role="columnheader"
            >
              {{ stage.title }}
            </div>
          </div>

          <div class="timetable-body" :style="{ height: timelineHeight + 'px' }">
            <div class="timetable-time-column">
              <div
                v-for="slot in timeSlots"
                :key="slot.timestamp"
                class="timetable-time-marker"
                :style="{ top: timestampToPixels(slot.timestamp) + 'px' }"
              >
                {{ slot.label }}
              </div>
            </div>

            <div class="timetable-lanes" :style="{ height: timelineHeight + 'px' }">
              <div class="timetable-gridlines">
                <div
                  v-for="slot in timeSlots"
                  :key="slot.timestamp"
                  class="timetable-gridline"
                  :style="{ top: timestampToPixels(slot.timestamp) + 'px' }"
                />
              </div>

              <div
                v-for="(stage, colIndex) in activeStages"
                :key="stage.id"
                class="timetable-lane"
                :style="{ left: colIndex * stageColumnWidth + 'px', width: stageColumnWidth + 'px' }"
              >
                <button
                  v-for="gig in gigsForStage(stage.id)"
                  :key="gig.id"
                  class="timetable-gig"
                  :class="'timetable-gig--' + getGigBookmarkColor(gig.id)"
                  :style="gigStyle(gig)"
                  :aria-label="gig.title + ' at ' + stage.title + ', ' + gig.displayDate"
                  @click="openGigDetail(gig)"
                >
                  <span class="timetable-gig-title">{{ gig.title }}</span>
                  <span class="timetable-gig-time">{{ formatTime(gig.startTimestamp) }} - {{ formatTime(gig.endTimestamp) }}</span>
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
import { ref, computed, onMounted } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSpinner,
  IonText,
  IonButton,
  modalController,
} from '@ionic/vue';
import type { Day, Stage, Gig, Artist, BookmarkStatus } from '@/types/festival';
import { fetchFestivalDashboard } from '@/services/api';
import { getBookmark, getBookmarkColor } from '@/services/bookmarks';
import GigDetailModal from '@/components/GigDetailModal.vue';

const PIXELS_PER_MINUTE = 2;
const SLOT_INTERVAL = 30;
const stageColumnWidth = 140;

const loading = ref(true);
const error = ref<string | null>(null);

const days = ref<Day[]>([]);
const stages = ref<Stage[]>([]);
const gigs = ref<Gig[]>([]);
const artists = ref<Artist[]>([]);
const selectedDayId = ref<number | undefined>();

const bookmarkVersion = ref(0);

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

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);

  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });
}

function onDayChange(event: CustomEvent) {
  selectedDayId.value = Number(event.detail.value);
}

async function openGigDetail(gig: Gig) {
  const artist = artists.value.find((a) => a.id === gig.artistId);
  const modal = await modalController.create({
    component: GigDetailModal,
    componentProps: { gig, artist },
  });

  await modal.present();

  const { data } = await modal.onDidDismiss<BookmarkStatus>();

  if (data !== undefined) {
    bookmarkVersion.value++;
  }
}

async function loadData() {
  loading.value = true;
  error.value = null;

  try {
    const data = await fetchFestivalDashboard();
    days.value = data.days.sort((a, b) => a.sortOrder - b.sortOrder);
    stages.value = data.stages.sort((a, b) => a.sortOrder - b.sortOrder);
    gigs.value = data.gigs;
    artists.value = data.artists;

    if (days.value.length > 0) {
      selectedDayId.value = days.value[0].id;
    }
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
</script>

<style scoped>
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
}

.timetable-header {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 4;
}

.timetable-time-header {
  background: var(--ion-color-dark, #222);
  flex-shrink: 0;
  min-width: 60px;
  position: sticky;
  left: 0;
  z-index: 5;
}

.timetable-stage-header {
  background: var(--ion-color-dark, #222);
  box-sizing: border-box;
  color: var(--ion-color-dark-contrast, #fff);
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  min-width: 140px;
  padding: 10px 4px;
  text-align: center;
  white-space: nowrap;
  width: 140px;
}

.timetable-body {
  display: flex;
  position: relative;
}

.timetable-time-column {
  background: var(--ion-background-color, #fff);
  flex-shrink: 0;
  min-width: 60px;
  position: sticky;
  left: 0;
  z-index: 2;
}

.timetable-time-marker {
  box-sizing: border-box;
  font-size: 11px;
  font-weight: 500;
  padding: 0 8px;
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
  border-top: 1px solid var(--ion-color-light, #e0e0e0);
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
  background: var(--ion-color-light, #f0f0f0);
  border: 2px solid transparent;
  border-radius: 6px;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  left: 2px;
  overflow: hidden;
  padding: 4px 6px;
  position: absolute;
  right: 2px;
  text-align: left;
}

.timetable-gig:focus-visible {
  outline: 2px solid var(--ion-color-primary, #3880ff);
  outline-offset: 2px;
}

.timetable-gig--danger {
  border-color: var(--ion-color-danger, #eb445a);
}

.timetable-gig--warning {
  border-color: var(--ion-color-warning, #ffc409);
}

.timetable-gig--success {
  border-color: var(--ion-color-success, #2dd36f);
}

.timetable-gig--primary {
  border-color: var(--ion-color-primary, #3880ff);
}

.timetable-gig--medium {
  border-color: transparent;
}

.timetable-gig-title {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
}

.timetable-gig-time {
  color: var(--ion-color-medium, #999);
  font-size: 10px;
  line-height: 1.2;
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
