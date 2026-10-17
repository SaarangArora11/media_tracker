const fs = require('fs');

const makeGraphQLRequest = async (query: string, variables: any, attempts = 3): Promise<any> => {
    const url = 'https://graphql.anilist.co';
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MediaTracker/1.0.0 Chrome/120.0.0.0 Safari/537.36'
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query, variables })
        });

        let data: any = null;
        try {
            data = await response.json();
        } catch (e) {
            // Non-JSON response
        }

        if (!response.ok) {
            const errorMsg = data?.errors?.[0]?.message || response.statusText || 'AniList API Request Failed';
            const err: any = new Error(`AniList API Error [Code ${response.status}]: ${errorMsg}`);
            err.code = response.status;
            err.statusMessage = errorMsg;
            throw err;
        }

        if (data?.errors && data.errors.length > 0) {
            const errorMsg = data.errors[0].message;
            const err: any = new Error(`AniList GraphQL Error: ${errorMsg}`);
            err.code = 'GRAPHQL_ERROR';
            throw err;
        }

        if (data?.data) {
            return data.data;
        } else {
            const err: any = new Error(`AniList Error: Invalid response structure`);
            err.code = 'INVALID_RESPONSE';
            throw err;
        }
    } catch (err: any) {
        const errCode = err.code || err.cause?.code || 'NET_ERROR';
        if (attempts > 1 && (errCode === 'ECONNRESET' || errCode === 'ETIMEDOUT' || err.name === 'FetchError' || err.message?.includes('fetch failed'))) {
            console.log(`Retrying AniList request (${errCode})... (${attempts - 1} left)`);
            await new Promise(r => setTimeout(r, 1000));
            return makeGraphQLRequest(query, variables, attempts - 1);
        }
        if (!err.code) err.code = errCode;
        throw err;
    }
};

const cleanDescription = (desc?: string): string => {
    if (!desc) return '';
    return desc
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[^>]+(>|$)/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#039;/g, "'")
        .trim();
};

const parseMediaItem = (item: any, defaultCategory: string) => {
    const isManga = item.type === 'MANGA' || defaultCategory === 'Manga';
    const isAnime = item.type === 'ANIME' || defaultCategory === 'Anime';
    const appCategory = isManga ? 'Manga' : (isAnime ? 'Anime' : 'Anime');

    // Title selection (favor English, then Romaji, then Native)
    const title = item.title?.english || item.title?.romaji || item.title?.native || 'Untitled';

    // Staff parsing
    const staffEdges = item.staff?.edges || [];
    let author = '';
    let director = '';

    if (isManga) {
        const authors = staffEdges
            .filter((e: any) => {
                const role = (e.role || '').toLowerCase();
                return role.includes('story') || role.includes('art') || role.includes('creator') || role.includes('original');
            })
            .map((e: any) => e.node?.name?.full)
            .filter(Boolean);
        author = Array.from(new Set(authors)).join(', ');
    }

    if (isAnime) {
        const directors = staffEdges
            .filter((e: any) => {
                const role = (e.role || '').toLowerCase();
                return role.includes('director') || role.includes('series composition');
            })
            .map((e: any) => e.node?.name?.full)
            .filter(Boolean);
        director = Array.from(new Set(directors)).join(', ');
    }

    const studio = item.studios?.nodes?.[0]?.name || '';
    const genres = (item.genres || []).join(', ');
    const poster = item.coverImage?.extraLarge || item.coverImage?.large || item.coverImage?.medium || null;
    const year = item.startDate?.year ? String(item.startDate.year) : '';
    const overview = cleanDescription(item.description);

    let runtime: number | null = null;
    let pageCount: number | null = null;

    if (isAnime) {
        const duration = item.duration || 24;
        const episodes = item.episodes || 1;
        runtime = duration * episodes;
    } else if (isManga) {
        if (item.chapters) {
            pageCount = item.chapters * 20;
        } else if (item.volumes) {
            pageCount = item.volumes * 190;
        }
    }

    const rating = item.averageScore ? Math.round(item.averageScore / 10) : null;

    return {
        id: item.id,
        title,
        category: appCategory,
        media_type: appCategory,
        year,
        genre: genres,
        author,
        director,
        studio,
        overview,
        poster_path: poster,
        backdrop_path: item.bannerImage || null,
        runtime: runtime,
        page_count: pageCount,
        episodes: item.episodes || null,
        chapters: item.chapters || null,
        volumes: item.volumes || null,
        rating: rating,
        source: 'anilist',
        source_id: String(item.id)
    };
};

