
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

const SearchIcon: React.FC<{className?: string}> = ({className = "h-4 w-4 text-zinc-400 dark:text-zinc-500"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const MessagesIcon: React.FC<{className?: string}> = ({className = "h-6 w-6"}) => (
    <svg aria-label="Direct" className={className} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Direct</title><line fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" x1="22" x2="9.218" y1="3" y2="10.083"></line><polygon fill="none" points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></polygon></svg>
);


const HeartIcon: React.FC<{className?: string}> = ({className = "h-6 w-6"}) => (
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
    const [isActivityDropdownOpen, setIsActivityDropdownOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
    const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
    const [following, setFollowing] = useState<string[]>([]);
    const [requestedIds, setRequestedIds] = useState<string[]>([]);
    const [isMobileSearchVisible, setIsMobileSearchVisible] = useState(false);
    
    const searchRef = useRef<HTMLDivElement>(null);
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
        }, (error) => {
            console.error("Error fetching notifications:", error);
        });

        return () => unsubscribe();
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.uid));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const anyUnread = snapshot.docs.some(doc => {
                const data = doc.data();
                if (!data.lastMessage || data.lastMessage.senderId === currentUser.uid) {
                    return false;
                }
                const myInfo = data.participantInfo?.[currentUser.uid];
                if (!myInfo?.lastSeenMessageTimestamp) {
                    return true;
                }
                if (!data.lastMessage.timestamp) {
                    return false;
                }
                return data.lastMessage.timestamp.seconds > myInfo.lastSeenMessageTimestamp.seconds;
            });
            setHasUnreadMessages(anyUnread);
        }, (error) => {
            console.error("Error checking for unread messages:", error);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const fetchFollowingAndRequests = async () => {
        if (auth.currentUser) {
            const followingRef = collection(db, 'users', auth.currentUser.uid, 'following');
            const requestsRef = collection(db, 'users', auth.currentUser.uid, 'sentFollowRequests');

            const [followingSnap, requestsSnap] = await Promise.all([
                 getDocs(followingRef),
                 getDocs(requestsRef)
            ]);
            
            const followingIds = followingSnap.docs.map(doc => doc.id);
            const requestedUserIds = requestsSnap.docs.map(doc => doc.id);
            setFollowing(followingIds);
            setRequestedIds(requestedUserIds);
        }
    };
    
    useEffect(() => {
        fetchFollowingAndRequests();
    }, []);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setSearchResults([]);
            return;
        }

        const debouncedSearch = setTimeout(async () => {
            setIsSearching(true);
            const usersRef = collection(db, 'users');
            const q = query(
                usersRef,
                where('username_lowercase', '>=', searchQuery.toLowerCase()),
                where('username_lowercase', '<=', searchQuery.toLowerCase() + '\uf8ff'),
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
        }, 300);

        return () => clearTimeout(debouncedSearch);
    }, [searchQuery]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchFocused(false);
            }
            if (activityRef.current && !activityRef.current.contains(event.target as Node)) {
                setIsActivityDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [searchRef, activityRef]);

    const handleFollow = async (targetUser: UserSearchResult) => {
        if (!auth.currentUser) return;

        if (targetUser.isPrivate) {
            setRequestedIds(prev => [...prev, targetUser.id]);
            const targetUserRequestRef = doc(db, 'users', targetUser.id, 'followRequests', auth.currentUser.uid);
            const currentUserSentRequestRef = doc(db, 'users', auth.currentUser.uid, 'sentFollowRequests', targetUser.id);
            const notificationRef = collection(db, 'users', targetUser.id, 'notifications');
            try {
                const batch = writeBatch(db);
                batch.set(targetUserRequestRef, {
                    username: auth.currentUser.displayName,
                    avatar: auth.currentUser.photoURL,
                    timestamp: serverTimestamp()
                });
                batch.set(currentUserSentRequestRef, {
                    username: targetUser.username,
                    avatar: targetUser.avatar,
                    timestamp: serverTimestamp()
                });
                batch.set(doc(notificationRef), {
                    type: 'follow_request',
                    fromUserId: auth.currentUser.uid,
                    fromUsername: auth.currentUser.displayName,
                    fromUserAvatar: auth.currentUser.photoURL,
                    timestamp: serverTimestamp(),
                    read: false,
                });
                await batch.commit();
            } catch (error) {
                console.error("Error sending follow request:", error);
                setRequestedIds(prev => prev.filter(id => id !== targetUser.id));
            }
        } else {
            setFollowing(prev => [...prev, targetUser.id]);
            const currentUserFollowingRef = doc(db, 'users', auth.currentUser.uid, 'following', targetUser.id);
            const targetUserFollowersRef = doc(db, 'users', targetUser.id, 'followers', auth.currentUser.uid);
            const notificationRef = collection(db, 'users', targetUser.id, 'notifications');
            try {
                await setDoc(currentUserFollowingRef, {
                    username: targetUser.username,
                    avatar: targetUser.avatar,
                    timestamp: serverTimestamp()
                });
                await setDoc(targetUserFollowersRef, {
                    username: auth.currentUser.displayName,
                    avatar: auth.currentUser.photoURL,
                    timestamp: serverTimestamp()
                });
                await addDoc(notificationRef, {
                    type: 'follow',
                    fromUserId: auth.currentUser.uid,
                    fromUsername: auth.currentUser.displayName,
                    fromUserAvatar: auth.currentUser.photoURL,
                    timestamp: serverTimestamp(),
                    read: false,
                });
            } catch (error) {
                console.error("Error following user:", error);
                setFollowing(prev => prev.filter(id => id !== targetUser.id));
            }
        }
    };
    
    const handleUnfollow = async (targetUserId: string) => {
        if (!auth.currentUser) return;
        setFollowing(prev => prev.filter(id => id !== targetUserId));

        const currentUserFollowingRef = doc(db, 'users', auth.currentUser.uid, 'following', targetUserId);
        const targetUserFollowersRef = doc(db, 'users', targetUserId, 'followers', auth.currentUser.uid);
        
        try {
            await deleteDoc(currentUserFollowingRef);
            await deleteDoc(targetUserFollowersRef);
        } catch(error) {
            console.error("Error unfollowing user:", error);
            setFollowing(prev => [...prev, targetUserId]);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (notification.type === 'message' && notification.conversationId) {
            onOpenMessages(notification.conversationId);
        } else if (['follow', 'mention_comment', 'duo_accepted', 'duo_refused', 'tag_accepted'].includes(notification.type)) {
            onSelectUser(notification.fromUserId);
        }
        if(!['follow_request', 'duo_request', 'tag_request'].includes(notification.type)) {
             setIsActivityDropdownOpen(false);
        }
    };

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

    return (
        <header className="fixed top-0 left-0 right-0 bg-white dark:bg-black border-b border-zinc-300 dark:border-zinc-800 z-10">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-lg gap-4">
                <h1 onClick={onGoHome} className={`text-2xl font-serif cursor-pointer transition-all duration-300 ${isMobileSearchVisible ? 'hidden' : 'block'}`}>
                    {t('header.title')}
                </h1>

                <nav className={`flex items-center gap-4 ${isMobileSearchVisible ? 'hidden' : 'flex'}`}>
                    <div ref={activityRef} className="relative">
                        <button onClick={() => setIsActivityDropdownOpen(!isActivityDropdownOpen)} className="relative">
                            <HeartIcon className="w-6 h-6 text-zinc-800 dark:text-zinc-200" />
                            {hasUnreadNotifications && <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-black"></span>}
                        </button>
                        {isActivityDropdownOpen && (
                             <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-zinc-950 rounded-md shadow-lg border border-zinc-200 dark:border-zinc-800 z-20 max-h-96 overflow-y-auto">
                                {notifications.map(n => (
                                    <div key={n.id} onClick={() => handleNotificationClick(n)} className="flex items-center p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer">
                                        <img src={n.fromUserAvatar} className="w-11 h-11 rounded-full object-cover"/>
                                        <div className="ml-3 text-sm flex-grow">
                                            <p dangerouslySetInnerHTML={{ __html: getNotificationText(n).replace(n.fromUsername, `<b>${n.fromUsername}</b>`) }} />
                                            {(n.type === 'duo_request' || n.type === 'tag_request') && (
                                                <div className="flex gap-2 mt-2">
                                                    <button onClick={(e) => { e.stopPropagation(); n.type === 'duo_request' ? handleAcceptDuoRequest(n) : handleAcceptTagRequest(n); }} className="text-xs font-bold text-white bg-sky-500 px-3 py-1 rounded-md">{t('header.accept')}</button>
                                                    <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'users', currentUser!.uid, 'notifications', n.id)); }} className="text-xs font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-md">{t('header.decline')}</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </nav>
            </div>
        </header>
    );
};

export default Header;
