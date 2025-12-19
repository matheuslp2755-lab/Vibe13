
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
    <svg aria-label="Notifications" className={className} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Notifications</title><path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-6.12 8.351C12.89 20.72 12.434 21 12 21s-.89-.28-1.38-.627C7.152 14.08 4.5 12.192 4.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.118-1.763a4.21 4.21 0 0 1 3.675-1.941Z"></path></svg>
);

const SpinnerIcon: React.FC = () => (
    <div className="flex justify-center items-center p-4">
        <svg className="animate-spin h-5 w-5 text-zinc-500 dark:text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);


const Header: React.FC<HeaderProps> = ({ onSelectUser, onGoHome, onOpenMessages }) => {
    const { t } = useLanguage();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const [isActivityDropdownOpen, setIsActivityDropdownOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
    
    const searchRef = useRef<HTMLDivElement>(null);
    const mobileSearchRef = useRef<HTMLDivElement>(null);
    const activityRef = useRef<HTMLDivElement>(null);
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!currentUser) return;

        const notificationsRef = collection(db, 'users', currentUser.uid, 'notifications');
        const q = query(notificationsRef, limit(20));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedNotifications = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Notification))
                .filter(notification => notification.type !== 'message'); 
            
            fetchedNotifications.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setNotifications(fetchedNotifications);
            const hasUnread = fetchedNotifications.some(n => !n.read);
            setHasUnreadNotifications(hasUnread);
        });

        return () => unsubscribe();
    }, [currentUser]);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setSearchResults([]);
            return;
        }

        const debouncedSearch = setTimeout(async () => {
            setIsSearching(true);
            const usersRef = collection(db, 'users');
            const term = searchQuery.toLowerCase();
            const q = query(
                usersRef,
                where('username_lowercase', '>=', term),
                where('username_lowercase', '<=', term + '\uf8ff'),
                limit(10)
            );
            
            try {
                const querySnapshot = await getDocs(q);
                const users = querySnapshot.docs
                    .map(doc => ({ id: doc.id, ...(doc.data() as Omit<UserSearchResult, 'id'>) }))
                    .filter(user => user.id !== auth.currentUser?.uid);
                
                setSearchResults(users);
            } catch (error) {
                console.error("Error searching users:", error);
            } finally {
                setIsSearching(false);
            }
        }, 400);

        return () => clearTimeout(term);
    }, [searchQuery]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchFocused(false);
            }
            if (mobileSearchRef.current && !mobileSearchRef.current.contains(event.target as Node)) {
                setIsMobileSearchOpen(false);
            }
            if (activityRef.current && !activityRef.current.contains(event.target as Node)) {
                setIsActivityDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAcceptDuoRequest = async (notification: Notification) => {
        if (!currentUser || !notification.postId) return;
        const batch = writeBatch(db);
        const postRef = doc(db, 'posts', notification.postId);
        batch.update(postRef, {
            duoPartner: {
                userId: currentUser.uid,
                username: currentUser.displayName,
                userAvatar: currentUser.photoURL,
            }
        });
        batch.delete(doc(db, 'users', currentUser.uid, 'notifications', notification.id));
        const successNotify = doc(collection(db, 'users', notification.fromUserId, 'notifications'));
        batch.set(successNotify, {
            type: 'duo_accepted',
            fromUserId: currentUser.uid,
            fromUsername: currentUser.displayName,
            fromUserAvatar: currentUser.photoURL,
            timestamp: serverTimestamp(),
            read: false
        });
        await batch.commit();
        setIsActivityDropdownOpen(false);
    };

    const handleAcceptTagRequest = async (notification: Notification) => {
        if (!currentUser || !notification.postId) return;
        const batch = writeBatch(db);
        const postRef = doc(db, 'posts', notification.postId);
        batch.update(postRef, {
            tags: arrayUnion({ userId: currentUser.uid, username: currentUser.displayName })
        });
        batch.delete(doc(db, 'users', currentUser.uid, 'notifications', notification.id));
        const successNotify = doc(collection(db, 'users', notification.fromUserId, 'notifications'));
        batch.set(successNotify, {
            type: 'tag_accepted',
            fromUserId: currentUser.uid,
            fromUsername: currentUser.displayName,
            fromUserAvatar: currentUser.photoURL,
            timestamp: serverTimestamp(),
            read: false
        });
        await batch.commit();
        setIsActivityDropdownOpen(false);
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!currentUser) return;

        if (!notification.read) {
            try {
                await updateDoc(doc(db, 'users', currentUser.uid, 'notifications', notification.id), {
                    read: true
                });
            } catch (error) {
                console.error("Error marking notification as read:", error);
            }
        }

        switch (notification.type) {
            case 'message':
                if (notification.conversationId) onOpenMessages(notification.conversationId);
                break;
            case 'follow':
            case 'follow_request':
            case 'duo_accepted':
            case 'tag_accepted':
                onSelectUser(notification.fromUserId);
                break;
            case 'mention_comment':
                onGoHome(); 
                break;
            default:
                break;
        }
    };

    const getNotificationText = (notification: Notification) => {
        const params = { username: notification.fromUsername, commentText: notification.commentText || '' };
        switch (notification.type) {
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

    const handleSelectResult = (userId: string) => {
        onSelectUser(userId);
        setIsSearchFocused(false);
        setIsMobileSearchOpen(false);
        setSearchQuery('');
    };

    return (
        <header className="fixed top-0 left-0 right-0 bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800 z-50">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-5xl gap-4">
                
                {!isMobileSearchOpen && (
                    <h1 
                        onClick={onGoHome} 
                        className="text-4xl font-serif cursor-pointer shrink-0 font-black bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-transparent bg-clip-text drop-shadow-md tracking-tighter"
                    >
                        {t('header.title')}
                    </h1>
                )}

                <div ref={searchRef} className="relative flex-grow max-w-xs hidden sm:block">
                    <div className={`flex items-center bg-zinc-100 dark:bg-zinc-900 border border-transparent focus-within:border-zinc-300 dark:focus-within:border-zinc-700 rounded-xl px-3 transition-all ${isSearchFocused ? 'ring-2 ring-sky-500/20' : ''}`}>
                        <SearchIcon />
                        <input
                            type="text"
                            placeholder={t('header.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                            className="w-full bg-transparent p-2 text-sm outline-none dark:text-white font-medium"
                        />
                    </div>

                    {isSearchFocused && searchQuery && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto z-[100] animate-fade-in">
                            {isSearching ? <SpinnerIcon /> : searchResults.length > 0 ? searchResults.map(user => (
                                <div key={user.id} onClick={() => handleSelectResult(user.id)} className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors border-b last:border-0 dark:border-zinc-800">
                                    <img src={user.avatar} className="w-10 h-10 rounded-full object-cover border dark:border-zinc-700" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold">{user.username}</span>
                                    </div>
                                </div>
                            )) : <p className="p-8 text-center text-sm text-zinc-500 font-bold">{t('header.noResults')}</p>}
                        </div>
                    )}
                </div>

                {isMobileSearchOpen ? (
                    <div ref={mobileSearchRef} className="flex-grow flex items-center gap-2 sm:hidden animate-slide-right">
                        <div className="flex-grow flex items-center bg-zinc-100 dark:bg-zinc-900 rounded-2xl px-3 py-1.5 border dark:border-zinc-800 relative">
                            <SearchIcon className="h-4 w-4 text-zinc-400" />
                            <input
                                autoFocus
                                type="text"
                                placeholder={t('header.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent p-1.5 text-sm outline-none dark:text-white font-medium"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="text-zinc-400">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" /></svg>
                                </button>
                            )}
                            
                            {/* Mobile search results dropdown */}
                            {searchQuery && (
                                <div className="absolute top-full left-0 right-0 mt-4 bg-white dark:bg-zinc-950 border dark:border-zinc-800 rounded-2xl shadow-2xl z-[100] max-h-[60vh] overflow-y-auto">
                                    {isSearching ? <SpinnerIcon /> : searchResults.length > 0 ? searchResults.map(user => (
                                        <div key={user.id} onClick={() => handleSelectResult(user.id)} className="flex items-center gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer border-b last:border-0 dark:border-zinc-800">
                                            <img src={user.avatar} className="w-12 h-12 rounded-full object-cover border dark:border-zinc-700" />
                                            <span className="text-sm font-bold">{user.username}</span>
                                        </div>
                                    )) : <p className="p-8 text-center text-sm text-zinc-500 font-bold">{t('header.noResults')}</p>}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setIsMobileSearchOpen(false)} className="text-sm font-black text-sky-500 uppercase tracking-tighter">
                            {t('common.cancel')}
                        </button>
                    </div>
                ) : (
                    <nav className="flex items-center gap-5 shrink-0">
                        <button 
                            onClick={() => setIsMobileSearchOpen(true)}
                            className="p-1.5 sm:hidden hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                            aria-label="Busca"
                        >
                            <SearchIcon className="h-7 w-7 text-zinc-800 dark:text-zinc-200" />
                        </button>

                        <div ref={activityRef} className="relative">
                            <button onClick={() => setIsActivityDropdownOpen(!isActivityDropdownOpen)} className="relative hover:scale-110 transition-transform active:scale-95">
                                <HeartIcon className="text-zinc-800 dark:text-zinc-200" />
                                {hasUnreadNotifications && <span className="absolute top-0.5 right-0.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-black"></span>}
                            </button>
                            
                            {isActivityDropdownOpen && (
                                <div className="absolute right-0 top-full mt-4 w-80 bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 z-50 max-h-[70vh] overflow-y-auto animate-fade-in">
                                    {notifications.length > 0 ? notifications.map(n => (
                                        <div key={n.id} onClick={() => { handleNotificationClick(n); setIsActivityDropdownOpen(false); }} className="flex items-start p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer border-b last:border-0 dark:border-zinc-800 transition-colors">
                                            <img src={n.fromUserAvatar} className="w-10 h-10 rounded-full object-cover shrink-0 border dark:border-zinc-700"/>
                                            <div className="ml-3 text-sm flex-grow text-left">
                                                <p className="leading-snug" dangerouslySetInnerHTML={{ __html: getNotificationText(n).replace(n.fromUsername, `<b class="text-sky-500">${n.fromUsername}</b>`) }} />
                                                {(n.type === 'duo_request' || n.type === 'tag_request') && (
                                                    <div className="flex gap-2 mt-3">
                                                        <button onClick={(e) => { e.stopPropagation(); n.type === 'duo_request' ? handleAcceptDuoRequest(n) : handleAcceptTagRequest(n); }} className="text-xs font-black text-white bg-sky-500 px-4 py-2 rounded-xl shadow-sm hover:bg-sky-600 transition-colors uppercase tracking-widest">{t('header.accept')}</button>
                                                        <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'users', currentUser!.uid, 'notifications', n.id)); }} className="text-xs font-black text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors uppercase tracking-widest">{t('header.decline')}</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="p-10 text-center flex flex-col items-center">
                                            <div className="w-16 h-16 rounded-full border-2 border-zinc-200 dark:border-zinc-800 flex items-center justify-center mb-4">
                                                <HeartIcon className="w-8 h-8 text-zinc-300" />
                                            </div>
                                            <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">{t('header.noActivity')}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </nav>
                )}
            </div>
        </header>
    );
};

export default Header;
