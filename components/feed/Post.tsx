
import React, { useState, useRef, useEffect } from 'react';
import { auth, db, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, storage, storageRef, deleteObject, collection, query, orderBy, onSnapshot, serverTimestamp } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';
import { useTimeAgo } from '../../hooks/useTimeAgo';

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
};

const Post: React.FC<{ post: PostType; onPostDeleted: (id: string) => void }> = ({ post, onPostDeleted }) => {
    const { t } = useLanguage();
    const { isGlobalMuted } = useCall();
    const { formatTimestamp } = useTimeAgo();
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const media = post.media || [{ url: post.imageUrl, type: 'image' }];
    const isLiked = post.likes.includes(auth.currentUser?.uid || '');

    const handleLike = async () => {
        if (!auth.currentUser) return;
        const ref = doc(db, 'posts', post.id);
        await updateDoc(ref, { likes: isLiked ? arrayRemove(auth.currentUser.uid) : arrayUnion(auth.currentUser.uid) });
    };

    const handleDelete = async () => {
        if (confirm(t('post.deletePostBody'))) {
            await deleteDoc(doc(db, 'posts', post.id));
            onPostDeleted(post.id);
        }
    };

    return (
        <article className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="flex items-center p-3">
                <img src={post.userAvatar} className="w-8 h-8 rounded-full object-cover" alt={post.username} />
                <span className="font-semibold text-sm ml-3">{post.username}</span>
                {auth.currentUser?.uid === post.userId && (
                    <button onClick={handleDelete} className="ml-auto text-red-500 text-xs font-bold">{t('post.delete')}</button>
                )}
            </div>

            <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-900 group">
                {media[currentMediaIndex].type === 'video' ? (
                    <video src={media[currentMediaIndex].url} loop autoPlay muted={isGlobalMuted} playsInline className="w-full h-full object-cover" />
                ) : (
                    <img src={media[currentMediaIndex].url} className="w-full h-full object-cover" alt="Post" />
                )}

                {media.length > 1 && (
                    <>
                        {currentMediaIndex > 0 && (
                            <button onClick={() => setCurrentMediaIndex(i => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                        )}
                        {currentMediaIndex < media.length - 1 && (
                            <button onClick={() => setCurrentMediaIndex(i => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                            </button>
                        )}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                            {media.map((_, i) => (
                                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === currentMediaIndex ? 'bg-sky-500' : 'bg-white/50'}`} />
                            ))}
                        </div>
                    </>
                )}
            </div>

            <div className="p-4">
                <div className="flex gap-4 mb-2">
                    <button onClick={handleLike}>
                        <svg className={`w-6 h-6 ${isLiked ? 'text-red-500 fill-current' : 'text-zinc-800 dark:text-zinc-200'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    </button>
                </div>
                <p className="text-sm"><strong>{post.username}</strong> {post.caption}</p>
                <p className="text-[10px] text-zinc-400 mt-2 uppercase">{formatTimestamp(post.timestamp)}</p>
            </div>
        </article>
    );
};

export default Post;
