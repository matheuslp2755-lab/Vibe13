
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
    onOpenBrowser: () => void;
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

const BrowserIcon: React.FC<{className?: string}> = ({className = "h-7 w-7"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
);

const Header: React.FC<HeaderProps> = ({ onSelectUser, onGoHome, onOpenMessages, onOpenBrowser }) => {
    const { t } = useLanguage();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isActivityDropdownOpen, setIsActivityDropdownOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
    
    const searchRef = useRef<HTMLDivElement>(null);
    const activityRef = useRef<HTMLDivElement>(null);
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!currentUser) return;
        const q = query(collection(db, 'users', currentUser.uid, 'notifications'), limit(40));
        return onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Notification))
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setNotifications(fetched);
            setHasUnreadNotifications(fetched.some(n => !n.read));
        });
    }, [currentUser]);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        const timeoutId = setTimeout(async () => {
            const q = query(
                collection(db, 'users'),
                where('username_lowercase', '>=', searchQuery.toLowerCase()),
                where('username_lowercase', '<=', searchQuery.toLowerCase() + '\uf8ff'),
                limit(10)
            );
            try {
                const snap = await getDocs(q);
                const results = snap.docs
                    .map(d => ({ id: d.id, ...d.data() } as UserSearchResult))
                    .filter(u => u.id !== currentUser?.uid);
                setSearchResults(results);
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearching(false);
            }
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, currentUser]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setIsSearchFocused(false);
            }
            if (activityRef.current && !activityRef.current.contains(e.target as Node)) {
                setIsActivityDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDeleteNotification = async (id: string) => {
        if (!currentUser) return;
        await deleteDoc(doc(db, 'users', currentUser.uid, 'notifications', id));
    };

    const handleClearAllNotifications = async () => {
        if (!currentUser || notifications.length === 0) return;
        const batch = writeBatch(db);
        notifications.forEach(n => {
            batch.delete(doc(db, 'users', currentUser.uid, 'notifications', n.id));
        });
        await batch.commit();
    };

    const handleAcceptDuoRequest = async (n: Notification) => {
        if (!currentUser || !n.postId) return;
        const batch = writeBatch(db);
        batch.update(doc(db, 'posts', n.postId), {
            duoPending: false,
            duoPartner: { id: currentUser.uid, username: currentUser.displayName, avatar: currentUser.photoURL }
        });
        batch.delete(doc(db, 'users', currentUser.uid, 'notifications', n.id));
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

    const handleAcceptFollowRequest = async (n: Notification) => {
        if (!currentUser) return;
        const batch = writeBatch(db);
        const myFollowers = doc(db, 'users', currentUser.uid, 'followers', n.fromUserId);
        const theirFollowing = doc(db, 'users', n.fromUserId, 'following', currentUser.uid);
        
        batch.set(myFollowers, { username: n.fromUsername, avatar: n.fromUserAvatar, timestamp: serverTimestamp() });
        batch.set(theirFollowing, { username: currentUser.displayName, avatar: currentUser.photoURL, timestamp: serverTimestamp() });
        
        batch.delete(doc(db, 'users', currentUser.uid, 'followRequests', n.fromUserId));
        batch.delete(doc(db, 'users', n.fromUserId, 'sentFollowRequests', currentUser.uid));
        batch.delete(doc(db, 'users', currentUser.uid, 'notifications', n.id));
        
        const notifRef = doc(collection(db, 'users', n.fromUserId, 'notifications'));
        batch.set(notifRef, {
            type: 'follow',
            fromUserId: currentUser.uid,
            fromUsername: currentUser.displayName,
            fromUserAvatar: currentUser.photoURL,
            timestamp: serverTimestamp(),
            read: false
        });
        
        await batch.commit();
    };

    const handleDeclineFollowRequest = async (n: Notification) => {
        if (!currentUser) return;
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', currentUser.uid, 'followRequests', n.fromUserId));
        batch.delete(doc(db, 'users', n.fromUserId, 'sentFollowRequests', currentUser.uid));
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
                
                <div className="flex items-center gap-3">
                    <h1 
                        onClick={onGoHome} 
                        className="text-3xl font-serif cursor-pointer shrink-0 font-black bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-transparent bg-clip-text tracking-tighter"
                    >
                        {t('header.title')}
                    </h1>
                    <button 
                        onClick={onOpenBrowser}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all text-zinc-600 dark:text-zinc-300"
                        title={t('header.browser')}
                    >
                        <BrowserIcon className="w-6 h-6" />
                    </button>
                </div>

                <div ref={searchRef} className="relative flex-grow max-w-xs mx-4">
                    <div className={`flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border transition-all ${isSearchFocused ? 'border-sky-500 bg-white shadow-sm ring-4 ring-sky-500/5' : 'border-transparent'}`}>
                        <SearchIcon className="w-4 h-4 text-zinc-400" />
                        <input 
                            type="text" 
                            placeholder={t('header.searchPlaceholder')}
                            className="bg-transparent outline-none w-full text-sm font-medium"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                        />
                    </div>
                    {isSearchFocused && searchQuery.trim() !== '' && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto animate-fade-in z-[60]">
                            {isSearching ? (
                                <div className="p-4 flex justify-center"><div className="w-5 h-5 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin"></div></div>
                            ) : searchResults.length > 0 ? searchResults.map(user => (
                                <div 
                                    key={user.id} 
                                    onClick={() => { onSelectUser(user.id); setIsSearchFocused(false); setSearchQuery(''); }} 
                                    className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer border-b last:border-0 dark:border-zinc-800 transition-colors"
                                >
                                    <img src={user.avatar} className="w-10 h-10 rounded-full object-cover border dark:border-zinc-700" />
                                    <span className="text-sm font-bold">{user.username}</span>
                                </div>
                            )) : <p className="p-4 text-center text-xs text-zinc-500 font-bold uppercase tracking-widest">{t('header.noResults')}</p>}
                        </div>
                    )}
                </div>

                <nav className="flex items-center gap-3 sm:gap-4">
                    <button onClick={onGoHome} className="hover:scale-110 transition-transform hidden sm:block">
                        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.099l7 5.185V20.5a1 1 0 01-1 1h-5v-6h-2v6H5a1 1 0 01-1-1V7.284l7-5.185z"/></svg>
                    </button>
                    
                    <div ref={activityRef} className="relative">
                        <button onClick={() => setIsActivityDropdownOpen(!isActivityDropdownOpen)} className="relative hover:scale-110 transition-transform">
                            <HeartIcon className="text-zinc-800 dark:text-zinc-200" />
                            {hasUnreadNotifications && <span className="absolute top-0.5 right-0.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-black"></span>}
                        </button>
                        
                        {isActivityDropdownOpen && (
                            <div className="absolute right-0 top-full mt-4 w-80 bg-white dark:bg-zinc-950 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border dark:border-zinc-800 z-50 overflow-hidden animate-fade-in">
                                <div className="p-4 border-b dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-md">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{t('header.notifications')}</span>
                                    {notifications.length > 0 && (
                                        <button onClick={handleClearAllNotifications} className="text-[9px] font-black uppercase tracking-widest text-sky-500 hover:text-sky-600 transition-colors">
                                            {t('header.clearAll')}
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-[60vh] overflow-y-auto no-scrollbar">
                                    {notifications.length > 0 ? notifications.map(n => (
                                        <div key={n.id} className="group relative flex items-start p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 border-b last:border-0 dark:border-zinc-900 transition-all">
                                            <img 
                                                onClick={() => onSelectUser(n.fromUserId)}
                                                src={n.fromUserAvatar} 
                                                className="w-10 h-10 rounded-full object-cover shrink-0 border dark:border-zinc-700 cursor-pointer active:scale-90 transition-transform"
                                            />
                                            <div className="ml-3 text-xs flex-grow pr-6">
                                                <p className="leading-snug text-zinc-800 dark:text-zinc-200" dangerouslySetInnerHTML={{ __html: getNotificationText(n).replace(n.fromUsername, `<b class="text-sky-500">${n.fromUsername}</b>`) }} />
                                                {(n.type === 'duo_request' || n.type === 'tag_request' || n.type === 'follow_request') && (
                                                    <div className="flex gap-2 mt-3">
                                                        <button 
                                                            onClick={() => n.type === 'follow_request' ? handleAcceptFollowRequest(n) : handleAcceptDuoRequest(n)} 
                                                            className="text-[10px] font-black text-white bg-sky-500 px-4 py-1.5 rounded-xl uppercase tracking-widest shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
                                                        >
                                                            {t('header.accept')}
                                                        </button>
                                                        <button 
                                                            onClick={() => n.type === 'follow_request' ? handleDeclineFollowRequest(n) : handleDeclineDuoRequest(n)} 
                                                            className="text-[10px] font-black text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-4 py-1.5 rounded-xl uppercase tracking-widest active:scale-95 transition-all"
                                                        >
                                                            {t('header.decline')}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteNotification(n.id)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-red-500 transition-all"
                                                title={t('common.delete')}
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    )) : (
                                        <div className="p-12 text-center flex flex-col items-center">
                                            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-4">
                                                <HeartIcon className="w-8 h-8 text-zinc-300" />
                                            </div>
                                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">{t('header.noActivity')}</p>
                                        </div>
                                    )}
                                </div>
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
