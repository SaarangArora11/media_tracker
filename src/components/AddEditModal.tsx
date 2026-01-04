import React, { useState, useEffect, useRef } from 'react';
import type { MediaItem } from '../types';

interface AddEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: MediaItem) => void;
    item?: MediaItem;
    existingGenres: string[];
    existingTags: string[];
    existingLocations?: string[];
}

const AddEditModal: React.FC<AddEditModalProps> = ({
    isOpen,
    onClose,
    onSave,
    item,
    existingGenres,
    existingTags,
    existingLocations = []
}) => {
    const defaultItem: MediaItem = {
        title: '',
        category: 'Movies',
        status: 'To Consume',
        priority: 'Normal', // Default
        location: '',
        genre: '',
        tags: '',
        image_path: ''
    };

    const [formData, setFormData] = useState<MediaItem>(defaultItem);
    const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);
    const tagInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (item) {
            setFormData(item);
        } else {
            setFormData(defaultItem);
        }
    }, [item, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'rating' ? Number(value) : value
        }));
    };

    // Custom Tag Input Logic
    const handleTagInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFormData(prev => ({ ...prev, tags: val }));

        // Logic to show suggestions based on the *last* tag being typed
        const parts = val.split(',');
        const currentPart = parts[parts.length - 1].trim().toLowerCase();

        if (currentPart.length > 0) {
            const matches = existingTags.filter(t =>
                t.toLowerCase().includes(currentPart) &&
                !parts.slice(0, -1).map((p: string) => p.trim().toLowerCase()).includes(t.toLowerCase()) // Exclude already added
            );
            setTagSuggestions(matches);
            setShowTagSuggestions(matches.length > 0);
        } else {
            setShowTagSuggestions(false);
        }
    };

    const addTag = (tag: string) => {
        const parts = formData.tags?.split(',') || [];
        parts.pop(); // Remove the partial chunk
        parts.push(tag); // Add completed tag

        const newTags = parts.map(p => p.trim()).join(', ') + ', '; // Add trailing comma for next input
        setFormData(prev => ({ ...prev, tags: newTags }));
        setShowTagSuggestions(false);
        tagInputRef.current?.focus();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Normalize Genre/Tags to Title Case
        const normalize = (str?: string) => str?.split(',').map(s => s.trim())
            .filter(s => s)
            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
            .join(', ') || '';

        onSave({
            ...formData,
            genre: normalize(formData.genre || ''),
            tags: normalize(formData.tags || '')
        });
        onClose();
    };

    if (!isOpen) return null;

    const renderDynamicFields = () => {
        const cat = formData.category;
        const isVideo = cat === 'Movies' || cat === 'Series' || cat === 'Anime';
        const isBook = cat === 'Books' || cat === 'Manga';
        const isGame = cat === 'Games';

        return (
            <>
                {isVideo && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400">Director</label>
                            <input
                                name="director"
                                value={formData.director || ''}
                                onChange={handleChange}
                                className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400">Writer</label>
                            <input
                                name="writer"
                                value={formData.writer || ''}
                                onChange={handleChange}
                                className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div className="col-span-2 space-y-2">
                            <label className="text-sm text-gray-400">Actors</label>
                            <input
                                name="actors"
                                value={formData.actors || ''}
                                onChange={handleChange}
                                placeholder="Comma separated"
                                className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>
                )}

                {isBook && (
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">Author/Mangaka</label>
                        <input
                            name="author"
                            value={formData.author || ''}
                            onChange={handleChange}
                            className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                        />
                    </div>
                )}

                {(isGame || cat === 'Anime') && (
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">Studio/Developer</label>
                        <input
                            name="studio"
                            value={formData.studio || ''}
                            onChange={handleChange}
                            className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                        />
                    </div>
                )}

                {isGame && (
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">Platform</label>
                        <input
                            name="platform"
                            value={formData.platform || ''}
                            onChange={handleChange}
                            placeholder="PC, PS5, Switch..."
                            className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                        />
                    </div>
                )}
            </>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1e1e1e] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl">
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <h2 className="text-2xl font-bold text-white mb-6">
                        {item ? 'Edit Entry' : 'Add New Entry'}
                    </h2>

                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-2">
                            <label className="text-sm text-gray-400">Title</label>
                            <input
                                name="title"
                                required
                                value={formData.title}
                                onChange={handleChange}
                                className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm text-gray-400">Category</label>
                            <select
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                            >
                                {['Movies', 'Series', 'Anime', 'Books', 'Games', 'Manga'].map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm text-gray-400">Status</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                            >
                                {['Watching', 'To Consume', 'Consumed'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm text-gray-400">Priority</label>
                            <select
                                name="priority"
                                value={formData.priority || 'Normal'}
                                onChange={handleChange}
                                className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                            >
                                <option value="High">High</option>
                                <option value="Normal">Normal</option>
                                <option value="Low">Low</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm text-gray-400">Location</label>
                            <input
                                name="location"
                                value={formData.location || ''}
                                onChange={handleChange}
                                list="location-list"
                                placeholder="Home, Theatre, etc."
                                className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                            />
                            <datalist id="location-list">
                                {existingLocations.map(l => (
                                    <option key={l} value={l} />
                                ))}
                            </datalist>
                        </div>
                    </div>

                    {/* Dynamic Fields */}
                    <div className="border-t border-gray-700 pt-4">
                        <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Details</h3>
                        <div className="space-y-4">
                            {renderDynamicFields()}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Genre</label>
                                    <input
                                        name="genre"
                                        value={formData.genre || ''}
                                        onChange={handleChange}
                                        list="genre-list"
                                        className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                                    />
                                    <datalist id="genre-list">
                                        {existingGenres.map(g => <option key={g} value={g} />)}
                                    </datalist>
                                </div>

                                <div className="space-y-2 relative">
                                    <label className="text-sm text-gray-400">Tags</label>
                                    <input
                                        ref={tagInputRef}
                                        name="tags"
                                        value={formData.tags || ''}
                                        onChange={handleTagInput}
                                        autoComplete="off"
                                        className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                                    />
                                    {showTagSuggestions && (
                                        <ul className="absolute z-10 w-full bg-[#2a2a2a] border border-gray-600 rounded mt-1 max-h-40 overflow-auto shadow-lg">
                                            {tagSuggestions.map(tag => (
                                                <li
                                                    key={tag}
                                                    className="px-3 py-2 text-sm text-gray-200 hover:bg-blue-600 cursor-pointer"
                                                    onClick={() => addTag(tag)}
                                                >
                                                    {tag}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Consumed Fields */}
                    {formData.status === 'Consumed' && (
                        <div className="border-t border-gray-700 pt-4 bg-gray-800/30 -mx-6 px-6 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Rating (0-10)</label>
                                    <input
                                        type="number"
                                        name="rating"
                                        min="0"
                                        max="10"
                                        value={formData.rating || ''}
                                        onChange={handleChange}
                                        className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Date Finished</label>
                                    <input
                                        type="date"
                                        name="date_finished"
                                        value={formData.date_finished || ''}
                                        onChange={handleChange}
                                        className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <label className="text-sm text-gray-400">Review</label>
                                    <textarea
                                        name="review"
                                        value={formData.review || ''}
                                        onChange={handleChange}
                                        rows={3}
                                        className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Image */}
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">Cover Image</label>
                        <div className="flex gap-4 items-center">
                            {formData.image_path && (
                                <img src={`file://${formData.image_path}`} className="w-16 h-24 object-cover rounded" />
                            )}
                            <button
                                type="button"
                                onClick={async () => {
                                    const path = await window.electronAPI.invoke('select-image');
                                    if (path) setFormData(prev => ({ ...prev, image_path: path }));
                                }}
                                className="px-4 py-2 bg-gray-700 rounded text-sm hover:bg-gray-600"
                            >
                                Browse...
                            </button>
                        </div>
                    </div>


                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
                        >
                            Save Entry
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddEditModal;
