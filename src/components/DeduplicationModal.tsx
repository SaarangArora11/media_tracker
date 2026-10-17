import React, { useState } from 'react';
import type { DuplicatePair, MediaItem } from '../types';
import CategoryIcon from './CategoryIcon';

interface DeduplicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    duplicates: DuplicatePair[];
    onRefresh: () => void;
}

const DeduplicationModal: React.FC<DeduplicationModalProps> = ({
    isOpen,
    onClose,
    duplicates,
    onRefresh
}) => {
    const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleKeepOne = async (pairKey: string, deleteItem: MediaItem) => {
        setActionLoadingKey(pairKey);
        try {
            if (deleteItem.id) {
                await window.electronAPI.invoke('delete-item', deleteItem.id);
            }
            onRefresh();
        } catch (err) {
            console.error('Failed to resolve duplicate:', err);
            alert('Failed to delete duplicate entry.');
        } finally {
            setActionLoadingKey(null);
        }
    };

    const handleMerge = async (pairKey: string, primaryItem: MediaItem, secondaryItem: MediaItem) => {
        setActionLoadingKey(pairKey);
        try {
            if (primaryItem.id && secondaryItem.id) {
                await window.electronAPI.invoke('merge-items', {
                    primaryId: primaryItem.id,
                    secondaryId: secondaryItem.id
                });
            }
            onRefresh();
        } catch (err) {
            console.error('Failed to merge items:', err);
            alert('Failed to merge items.');
        } finally {
            setActionLoadingKey(null);
        }
    };

    const handleKeepBoth = async (pairKey: string) => {
        setActionLoadingKey(pairKey);
        try {
            await window.electronAPI.invoke('dismiss-duplicate', pairKey);
            onRefresh();
        } catch (err) {
            console.error('Failed to dismiss duplicate pair:', err);
        } finally {
            setActionLoadingKey(null);
        }
    };

    const renderItemCard = (item: MediaItem, isPrimary: boolean) => {
        return (
            <div className={`p-4 rounded-xl border flex gap-4 bg-[#202020] ${
                isPrimary ? 'border-gray-700' : 'border-gray-700/80'
            }`}>
                <div className="w-20 shrink-0 aspect-2/3 bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
                    {item.image_path ? (
                        <img src={item.image_path} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 gap-1">
                            <CategoryIcon category={item.category} className="w-6 h-6" />
                            <span className="text-[9px]">No Cover</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-[10px] font-semibold">
                            {item.category}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            item.status === 'Consuming'
                                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                                : item.status === 'Consumed'
                                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                                : 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                        }`}>
                            {item.status}
                        </span>
                        {item.priority && (
                            <span className="text-[10px] text-gray-400">
                                Priority: <strong>{item.priority}</strong>
                            </span>
                        )}
                    </div>

                    <h4 className="font-bold text-sm text-white truncate" title={item.title}>
                        {item.title}
                    </h4>

                    <div className="text-gray-400 space-y-0.5">
                        {(item.director || item.author || item.studio) && (
                            <p className="truncate">
                                <span className="text-gray-500">Creator:</span> {item.director || item.author || item.studio}
                            </p>
                        )}
                        {item.rating && (
                            <p><span className="text-gray-500">Rating:</span> ★ {item.rating}/10</p>
                        )}
                        {item.created_at && (
                            <p><span className="text-gray-500">Added:</span> {new Date(item.created_at).toLocaleDateString()}</p>
                        )}
                    </div>

                    <div className="pt-1 flex items-center gap-2">
                        {item.source ? (
                            <span className="text-[10px] bg-blue-950/70 border border-blue-800/60 text-blue-300 px-2 py-0.5 rounded">
                                ID: {item.source.toUpperCase()} #{item.source_id || 'N/A'}
                            </span>
                        ) : (
                            <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                                Manual Entry
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <div className="bg-[#181818] border border-gray-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#1c1c1c]">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <span className="text-xl">⚠️</span>
                            <h2 className="text-xl font-bold text-white">Review Potential Duplicates</h2>
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                                {duplicates.length} {duplicates.length === 1 ? 'Pair' : 'Pairs'} Detected
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            Items with identical titles, creators, or matching metadata IDs across different tabs.
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/80 text-gray-400 hover:text-white flex items-center justify-center text-sm transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Duplicates List */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {duplicates.length === 0 ? (
                        <div className="text-center py-16 text-gray-400 space-y-3">
                            <div className="text-4xl">🎉</div>
                            <h3 className="text-lg font-bold text-white">No duplicates found!</h3>
                            <p className="text-xs text-gray-500 max-w-sm mx-auto">
                                Your library is clean and streamlined. Every media entry is unique.
                            </p>
                        </div>
                    ) : (
                        duplicates.map((pair) => (
                            <div
                                key={pair.pairKey}
                                className="p-5 rounded-2xl bg-[#1d1d1d] border border-gray-800 space-y-4 shadow-lg"
                            >
                                <div className="flex justify-between items-center text-xs border-b border-gray-800/80 pb-3">
                                    <span className="text-amber-400 font-medium flex items-center gap-1.5">
                                        <span>🔍 Flag Reason:</span>
                                        <strong>{pair.reason}</strong>
                                    </span>
                                    <span className="text-gray-500 text-[11px]">
                                        Pair #{pair.pairKey}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {renderItemCard(pair.itemA, true)}
                                    {renderItemCard(pair.itemB, false)}
                                </div>

                                {/* Resolution Actions */}
                                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-gray-800/60">
                                    <button
                                        type="button"
                                        disabled={actionLoadingKey === pair.pairKey}
                                        onClick={() => handleKeepBoth(pair.pairKey)}
                                        className="px-3.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                    >
                                        Keep Both (Dismiss)
                                    </button>

                                    <button
                                        type="button"
                                        disabled={actionLoadingKey === pair.pairKey}
                                        onClick={() => handleKeepOne(pair.pairKey, pair.itemB)}
                                        className="px-3.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium transition-colors"
                                    >
                                        Keep Left Only
                                    </button>

                                    <button
                                        type="button"
                                        disabled={actionLoadingKey === pair.pairKey}
                                        onClick={() => handleKeepOne(pair.pairKey, pair.itemA)}
                                        className="px-3.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium transition-colors"
                                    >
                                        Keep Right Only
                                    </button>

                                    <button
                                        type="button"
                                        disabled={actionLoadingKey === pair.pairKey}
                                        onClick={() => handleMerge(pair.pairKey, pair.itemA, pair.itemB)}
                                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow hover:shadow-blue-500/20 transition-all flex items-center gap-1"
                                    >
                                        <span>⚡ Merge into Left</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 bg-[#161616] flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeduplicationModal;
