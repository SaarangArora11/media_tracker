# 🎬 Media Tracker

A modern, localized, offline-first desktop application to organize, log, and discover your personal media library across **Movies**, **TV Series**, **Anime**, **Books**, **Games**, and **Manga**.

---

## 📸 Screenshots

<!-- Place your application screenshots in docs/screenshots/ and update the paths below -->

| **Main Dashboard & Library** | **Universal Metadata Search** |
| :---: | :---: |
| ![Main Dashboard](https://via.placeholder.com/600x380/1e1e1e/60a5fa?text=Main+Dashboard+View) <br> *(Replace: `./docs/screenshots/dashboard.png`)* | ![Metadata Search](https://via.placeholder.com/600x380/1e1e1e/ec4899?text=Universal+Metadata+Search) <br> *(Replace: `./docs/screenshots/search-modal.png`)* |

| **Add & Edit Entry Modal** | **Settings & API Configuration** |
| :---: | :---: |
| ![Add Entry Modal](https://via.placeholder.com/600x380/1e1e1e/10b981?text=Add+Entry+Form+%2B+Autofill) <br> *(Replace: `./docs/screenshots/add-entry.png`)* | ![Settings Modal](https://via.placeholder.com/600x380/1e1e1e/8b5cf6?text=API+Settings+%26+Configuration) <br> *(Replace: `./docs/screenshots/settings.png`)* |

---

## ✨ Features

### 1. 🗂️ Universal Media Support
Log and track media across 6 dedicated categories with customized metadata fields:
- **Movies & TV Series**: Director, Writers, Cast, Genres, Ratings, Review, Finished Dates.
- **Anime & Manga**: Studio, Mangaka / Authors, Genres, Episode / Chapter tracking.
- **Books**: Author, Published Year, Categories, Synopsis.
- **Games**: Studio / Developer, Platform (PC, PS5, Switch, etc.), Priority.

### 2. 🔍 Integrated Online Metadata Search & Autofill
Instant metadata search and cover retrieval from top global databases:
- 🎬 **The Movie Database (TMDB)**: High-resolution posters, release years, directors, cast, and genres for Movies and Series.
- 🌸 **AniList GraphQL API**: Free, instant metadata search for Anime (studios, directors) and Manga (mangaka, artists).
- 📖 **Google Books API + Open Library**: Complete book metadata and book covers with automatic Open Library fallback.

### 3. 🎨 Smart Organization & Filtering
- **Status Tabs**: Easily switch between `Watching`, `To Consume`, and `Consumed`.
- **Dynamic Grouping**: Group your library on the fly by **Category**, **Priority** (High/Normal/Low), **Location** (e.g. Theatre, Home), or **Genre**.
- **Search & Sort**: Full-text instant title search, tag filtering with autocomplete, and sorting by Newest, Title (A-Z), Rating, or Date Finished.

### 4. 💾 Local-First & Privacy Focused
- **Zero Cloud Lock-in**: Powered by local SQLite (`better-sqlite3`) stored directly on your computer.
- **Local Poster Downloads**: Cover images are automatically downloaded and stored locally in `%APPDATA%/covers`.
- **1-Click Backup & Restore**: Bundle your entire database and all cover images into a portable `.zip` backup archive at any time.
- **Bulk `.txt` Import**: Bulk import titles from plain text files and match them via online metadata search.

---

## 🛠️ Tech Stack

- **Desktop Framework**: [Electron](https://www.electronjs.org/)
- **Frontend UI**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [TailwindCSS v4](https://tailwindcss.com/), [Vite](https://vitejs.dev/)
- **Database**: [SQLite](https://sqlite.org/) via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3)
- **Packaging**: [electron-builder](https://www.electron.build/) (Windows NSIS Installer)
- **APIs**: TMDB v3/v4 API, AniList GraphQL API, Google Books API, Open Library API

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` or `yarn`

### Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/media_tracker.git
   cd media_tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch in development mode:
   ```bash
   npm run dev
   ```

---

## 🔑 API Configuration (Optional)

You can configure metadata providers by clicking the **Settings (⚙️)** button in the top bar of the application:

| Provider | Supported Categories | Requirements |
| :--- | :--- | :--- |
| **TMDB** | Movies, TV Series | Free API Key from [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |
| **Google Books** | Books | Optional (Free tier active; add key from [Google Cloud Console](https://console.cloud.google.com/) for higher limits) |
| **AniList** | Anime, Manga | **100% Free** (Public GraphQL API — no key required) |

---

## 📦 Building the Standalone Executable (.exe)

To compile and package the production Windows installer executable:

```bash
npm run make
```

The compiled installer will be generated in:
- **Installer**: `dist-exe/MediaTracker2026 Setup 1.0.0.exe`
- **Unpacked Binary**: `dist-exe/win-unpacked/MediaTracker2026.exe`

---

## 📂 Data Storage Locations

Your local database and downloaded posters are stored in your Windows user profile:
- **Database**: `%APPDATA%\MediaTracker2026\media_tracker.db`
- **Covers Directory**: `%APPDATA%\MediaTracker2026\covers\`

---

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).
