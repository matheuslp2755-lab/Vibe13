
import React, { useState, useEffect, useRef } from 'react';
import { db, collection, query, orderBy, getDocs, limit, doc, updateDoc, arrayUnion, arrayRemove, getDoc, where, addDoc, serverTimestamp, deleteDoc, storage, storageRef, deleteObject, setDoc, writeBatch, onSnapshot, increment } from '../../firebase';
import { auth } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';
import Button from '../common/Button';

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

type Comment = {
    id: string;
    userId: string;
    username: string;
    userAvatar: string;
    text: string;
    timestamp: any;
};

type Follower = {
    id: string;
    username: string;
    avatar: string;
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

const TrashIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const VolumeOnIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.5 4.06c-.7.13-1.33.42-1.89.82L7.43 9H4.5c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h2.93l4.18 4.12c.56.4 1.19.69 1.89.82.63.12 1.25-.33 1.25-.97V5.03c0-.64-.62-1.09-1.25-.97zM19 12c0-1.72-.77-3.25-2-4.29v8.58c1.23-1.04 2-2.57 2-4.29zM17 2.11c2.85 1.15 5 3.96 5 7.89s-2.15 6.74-5 7.89v-2.1c1.72-.89 3-2.69 3-4.79s-1.28-3.9-3-4.79V2.11z"/>
    </svg>
);

const VolumeOffIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H4.5c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h2.93l4.18 4.12c.56.4 1.19.69 1.89.82.63.12 1.25-.33 1.25-.97v-3.87l4.73 4.73c-.57.44-1.22.8-1.94 1.05v2.09c1.28-.32 2.44-.92 3.42-1.74l1.46 1.46 1.27-1.27L4.27 3zM11.5 5.55L9.36 7.69 11.5 9.83V5.55z"/>
    </svg>
);

