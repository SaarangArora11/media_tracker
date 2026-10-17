import React, { useState, useMemo } from 'react';
import type { MediaItem, MediaCategory } from '../types';
import CategoryIcon from './CategoryIcon';

interface StatisticsViewProps {
    items: MediaItem[];
    onRefresh: () => void;
}

const StatisticsView: React.FC<StatisticsViewProps> = ({ items, onRefresh }) => {
    // Determine available years from date_finished and created_at
    const availableYears = useMemo(() => {
        const yearsSet = new Set<string>();
        const currentYear = new Date().getFullYear().toString();
        yearsSet.add(currentYear);

        items.forEach(i => {
            if (i.date_finished) {
                const yr = i.date_finished.split('-')[0];
                if (yr && yr.length === 4) yearsSet.add(yr);
            } else if (i.created_at) {
                const yr = i.created_at.split('-')[0];
                if (yr && yr.length === 4) yearsSet.add(yr);
            }
        });

        return Array.from(yearsSet).sort().reverse();
    }, [items]);

    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState<number | null>(() => {
        // Default to current month index (0-11)
        return new Date().getMonth();
    });
    const [isBackfilling, setIsBackfilling] = useState(false);
    const [backfillMessage, setBackfillMessage] = useState<string | null>(null);

    // Filter completed items for selected year (or all time)
    const completedItems = useMemo(() => {
        return items.filter(item => {
            if (item.status !== 'Consumed') return false;
            if (selectedYear === 'All Time') return true;

            const dateStr = item.date_finished || item.created_at || '';
            return dateStr.startsWith(selectedYear);
        });
    }, [items, selectedYear]);

    // Format finished dates cleanly
    const formatFinishedDate = (dateStr?: string | null) => {
        if (!dateStr) return '';
        try {
            const parts = dateStr.split('-');
            if (parts.length >= 3) {
                const year = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const day = parseInt(parts[2].slice(0, 2), 10);
                const d = new Date(year, month, day);
                return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            }
        } catch (e) {}
        return dateStr;
    };

    // Filter and sort items completed in the selected month
    const monthCompletedItems = useMemo(() => {
        if (selectedMonth === null) return [];

        const targetMonthStr = String(selectedMonth + 1).padStart(2, '0');

        const matching = completedItems.filter(item => {
            const dateStr = item.date_finished || item.created_at || '';
            if (selectedYear !== 'All Time') {
                return dateStr.startsWith(`${selectedYear}-${targetMonthStr}`);
            } else {
                return new RegExp(`^\\d{4}-${targetMonthStr}`).test(dateStr);
            }
        });

        // Category sorting hierarchy:
        // Movies -> Series -> Anime -> Books -> Games -> Manga
        const categoryOrder: Record<string, number> = {
            Movies: 1,
            Series: 2,
            Anime: 3,
            Books: 4,
            Games: 5,
            Manga: 6
        };

        return matching.sort((a, b) => {
            const catOrderA = categoryOrder[a.category] || 99;
            const catOrderB = categoryOrder[b.category] || 99;

            // 1. Sort by Category
            if (catOrderA !== catOrderB) {
                return catOrderA - catOrderB;
            }

            // 2. Within Category, sort by Date from earliest to latest
            const dateA = a.date_finished || a.created_at || '';
            const dateB = b.date_finished || b.created_at || '';
            return dateA.localeCompare(dateB);
        });
    }, [completedItems, selectedMonth, selectedYear]);

    // Compute key statistics
    const stats = useMemo(() => {
        let totalWatchMinutes = 0;
        let totalPages = 0;
        let ratedCount = 0;
        let ratingSum = 0;

        const categoryCounts: Record<MediaCategory, number> = {
            Movies: 0,
            Series: 0,
            Anime: 0,
            Books: 0,
            Games: 0,
            Manga: 0
        };

        const genreCounts: Record<string, number> = {};

        // Month-by-month stats [0..11]
        const monthlyStats = Array.from({ length: 12 }, () => ({
            itemsCount: 0,
            watchMinutes: 0,
            pagesRead: 0
        }));

        completedItems.forEach(item => {
            categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;

            if (item.rating) {
                ratedCount++;
                ratingSum += item.rating;
            }

            if (item.genre) {
                item.genre.split(',').forEach(g => {
                    const cleanG = g.trim();
                    if (cleanG) {
                        genreCounts[cleanG] = (genreCounts[cleanG] || 0) + 1;
                    }
                });
            }

            // Watch time (Movies, Series, Anime)
            let itemMinutes = 0;
            if (item.category === 'Movies' || item.category === 'Series' || item.category === 'Anime') {
                if (item.runtime && item.runtime > 0) {
                    itemMinutes = item.runtime;
                } else {
                    // Reasonable fallback estimate
                    itemMinutes = item.category === 'Movies' ? 110 : (item.category === 'Anime' ? 24 * 12 : 45 * 8);
                }
                totalWatchMinutes += itemMinutes;
            }

            // Page count (Books, Manga)
            let itemPages = 0;
            if (item.category === 'Books' || item.category === 'Manga') {
                if (item.page_count && item.page_count > 0) {
                    itemPages = item.page_count;
                } else {
                    // Reasonable fallback estimate
                    itemPages = item.category === 'Books' ? 320 : 180;
                }
                totalPages += itemPages;
            }

            // Month attribution
            const dateStr = item.date_finished || item.created_at || '';
            const match = dateStr.match(/^\d{4}-(\d{2})/);
            if (match) {
                const monthIndex = parseInt(match[1], 10) - 1;
                if (monthIndex >= 0 && monthIndex < 12) {
                    monthlyStats[monthIndex].itemsCount += 1;
                    monthlyStats[monthIndex].watchMinutes += itemMinutes;
                    monthlyStats[monthIndex].pagesRead += itemPages;
                }
            }
        });

        // Estimated reading time: ~1.5 minutes per page (~40 pages/hr)
        const readingMinutes = totalPages * 1.5;

        // Top 5 Genres
        const topGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        return {
            totalCompleted: completedItems.length,
            totalWatchMinutes,
            totalPages,
            readingMinutes,
            avgRating: ratedCount > 0 ? (ratingSum / ratedCount).toFixed(1) : null,
            categoryCounts,
            topGenres,
            monthlyStats
        };
    }, [completedItems]);

    // Format minutes into human-readable text
    const formatDuration = (totalMinutes: number) => {
        const days = Math.floor(totalMinutes / (60 * 24));
        const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
        const minutes = Math.round(totalMinutes % 60);

        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0 || days > 0) parts.push(`${hours}h`);
        parts.push(`${minutes}m`);

        return parts.join(' ');
    };

    const handleBackfill = async () => {
        setIsBackfilling(true);
        setBackfillMessage(null);
        try {
            const res = await window.electronAPI.invoke('backfill-missing-stats');
            if (res.success) {
                setBackfillMessage(`Synced durations & pages for ${res.updatedCount} items!`);
                onRefresh();
            } else {
                setBackfillMessage(res.message || 'Backfill failed.');
            }
        } catch (err: any) {
            setBackfillMessage(err.message || 'Backfill failed.');
        } finally {
            setIsBackfilling(false);
        }
    };

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const maxMonthlyItems = Math.max(...stats.monthlyStats.map(m => m.itemsCount), 1);

    return (
        <div className="flex-1 w-full max-w-7xl mx-auto p-6 space-y-8 animate-fade-in">
            {/* Top Bar with Year Selector & Sync Button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800 pb-5">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                        Personal Media Analytics
                    </h1>
                    <p className="text-xs text-gray-400 mt-1">
                        Retroactive watch time, pages read, and monthly reading & watching trends.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        disabled={isBackfilling}
                        onClick={handleBackfill}
                        className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 text-xs px-3.5 py-2 rounded-xl border border-gray-700 flex items-center gap-1.5 transition-all shadow"
                        title="Auto-fetch runtimes and page counts from online sources for items missing them"
                    >
                        <span>🔄</span>
                        <span>{isBackfilling ? 'Syncing...' : 'Sync Missing Stats'}</span>
                    </button>

                    <div className="flex items-center gap-2 bg-[#1c1c1c] p-1 rounded-xl border border-gray-800">
                        {availableYears.map(yr => (
                            <button
                                key={yr}
                                onClick={() => setSelectedYear(yr)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    selectedYear === yr
                                        ? 'bg-blue-600 text-white shadow'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                {yr}
                            </button>
                        ))}
                        <button
                            onClick={() => setSelectedYear('All Time')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                selectedYear === 'All Time'
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            All Time
                        </button>
                    </div>
                </div>
            </div>

            {/* Backfill notification banner if present */}
            {backfillMessage && (
                <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-800/60 text-blue-200 text-xs flex justify-between items-center">
                    <span>ℹ️ {backfillMessage}</span>
                    <button onClick={() => setBackfillMessage(null)} className="text-blue-400 hover:text-blue-200">✕</button>
                </div>
            )}

            {/* Core KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {/* Watch Time Card */}
                <div className="p-5 rounded-2xl bg-[#1a1a1a] border border-gray-800/90 space-y-2 shadow-lg">
                    <div className="flex items-center justify-between text-gray-400 text-xs">
                        <span className="font-medium">Total Watch Time</span>
                        <span className="text-base">🎬</span>
                    </div>
                    <div className="text-2xl font-black text-white tracking-tight">
                        {formatDuration(stats.totalWatchMinutes)}
                    </div>
                    <p className="text-[11px] text-gray-500">
                        {Math.round(stats.totalWatchMinutes / 60)} total hours watched
                    </p>
                </div>

                {/* Pages Read Card */}
                <div className="p-5 rounded-2xl bg-[#1a1a1a] border border-gray-800/90 space-y-2 shadow-lg">
                    <div className="flex items-center justify-between text-gray-400 text-xs">
                        <span className="font-medium">Pages Read</span>
                        <span className="text-base">📖</span>
                    </div>
                    <div className="text-2xl font-black text-white tracking-tight">
                        {stats.totalPages.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-gray-500">
                        Across Books & Manga
                    </p>
                </div>

                {/* Estimated Reading Time */}
                <div className="p-5 rounded-2xl bg-[#1a1a1a] border border-gray-800/90 space-y-2 shadow-lg">
                    <div className="flex items-center justify-between text-gray-400 text-xs">
                        <span className="font-medium">Est. Reading Time</span>
                        <span className="text-base">⏱️</span>
                    </div>
                    <div className="text-2xl font-black text-white tracking-tight">
                        {formatDuration(stats.readingMinutes)}
                    </div>
                    <p className="text-[11px] text-gray-500">
                        Based on ~250 wpm reading rate
                    </p>
                </div>

                {/* Total Media Completed */}
                <div className="p-5 rounded-2xl bg-[#1a1a1a] border border-gray-800/90 space-y-2 shadow-lg">
                    <div className="flex items-center justify-between text-gray-400 text-xs">
                        <span className="font-medium">Completed</span>
                        <span className="text-base">🏆</span>
                    </div>
                    <div className="text-2xl font-black text-white tracking-tight">
                        {stats.totalCompleted}
                    </div>
                    <p className="text-[11px] text-gray-500">
                        Total items in {selectedYear}
                    </p>
                </div>

                {/* Average Rating */}
                <div className="p-5 rounded-2xl bg-[#1a1a1a] border border-gray-800/90 space-y-2 shadow-lg col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between text-gray-400 text-xs">
                        <span className="font-medium">Average Rating</span>
                        <span className="text-base">⭐</span>
                    </div>
                    <div className="text-2xl font-black text-amber-300 tracking-tight">
                        {stats.avgRating ? `★ ${stats.avgRating}/10` : 'N/A'}
                    </div>
                    <p className="text-[11px] text-gray-500">
                        For rated entries
                    </p>
                </div>
            </div>

            {/* Month-Wise Statistics Timeline */}
            <div className="p-6 rounded-2xl bg-[#181818] border border-gray-800 space-y-6 shadow-xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                        <h3 className="font-bold text-white text-base">Monthly Activity Breakdown ({selectedYear})</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Click on any month to inspect all media titles completed in that month.
                        </p>
                    </div>

                    {selectedMonth !== null && (
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400">Selected:</span>
                            <span className="bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2.5 py-0.5 rounded-full font-semibold">
                                {monthNames[selectedMonth]} {selectedYear !== 'All Time' ? selectedYear : ''}
                            </span>
                            <button
                                type="button"
                                onClick={() => setSelectedMonth(null)}
                                className="text-gray-400 hover:text-white underline text-[11px] ml-1"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>

                {/* Bar Graph Grid with Clickable Month Columns */}
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 pt-2">
                    {stats.monthlyStats.map((m, idx) => {
                        const heightPercent = m.itemsCount > 0 ? Math.max((m.itemsCount / maxMonthlyItems) * 100, 15) : 0;
                        const hours = Math.round(m.watchMinutes / 60);
                        const isSelected = selectedMonth === idx;

                        return (
                            <div
                                key={idx}
                                onClick={() => setSelectedMonth(idx === selectedMonth ? null : idx)}
                                className={`flex flex-col items-center gap-2 group cursor-pointer p-1 rounded-xl transition-all ${
                                    isSelected ? 'bg-blue-950/30 ring-1 ring-blue-500/60' : 'hover:bg-white/5'
                                }`}
                                title={`Click to view titles for ${monthNames[idx]}`}
                            >
                                <div className={`text-[10px] font-semibold transition-opacity ${
                                    isSelected ? 'text-blue-400 opacity-100' : 'text-gray-400 opacity-0 group-hover:opacity-100'
                                }`}>
                                    {m.itemsCount}
                                </div>
                                <div className={`w-full h-32 bg-[#222] rounded-xl flex items-end p-1.5 border transition-all relative overflow-hidden ${
                                    isSelected ? 'border-blue-500 shadow-md shadow-blue-500/20' : 'border-gray-800/80 group-hover:border-gray-700'
                                }`}>
                                    {heightPercent > 0 ? (
                                        <div
                                            style={{ height: `${heightPercent}%` }}
                                            className={`w-full rounded-lg transition-all duration-300 ${
                                                isSelected
                                                    ? 'bg-gradient-to-t from-blue-500 to-cyan-300 brightness-125'
                                                    : 'bg-gradient-to-t from-blue-600 to-teal-400 group-hover:brightness-110'
                                            }`}
                                        />
                                    ) : (
                                        <div className="w-full h-1 bg-gray-800 rounded-full" />
                                    )}
                                </div>
                                <span className={`text-xs font-medium transition-colors ${
                                    isSelected ? 'text-blue-400 font-bold' : 'text-gray-400 group-hover:text-white'
                                }`}>
                                    {monthNames[idx]}
                                </span>
                                <div className="text-[10px] text-gray-500 text-center">
                                    {hours > 0 && <span>{hours}h</span>}
                                    {hours > 0 && m.pagesRead > 0 && <span> • </span>}
                                    {m.pagesRead > 0 && <span>{m.pagesRead}p</span>}
                                    {hours === 0 && m.pagesRead === 0 && <span>-</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 1 x N Horizontally Scrollable Row for Selected Month */}
                {selectedMonth !== null && (
                    <div className="pt-5 border-t border-gray-800/80 space-y-3 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <div>
                                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                                    <span>📚 Completed in {monthNames[selectedMonth]} {selectedYear !== 'All Time' ? selectedYear : ''}</span>
                                    <span className="text-xs font-normal text-gray-400">
                                        ({monthCompletedItems.length} {monthCompletedItems.length === 1 ? 'title' : 'titles'})
                                    </span>
                                </h4>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                    Sorted by category (Movies → Series → Anime → Books → Games → Manga), then earliest to latest.
                                </p>
                            </div>
                        </div>

                        {monthCompletedItems.length > 0 ? (
                            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                {monthCompletedItems.map((item, idx) => {
                                    const prevItem = idx > 0 ? monthCompletedItems[idx - 1] : null;
                                    const isNewCategory = !prevItem || prevItem.category !== item.category;

                                    return (
                                        <React.Fragment key={item.id || idx}>
                                            {/* Visual category grouping divider */}
                                            {isNewCategory && idx > 0 && (
                                                <div className="flex flex-col justify-center items-center px-1 text-gray-600 shrink-0">
                                                    <div className="h-full w-px bg-gray-800" />
                                                </div>
                                            )}

                                            <div className="w-44 shrink-0 bg-[#202020] border border-gray-800 hover:border-blue-500/60 rounded-xl overflow-hidden shadow-lg transition-all duration-200 hover:-translate-y-1 flex flex-col group">
                                                {/* Cover Image Aspect */}
                                                <div className="aspect-2/3 w-full bg-gray-900 relative overflow-hidden">
                                                    {item.image_path ? (
                                                        <img
                                                            src={item.image_path}
                                                            alt={item.title}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 gap-1 p-2">
                                                            <CategoryIcon category={item.category} className="w-8 h-8" />
                                                            <span className="text-[10px]">No Cover</span>
                                                        </div>
                                                    )}

                                                    {/* Category Pill Overlay */}
                                                    <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-xs text-blue-400 text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 border border-white/10">
                                                        <CategoryIcon category={item.category} className="w-3 h-3" />
                                                        <span>{item.category}</span>
                                                    </div>

                                                    {/* Rating Overlay */}
                                                    {item.rating && (
                                                        <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-xs text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-white/10">
                                                            ★ {item.rating}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Info Area */}
                                                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                                                    <div>
                                                        <h5
                                                            className="font-semibold text-xs text-white line-clamp-1 group-hover:text-blue-400 transition-colors"
                                                            title={item.title}
                                                        >
                                                            {item.title}
                                                        </h5>
                                                        {(item.director || item.author || item.studio) && (
                                                            <p className="text-[10px] text-gray-400 truncate mt-0.5" title={item.director || item.author || item.studio || ''}>
                                                                {item.director || item.author || item.studio}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px] text-gray-400">
                                                        <span className="font-semibold text-emerald-400">
                                                            {formatFinishedDate(item.date_finished || item.created_at)}
                                                        </span>
                                                        {item.runtime && <span>⏱️ {item.runtime}m</span>}
                                                        {item.page_count && <span>📖 {item.page_count}p</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-8 text-center text-gray-500 text-xs bg-[#202020]/40 rounded-xl border border-gray-800/60">
                                No completed media logged in {monthNames[selectedMonth]} {selectedYear !== 'All Time' ? selectedYear : ''}.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Category Breakdown & Top Genres */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Count Bars */}
                <div className="p-6 rounded-2xl bg-[#181818] border border-gray-800 space-y-4 shadow-xl">
                    <h3 className="font-bold text-white text-base">Completed by Category</h3>
                    <div className="space-y-3 pt-2">
                        {(['Movies', 'Series', 'Anime', 'Books', 'Games', 'Manga'] as MediaCategory[]).map(cat => {
                            const count = stats.categoryCounts[cat] || 0;
                            const pct = stats.totalCompleted > 0 ? Math.round((count / stats.totalCompleted) * 100) : 0;

                            return (
                                <div key={cat} className="space-y-1.5">
                                    <div className="flex justify-between items-center text-xs text-gray-300">
                                        <span className="flex items-center gap-2">
                                            <CategoryIcon category={cat} className="w-4 h-4" />
                                            <strong>{cat}</strong>
                                        </span>
                                        <span className="text-gray-400">{count} items ({pct}%)</span>
                                    </div>
                                    <div className="w-full h-2.5 bg-[#252525] rounded-full overflow-hidden">
                                        <div
                                            style={{ width: `${pct}%` }}
                                            className="h-full bg-blue-600 rounded-full transition-all duration-500"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Top Genres Pill Board */}
                <div className="p-6 rounded-2xl bg-[#181818] border border-gray-800 space-y-4 shadow-xl flex flex-col justify-between">
                    <div>
                        <h3 className="font-bold text-white text-base">Top Genres Consumed</h3>
                        <p className="text-xs text-gray-400 mt-1">Most frequent genres across your finished media.</p>

                        <div className="flex flex-wrap gap-2.5 pt-5">
                            {stats.topGenres.length > 0 ? (
                                stats.topGenres.map(([genre, count], idx) => (
                                    <div
                                        key={genre}
                                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#242424] border border-gray-700/80 text-xs"
                                    >
                                        <span className="text-blue-400 font-bold">#{idx + 1}</span>
                                        <span className="text-white font-medium">{genre}</span>
                                        <span className="bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                                            {count}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-gray-500 py-6">No genre information available yet.</p>
                            )}
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 text-xs text-gray-400 flex items-center gap-3">
                        <span className="text-lg">💡</span>
                        <p>
                            Media items with online metadata automatically include accurate runtimes and page counts for precise analytics.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatisticsView;
