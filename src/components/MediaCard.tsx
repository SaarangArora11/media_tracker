import React from 'react';
import type { MediaItem } from '../types';

import CategoryIcon from './CategoryIcon';

interface MediaCardProps {
    item: MediaItem;
    onEdit: (item: MediaItem) => void;
    onDelete?: (id: number) => void;
}

const MediaCard: React.FC<MediaCardProps> = ({ item, onEdit, onDelete }) => {
    // Determine priority color
    const priorityColor =
        item.priority === 'High' ? 'border-red-500' :
            item.priority === 'Low' ? 'border-green-500' : 'border-transparent';

    return (
        <div
            className={`bg-[#1e1e1e] rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform group relative border-l-4 ${priorityColor}`}
        >
            <div className="aspect-[2/3] relative bg-[#2a2a2a]" onClick={() => onEdit(item)}>
                {item.image_path ? (
                    <img
                        src={`file://${item.image_path}`}
                        alt={item.title}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-700">
                        <CategoryIcon category={item.category} className="w-16 h-16 opacity-50 mb-2" />
                        <span className="text-xs uppercase tracking-widest opacity-30 font-bold">{item.category}</span>
                    </div>
                )}

                <div className="absolute top-2 right-2 bg-black/70 px-2 py-0.5 rounded text-xs text-white">
                    {item.category}
                </div>
            </div>

            {/* Delete Button (Visible on Hover) */}
            {onDelete && item.id && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id!);
                    }}
                    className="absolute top-2 left-2 bg-red-600/80 hover:bg-red-500 text-white w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="Delete Item"
                >
                    ×
                </button>
            )}

            <div className="p-3">
                <h3 className="font-semibold text-white truncate text-sm" title={item.title}>
                    {item.title}
                </h3>
                <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-500">{item.status}</span>
                    {item.rating && (item.rating > 0) && (
                        <span className="text-yellow-500 text-xs font-bold">★ {item.rating}</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MediaCard;
