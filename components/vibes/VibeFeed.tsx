
import React, { useState, useEffect, useRef } from 'react';
import { db, collection, query, orderBy, limit, doc, updateDoc, arrayUnion, arrayRemove, getDoc, addDoc, serverTimestamp, deleteDoc, onSnapshot, increment } from '../../firebase';
import { auth } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';

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
    const currentUser = auth.currentUser;
    const isLiked = vibe.likes.includes(currentUser?.uid || '');

    useEffect(() => {
        if (isActive) videoRef.current?.play().catch(() => {});
        else { videoRef.current?.pause(); if(videoRef.current) videoRef.current.currentTime = 0; }
    }, [isActive]);

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) return;
        await updateDoc(doc(db, 'vibes', vibe.id), { 
            likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) 
        });
    };

    return (
        <div className="relative w-full h-full snap-start shrink-0 bg-black flex items-center justify-center overflow-hidden">
            <video ref={videoRef} src={vibe.videoUrl} className="w-full h-full object-contain" loop playsInline muted={isGlobalMuted} onClick={() => setGlobalMuted(!isGlobalMuted)} />

            <div className="absolute right-4 bottom-20 flex flex-col gap-6 items-center z-30">
                <img src={vibe.user?.avatar} className="w-11 h-11 rounded-full border-2 border-white shadow-lg" />
                <div className="flex flex-col items-center cursor-pointer group" onClick={handleLike}>
                    <svg className={`w-9 h-9 transition-transform active:scale-150 ${isLiked ? 'text-red-500 fill-current' : 'text-white'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    <span className="text-white text-xs font-bold drop-shadow-md">{vibe.likes.length}</span>
                </div>
                <div className="flex flex-col items-center cursor-pointer" onClick={() => setIsCommentsOpen(true)}>
                    <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" /></svg>
                    <span className="text-white text-xs font-bold drop-shadow-md">{vibe.commentsCount}</span>
                </div>
                <div className="flex flex-col items-center cursor-pointer">
                    <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </div>
                {currentUser?.uid === vibe.userId && (
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 text-white/70 hover:text-red-500"><TrashIcon className="w-7 h-7" /></button>
                )}
            </div>

            <div className="absolute left-4 bottom-8 z-30 text-white pointer-events-none pr-16">
                <h3 className="font-bold text-base drop-shadow-md">@{vibe.user?.username}</h3>
                <p className="text-sm drop-shadow-md break-words line-clamp-3">{vibe.caption}</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-10" />
            
            <VibeCommentsModal isOpen={isCommentsOpen} onClose={() => setIsCommentsOpen(false)} vibeId={vibe.id} />
        </div>
    );
};

const TrashIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
);

const VibeFeed: React.FC = () => {
    const [vibes, setVibes] = useState<VibeType[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeVibeIndex, setActiveVibeIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [deleteVibe, setDeleteVibe] = useState<VibeType | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'vibes'), orderBy('createdAt', 'desc'), limit(20));
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
        <div className="relative h-[calc(100vh-8rem)] bg-black overflow-hidden">
            <div ref={containerRef} onScroll={() => setActiveVibeIndex(Math.round(containerRef.current!.scrollTop / containerRef.current!.clientHeight))} className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar scroll-smooth">
                {vibes.map((v, i) => (
                    <VibeItem key={v.id} vibe={v} isActive={i === activeVibeIndex} onDelete={() => setDeleteVibe(v)} />
                ))}
            </div>

            {deleteVibe && (
                <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 p-6 rounded-2xl w-full max-w-xs text-center border dark:border-zinc-800">
                        <h3 className="text-white font-bold mb-4">Excluir Vibe?</h3>
                        <div className="flex flex-col gap-2">
                            <button onClick={async () => { await deleteDoc(doc(db, 'vibes', deleteVibe.id)); setDeleteVibe(null); }} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl">Excluir</button>
                            <button onClick={() => setDeleteVibe(null)} className="w-full py-3 bg-zinc-800 text-white font-bold rounded-xl">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VibeFeed;
