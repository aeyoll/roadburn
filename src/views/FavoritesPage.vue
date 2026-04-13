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
                        :class="{ 'active': day.id === selectedDayId }"
                        :aria-selected="day.id === selectedDayId"
                        @click="selectDay(day.id)"
                    >
                        <span class="day-pill-name">{{ day.titleShort }}</span>
                        <span class="day-pill-date">{{ day.subtitleShort }}</span>
                    </button>
                </div>
            </ion-toolbar>
            <ion-toolbar class="fav-toolbar">
                <div class="fav-pills" aria-label="Filter favorites" role="tablist">
                    <button
                        v-for="status in favoriteStatuses"
                        :key="status"
                        role="tab"
                        class="fav-pill"
                        :class="{ 'selected': selectedFavoriteStatuses.includes(status) }"
                        :aria-selected="selectedFavoriteStatuses.includes(status)"
                        @click="toggleFavoriteStatus(status)"
                    >
                        <span
                            class="fav-pill-bullet"
                            :class="status"
                        ></span>
                        <span class="fav-pill-name">{{ status }}</span>
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
            >
                <div class="timetable-grid" :aria-label="'Timetable for ' + selectedDayLabel" role="grid">
                    <div class="timetable-header" role="row">
                        <div class="timetable-time-header" role="columnheader">
                            <span class="sr-only">Time</span>
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
                        </div>
                        <button
                            v-for="(renderedFavGig, favGigIndex) in favsRenderedGigsForDay"
                            :key="renderedFavGig.gig.id"
                            class="timetable-gig"
                            :class="'timetable-gig--bookmark-' + getGigBookmarkColor(renderedFavGig.gig.id)"
                            :style="renderedFavGig.style"
                            :aria-label="favGigAriaLabel(renderedFavGig.gig)"
                            @click="openGigDetail(renderedFavGig.gig)"
                        >
                            <span class="timetable-gig-title">{{ renderedFavGig.gig.title }}</span>
                            <span class="timetable-gig-stage">{{ stages.find((s) => s.id === renderedFavGig.gig.stageId)?.title}}</span>
                            <span
                                v-if="gigNotePreview(renderedFavGig.gig.id)"
                                class="timetable-gig-note"
                            >{{ gigNotePreview(renderedFavGig.gig.id) }}</span>
                        </button>
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
import type { Day, Stage, Gig, Artist, BookmarkStatus, GigPosition } from '@/types/festival';
import { fetchFestivalDashboard } from '@/services/api';
import { initBookmarks, getBookmark, getBookmarkColor, subscribeBookmarksChanged } from '@/services/bookmarks';
import { initGigNotes, getGigNote, subscribeGigNotesChanged } from '@/services/gigNotes';
import { syncGigReminders } from '@/services/gigNotifications';
import GigDetailModal from '@/components/GigDetailModal.vue';

const PIXELS_PER_MINUTE = 2;
const SLOT_INTERVAL = 30;
const totalColumnWidth = window.innerWidth - 60; // 60px for time column

const loading = ref(true);
const error = ref<string | null>(null);

const days = ref<Day[]>([]);
const stages = ref<Stage[]>([]);
const gigs = ref<Gig[]>([]);
const artists = ref<Artist[]>([]);
const selectedDayId = ref<number | undefined>();
const favoriteStatuses = ref<BookmarkStatus[]>(['mandatory', 'yes', 'maybe', 'none']);
const selectedFavoriteStatuses = ref<BookmarkStatus[]>(['mandatory', 'yes', 'maybe']);

const bookmarkVersion = ref(0);
const notesVersion = ref(0);

const selectedDayLabel = computed(() => {
    const day = days.value.find((d) => d.id === selectedDayId.value);

    return day?.description ?? '';
});

const favsGigsForDay = computed(() => {
    return gigs.value.filter((g) =>
        g.dayId === selectedDayId.value
        && !!isGigFavorite(g.id)
    );
});

const favsRenderedGigsForDay = computed(() => {
    return favsGigsForDay.value.map((g) => ({
        gig: g,
        style: gigFavStyle(g),
    }));
});

const timelineStart = computed<number | null>(() => {
    if (favsGigsForDay.value.length === 0) {
        return null;
    }

    const earliest = Math.min(...favsGigsForDay.value.map((g) => g.startTimestamp));
    const step = SLOT_INTERVAL * 60;

    return Math.floor(earliest / step) * step;
});

