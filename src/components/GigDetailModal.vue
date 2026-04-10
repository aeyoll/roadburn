<template>
  <ion-header>
    <ion-toolbar>
      <ion-title>{{ gig.title }}</ion-title>
      <ion-buttons slot="end">
        <ion-button @click="dismiss" aria-label="Close">
          <ion-icon :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <div v-if="artist?.imageUrl" class="gig-detail-hero">
      <ion-img
        :src="artist.imageUrl"
        :alt="gig.title"
      />
      <div class="gig-detail-hero-gradient" />
    </div>

    <div class="gig-detail-info">
      <div class="gig-detail-row">
        <ion-icon :icon="locationOutline" aria-hidden="true" />
        <div>
          <span class="gig-detail-label">Stage</span>
          <span class="gig-detail-value">{{ gig.stageTitle }}</span>
        </div>
      </div>

      <div class="gig-detail-row">
        <ion-icon :icon="timeOutline" aria-hidden="true" />
        <div>
          <span class="gig-detail-label">Time</span>
          <span class="gig-detail-value">{{ gig.displayDate }}</span>
        </div>
      </div>
    </div>

    <div class="gig-detail-bookmark-section">
      <span class="gig-detail-bookmark-label">{{ currentBookmarkLabel }}</span>
      <div class="gig-detail-actions">
        <ion-button
          v-for="option in bookmarkOptions"
          :key="option.status"
          :color="option.color"
          :fill="currentBookmark === option.status ? 'solid' : 'outline'"
          size="small"
          shape="round"
          @click="onBookmark(option.status)"
        >
          {{ option.label }}
        </ion-button>
      </div>
    </div>

    <div
      v-if="artist?.text"
      class="gig-detail-bio"
      v-html="artist.text"
    />

    <div v-if="artist?.links && artist.links.length > 0" class="gig-detail-links">
      <a
        v-for="link in artist.links"
        :key="link.url"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="gig-detail-link"
      >
        <ion-icon :icon="openOutline" aria-hidden="true" />
        {{ link.type }}
      </a>
    </div>
  </ion-content>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonImg,
  IonIcon,
  modalController,
} from '@ionic/vue';
import {
  closeOutline,
  locationOutline,
  timeOutline,
  openOutline,
} from 'ionicons/icons';
import type { Gig, Artist, BookmarkStatus } from '@/types/festival';
import { getBookmark, setBookmark, getBookmarkLabel } from '@/services/bookmarks';

const props = defineProps<{
  gig: Gig;
  artist: Artist | undefined;
  onBookmarksChanged?: () => Promise<void>;
}>();

const currentBookmark = ref<BookmarkStatus>(getBookmark(props.gig.id));

const currentBookmarkLabel = computed(() => getBookmarkLabel(currentBookmark.value));

const bookmarkOptions: Array<{ status: BookmarkStatus; label: string; color: string }> = [
  { status: 'no', label: 'No', color: 'danger' },
  { status: 'maybe', label: 'Maybe', color: 'warning' },
  { status: 'yes', label: 'Yes', color: 'success' },
  { status: 'mandatory', label: 'Must', color: 'tertiary' },
];

async function onBookmark(status: BookmarkStatus) {
  if (currentBookmark.value === status) {
    currentBookmark.value = 'none';
    await setBookmark(props.gig.id, 'none');
  } else {
    currentBookmark.value = status;
    await setBookmark(props.gig.id, status);
  }

  await props.onBookmarksChanged?.();
}

function dismiss() {
  modalController.dismiss(currentBookmark.value);
}
</script>

<style scoped>
.gig-detail-hero {
  overflow: hidden;
  position: relative;
}

ion-img {
  display: block;
  height: 220px;
  object-fit: cover;
  width: 100%;
}

.gig-detail-hero-gradient {
  background: linear-gradient(transparent 50%, var(--ion-background-color, #121220));
  bottom: 0;
  left: 0;
  pointer-events: none;
  position: absolute;
  right: 0;
  top: 0;
}

.gig-detail-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 16px;
}

.gig-detail-row {
  align-items: center;
  background: var(--ion-card-background, #1e1e34);
  border-radius: 12px;
  display: flex;
  gap: 14px;
  padding: 14px 16px;
}

.gig-detail-row ion-icon {
  color: var(--ion-color-primary);
  flex-shrink: 0;
  font-size: 22px;
}

.gig-detail-row div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.gig-detail-label {
  color: var(--ion-color-medium);
  font-size: 11px;
  text-transform: uppercase;
}

.gig-detail-value {
  font-size: 15px;
  font-weight: 600;
}

.gig-detail-bookmark-section {
  padding: 4px 16px 16px;
}

.gig-detail-bookmark-label {
  color: var(--ion-color-medium);
  display: block;
  font-size: 12px;
  margin-bottom: 10px;
  text-align: center;
  text-transform: uppercase;
}

.gig-detail-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.gig-detail-actions ion-button {
  flex: 1;
  --border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.gig-detail-bio {
  background: var(--ion-card-background, #1e1e34);
  border-radius: 12px;
  color: var(--ion-text-color, #f0f0f5);
  font-size: 14px;
  line-height: 1.6;
  margin: 0 16px;
  padding: 16px;
}

.gig-detail-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 16px;
}

.gig-detail-link {
  align-items: center;
  background: var(--ion-card-background, #1e1e34);
  border-radius: 20px;
  color: var(--ion-color-primary);
  display: inline-flex;
  font-size: 13px;
  font-weight: 500;
  gap: 6px;
  padding: 8px 14px;
  text-decoration: none;
}

.gig-detail-link ion-icon {
  font-size: 14px;
}
</style>
