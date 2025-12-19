
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

type Pulse = {
    id: string;
    mediaUrl: string;
    legenda: string;
    createdAt: { seconds: number; nanoseconds: number };
    authorId: string;
    isGroup?: boolean;
    members?: string[];
};

type UserWithPulses = {
    author: {
        id: string;
        username: string;
        avatar: string;
    };
    pulses: Pulse[];
};

type LiveSession = {
    liveId: string;
    host: {
        id: string;
        username: string;
        avatar: string;
    };
    status: 'live' | 'ended';
};

interface PulseBarProps {
    usersWithPulses: UserWithPulses[];
    onViewPulses: (authorId: string) => void;
    activeLives?: LiveSession[];
    onJoinLive?: (liveId: string, host: any) => void;
}

const PulseBar: React.FC<PulseBarProps> = ({ usersWithPulses, onViewPulses, activeLives = [], onJoinLive }) => {
    const { t } = useLanguage();

    return (
        <div className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black lg:rounded-xl lg:border lg:mb-4 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-4 overflow-x-auto no-scrollbar scroll-smooth">
                {/* Cartões de Transmissão ao Vivo */}
                {activeLives.map((live) => (
                    <div 
                        key={`live-${live.liveId}`}
                        className="relative flex-shrink-0 w-24 h-40 lg:w-28 lg:h-44 cursor-pointer group rounded-2xl overflow-hidden shadow-lg border-[3px] border-red-500 transition-all duration-300 hover:scale-105 active:scale-95"
                        onClick={() => onJoinLive && onJoinLive(live.liveId, live.host)}
                        role="button"
                    >
                        <div className="absolute inset-0 bg-zinc-900">
                            <img src={live.host.avatar} className="w-full h-full object-cover opacity-60 blur-sm" />
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm z-10 animate-pulse uppercase tracking-tighter">
                                {t('pulseBar.live')}
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/90"></div>
                        </div>
                        <div className="absolute bottom-2 left-0 right-0 px-2 text-center">
                            <div className="w-10 h-10 rounded-full p-0.5 bg-red-600 mx-auto mb-1 shadow-lg ring-2 ring-black">
                                <img src={live.host.avatar} className="w-full h-full rounded-full object-cover bg-black" />
                            </div>
                            <p className="text-white text-[10px] font-bold truncate drop-shadow-md">
                                {live.host.username}
                            </p>
                        </div>
                    </div>
                ))}

                {/* Cartões de Pulse (Stories) */}
                {usersWithPulses.map(({ author, pulses }) => {
                    const latestPulse = pulses[pulses.length - 1];
                    const isVideo = latestPulse.mediaUrl.match(/\.(mp4|webm|mov|ogg)$/i);
                    const isGroup = pulses.some(p => p.isGroup);

                    return (
                        <div 
                            key={author.id} 
                            className={`relative flex-shrink-0 w-24 h-40 lg:w-28 lg:h-44 cursor-pointer group rounded-2xl overflow-hidden shadow-lg border transition-all duration-300 hover:scale-105 active:scale-95 ${isGroup ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-zinc-200 dark:border-zinc-800'}`}
                            onClick={() => onViewPulses(author.id)}
                            role="button"
                        >
                            <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-900">
                                {isVideo ? (
                                    <video src={latestPulse.mediaUrl} className="w-full h-full object-cover" muted playsInline />
                                ) : (
                                    <img src={latestPulse.mediaUrl} className="w-full h-full object-cover" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80"></div>
                                
                                {isGroup && (
                                    <div className="absolute top-2 left-2 bg-sky-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-sm shadow-sm z-10 uppercase tracking-widest">
                                        {t('createPulse.groupPulseBadge')}
                                    </div>
                                )}
                            </div>
                            <div className="absolute bottom-2 left-0 right-0 px-2 text-center">
                                <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 mx-auto mb-1 shadow-lg ring-2 ring-black">
                                    <img src={author.avatar} className="w-full h-full rounded-full object-cover bg-black" />
                                </div>
                                <p className="text-white text-[10px] font-bold truncate drop-shadow-md">
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
