
import React, { useState, useEffect, useRef } from 'react';
import { db, collection, query, orderBy, limit, doc, updateDoc, arrayUnion, arrayRemove, getDoc, addDoc, serverTimestamp, deleteDoc, storage, storageRef, deleteObject, onSnapshot, increment } from '../../firebase';
import { auth } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';

type PulseType = {
    id: string;
    userId: string;
    videoUrl: string;
    caption: string;
    likes: string[];
    commentsCount: number;
    createdAt: any;
    user?: {
        username: string;
        avatar: string;
    };
};

const PulseItem: React.FC<{ 
    pulse: PulseType; 
    isActive: boolean;
    onOpenComments: () => void;
    onDelete: () => void;
}> = ({ pulse, isActive, onOpenComments, onDelete }) => {
    const { isGlobalMuted, setGlobalMuted } = useCall();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLiked, setIsLiked] = useState(pulse.likes.includes(auth.currentUser?.uid || ''));
    const [likesCount, setLikesCount] = useState(pulse.likes.length);
    const currentUser = auth.currentUser;

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isActive) {
            video.currentTime = 0;
            video.play().catch(e => console.warn("Auto-play blocked", e));
        } else {
            video.pause();
            video.currentTime = 0;
        }
    }, [isActive]);

    useEffect(() => {
        setIsLiked(pulse.likes.includes(auth.currentUser?.uid || ''));
        setLikesCount(pulse.likes.length);
    }, [pulse.likes]);

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) return;
        const userId = currentUser.uid;
        const pulseRef = doc(db, 'vibes', pulse.id);
        try {
            if (isLiked) {
                await updateDoc(pulseRef, { likes: arrayRemove(userId) });
            } else {
                await updateDoc(pulseRef, { likes: arrayUnion(userId) });
            }
        } catch (error) { console.error(error); }
    };

    return (
        <div className="relative w-full h-full snap-start shrink-0 bg-black flex items-center justify-center overflow-hidden">
            <video
                ref={videoRef}
                src={pulse.videoUrl}
                className="w-full h-full object-contain"
                loop
                playsInline
                muted={isGlobalMuted}
                onClick={() => setGlobalMuted(!isGlobalMuted)}
            />

            {/* Actions Sidebar */}
            <div className="absolute right-4 bottom-20 flex flex-col gap-6 items-center z-30">
                <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-yellow-400 to-pink-500">
                    <img src={pulse.user?.avatar} className="w-11 h-11 rounded-full border-2 border-black object-cover" />
                </div>
                
                <div className="flex flex-col items-center cursor-pointer group" onClick={handleLike}>
                    <div className="transition-transform active:scale-150">
                        <HeartIcon filled={isLiked} />
                    </div>
                    <span className="text-white text-xs font-bold drop-shadow-lg mt-1">{likesCount}</span>
                </div>
                
                <div className="flex flex-col items-center cursor-pointer" onClick={onOpenComments}>
                    <CommentIcon />
                    <span className="text-white text-xs font-bold drop-shadow-lg mt-1">{pulse.commentsCount}</span>
                </div>

                {currentUser?.uid === pulse.userId && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-2 bg-black/40 rounded-full text-white/80 hover:text-red-500 transition-colors backdrop-blur-sm"
                    >
                        <TrashIcon className="w-6 h-6" />
                    </button>
                )}
            </div>

            {/* Author Info Overlay */}
            <div className="absolute left-4 bottom-8 z-30 text-white pointer-events-none pr-20 max-w-full">
                <h3 className="font-bold text-base drop-shadow-md flex items-center gap-2">
                    @{pulse.user?.username}
                    <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-full backdrop-blur-md">Seguir</span>
                </h3>
                <p className="text-sm drop-shadow-md break-words line-clamp-3 mt-1 leading-snug">{pulse.caption}</p>
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10"></div>
        </div>
    );
};

const HeartIcon: React.FC<{ filled: boolean }> = ({ filled }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${filled ? 'text-red-500 fill-current' : 'text-white'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill={filled ? 'currentColor' : 'none'}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
);

const CommentIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 00-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 01-.189-.866c0-.298.059-.605.189-.866zm2.023 6.828a.75.75 0 10-1.06-1.06 3.752 3.752 0 01-5.304 0 .75.75 0 00-1.06 1.06 5.25 5.25 0 007.424 0z" clipRule="evenodd" />
    </svg>
);

const TrashIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const VibeFeed: React.FC = () => {
    const { t } = useLanguage();
    const [pulses, setPulses] = useState<PulseType[]>([]);
    const [loading, setLoading] = useState(true);
    const [activePulseIndex, setActivePulseIndex] = useState(0);
    const [deleteConfirm, setDeleteConfirm] = useState<PulseType | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const q = query(collection(db, 'vibes'), orderBy('createdAt', 'desc'), limit(20));
        return onSnapshot(q, async (snapshot) => {
            const pulsesData = await Promise.all(snapshot.docs.map(async (docSnap) => {
                const data = docSnap.data();
                let userData = { username: '...', avatar: '' };
                try {
                    const userDoc = await getDoc(doc(db, 'users', data.userId));
                    if (userDoc.exists()) userData = { username: userDoc.data().username, avatar: userDoc.data().avatar };
                } catch (e) { console.error(e); }
                return { id: docSnap.id, ...data, user: userData } as PulseType;
            }));
            setPulses(pulsesData);
            setLoading(false);
        });
    }, []);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const index = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
        if (index !== activePulseIndex) {
            setActivePulseIndex(index);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        try {
            await deleteDoc(doc(db, 'vibes', deleteConfirm.id));
            setDeleteConfirm(null);
        } catch (error) { console.error("Error deleting vibe:", error); }
    };

    if (loading) return (
        <div className="h-[calc(100vh-8rem)] w-full bg-black flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-white"></div>
        </div>
    );

    if (pulses.length === 0) return (
        <div className="h-[calc(100vh-8rem)] w-full bg-black flex items-center justify-center text-zinc-500 text-center p-8">
            Nenhum Pulse disponível.<br/>Seja o primeiro a postar!
        </div>
    );

    return (
        <div className="relative h-[calc(100vh-8rem)] bg-black overflow-hidden">
            <div 
                ref={containerRef}
                onScroll={handleScroll}
                className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar scroll-smooth"
            >
                {pulses.map((pulse, index) => (
                    <div key={pulse.id} className="h-full w-full snap-start">
                        <PulseItem 
                            pulse={pulse} 
                            isActive={index === activePulseIndex && !deleteConfirm} 
                            onOpenComments={() => {}} 
                            onDelete={() => setDeleteConfirm(pulse)}
                        />
                    </div>
                ))}
            </div>

            {deleteConfirm && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-xs w-full text-center shadow-2xl">
                        <h3 className="text-white font-bold text-lg mb-2">Excluir este Pulse?</h3>
                        <p className="text-zinc-400 text-sm mb-6">Esta ação removerá permanentemente o vídeo.</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={handleDelete} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors">Excluir</button>
                            <button onClick={() => setDeleteConfirm(null)} className="w-full py-3 bg-zinc-800 text-white font-bold rounded-xl hover:bg-zinc-700 transition-colors">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VibeFeed;
