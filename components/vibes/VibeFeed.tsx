
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
    const isLiked = pulse.likes.includes(auth.currentUser?.uid || '');
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (isActive) videoRef.current?.play().catch(() => {});
        else { videoRef.current?.pause(); if(videoRef.current) videoRef.current.currentTime = 0; }
    }, [isActive]);

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) return;
        const ref = doc(db, 'vibes', pulse.id);
        await updateDoc(ref, { likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) });
    };

    return (
        <div className="relative w-full h-full snap-start shrink-0 bg-black flex items-center justify-center overflow-hidden">
            <video ref={videoRef} src={pulse.videoUrl} className="w-full h-full object-contain" loop playsInline muted={isGlobalMuted} onClick={() => setGlobalMuted(!isGlobalMuted)} />

            <div className="absolute right-4 bottom-20 flex flex-col gap-6 items-center z-30">
                <img src={pulse.user?.avatar} className="w-11 h-11 rounded-full border-2 border-white shadow-lg" />
                <div className="flex flex-col items-center cursor-pointer" onClick={handleLike}>
                    <HeartIcon filled={isLiked} />
                    <span className="text-white text-xs font-bold drop-shadow-md">{pulse.likes.length}</span>
                </div>
                <div className="flex flex-col items-center cursor-pointer" onClick={onOpenComments}>
                    <CommentIcon />
                    <span className="text-white text-xs font-bold drop-shadow-md">{pulse.commentsCount}</span>
                </div>
                {currentUser?.uid === pulse.userId && (
                    <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                        <TrashIcon className="w-7 h-7 text-white/80 drop-shadow-md hover:text-red-500 transition-colors" />
                    </div>
                )}
            </div>

            <div className="absolute left-4 bottom-8 z-30 text-white pointer-events-none pr-16">
                <h3 className="font-bold text-base drop-shadow-md">@{pulse.user?.username}</h3>
                <p className="text-sm drop-shadow-md break-words line-clamp-3">{pulse.caption}</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-10" />
        </div>
    );
};

const HeartIcon: React.FC<{ filled: boolean }> = ({ filled }) => (
    <svg className={`w-8 h-8 ${filled ? 'text-red-500 fill-current' : 'text-white'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
);
const CommentIcon: React.FC = () => (
    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" /></svg>
);
const TrashIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
);

const VibeFeed: React.FC = () => {
    const { t } = useLanguage();
    const [pulses, setPulses] = useState<PulseType[]>([]);
    const [loading, setLoading] = useState(true);
    const [activePulseIndex, setActivePulseIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [deleteVibe, setDeleteVibe] = useState<PulseType | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'vibes'), orderBy('createdAt', 'desc'), limit(20));
        return onSnapshot(q, async (snap) => {
            const data = await Promise.all(snap.docs.map(async d => {
                const userDoc = await getDoc(doc(db, 'users', d.data().userId));
                return { id: d.id, ...d.data(), user: userDoc.exists() ? userDoc.data() : { username: '...', avatar: '' } } as PulseType;
            }));
            setPulses(data);
            setLoading(false);
        });
    }, []);

    const handleDelete = async () => {
        if (!deleteVibe) return;
        try {
            await deleteDoc(doc(db, 'vibes', deleteVibe.id));
            setDeleteVibe(null);
        } catch (e) { console.error(e); }
    };

    if (loading) return <div className="h-full bg-black flex items-center justify-center text-white">Carregando Pulses...</div>;

    return (
        <div className="relative h-[calc(100vh-8rem)] bg-black overflow-hidden">
            <div ref={containerRef} onScroll={() => {
                if (containerRef.current) setActivePulseIndex(Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight));
            }} className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar">
                {pulses.map((p, i) => (
                    <PulseItem key={p.id} pulse={p} isActive={i === activePulseIndex} onOpenComments={() => {}} onDelete={() => setDeleteVibe(p)} />
                ))}
            </div>

            {deleteVibe && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center">
                    <div className="bg-zinc-900 p-6 rounded-2xl max-w-xs w-full text-center">
                        <h3 className="text-white font-bold mb-4">Excluir este Pulse?</h3>
                        <div className="flex gap-2">
                            <button onClick={() => setDeleteVibe(null)} className="flex-1 py-2 text-white bg-zinc-800 rounded-lg">Cancelar</button>
                            <button onClick={handleDelete} className="flex-1 py-2 text-white bg-red-600 rounded-lg">Excluir</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VibeFeed;
