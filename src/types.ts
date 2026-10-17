export type MediaCategory = 'Movies' | 'Series' | 'Anime' | 'Books' | 'Games' | 'Manga';
export type MediaStatus = 'Consuming' | 'To Consume' | 'Consumed';
export type MediaPriority = 'High' | 'Normal' | 'Low';
export type ActiveTabType = 'Consuming' | 'To Consume' | 'Consumed';
export type ActiveViewType = 'Library' | 'Discover' | 'Statistics';

export interface MediaItem {
    id?: number;
    title: string;
    category: MediaCategory;
    status: MediaStatus;
    date_finished?: string | null;
    rating?: number | null;
    review?: string | null;
    image_path?: string | null;
    created_at?: string;

    // Metadata Fields
    genre?: string | null;
    tags?: string | null;
    author?: string | null; // Books / Manga
    director?: string | null; // Movies / Series / Anime
    writer?: string | null; // Movies / Series / Books
    actors?: string | null; // Movies / Series
    studio?: string | null; // Games / Anime
    platform?: string | null; // Games
    priority?: MediaPriority;
    location?: string | null;

    // V3 Fields: Stats & Deduplication
    runtime?: number | null; // in minutes (Movies, Series, Anime)
    page_count?: number | null; // in pages (Books, Manga)
    source?: 'tmdb' | 'anilist' | 'google_books' | 'open_library' | 'manual' | string | null;
    source_id?: string | null;
}

export interface DuplicatePair {
    pairKey: string;
    itemA: MediaItem;
    itemB: MediaItem;
    reason: string;
}

export interface AdvancedSearchFilters {
    year?: string;
    creator?: string;
}