const SEARCH_QUERY = `
query ($search: String, $type: MediaType, $startDate_like: String) {
  Page(page: 1, perPage: 10) {
    media(search: $search, type: $type, startDate_like: $startDate_like, sort: POPULARITY_DESC) {
      id
      type
      format
      episodes
      duration
      chapters
      volumes
      averageScore
      title {
        romaji
        english
        native
      }
      startDate {
        year
      }
      genres
      description(asHtml: false)
      coverImage {
        extraLarge
        large
        medium
      }
      bannerImage
      staff(perPage: 10) {
        edges {
          role
          node {
            name {
              full
            }
          }
        }
      }
      studios(isMain: true) {
        nodes {
          name
        }
      }
    }
  }
}
`;

const DETAILS_QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id
    type
    format
    episodes
    duration
    chapters
    volumes
    averageScore
    title {
      romaji
      english
      native
    }
    startDate {
      year
    }
    genres
    description(asHtml: false)
    coverImage {
      extraLarge
      large
      medium
    }
    bannerImage
    staff(perPage: 25) {
      edges {
        role
        node {
          name {
            full
          }
        }
      }
    }
    studios(isMain: true) {
      nodes {
        name
      }
    }
  }
}
`;

module.exports = {
    search: async (query: string, category: string = 'Anime', advancedFilters?: { year?: string; creator?: string }) => {
        const isManga = category === 'Manga';
        const mediaType = isManga ? 'MANGA' : 'ANIME';

        const variables: any = {
            search: query,
            type: mediaType
        };

        if (advancedFilters?.year && advancedFilters.year.trim()) {
            variables.startDate_like = `${advancedFilters.year.trim()}%`;
        }

        const data = await makeGraphQLRequest(SEARCH_QUERY, variables);

        let items = data?.Page?.media || [];

        if (advancedFilters?.creator && advancedFilters.creator.trim()) {
            const creatorLow = advancedFilters.creator.toLowerCase().trim();
            const filtered = items.filter((item: any) => {
                const staff = item.staff?.edges || [];
                return staff.some((s: any) => s.node?.name?.full?.toLowerCase().includes(creatorLow));
            });
            if (filtered.length > 0) items = filtered;
        }

        return items.map((item: any) => parseMediaItem(item, category));
    },

    getDetails: async (id: number, category: string = 'Anime') => {
        const data = await makeGraphQLRequest(DETAILS_QUERY, {
            id: Number(id)
        });

        const item = data?.Media;
        if (!item) throw new Error(`Media not found for AniList ID ${id}`);

        const parsed = parseMediaItem(item, category);
        return {
            title: parsed.title,
            genre: parsed.genre,
            author: parsed.author,
            director: parsed.director,
            studio: parsed.studio,
            year: parsed.year,
            overview: parsed.overview,
            poster_path: parsed.poster_path,
            backdrop_path: parsed.backdrop_path,
            category: parsed.category,
            media_type: parsed.media_type,
            runtime: parsed.runtime,
            page_count: parsed.page_count,
            episodes: parsed.episodes,
            chapters: parsed.chapters,
            volumes: parsed.volumes,
            rating: parsed.rating,
            source: 'anilist',
            source_id: String(id)
        };
    },

    downloadImage: async (url: string, destPath: string) => {
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MediaTracker/1.0.0 Chrome/120.0.0.0 Safari/537.36'
                }
            });
            if (!res.ok) throw new Error(`Failed to fetch image [Code ${res.status}]: ${res.statusText}`);
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            await fs.promises.writeFile(destPath, buffer);
            return true;
        } catch (err: any) {
            if (fs.existsSync(destPath)) {
                try { fs.unlinkSync(destPath); } catch (e) {}
            }
            throw err;
        }
    }
};
