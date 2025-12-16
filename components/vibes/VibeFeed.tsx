
import React, { useState, useEffect, useRef } from 'react';
import { db, collection, query, orderBy, getDocs, limit, doc, updateDoc, arrayUnion, arrayRemove, getDoc, where, addDoc, serverTimestamp, deleteDoc, storage, storageRef, deleteObject, setDoc, writeBatch, onSnapshot } from '../../firebase';
import { auth } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
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
}> = ({ isOpen, onClose, vibeId }) => {
    const { t } = useLanguage();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
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
        if (!newComment.trim() || !currentUser) return;

        try {
            // Get current user details properly
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            const userData = userDoc.data();

            await addDoc(collection(db, 'vibes', vibeId, 'comments'), {
                userId: currentUser.uid,
                username: userData?.username || currentUser.displayName,
                userAvatar: userData?.avatar || currentUser.photoURL,
                text: newComment.trim(),
                timestamp: serverTimestamp()
            });
            
            // Update comment count on parent doc (could be done via cloud function triggers ideally)
            const vibeRef = doc(db, 'vibes', vibeId);
            const vibeDoc = await getDoc(vibeRef);
            if (vibeDoc.exists()) {
                await updateDoc(vibeRef, { commentsCount: (vibeDoc.data().commentsCount || 0) + 1 });
            }

            setNewComment('');
        } catch (error) {
            console.error("Error posting comment:", error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 top-1/3 bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col shadow-[0_-4px_20px_rgba(0,0,0,0.5)] animate-slide-up">
            <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="font-semibold text-lg">{t('vibe.comments')}</h3>
                <button onClick={onClose} className="text-2xl">&times;</button>
            </div>
            <div className="flex-grow overflow-y-auto p-4">
                {comments.length === 0 ? (
                    <p className="text-center text-zinc-500 mt-8">{t('vibe.noComments')}</p>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className="flex gap-3 mb-4">
                            <img src={comment.userAvatar} alt={comment.username} className="w-8 h-8 rounded-full object-cover" />
                            <div>
                                <p className="text-sm font-semibold">{comment.username}</p>
                                <p className="text-sm text-zinc-700 dark:text-zinc-300">{comment.text}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
                <input
                    type="text"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder={t('vibe.addComment')}
                    className="flex-grow bg-zinc-100 dark:bg-zinc-800 rounded-full px-4 py-2 outline-none"
                />
                <button type="submit" disabled={!newComment.trim()} className="text-sky-500 font-semibold disabled:opacity-50">Post</button>
            </form>
        </div>
    );
};

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
            // Ensure conversation exists
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

            // Send message
            await addDoc(collection(conversationRef, 'messages'), {
                senderId: currentUser.uid,
                text: `${t('vibe.forwarded')}: ${vibe.videoUrl}`, // Simple text fallback for now, or implement a rich message type
                mediaUrl: vibe.videoUrl,
                mediaType: 'video', // Treat as video message
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
            // Try Native Share with File first (Mobile experience for Status/Direct)
            if (navigator.share && navigator.canShare) {
                 const response = await fetch(vibe.videoUrl);
                 const blob = await response.blob();
                 const file = new File([blob], `vibe_${vibe.id}.mp4`, { type: 'video/mp4' });
                 
                 if (navigator.canShare({ files: [file] })) {
                     await navigator.share({
                         files: [file],
                         text: vibe.caption || 'Confira essa Vibe!'
                     });
                     onClose();
                     return;
                 }
            }
            throw new Error("Native file share not supported");
        } catch (e) {
            console.log("Fallback to Link Share:", e);
            // Fallback to Link Share via Intent
            const text = `Confira essa Vibe: ${vibe.videoUrl}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
            onClose();
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
                
                {/* External Share */}
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

                {/* Internal Share */}
                <h4 className="text-sm font-semibold mb-2">{t('vibe.sendTo')}</h4>
                <input
                    type="text"
                    placeholder={t('header.searchPlaceholder')}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-sm mb-2"
                />
                <div className="flex-grow overflow-y-auto">
                    {loading ? <p className="text-center text-sm text-zinc-500">...</p> : (
                        filteredFollowing.map(user => (
                            <button key={user.id} onClick={() => handleInternalShare(user.id, user.username, user.avatar)} className="w-full flex items-center gap-3 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                                <img src={user.avatar} className="w-10 h-10 rounded-full object-cover" alt={user.username} />
                                <span className="font-semibold text-sm">{user.username}</span>
                                <span className="ml-auto bg-sky-500 text-white text-xs px-3 py-1 rounded-full">{t('messages.send')}</span>
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
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLiked, setIsLiked] = useState(vibe.likes.includes(auth.currentUser?.uid || ''));
    const [likesCount, setLikesCount] = useState(vibe.likes.length);
    const currentUser = auth.currentUser;

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
            <video
                ref={videoRef}
                src={vibe.videoUrl}
                className="w-full h-full object-cover"
                loop
                playsInline
                onClick={togglePlay}
            />

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
                
                <div className="flex flex-col items-center cursor-pointer" onClick={(e) => { e.stopPropagation(); onOpenComments(); }}>
                    <CommentIcon />
                    <span className="text-white text-xs font-semibold drop-shadow-md">{vibe.commentsCount}</span>
                </div>
                
                <div className="flex flex-col items-center cursor-pointer" onClick={(e) => { e.stopPropagation(); onOpenShare(); }}>
                    <ShareIcon />
                    <span className="text-white text-xs font-semibold drop-shadow-md">{t('vibe.share')}</span>
                </div>

                {currentUser?.uid === vibe.userId && (
                    <div className="flex flex-col items-center cursor-pointer" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                        <TrashIcon className="w-8 h-8 text-white drop-shadow-md" />
                    </div>
                )}
            </div>

            {/* Bottom Info */}
            <div className="absolute left-4 bottom-4 right-16 z-10 text-white">
                <h3 className="font-bold text-lg drop-shadow-md mb-1">@{vibe.user?.username}</h3>
                <p className="text-sm drop-shadow-md break-words">{vibe.caption}</p>
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
        </div>
    );
};

const VibeFeed: React.FC = () => {
    const { t } = useLanguage();
    const [vibes, setVibes] = useState<VibeType[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeVibeIndex, setActiveVibeIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Modal States
    const [commentsVibeId, setCommentsVibeId] = useState<string | null>(null);
    const [shareVibe, setShareVibe] = useState<VibeType | null>(null);
    const [deleteVibe, setDeleteVibe] = useState<VibeType | null>(null);

    useEffect(() => {
        const fetchVibes = async () => {
            try {
                const q = query(collection(db, 'vibes'), orderBy('createdAt', 'desc'), limit(20));
                const snapshot = await getDocs(q);
                
                const vibesData = await Promise.all(snapshot.docs.map(async (docSnap) => {
                    const data = docSnap.data();
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

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const index = Math.round(container.scrollTop / container.clientHeight);
            if (index !== activeVibeIndex) {
                setActiveVibeIndex(index);
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [activeVibeIndex]);

    const handleDelete = async () => {
        if (!deleteVibe) return;
        try {
            // Delete from Firestore
            await deleteDoc(doc(db, 'vibes', deleteVibe.id));
            
            // Delete from Storage
            // Extract path from URL (simple heuristic for Firebase Storage URLs)
            try {
                const url = new URL(deleteVibe.videoUrl);
                // Standard Firebase format: .../o/path%2Fto%2Ffile?alt=...
                const path = decodeURIComponent(url.pathname.split('/o/')[1]);
                const mediaRef = storageRef(storage, path);
                await deleteObject(mediaRef);
            } catch (e) {
                console.warn("Could not determine storage path from URL or file already gone", e);
            }

            setVibes(prev => prev.filter(v => v.id !== deleteVibe.id));
            setDeleteVibe(null);
        } catch (error) {
            console.error("Error deleting vibe:", error);
        }
    };

    if (loading) {
        return <div className="h-screen w-full bg-black flex items-center justify-center text-white">Carregando Vibes...</div>;
    }

    if (vibes.length === 0) {
        return <div className="h-screen w-full bg-black flex items-center justify-center text-white">Nenhuma Vibe encontrada.</div>;
    }

    return (
        <>
            <div 
                ref={containerRef}
                className="h-[calc(100vh-4rem)] w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar bg-black"
            >
                {vibes.map((vibe, index) => (
                    <div key={vibe.id} className="h-full w-full snap-start">
                        <VibeItem 
                            vibe={vibe} 
                            isActive={index === activeVibeIndex} 
                            onOpenComments={() => setCommentsVibeId(vibe.id)}
                            onOpenShare={() => setShareVibe(vibe)}
                            onDelete={() => setDeleteVibe(vibe)}
                        />
                    </div>
                ))}
            </div>

            {/* Modals */}
            {commentsVibeId && (
                <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setCommentsVibeId(null)}>
                    <VibeCommentsModal isOpen={true} onClose={() => setCommentsVibeId(null)} vibeId={commentsVibeId} />
                </div>
            )}

            {shareVibe && (
                <ShareVibeModal isOpen={true} onClose={() => setShareVibe(null)} vibe={shareVibe} />
            )}

            {deleteVibe && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={() => setDeleteVibe(null)}>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl max-w-sm w-full mx-4 text-center" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-2">{t('vibe.deleteTitle')}</h3>
                        <p className="text-zinc-500 mb-6">{t('vibe.deleteBody')}</p>
                        <div className="flex gap-4 justify-center">
                            <Button onClick={() => setDeleteVibe(null)} className="!bg-zinc-200 dark:!bg-zinc-700 !text-black dark:!text-white">{t('common.cancel')}</Button>
                            <Button onClick={handleDelete} className="!bg-red-500 text-white">{t('common.delete')}</Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default VibeFeed;
