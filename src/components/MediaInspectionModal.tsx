import React, { useState } from 'react';
import type { MediaItem, MediaCategory, MediaStatus, MediaPriority } from '../types';
import CategoryIcon from './CategoryIcon';

interface MediaInspectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: any | null;
    existingItems: MediaItem[];
    onAddToLibrary: (newItem: MediaItem) => Promise<void>;
}

const MediaInspectionModal: React.FC<MediaInspectionModalProps> = ({
    isOpen,
    onClose,
    item,
    existingItems,
    onAddToLibrary
}) => {
    const [targetStatus, setTargetStatus] = useState<MediaStatus>('To Consume');
    const [targetPriority, setTargetPriority] = useState<MediaPriority>('Normal');
    const [targetTags, setTargetTags] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen || !item) return null;

    // Check if item already exists in library (by source_id or normalized title)
    const existingMatch = existingItems.find(i => {
        if (item.source && item.source_id && i.source === item.source && i.source_id === item.source_id) {
            return true;
        }
        return i.title.toLowerCase().trim() === (item.title || '').toLowerCase().trim() && i.category === item.category;
    });

    const handleAdd = async () => {
        setIsSaving(true);
        try {
            const newItem: MediaItem = {
                title: item.title,
                category: (item.category || item.media_type || 'Movies') as MediaCategory,
                status: targetStatus,
                priority: targetPriority,
                genre: item.genre || null,
                tags: targetTags.trim() || null,
                director: item.director || null,
                author: item.author || null,
                writer: item.writer || null,
                actors: item.actors || null,
                studio: item.studio || null,
                runtime: item.runtime || null,
                page_count: item.page_count || null,
                review: item.overview || null,
                image_path: item.poster_path || null,
                source: item.source || null,
                source_id: item.source_id ? String(item.source_id) : null
            };

            await onAddToLibrary(newItem);
            onClose();
        } catch (err) {
            console.error('Failed to add item:', err);
            alert('Failed to add item to library.');
        } finally {
            setIsSaving(false);
        }
    };

    const formatRuntime = (mins?: number | null) => {
        if (!mins) return null;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h === 0) return `${m}m`;
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <div className="relative bg-[#181818] border border-gray-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in">
                {/* Backdrop header if present */}
                {item.backdrop_path && (
                    <div className="relative h-44 w-full overflow-hidden shrink-0">
                        <img
                            src={item.backdrop_path}
                            alt=""
                            className="w-full h-full object-cover opacity-35 blur-xs"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-black/40" />
                    </div>
                )}

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
                >
                    ✕
                </button>

                {/* Content Body */}
                <div className={`p-6 overflow-y-auto flex-1 ${item.backdrop_path ? '-mt-16' : ''}`}>
                    <div className="flex flex-col sm:flex-row gap-6 items-start relative z-10">
                        {/* Poster */}
                        <div className="w-36 sm:w-44 shrink-0 rounded-xl overflow-hidden shadow-2xl border border-gray-700 bg-gray-900 aspect-2/3">
                            {item.poster_path ? (
                                <img src={item.poster_path} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 gap-2">
                                    <CategoryIcon category={item.category || 'Movies'} className="w-10 h-10" />
                                    <span className="text-xs">No Poster</span>
                                </div>
                            )}
                        </div>

                        {/* Metadata Details */}
                        <div className="flex-1 space-y-3 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs px-2.5 py-0.5 rounded-full font-medium">
                                    {item.category || item.media_type || 'Media'}
                                </span>
                                {item.year && (
                                    <span className="text-gray-400 text-sm font-semibold">{item.year}</span>
                                )}
                                {item.rating && (
                                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                                        ★ {item.rating}
                                    </span>
                                )}
                                {formatRuntime(item.runtime) && (
                                    <span className="text-gray-400 text-xs bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                                        ⏱️ {formatRuntime(item.runtime)}
                                    </span>
                                )}
                                {item.page_count && (
                                    <span className="text-gray-400 text-xs bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                                        📖 {item.page_count} pages
                                    </span>
                                )}
                                {item.source && (
                                    <span className="text-[10px] text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded uppercase tracking-wider">
                                        via {item.source}
                                    </span>
                                )}
                            </div>

                            <h1 className="text-2xl font-bold text-white leading-tight">
                                {item.title}
                            </h1>

                            {/* Creator / Cast info */}
                            <div className="text-xs text-gray-400 space-y-1">
                                {item.director && (
                                    <p><strong className="text-gray-300">Director:</strong> {item.director}</p>
                                )}
                                {item.author && (
                                    <p><strong className="text-gray-300">Author:</strong> {item.author}</p>
                                )}
                                {item.studio && (
                                    <p><strong className="text-gray-300">Studio:</strong> {item.studio}</p>
                                )}
                                {item.actors && (
                                    <p><strong className="text-gray-300">Cast:</strong> {item.actors}</p>
                                )}
                                {item.genre && (
                                    <p><strong className="text-gray-300">Genres:</strong> {item.genre}</p>
                                )}
                            </div>

                            {/* Overview / Synopsis */}
                            {item.overview && (
                                <div className="pt-2 border-t border-gray-800/80">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Synopsis</h4>
                                    <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-h-40 overflow-y-auto pr-1">
                                        {item.overview}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Library Status & Add Action Footer */}
                    <div className="mt-6 pt-5 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-900/60 -mx-6 -mb-6 p-6">
                        {existingMatch ? (
                            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-3.5 py-2 rounded-lg">
                                <span>✓</span>
                                <span>Already in your library under <strong>{existingMatch.status}</strong></span>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-gray-400 font-medium">Status:</label>
                                    <select
                                        value={targetStatus}
                                        onChange={(e) => setTargetStatus(e.target.value as MediaStatus)}
                                        className="bg-[#242424] border border-gray-700 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                                    >
                                        <option value="To Consume">To Consume</option>
                                        <option value="Consuming">Consuming</option>
                                        <option value="Consumed">Consumed</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-gray-400 font-medium">Priority:</label>
                                    <select
                                        value={targetPriority}
                                        onChange={(e) => setTargetPriority(e.target.value as MediaPriority)}
                                        className="bg-[#242424] border border-gray-700 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                                    >
                                        <option value="Normal">Normal</option>
                                        <option value="High">High</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>

                                <input
                                    type="text"
                                    placeholder="Optional tags (e.g. sci-fi, 2026)"
                                    value={targetTags}
                                    onChange={(e) => setTargetTags(e.target.value)}
                                    className="bg-[#242424] border border-gray-700 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 w-44"
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                disabled={isSaving}
                                onClick={handleAdd}
                                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg hover:shadow-blue-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                            >
                                <span>+</span>
                                <span>{existingMatch ? 'Add Another Copy' : 'Add to Library'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MediaInspectionModal;
