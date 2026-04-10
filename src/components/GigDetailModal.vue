<template>
  <ion-header>
    <ion-toolbar>
      <ion-title>{{ gig.title }}</ion-title>
      <ion-buttons slot="end">
        <ion-button @click="dismiss">
          <ion-icon :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-img
      v-if="artist?.imageUrl"
      :src="artist.imageUrl"
      :alt="gig.title"
    />

    <ion-list>
      <ion-item>
        <ion-icon :icon="musicalNotesOutline" slot="start" aria-hidden="true" />
        <ion-label>
          <h2>{{ gig.title }}</h2>
        </ion-label>
      </ion-item>

      <ion-item>
        <ion-icon :icon="locationOutline" slot="start" aria-hidden="true" />
        <ion-label>
          <p>Stage</p>
          <h3>{{ gig.stageTitle }}</h3>
        </ion-label>
      </ion-item>

      <ion-item>
        <ion-icon :icon="timeOutline" slot="start" aria-hidden="true" />
        <ion-label>
          <p>Time</p>
          <h3>{{ gig.displayDate }}</h3>
        </ion-label>
      </ion-item>

      <ion-item>
        <ion-icon :icon="bookmarkOutline" slot="start" aria-hidden="true" />
        <ion-label>
          <p>Bookmark</p>
          <h3>{{ currentBookmarkLabel }}</h3>
        </ion-label>
      </ion-item>
    </ion-list>

    <div class="gig-detail-actions">
      <ion-button
        v-for="option in bookmarkOptions"
        :key="option.status"
        :color="option.color"
        :fill="currentBookmark === option.status ? 'solid' : 'outline'"
        expand="block"
        @click="onBookmark(option.status)"
      >
        {{ option.label }}
      </ion-button>
    </div>

    <div
      v-if="artist?.text"
      class="gig-detail-bio"
      v-html="artist.text"
    />
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
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  modalController,
} from '@ionic/vue';
import {
  closeOutline,
  musicalNotesOutline,
  locationOutline,
  timeOutline,
  bookmarkOutline,
} from 'ionicons/icons';
import type { Gig, Artist, BookmarkStatus } from '@/types/festival';
import { getBookmark, setBookmark, getBookmarkLabel } from '@/services/bookmarks';

const props = defineProps<{
  gig: Gig;
  artist: Artist | undefined;
}>();

const currentBookmark = ref<BookmarkStatus>(getBookmark(props.gig.id));

const currentBookmarkLabel = computed(() => getBookmarkLabel(currentBookmark.value));

const bookmarkOptions: Array<{ status: BookmarkStatus; label: string; color: string }> = [
  { status: 'no', label: 'No', color: 'danger' },
  { status: 'maybe', label: 'Maybe', color: 'warning' },
  { status: 'yes', label: 'Yes', color: 'success' },
  { status: 'mandatory', label: 'Mandatory', color: 'primary' },
];

async function onBookmark(status: BookmarkStatus) {
  if (currentBookmark.value === status) {
    currentBookmark.value = 'none';
    await setBookmark(props.gig.id, 'none');
  } else {
    currentBookmark.value = status;
    await setBookmark(props.gig.id, status);
  }
}

function dismiss() {
  modalController.dismiss(currentBookmark.value);
}
</script>

<style scoped>
ion-img {
  max-height: 250px;
  object-fit: cover;
}

.gig-detail-actions {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(4, 1fr);
  padding: 16px;
}

.gig-detail-bio {
  padding: 0 16px 16px;
}
</style>
