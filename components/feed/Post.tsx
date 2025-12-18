
import React, { useState, useRef, useEffect } from 'react';
import { auth, db, doc, updateDoc, arrayUnion, arrayRemove, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, getDoc } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';
import { useTimeAgo } from '../../hooks/useTimeAgo';
import MusicPlayer from './MusicPlayer';

type PostType = {
    id: string;
    userId: string;
    username: string;
    userAvatar: string;
    type?: 'status' | 'media';
    text?: string;
    bgColor?: string;
    font?: string;
    imageUrl?: string; 
    media?: { url: string, type: 'image' | 'video' }[];
    caption?: string;
    likes: string[];
    reposts?: string[];
    timestamp: any;
    musicInfo?: {
      nome: string;
      artista: string;
      capa: string;
      preview: string;
      startTime?: number;
    };
    duoPartner?: { userId: string; username: string; userAvatar: string; };
    tags?: { userId: string; username: string }[];
};

interface PostProps {
    post: PostType;
    isActive?: boolean;
    onPostDeleted: (id: string) => void;
    onForward?: (post: PostType) => void;
    onEditCaption?: (post: PostType) => void;
    onEditMusic?: (post: PostType) => void;
    onInviteDuo?: (post: PostType) => void;
    onManageTags?: (post: PostType) => void;
}

const FONT_FAMILIES: Record<string, string> = {
    classic: 'sans-serif',
    modern: 'serif',
    neon: 'cursive',
    strong: 'Impact, sans-serif'
};

const RepostIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
);