const timelineEnd = computed<number>(() => {
    if (favsGigsForDay.value.length === 0) {
        return 0;
    }

    return Math.max(...favsGigsForDay.value.map((g) => g.endTimestamp));
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

function getPeakConcurrentGigCount(): number {
    if (favsGigsForDay.value.length === 0) {
        return 1;
    }

    let maxConcurrent = 1;
    favsGigsForDay.value.forEach((gig) => {
        const concurrent = getGigConcurrentCount(gig) - 1; // Exclude the gig itself

        if (concurrent > 0) {
            maxConcurrent = Math.max(maxConcurrent, concurrent);
        }
    });

    return maxConcurrent;
}

function getGigConcurrentCount(gig: Gig): number {
    const concurrent = favsGigsForDay.value.filter(
        (other) =>
            other.id !== gig.id &&
            other.startTimestamp < gig.endTimestamp &&
            other.endTimestamp > gig.startTimestamp
    ).length;

    return concurrent + 1;
}

function getExpandedGigWidth(gig: Gig): number {
    const concurrentCount = getGigConcurrentCount(gig);

    return 1 / concurrentCount;
}

function getGigDefaultWidth(): number {
    const peakConcurrent = getPeakConcurrentGigCount();

    return 1 / (2 * peakConcurrent);
}

let cachedLayout: Map<number, GigPosition> | null = null;
let cachedFavsGigsKey: string = '';

function buildLayout(): Map<number, GigPosition> {
    const gigPositions = new Map<number, GigPosition>();
    const defaultWidth = getGigDefaultWidth();

    const sortedGigs = favsGigsForDay.value.slice().sort((a, b) => {
        const priorityDifference = favoriteStatuses.value.indexOf(getBookmark(a.id)) - favoriteStatuses.value.indexOf(getBookmark(b.id));

        if (priorityDifference !== 0) {
            return priorityDifference;
        }
        if (a.startTimestamp !== b.startTimestamp) {
            return a.startTimestamp - b.startTimestamp;
        }
        return a.endTimestamp - b.endTimestamp;
    });

    for (const gig of sortedGigs) {
        const expandedWidth = getExpandedGigWidth(gig);
        const gigWidth = Math.max(defaultWidth, expandedWidth);
        const gaps: Array<{ start: number; end: number; size: number }> = [];
        const overlappingSegments = [...gigPositions.values()].filter(seg =>
            seg.startTimestamp < gig.endTimestamp && seg.endTimestamp > gig.startTimestamp
        );

        if (overlappingSegments.length === 0) {
            gaps.push({ start: 0, end: 1, size: 1 });
        } else {
            const sortedSegments = overlappingSegments.sort((a, b) => a.offsetStart - b.offsetStart);

            if (sortedSegments[0].offsetStart > 0) {
                const gapEnd = sortedSegments[0].offsetStart;

                gaps.push({ start: 0, end: gapEnd, size: gapEnd });
            }

            for (let i = 0; i < sortedSegments.length - 1; i++) {
                const gapStart = sortedSegments[i].offsetEnd;
                const gapEnd = sortedSegments[i + 1].offsetStart;

                if (gapEnd > gapStart) {
                    const gapSize = gapEnd - gapStart;

                    gaps.push({ start: gapStart, end: gapEnd, size: gapSize });
                }
            }

            const lastSegment = sortedSegments[sortedSegments.length - 1];
            if (lastSegment.offsetEnd < 1) {
                const gapSize = 1 - lastSegment.offsetEnd;

                gaps.push({ start: lastSegment.offsetEnd, end: 1, size: gapSize });
            }
        }

        const fittingGaps = gaps.filter(gap => gap.size >= gigWidth);
        let bestGap: typeof gaps[0] | undefined;

        if (fittingGaps.length > 0) {
            bestGap = fittingGaps.reduce((largest, gap) =>
                gap.size > largest.size ? gap : largest
            );
        } else {
            bestGap = gaps.reduce((largest, gap) =>
                gap.size > (largest?.size ?? 0) ? gap : largest
            );
        }

        const offsetStart = bestGap?.start ?? 0;
        const offsetEnd = offsetStart + gigWidth;

        gigPositions.set(gig.id, {
            offsetStart,
            offsetEnd,
            startTimestamp: gig.startTimestamp,
            endTimestamp: gig.endTimestamp,
            width: gigWidth
        });
    }
    return gigPositions;
}

function getLayout(): Map<number, GigPosition> {
    const key = favsGigsForDay.value.map(g => g.id).join('|');

    if (!cachedLayout || cachedFavsGigsKey !== key) {
        cachedLayout = buildLayout();
        cachedFavsGigsKey = key;
    }

    return cachedLayout;
}

function gigFavStyle(gig: Gig): Record<string, string> {
    const layout = getLayout();
    const top = timestampToPixels(gig.startTimestamp);
    const height = timestampToPixels(gig.endTimestamp) - top;
    const posInfo = layout.get(gig.id) ?? {
        offsetStart: 0,
        offsetEnd: getGigDefaultWidth(),
        width: getGigDefaultWidth()
    };

    const leftPosition = 60 + posInfo.offsetStart * totalColumnWidth;
    const widthPixels = posInfo.width * totalColumnWidth;

    return {
        left: leftPosition + 'px',
        top: top + 'px',
        width: widthPixels + 'px',
        height: height + 'px',
    };
}

function toggleFavoriteStatus(status: BookmarkStatus) {
    if (selectedFavoriteStatuses.value.includes(status)) {
        selectedFavoriteStatuses.value = selectedFavoriteStatuses.value.filter(s => s !== status);
    } else {
        selectedFavoriteStatuses.value.push(status);
    }
}

function getGigBookmarkColor(gigId: number): string {
    void bookmarkVersion.value;

    return getBookmarkColor(getBookmark(gigId));
}

function isGigFavorite(gigId: number): boolean {
    void bookmarkVersion.value;
    const bookmarkStatus = getBookmark(gigId);

    return selectedFavoriteStatuses.value.includes(bookmarkStatus);
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

function favGigAriaLabel(gig: Gig): string {
    void notesVersion.value;
    const stage = stages.value.find((s) => s.id === gig.stageId);
    const base = `${gig.title} at ${stage?.title}, ${gig.displayDate}`;
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
    cachedLayout = null;
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
        cachedLayout = null;
        bookmarkVersion.value++;
        void syncGigReminders(gigs.value);
    }),
);

onUnmounted(
    subscribeGigNotesChanged(() => {
        cachedLayout = null;
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

        .day-pills {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            padding: 4px 12px 10px;
            scrollbar-width: none;

            &::-webkit-scrollbar {
                display: none;
            }
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

            &:focus-visible {
                outline: 2px solid var(--ion-color-primary);
                outline-offset: 2px;
            }

            &.active {
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
        }
    }

    .fav-toolbar {
        --background: var(--ion-background-color, #121220);
        --border-width: 0;
        --padding-start: 0;
        --padding-end: 0;

        .fav-pills {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            padding: 4px 12px 10px;
            scrollbar-width: none;

            &::-webkit-scrollbar {
                display: none;
            }

            .fav-pill {
                display: flex;
                flex-shrink: 0;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 8px;
                border: 1px solid transparent;
                border-radius: 10px;
                color: var(--ion-text-color, #f0f0f5);
                background: var(--ion-color-light, #2a2a3e);
                transition: background 0.2s, border-color 0.2s;
                cursor: pointer;

                &:focus-visible {
                    outline: 2px solid var(--ion-color-primary);
                    outline-offset: 2px;
                }

                &.selected {

                    &:has(> .fav-pill-bullet.mandatory) {
                        border-color: var(--ion-color-danger, #ef5350);
                    }
                    &:has(> .fav-pill-bullet.yes) {
                        border-color: var(--ion-color-success, #4caf50);
                    }
                    &:has(> .fav-pill-bullet.maybe) {
                        border-color: var(--ion-color-warning, #ffb300);
                    }
                    &:has(> .fav-pill-bullet.none) {
                        border-color: var(--ion-color-medium, #898989);
                    }

                    .fav-pill-bullet {
                        opacity: 1;

                        &.mandatory {
                            background-color: var(--ion-color-danger, #ef5350);
                        }
                        &.yes {
                            background-color: var(--ion-color-success, #4caf50);
                        }
                        &.maybe {
                            background-color: var(--ion-color-warning, #ffb300);
                        }
                        &.none {
                            background-color: var(--ion-color-medium, #898989);
                        }
                    }
                }

                .fav-pill-bullet {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background-color: #4f4f67;
                    opacity: 0.5;
                }

                .fav-pill-name {
                    text-transform: capitalize;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                }
            }
        }
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
    }

    .timetable-header {
        display: flex;
        position: sticky;
        top: 0;
        z-index: 4;
    }

    .timetable-time-header {
        background: var(--ion-toolbar-background, #1a1a2e);
        flex-shrink: 0;
        min-width: 54px;
        position: sticky;
        left: 0;
        z-index: 5;
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
        transition: transform 0.15s, box-shadow 0.15s;
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

    .timetable-gig-stage {
        padding-top: 4px;
        font-size: 11px;
        line-height: 1.2;
        opacity: 0.7;
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
