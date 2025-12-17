
import React, { useState, useEffect, useRef } from 'react';
import { auth, db, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, storage, storageRef, deleteObject, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, getDocs, limit, writeBatch, getDoc, setDoc } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';
import { useTimeAgo } from '../../hooks/useTimeAgo';
import PostViewsModal from '../post/PostViewsModal';
import MusicPlayer from './MusicPlayer';
import Button from '../common/Button';
import AddCaptionModal from '../post/AddCaptionModal';
import AddMusicModal from '../post/AddMusicModal';
import AddToMemoryModal from '../post/AddToMemoryModal';
import CreateMemoryModal from '../profile/CreateMemoryModal';

type PostType = {
    id: string;
    userId: string;
    username: string;
    userAvatar: string;
    imageUrl: string; 
    mediaType?: 'image' | 'video';
    caption: string;
    likes: string[];
    timestamp: { seconds: number; nanoseconds: number };
    musicInfo?: {
      nome: string;
      artista: string;
      capa: string;
      preview: string;
      startTime?: number;
    };
    isVentMode?: boolean;
    allowedUsers?: string[];
    duoPartner?: { userId: string; username: string; userAvatar: string; };
    pendingDuoPartner?: { userId: string; username: string; userAvatar: string; };
};

type CommentType = {
    id: string;
    userId: string;
    username: string;
    text: string;
    timestamp: { seconds: number; nanoseconds: number };
}

const LikeIcon: React.FC<{className?: string, isLiked: boolean, title: string}> = ({ className, isLiked, title }) => (
  <svg aria-label={title} className={className} fill={isLiked ? '#ef4444' : 'currentColor'} height="24" role="img" viewBox="0 0 24 24" width="24"><title>{title}</title><path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-6.12 8.351C12.89 20.72 12.434 21 12 21s-.89-.28-1.38-.627C7.152 14.08 4.5 12.192 4.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.118-1.763a4.21 4.21 0 0 1 3.675-1.941Z"></path></svg>
);
const CommentIcon: React.FC<{className?: string, title: string}> = ({ className, title }) => (
    <svg aria-label={title} className={className} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>{title}</title><path d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></path></svg>
);
const ShareIcon: React.FC<{className?: string, title: string}> = ({ className, title }) => (
  <svg aria-label={title} className={className} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>{title}</title><line fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" x1="22" x2="9.218" y1="3" y2="10.083"></line><polygon fill="none" points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></polygon></svg>
);
const MoreIcon: React.FC<{className?: string, title: string}> = ({ className, title }) => (
    <svg aria-label={title} className={className} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>{title}</title><circle cx="12" cy="12" r="1.5"></circle><circle cx="6" cy="12" r="1.5"></circle><circle cx="18" cy="12" r="1.5"></circle></svg>
);

interface PostProps {
  post: PostType;
  onPostDeleted: (postId: string) => void;
  playingMusicPostId: string | null;
  setPlayingMusicPostId: (postId: string | null) => void;
  isMusicMuted: boolean;
  setIsMusicMuted: (isMuted: boolean) => void;
}

