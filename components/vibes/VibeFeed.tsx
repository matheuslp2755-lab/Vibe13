
import React, { useState, useEffect, useRef } from 'react';
import { db, collection, query, orderBy, limit, doc, updateDoc, arrayUnion, arrayRemove, getDoc, addDoc, serverTimestamp, deleteDoc, onSnapshot, increment } from '../../firebase';
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

const VibeCommentsModal: React.FC<{ isOpen: boolean; onClose: () => void; vibeId: string }> = ({ isOpen, onClose, vibeId }) => {
    const [comments, setComments] = useState<any[]>([]);
    const [text, setText] = useState('');
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!isOpen) return;
        const q = query(collection(db, 'vibes', vibeId, 'comments'), orderBy('timestamp', 'desc'));
        return onSnapshot(q, snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, [isOpen, vibeId]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim() || !currentUser) return;
        await addDoc(collection(db, 'vibes', vibeId, 'comments'), {
            userId: currentUser.uid,
            username: currentUser.displayName,
            userAvatar: currentUser.photoURL,
            text,
            timestamp: serverTimestamp()
        });
        await updateDoc(doc(db, 'vibes', vibeId), { commentsCount: increment(1) });
        setText('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex flex-col justify-end" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 rounded-t-2xl h-2/3 flex flex-col p-4 animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 border-b dark:border-zinc-800 pb-2">
                    <h3 className="font-bold">Comentários</h3>
                    <button onClick={onClose} className="text-xl">&times;</button>
                </div>
                <div className="flex-grow overflow-y-auto space-y-4">
                    {comments.map(c => (
                        <div key={c.id} className="flex gap-2">
                            <img src={c.userAvatar} className="w-8 h-8 rounded-full object-cover" />
                            <div>
                                <p className="text-xs font-bold">{c.username}</p>
                                <p className="text-sm">{c.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <form onSubmit={handleSend} className="mt-4 flex gap-2">
                    <input value={text} onChange={e => setText(e.target.value)} placeholder="Comentar..." className="flex-grow bg-zinc-100 dark:bg-zinc-800 p-2 rounded-lg text-sm outline-none" />
                    <button type="submit" className="text-sky-500 font-bold">Enviar</button>
                </form>
            </div>
        </div>
    );
};

const VibeItem: React.FC<{ 
    vibe: VibeType; 
    isActive: boolean;
    onDelete: () => void;
}> = ({ vibe, isActive, onDelete }) => {
    const { isGlobalMuted, setGlobalMuted } = useCall();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [showHeartAnim, setShowHeartAnim] = useState(false);
    const lastTap = useRef<number>(0);
    const currentUser = auth.currentUser;
    const isLiked = vibe.likes.includes(currentUser?.uid || '');

    useEffect(() => {
        if (isActive && vibe.mediaType !== 'image') videoRef.current?.play().catch(() => {});
        else { videoRef.current?.pause(); if(videoRef.current) videoRef.current.currentTime = 0; }
    }, [isActive, vibe.mediaType]);

    const handleLikeAction = async () => {
        if (!currentUser) return;
        const vibeRef = doc(db, 'vibes', vibe.id);
        const isCurrentlyLiked = vibe.likes.includes(currentUser.uid);
        await updateDoc(vibeRef, { 
            likes: isCurrentlyLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) 
        });
    };

    const handleLikeOnly = async () => {
        if (!currentUser || vibe.likes.includes(currentUser.uid)) return;
        await updateDoc(doc(db, 'vibes', vibe.id), { 
            likes: arrayUnion(currentUser.uid) 
        });
    };

    const handleDoubleTap = () => {
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;
        if (now - lastTap.current < DOUBLE_TAP_DELAY) {
            handleLikeOnly();
            setShowHeartAnim(true);
            setTimeout(() => setShowHeartAnim(false), 800);
        }
        lastTap.current = now;
    };

    return (
        <div 
            className="relative w-full h-full snap-start shrink-0 bg-black flex items-center justify-center overflow-hidden"
            onClick={handleDoubleTap}
        >
            {vibe.mediaType === 'image' ? (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                    <img src={vibe.videoUrl} className="w-full h-full object-contain" />
                    {vibe.musicInfo && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0">
                            <MusicPlayer musicInfo={vibe.musicInfo} isPlaying={isActive} isMuted={isGlobalMuted} setIsMuted={() => {}} />
                        </div>
                    )}
                </div>
            ) : (
                <video ref={videoRef} src={vibe.videoUrl} className="w-full h-full object-contain" loop playsInline muted={isGlobalMuted} onClick={(e) => { e.stopPropagation(); setGlobalMuted(!isGlobalMuted); }} />
            )}

            {/* Like Animation Overlay */}
            {showHeartAnim && (
                <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                    <svg className="w-32 h-32 text-white fill-current animate-heart-pop" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                </div>
            )}

            <div className="absolute right-4 bottom-24 flex flex-col gap-6 items-center z-30">
                <div className="relative">
                    <img src={vibe.user?.avatar} className="w-12 h-12 rounded-full border-2 border-white shadow-lg object-cover" />
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-sky-500 rounded-full p-0.5">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" /></svg>
                    </div>
                </div>
                
                <div className="flex flex-col items-center cursor-pointer group" onClick={(e) => { e.stopPropagation(); handleLikeAction(); }}>
                    <svg className={`w-9 h-9 transition-all active:scale-150 ${isLiked ? 'text-red-500 fill-current' : 'text-white'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    <span className="text-white text-xs font-bold drop-shadow-md">{vibe.likes.length}</span>
                </div>
                
                <div className="flex flex-col items-center cursor-pointer" onClick={(e) => { e.stopPropagation(); setIsCommentsOpen(true); }}>
                    <svg className="w-9 h-9 text-white drop-shadow-md" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" /></svg>
                    <span className="text-white text-xs font-bold drop-shadow-md">{vibe.commentsCount}</span>
                </div>

                <div className="flex flex-col items-center cursor-pointer group">
                    <svg className="w-9 h-9 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </div>
                
                {currentUser?.uid === vibe.userId && (
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 text-white/50 hover:text-red-500 transition-colors"><TrashIcon className="w-6 h-6" /></button>
                )}
            </div>

            <div className="absolute left-4 bottom-10 z-30 text-white pointer-events-none pr-20">
                <h3 className="font-bold text-base drop-shadow-lg flex items-center gap-2">
                    @{vibe.user?.username}
                    {vibe.musicInfo && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-medium border border-white/10 animate-pulse">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.447-.894L4 6.424V20.5a1 1 0 001.5 1.5h.01L17 18.424V4.5a1 1 0 00-1-1.5zM6 8.118l8-2.436v8.664l-8 2.436V8.118z" /></svg>
                            <span className="truncate max-w-[100px]">{vibe.musicInfo.nome}</span>
                        </div>
                    )}
                </h3>
                <p className="text-sm drop-shadow-lg break-words line-clamp-2 mt-1">{vibe.caption}</p>
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none z-10" />
            
            <VibeCommentsModal isOpen={isCommentsOpen} onClose={() => setIsCommentsOpen(false)} vibeId={vibe.id} />
            
            <style>{`
                @keyframes heart-pop {
                    0% { transform: scale(0); opacity: 0; }
                    15% { transform: scale(1.2); opacity: 0.9; }
                    30% { transform: scale(1); opacity: 1; }
                    80% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(1.5); opacity: 0; }
                }
                .animate-heart-pop {
                    animation: heart-pop 0.8s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

const TrashIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
);

const VibeFeed: React.FC = () => {
    const [vibes, setVibes] = useState<VibeType[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeVibeIndex, setActiveVibeIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [deleteVibe, setDeleteVibe] = useState<VibeType | null>(null);

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

    if (loading) return <div className="h-full bg-black flex items-center justify-center text-white">Carregando Vibrações...</div>;

    return (
        <div className="relative h-screen sm:h-[calc(100vh-4rem)] bg-black overflow-hidden lg:rounded-xl">
            <div 
                ref={containerRef} 
                onScroll={() => {
                    if (containerRef.current) {
                        setActiveVibeIndex(Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight));
                    }
                }} 
                className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar scroll-smooth"
            >
                {vibes.map((v, i) => (
                    <VibeItem key={v.id} vibe={v} isActive={i === activeVibeIndex} onDelete={() => setDeleteVibe(v)} />
                ))}
            </div>

            {deleteVibe && (
                <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 p-6 rounded-2xl w-full max-w-xs text-center border dark:border-zinc-800 shadow-2xl">
                        <h3 className="text-white font-bold mb-2">Excluir Vibe?</h3>
                        <p className="text-zinc-500 text-xs mb-6">Esta ação não pode ser desfeita.</p>
                        <div className="flex flex-col gap-2">
                            <button onClick={async () => { await deleteDoc(doc(db, 'vibes', deleteVibe.id)); setDeleteVibe(null); }} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl active:scale-95 transition-transform">Excluir</button>
                            <button onClick={() => setDeleteVibe(null)} className="w-full py-3 bg-zinc-800 text-white font-bold rounded-xl active:scale-95 transition-transform">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VibeFeed;
