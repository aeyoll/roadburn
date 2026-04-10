import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/tabs/timetable',
  },
  {
    path: '/tabs/',
    component: () => import('@/views/TabsPage.vue'),
    children: [
      {
        path: '',
        redirect: '/tabs/timetable',
      },
      {
        path: 'timetable',
        name: 'Timetable',
        component: () => import('@/views/HomePage.vue'),
      },
      {
        path: 'lineup',
        name: 'Lineup',
        component: () => import('@/views/LineupPage.vue'),
      },
      {
        path: 'info',
        name: 'Info',
        component: () => import('@/views/InfoPage.vue'),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
