
import React, { useState, useEffect, useRef } from 'react';
import { auth, db, doc, getDoc, collection, getDocs, setDoc, deleteDoc, serverTimestamp, updateDoc, query, where, orderBy, onSnapshot, writeBatch, storage, storageRef, uploadBytes, getDownloadURL, addDoc } from '../../firebase';
import { updateProfile, signOut } from 'firebase/auth';
import Button from '../common/Button';
import EditProfileModal from './EditProfileModal';
import FollowersModal from './FollowersModal';
import OnlineIndicator from '../common/OnlineIndicator';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';
import PulseViewerModal from '../pulse/PulseViewerModal';
import ProfileMusicPlayer from './ProfileMusicPlayer';

interface UserProfileProps {
    userId: string;
    onStartMessage: (user: any) => void;
    onSelectUser?: (userId: string) => void;
}

const VIBE_EMOJIS: Record<string, string> = {
    joy: '☀️',
    anger: '🔥',
    sloth: '💤'
};

const UserProfile: React.FC<UserProfileProps> = ({ userId, onStartMessage, onSelectUser }) => {
    const { t } = useLanguage();
    const { startCall } = useCall();
    const [user, setUser] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [pulses, setPulses] = useState<any[]>([]);
    const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
    const [isFollowing, setIsFollowing] = useState(false);
    const [isRequested, setIsRequested] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [viewingPulses, setViewingPulses] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
    
    const [isFollowersModalOpen, setIsFollowersModalOpen] = useState(false);
    const [isFollowingModalOpen, setIsFollowingModalOpen] = useState(false);
    
    const currentUser = auth.currentUser;
    const isOwner = currentUser?.uid === userId;
    const profileMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let unsubscribePosts: (() => void) | undefined;
        let unsubscribePulses: (() => void) | undefined;

        const fetchUserData = async () => {
            const userSnap = await getDoc(doc(db, 'users', userId));
            if (userSnap.exists()) {
                const userData = userSnap.data();
                setUser(userData);
                
                if (currentUser) {
                    const followSnap = await getDoc(doc(db, 'users', currentUser.uid, 'following', userId));
                    setIsFollowing(followSnap.exists());
                    
                    const requestSnap = await getDoc(doc(db, 'users', currentUser.uid, 'sentFollowRequests', userId));
                    setIsRequested(requestSnap.exists());

                    const blockSnap = await getDoc(doc(db, 'users', currentUser.uid, 'blocked', userId));
                    setIsBlocked(blockSnap.exists());
                }

                const postsQ = query(collection(db, 'posts'), where('userId', '==', userId));
                unsubscribePosts = onSnapshot(postsQ, (snap) => {
                    const sortedPosts = snap.docs
                        .map(d => ({ id: d.id, ...d.data() }))
                        .sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
                    
                    setPosts(sortedPosts);
                    setStats(prev => ({ ...prev, posts: snap.size }));
                });

                const pulsesQ = query(collection(db, 'pulses'), where('authorId', '==', userId));
                unsubscribePulses = onSnapshot(pulsesQ, (snap) => {
                    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
                    const activePulses = snap.docs
                        .map(d => ({ id: d.id, ...d.data() } as any))
                        .filter(p => {
                            if (!p.createdAt) return false;
                            const createdAtMs = p.createdAt.seconds * 1000;
                            return createdAtMs >= twentyFourHoursAgo;
                        })
                        .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
                    
                    setPulses(activePulses);
                });

                const fers = await getDocs(collection(db, 'users', userId, 'followers'));
                const fing = await getDocs(collection(db, 'users', userId, 'following'));
                setStats(prev => ({ ...prev, followers: fers.size, following: fing.size }));
            }
        };
        fetchUserData();

        return () => {
            if (unsubscribePosts) unsubscribePosts();
            if (unsubscribePulses) unsubscribePulses();
        };
    }, [userId, currentUser]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setIsProfileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFollow = async () => {
        if (!currentUser || !user) return;
        const batch = writeBatch(db);

        if (isFollowing) {
            batch.delete(doc(db, 'users', currentUser.uid, 'following', userId));
            batch.delete(doc(db, 'users', userId, 'followers', currentUser.uid));
            await batch.commit();
            setIsFollowing(false);
        } else if (isRequested) {
            batch.delete(doc(db, 'users', currentUser.uid, 'sentFollowRequests', userId));
            batch.delete(doc(db, 'users', userId, 'followRequests', currentUser.uid));
            await batch.commit();
            setIsRequested(false);
        } else {
            if (user.isPrivate) {
                const requestRef = doc(db, 'users', userId, 'followRequests', currentUser.uid);
                batch.set(requestRef, { 
                    username: currentUser.displayName, 
                    avatar: currentUser.photoURL, 
                    timestamp: serverTimestamp() 
                });

                const sentRequestRef = doc(db, 'users', currentUser.uid, 'sentFollowRequests', userId);
                batch.set(sentRequestRef, { 
                    username: user.username, 
                    avatar: user.avatar, 
                    timestamp: serverTimestamp() 
                });

                const notificationRef = doc(collection(db, 'users', userId, 'notifications'));
                batch.set(notificationRef, {
                    type: 'follow_request',
                    fromUserId: currentUser.uid,
                    fromUsername: currentUser.displayName,
                    fromUserAvatar: currentUser.photoURL,
                    timestamp: serverTimestamp(),
                    read: false
                });

                await batch.commit();
                setIsRequested(true);
            } else {
                const myFollowing = doc(db, 'users', currentUser.uid, 'following', userId);
                const theirFollowers = doc(db, 'users', userId, 'followers', currentUser.uid);
                batch.set(myFollowing, { username: user.username, avatar: user.avatar, timestamp: serverTimestamp() });
                batch.set(theirFollowers, { username: currentUser.displayName, avatar: currentUser.photoURL, timestamp: serverTimestamp() });
                
                const notificationRef = doc(collection(db, 'users', userId, 'notifications'));
                batch.set(notificationRef, {
                    type: 'follow',
                    fromUserId: currentUser.uid,
                    fromUsername: currentUser.displayName,
                    fromUserAvatar: currentUser.photoURL,
                    timestamp: serverTimestamp(),
                    read: false
                });

                await batch.commit();
                setIsFollowing(true);
            }
        }
    };

    const handleUpdateProfile = async (updatedData: any) => {
        if (!currentUser) return;
        setIsSubmittingEdit(true);
        try {
            let avatarUrl = user.avatar;
            if (updatedData.avatarFile) {
                const avatarRef = storageRef(storage, `avatars/${currentUser.uid}/profile_${Date.now()}`);
                await uploadBytes(avatarRef, updatedData.avatarFile);
                avatarUrl = await getDownloadURL(avatarRef);
            }

            const updates: any = {
                username: updatedData.username,
                username_lowercase: updatedData.username.toLowerCase(),
                nickname: updatedData.nickname,
                bio: updatedData.bio,
                avatar: avatarUrl,
                isPrivate: updatedData.isPrivate,
                profileMusic: updatedData.profileMusic,
                currentVibe: updatedData.currentVibe
            };

            await updateDoc(doc(db, 'users', currentUser.uid), updates);
            await updateProfile(currentUser, {
                displayName: updatedData.username,
                photoURL: avatarUrl
            });

            setUser({ ...user, ...updates });
            setIsEditModalOpen(false);
        } catch (error) {
            console.error(error);
            alert(t('common.error'));
        } finally {
            setIsSubmittingEdit(false);
        }
    };

    const handleOpenFollowersList = () => {
        if (isOwner || !user.isPrivate || isFollowing) {
            setIsFollowersModalOpen(true);
        } else {
            alert(t('profile.privateListsMessage'));
        }
    };

    const handleOpenFollowingList = () => {
        if (isOwner || !user.isPrivate || isFollowing) {
            setIsFollowingModalOpen(true);
        } else {
            alert(t('profile.privateListsMessage'));
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout error", error);
        }
    };

    if (!user) return <div className="p-8 text-center">{t('messages.loading')}</div>;

    const hasActivePulses = pulses.length > 0;

    return (
        <div className="container mx-auto max-w-4xl p-4 sm:p-8">
            <header className="flex flex-col sm:flex-row items-center gap-8 mb-8 relative">
                <div className="absolute top-0 right-0" ref={profileMenuRef}>
                    <button 
                        onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                        className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                        aria-label={t('profile.options')}
                    >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="1.5"></circle>
                            <circle cx="6" cy="12" r="1.5"></circle>
                            <circle cx="18" cy="12" r="1.5"></circle>
                        </svg>
                    </button>

                    {isProfileMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden py-1 backdrop-blur-md bg-opacity-95">
                            {isOwner ? (
                                <button onClick={() => { handleLogout(); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-3">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                    {t('profile.logout')}
                                </button>
                            ) : (
                                <button className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 font-semibold">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                    Denunciar
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div 
                    className={`relative w-32 h-32 flex-shrink-0 cursor-pointer ${hasActivePulses ? 'p-1 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500' : ''}`}
                    onClick={() => hasActivePulses && setViewingPulses(true)}
                >
                    <div className="w-full h-full rounded-full p-1 bg-white dark:bg-black">
                        <img src={user.avatar} className="w-full h-full rounded-full object-cover" />
                    </div>
                    {user.currentVibe && (
                        <div className="absolute -top-1 -right-1 bg-white dark:bg-zinc-800 rounded-full w-10 h-10 flex items-center justify-center text-xl shadow-lg border-2 border-zinc-100 dark:border-zinc-700 animate-bounce">
                            {VIBE_EMOJIS[user.currentVibe]}
                        </div>
                    )}
                    <OnlineIndicator />
                </div>
                <div className="flex-grow text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center gap-4 mb-2">
                        <div className="flex flex-col items-center sm:items-start">
                            <h2 className="text-2xl font-light">{user.username}</h2>
                            {user.nickname && <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">@{user.nickname}</span>}
                        </div>
                        <div className="flex gap-2">
                            {isOwner ? (
                                <Button onClick={() => setIsEditModalOpen(true)} className="!w-auto !bg-zinc-200 dark:!bg-zinc-700 !text-black dark:!text-white !font-bold">{t('profile.editProfile')}</Button>
                            ) : (
                                <>
                                    <Button onClick={handleFollow} className={`!w-auto ${isFollowing || isRequested ? '!bg-zinc-200 dark:!bg-zinc-700 !text-black dark:!text-white' : ''}`}>
                                        {isFollowing ? t('header.following') : isRequested ? t('header.requested') : t('header.follow')}
                                    </Button>
                                    <Button onClick={() => onStartMessage({ id: userId, ...user })} className="!w-auto !bg-zinc-200 dark:!bg-zinc-700 !text-black dark:!text-white">{t('profile.message')}</Button>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-6 justify-center sm:justify-start text-sm mb-4">
                        <p><b>{stats.posts}</b> {t('profile.posts')}</p>
                        <button onClick={handleOpenFollowersList} className="hover:underline"><b>{stats.followers}</b> {t('profile.followers')}</button>
                        <button onClick={handleOpenFollowingList} className="hover:underline"><b>{stats.following}</b> {t('profile.followingCount')}</button>
                    </div>
                    
                    {user.bio && <p className="text-sm font-medium whitespace-pre-wrap max-w-md">{user.bio}</p>}

                    {user.profileMusic && (
                        <div className="mt-4 max-w-sm">
                            <ProfileMusicPlayer musicInfo={user.profileMusic} />
                        </div>
                    )}
                </div>
            </header>

            {user.isPrivate && !isFollowing && !isOwner ? (
                <div className="p-12 text-center border-t dark:border-zinc-800">
                    <p className="font-bold">{t('profile.privateAccountMessage')}</p>
                    <p className="text-zinc-500 text-sm mt-1">{t('profile.privateAccountSuggestion')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-1 border-t dark:border-zinc-800 pt-4">
                    {posts.map(p => (
                        <div key={p.id} className="aspect-square bg-zinc-100 dark:bg-zinc-800 overflow-hidden group relative">
                            <img src={p.imageUrl} className="w-full h-full object-cover hover:opacity-90 transition-opacity cursor-pointer" />
                        </div>
                    ))}
                </div>
            )}

            {viewingPulses && (
                <PulseViewerModal 
                    pulses={pulses} 
                    authorInfo={{ id: userId, username: user.username, avatar: user.avatar }} 
                    initialPulseIndex={0} 
                    onClose={() => setViewingPulses(false)} 
                    onDelete={(deletedPulse) => {
                        setPulses(prev => prev.filter(p => p.id !== deletedPulse.id));
                    }}
                    onViewProfile={(uid) => { setViewingPulses(false); onSelectUser?.(uid); }}
                />
            )}

            <EditProfileModal 
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                user={user}
                onUpdate={handleUpdateProfile}
                isSubmitting={isSubmittingEdit}
            />

            <FollowersModal 
                isOpen={isFollowersModalOpen}
                onClose={() => setIsFollowersModalOpen(false)}
                userId={userId}
                mode="followers"
            />
            <FollowersModal 
                isOpen={isFollowingModalOpen}
                onClose={() => setIsFollowingModalOpen(false)}
                userId={userId}
                mode="following"
            />
        </div>
    );
};

export default UserProfile;