const Post: React.FC<PostProps> = ({ post, onPostDeleted, playingMusicPostId, setPlayingMusicPostId, isMusicMuted, setIsMusicMuted }) => {
  const currentUser = auth.currentUser;
  const { t } = useLanguage();
  const { isGlobalMuted, setGlobalMuted } = useCall();
  const { formatTimestamp } = useTimeAgo();
  const [postData, setPostData] = useState<PostType>(post);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes.length);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isViewsModalOpen, setIsViewsModalOpen] = useState(false);
  const [viewsCount, setViewsCount] = useState(0);
  const postRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isAddCaptionModalOpen, setIsAddCaptionModalOpen] = useState(false);
  const [isAddMusicModalOpen, setIsAddMusicModalOpen] = useState(false);
  const [isAddToMemoryOpen, setIsAddToMemoryOpen] = useState(false);
  const [isCreateMemoryOpen, setIsCreateMemoryOpen] = useState(false);
  const [initialContentForMemory, setInitialContentForMemory] = useState<any>(null);
  const [playCount, setPlayCount] = useState(0);

  const isVideo = postData.mediaType === 'video' || postData.imageUrl.includes('.mp4') || postData.imageUrl.includes('.webm');

  useEffect(() => { setPostData(post); setLikesCount(post.likes.length); }, [post]);
  useEffect(() => { if (currentUser) setIsLiked(postData.likes.includes(currentUser.uid)); }, [postData.likes, currentUser]);
  useEffect(() => {
    const q = query(collection(db, 'posts', postData.id, 'comments'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommentType)));
    });
    return () => unsubscribe();
  }, [postData.id]);
  
  useEffect(() => {
    if (!isVideo || !videoRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
            videoRef.current?.play().catch(console.warn);
        } else {
            videoRef.current?.pause();
        }
    }, { threshold: 0.6 });
    observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, [isVideo]);

  const handleLikeToggle = async () => {
    if (!currentUser) return;
    const postDocRef = doc(db, 'posts', postData.id);
    const originalIsLiked = isLiked;
    const originalLikes = [...postData.likes];
    const newLikes = originalIsLiked ? postData.likes.filter(uid => uid !== currentUser.uid) : [...postData.likes, currentUser.uid];
    setIsLiked(!originalIsLiked); setLikesCount(newLikes.length);
    setPostData(prev => ({ ...prev, likes: newLikes }));
    try {
        if (originalIsLiked) await updateDoc(postDocRef, { likes: arrayRemove(currentUser.uid) });
        else await updateDoc(postDocRef, { likes: arrayUnion(currentUser.uid) });
    } catch (error) { setIsLiked(originalIsLiked); setLikesCount(originalLikes.length); setPostData(prev => ({ ...prev, likes: originalLikes })); }
  };

  const handleDelete = async () => {
    if (currentUser?.uid !== postData.userId) return;
    setIsDeleting(true);
    try {
        const imagePath = decodeURIComponent(postData.imageUrl.split('/o/')[1].split('?')[0]);
        await deleteDoc(doc(db, 'posts', postData.id));
        await deleteObject(storageRef(storage, imagePath));
        onPostDeleted(postData.id);
    } catch (error) { console.error(error); } finally { setIsDeleting(false); setIsDeleteConfirmOpen(false); }
  };

  const handleCommentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser || newComment.trim() === '') return;
    const commentText = newComment.trim();
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) throw new Error("User not found");
        const currentUsername = userDoc.data().username;
        await addDoc(collection(db, 'posts', postData.id, 'comments'), {
            text: commentText,
            userId: currentUser.uid,
            username: currentUsername,
            timestamp: serverTimestamp()
        });
        setNewComment('');
    } catch (error) { console.error(error); }
  };

  const toggleMute = () => {
      setGlobalMuted(!isGlobalMuted);
  };

  return (
    <>
        <article ref={postRef} className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg">
        <div className="flex items-center p-3">
            <img src={postData.userAvatar} alt={postData.username} className="w-8 h-8 rounded-full object-cover" />
            <span className="font-semibold text-sm ml-3">{postData.username}</span>
            {currentUser?.uid === postData.userId && (
                 <div className="ml-auto relative">
                    <button onClick={() => setIsOptionsOpen(prev => !prev)}>
                        <MoreIcon className="w-6 h-6" title={t('post.moreOptions')} />
                    </button>
                    {isOptionsOpen && (
                         <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-950 rounded-md shadow-lg border dark:border-zinc-800 z-10 py-1">
                            <button onClick={() => { setIsDeleteConfirmOpen(true); setIsOptionsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-900">{t('post.delete')}</button>
                        </div>
                    )}
                 </div>
            )}
        </div>
        
        <div className="relative group">
            {isVideo ? (
                <video 
                    ref={videoRef} src={postData.imageUrl} loop
                    muted={isGlobalMuted}
                    playsInline className="w-full object-cover max-h-[600px]" 
                />
            ) : <img src={postData.imageUrl} alt="Post content" className="w-full object-cover" />}
            
            {isVideo && (
                <button 
                    onClick={toggleMute}
                    className="absolute bottom-4 right-4 bg-black/50 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    {isGlobalMuted ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H4.5c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h2.93l4.18 4.12c.56.4 1.19.69 1.89.82.63.12 1.25-.33 1.25-.97v-3.87l4.73 4.73c-.57.44-1.22.8-1.94 1.05v2.09c1.28-.32 2.44-.92 3.42-1.74l1.46 1.46 1.27-1.27L4.27 3zM11.5 5.55L9.36 7.69 11.5 9.83V5.55z"/></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 4.06c-.7.13-1.33.42-1.89.82L7.43 9H4.5c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h2.93l4.18 4.12c.56.4 1.19.69 1.89.82.63.12 1.25-.33 1.25-.97V5.03c0-.64-.62-1.09-1.25-.97zM19 12c0-1.72-.77-3.25-2-4.29v8.58c1.23-1.04 2-2.57 2-4.29zM17 2.11c2.85 1.15 5 3.96 5 7.89s-2.15 6.74-5 7.89v-2.1c1.72-.89 3-2.69 3-4.79s-1.28-3.9-3-4.79V2.11z"/></svg>
                    )}
                </button>
            )}
        </div>
        
        {postData.musicInfo && (
            <div className="bg-zinc-50 dark:bg-zinc-950 border-y border-zinc-200 dark:border-zinc-800">
                <MusicPlayer musicInfo={postData.musicInfo} isPlaying={playingMusicPostId === postData.id} isMuted={isMusicMuted} setIsMuted={setIsMusicMuted} />
            </div>
        )}

        <div className="p-4">
            <div className="flex items-center gap-4 mb-2">
                <button onClick={handleLikeToggle}>
                    <LikeIcon title={t('post.like')} className={`w-6 h-6 hover:opacity-70 transition-opacity ${isLiked ? 'text-red-500' : 'dark:text-white'}`} isLiked={isLiked} />
                </button>
                <button><CommentIcon title={t('post.comment')} className="w-6 h-6 hover:text-zinc-500 dark:hover:text-zinc-400" /></button>
                <button><ShareIcon title={t('post.forward')} className="w-6 h-6 hover:text-zinc-500 dark:hover:text-zinc-400" /></button>
            </div>
            <div className="text-sm space-y-1">
                <div className="font-semibold">{likesCount.toLocaleString()} {t('post.likes')}</div>
                {postData.caption && <p><span className="font-semibold mr-2">{postData.username}</span>{postData.caption}</p>}
                {comments.slice(0, 2).map(comment => (
                    <p key={comment.id}><span className="font-semibold mr-2">{comment.username}</span>{comment.text}</p>
                ))}
            </div>
            {comments.length > 2 && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">{t('post.viewAllComments', { count: comments.length })}</p>}
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase mt-2">{formatTimestamp(postData.timestamp)}</p>
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-2">
            <form onSubmit={handleCommentSubmit} className="flex items-center">
                <input type="text" placeholder={t('post.addComment')} value={newComment} onChange={(e) => setNewComment(e.target.value)} className="w-full bg-transparent border-none focus:outline-none text-sm" />
                <button type="submit" className="text-sky-500 font-semibold text-sm disabled:opacity-50" disabled={!newComment.trim()}>{t('post.postButton')}</button>
            </form>
        </div>
        </article>
        {isDeleteConfirmOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                <div className="bg-white dark:bg-black rounded-lg shadow-xl p-6 w-full max-w-sm text-center border dark:border-zinc-800">
                    <h3 className="text-lg font-semibold mb-2">{t('post.deletePostTitle')}</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t('post.deletePostBody')}</p>
                    <div className="flex flex-col gap-2">
                         <button onClick={handleDelete} disabled={isDeleting} className="w-full px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold disabled:opacity-50">{isDeleting ? t('post.deleting') : t('post.delete')}</button>
                        <button onClick={() => setIsDeleteConfirmOpen(false)} className="w-full px-4 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold">{t('common.cancel')}</button>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

export default Post;
