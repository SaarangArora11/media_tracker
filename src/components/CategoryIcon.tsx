import React from 'react';

interface CategoryIconProps {
    category: string;
    className?: string;
}

const CategoryIcon: React.FC<CategoryIconProps> = ({ category, className = "w-12 h-12" }) => {
    switch (category) {
        case 'Movies':
            // Cinema Reel
            return (
                <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2C12 2 16 6 16 12C16 18 12 22 12 22" />
                    <path d="M12 2C12 2 8 6 8 12C8 18 12 22 12 22" />
                    <path d="M2.5 12H21.5" />
                </svg>
            );
        case 'Series':
            // TV
            return (
                <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
                    <polyline points="17 2 12 7 7 2" />
                </svg>
            );
        case 'Anime':
            // "Play" button with speed lines (Energy)
            return (
                <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                    <path d="M21 5L21 19" />
                </svg>
            );
        case 'Books':
            // Open Book
            return (
                <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
            );
        case 'Manga':
            // Pen Nib / Ink
            return (
                <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 19l7-7 3 3-7 7-3-3z" />
                    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                    <path d="M2 2l7.586 7.586" />
                    <circle cx="11" cy="11" r="2" />
                </svg>
            );
        case 'Games':
            // Gamepad
            return (
                <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <path d="M6 12h4m-2-2v4" />
                    <line x1="15" y1="11" x2="15" y2="11" />
                    <line x1="18" y1="13" x2="18" y2="13" />
                </svg>
            );
        default:
            return null;
    }
};

export default CategoryIcon;
