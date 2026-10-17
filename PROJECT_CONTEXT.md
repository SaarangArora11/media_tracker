# Media Tracker Project Context

**Date**: October 2026  
**Project**: Media Tracker (Electron/React Desktop App)  
**Goal**: A modern, localized, offline-first application to track personal media consumption (Movies, TV Series, Anime, Books, Games, Manga) with metadata autofill, retroactive statistics, duplicate detection, and full privacy.

---

## 🚀 Tech Stack

- **Frontend**: React 19, TypeScript, TailwindCSS v4, Vite
- **Backend / Desktop**: Electron 39 (Main Process via `.cts` -> `.cjs`), Better-SQLite3 12 (Local Database)
- **Packaging**: Electron Builder (Windows NSIS Installer `.exe`)
- **Metadata APIs**: TMDB v3/v4 API, AniList GraphQL API, Google Books API, Open Library API

---

## ✨ Features (V1 – V5.0)

1. **CRUD Operations**: Add, Edit, Delete media items with fields like Category, Status, Priority, Rating, Review, Finished Dates, Location, Duration, and Page Count.
2. **Tab Renaming & Workflow**:
   - Statuses: **`Consuming`** (formerly *Watching*), **`To Consume`** (default for new entries), and **`Consumed`**.
   - Default addition status defaults to `To Consume`.
3. **Universal Metadata Search & Autofill**:
   - 🎬 **The Movie Database (TMDB)**: Posters, release years, directors, writers, cast, genres, and movie/series runtime.
   - 🌸 **AniList GraphQL API**: Anime (studios, directors, episodes, duration) and Manga (mangaka, chapters, volumes, page estimates).
   - 📖 **Google Books API + Open Library Fallback**: High-resolution covers, authors, categories, publication year, and page count.
4. **Dedicated Discover & Advanced Search Tab**:
   - Full-view search experience across all providers.
   - **Advanced Search Drawer**: Filter searches by Release / Publication Year and Creator (Director / Author / Studio).
   - **Rich Media Inspection Modal**: Inspect synopsis, ratings, runtime/pages, cast, and library presence before adding.
5. **Personal Analytics & Statistics Dashboard**:
   - **Year-To-Date (YTD) & Historical Analytics**: Filter stats by year or All-Time.
   - **Watch Time Calculation**: Aggregates movie and series durations into days, hours, and minutes.
   - **Pages Read & Reading Time**: Tracks total pages read and estimated reading duration (~250 wpm / ~40 pages/hr).
   - **Monthly Activity Breakdown & Title Inspection**: 12-month visual timeline tracking completed items, watchtime, and pages per month. Clicking any month reveals an interactive 1 x N horizontally scrollable title drawer, sorted by category (Movies → Series → Anime → Books → Games → Manga) and then chronologically from earliest to latest date completed.
   - **Category & Genre Breakdown**: Visual breakdown of media consumption habits.
   - **Retroactive Backfill Tool**: 1-click **"Sync Missing Stats"** tool to automatically fetch runtimes and page counts from online sources for older entries.
6. **Deduplication Engine & Source ID System**:
   - Automatically detects duplicate entries across all library tabs (`Consuming`, `To Consume`, `Consumed`).
   - Identifies pairs sharing identical metadata source IDs (e.g. TMDB ID, AniList ID, Google Books ID) or matching normalized title + creator/category.
   - Top warning banner alerts the user when potential duplicates are found.
   - **Deduplication Modal**: Side-by-side comparison allowing users to Keep Left, Keep Right, Merge Entries (consolidating ratings, notes, and dates), or Keep Both (dismissing pair).
