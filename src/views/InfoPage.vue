<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Info</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="info-content">
      <div v-if="festivalData" class="info-hero">
        <img
          v-if="festivalData.imageUrl"
          :src="festivalData.imageUrl"
          alt="Roadburn Festival"
          class="info-hero-image"
        />
        <div class="info-hero-overlay">
          <h1>{{ festivalData.title }}</h1>
          <p>{{ festivalData.displayDate }}</p>
        </div>
      </div>

      <ion-list lines="none">
        <ion-item v-if="festivalData?.ticketUrl" button :href="festivalData.ticketUrl" target="_blank">
          <ion-icon :icon="ticketOutline" slot="start" aria-hidden="true" />
          <ion-label>
            <h2>Tickets</h2>
            <p>Get your tickets</p>
          </ion-label>
          <ion-icon :icon="openOutline" slot="end" aria-hidden="true" />
        </ion-item>

        <ion-item>
          <ion-icon :icon="locationOutline" slot="start" aria-hidden="true" />
          <ion-label>
            <h2>Location</h2>
            <p>013, Tilburg, The Netherlands</p>
          </ion-label>
        </ion-item>

        <ion-item>
          <ion-icon :icon="calendarOutline" slot="start" aria-hidden="true" />
          <ion-label>
            <h2>Dates</h2>
            <p>{{ festivalData?.displayDate ?? 'April 2026' }}</p>
          </ion-label>
        </ion-item>

        <ion-item button @click="exportBookmarks">
          <ion-icon :icon="downloadOutline" slot="start" aria-hidden="true" />
          <ion-label>
            <h2>Export bookmarks</h2>
            <p>Save a JSON file to Files or Downloads</p>
          </ion-label>
        </ion-item>

        <ion-item button @click="triggerImportPicker">
          <ion-icon :icon="cloudUploadOutline" slot="start" aria-hidden="true" />
          <ion-label>
            <h2>Import bookmarks</h2>
            <p>Restore from a previously exported JSON file</p>
          </ion-label>
        </ion-item>
      </ion-list>

      <input
        ref="importFileInputRef"
        type="file"
        accept="application/json,.json"
        class="info-import-input"
        aria-hidden="true"
        tabindex="-1"
        @change="onImportFileSelected"
      />

      <div class="info-stats">
        <div class="info-stat">
          <span class="info-stat-value">{{ artistCount }}</span>
          <span class="info-stat-label">Artists</span>
        </div>
        <div class="info-stat">
          <span class="info-stat-value">{{ stageCount }}</span>
          <span class="info-stat-label">Stages</span>
        </div>
        <div class="info-stat">
          <span class="info-stat-value">{{ dayCount }}</span>
          <span class="info-stat-label">Days</span>
        </div>
      </div>

      <ion-toast
        :is-open="toastOpen"
        :message="toastMessage"
        :duration="2500"
        :color="toastColor"
        position="bottom"
        @didDismiss="toastOpen = false"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonToast,
  alertController,
} from '@ionic/vue';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import {
  ticketOutline,
  locationOutline,
  calendarOutline,
  openOutline,
  downloadOutline,
  cloudUploadOutline,
} from 'ionicons/icons';
import type { FestivalDashboard } from '@/types/festival';
import { fetchFestivalDashboard } from '@/services/api';
import {
  BookmarksImportError,
  buildBookmarksExportJson,
  exportBookmarksFilenameDatePrefix,
  importBookmarksFromJson,
  initBookmarks,
  validateBookmarksImportFile,
} from '@/services/bookmarks';

const festivalData = ref<FestivalDashboard | null>(null);
const artistCount = ref(0);
const stageCount = ref(0);
const dayCount = ref(0);

const importFileInputRef = ref<HTMLInputElement | null>(null);

const toastOpen = ref(false);
const toastMessage = ref('');
const toastColor = ref<'success' | 'danger' | 'medium'>('medium');

