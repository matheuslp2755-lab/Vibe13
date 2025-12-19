
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
    type?: 'normal' | 'shared_post';
    sharedPostData?: any;
    bgGradient?: string;
    mediaScale?: number;
    stickers?: { id: string, url: string, x: number, y: number }[];
    textSize?: number;
    textFont?: string;
    imageScale?: number;
    filter?: string;
    createdAt: { seconds: number; nanoseconds: number };
    authorId: string;
    musicInfo?: { nome: string; artista: string; capa: string; preview: string; startTime?: number; };
    musicMode?: number;
    musicCoverPosition?: { x: number, y: number };
    location?: { name: string; x: number; y: number };
    likes?: string[];
};

const FONT_FAMILIES: Record<string, string> = {
    classic: 'sans-serif',
    modern: 'serif',
    neon: 'cursive',
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

const HeartIcon: React.FC<{className?: string, filled?: boolean}> = ({ className, filled }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
);

const TrashIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const PulseViewerModal: React.FC<PulseViewerModalProps> = ({ pulses, initialPulseIndex, authorInfo, onClose, onDelete, onViewProfile }) => {
    const { t } = useLanguage();
    const { isGlobalMuted } = useCall();
    const [currentIndex, setCurrentIndex] = useState(initialPulseIndex);
    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    const currentPulse = pulses[currentIndex];
    const videoRef = useRef<HTMLVideoElement>(null);
    const currentUser = auth.currentUser;
    const isOwner = currentUser?.uid === authorInfo.id;
    const isLiked = currentPulse.likes?.includes(currentUser?.uid || '') || false;

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
        await updateDoc(pulseRef, {
            likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
        });
    };

    const handleDelete = async () => {
        if (!isOwner || !currentPulse) return;
        await deleteDoc(doc(db, 'pulses', currentPulse.id));
        onDelete(currentPulse);
        if (pulses.length === 1) onClose(); else goToNext();
    };

    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !replyText.trim() || isOwner || !currentPulse) return;
        setIsReplying(true);
        try {
            const conversationId = [currentUser.uid, authorInfo.id].sort().join('_');
            const conversationRef = doc(db, 'conversations', conversationId);
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
                mediaUrl: currentPulse.mediaUrl || currentPulse.sharedPostData?.imageUrl,
                mediaType: 'image'
            });
            await updateDoc(conversationRef, {
                lastMessage: { text: replyText.trim(), senderId: currentUser.uid, timestamp: serverTimestamp() },
                timestamp: serverTimestamp()
            });
            setReplyText('');
        } catch (err) { console.error(err); } finally { setIsReplying(false); }
    };

    return (
        <div className={`fixed inset-0 z-[100] flex flex-col select-none transition-all duration-700 ${currentPulse.bgGradient ? `bg-gradient-to-br ${currentPulse.bgGradient}` : 'bg-black'}`} onClick={(e) => { e.stopPropagation(); onClose(); }}>
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

                <div className="w-full h-full flex items-center justify-center relative transition-transform duration-500" style={{ transform: `scale(${currentPulse.mediaScale || 1})` }}>
                  {currentPulse.type === 'shared_post' && currentPulse.sharedPostData ? (
                    <div 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            // NAVEGAÇÃO AO PERFIL ORIGINAL
                            if(currentPulse.sharedPostData.userId) onViewProfile?.(currentPulse.sharedPostData.userId);
                        }}
                        className="w-[85%] max-w-sm bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.6)] overflow-hidden animate-slide-up border dark:border-white/5 active:scale-95 transition-all cursor-pointer group"
                    >
                        <div className="p-4 flex items-center gap-3 border-b dark:border-zinc-800">
                            <img src={currentPulse.sharedPostData.avatar} className="w-8 h-8 rounded-full object-cover" />
                            <span className="font-black text-xs">@{currentPulse.sharedPostData.username}</span>
                        </div>
                        <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden relative">
                            <img src={currentPulse.sharedPostData.imageUrl} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="bg-white/80 backdrop-blur-md px-5 py-2 rounded-full text-black font-black text-xs uppercase tracking-widest shadow-2xl">Ver Perfil</span>
                            </div>
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-sky-500">Ver publicação</span>
                        </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ filter: currentPulse.filter || 'none' }}>
                        {currentPulse.mediaUrl.match(/\.(mp4|webm|mov|ogg)$/i) ? (
                            <video ref={videoRef} src={currentPulse.mediaUrl} autoPlay loop muted={isGlobalMuted} playsInline className="w-full h-full object-contain" />
                        ) : <img src={currentPulse.mediaUrl} className="w-full h-full object-contain shadow-2xl" />}
                    </div>
                  )}

                  {/* STICKERS RENDERER */}
                  {currentPulse.stickers?.map(s => (
                      <div key={s.id} className="absolute z-40" style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%, -50%)' }}>
                          <img src={s.url} className="w-32 h-32 object-contain" />
                      </div>
                  ))}
                </div>

                {currentPulse.legenda && (
                    <div className="absolute px-6 py-3 bg-black/40 backdrop-blur-md rounded-2xl text-white font-black shadow-2xl pointer-events-none text-center z-50 border border-white/10" style={{ left: '50%', top: '30%', transform: 'translate(-50%, -50%)', fontSize: `${currentPulse.textSize || 32}px`, fontFamily: FONT_FAMILIES[currentPulse.textFont || 'classic'] }}>
                        {currentPulse.legenda}
                    </div>
                )}

                <div className="absolute top-8 left-4 flex items-center gap-3 z-50 bg-black/20 p-2 pr-4 rounded-full backdrop-blur-md border border-white/10" onClick={() => onViewProfile?.(authorInfo.id)}>
                    <img src={authorInfo.avatar} className="w-10 h-10 rounded-full object-cover border-2 border-white/40 shadow-lg" />
                    <div className="flex flex-col">
                        <p className="text-white font-black text-sm drop-shadow-md">{authorInfo.username}</p>
                        <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Pulse agora</p>
                    </div>
                </div>

                <div className="absolute top-8 right-4 z-50 flex items-center gap-2">
                    {isOwner && (
                        <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }} className="text-white bg-black/40 backdrop-blur-xl rounded-full w-12 h-12 flex items-center justify-center hover:bg-red-500 transition-all border border-white/10" title={t('pulseViewer.delete')}>
                            <TrashIcon className="w-6 h-6" />
                        </button>
                    )}
                    <button onClick={onClose} className="text-white text-4xl font-light hover:scale-110 transition-transform bg-black/40 backdrop-blur-xl rounded-full w-12 h-12 flex items-center justify-center border border-white/10">&times;</button>
                </div>

                <div className="absolute bottom-10 left-0 right-0 p-4 flex items-center gap-3 z-50">
                    {!isOwner && (
                        <form onSubmit={handleReply} className="flex-grow flex items-center bg-black/40 backdrop-blur-2xl rounded-full border border-white/20 px-6 py-3 shadow-2xl">
                            <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={t('pulseViewer.replyPlaceholder')} className="flex-grow bg-transparent text-white text-sm outline-none placeholder:text-white/40 font-bold" onClick={e => e.stopPropagation()} />
                            {replyText.trim() && <button type="submit" disabled={isReplying} className="text-sky-400 font-black text-xs uppercase tracking-widest ml-3 disabled:opacity-50">{isReplying ? '...' : 'Enviar'}</button>}
                        </form>
                    )}
                    <button onClick={handleLike} className={`p-4 rounded-full backdrop-blur-2xl transition-all active:scale-125 border shadow-2xl ${isLiked ? 'bg-red-500 text-white border-red-400' : 'bg-black/40 text-white border-white/20'}`}>
                        <HeartIcon className="w-7 h-7" filled={isLiked} />
                    </button>
                </div>
            </div>
            
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[120]" onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}>
                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] max-w-sm w-full mx-4 text-center border dark:border-zinc-800 shadow-[0_50px_100px_rgba(0,0,0,0.6)]" onClick={e => e.stopPropagation()}>
                        <h3 className="font-black text-xl mb-3 tracking-tighter">{t('pulseViewer.deleteTitle')}</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 mb-8 font-medium">{t('pulseViewer.deleteBody')}</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={handleDelete} className="w-full py-4 bg-red-500 text-white font-black rounded-2xl hover:bg-red-600 transition-colors uppercase tracking-widest text-xs">{t('common.delete')}</button>
                            <button onClick={() => setShowDeleteConfirm(false)} className="w-full py-4 bg-zinc-200 dark:bg-zinc-800 font-black rounded-2xl uppercase tracking-widest text-xs">{t('common.cancel')}</button>
                        </div>
                    </div>
                </div>
            )}

            {currentPulse.musicInfo && (
                <div className="fixed bottom-10 left-4 right-4 z-50 pointer-events-none overflow-hidden h-0 w-0">
                    <MusicPlayer musicInfo={currentPulse.musicInfo} isPlaying={true} isMuted={isGlobalMuted} setIsMuted={() => {}} />
                </div>
            )}
        </div>
    );
};

export default PulseViewerModal;
