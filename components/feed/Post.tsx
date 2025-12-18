
import React, { useState, useRef, useEffect } from 'react';
import { auth, db, doc, updateDoc, arrayUnion, arrayRemove, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';
import { useTimeAgo } from '../../hooks/useTimeAgo';
import MusicPlayer from './MusicPlayer';

type PostType = {
    id: string;
    userId: string;
    username: string;
    userAvatar: string;
    imageUrl: string; 
    media?: { url: string, type: 'image' | 'video' }[];
    caption: string;
    likes: string[];
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
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    const media = post.media || [{ url: post.imageUrl, type: 'image' }];
    const currentUser = auth.currentUser;
    const videoRef = useRef<HTMLVideoElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Controle de reprodução de vídeo baseado na prop isActive
    useEffect(() => {
        if (media[currentMediaIndex].type !== 'video' || !videoRef.current) return;
        
        if (isActive) {
            videoRef.current.play().catch(() => {});
        } else {
            videoRef.current.pause();
        }
    }, [isActive, currentMediaIndex, media]);

    useEffect(() => {
        const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('timestamp', 'asc'));
        return onSnapshot(q, (snap) => {
            setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    }, [post.id]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLike = async () => {
        if (!currentUser) return;
        const ref = doc(db, 'posts', post.id);
        setIsLiked(!isLiked);
        await updateDoc(ref, { 
            likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) 
        });
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
        <article className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm mb-4 lg:max-w-xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                    <div className="relative flex">
                        <img src={post.userAvatar} className="w-8 h-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-800" />
                        {post.duoPartner && (
                            <img src={post.duoPartner.userAvatar} className="w-8 h-8 rounded-full object-cover -ml-3 border-2 border-white dark:border-black shadow-sm" />
                        )}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-xs">
                            {post.username} {post.duoPartner && `& ${post.duoPartner.username}`}
                        </span>
                        {post.tags && post.tags.length > 0 && (
                            <span className="text-[10px] text-zinc-500">
                                {t('post.with')} {post.tags.map(t => t.username).join(', ')}
                            </span>
                        )}
                    </div>
                </div>

                {isAuthor && (
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.5"></circle><circle cx="6" cy="12" r="1.5"></circle><circle cx="18" cy="12" r="1.5"></circle></svg>
                        </button>
                        {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden py-1">
                                <button onClick={() => { onEditCaption?.(post); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">{post.caption ? t('post.editCaption') : t('post.addCaption')}</button>
                                <button onClick={() => { onEditMusic?.(post); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">{post.musicInfo ? t('post.changeMusic') : t('post.addMusic')}</button>
                                <button onClick={() => { onInviteDuo?.(post); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">{post.duoPartner ? t('post.changeDuo') : t('post.inviteDuo')}</button>
                                <button onClick={() => { onManageTags?.(post); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">{t('post.tagFriends')}</button>
                                <div className="border-t dark:border-zinc-800 my-1"></div>
                                <button onClick={() => { setShowDeleteConfirm(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-semibold">{t('common.delete')}</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Media Carousel */}
            <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-900 group">
                {media[currentMediaIndex].type === 'video' ? (
                    <video 
                        ref={videoRef}
                        src={media[currentMediaIndex].url} 
                        loop 
                        muted={isGlobalMuted} 
                        playsInline 
                        className="w-full h-full object-cover" 
                    />
                ) : (
                    <img src={media[currentMediaIndex].url} className="w-full h-full object-cover" />
                )}

                {media.length > 1 && (
                    <>
                        <button onClick={() => setCurrentMediaIndex(i => Math.max(0, i - 1))} className={`absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 p-1.5 rounded-full shadow-md z-10 ${currentMediaIndex === 0 ? 'hidden' : ''}`}>
                            <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7"/></svg>
                        </button>
                        <button onClick={() => setCurrentMediaIndex(i => Math.min(media.length - 1, i + 1))} className={`absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 p-1.5 rounded-full shadow-md z-10 ${currentMediaIndex === media.length - 1 ? 'hidden' : ''}`}>
                            <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7"/></svg>
                        </button>
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1 z-10">
                            {media.map((_, i) => (
                                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === currentMediaIndex ? 'bg-sky-500' : 'bg-white/50'}`} />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Music Info - Só toca se isActive for true */}
            {post.musicInfo && (
                <div className="border-t dark:border-zinc-800">
                    <MusicPlayer musicInfo={post.musicInfo} isPlaying={isActive} isMuted={isGlobalMuted} setIsMuted={setGlobalMuted} />
                </div>
            )}

            {/* Actions */}
            <div className="p-3">
                <div className="flex gap-4 mb-2">
                    <button onClick={handleLike} className="transition-transform active:scale-125">
                        <svg className={`w-7 h-7 ${isLiked ? 'text-red-500 fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    </button>
                    <button onClick={() => setShowComments(!showComments)} className="hover:opacity-60">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </button>
                    <button onClick={() => onForward && onForward(post)} className="hover:opacity-60">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                </div>

                <div className="text-sm">
                    <p className="font-bold mb-1">{post.likes.length} {t('post.likes')}</p>
                    {post.caption && <p><span className="font-bold mr-2">{post.username}</span>{post.caption}</p>}
                    
                    {comments.length > 0 && !showComments && (
                        <button onClick={() => setShowComments(true)} className="text-zinc-500 text-xs mt-2">
                            {t('post.viewAllComments', { count: comments.length })}
                        </button>
                    )}
                </div>

                {/* Comments Section */}
                {showComments && (
                    <div className="mt-4 space-y-2 max-h-40 overflow-y-auto border-t dark:border-zinc-800 pt-2">
                        {comments.map(c => (
                            <p key={c.id} className="text-sm"><span className="font-bold mr-2">{c.username}</span>{c.text}</p>
                        ))}
                    </div>
                )}

                <form onSubmit={handleAddComment} className="mt-3 flex gap-2 border-t dark:border-zinc-800 pt-3">
                    <input 
                        type="text" 
                        value={newComment} 
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={t('post.addComment')} 
                        className="flex-grow bg-transparent text-sm outline-none" 
                    />
                    <button type="submit" disabled={!newComment.trim()} className="text-sky-500 font-bold text-sm disabled:opacity-50">{t('post.postButton')}</button>
                </form>
                
                <p className="text-[10px] text-zinc-400 mt-2 uppercase">{formatTimestamp(post.timestamp)}</p>
            </div>

            {/* Custom Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl w-full max-w-xs text-center border dark:border-zinc-800">
                        <h3 className="font-bold mb-2">{t('post.deletePostTitle')}</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t('post.deletePostBody')}</p>
                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={() => { onPostDeleted(post.id); setShowDeleteConfirm(false); }} 
                                className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
                            >
                                {t('common.delete')}
                            </button>
                            <button 
                                onClick={() => setShowDeleteConfirm(false)} 
                                className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-white font-bold rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </article>
    );
};

export default Post;