const Post: React.FC<PostProps> = ({ 
    post, 
    isActive = true,
    onPostDeleted, 
    onForward, 
    onEditCaption, 
    onEditMusic, 
    onInviteDuo,
    onManageTags 
}) => {
    const { t } = useLanguage();
    const { isGlobalMuted, setGlobalMuted } = useCall();
    const { formatTimestamp } = useTimeAgo();
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const [comments, setComments] = useState<any[]>([]);
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [isLiked, setIsLiked] = useState(post.likes.includes(auth.currentUser?.uid || ''));
    const [isReposted, setIsReposted] = useState(post.reposts?.includes(auth.currentUser?.uid || '') || false);
    
    const [reposterData, setReposterData] = useState<{username: string, avatar: string, isMe: boolean} | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    const media = post.media || (post.imageUrl ? [{ url: post.imageUrl, type: 'image' as const }] : []);
    const isStatusPost = post.type === 'status' || (!post.imageUrl && !post.media);
    const currentUser = auth.currentUser;
    const videoRef = useRef<HTMLVideoElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!media[currentMediaIndex] || media[currentMediaIndex].type !== 'video' || !videoRef.current) return;
        if (isActive) { videoRef.current.play().catch(() => {}); } else { videoRef.current.pause(); }
    }, [isActive, currentMediaIndex, media]);

    useEffect(() => {
        const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('timestamp', 'asc'));
        return onSnapshot(q, (snap) => {
            setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    }, [post.id]);

    useEffect(() => {
        if (!currentUser || !post.reposts || post.reposts.length === 0) {
            setReposterData(null);
            return;
        }

        const fetchReposter = async () => {
            if (post.reposts?.includes(currentUser.uid)) {
                setReposterData({ username: t('common.you'), avatar: currentUser.photoURL || '', isMe: true });
                return;
            }

            try {
                const followingRef = collection(db, 'users', currentUser.uid, 'following');
                const followingSnap = await getDocs(followingRef);
                const followingIds = followingSnap.docs.map(d => d.id);
                
                const followedReposterId = post.reposts?.find(id => followingIds.includes(id));
                if (followedReposterId) {
                    const userSnap = await getDoc(doc(db, 'users', followedReposterId));
                    if (userSnap.exists()) {
                        const data = userSnap.data();
                        setReposterData({ username: data.username, avatar: data.avatar, isMe: false });
                    }
                } else {
                    setReposterData(null);
                }
            } catch (e) {
                setReposterData(null);
            }
        };

        fetchReposter();
    }, [post.reposts, currentUser, t]);

    const handleLike = async () => {
        if (!currentUser) return;
        const ref = doc(db, 'posts', post.id);
        const newLiked = !isLiked;
        setIsLiked(newLiked);
        await updateDoc(ref, { likes: newLiked ? arrayUnion(currentUser.uid) : arrayRemove(currentUser.uid) });
    };

    const handleRepost = async () => {
        if (!currentUser) return;
        const ref = doc(db, 'posts', post.id);
        const newStatus = !isReposted;
        setIsReposted(newStatus);
        await updateDoc(ref, { reposts: newStatus ? arrayUnion(currentUser.uid) : arrayRemove(currentUser.uid) });
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !currentUser) return;
        await addDoc(collection(db, 'posts', post.id, 'comments'), {
            userId: currentUser.uid,
            username: currentUser.displayName,
            text: newComment,
            timestamp: serverTimestamp()
        });
        setNewComment('');
    };

    const isAuthor = currentUser?.uid === post.userId;

    return (
        <article className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm mb-4 lg:max-w-xl mx-auto transition-all">
            {reposterData && (
                <div className="px-3 py-2 border-b dark:border-zinc-800 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900/40 animate-fade-in">
                    <div className="relative">
                        <img src={reposterData.avatar} className="w-5 h-5 rounded-full object-cover border border-zinc-200 dark:border-zinc-700" />
                        <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5 scale-75">
                             <RepostIcon className="w-2 h-2 text-white" />
                        </div>
                    </div>
                    <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                        {reposterData.isMe ? t('post.youRepublicated') : t('post.republishedBy', { username: reposterData.username })}
                    </span>
                </div>
            )}

            <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                    <img src={post.userAvatar} className="w-8 h-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-800" />
                    <div className="flex flex-col">
                        <span className="font-bold text-xs">{post.username}</span>
                        {post.tags && post.tags.length > 0 && <span className="text-[10px] text-zinc-500">com {post.tags.map(t => t.username).join(', ')}</span>}
                    </div>
                </div>

                {isAuthor && (
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.5"></circle><circle cx="6" cy="12" r="1.5"></circle><circle cx="18" cy="12" r="1.5"></circle></svg>
                        </button>
                        {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden py-1">
                                {!isStatusPost && <button onClick={() => { onEditCaption?.(post); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">{post.caption ? t('post.editCaption') : t('post.addCaption')}</button>}
                                <button onClick={() => { onEditMusic?.(post); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">{post.musicInfo ? t('post.changeMusic') : t('post.addMusic')}</button>
                                <button onClick={() => { setShowDeleteConfirm(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-semibold">{t('common.delete')}</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isStatusPost ? (
                <div className={`aspect-square w-full bg-gradient-to-br ${post.bgColor || 'from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-black'} flex flex-col items-center justify-center p-10 text-center`}>
                    <p className="text-white text-3xl font-bold break-words leading-tight" style={{ fontFamily: FONT_FAMILIES[post.font || 'classic'] }}>{post.text}</p>
                </div>
            ) : (
                <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-900">
                    {media[currentMediaIndex].type === 'video' ? (
                        <video ref={videoRef} src={media[currentMediaIndex].url} loop muted={isGlobalMuted} playsInline className="w-full h-full object-cover" />
                    ) : (
                        <img src={media[currentMediaIndex].url} className="w-full h-full object-cover" />
                    )}
                    {media.length > 1 && (
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1">
                            {media.map((_, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === currentMediaIndex ? 'bg-sky-500' : 'bg-white/50'}`} />)}
                        </div>
                    )}
                </div>
            )}

            {post.musicInfo && (
                <div className="border-t dark:border-zinc-800">
                    <MusicPlayer musicInfo={post.musicInfo} isPlaying={isActive} isMuted={isGlobalMuted} setIsMuted={setGlobalMuted} />
                </div>
            )}

            <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex gap-4">
                        <button onClick={handleLike} className="transition-transform active:scale-125">
                            <svg className={`w-7 h-7 ${isLiked ? 'text-red-500 fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        </button>
                        <button onClick={() => setShowComments(!showComments)} className="hover:opacity-60">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        </button>
                        <button onClick={handleRepost} className={`transition-all active:scale-125 ${isReposted ? 'text-green-500' : 'text-zinc-900 dark:text-white'}`}>
                            <RepostIcon className="w-7 h-7" />
                        </button>
                        <button onClick={() => onForward?.(post)} className="hover:opacity-60">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </button>
                    </div>
                </div>

                <div className="text-sm">
                    <p className="font-bold mb-1">{post.likes.length} {t('post.likes')}</p>
                    {!isStatusPost && post.caption && <p><span className="font-bold mr-2">{post.username}</span>{post.caption}</p>}
                    <button onClick={() => setShowComments(true)} className="text-zinc-500 text-xs mt-2">
                        {t('post.viewAllComments', { count: comments.length })}
                    </button>
                </div>
            </div>
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl w-full max-w-xs text-center border dark:border-zinc-800 shadow-2xl">
                        <h3 className="font-bold mb-2">{t('post.deletePostTitle')}</h3>
                        <p className="text-zinc-500 text-xs mb-6">{t('post.deletePostBody')}</p>
                        <div className="flex flex-col gap-2">
                            <button onClick={async () => { onPostDeleted(post.id); setShowDeleteConfirm(false); }} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl">Excluir</button>
                            <button onClick={() => setShowDeleteConfirm(false)} className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-white font-bold rounded-xl">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </article>
    );
};

export default Post;