const Spinner: React.FC = () => (
    <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// --- Modals ---

const VibeCommentsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    vibeId: string;
    vibeAuthorId: string;
}> = ({ isOpen, onClose, vibeId, vibeAuthorId }) => {
    const { t } = useLanguage();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!isOpen) return;
        const q = query(collection(db, 'vibes', vibeId, 'comments'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
        });
        return () => unsubscribe();
    }, [isOpen, vibeId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !currentUser || isPosting) return;

        setIsPosting(true);
        try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            const userData = userDoc.data();

            await addDoc(collection(db, 'vibes', vibeId, 'comments'), {
                userId: currentUser.uid,
                username: userData?.username || currentUser.displayName || t('common.user'),
                userAvatar: userData?.avatar || currentUser.photoURL || 'https://i.pravatar.cc/150',
                text: newComment.trim(),
                timestamp: serverTimestamp()
            });
            
            const vibeRef = doc(db, 'vibes', vibeId);
            await updateDoc(vibeRef, { commentsCount: increment(1) });

            setNewComment('');
        } catch (error) {
            console.error("Error posting comment:", error);
        } finally {
            setIsPosting(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        try {
            await deleteDoc(doc(db, 'vibes', vibeId, 'comments', commentId));
            const vibeRef = doc(db, 'vibes', vibeId);
            await updateDoc(vibeRef, { commentsCount: increment(-1) });
        } catch (error) {
            console.error("Error deleting comment:", error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col justify-end" onClick={onClose}>
            <div 
                className="bg-white dark:bg-zinc-900 rounded-t-2xl h-2/3 flex flex-col shadow-[0_-4px_20px_rgba(0,0,0,0.5)] animate-slide-up"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-semibold text-lg">{t('vibe.comments')}</h3>
                    <button onClick={onClose} className="text-2xl font-light">&times;</button>
                </div>
                <div className="flex-grow overflow-y-auto p-4">
                    {comments.length === 0 ? (
                        <p className="text-center text-zinc-500 mt-8">{t('vibe.noComments')}</p>
                    ) : (
                        comments.map(comment => (
                            <div key={comment.id} className="flex gap-3 mb-6 items-start group">
                                <img src={comment.userAvatar} alt={comment.username} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                <div className="flex-grow">
                                    <p className="text-sm font-bold text-zinc-900 dark:text-white">
                                        {comment.username}
                                    </p>
                                    <p className="text-sm text-zinc-700 dark:text-zinc-300 break-words leading-relaxed">
                                        {comment.text}
                                    </p>
                                </div>
                                {(currentUser?.uid === comment.userId || currentUser?.uid === vibeAuthorId) && (
                                    <button 
                                        onClick={() => handleDeleteComment(comment.id)}
                                        className="text-zinc-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
                <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-3 bg-white dark:bg-zinc-900 pb-safe">
                    <img 
                        src={currentUser?.photoURL || 'https://i.pravatar.cc/150'} 
                        className="w-8 h-8 rounded-full object-cover" 
                        alt="My profile" 
                    />
                    <input
                        type="text"
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder={t('vibe.addComment')}
                        className="flex-grow bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500 transition-shadow"
                    />
                    <button 
                        type="submit" 
                        disabled={!newComment.trim() || isPosting} 
                        className="text-sky-500 font-bold text-sm disabled:opacity-50 px-2"
                    >
                        {isPosting ? <Spinner /> : t('post.postButton')}
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- ShareVibeModal ---

const ShareVibeModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    vibe: VibeType;
}> = ({ isOpen, onClose, vibe }) => {
    const { t } = useLanguage();
    const currentUser = auth.currentUser;
    const [following, setFollowing] = useState<Follower[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSharing, setIsSharing] = useState(false);

    useEffect(() => {
        if (!isOpen || !currentUser) return;
        const fetchFollowing = async () => {
            setLoading(true);
            try {
                const followingRef = collection(db, 'users', currentUser.uid, 'following');
                const snapshot = await getDocs(followingRef);
                const followingData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Follower));
                setFollowing(followingData);
            } catch (error) {
                console.error("Error fetching following:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchFollowing();
    }, [isOpen, currentUser]);

    const handleInternalShare = async (userId: string, username: string, avatar: string) => {
        if (!currentUser) return;
        const conversationId = [currentUser.uid, userId].sort().join('_');
        const conversationRef = doc(db, 'conversations', conversationId);

        try {
            const conversationSnap = await getDoc(conversationRef);
            if (!conversationSnap.exists()) {
                await setDoc(conversationRef, {
                    participants: [currentUser.uid, userId],
                    participantInfo: {
                        [currentUser.uid]: { username: currentUser.displayName, avatar: currentUser.photoURL },
                        [userId]: { username, avatar }
                    },
                    timestamp: serverTimestamp()
                });
            }

            await addDoc(collection(conversationRef, 'messages'), {
                senderId: currentUser.uid,
                text: `${t('vibe.forwarded')}: ${vibe.videoUrl}`,
                mediaUrl: vibe.videoUrl,
                mediaType: 'video',
                timestamp: serverTimestamp()
            });

            await updateDoc(conversationRef, {
                lastMessage: {
                    senderId: currentUser.uid,
                    text: t('vibe.forwarded'),
                    timestamp: serverTimestamp(),
                    mediaType: 'video'
                },
                timestamp: serverTimestamp()
            });
            onClose();
        } catch (error) {
            console.error("Share failed", error);
        }
    };

    const handleWhatsAppShare = async () => {
        setIsSharing(true);
        try {
            if (navigator.share) {
                 const text = `Confira essa Vibe no VibeApp: ${vibe.videoUrl}`;
                 await navigator.share({
                     title: 'Vibe',
                     text: vibe.caption || 'Olha essa Vibe!',
                     url: vibe.videoUrl
                 });
                 onClose();
            } else {
                 const text = `Confira essa Vibe: ${vibe.videoUrl}`;
                 window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
            }
        } catch (e) {
            console.log("Share failed:", e);
        } finally {
            setIsSharing(false);
        }
    };

    const filteredFollowing = following.filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center sm:items-center" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 w-full max-w-sm sm:rounded-xl rounded-t-xl p-4 flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4 text-center">{t('vibe.share')}</h3>
                
                <div className="flex justify-around mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                    <button onClick={handleWhatsAppShare} disabled={isSharing} className="flex flex-col items-center gap-1 disabled:opacity-50">
                        <div className="w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center text-white">
                            {isSharing ? <Spinner /> : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                            )}
                        </div>
                        <span className="text-xs text-center">{t('vibe.whatsapp')}</span>
                    </button>
                </div>

                <h4 className="text-sm font-semibold mb-2">{t('vibe.sendTo')}</h4>
                <input
                    type="text"
                    placeholder={t('header.searchPlaceholder')}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-sm mb-2 outline-none focus:ring-1 focus:ring-sky-500"
                />
                <div className="flex-grow overflow-y-auto min-h-[150px]">
                    {loading ? <div className="p-4 flex justify-center"><Spinner /></div> : (
                        filteredFollowing.map(user => (
                            <button key={user.id} onClick={() => handleInternalShare(user.id, user.username, user.avatar)} className="w-full flex items-center gap-3 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                                <img src={user.avatar} className="w-10 h-10 rounded-full object-cover" alt={user.username} />
                                <span className="font-semibold text-sm flex-grow text-left">{user.username}</span>
                                <span className="bg-sky-500 text-white text-xs px-3 py-1 rounded-full">{t('messages.send')}</span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Main VibeItem Component ---

const VibeItem: React.FC<{ 
    vibe: VibeType; 
    isActive: boolean;
    onOpenComments: () => void;
    onOpenShare: () => void;
    onDelete: () => void;
}> = ({ vibe, isActive, onOpenComments, onOpenShare, onDelete }) => {
    const { t } = useLanguage();
    const { isGlobalMuted, setGlobalMuted } = useCall();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLiked, setIsLiked] = useState(vibe.likes.includes(auth.currentUser?.uid || ''));
    const [likesCount, setLikesCount] = useState(vibe.likes.length);
    const currentUser = auth.currentUser;

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isActive) {
            video.currentTime = 0;
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    setIsPlaying(true);
                }).catch(error => {
                    console.log("Autoplay impedido ou vídeo pausado manualmente:", error);
                    setIsPlaying(false);
                });
            }
        } else {
            video.pause();
            video.currentTime = 0; // Opcional: resetar ao sair
            setIsPlaying(false);
        }
    }, [isActive]);

    useEffect(() => {
        setIsLiked(vibe.likes.includes(auth.currentUser?.uid || ''));
        setLikesCount(vibe.likes.length);
    }, [vibe.likes]);

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;

        if (isPlaying) {
            video.pause();
            setIsPlaying(false);
        } else {
            video.play()
                .then(() => setIsPlaying(true))
                .catch(console.error);
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        setGlobalMuted(!isGlobalMuted);
    };

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!auth.currentUser) return;

        const userId = auth.currentUser.uid;
        const vibeRef = doc(db, 'vibes', vibe.id);
        
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
            <video
                ref={videoRef}
                src={vibe.videoUrl}
                className="w-full h-full object-contain"
                loop
                playsInline
                muted={isGlobalMuted}
                onClick={togglePlay}
            />

            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <svg className="w-20 h-20 text-white/50" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </div>
            )}

            {/* Audio Toggle */}
            <button 
                onClick={toggleMute}
                className="absolute left-4 top-4 z-30 p-2 bg-black/40 rounded-full text-white backdrop-blur-sm"
            >
                {isGlobalMuted ? <VolumeOffIcon className="w-6 h-6" /> : <VolumeOnIcon className="w-6 h-6" />}
            </button>

            {/* Right Side Actions */}
            <div className="absolute right-4 bottom-20 flex flex-col gap-6 items-center z-30">
                <div className="flex flex-col items-center mb-2">
                    <div className="w-11 h-11 rounded-full border-2 border-white overflow-hidden shadow-lg">
                        <img src={vibe.user?.avatar || 'https://i.pravatar.cc/150'} alt={vibe.user?.username} className="w-full h-full object-cover" />
                    </div>
                </div>
                
                <div className="flex flex-col items-center cursor-pointer group" onClick={handleLike}>
                    <div className="group-active:scale-125 transition-transform duration-100">
                        <HeartIcon filled={isLiked} />
                    </div>
                    <span className="text-white text-xs font-bold drop-shadow-md mt-1">{likesCount}</span>
                </div>
                
                <div className="flex flex-col items-center cursor-pointer" onClick={(e) => { e.stopPropagation(); onOpenComments(); }}>
                    <CommentIcon />
                    <span className="text-white text-xs font-bold drop-shadow-md mt-1">{vibe.commentsCount}</span>
                </div>
                
                <div className="flex flex-col items-center cursor-pointer" onClick={(e) => { e.stopPropagation(); onOpenShare(); }}>
                    <ShareIcon />
                </div>

                {currentUser?.uid === vibe.userId && (
                    <div className="flex flex-col items-center cursor-pointer mt-2" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                        <TrashIcon className="w-7 h-7 text-white/80 drop-shadow-md hover:text-red-500 transition-colors" />
                    </div>
                )}
            </div>

            {/* Bottom Info */}
            <div className="absolute left-4 bottom-4 right-20 z-30 text-white pointer-events-none select-none">
                <h3 className="font-bold text-base drop-shadow-md mb-1">@{vibe.user?.username}</h3>
                <p className="text-sm drop-shadow-md break-words line-clamp-3 leading-tight">{vibe.caption}</p>
            </div>
            
            {/* Overlay Gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/70 to-transparent pointer-events-none z-10"></div>
        </div>
    );
};

// --- Main VibeFeed Container ---

const VibeFeed: React.FC = () => {
    const { t } = useLanguage();
    const [vibes, setVibes] = useState<VibeType[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeVibeIndex, setActiveVibeIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Modal States
    const [commentsVibe, setCommentsVibe] = useState<{id: string, authorId: string} | null>(null);
    const [shareVibe, setShareVibe] = useState<VibeType | null>(null);
    const [deleteVibe, setDeleteVibe] = useState<VibeType | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'vibes'), orderBy('createdAt', 'desc'), limit(20));
        
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const vibesData = await Promise.all(snapshot.docs.map(async (docSnap) => {
                const data = docSnap.data();
                let userData = { username: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
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
            setLoading(false);
        }, (error) => {
            console.error("Error listening to vibes:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const index = Math.round(container.scrollTop / container.clientHeight);
            if (index !== activeVibeIndex) {
                setActiveVibeIndex(index);
            }
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [activeVibeIndex]);

    const handleDelete = async () => {
        if (!deleteVibe) return;
        try {
            await deleteDoc(doc(db, 'vibes', deleteVibe.id));
            
            try {
                const url = new URL(deleteVibe.videoUrl);
                const path = decodeURIComponent(url.pathname.split('/o/')[1]);
                const mediaRef = storageRef(storage, path);
                await deleteObject(mediaRef);
            } catch (e) {
                console.warn("Media deletion from storage skipped/failed", e);
            }

            setDeleteVibe(null);
        } catch (error) {
            console.error("Error deleting vibe:", error);
        }
    };

    if (loading) {
        return (
            <div className="h-[calc(100vh-8rem)] w-full bg-black flex flex-col items-center justify-center text-white">
                <Spinner />
                <p className="mt-4 text-zinc-400">Carregando Vibes...</p>
            </div>
        );
    }

    if (vibes.length === 0) {
        return (
            <div className="h-[calc(100vh-8rem)] w-full bg-black flex items-center justify-center text-zinc-500 text-center p-8">
                Nenhuma Vibe disponível no momento.<br/>Seja o primeiro a postar!
            </div>
        );
    }

    return (
        <div className="relative h-[calc(100vh-8rem)] bg-black overflow-hidden">
            <div 
                ref={containerRef}
                className="h-full w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
                style={{ scrollSnapType: 'y mandatory' }}
            >
                {vibes.map((vibe, index) => (
                    <div key={vibe.id} className="h-full w-full snap-start">
                        <VibeItem 
                            vibe={vibe} 
                            isActive={index === activeVibeIndex && !commentsVibe && !shareVibe && !deleteVibe} 
                            onOpenComments={() => setCommentsVibe({ id: vibe.id, authorId: vibe.userId })}
                            onOpenShare={() => setShareVibe(vibe)}
                            onDelete={() => setDeleteVibe(vibe)}
                        />
                    </div>
                ))}
            </div>

            {/* Modals */}
            {commentsVibe && (
                <VibeCommentsModal 
                    isOpen={true} 
                    onClose={() => setCommentsVibe(null)} 
                    vibeId={commentsVibe.id}
                    vibeAuthorId={commentsVibe.authorId}
                />
            )}

            {shareVibe && (
                <ShareVibeModal 
                    isOpen={true} 
                    onClose={() => setShareVibe(null)} 
                    vibe={shareVibe} 
                />
            )}

            {deleteVibe && (
                <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center" onClick={() => setDeleteVibe(null)}>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl max-w-xs w-full mx-4 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-2 text-zinc-900 dark:text-white">{t('vibe.deleteTitle')}</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">{t('vibe.deleteBody')}</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteVibe(null)} 
                                className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg font-semibold"
                            >
                                {t('common.cancel')}
                            </button>
                            <button 
                                onClick={handleDelete} 
                                className="flex-1 py-2 bg-red-500 text-white rounded-lg font-semibold"
                            >
                                {t('common.delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VibeFeed;
