
import React, { useState, useEffect } from 'react';
import { auth, db, collection, getDocs, query, where, doc, getDoc, setDoc, addDoc, serverTimestamp, updateDoc } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import TextInput from '../common/TextInput';
import Button from '../common/Button';

interface ForwardModalProps {
    isOpen: boolean;
    onClose: () => void;
    post: any;
    onShareToPulse?: (content: any) => void;
}

const ForwardModal: React.FC<ForwardModalProps> = ({ isOpen, onClose, post, onShareToPulse }) => {
    const { t } = useLanguage();
    const [following, setFollowing] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [sendingTo, setSendingTo] = useState<string[]>([]); // Lista de IDs já enviados nesta sessão
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!isOpen || !currentUser) return;

        const fetchFollowing = async () => {
            setLoading(true);
            try {
                const followingRef = collection(db, 'users', currentUser.uid, 'following');
                const snap = await getDocs(followingRef);
                const followingData = await Promise.all(snap.docs.map(async d => {
                    const userSnap = await getDoc(doc(db, 'users', d.id));
                    return { id: d.id, ...userSnap.data() };
                }));
                setFollowing(followingData);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchFollowing();
    }, [isOpen, currentUser]);

    const handleForward = async (targetUser: any) => {
        if (!currentUser || !post || sendingTo.includes(targetUser.id)) return;

        const conversationId = [currentUser.uid, targetUser.id].sort().join('_');
        const conversationRef = doc(db, 'conversations', conversationId);
        
        try {
            // Garantir que a conversa existe
            const convSnap = await getDoc(conversationRef);
            if (!convSnap.exists()) {
                await setDoc(conversationRef, {
                    participants: [currentUser.uid, targetUser.id],
                    participantInfo: {
                        [currentUser.uid]: { username: currentUser.displayName, avatar: currentUser.photoURL },
                        [targetUser.id]: { username: targetUser.username, avatar: targetUser.avatar }
                    },
                    timestamp: serverTimestamp()
                });
            }

            const forwardData = {
                senderId: currentUser.uid,
                text: "",
                timestamp: serverTimestamp(),
                mediaType: 'forwarded_post',
                forwardedPostData: {
                    postId: post.id,
                    imageUrl: post.imageUrl || (post.media && post.media[0].url) || post.videoUrl,
                    originalPosterUsername: post.username || post.user?.username,
                    originalPosterAvatar: post.userAvatar || post.user?.avatar,
                    caption: post.caption,
                    type: post.videoUrl ? 'vibe' : 'post'
                }
            };

            await addDoc(collection(conversationRef, 'messages'), forwardData);
            await updateDoc(conversationRef, {
                lastMessage: {
                    text: `↪️ ${t('messages.forwardedPost')}`,
                    senderId: currentUser.uid,
                    timestamp: serverTimestamp(),
                    mediaType: 'forwarded_post'
                },
                timestamp: serverTimestamp()
            });

            setSendingTo(prev => [...prev, targetUser.id]);
        } catch (error) {
            console.error(error);
        }
    };

    if (!isOpen) return null;

    const filteredUsers = following.filter(u => u.username?.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-zinc-800 text-center relative">
                    <h3 className="font-bold">{t('forwardModal.title')}</h3>
                    <button onClick={onClose} className="absolute right-4 top-4 text-2xl font-light">&times;</button>
                </header>
                
                <div className="p-3 space-y-3">
                    {/* Opção Adicionar ao Pulse */}
                    <button 
                      onClick={() => onShareToPulse?.({
                        id: post.id,
                        userId: post.userId || post.user?.id, // ID do autor original para navegação
                        imageUrl: post.imageUrl || (post.media && post.media[0].url) || post.videoUrl,
                        username: post.username || post.user?.username,
                        avatar: post.userAvatar || post.user?.avatar,
                        type: post.videoUrl ? 'vibe' : 'post',
                        musicInfo: post.musicInfo || null // Repassa música se houver
                      })}
                      className="w-full flex items-center gap-4 p-3 bg-sky-50 dark:bg-sky-900/10 rounded-2xl group active:scale-95 transition-all"
                    >
                        <div className="w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/20">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M12 4v16m8-8H4"/></svg>
                        </div>
                        <span className="text-sm font-black text-sky-600 dark:text-sky-400">{t('forwardModal.addToPulse')}</span>
                    </button>

                    <TextInput 
                        id="forward-search" 
                        label={t('forwardModal.search')} 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                    />
                </div>

                <div className="flex-grow overflow-y-auto p-2 space-y-1">
                    {loading ? (
                        <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-sky-500"></div></div>
                    ) : filteredUsers.length === 0 ? (
                        <p className="text-center text-zinc-500 text-sm py-10">{t('forwardModal.noResults')}</p>
                    ) : (
                        filteredUsers.map(user => (
                            <div key={user.id} className="flex items-center justify-between p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                                <div className="flex items-center gap-3">
                                    <img src={user.avatar} className="w-10 h-10 rounded-full object-cover" />
                                    <span className="font-semibold text-sm">{user.username}</span>
                                </div>
                                <Button 
                                    onClick={() => handleForward(user)} 
                                    disabled={sendingTo.includes(user.id)}
                                    className={`!w-auto !py-1 !px-4 !text-sm ${sendingTo.includes(user.id) ? '!bg-zinc-200 !text-zinc-500 dark:!bg-zinc-800' : ''}`}
                                >
                                    {sendingTo.includes(user.id) ? t('forwardModal.sent') : t('forwardModal.send')}
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForwardModal;
