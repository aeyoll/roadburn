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
      </ion-list>

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
} from '@ionic/vue';
import {
  ticketOutline,
  locationOutline,
  calendarOutline,
  openOutline,
} from 'ionicons/icons';
import type { FestivalDashboard } from '@/types/festival';
import { fetchFestivalDashboard } from '@/services/api';

const festivalData = ref<FestivalDashboard | null>(null);
const artistCount = ref(0);
const stageCount = ref(0);
const dayCount = ref(0);

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

onMounted(() => {
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
