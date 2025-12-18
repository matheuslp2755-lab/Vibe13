
import React, { useState, useEffect, useRef } from 'react';
import { auth, db, doc, setDoc, serverTimestamp, deleteDoc, updateDoc, arrayUnion, arrayRemove, collection, getDoc, addDoc } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';
import MusicPlayer from '../feed/MusicPlayer';

type Pulse = {
    id: string;
    mediaUrl: string;
    legenda: string;
    textPosition?: { x: number, y: number };
    textSize?: number;
    textFont?: string;
    imageScale?: number;
    filter?: string;
    createdAt: { seconds: number; nanoseconds: number };
    authorId: string;
    musicInfo?: { nome: string; artista: string; capa: string; preview: string; startTime?: number; };
    musicMode?: 'cover' | 'lyrics';
    musicCoverPosition?: { x: number, y: number };
    location?: { name: string; x: number; y: number };
    poll?: { question: string; opt1: string; opt2: string; x: number; y: number };
    countdown?: { title: string; date: string; x: number; y: number };
    likes?: string[];
};

const FONT_FAMILIES: Record<string, string> = {
    classic: 'sans-serif',
    modern: 'serif',
    neon: 'cursive',
    typewriter: 'monospace',
    strong: 'Impact, sans-serif'
};

interface PulseViewerModalProps {
    pulses: Pulse[];
    initialPulseIndex: number;
    authorInfo: { id: string, username: string; avatar: string };
    onClose: () => void;
    onDelete: (pulse: Pulse) => void;
    onViewProfile?: (userId: string) => void;
}

const LocationIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
);

const HeartIcon: React.FC<{className?: string, filled?: boolean}> = ({ className, filled }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
);

