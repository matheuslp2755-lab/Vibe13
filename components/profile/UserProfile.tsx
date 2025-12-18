
import React, { useState, useEffect } from 'react';
import { auth, db, doc, getDoc, collection, getDocs, setDoc, deleteDoc, serverTimestamp, updateDoc, query, where, orderBy, onSnapshot, writeBatch } from '../../firebase';
import Button from '../common/Button';
import EditProfileModal from './EditProfileModal';
import OnlineIndicator from '../common/OnlineIndicator';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';
import PulseViewerModal from '../pulse/PulseViewerModal';

interface UserProfileProps {
    userId: string;
    onStartMessage: (user: any) => void;
    onSelectUser?: (userId: string) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ userId, onStartMessage, onSelectUser }) => {
    const { t } = useLanguage();
    const { startCall } = useCall();
    const [user, setUser] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [pulses, setPulses] = useState<any[]>([]);
    const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
    const [isFollowing, setIsFollowing] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
    const [viewingPulses, setViewingPulses] = useState(false);
    
    const currentUser = auth.currentUser;

    useEffect(() => {
        let unsubscribePosts: (() => void) | undefined;
        let unsubscribePulses: (() => void) | undefined;

        const fetchUserData = async () => {
            const userSnap = await getDoc(doc(db, 'users', userId));
            if (userSnap.exists()) {
                setUser(userSnap.data());
                
                if (currentUser) {
                    const followSnap = await getDoc(doc(db, 'users', currentUser.uid, 'following', userId));
                    setIsFollowing(followSnap.exists());
                    const blockSnap = await getDoc(doc(db, 'users', currentUser.uid, 'blocked', userId));
                    setIsBlocked(blockSnap.exists());
                }

                // Posts Listener
                const postsQ = query(collection(db, 'posts'), where('userId', '==', userId), orderBy('timestamp', 'desc'));
                unsubscribePosts = onSnapshot(postsQ, (snap) => {
                    setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                    setStats(prev => ({ ...prev, posts: snap.size }));
                });

                // Pulses Listener (últimas 24h)
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const pulsesQ = query(
                    collection(db, 'pulses'), 
                    where('authorId', '==', userId), 
                    where('createdAt', '>=', twentyFourHoursAgo),
                    orderBy('createdAt', 'asc')
                );
                unsubscribePulses = onSnapshot(pulsesQ, (snap) => {
                    setPulses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                });

                // Stats de seguidores/seguindo
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

    const handleFollow = async () => {
        if (!currentUser || !user) return;
        const batch = writeBatch(db);
        const myFollowing = doc(db, 'users', currentUser.uid, 'following', userId);
        const theirFollowers = doc(db, 'users', userId, 'followers', currentUser.uid);

        if (isFollowing) {
            batch.delete(myFollowing);
            batch.delete(theirFollowers);
        } else {
            batch.set(myFollowing, { username: user.username, avatar: user.avatar, timestamp: serverTimestamp() });
            batch.set(theirFollowers, { username: currentUser.displayName, avatar: currentUser.photoURL, timestamp: serverTimestamp() });
        }
        await batch.commit();
        setIsFollowing(!isFollowing);
    };

    const handleBlock = async () => {
        if (!currentUser) return;
        const blockRef = doc(db, 'users', currentUser.uid, 'blocked', userId);
        if (isBlocked) {
            await deleteDoc(blockRef);
        } else {
            await setDoc(blockRef, { timestamp: serverTimestamp() });
            if (isFollowing) handleFollow();
        }
        setIsBlocked(!isBlocked);
        setIsOptionsMenuOpen(false);
    };

    if (!user) return <div className="p-8 text-center">Carregando...</div>;

    const hasActivePulses = pulses.length > 0;

    return (
        <div className="container mx-auto max-w-4xl p-4 sm:p-8">
            <header className="flex flex-col sm:flex-row items-center gap-8 mb-8">
                <div 
                    className={`relative w-32 h-32 flex-shrink-0 cursor-pointer ${hasActivePulses ? 'p-1 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500' : ''}`}
                    onClick={() => hasActivePulses && setViewingPulses(true)}
                >
                    <div className="w-full h-full rounded-full p-1 bg-white dark:bg-black">
                        <img src={user.avatar} className="w-full h-full rounded-full object-cover" />
                    </div>
                    <OnlineIndicator />
                </div>
                <div className="flex-grow text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                        <h2 className="text-2xl font-light">{user.username}</h2>
                        <div className="flex gap-2">
                            {currentUser?.uid === userId ? (
                                <Button className="!w-auto !bg-zinc-200 dark:!bg-zinc-700 !text-black dark:!text-white">Editar Perfil</Button>
                            ) : (
                                <>
                                    <Button onClick={handleFollow} className={`!w-auto ${isFollowing ? '!bg-zinc-200 dark:!bg-zinc-700 !text-black dark:!text-white' : ''}`}>
                                        {isFollowing ? 'Seguindo' : 'Seguir'}
                                    </Button>
                                    <Button onClick={() => onStartMessage(user)} className="!w-auto !bg-zinc-200 dark:!bg-zinc-700 !text-black dark:!text-white">Mensagem</Button>
                                    <div className="relative">
                                        <button onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)} className="p-2 rounded-lg bg-zinc-200 dark:bg-zinc-700"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"/></svg></button>
                                        {isOptionsMenuOpen && (
                                            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden">
                                                <button onClick={handleBlock} className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold">
                                                    {isBlocked ? 'Desbloquear' : 'Bloquear'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-6 justify-center sm:justify-start text-sm">
                        <p><b>{stats.posts}</b> publicações</p>
                        <p><b>{stats.followers}</b> seguidores</p>
                        <p><b>{stats.following}</b> seguindo</p>
                    </div>
                    <p className="mt-4 text-sm font-medium">{user.bio}</p>
                </div>
            </header>

            {isBlocked ? (
                <div className="p-12 text-center border-t dark:border-zinc-800">
                    <p className="font-bold">Você bloqueou este usuário.</p>
                    <p className="text-zinc-500 text-sm mt-1">Desbloqueie para ver as publicações.</p>
                </div>
            ) : user.isPrivate && !isFollowing && currentUser?.uid !== userId ? (
                <div className="p-12 text-center border-t dark:border-zinc-800">
                    <p className="font-bold">Esta conta é privada.</p>
                    <p className="text-zinc-500 text-sm mt-1">Siga para ver fotos e vídeos.</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-1 border-t dark:border-zinc-800 pt-4">
                    {posts.map(p => (
                        <div key={p.id} className="aspect-square bg-zinc-100 dark:bg-zinc-800 overflow-hidden group relative">
                            <img src={p.imageUrl} className="w-full h-full object-cover hover:opacity-90 transition-opacity cursor-pointer" />
                            {p.media && p.media.length > 1 && (
                                <div className="absolute top-2 right-2">
                                    <svg className="w-4 h-4 text-white drop-shadow-md" fill="currentColor" viewBox="0 0 24 24"><path d="M19 15V5c0-1.103-.897-2-2-2H7c-1.103 0-2 .897-2 2v10c0 1.103.897 2 2 2h10c1.103 0 2-.897 2-2zM7 5h10v10H7V5zm10 14H5V7H3v12c0 1.103.897 2 2 2h12v-2z"/></svg>
                                </div>
                            )}
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
                />
            )}
        </div>
    );
};

export default UserProfile;
