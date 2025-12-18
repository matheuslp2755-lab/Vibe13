
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

// VÍDEOS CURADOS PARA O FEED PARECER REAL E VARIADO
const MOCK_VIBES: VibeType[] = [
    {
        id: 'mock-1',
        userId: 'vibe-official',
        videoUrl: 'https://cdn.pixabay.com/video/2023/10/24/186354-877709320_tiny.mp4',
        mediaType: 'video',
        caption: 'Explorando as luzes da cidade à noite. ✨ #neon #vibe #cyberpunk',
        likes: ['user1', 'user2', 'user3', 'user99'],
        commentsCount: 128,
        createdAt: new Date(),
        user: { username: 'urban_skye', avatar: 'https://i.pravatar.cc/150?u=urban' }
    },
    {
        id: 'mock-2',
        userId: 'vibe-official',
        videoUrl: 'https://cdn.pixabay.com/video/2021/04/12/70881-537449557_tiny.mp4',
        mediaType: 'video',
        caption: 'A calmaria que a gente precisava hoje... 🌊 #oceano #relax #nature',
        likes: ['user5', 'user12', 'user45'],
        commentsCount: 42,
        createdAt: new Date(),
        user: { username: 'blue_waves', avatar: 'https://i.pravatar.cc/150?u=ocean' }
    },
    {
        id: 'mock-5',
        userId: 'vibe-official',
        videoUrl: 'https://cdn.pixabay.com/video/2023/11/04/187741-881260783_tiny.mp4',
        mediaType: 'video',
        caption: 'O café da manhã perfeito não exis... 🥞☕ #foodie #aesthetic #breakfast',
        likes: ['user20', 'user21', 'user22'],
        commentsCount: 15,
        createdAt: new Date(),
        user: { username: 'chef_vibe', avatar: 'https://i.pravatar.cc/150?u=food' }
    },
    {
        id: 'mock-6',
        userId: 'vibe-official',
        videoUrl: 'https://cdn.pixabay.com/video/2024/02/25/201948-916843468_tiny.mp4',
        mediaType: 'video',
        caption: 'POV: Você está em Tóquio. 🇯🇵 #travel #japan #streetstyle',
        likes: ['u1', 'u2', 'u3', 'u4', 'u5'],
        commentsCount: 89,
        createdAt: new Date(),
        user: { username: 'nomad_spirit', avatar: 'https://i.pravatar.cc/150?u=tokyo' }
    },
    {
        id: 'mock-3',
        userId: 'vibe-official',
        videoUrl: 'https://cdn.pixabay.com/video/2020/09/24/50860-462947113_tiny.mp4',
        mediaType: 'video',
        caption: 'Arte em movimento. Sente o fluxo. 🎨 #abstract #digitalart #loop',
        likes: ['user9', 'user10', 'user55', 'user66'],
        commentsCount: 45,
        createdAt: new Date(),
        user: { username: 'art_fluid', avatar: 'https://i.pravatar.cc/150?u=art' }
    },
    {
        id: 'mock-7',
        userId: 'vibe-official',
        videoUrl: 'https://cdn.pixabay.com/video/2021/10/26/93437-640701046_tiny.mp4',
        mediaType: 'video',
        caption: 'Treino de hoje pago! 💪🔥 #fitness #motivation #gymvibe',
        likes: ['fit1', 'fit2'],
        commentsCount: 3,
        createdAt: new Date(),
        user: { username: 'power_train', avatar: 'https://i.pravatar.cc/150?u=fitness' }
    },
    {
        id: 'mock-4',
        userId: 'vibe-official',
        videoUrl: 'https://cdn.pixabay.com/video/2021/09/10/88137-603175852_tiny.mp4',
        mediaType: 'video',
        caption: 'Foco total no trabalho hoje. ☕💻 #lofi #studygram #workspace',
        likes: ['user22', 'user88'],
        commentsCount: 8,
        createdAt: new Date(),
        user: { username: 'focus_mode', avatar: 'https://i.pravatar.cc/150?u=daily' }
    },
    {
        id: 'mock-8',
        userId: 'vibe-official',
        videoUrl: 'https://cdn.pixabay.com/video/2023/04/16/159155-818227367_tiny.mp4',
        mediaType: 'video',
        caption: 'Aquele por do sol que renova as energias. 🌅 #sunset #goldenhour',
        likes: ['sky1', 'sky2', 'sky3'],
        commentsCount: 56,
        createdAt: new Date(),
        user: { username: 'horizon_chaser', avatar: 'https://i.pravatar.cc/150?u=sky' }
    }
];

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
    const [isLoaded, setIsLoaded] = useState(false);
    const lastTap = useRef<number>(0);
    const currentUser = auth.currentUser;
    const isLiked = vibe.likes.includes(currentUser?.uid || '');
    const isReposted = vibe.reposts?.includes(currentUser?.uid || '') || false;

    const [reposterData, setReposterData] = useState<{username: string, avatar: string, isMe: boolean} | null>(null);

    useEffect(() => {
        if (isActive && vibe.mediaType !== 'image') {
            videoRef.current?.play().catch(() => {});
        } else {
            videoRef.current?.pause();
            if(videoRef.current) videoRef.current.currentTime = 0;
        }
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
        if (!vibe.id.startsWith('mock-')) {
            await updateDoc(ref, { 
                likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) 
            });
        }
    };

    const handleRepost = async () => {
        if (!currentUser) return;
        const ref = doc(db, 'vibes', vibe.id);
        if (!vibe.id.startsWith('mock-')) {
            await updateDoc(ref, { 
                reposts: isReposted ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) 
            });
        }
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
            
            {!isLoaded && vibe.mediaType !== 'image' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-0">
                    <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-4">Carregando Vibe...</span>
                </div>
            )}

            {vibe.mediaType === 'image' ? (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                    <img src={vibe.videoUrl} className="w-full h-full object-contain" />
                </div>
            ) : (
                <video 
                    ref={videoRef} 
                    src={vibe.videoUrl} 
                    className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} 
                    loop 
                    playsInline 
                    muted={isGlobalMuted}
                    onLoadedData={() => setIsLoaded(true)}
                />
            )}

            {showHeartAnim && (
                <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                    <svg className="w-32 h-32 text-white fill-current animate-heart-pop" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                </div>
            )}

            <div className="absolute right-4 bottom-24 flex flex-col gap-6 items-center z-30">
                <div className="relative group">
                    <img src={vibe.user?.avatar} className="w-12 h-12 rounded-full border-2 border-white shadow-lg object-cover transition-transform group-active:scale-90" />
                    <div className="absolute -bottom-1 -right-1 bg-sky-500 rounded-full p-1 border-2 border-black">
                         <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" /></svg>
                    </div>
                </div>
                
                <div className="flex flex-col items-center" onClick={(e) => { e.stopPropagation(); handleLikeAction(); }}>
                    <svg className={`w-9 h-9 transition-all active:scale-125 ${isLiked ? 'text-red-500 fill-current' : 'text-white'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    <span className="text-white text-xs font-black drop-shadow-md mt-1">{vibe.likes.length}</span>
                </div>
                
                <div className="flex flex-col items-center" onClick={(e) => { e.stopPropagation(); setIsCommentsOpen(true); }}>
                    <svg className="w-9 h-9 text-white drop-shadow-md" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" /></svg>
                    <span className="text-white text-xs font-black drop-shadow-md mt-1">{vibe.commentsCount}</span>
                </div>

                <div className="flex flex-col items-center" onClick={(e) => { e.stopPropagation(); handleRepost(); }}>
                    <RepostIcon className={`w-9 h-9 transition-all active:scale-125 ${isReposted ? 'text-green-500' : 'text-white'}`} />
                </div>

                <div className="flex flex-col items-center" onClick={(e) => { e.stopPropagation(); setGlobalMuted(!isGlobalMuted); }}>
                    {isGlobalMuted ? <VolumeOffIcon className="w-9 h-9 text-white drop-shadow-md" /> : <VolumeOnIcon className="w-9 h-9 text-white drop-shadow-md" />}
                </div>
            </div>

            <div className="absolute left-4 bottom-10 z-30 text-white pointer-events-none pr-20 max-w-[80%]">
                {reposterData && (
                    <div className="flex items-center gap-1.5 mb-3 bg-black/40 backdrop-blur-md rounded-full w-fit px-3 py-1 border border-white/20 animate-fade-in shadow-xl">
                        <img src={reposterData.avatar} className="w-4 h-4 rounded-full border border-white/30" />
                        <span className="text-[10px] font-black text-white tracking-tight uppercase">
                            {reposterData.isMe ? t('post.youRepublicated') : t('post.republishedBy', { username: reposterData.username })}
                        </span>
                    </div>
                )}
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-base drop-shadow-lg">@{vibe.user?.username}</h3>
                    <button className="bg-transparent border border-white/50 text-[10px] font-black px-2 py-0.5 rounded-md hover:bg-white hover:text-black transition-all">Seguir</button>
                </div>
                <p className="text-sm font-medium drop-shadow-lg break-words line-clamp-3 leading-snug">{vibe.caption}</p>
                
                {vibe.musicInfo && (
                    <div className="flex items-center gap-2 mt-4 bg-black/20 backdrop-blur-sm p-1.5 pr-4 rounded-full w-fit border border-white/10 overflow-hidden group">
                        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center animate-spin-slow">
                            <img src={vibe.musicInfo.capa} className="w-full h-full rounded-full" />
                        </div>
                        <div className="overflow-hidden w-24">
                            <p className="text-[10px] font-bold truncate animate-marquee whitespace-nowrap">{vibe.musicInfo.nome} • {vibe.musicInfo.artista}</p>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none z-10" />
            
            <style>{`
                @keyframes heart-pop { 0% { transform: scale(0); opacity: 0; } 15% { transform: scale(1.25); opacity: 0.9; } 30% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
                .animate-heart-pop { animation: heart-pop 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
                @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin-slow { animation: spin-slow 4s linear infinite; }
                @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-150%); } }
                .animate-marquee { animation: marquee 6s linear infinite; }
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
        const q = query(collection(db, 'vibes'), orderBy('createdAt', 'desc'), limit(15));
        return onSnapshot(q, async (snap) => {
            const firestoreVibes = await Promise.all(snap.docs.map(async d => {
                const userDoc = await getDoc(doc(db, 'users', d.data().userId));
                return { id: d.id, ...d.data(), user: userDoc.exists() ? userDoc.data() : { username: '...', avatar: '' } } as VibeType;
            }));

            // Misturamos os vídeos do banco com os vídeos sugeridos (MOCKS)
            // Os vídeos do Firestore (reais) aparecem no topo
            const merged = [...firestoreVibes, ...MOCK_VIBES];
            
            const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
            
            setVibes(unique);
            setLoading(false);
        });
    }, []);

    const handleScroll = () => {
        if (containerRef.current) {
            const index = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
            if (index !== activeVibeIndex) {
                setActiveVibeIndex(index);
            }
        }
    };

    if (loading) return (
        <div className="h-full bg-black flex flex-col items-center justify-center text-white">
            <div className="w-16 h-16 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mb-4" />
            <span className="font-black text-xs uppercase tracking-[0.2em] animate-pulse">Sintonizando Vibes</span>
        </div>
    );

    return (
        <div className="relative h-screen sm:h-[calc(100vh-4rem)] bg-black overflow-hidden lg:rounded-3xl shadow-2xl">
            <div 
                ref={containerRef} 
                onScroll={handleScroll} 
                className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar scroll-smooth"
                style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}
            >
                {vibes.map((v, i) => (
                    <VibeItem 
                        key={v.id} 
                        vibe={v} 
                        isActive={i === activeVibeIndex} 
                        onDelete={() => {}} 
                    />
                ))}
            </div>
        </div>
    );
};

export default VibeFeed;
