<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Line-up</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          v-model="searchQuery"
          placeholder="Search artists..."
          :debounce="250"
          aria-label="Search artists"
        />
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-spinner v-if="loading" name="crescent" class="lineup-spinner" />

      <div v-if="error" class="lineup-error">
        <ion-text color="danger">
          <p>{{ error }}</p>
        </ion-text>
        <ion-button @click="loadData">Retry</ion-button>
      </div>

      <ion-list v-if="!loading && !error" lines="none">
        <ion-item
          v-for="artist in filteredArtists"
          :key="artist.id"
          button
          detail
          @click="openArtistDetail(artist)"
        >
          <ion-avatar slot="start" aria-hidden="true">
            <img
              v-if="artist.iconUrl"
              :src="artist.iconUrl"
              :alt="''"
            />
            <ion-icon v-else :icon="personOutline" />
          </ion-avatar>
          <ion-label>
            <h2>{{ artist.title }}</h2>
            <p v-if="getArtistStage(artist.id)">{{ getArtistStage(artist.id) }}</p>
          </ion-label>
          <ion-icon
            v-if="getArtistBookmarkColor(artist.id) !== 'medium'"
            :icon="bookmark"
            :color="getArtistBookmarkColor(artist.id)"
            slot="end"
            aria-hidden="true"
          />
        </ion-item>
      </ion-list>

      <div v-if="!loading && !error && filteredArtists.length === 0" class="lineup-empty">
        <ion-text color="medium">
          <p>No artists found.</p>
        </ion-text>
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
  IonSearchbar,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonIcon,
  IonSpinner,
  IonText,
  IonButton,
  modalController,
} from '@ionic/vue';
import { personOutline, bookmark } from 'ionicons/icons';
import type { Artist, Gig, BookmarkStatus } from '@/types/festival';
import { fetchFestivalDashboard } from '@/services/api';
import { initBookmarks, getBookmark, getBookmarkColor } from '@/services/bookmarks';
import GigDetailModal from '@/components/GigDetailModal.vue';

const loading = ref(true);
const error = ref<string | null>(null);
const searchQuery = ref('');

const artists = ref<Artist[]>([]);
const gigs = ref<Gig[]>([]);

const bookmarkVersion = ref(0);

const filteredArtists = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();

  if (!query) {
    return artists.value;
  }

  return artists.value.filter((a) =>
    a.title.toLowerCase().includes(query),
  );
});

function getArtistStage(artistId: number): string | null {
  const gig = gigs.value.find((g) => g.artistId === artistId);

  return gig?.stageTitle ?? null;
}

function getArtistGig(artistId: number): Gig | undefined {
  return gigs.value.find((g) => g.artistId === artistId);
}

function getArtistBookmarkColor(artistId: number): string {
  void bookmarkVersion.value;
  const gig = getArtistGig(artistId);

  if (!gig) {
    return 'medium';
  }

  return getBookmarkColor(getBookmark(gig.id));
}

async function openArtistDetail(artist: Artist) {
  const gig = getArtistGig(artist.id);

  if (!gig) {
    return;
  }

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
    const [data] = await Promise.all([fetchFestivalDashboard(), initBookmarks()]);
    artists.value = data.artists.sort((a, b) => a.title.localeCompare(b.title));
    gigs.value = data.gigs;
  } catch (e) {
    error.value = 'Failed to load lineup. Please try again.';
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
.lineup-spinner {
  display: block;
  margin: 40vh auto 0;
}

.lineup-error {
  padding: 32px;
  text-align: center;
}

.lineup-empty {
  padding: 32px;
  text-align: center;
}

ion-avatar {
  --border-radius: 8px;
  align-items: center;
  background: var(--ion-color-light, #2a2a3e);
  display: flex;
  justify-content: center;
}

ion-avatar ion-icon {
  font-size: 24px;
  color: var(--ion-color-medium);
}

ion-item {
  --background: transparent;
  --padding-start: 16px;
  --padding-end: 16px;
  --inner-padding-end: 8px;
  margin-bottom: 2px;
}

ion-item h2 {
  font-size: 15px;
  font-weight: 600;
}

ion-item p {
  font-size: 13px;
  opacity: 0.7;
}
</style>