7. **Local Storage & Privacy**:
   - Zero cloud requirement; SQLite database stored at `%APPDATA%\MediaTracker2026\media_tracker.db`.
   - Downloaded poster covers saved locally in `%APPDATA%\MediaTracker2026\covers\`.
   - 1-Click `.zip` Backup and Full Restore.
   - Bulk `.txt` Import with either manual batch import or sequential online metadata autofill.

---

## 📂 Database Schema (SQLite)

### Table: `items` (Schema Version 3)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Unique item identifier |
| `title` | TEXT NOT NULL | Title of the media item |
| `category` | TEXT NOT NULL | CHECK in `'Movies'`, `'Series'`, `'Anime'`, `'Books'`, `'Games'`, `'Manga'` |
| `status` | TEXT NOT NULL | CHECK in `'Consuming'`, `'To Consume'`, `'Consumed'`, `'Watching'` |
| `priority` | TEXT DEFAULT `'Normal'` | `'High'`, `'Normal'`, or `'Low'` |
| `location` | TEXT | Where consumed (e.g. Home, Theatre, Flight) |
| `date_finished` | TEXT | Date completed (`YYYY-MM-DD`) |
| `rating` | INTEGER | Score from 0 to 10 |
| `review` | TEXT | Personal review / synopsis notes |
| `image_path` | TEXT | Local filesystem path or online poster URL |
| `genre` | TEXT | Comma-separated genres |
| `tags` | TEXT | Comma-separated user tags |
| `author` | TEXT | Author or Mangaka (Books, Manga) |
| `director` | TEXT | Director (Movies, Series, Anime) |
| `writer` | TEXT | Screenwriter / Author |
| `actors` | TEXT | Key cast members |
| `studio` | TEXT | Developer or Animation Studio |
| `platform` | TEXT | Gaming platform (PC, PS5, Switch, etc.) |
| `runtime` | INTEGER | Duration in minutes (Movies, Series, Anime) |
| `page_count` | INTEGER | Number of pages (Books, Manga) |
| `source` | TEXT | Metadata source (`'tmdb'`, `'anilist'`, `'google_books'`, `'open_library'`, `'manual'`) |
| `source_id` | TEXT | Provider's external ID |
| `created_at` | TEXT | Timestamp of creation (`CURRENT_TIMESTAMP`) |

### Table: `settings`
- `key` (TEXT PRIMARY KEY): e.g. `'tmdb_api_key'`, `'google_books_api_key'`, `'dismissed_duplicates'`
- `value` (TEXT)

---

## 💻 Source Code Context & Directory Structure

```
media_tracker/
├── electron/                   # Electron Main & IPC Handlers (CommonJS .cts -> .cjs)
│   ├── main.cts                # Window management, lifecycle, image copying
│   ├── preload.cts             # Context bridge exposing window.electronAPI
│   ├── database.cts            # SQLite connection, V3 migrations, IPC handlers, deduplication, backfill
│   ├── tmdb.cts                # TMDB API client with advanced search & runtime extraction
│   ├── books.cts               # Google Books + Open Library client with pageCount & filters
│   ├── anilist.cts             # AniList GraphQL client with episodes, chapters, runtime & pageCount
│   └── tsconfig.json           # Target NodeNext -> dist-electron/*.cjs
├── src/                        # React 19 Frontend
│   ├── components/
│   │   ├── AddEditModal.tsx    # Modal to add/edit media with tag autocomplete and duration/pages fields
│   │   ├── CategoryIcon.tsx    # SVG icons for the 6 media categories
│   │   ├── DeduplicationModal.tsx # Side-by-side comparison & resolution of duplicate entries
│   │   ├── DiscoverView.tsx    # Full-page media search with Advanced Search and card grid
│   │   ├── ImportModal.tsx     # Bulk .txt import (Manual or sequential online autofill)
│   │   ├── MediaCard.tsx       # Library card with poster, priority border, rating, and actions
│   │   ├── MediaInspectionModal.tsx # Rich inspection modal before adding media to library
│   │   ├── MetadataSearchModal.tsx  # Modal used for quick autofill and bulk import matching
│   │   ├── SettingsModal.tsx   # Settings modal for TMDB and Google Books API keys
│   │   └── StatisticsView.tsx  # Analytics dashboard: YTD watch time, pages, and monthly charts
│   ├── App.tsx                 # Core UI: view switcher (Library, Discover, Statistics), subtabs, duplicate banner
│   ├── types.ts                # TypeScript interfaces (MediaItem, DuplicatePair, AdvancedSearchFilters)
│   ├── index.css & App.css     # TailwindCSS v4 styling
│   └── main.tsx                # React root mount
└── package.json                # Project dependencies and build scripts
```

---

## 🛠 How to Build & Run

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Run in Development**:
   ```bash
   npm run dev
   ```
3. **Build Frontend & Electron**:
   ```bash
   npm run build
   ```
4. **Compile Production Windows Executable (`.exe`)**:
   ```bash
   npm run make
   ```
   Generates the standalone installer in `dist-exe/`.
