
import React, { useState, useEffect, useRef } from 'react';
import { auth, db, doc, setDoc, serverTimestamp, collection, onSnapshot } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';
import PulseViewsModal from './PulseViewsModal';
import MusicPlayer from '../feed/MusicPlayer';
import AddToMemoryModal from '../post/AddToMemoryModal';
import CreateMemoryModal from '../profile/CreateMemoryModal';

type Pulse = {
    id: string;
    mediaUrl: string;
    legenda: string;
    createdAt: { seconds: number; nanoseconds: number };
    authorId: string;
    musicInfo?: {
      nome: string;
      artista: string;
      capa: string;
      preview: string;
      startTime?: number;
    };
    showMusicCover?: boolean;
    musicCoverPosition?: { x: number, y: number };
};

interface PulseViewerModalProps {
    pulses: Pulse[];
    initialPulseIndex: number;
    authorInfo: { id: string, username: string; avatar: string };
    onClose: () => void;
    onDelete: (pulse: Pulse) => void;
    onViewProfile?: (userId: string) => void;
}

const TrashIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const EyeIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const PrevIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
);

const NextIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
);

const PulseViewerModal: React.FC<PulseViewerModalProps> = ({ pulses, initialPulseIndex, authorInfo, onClose, onDelete, onViewProfile }) => {
    const { t } = useLanguage();
    const { isGlobalMuted } = useCall();
    const [localPulses, setLocalPulses] = useState([...pulses]);
    const [currentIndex, setCurrentIndex] = useState(initialPulseIndex);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [viewsCount, setViewsCount] = useState(0);
    const [isViewsModalOpen, setIsViewsModalOpen] = useState(false);
    const [isMusicMuted, setIsMusicMuted] = useState(false);
    const [isAddToMemoryOpen, setIsAddToMemoryOpen] = useState(false);
    const [isCreateMemoryOpen, setIsCreateMemoryOpen] = useState(false);
    const [initialContentForMemory, setInitialContentForMemory] = useState<any>(null);
    const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | 'none'>('none');
    
    useEffect(() => {
        setLocalPulses([...pulses]);
        if (currentIndex >= pulses.length) {
            setCurrentIndex(Math.max(0, pulses.length - 1));
        }
    }, [pulses, currentIndex]);

    const currentUser = auth.currentUser;
    const currentPulse = localPulses[currentIndex];

    useEffect(() => {
        const recordPulseView = async () => {
            if (!currentPulse || !currentUser || currentUser.uid === currentPulse.authorId) return;
            try {
                await setDoc(doc(db, 'pulses', currentPulse.id, 'views', currentUser.uid), {
                    userId: currentUser.uid, viewedAt: serverTimestamp()
                });
            } catch (error) { console.error(error); }
        };
        recordPulseView();
    }, [currentPulse, currentUser]);

    useEffect(() => {
        if (!currentPulse) return;
        const unsubscribe = onSnapshot(collection(db, 'pulses', currentPulse.id, 'views'), (snapshot) => {
            setViewsCount(snapshot.size);
        });
        return () => unsubscribe();
    }, [currentPulse]);

    if (!currentPulse) { onClose(); return null; }
    const isOwner = currentUser?.uid === currentPulse.authorId;
    
    const handleDelete = async () => {
        setIsDeleting(true);
        await onDelete(currentPulse);
        setIsDeleting(false);
        setIsDeleteConfirmOpen(false);
    };

    const handleHeaderClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onViewProfile) { onViewProfile(authorInfo.id); onClose(); }
    }

    const goToNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (currentIndex < localPulses.length - 1) {
            setSlideDirection('next');
            setCurrentIndex(i => i + 1);
        } else { onClose(); }
    };

    const goToPrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (currentIndex > 0) {
            setSlideDirection('prev');
            setCurrentIndex(i => i - 1);
        }
    };

    const canGoNext = currentIndex < localPulses.length - 1;
    const canGoPrev = currentIndex > 0;
    
    return (
        <>
            <style>{`
                @keyframes cardSlideInRight {
                    from { transform: translateX(100%) rotate(5deg) scale(0.9); opacity: 0.5; }
                    to { transform: translateX(0) rotate(0) scale(1); opacity: 1; }
                }
                @keyframes cardSlideInLeft {
                    from { transform: translateX(-100%) rotate(-5deg) scale(0.9); opacity: 0.5; }
                    to { transform: translateX(0) rotate(0) scale(1); opacity: 1; }
                }
                .pulse-card-enter-next { animation: cardSlideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .pulse-card-enter-prev { animation: cardSlideInLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>

            <PulseViewsModal
                isOpen={isViewsModalOpen} onClose={() => setIsViewsModalOpen(false)} pulseId={currentPulse.id}
                onUserSelect={(userId) => { if(onViewProfile) { onViewProfile(userId); setIsViewsModalOpen(false); onClose(); } }}
            />
            {isOwner && (
                <>
                    <AddToMemoryModal isOpen={isAddToMemoryOpen} onClose={() => setIsAddToMemoryOpen(false)} content={{ id: currentPulse.id, type: 'pulse', mediaUrl: currentPulse.mediaUrl, timestamp: currentPulse.createdAt }} onOpenCreate={(initialContent) => { setInitialContentForMemory(initialContent); setIsAddToMemoryOpen(false); setIsCreateMemoryOpen(true); }} />
                    <CreateMemoryModal isOpen={isCreateMemoryOpen} onClose={() => setIsCreateMemoryOpen(false)} onMemoryCreated={() => {}} initialContent={initialContentForMemory} />
                </>
            )}
            <div className="fixed inset-0 bg-black bg-opacity-90 flex justify-center items-center z-50 select-none backdrop-blur-sm" onClick={onClose}>
                {canGoPrev && (
                    <button onClick={goToPrev} className="absolute left-2 md:left-8 text-white bg-white/10 backdrop-blur-md rounded-full p-3 z-30 hover:bg-white/20 transition-all active:scale-95" aria-label={t('pulseViewer.previous')}>
                        <PrevIcon className="w-6 h-6" />
                    </button>
                )}

                <div className="relative w-full max-w-sm h-full max-h-[90vh] flex flex-col items-center justify-center perspective-[1000px]" onClick={e => e.stopPropagation()}>
                    <div className="absolute top-0 left-0 right-0 p-4 z-30 bg-gradient-to-b from-black/60 to-transparent pt-6 rounded-t-xl">
                        <div className="flex items-center gap-1.5 mb-3">
                           {localPulses.map((_, index) => (
                                <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                                    {index <= currentIndex && <div className="h-full bg-white rounded-full shadow-[0_0_5px_rgba(255,255,255,0.8)]"/>}
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between">
                            <button onClick={handleHeaderClick} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                <img src={authorInfo.avatar} alt={authorInfo.username} className="w-9 h-9 rounded-full object-cover border border-white/20" />
                                <p className="text-white font-semibold text-sm drop-shadow-md">{authorInfo.username}</p>
                            </button>
                            <div className="flex items-center gap-3">
                                {isOwner && (
                                    <>
                                        {viewsCount > 0 && (
                                            <button onClick={() => setIsViewsModalOpen(true)} className="text-white p-2 rounded-full hover:bg-white/10 flex items-center gap-1.5 text-xs font-medium backdrop-blur-sm bg-black/20" aria-label={`${viewsCount} ${viewsCount === 1 ? t('pulseViewer.viewSingular') : t('pulseViewer.viewPlural')}`}>
                                                <EyeIcon className="w-4 h-4" />{viewsCount}
                                            </button>
                                        )}
                                         <button onClick={() => setIsAddToMemoryOpen(true)} className="text-white p-2 rounded-full hover:bg-white/20 transition-colors" title={t('post.addToMemory')}>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                        </button>
                                        <button onClick={() => setIsDeleteConfirmOpen(true)} className="text-white p-2 rounded-full hover:bg-white/20 transition-colors" aria-label={t('pulseViewer.delete')}>
                                            <TrashIcon className="w-6 h-6" />
                                        </button>
                                    </>
                                )}
                                <button onClick={onClose} className="text-white p-1 hover:text-gray-300 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                   
                    <div key={currentPulse.id} className={`relative w-full h-full rounded-2xl overflow-hidden flex items-center justify-center bg-zinc-900 shadow-2xl border border-white/5 ${slideDirection === 'next' ? 'pulse-card-enter-next' : ''} ${slideDirection === 'prev' ? 'pulse-card-enter-prev' : ''}`}>
                        <div className="absolute top-0 left-0 w-1/3 h-full z-20 cursor-pointer" onClick={goToPrev}></div>
                        <div className="absolute top-0 right-0 w-1/3 h-full z-20 cursor-pointer" onClick={goToNext}></div>

                        {currentPulse.mediaUrl.includes('.mp4') || currentPulse.mediaUrl.includes('.webm') ? (
                            <video 
                                src={currentPulse.mediaUrl} controls autoPlay 
                                muted={isGlobalMuted} // SINCRONIZADO GLOBALMENTE
                                className="w-full h-full object-contain" 
                            />
                        ) : <img src={currentPulse.mediaUrl} alt={currentPulse.legenda || 'Pulse'} className="w-full h-full object-contain" />}

                        {currentPulse.musicInfo && currentPulse.showMusicCover && (
                            <div className="absolute z-10 pointer-events-none" style={{ left: `${currentPulse.musicCoverPosition?.x || 50}%`, top: `${currentPulse.musicCoverPosition?.y || 50}%`, transform: 'translate(-50%, -50%)' }}>
                                <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl border border-white/30 shadow-lg flex flex-col items-center gap-2 w-32 animate-pulse-slow">
                                    <img src={currentPulse.musicInfo.capa} alt="Album Art" className="w-28 h-28 rounded-lg shadow-sm" />
                                    <div className="text-center w-full"><p className="text-white text-xs font-bold truncate w-full">{currentPulse.musicInfo.nome}</p><p className="text-white/80 text-[10px] truncate w-full">{currentPulse.musicInfo.artista}</p></div>
                                </div>
                            </div>
                        )}

                        {(currentPulse.legenda || currentPulse.musicInfo) && (
                            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20 pointer-events-none">
                                {currentPulse.musicInfo && (
                                    <div className="mb-3 text-white pointer-events-auto">
                                        <MusicPlayer musicInfo={currentPulse.musicInfo} isPlaying={true} isMuted={isMusicMuted} setIsMuted={setIsMusicMuted} />
                                    </div>
                                )}
                                {currentPulse.legenda && <p className="text-white text-center text-md font-medium drop-shadow-lg">{currentPulse.legenda}</p>}
                            </div>
                        )}
                    </div>
                </div>

                {canGoNext && (
                    <button onClick={goToNext} className="absolute right-2 md:right-8 text-white bg-white/10 backdrop-blur-md rounded-full p-3 z-30 hover:bg-white/20 transition-all active:scale-95" aria-label={t('pulseViewer.next')}>
                        <NextIcon className="w-6 h-6" />
                    </button>
                )}
            </div>
            
            {isDeleteConfirmOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60]">
                    <div className="bg-white dark:bg-black rounded-lg shadow-xl p-6 w-full max-w-sm text-center border dark:border-zinc-800">
                        <h3 className="text-lg font-semibold mb-2">{t('pulseViewer.deleteTitle')}</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t('pulseViewer.deleteBody')}</p>
                        <div className="flex flex-col gap-2">
                            <button onClick={handleDelete} disabled={isDeleting} className="w-full px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold disabled:opacity-50">{isDeleting ? t('common.deleting') : t('common.delete')}</button>
                            <button onClick={() => setIsDeleteConfirmOpen(false)} className="w-full px-4 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold">{t('common.cancel')}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default PulseViewerModal;
