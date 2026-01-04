export interface MediaItem {
    id?: number;
    title: string;
    category: 'Movies' | 'Series' | 'Anime' | 'Books' | 'Games' | 'Manga';
    status: 'Watching' | 'To Consume' | 'Consumed';
    date_finished?: string | null;
    rating?: number | null;
    review?: string | null;
    image_path?: string | null;
    created_at?: string;

    // New Fields (v2)
    genre?: string | null;
    tags?: string | null;
    author?: string | null; // Books
    director?: string | null; // Movies/Series
    writer?: string | null; // Movies/Series/Books
    actors?: string | null; // Movies/Series
    studio?: string | null; // Games
    platform?: string | null; // Games
    priority?: 'High' | 'Normal' | 'Low';
    location?: string;
}
