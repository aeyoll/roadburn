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

      <div v-if="!loading && !error" class="timetable-container">
        <div class="timetable-scroll">
          <table class="timetable" role="grid" :aria-label="'Timetable for ' + selectedDayLabel">
            <thead>
              <tr>
                <th class="timetable-time-header" scope="col">
                  <span class="sr-only">Time</span>
                </th>
                <th
                  v-for="stage in activeStages"
                  :key="stage.id"
                  class="timetable-stage-header"
                  scope="col"
                >
                  {{ stage.title }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="slot in timeSlots" :key="slot.timestamp">
                <td class="timetable-time-cell">{{ slot.label }}</td>
                <td
                  v-for="stage in activeStages"
                  :key="stage.id"
                  class="timetable-gig-cell"
                >
                  <button
                    v-if="getGigAt(slot.timestamp, stage.id)"
                    class="timetable-gig-button"
                    :class="'timetable-gig-button--' + getGigBookmarkColor(getGigAt(slot.timestamp, stage.id)!.id)"
                    :aria-label="getGigAt(slot.timestamp, stage.id)!.title + ' at ' + stage.title"
                    @click="openGigDetail(getGigAt(slot.timestamp, stage.id)!)"
                  >
                    <span class="timetable-gig-title">{{ getGigAt(slot.timestamp, stage.id)!.title }}</span>
                    <span class="timetable-gig-time">{{ formatTime(getGigAt(slot.timestamp, stage.id)!.startTimestamp) }} - {{ formatTime(getGigAt(slot.timestamp, stage.id)!.endTimestamp) }}</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
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

interface TimeSlot {
  timestamp: number;
  label: string;
}

const timeSlots = computed<TimeSlot[]>(() => {
  if (gigsForDay.value.length === 0) {
    return [];
  }

  const allStarts = gigsForDay.value.map((g) => g.startTimestamp);
  const earliest = Math.min(...allStarts);
  const allEnds = gigsForDay.value.map((g) => g.endTimestamp);
  const latest = Math.max(...allEnds);

  const slots: TimeSlot[] = [];
  const step = 30 * 60; // 30 minutes

  const roundedStart = Math.floor(earliest / step) * step;

  for (let t = roundedStart; t < latest; t += step) {
    slots.push({
      timestamp: t,
      label: formatTime(t),
    });
  }

  return slots;
});

const gigLookup = computed(() => {
  // Trigger re-computation when bookmarks change
  void bookmarkVersion.value;

  const lookup = new Map<string, Gig>();

  for (const gig of gigsForDay.value) {
    const step = 30 * 60;
    const roundedStart = Math.floor(gig.startTimestamp / step) * step;
    const key = `${roundedStart}-${gig.stageId}`;
    lookup.set(key, gig);
  }

  return lookup;
});

function getGigAt(timestamp: number, stageId: number): Gig | undefined {
  return gigLookup.value.get(`${timestamp}-${stageId}`);
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

.timetable-container {
  height: 100%;
}

.timetable-scroll {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  height: 100%;
}

.timetable {
  border-collapse: collapse;
  min-width: 100%;
}

.timetable-stage-header {
  background: var(--ion-color-dark, #222);
  color: var(--ion-color-dark-contrast, #fff);
  font-size: 12px;
  font-weight: 600;
  min-width: 140px;
  padding: 8px 4px;
  position: sticky;
  text-align: center;
  top: 0;
  white-space: nowrap;
  z-index: 2;
}

.timetable-time-header {
  background: var(--ion-color-dark, #222);
  min-width: 60px;
  position: sticky;
  left: 0;
  top: 0;
  z-index: 3;
}

.timetable-time-cell {
  background: var(--ion-background-color, #fff);
  border-bottom: 1px solid var(--ion-color-light, #eee);
  font-size: 11px;
  font-weight: 500;
  left: 0;
  padding: 4px 8px;
  position: sticky;
  text-align: right;
  vertical-align: top;
  white-space: nowrap;
  z-index: 1;
}

.timetable-gig-cell {
  border-bottom: 1px solid var(--ion-color-light, #eee);
  border-left: 1px solid var(--ion-color-light, #eee);
  padding: 2px;
  vertical-align: top;
}

.timetable-gig-button {
  background: var(--ion-color-light, #f0f0f0);
  border: 2px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  text-align: left;
  width: 100%;
}

.timetable-gig-button:focus-visible {
  outline: 2px solid var(--ion-color-primary, #3880ff);
  outline-offset: 2px;
}

.timetable-gig-button--danger {
  border-color: var(--ion-color-danger, #eb445a);
}

.timetable-gig-button--warning {
  border-color: var(--ion-color-warning, #ffc409);
}

.timetable-gig-button--success {
  border-color: var(--ion-color-success, #2dd36f);
}

.timetable-gig-button--primary {
  border-color: var(--ion-color-primary, #3880ff);
}

.timetable-gig-button--medium {
  border-color: transparent;
}

.timetable-gig-title {
  font-size: 12px;
  font-weight: 600;
}

.timetable-gig-time {
  color: var(--ion-color-medium, #999);
  font-size: 10px;
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
