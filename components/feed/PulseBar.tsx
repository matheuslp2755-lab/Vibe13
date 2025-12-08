
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

type Pulse = {
    id: string;
    mediaUrl: string;
    legenda: string;
    createdAt: { seconds: number; nanoseconds: number };
    authorId: string;
};

type UserWithPulses = {
    author: {
        id: string;
        username: string;
        avatar: string;
    };
    pulses: Pulse[];
};

interface PulseBarProps {
    usersWithPulses: UserWithPulses[];
    onViewPulses: (authorId: string) => void;
}

const PulseBar: React.FC<PulseBarProps> = ({ usersWithPulses, onViewPulses }) => {
    const { t } = useLanguage();

    return (
        <div className="w-full border-b border-zinc-300 dark:border-zinc-800 pb-2">
            {/* Scrollable container with padding */}
            <div className="flex items-center gap-3 px-4 py-4 overflow-x-auto no-scrollbar">
                {usersWithPulses.map(({ author, pulses }) => {
                    // Get the latest pulse to show as preview background
                    const latestPulse = pulses[pulses.length - 1];
                    const isVideo = latestPulse.mediaUrl.includes('.mp4') || latestPulse.mediaUrl.includes('.webm');

                    return (
                        <div 
                            key={author.id} 
                            className="relative flex-shrink-0 w-28 h-44 cursor-pointer group rounded-xl overflow-hidden shadow-md border border-zinc-200 dark:border-zinc-800 transition-transform duration-200 hover:scale-[1.02]"
                            onClick={() => onViewPulses(author.id)}
                            role="button"
                            aria-label={t('pulseBar.viewPulse', { username: author.username })}
                        >
                            {/* Background Media */}
                            <div className="absolute inset-0 bg-zinc-200 dark:bg-zinc-900">
                                {isVideo ? (
                                    <video 
                                        src={latestPulse.mediaUrl} 
                                        className="w-full h-full object-cover" 
                                        muted 
                                        playsInline // Important for iOS to not fullscreen immediately
                                    />
                                ) : (
                                    <img 
                                        src={latestPulse.mediaUrl} 
                                        alt={author.username} 
                                        className="w-full h-full object-cover" 
                                    />
                                )}
                                {/* Dark Gradient Overlay for text readability */}
                                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/80"></div>
                            </div>

                            {/* User Info Overlay */}
                            <div className="absolute bottom-0 left-0 right-0 p-2 flex flex-col items-center">
                                <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 mb-1 ring-2 ring-black/50">
                                    <div className="bg-white dark:bg-black p-0.5 rounded-full h-full w-full">
                                        <img 
                                            src={author.avatar} 
                                            alt={author.username} 
                                            className="w-full h-full rounded-full object-cover" 
                                        />
                                    </div>
                                </div>
                                <p className="text-white text-xs font-semibold truncate w-full text-center drop-shadow-md">
                                    {author.username}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PulseBar;
