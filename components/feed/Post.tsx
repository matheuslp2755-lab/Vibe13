
import React, { useState, useRef, useEffect } from 'react';
import { auth, db, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, storage, storageRef, deleteObject, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDoc } from '../../firebase';
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
    const { isGlobalMuted, setGlobalMuted } = useCall();
    const { formatTimestamp } = useTimeAgo();
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const media = post.media || [{ url: post.imageUrl, type: 'image' }];
    const isLiked = post.likes.includes(auth.currentUser?.uid || '');
    const videoRef = useRef<HTMLVideoElement>(null);
    const currentUser = auth.currentUser;

    const handleLike = async () => {
        if (!currentUser) return;
        const ref = doc(db, 'posts', post.id);
        await updateDoc(ref, { 
            likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) 
        });
    };

    const handleDelete = async () => {
        if (confirm(t('post.deletePostBody'))) {
            try {
                await deleteDoc(doc(db, 'posts', post.id));
                onPostDeleted(post.id);
            } catch (e) { console.error(e); }
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        setGlobalMuted(!isGlobalMuted);
    };

    return (
        <article className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm">
            <div className="flex items-center p-3">
                <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-yellow-400 to-pink-500">
                    <img src={post.userAvatar} className="w-8 h-8 rounded-full border border-white dark:border-black object-cover" alt={post.username} />
                </div>
                <span className="font-bold text-sm ml-3 hover:underline cursor-pointer">{post.username}</span>
                {currentUser?.uid === post.userId && (
                    <button onClick={handleDelete} className="ml-auto text-zinc-400 hover:text-red-500 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                )}
            </div>

            <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-900 group select-none">
                {media[currentMediaIndex].type === 'video' ? (
                    <div className="relative w-full h-full">
                        <video 
                            ref={videoRef}
                            src={media[currentMediaIndex].url} 
                            loop 
                            autoPlay 
                            muted={isGlobalMuted} 
                            playsInline 
                            className="w-full h-full object-cover" 
                        />
                        <button 
                            onClick={toggleMute}
                            className="absolute bottom-4 right-4 bg-black/50 p-2 rounded-full text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            {isGlobalMuted ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H4.5c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h2.93l4.18 4.12c.56.4 1.19.69 1.89.82.63.12 1.25-.33 1.25-.97v-3.87l4.73 4.73c-.57.44-1.22.8-1.94 1.05v2.09c1.28-.32 2.44-.92 3.42-1.74l1.46 1.46 1.27-1.27L4.27 3zM11.5 5.55L9.36 7.69 11.5 9.83V5.55z"/></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M13.5 4.06c-.7.13-1.33.42-1.89.82L7.43 9H4.5c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h2.93l4.18 4.12c.56.4 1.19.69 1.89.82.63.12 1.25-.33 1.25-.97V5.03c0-.64-.62-1.09-1.25-.97zM19 12c0-1.72-.77-3.25-2-4.29v8.58c1.23-1.04 2-2.57 2-4.29zM17 2.11c2.85 1.15 5 3.96 5 7.89s-2.15 6.74-5 7.89v-2.1c1.72-.89 3-2.69 3-4.79s-1.28-3.9-3-4.79V2.11z"/></svg>
                            )}
                        </button>
                    </div>
                ) : (
                    <img src={media[currentMediaIndex].url} className="w-full h-full object-cover" alt="Post" />
                )}

                {media.length > 1 && (
                    <>
                        {currentMediaIndex > 0 && (
                            <button onClick={() => setCurrentMediaIndex(i => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/70 dark:bg-black/50 text-black dark:text-white rounded-full p-1.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                        )}
                        {currentMediaIndex < media.length - 1 && (
                            <button onClick={() => setCurrentMediaIndex(i => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/70 dark:bg-black/50 text-black dark:text-white rounded-full p-1.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                            </button>
                        )}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {media.map((_, i) => (
                                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentMediaIndex ? 'bg-sky-500 scale-125' : 'bg-white/60'}`} />
                            ))}
                        </div>
                        <div className="absolute top-4 right-4 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                            {currentMediaIndex + 1}/{media.length}
                        </div>
                    </>
                )}
            </div>

            <div className="p-4">
                <div className="flex gap-4 mb-3">
                    <button onClick={handleLike} className="transition-transform active:scale-125">
                        <svg className={`w-7 h-7 ${isLiked ? 'text-red-500 fill-current' : 'text-zinc-800 dark:text-zinc-200'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    </button>
                    <button className="hover:opacity-60 transition-opacity">
                        <svg className="w-7 h-7 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </button>
                    <button className="hover:opacity-60 transition-opacity">
                        <svg className="w-7 h-7 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                </div>
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-bold">{post.likes.length.toLocaleString()} curtidas</p>
                    <p className="text-sm leading-relaxed">
                        <span className="font-bold mr-2">{post.username}</span> 
                        {post.caption}
                    </p>
                </div>
                <p className="text-[10px] text-zinc-400 mt-2 uppercase font-semibold tracking-wider">{formatTimestamp(post.timestamp)}</p>
            </div>
        </article>
    );
};

export default Post;
