export interface Stage {
  id: number;
  title: string;
  subtitle: string | null;
  sortOrder: number;
}

export interface Day {
  id: number;
  startTimestamp: number;
  endTimestamp: number;
  title: string;
  subtitle: string;
  titleShort: string;
  subtitleShort: string;
  description: string;
  sortOrder: number;
}

export interface ArtistLink {
  type: string;
  url: string;
}

export interface Artist {
  id: number;
  title: string;
  imageUrl: string | null;
  iconUrl: string | null;
  videoUrl: string | null;
  text: string | null;
  shareText: string | null;
  links: ArtistLink[];
  sortOrder: number;
}

export interface Gig {
  id: number;
  artistId: number;
  title: string;
  displayDate: string;
  stageTitle: string;
  startTimestamp: number;
  endTimestamp: number;
  ticketUrl: string | null;
  showInTimetable: boolean | null;
  stageId: number;
  dayId: number;
  sortOrder: number;
}

export interface RenderedGig {
  gig: Gig;
  style: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface FavGig {
  statusId: number;
  status: BookmarkStatus;
  gigs: RenderedGig[];
}

export type BookmarkStatus = 'none' | 'no' | 'maybe' | 'yes' | 'mandatory';

export interface FestivalDashboard {
  id: number;
  title: string;
  displayDate: string;
  ticketUrl: string | null;
  imageUrl: string | null;
  iconUrl: string | null;
  backgroundImageUrl: string | null;
  stages: Stage[];
  days: Day[];
  artists: Artist[];
  gigs: Gig[];
}
