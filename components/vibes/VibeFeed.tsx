
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

type Comment = {
    id: string;
    userId: string;
    username: string;
    userAvatar: string;
    text: string;
    timestamp: any;
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

const PulseCommentsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    pulseId: string;
    vibeAuthorId: string;
}> = ({ isOpen, onClose, pulseId, vibeAuthorId }) => {
    const { t } = useLanguage();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!isOpen) return;
        const q = query(collection(db, 'vibes', pulseId, 'comments'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
        });
        return () => unsubscribe();
    }, [isOpen, pulseId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !currentUser || isPosting) return;
        setIsPosting(true);
        try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            const userData = userDoc.data();
            await addDoc(collection(db, 'vibes', pulseId, 'comments'), {
                userId: currentUser.uid,
                username: userData?.username || currentUser.displayName,
                userAvatar: userData?.avatar || currentUser.photoURL,
                text: newComment.trim(),
                timestamp: serverTimestamp()
            });
            await updateDoc(doc(db, 'vibes', pulseId), { commentsCount: increment(1) });
            setNewComment('');
        } catch (error) { console.error(error); } finally { setIsPosting(false); }
    };

    const handleDeleteComment = async (commentId: string) => {
        try {
            await deleteDoc(doc(db, 'vibes', pulseId, 'comments', commentId));
            await updateDoc(doc(db, 'vibes', pulseId), { commentsCount: increment(-1) });
        } catch (error) { console.error(error); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col justify-end" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 rounded-t-2xl h-2/3 flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-zinc-800">
                    <h3 className="font-semibold">{t('vibe.comments')}</h3>
                    <button onClick={onClose} className="text-2xl font-light">&times;</button>
                </div>
                <div className="flex-grow overflow-y-auto p-4 space-y-4">
                    {comments.map(comment => (
                        <div key={comment.id} className="flex gap-3 items-start group">
                            <img src={comment.userAvatar} className="w-8 h-8 rounded-full object-cover" />
                            <div className="flex-grow">
                                <p className="text-sm font-bold">{comment.username}</p>
                                <p className="text-sm text-zinc-700 dark:text-zinc-300">{comment.text}</p>
                            </div>
                            {(currentUser?.uid === comment.userId || currentUser?.uid === vibeAuthorId) && (
                                <button onClick={() => handleDeleteComment(comment.id)} className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <form onSubmit={handleSubmit} className="p-4 border-t dark:border-zinc-800 flex gap-3">
                    <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder={t('vibe.addComment')} className="flex-grow bg-zinc-100 dark:bg-zinc-800 rounded-full px-4 py-2 text-sm outline-none" />
                    <button type="submit" disabled={!newComment.trim() || isPosting} className="text-sky-500 font-bold text-sm">Post</button>
                </form>
            </div>
        </div>
    );
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
            video.currentTime = 0; // Reseta o vídeo imediatamente ao sair
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

            {/* Ações da Direita */}
            <div className="absolute right-4 bottom-20 flex flex-col gap-6 items-center z-30">
                <img src={pulse.user?.avatar} className="w-11 h-11 rounded-full border-2 border-white shadow-lg" />
                
                <div className="flex flex-col items-center cursor-pointer" onClick={handleLike}>
                    <HeartIcon filled={isLiked} />
                    <span className="text-white text-xs font-bold drop-shadow-md">{likesCount}</span>
                </div>
                
                <div className="flex flex-col items-center cursor-pointer" onClick={onOpenComments}>
                    <CommentIcon />
                    <span className="text-white text-xs font-bold drop-shadow-md">{pulse.commentsCount}</span>
                </div>

                {currentUser?.uid === pulse.userId && (
                    <div className="cursor-pointer" onClick={onDelete}>
                        <TrashIcon className="w-7 h-7 text-white/80 drop-shadow-md" />
                    </div>
                )}
            </div>

            {/* Info do Autor */}
            <div className="absolute left-4 bottom-8 z-30 text-white pointer-events-none pr-16">
                <h3 className="font-bold text-base drop-shadow-md">@{pulse.user?.username}</h3>
                <p className="text-sm drop-shadow-md break-words line-clamp-3">{pulse.caption}</p>
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-10"></div>
        </div>
    );
};

const VibeFeed: React.FC = () => {
    const { t } = useLanguage();
    const [pulses, setPulses] = useState<PulseType[]>([]);
    const [loading, setLoading] = useState(true);
    const [activePulseIndex, setActivePulseIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [commentsPulseId, setCommentsPulseId] = useState<{id: string, authorId: string} | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'vibes'), orderBy('createdAt', 'desc'), limit(20));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const pulsesData = await Promise.all(snapshot.docs.map(async (docSnap) => {
                const data = docSnap.data();
                let userData = { username: '...', avatar: '' };
                const userDoc = await getDoc(doc(db, 'users', data.userId));
                if (userDoc.exists()) userData = { username: userDoc.data().username, avatar: userDoc.data().avatar };
                return { id: docSnap.id, ...data, user: userData } as PulseType;
            }));
            setPulses(pulsesData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const index = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
        if (index !== activePulseIndex) {
            setActivePulseIndex(index);
        }
    };

    if (loading) return <div className="h-full w-full bg-black flex items-center justify-center text-white">Carregando Pulses...</div>;

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
                            isActive={index === activePulseIndex && !commentsPulseId} 
                            onOpenComments={() => setCommentsPulseId({id: pulse.id, authorId: pulse.userId})}
                            onDelete={() => { /* Implementar confirmacao simples se necessário */ }}
                        />
                    </div>
                ))}
            </div>

            {commentsPulseId && (
                <PulseCommentsModal 
                    isOpen={true} 
                    onClose={() => setCommentsPulseId(null)} 
                    pulseId={commentsPulseId.id}
                    vibeAuthorId={commentsPulseId.authorId}
                />
            )}
        </div>
    );
};

export default VibeFeed;
