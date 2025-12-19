
import React, { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db, collection, query, where, getDocs, limit, doc, setDoc, deleteDoc, serverTimestamp, orderBy, onSnapshot, writeBatch, addDoc, updateDoc, arrayUnion } from '../../firebase';
import OnlineIndicator from './OnlineIndicator';
import { useLanguage } from '../../context/LanguageContext';

type UserSearchResult = {
    id: string;
    username: string;
    avatar: string;
    isPrivate: boolean;
    lastSeen?: { seconds: number; nanoseconds: number };
};

type Notification = {
    id: string;
    type: 'follow' | 'message' | 'follow_request' | 'mention_comment' | 'duo_request' | 'duo_accepted' | 'duo_refused' | 'tag_request' | 'tag_accepted';
    fromUserId: string;
    fromUsername: string;
    fromUserAvatar: string;
    timestamp: { seconds: number; nanoseconds: number };
    read: boolean;
    conversationId?: string;
    postId?: string;
    commentText?: string;
};


interface HeaderProps {
    onSelectUser: (userId: string) => void;
    onGoHome: () => void;
    onOpenMessages: (conversationId?: string) => void;
}

const SearchIcon: React.FC<{className?: string}> = ({className = "h-5 w-5 text-zinc-400 dark:text-zinc-500"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const HeartIcon: React.FC<{className?: string}> = ({className = "h-7 w-7"}) => (
    <svg aria-label="Notifications" className={className} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Notificações</title><path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-6.12 8.351C12.89 20.72 12.434 21 12 21s-.89-.28-1.38-.627C7.152 14.08 4.5 12.192 4.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.118-1.763a4.21 4.21 0 0 1 3.675-1.941Z"></path></svg>
);

const MessageIcon: React.FC<{className?: string}> = ({className = "h-7 w-7"}) => (
    <svg aria-label="Direct" className={className} fill="none" stroke="currentColor" strokeWidth="2" height="24" role="img" viewBox="0 0 24 24" width="24">
        <title>Mensagens</title>
        <path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2Z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const Header: React.FC<HeaderProps> = ({ onSelectUser, onGoHome, onOpenMessages }) => {
    const { t } = useLanguage();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isActivityDropdownOpen, setIsActivityDropdownOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
    const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
    
    const searchRef = useRef<HTMLDivElement>(null);
    const activityRef = useRef<HTMLDivElement>(null);
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!currentUser) return;
        const q = query(collection(db, 'users', currentUser.uid, 'notifications'), limit(20));
        return onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Notification))
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setNotifications(fetched);
            setHasUnreadNotifications(fetched.some(n => !n.read));
        });
    }, [currentUser]);

    const handleAcceptDuoRequest = async (n: Notification) => {
        if (!currentUser || !n.postId) return;
        const batch = writeBatch(db);
        
        // Atualizar Post
        batch.update(doc(db, 'posts', n.postId), {
            duoPending: false,
            duoPartner: {
                id: currentUser.uid,
                username: currentUser.displayName,
                avatar: currentUser.photoURL
            }
        });

        // Deletar Notificação
        batch.delete(doc(db, 'users', currentUser.uid, 'notifications', n.id));

        // Notificar Originador
        const notifRef = doc(collection(db, 'users', n.fromUserId, 'notifications'));
        batch.set(notifRef, {
            type: 'duo_accepted',
            fromUserId: currentUser.uid,
            fromUsername: currentUser.displayName,
            fromUserAvatar: currentUser.photoURL,
            timestamp: serverTimestamp(),
            read: false
        });

        await batch.commit();
    };

    const handleDeclineDuoRequest = async (n: Notification) => {
        if (!currentUser || !n.postId) return;
        const batch = writeBatch(db);
        batch.update(doc(db, 'posts', n.postId), { duoPending: false, duoPartnerId: null });
        batch.delete(doc(db, 'users', currentUser.uid, 'notifications', n.id));
        await batch.commit();
    };

    const getNotificationText = (n: Notification) => {
        const params = { username: n.fromUsername, commentText: n.commentText || '' };
        switch (n.type) {
            case 'follow': return t('header.followNotification', params);
            case 'message': return t('header.messageNotification', params);
            case 'follow_request': return t('header.followRequestNotification', params);
            case 'mention_comment': return t('header.mentionCommentNotification', params);
            case 'duo_request': return t('header.duoRequestNotification', params);
            case 'tag_request': return t('header.tagRequestNotification', params);
            case 'duo_accepted': return t('header.duoAcceptedNotification', params);
            case 'tag_accepted': return t('header.tagAcceptedNotification', params);
            default: return '';
        }
    };

    return (
        <header className="fixed top-0 left-0 right-0 bg-white dark:bg-black border-b dark:border-zinc-800 z-50 transition-all duration-300">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-5xl">
                
                <h1 
                    onClick={onGoHome} 
                    className="text-4xl font-serif cursor-pointer shrink-0 font-black bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-transparent bg-clip-text tracking-tighter"
                >
                    {t('header.title')}
                </h1>

                <nav className="flex items-center gap-5">
                    <button onClick={onGoHome} className="hover:scale-110 transition-transform"><svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M9.005 16.545a2.997 2.997 0 010-5.091L14.298 8.35a2.998 2.998 0 014.702 2.545v6.21a2.998 2.998 0 01-4.702 2.545l-5.293-3.105z" /></svg></button>
                    
                    <div ref={activityRef} className="relative">
                        <button onClick={() => setIsActivityDropdownOpen(!isActivityDropdownOpen)} className="relative hover:scale-110 transition-transform">
                            <HeartIcon className="text-zinc-800 dark:text-zinc-200" />
                            {hasUnreadNotifications && <span className="absolute top-0.5 right-0.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-black"></span>}
                        </button>
                        
                        {isActivityDropdownOpen && (
                            <div className="absolute right-0 top-full mt-4 w-80 bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border dark:border-zinc-800 z-50 max-h-[70vh] overflow-y-auto animate-fade-in no-scrollbar">
                                {notifications.length > 0 ? notifications.map(n => (
                                    <div key={n.id} className="flex items-start p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 border-b last:border-0 dark:border-zinc-900 transition-colors">
                                        <img src={n.fromUserAvatar} className="w-10 h-10 rounded-full object-cover shrink-0 border dark:border-zinc-700"/>
                                        <div className="ml-3 text-xs flex-grow">
                                            <p className="leading-snug" dangerouslySetInnerHTML={{ __html: getNotificationText(n).replace(n.fromUsername, `<b class="text-sky-500">${n.fromUsername}</b>`) }} />
                                            {(n.type === 'duo_request' || n.type === 'tag_request') && (
                                                <div className="flex gap-2 mt-3">
                                                    <button onClick={() => handleAcceptDuoRequest(n)} className="text-[10px] font-black text-white bg-sky-500 px-3 py-1.5 rounded-xl uppercase tracking-widest">{t('header.accept')}</button>
                                                    <button onClick={() => handleDeclineDuoRequest(n)} className="text-[10px] font-black text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl uppercase tracking-widest">{t('header.decline')}</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )) : (
                                    <div className="p-10 text-center flex flex-col items-center">
                                        <HeartIcon className="w-8 h-8 text-zinc-300 mb-4" />
                                        <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">{t('header.noActivity')}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <button onClick={() => onOpenMessages()} className="relative hover:scale-110 transition-transform">
                        <MessageIcon className="text-zinc-800 dark:text-zinc-200" />
                    </button>
                </nav>
            </div>
        </header>
    );
};

export default Header;
