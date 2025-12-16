
import React, { useState, useEffect, useRef } from 'react';
import { db, collection, query, orderBy, getDocs, limit, doc, updateDoc, arrayUnion, arrayRemove, getDoc, where } from '../../firebase';
import { auth } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';

type VibeType = {
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

const ShareIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M15.75 4.5a3 3 0 11.825 2.066l-8.421 4.679a3.002 3.002 0 010 1.51l8.421 4.679a3 3 0 11-.729 1.31l-8.421-4.678a3 3 0 110-4.132l8.421-4.679a3 3 0 01-.096-.755z" clipRule="evenodd" />
    </svg>
);

const VibeItem: React.FC<{ vibe: VibeType; isActive: boolean }> = ({ vibe, isActive }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLiked, setIsLiked] = useState(vibe.likes.includes(auth.currentUser?.uid || ''));
    const [likesCount, setLikesCount] = useState(vibe.likes.length);

    useEffect(() => {
        if (isActive) {
            videoRef.current?.play().catch(e => console.log("Autoplay failed", e));
            setIsPlaying(true);
        } else {
            videoRef.current?.pause();
            setIsPlaying(false);
        }
    }, [isActive]);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!auth.currentUser) return;

        const userId = auth.currentUser.uid;
        const vibeRef = doc(db, 'vibes', vibe.id);
        
        setIsLiked(!isLiked);
        setLikesCount(prev => isLiked ? prev - 1 : prev + 1);

        try {
            if (isLiked) {
                await updateDoc(vibeRef, { likes: arrayRemove(userId) });
            } else {
                await updateDoc(vibeRef, { likes: arrayUnion(userId) });
            }
        } catch (error) {
            console.error("Error liking vibe:", error);
        }
    };

    return (
        <div className="relative w-full h-full snap-start shrink-0 bg-black flex items-center justify-center overflow-hidden">
            {/* Video */}
            <video
                ref={videoRef}
                src={vibe.videoUrl}
                className="w-full h-full object-cover"
                loop
                playsInline
                onClick={togglePlay}
            />

            {/* Play/Pause Overlay Icon (Optional feedback) */}
            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <svg className="w-20 h-20 text-white/50" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </div>
            )}

            {/* Right Side Actions */}
            <div className="absolute right-4 bottom-24 flex flex-col gap-6 items-center z-10">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden mb-4">
                        <img src={vibe.user?.avatar || 'https://i.pravatar.cc/150'} alt={vibe.user?.username} className="w-full h-full object-cover" />
                    </div>
                </div>
                <div className="flex flex-col items-center cursor-pointer" onClick={handleLike}>
                    <HeartIcon filled={isLiked} />
                    <span className="text-white text-xs font-semibold drop-shadow-md">{likesCount}</span>
                </div>
                <div className="flex flex-col items-center cursor-pointer">
                    <CommentIcon />
                    <span className="text-white text-xs font-semibold drop-shadow-md">{vibe.commentsCount}</span>
                </div>
                <div className="flex flex-col items-center cursor-pointer">
                    <ShareIcon />
                    <span className="text-white text-xs font-semibold drop-shadow-md">Share</span>
                </div>
            </div>

            {/* Bottom Info */}
            <div className="absolute left-4 bottom-4 right-16 z-10 text-white">
                <h3 className="font-bold text-lg drop-shadow-md mb-1">@{vibe.user?.username}</h3>
                <p className="text-sm drop-shadow-md break-words">{vibe.caption}</p>
            </div>
            
            {/* Gradient for readability */}
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
        </div>
    );
};

const VibeFeed: React.FC = () => {
    const [vibes, setVibes] = useState<VibeType[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeVibeIndex, setActiveVibeIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchVibes = async () => {
            try {
                const q = query(collection(db, 'vibes'), orderBy('createdAt', 'desc'), limit(10));
                const snapshot = await getDocs(q);
                
                const vibesData = await Promise.all(snapshot.docs.map(async (docSnap) => {
                    const data = docSnap.data();
                    // Fetch user data
                    let userData = { username: 'Unknown', avatar: '' };
                    try {
                        const userDoc = await getDoc(doc(db, 'users', data.userId));
                        if (userDoc.exists()) {
                            const u = userDoc.data();
                            userData = { username: u.username, avatar: u.avatar };
                        }
                    } catch (e) {
                        console.error("Error fetching user for vibe", e);
                    }

                    return {
                        id: docSnap.id,
                        ...data,
                        user: userData
                    } as VibeType;
                }));

                setVibes(vibesData);
            } catch (error) {
                console.error("Error fetching vibes:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchVibes();
    }, []);

    // Scroll Observer for Snapping
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const index = Math.round(container.scrollTop / container.clientHeight);
            if (index !== activeVibeIndex) {
                setActiveVibeIndex(index);
            }
        };

        // Debounce scroll event slightly for performance if needed, 
        // but for immediate video switching, direct handler is often okay.
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [activeVibeIndex]);

    if (loading) {
        return <div className="h-screen w-full bg-black flex items-center justify-center text-white">Carregando Vibes...</div>;
    }

    if (vibes.length === 0) {
        return <div className="h-screen w-full bg-black flex items-center justify-center text-white">Nenhuma Vibe encontrada.</div>;
    }

    return (
        <div 
            ref={containerRef}
            className="h-[calc(100vh-4rem)] w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar bg-black"
        >
            {vibes.map((vibe, index) => (
                <div key={vibe.id} className="h-full w-full snap-start">
                    <VibeItem vibe={vibe} isActive={index === activeVibeIndex} />
                </div>
            ))}
        </div>
    );
};

export default VibeFeed;
