"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('fs');
const makeRequest = async (url, attempts = 3) => {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MediaTracker/1.0.0 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
    };
    try {
        const response = await fetch(url, { headers });
        let data = null;
        try {
            data = await response.json();
        }
        catch (e) {
            // Non-JSON response
        }
        if (!response.ok) {
            const statusMsg = data?.error?.message || response.statusText || 'Google Books API Request Failed';
            const err = new Error(`Google Books API Error [Code ${response.status}]: ${statusMsg}`);
            err.code = response.status;
            err.statusMessage = statusMsg;
            throw err;
        }
        if (data !== null) {
            return data;
        }
        else {
            const err = new Error(`Google Books Error [Code ${response.status}]: Invalid JSON response`);
            err.code = response.status;
            throw err;
        }
    }
    catch (err) {
        const errCode = err.code || err.cause?.code || 'NET_ERROR';
        if (attempts > 1 && (errCode === 'ECONNRESET' || errCode === 'ETIMEDOUT' || err.name === 'FetchError' || err.message?.includes('fetch failed'))) {
            console.log(`Retrying Google Books request (${errCode})... (${attempts - 1} left)`);
            await new Promise(r => setTimeout(r, 1000));
            return makeRequest(url, attempts - 1);
        }
        if (!err.code)
            err.code = errCode;
        throw err;
    }
};
const sanitizeImageUrl = (url) => {
    if (!url)
        return null;
    let secureUrl = url.replace(/^http:\/\//i, 'https://');
    return secureUrl;
};
const searchOpenLibrary = async (query) => {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MediaTracker/1.0.0 Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    });
    if (!response.ok) {
        throw new Error(`Open Library Error [${response.status}]: ${response.statusText}`);
    }
    const data = await response.json();
    const docs = data.docs || [];
    return docs.map((doc) => {
        const coverId = doc.cover_i;
        const posterUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
        return {
            id: `ol_${doc.key?.replace('/works/', '') || doc.key}`,
            title: doc.title || 'Untitled Book',
            year: doc.first_publish_year ? String(doc.first_publish_year) : '',
            author: (doc.author_name || []).join(', '),
            poster_path: posterUrl,
            overview: Array.isArray(doc.first_sentence) ? doc.first_sentence.join(' ') : (doc.first_sentence || ''),
            genre: (doc.subject || []).slice(0, 4).join(', '),
            media_type: 'Books'
        };
    });
};
const getOpenLibraryDetails = async (workId) => {
    const cleanId = workId.replace(/^ol_/, '');
    const url = `https://openlibrary.org/works/${cleanId}.json`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MediaTracker/1.0.0 Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    });
    if (!response.ok) {
        throw new Error(`Open Library Details Error [${response.status}]: ${response.statusText}`);
    }
    const data = await response.json();
    const coverId = data.covers?.[0];
    const posterUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
    const desc = typeof data.description === 'string' ? data.description : (data.description?.value || '');
    return {
        title: data.title || 'Untitled Book',
        author: '',
        genre: (data.subjects || []).slice(0, 4).join(', '),
        year: '',
        overview: desc,
        poster_path: posterUrl,
        media_type: 'Books'
    };
};
module.exports = {
    search: async (query, apiKey) => {
        let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8`;
        if (apiKey && apiKey.trim()) {
            url += `&key=${apiKey.trim()}`;
        }
        try {
            const data = await makeRequest(url);
            if (data?.items && data.items.length > 0) {
                return data.items.map((item) => {
                    const info = item.volumeInfo || {};
                    const imageLinks = info.imageLinks || {};
                    const posterUrl = sanitizeImageUrl(imageLinks.extraLarge || imageLinks.large || imageLinks.medium || imageLinks.thumbnail || imageLinks.smallThumbnail);
                    return {
                        id: item.id,
                        title: info.title || 'Untitled Book',
                        year: (info.publishedDate || '').split('-')[0],
                        author: (info.authors || []).join(', '),
                        poster_path: posterUrl,
                        overview: info.description || '',
                        genre: (info.categories || []).join(', '),
                        media_type: 'Books'
                    };
                });
            }
        }
        catch (err) {
            console.warn('Google Books query failed, attempting Open Library fallback...', err.message);
            try {
                return await searchOpenLibrary(query);
            }
            catch (olErr) {
                throw err; // Return the primary error if fallback also fails
            }
        }
        // If Google Books returned 0 items, check Open Library
        try {
            return await searchOpenLibrary(query);
        }
        catch (e) {
            return [];
        }
    },
    getDetails: async (id, apiKey) => {
        if (String(id).startsWith('ol_')) {
            return await getOpenLibraryDetails(id);
        }
        let url = `https://www.googleapis.com/books/v1/volumes/${id}`;
        if (apiKey && apiKey.trim()) {
            url += `?key=${encodeURIComponent(apiKey.trim())}`;
        }
        try {
            const data = await makeRequest(url);
            const info = data.volumeInfo || {};
            const imageLinks = info.imageLinks || {};
            const posterUrl = sanitizeImageUrl(imageLinks.extraLarge || imageLinks.large || imageLinks.medium || imageLinks.thumbnail || imageLinks.smallThumbnail);
            return {
                title: info.title || 'Untitled Book',
                author: (info.authors || []).join(', '),
                genre: (info.categories || []).join(', '),
                year: (info.publishedDate || '').split('-')[0],
                overview: info.description || '',
                poster_path: posterUrl,
                media_type: 'Books'
            };
        }
        catch (e) {
            console.error('Google Books Details Error:', e.message);
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
