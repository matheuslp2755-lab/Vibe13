
import React, { useState, useEffect, useRef } from 'react';
import { db, collection, query, orderBy, limit, doc, updateDoc, arrayUnion, arrayRemove, getDoc, addDoc, serverTimestamp, deleteDoc, onSnapshot, increment, getDocs } from '../../firebase';
import { auth } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';
import MusicPlayer from '../feed/MusicPlayer';

type VibeType = {
    id: string;
    userId: string;
    videoUrl: string;
    mediaType?: 'image' | 'video';
    caption: string;
    likes: string[];
    reposts?: string[];
    commentsCount: number;
    createdAt: any;
    musicInfo?: {
      nome: string;
      artista: string;
      capa: string;
      preview: string;
      startTime?: number;
    };
    user?: {
        username: string;
        avatar: string;
    };
};

const VolumeOnIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
);

const VolumeOffIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
);

const RepostIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
);

const VibeItem: React.FC<{ 
    vibe: VibeType; 
    isActive: boolean;
    onDelete: () => void;
}> = ({ vibe, isActive, onDelete }) => {
    const { t } = useLanguage();
    const { isGlobalMuted, setGlobalMuted } = useCall();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [showHeartAnim, setShowHeartAnim] = useState(false);
    const lastTap = useRef<number>(0);
    const currentUser = auth.currentUser;
    const isLiked = vibe.likes.includes(currentUser?.uid || '');
    const isReposted = vibe.reposts?.includes(currentUser?.uid || '') || false;

    const [reposterData, setReposterData] = useState<{username: string, avatar: string, isMe: boolean} | null>(null);

    useEffect(() => {
        if (isActive && vibe.mediaType !== 'image') videoRef.current?.play().catch(() => {});
        else { videoRef.current?.pause(); if(videoRef.current) videoRef.current.currentTime = 0; }
    }, [isActive, vibe.mediaType]);

    useEffect(() => {
        if (!currentUser || !vibe.reposts || vibe.reposts.length === 0) {
            setReposterData(null);
            return;
        }

        const checkVisibility = async () => {
            if (vibe.reposts?.includes(currentUser.uid)) {
                setReposterData({ username: t('common.you'), avatar: currentUser.photoURL || '', isMe: true });
                return;
            }

            const followingRef = collection(db, 'users', currentUser.uid, 'following');
            const snap = await getDocs(followingRef);
            const followingIds = snap.docs.map(d => d.id);
            
            const reposterId = vibe.reposts?.find(id => followingIds.includes(id));
            if (reposterId) {
                const userSnap = await getDoc(doc(db, 'users', reposterId));
                if (userSnap.exists()) {
                    const data = userSnap.data();
                    setReposterData({ username: data.username, avatar: data.avatar, isMe: false });
                }
            } else {
                setReposterData(null);
            }
        };

        checkVisibility();
    }, [vibe.reposts, currentUser, t]);

    const handleLikeAction = async () => {
        if (!currentUser) return;
        const ref = doc(db, 'vibes', vibe.id);
        await updateDoc(ref, { 
            likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) 
        });
    };

    const handleRepost = async () => {
        if (!currentUser) return;
        const ref = doc(db, 'vibes', vibe.id);
        await updateDoc(ref, { 
            reposts: isReposted ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) 
        });
    };

    const handleDoubleTap = () => {
        const now = Date.now();
        if (now - lastTap.current < 300) {
            if (!isLiked) handleLikeAction();
            setShowHeartAnim(true);
            setTimeout(() => setShowHeartAnim(false), 800);
        }
        lastTap.current = now;
    };

    return (
        <div className="relative w-full h-full snap-start shrink-0 bg-black flex items-center justify-center overflow-hidden" onClick={handleDoubleTap}>
            {vibe.mediaType === 'image' ? (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                    <img src={vibe.videoUrl} className="w-full h-full object-contain" />
                </div>
            ) : (
                <video ref={videoRef} src={vibe.videoUrl} className="w-full h-full object-contain" loop playsInline muted={isGlobalMuted} />
            )}

            {showHeartAnim && (
                <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                    <svg className="w-32 h-32 text-white fill-current animate-heart-pop" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                </div>
            )}

            <div className="absolute right-4 bottom-24 flex flex-col gap-6 items-center z-30">
                <img src={vibe.user?.avatar} className="w-12 h-12 rounded-full border-2 border-white shadow-lg object-cover" />
                
                <div className="flex flex-col items-center" onClick={(e) => { e.stopPropagation(); handleLikeAction(); }}>
                    <svg className={`w-9 h-9 transition-all ${isLiked ? 'text-red-500 fill-current' : 'text-white'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    <span className="text-white text-xs font-bold">{vibe.likes.length}</span>
                </div>
                
                <div className="flex flex-col items-center" onClick={(e) => { e.stopPropagation(); setIsCommentsOpen(true); }}>
                    <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" /></svg>
                    <span className="text-white text-xs font-bold">{vibe.commentsCount}</span>
                </div>

                <div className="flex flex-col items-center" onClick={(e) => { e.stopPropagation(); handleRepost(); }}>
                    <RepostIcon className={`w-9 h-9 transition-all ${isReposted ? 'text-green-500' : 'text-white'}`} />
                </div>

                <div className="flex flex-col items-center" onClick={(e) => { e.stopPropagation(); setGlobalMuted(!isGlobalMuted); }}>
                    {isGlobalMuted ? <VolumeOffIcon className="w-9 h-9 text-white" /> : <VolumeOnIcon className="w-9 h-9 text-white" />}
                </div>
            </div>

            <div className="absolute left-4 bottom-10 z-30 text-white pointer-events-none pr-20">
                {reposterData && (
                    <div className="flex items-center gap-1.5 mb-3 bg-black/30 backdrop-blur-md rounded-full w-fit px-2.5 py-1 border border-white/20 animate-fade-in shadow-lg">
                        <img src={reposterData.avatar} className="w-4 h-4 rounded-full border border-white/30" />
                        <span className="text-[10px] font-black text-white tracking-tight uppercase">
                            {reposterData.isMe ? t('post.youRepublicated') : t('post.republishedBy', { username: reposterData.username })}
                        </span>
                    </div>
                )}
                <h3 className="font-bold text-base drop-shadow-lg flex items-center gap-2">@{vibe.user?.username}</h3>
                <p className="text-sm drop-shadow-lg break-words line-clamp-2 mt-1">{vibe.caption}</p>
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10" />
            
            <style>{`
                @keyframes heart-pop { 0% { transform: scale(0); opacity: 0; } 15% { transform: scale(1.25); opacity: 0.9; } 30% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
                .animate-heart-pop { animation: heart-pop 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            `}</style>
        </div>
    );
};

const VibeFeed: React.FC = () => {
    const [vibes, setVibes] = useState<VibeType[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeVibeIndex, setActiveVibeIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const { t } = useLanguage();

    useEffect(() => {
        const q = query(collection(db, 'vibes'), orderBy('createdAt', 'desc'), limit(25));
        return onSnapshot(q, async (snap) => {
            const data = await Promise.all(snap.docs.map(async d => {
                const userDoc = await getDoc(doc(db, 'users', d.data().userId));
                return { id: d.id, ...d.data(), user: userDoc.exists() ? userDoc.data() : { username: '...', avatar: '' } } as VibeType;
            }));
            setVibes(data);
            setLoading(false);
        });
    }, []);

    if (loading) return <div className="h-full bg-black flex items-center justify-center text-white">{t('vibes.loading')}</div>;

    return (
        <div className="relative h-screen sm:h-[calc(100vh-4rem)] bg-black overflow-hidden lg:rounded-xl">
            <div ref={containerRef} onScroll={() => containerRef.current && setActiveVibeIndex(Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight))} className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar scroll-smooth">
                {vibes.map((v, i) => (
                    <VibeItem key={v.id} vibe={v} isActive={i === activeVibeIndex} onDelete={() => {}} />
                ))}
            </div>
        </div>
    );
};

export default VibeFeed;
