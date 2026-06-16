const https = require('https');
const fs = require('fs');

const makeRequest = (url: string, token?: string, attempts = 3) => {
    return new Promise((resolve, reject) => {
        const options: any = {
            headers: {
                'User-Agent': 'MediaTracker/1.0.0 (electron)',
                'Accept': 'application/json',
                'Connection': 'close'
            },
            family: 4 // Enforce IPv4
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = https.get(url, options, (res: any) => {
            let data = '';
            res.on('data', (chunk: any) => data += chunk);
            res.on('end', () => {
                try {
                    // Check for non-200 status codes
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        return reject(new Error(`TMDB API Error: ${res.statusCode} ${res.statusMessage}`));
                    }
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (err: any) => {
            // Retry mechanisms
            if (attempts > 1) {
                console.log(`Retrying TMDB request... (${attempts - 1} left)`);
                setTimeout(() => {
                    makeRequest(url, token, attempts - 1).then(resolve).catch(reject);
                }, 1000); // 1 second delay
            } else {
                reject(err);
            }
        });
    });
};

const GENRES: Record<number, string> = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama",
    10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
    878: "Science Fiction", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western", 10759: "Action & Adventure",
    10762: "Kids", 10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics"
};

const mapGenres = (ids: number[]) => {
    return ids.map(id => GENRES[id]).filter(Boolean).join(', ');
};

module.exports = {
    search: async (query: string, category: string, apiKey: string) => {
        // Map app category to TMDB type
        let type = 'multi';
        if (category === 'Movies') type = 'movie';
        else if (category === 'Series' || category === 'Anime') type = 'tv';

        // If it's Books/Games/Manga, TMDB won't help much, but we'll return empty or try multi
        if (['Books', 'Games', 'Manga'].includes(category)) return [];

        let url = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(query)}&page=1`;
        let token = undefined;

        // Determine if using v3 API Key or v4 Bearer Token
        if (apiKey.length > 40) {
            token = apiKey; // Assume Bearer Token
        } else {
            url += `&api_key=${apiKey}`; // Assume v3 API Key
        }

        try {
            const data: any = await makeRequest(url, token);
            if (!data.results) return [];

            return data.results.slice(0, 5).map((r: any) => ({
                id: r.id,
                title: r.title || r.name, // Movie is title, TV is name
                year: (r.release_date || r.first_air_date || '').split('-')[0],
                poster_path: r.poster_path ? `https://image.tmdb.org/t/p/w200${r.poster_path}` : null,
                overview: r.overview,
                media_type: r.media_type || type // 'movie' or 'tv'
            }));
        } catch (e) {
            console.error('TMDB Search Error:', e);
            return [];
        }
    },

    getDetails: async (id: number, type: string, apiKey: string) => {
        // type might be 'Movies' from app, convert to 'movie' or 'tv'
        let tmdbType = 'movie';
        if (type === 'Series' || type === 'Anime' || type === 'tv') tmdbType = 'tv';

        let url = `https://api.themoviedb.org/3/${tmdbType}/${id}?append_to_response=credits`;
        let token = undefined;

        if (apiKey.length > 40) {
            token = apiKey;
        } else {
            url += `&api_key=${apiKey}`;
        }

        try {
            const data: any = await makeRequest(url, token);

            const directors = data.credits?.crew?.filter((c: any) => c.job === 'Director').map((c: any) => c.name).join(', ') || '';
            const genres = data.genres?.map((g: any) => g.name).join(', ') || '';

            return {
                title: data.title || data.name,
                genre: genres,
                director: directors,
                poster_path: data.poster_path ? `https://image.tmdb.org/t/p/original${data.poster_path}` : null, // High res for saving
            };
        } catch (e) {
            console.error('TMDB Details Error:', e);
            throw e;
        }
    },

    downloadImage: (url: string, destPath: string) => {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destPath);
            https.get(url, (response: any) => {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(true);
                });
            }).on('error', (err: any) => {
                fs.unlink(destPath, () => { });
                reject(err);
            });
        });
    }
};
