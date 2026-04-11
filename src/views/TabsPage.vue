<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="timetable" href="/tabs/timetable">
          <ion-icon :icon="calendarOutline" aria-hidden="true" />
          <ion-label>Timetable</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="favorites" href="/tabs/favorites">
          <ion-icon :icon="starOutline" aria-hidden="true" />
          <ion-label>Favorites</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="lineup" href="/tabs/lineup">
          <ion-icon :icon="peopleOutline" aria-hidden="true" />
          <ion-label>Line-up</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="info" href="/tabs/info">
          <ion-icon :icon="informationCircleOutline" aria-hidden="true" />
          <ion-label>Info</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonTabs,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
} from '@ionic/vue';
import { calendarOutline, peopleOutline, informationCircleOutline, starOutline } from 'ionicons/icons';
</script>
