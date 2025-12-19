
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
    commentsDisabled?: boolean;
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
    const [isAnonymousComment, setIsAnonymousComment] = useState(false);
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

    // Verificar se já existe um comentário anônimo nesta postagem
    const hasAnonymousComment = comments.some(c => c.isAnonymous);

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
                }
            } catch (e) { setReposterData(null); }
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

    const toggleComments = async () => {
        if (!isAuthor) return;
        const ref = doc(db, 'posts', post.id);
        await updateDoc(ref, { commentsDisabled: !post.commentsDisabled });
        setIsMenuOpen(false);
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !currentUser || post.commentsDisabled) return;

        if (isAnonymousComment && hasAnonymousComment) {
            alert(t('post.anonymousCommentTaken'));
            return;
        }

        await addDoc(collection(db, 'posts', post.id, 'comments'), {
            userId: isAnonymousComment ? 'anon' : currentUser.uid,
            username: isAnonymousComment ? t('post.vibeAnon') : currentUser.displayName,
            avatar: isAnonymousComment ? 'https://firebasestorage.googleapis.com/v0/b/teste-rede-fcb99.appspot.com/o/avatars%2Fdefault%2Favatar.png?alt=media' : currentUser.photoURL,
            text: newComment,
            isAnonymous: isAnonymousComment,
            timestamp: serverTimestamp()
        });
        
        setNewComment('');
        setIsAnonymousComment(false);
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
                            <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden py-1">
                                {!isStatusPost && <button onClick={() => { onEditCaption?.(post); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">{post.caption ? t('post.editCaption') : t('post.addCaption')}</button>}
                                <button onClick={() => { onEditMusic?.(post); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">{post.musicInfo ? t('post.changeMusic') : t('post.addMusic')}</button>
                                <button onClick={toggleComments} className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                    {post.commentsDisabled ? t('post.enableComments') : t('post.disableComments')}
                                </button>
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
                    {media[currentMediaIndex]?.type === 'video' ? (
                        <video ref={videoRef} src={media[currentMediaIndex].url} loop muted={isGlobalMuted} playsInline className="w-full h-full object-cover" />
                    ) : (
                        <img src={media[currentMediaIndex]?.url} className="w-full h-full object-cover" />
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
                        {!post.commentsDisabled && (
                            <button onClick={() => setShowComments(!showComments)} className="hover:opacity-60">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            </button>
                        )}
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
                    
                    {post.commentsDisabled ? (
                        <p className="text-zinc-400 text-xs italic mt-2">{t('post.commentsDisabled')}</p>
                    ) : (
                        <>
                            <div className="mt-2 space-y-1">
                                {comments.slice(-2).map(c => (
                                    <p key={c.id} className="text-xs">
                                        <span className={`font-bold mr-2 ${c.isAnonymous ? 'text-purple-500' : ''}`}>
                                            {c.username}
                                        </span>
                                        {c.text}
                                    </p>
                                ))}
                            </div>

                            <button onClick={() => setShowComments(true)} className="text-zinc-500 text-xs mt-2">
                                {t('post.viewAllComments', { count: comments.length })}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Modal de Comentários */}
            {showComments && !post.commentsDisabled && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-end md:items-center justify-center p-0 md:p-10 animate-fade-in" onClick={() => setShowComments(false)}>
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-3xl md:rounded-3xl h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <header className="p-4 border-b dark:border-zinc-800 text-center font-bold relative">
                            {t('post.comment')}
                            <button onClick={() => setShowComments(false)} className="absolute right-4 top-4 text-zinc-400 text-3xl font-light">&times;</button>
                        </header>
                        <div className="flex-grow overflow-y-auto p-4 space-y-4 no-scrollbar">
                            {comments.map(c => (
                                <div key={c.id} className="flex gap-3 items-start animate-slide-up">
                                    <img src={c.avatar || 'https://firebasestorage.googleapis.com/v0/b/teste-rede-fcb99.appspot.com/o/avatars%2Fdefault%2Favatar.png?alt=media'} className={`w-8 h-8 rounded-full object-cover border ${c.isAnonymous ? 'border-purple-500 p-0.5' : 'border-zinc-100 dark:border-zinc-800'}`} />
                                    <div className="flex-grow">
                                        <p className="text-xs font-bold mb-0.5">
                                            {c.username}
                                            {c.isAnonymous && <span className="ml-2 text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full uppercase font-black">Anônimo</span>}
                                        </p>
                                        <p className="text-sm font-medium">{c.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleAddComment} className="p-4 border-t dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                            <div className="flex items-center gap-3 mb-3">
                                <button 
                                    type="button"
                                    onClick={() => { if(!hasAnonymousComment) setIsAnonymousComment(!isAnonymousComment); }}
                                    disabled={hasAnonymousComment}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isAnonymousComment ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'} ${hasAnonymousComment ? 'opacity-40 cursor-not-allowed grayscale' : 'hover:scale-105 active:scale-95'}`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8.002v3.996a1 1 0 001.555.832l3.197-1.998a1 1 0 000-1.664l-3.197-1.998z" /></svg>
                                    {t('post.anonymousComment')}
                                </button>
                                {hasAnonymousComment && <span className="text-[9px] font-black text-zinc-400 italic">Limite atingido</span>}
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    value={newComment} 
                                    onChange={e => setNewComment(e.target.value)} 
                                    className="flex-grow bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-sky-500/20 shadow-inner"
                                    placeholder={t('post.addComment')}
                                />
                                <button type="submit" disabled={!newComment.trim()} className="text-sky-500 font-black text-sm px-3 disabled:opacity-50 hover:scale-110 active:scale-90 transition-transform">
                                    {t('post.postButton')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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
