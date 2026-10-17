"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('fs');
const makeRequest = async (url, token, attempts = 3) => {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MediaTracker/1.0.0 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    try {
        const response = await fetch(url, { headers });
        let data = null;
        try {
            data = await response.json();
        }
        catch (e) {
            // non-JSON response
        }
        if (!response.ok) {
            const statusMsg = data?.status_message || response.statusText || 'TMDB API Request Failed';
            const err = new Error(`TMDB API Error [Code ${response.status}]: ${statusMsg}`);
            err.code = response.status;
            err.statusMessage = statusMsg;
            throw err;
        }
        if (data !== null) {
            return data;
        }
        else {
            const err = new Error(`TMDB Error [Code ${response.status}]: Invalid JSON response`);
            err.code = response.status;
            throw err;
        }
    }
    catch (err) {
        const errCode = err.code || err.cause?.code || 'NET_ERROR';
        if (attempts > 1 && (errCode === 'ECONNRESET' || errCode === 'ETIMEDOUT' || err.name === 'FetchError' || err.message?.includes('fetch failed'))) {
            console.log(`Retrying TMDB request (${errCode})... (${attempts - 1} left)`);
            await new Promise(r => setTimeout(r, 1000));
            return makeRequest(url, token, attempts - 1);
        }
        if (!err.code)
            err.code = errCode;
        throw err;
    }
};
const GENRES = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama",
    10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
    878: "Science Fiction", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western", 10759: "Action & Adventure",
    10762: "Kids", 10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics"
};
const mapGenres = (ids) => {
    return ids.map(id => GENRES[id]).filter(Boolean).join(', ');
};
module.exports = {
    search: async (query, category, apiKey, advancedFilters) => {
        // Map app category to TMDB type
        let type = 'multi';
        if (category === 'Movies')
            type = 'movie';
        else if (category === 'Series' || category === 'Anime')
            type = 'tv';
        // If it's Books/Games/Manga, TMDB won't help much, but we'll return empty or try multi
        if (['Books', 'Games', 'Manga'].includes(category))
            return [];
        let url = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(query)}&page=1`;
        if (advancedFilters?.year) {
            if (type === 'movie') {
                url += `&primary_release_year=${encodeURIComponent(advancedFilters.year.trim())}`;
            }
            else if (type === 'tv') {
                url += `&first_air_date_year=${encodeURIComponent(advancedFilters.year.trim())}`;
            }
            else {
                url += `&year=${encodeURIComponent(advancedFilters.year.trim())}`;
            }
        }
        let token = undefined;
        // Determine if using v3 API Key or v4 Bearer Token
        if (apiKey.length > 40) {
            token = apiKey; // Assume Bearer Token
        }
        else {
            url += `&api_key=${apiKey}`; // Assume v3 API Key
        }
        const data = await makeRequest(url, token);
        if (!data || !data.results)
            return [];
        let results = data.results;
        // If creator filter is specified, we can optionally filter by creator or search person
        if (advancedFilters?.creator && advancedFilters.creator.trim()) {
            const creatorLow = advancedFilters.creator.toLowerCase().trim();
            // Best effort filter on overview or title if present
            const matched = results.filter((r) => (r.overview && r.overview.toLowerCase().includes(creatorLow)) ||
                (r.title && r.title.toLowerCase().includes(creatorLow)));
            if (matched.length > 0)
                results = matched;
        }
        return results.slice(0, 10).map((r) => ({
            id: r.id,
            title: r.title || r.name, // Movie is title, TV is name
            year: (r.release_date || r.first_air_date || '').split('-')[0],
            poster_path: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : null,
            backdrop_path: r.backdrop_path ? `https://image.tmdb.org/t/p/w780${r.backdrop_path}` : null,
            overview: r.overview,
            rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
            media_type: r.media_type || type, // 'movie' or 'tv'
            source: 'tmdb',
            source_id: String(r.id)
        }));
    },
    getDetails: async (id, type, apiKey) => {
        // type might be 'Movies' from app, convert to 'movie' or 'tv'
        let tmdbType = 'movie';
        if (type === 'Series' || type === 'Anime' || type === 'tv')
            tmdbType = 'tv';
        let url = `https://api.themoviedb.org/3/${tmdbType}/${id}?append_to_response=credits`;
        let token = undefined;
        if (apiKey.length > 40) {
            token = apiKey;
        }
        else {
            url += `&api_key=${apiKey}`;
        }
        try {
            const data = await makeRequest(url, token);
            const directors = data.credits?.crew?.filter((c) => c.job === 'Director').map((c) => c.name).join(', ') || '';
            const writers = data.credits?.crew?.filter((c) => c.department === 'Writing').map((c) => c.name).slice(0, 3).join(', ') || '';
            const actors = data.credits?.cast?.slice(0, 6).map((c) => c.name).join(', ') || '';
            const genres = data.genres?.map((g) => g.name).join(', ') || '';
            const year = (data.release_date || data.first_air_date || '').split('-')[0];
            let runtime = null;
            if (tmdbType === 'movie') {
                runtime = data.runtime || null;
            }
            else {
                const epDuration = (data.episode_run_time && data.episode_run_time[0]) || 45;
                const epCount = data.number_of_episodes || 1;
                runtime = epDuration * epCount;
            }
            return {
                title: data.title || data.name,
                genre: genres,
                director: directors,
                writer: writers,
                actors: actors,
                year: year,
                overview: data.overview || '',
                runtime: runtime,
                episodes: data.number_of_episodes || null,
                seasons: data.number_of_seasons || null,
                rating: data.vote_average ? Math.round(data.vote_average * 10) / 10 : null,
                poster_path: data.poster_path ? `https://image.tmdb.org/t/p/original${data.poster_path}` : null,
                backdrop_path: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : null,
                source: 'tmdb',
                source_id: String(data.id)
            };
        }
        catch (e) {
            console.error('TMDB Details Error:', e);
            throw e;
        }
    },
    downloadImage: async (url, destPath) => {
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MediaTracker/1.0.0 Chrome/120.0.0.0 Safari/537.36'
                }
            });
            if (!res.ok)
                throw new Error(`Failed to fetch image [Code ${res.status}]: ${res.statusText}`);
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            await fs.promises.writeFile(destPath, buffer);
            return true;
        }
        catch (err) {
            if (fs.existsSync(destPath)) {
                try {
                    fs.unlinkSync(destPath);
                }
                catch (e) { }
            }
            throw err;
        }
    }
};