function showToast(message: string, color: 'success' | 'danger' | 'medium') {
  toastMessage.value = message;
  toastColor.value = color;
  toastOpen.value = true;
}

async function loadData() {
  try {
    const data = await fetchFestivalDashboard();
    festivalData.value = data;
    artistCount.value = data.artists.length;
    stageCount.value = data.stages.length;
    dayCount.value = data.days.length;
  } catch (e) {
    console.error(e);
  }
}

async function exportBookmarks() {
  const json = buildBookmarksExportJson();
  const baseName = `roadburn-bookmarks-${exportBookmarksFilenameDatePrefix()}.json`;

  try {
    if (Capacitor.isNativePlatform()) {
      await Filesystem.writeFile({
        path: baseName,
        data: json,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      showToast(`Saved ${baseName} to this app’s Documents folder (visible in the Files app).`, 'success');
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = baseName;
      anchor.rel = 'noopener';
      anchor.click();
      URL.revokeObjectURL(url);
      showToast('Bookmark file downloaded.', 'success');
    }
  } catch (e) {
    console.error(e);
    showToast('Could not export bookmarks. Please try again.', 'danger');
  }
}

function triggerImportPicker() {
  importFileInputRef.value?.click();
}

async function onImportFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  input.value = '';

  if (!file) {
    return;
  }

  let text: string;

  try {
    text = await file.text();
  } catch (e) {
    console.error(e);
    showToast('Could not read the selected file.', 'danger');

    return;
  }

  try {
    validateBookmarksImportFile(text);
  } catch (e) {
    const message = e instanceof BookmarksImportError ? e.message : 'Invalid bookmark file.';
    showToast(message, 'danger');

    return;
  }

  const alert = await alertController.create({
    header: 'Replace all bookmarks?',
    message:
      'This will remove every bookmark on this device and replace them with the ones from this file.',
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel',
      },
      {
        text: 'Replace',
        role: 'destructive',
        handler: async () => {
          try {
            await importBookmarksFromJson(text);
            showToast('Bookmarks imported.', 'success');
          } catch (err) {
            const message =
              err instanceof BookmarksImportError ? err.message : 'Import failed.';
            showToast(message, 'danger');
          }
        },
      },
    ],
  });

  await alert.present();
}

onMounted(() => {
  void initBookmarks();
  loadData();
});
</script>

<style scoped>
.info-hero {
  overflow: hidden;
  position: relative;
}

.info-hero-image {
  display: block;
  height: 200px;
  object-fit: cover;
  width: 100%;
}

.info-hero-overlay {
  background: linear-gradient(transparent, rgba(18, 18, 32, 0.95));
  bottom: 0;
  left: 0;
  padding: 24px 16px 16px;
  position: absolute;
  right: 0;
}

.info-hero-overlay h1 {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px;
}

.info-hero-overlay p {
  color: var(--ion-color-medium);
  font-size: 14px;
  margin: 0;
}

ion-item {
  --background: var(--ion-card-background, #1e1e34);
  --padding-start: 16px;
  --padding-end: 16px;
  border-radius: 12px;
  margin: 8px 16px;
}

ion-item h2 {
  font-size: 15px;
  font-weight: 600;
}

ion-item p {
  font-size: 13px;
  opacity: 0.7;
}

ion-item ion-icon[slot="start"] {
  color: var(--ion-color-primary);
  margin-right: 12px;
}

.info-import-input {
  height: 1px;
  opacity: 0;
  overflow: hidden;
  position: absolute;
  width: 1px;
  z-index: -1;
}

.info-stats {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 24px 16px;
}

.info-stat {
  align-items: center;
  background: var(--ion-card-background, #1e1e34);
  border-radius: 12px;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  padding: 20px 12px;
}

.info-stat-value {
  color: var(--ion-color-primary);
  font-size: 28px;
  font-weight: 700;
}

.info-stat-label {
  color: var(--ion-color-medium);
  font-size: 12px;
  text-transform: uppercase;
}
</style>