const PulseViewerModal: React.FC<PulseViewerModalProps> = ({ pulses, initialPulseIndex, authorInfo, onClose, onDelete, onViewProfile }) => {
    const { t } = useLanguage();
    const { isGlobalMuted, setGlobalMuted } = useCall();
    const [currentIndex, setCurrentIndex] = useState(initialPulseIndex);
    const [isMusicMuted, setIsMusicMuted] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);
    
    const currentPulse = pulses[currentIndex];
    const videoRef = useRef<HTMLVideoElement>(null);
    const currentUser = auth.currentUser;
    const isOwner = currentUser?.uid === authorInfo.id;
    const isLiked = currentPulse.likes?.includes(currentUser?.uid || '') || false;

    useEffect(() => {
        window.history.pushState({ modal: 'pulse' }, '');
        const handlePopState = () => onClose();
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [onClose]);

    useEffect(() => {
        if (!currentPulse || !currentUser) return;
        const viewRef = doc(db, 'pulses', currentPulse.id, 'views', currentUser.uid);
        setDoc(viewRef, { timestamp: serverTimestamp() }).catch(() => {});
    }, [currentIndex, currentPulse, currentUser]);

    if (!currentPulse) { onClose(); return null; }

    const goToNext = () => currentIndex < pulses.length - 1 ? setCurrentIndex(i => i + 1) : onClose();
    const goToPrev = () => currentIndex > 0 && setCurrentIndex(i => i - 1);

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser || !currentPulse) return;
        const pulseRef = doc(db, 'pulses', currentPulse.id);
        try {
            await updateDoc(pulseRef, {
                likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
            });
        } catch (err) {
            console.error("Error liking pulse:", err);
        }
    };

    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !replyText.trim() || isOwner || !currentPulse) return;
        
        setIsReplying(true);
        const conversationId = [currentUser.uid, authorInfo.id].sort().join('_');
        const conversationRef = doc(db, 'conversations', conversationId);

        try {
            const convSnap = await getDoc(conversationRef);
            if (!convSnap.exists()) {
                await setDoc(conversationRef, {
                    participants: [currentUser.uid, authorInfo.id],
                    participantInfo: {
                        [currentUser.uid]: { username: currentUser.displayName, avatar: currentUser.photoURL },
                        [authorInfo.id]: { username: authorInfo.username, avatar: authorInfo.avatar }
                    },
                    timestamp: serverTimestamp()
                });
            }

            await addDoc(collection(conversationRef, 'messages'), {
                senderId: currentUser.uid,
                text: replyText.trim(),
                timestamp: serverTimestamp(),
                mediaUrl: currentPulse.mediaUrl,
                mediaType: 'image'
            });

            await updateDoc(conversationRef, {
                lastMessage: {
                    text: replyText.trim(),
                    senderId: currentUser.uid,
                    timestamp: serverTimestamp()
                },
                timestamp: serverTimestamp()
            });

            setReplyText('');
        } catch (err) {
            console.error("Error replying to pulse:", err);
        } finally {
            setIsReplying(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col select-none" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <div className="absolute top-4 left-4 right-4 flex gap-1 z-[110]">
                {pulses.map((_, i) => (
                    <div key={i} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                        <div className={`h-full bg-white transition-all duration-[5000ms] linear ${i < currentIndex ? 'w-full' : i === currentIndex ? 'w-full' : 'w-0'}`} />
                    </div>
                ))}
            </div>

            <div className="relative w-full h-full flex items-center justify-center overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="absolute inset-y-0 left-0 w-1/3 z-40 cursor-pointer" onClick={goToPrev}></div>
                <div className="absolute inset-y-0 right-0 w-1/3 z-40 cursor-pointer" onClick={goToNext}></div>

                <div className="w-full h-full flex items-center justify-center transition-transform duration-300" style={{ transform: `scale(${currentPulse.imageScale || 1})`, filter: currentPulse.filter || 'none' }}>
                    {currentPulse.mediaUrl.match(/\.(mp4|webm|mov|ogg)$/i) ? (
                        <video ref={videoRef} src={currentPulse.mediaUrl} autoPlay loop muted={isGlobalMuted} playsInline className="w-full h-full object-contain" />
                    ) : <img src={currentPulse.mediaUrl} className="w-full h-full object-contain" />}
                </div>

                {currentPulse.legenda && (
                    <div className="absolute px-4 py-2 bg-black/40 backdrop-blur-sm rounded-lg text-white font-bold shadow-lg pointer-events-none text-center" style={{ left: `${currentPulse.textPosition?.x || 50}%`, top: `${currentPulse.textPosition?.y || 30}%`, transform: 'translate(-50%, -50%)', fontSize: `${currentPulse.textSize || 24}px`, fontFamily: FONT_FAMILIES[currentPulse.textFont || 'classic'] }}>
                        {currentPulse.legenda}
                    </div>
                )}

                {currentPulse.musicInfo && (
                    <div className={`absolute backdrop-blur-md rounded-xl border border-white/30 shadow-xl flex items-center pointer-events-none ${currentPulse.musicMode === 'lyrics' ? 'w-64 p-3 gap-3 bg-black/40' : 'w-32 flex-col p-2 gap-1 bg-white/20'}`} style={{ left: `${currentPulse.musicCoverPosition?.x || 50}%`, top: `${currentPulse.musicCoverPosition?.y || 50}%`, transform: 'translate(-50%, -50%)' }}>
                        <img src={currentPulse.musicInfo.capa} className={`${currentPulse.musicMode === 'lyrics' ? 'w-12 h-12 rounded-md' : 'w-28 h-28 rounded-lg'}`} />
                        <div className={`${currentPulse.musicMode === 'lyrics' ? 'text-left' : 'text-center'} w-full text-white overflow-hidden`}>
                            <p className="text-[10px] font-bold truncate">{currentPulse.musicInfo.nome}</p>
                        </div>
                    </div>
                )}

                {currentPulse.location && (
                    <div className="absolute px-4 py-2 bg-white/90 backdrop-blur-md rounded-full text-black font-bold shadow-xl flex items-center gap-1.5 pointer-events-none" style={{ left: `${currentPulse.location.x}%`, top: `${currentPulse.location.y}%`, transform: 'translate(-50%, -50%)' }}>
                        <LocationIcon className="w-4 h-4 text-sky-500" />
                        <span className="text-sm">{currentPulse.location.name}</span>
                    </div>
                )}

                <div className="absolute top-8 left-4 flex items-center gap-3 z-50 bg-black/10 p-2 rounded-full backdrop-blur-sm" onClick={() => onViewProfile?.(authorInfo.id)}>
                    <img src={authorInfo.avatar} className="w-9 h-9 rounded-full object-cover border-2 border-sky-500" />
                    <div className="flex flex-col">
                        <p className="text-white font-bold text-sm drop-shadow-md">{authorInfo.username}</p>
                        <p className="text-white/70 text-[10px]">Vibe agora</p>
                    </div>
                </div>

                <div className="absolute top-8 right-4 z-50 flex items-center gap-2">
                    <button onClick={onClose} className="text-white text-3xl font-light hover:scale-110 transition-transform bg-black/20 rounded-full w-10 h-10 flex items-center justify-center ml-2">&times;</button>
                </div>

                <div className="absolute bottom-10 left-0 right-0 p-4 flex items-center gap-3 z-50">
                    {!isOwner && (
                        <form onSubmit={handleReply} className="flex-grow flex items-center bg-black/20 backdrop-blur-md rounded-full border border-white/20 px-4 py-2">
                            <input 
                                type="text" 
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder={t('pulseViewer.replyPlaceholder')}
                                className="flex-grow bg-transparent text-white text-sm outline-none placeholder:text-white/50"
                                onClick={e => e.stopPropagation()}
                            />
                            {replyText.trim() && (
                                <button type="submit" disabled={isReplying} className="text-white font-bold text-xs ml-2 disabled:opacity-50">
                                    {isReplying ? '...' : 'Enviar'}
                                </button>
                            )}
                        </form>
                    )}
                    <button 
                        onClick={handleLike} 
                        className={`p-3 rounded-full backdrop-blur-md transition-all active:scale-125 ${isLiked ? 'bg-red-500 text-white' : 'bg-black/20 text-white border border-white/20'}`}
                    >
                        <HeartIcon className="w-6 h-6" filled={isLiked} />
                    </button>
                </div>
            </div>
            
            {currentPulse.musicInfo && (
                <div className="fixed bottom-10 left-4 right-4 z-50 pointer-events-none overflow-hidden h-0 w-0">
                    <MusicPlayer musicInfo={currentPulse.musicInfo} isPlaying={true} isMuted={isGlobalMuted} setIsMuted={() => {}} />
                </div>
            )}
        </div>
    );
};

export default PulseViewerModal;
