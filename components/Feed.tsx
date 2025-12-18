
import React, { useState, useEffect } from 'react';
import Header from './common/Header';
import BottomNav from './common/BottomNav';
import UserProfile from './profile/UserProfile';
import Post from './feed/Post';
import CreatePostModal from './post/CreatePostModal';
import CreatePulseModal from './pulse/CreatePulseModal';
import PulseViewerModal from './pulse/PulseViewerModal';
import MessagesModal from './messages/MessagesModal';
import PulseBar from './feed/PulseBar';
import GalleryModal from './feed/gallery/GalleryModal';
import CreateVibeModal from './vibes/CreateVibeModal';
import VibeFeed from './vibes/VibeFeed';
import ForwardModal from './messages/ForwardModal';
import AddCaptionModal from './post/AddCaptionModal';
import AddMusicModal from './post/AddMusicModal';
import SearchFollowingModal from './post/SearchFollowingModal';
import { auth, db, collection, query, onSnapshot, orderBy, getDocs, where, doc, getDoc, updateDoc, arrayUnion } from '../firebase';
import { useLanguage } from '../context/LanguageContext';

const Feed: React.FC = () => {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'feed' | 'vibes' | 'profile'>('feed');
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [usersWithPulses, setUsersWithPulses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isCreatePulseOpen, setIsCreatePulseOpen] = useState(false);
  const [isCreateVibeOpen, setIsCreateVibeOpen] = useState(false);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [selectedMedia, setSelectedMedia] = useState<any[]>([]);
  const [forwardingPost, setForwardingPost] = useState<any>(null);
  const [activePulseAuthor, setActivePulseAuthor] = useState<any>(null);
  
  const [editingCaptionPost, setEditingCaptionPost] = useState<any>(null);
  const [editingMusicPost, setEditingMusicPost] = useState<any>(null);
  const [duoTargetPost, setDuoTargetPost] = useState<any>(null);
  const [tagTargetPost, setTagTargetPost] = useState<any>(null);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (viewMode === 'feed' && !viewingProfileId) {
      const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
      return onSnapshot(q, (snap) => {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });
    }
  }, [viewMode, viewingProfileId]);

  // Listener para Pulses (Stories)
  useEffect(() => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const q = query(collection(db, 'pulses'), where('createdAt', '>=', twentyFourHoursAgo));
    
    return onSnapshot(q, async (snap) => {
        const pulseList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const grouped = new Map();
        
        for (const pulse of pulseList as any[]) {
            if (!grouped.has(pulse.authorId)) {
                const authorSnap = await getDoc(doc(db, 'users', pulse.authorId));
                if (authorSnap.exists()) {
                    grouped.set(pulse.authorId, {
                        author: { id: pulse.authorId, ...authorSnap.data() },
                        pulses: []
                    });
                }
            }
            if (grouped.has(pulse.authorId)) {
                grouped.get(pulse.authorId).pulses.push(pulse);
            }
        }
        
        // Ordenar pulsos por data dentro de cada autor
        grouped.forEach(group => {
            group.pulses.sort((a: any, b: any) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        });

        setUsersWithPulses(Array.from(grouped.values()));
    });
  }, []);

  const handleSelectUser = (id: string) => {
    setViewingProfileId(id);
    setViewMode('profile');
  };

  const handleDuoSelect = async (user: any) => {
    if (!duoTargetPost) return;
    await updateDoc(doc(db, 'posts', duoTargetPost.id), {
        duoPartner: { userId: user.id, username: user.username, userAvatar: user.avatar }
    });
    setDuoTargetPost(null);
  };

  const handleTagSelect = async (user: any) => {
    if (!tagTargetPost) return;
    await updateDoc(doc(db, 'posts', tagTargetPost.id), {
        tags: arrayUnion({ userId: user.id, username: user.username })
    });
    setTagTargetPost(null);
  };

  return (
    <>
      <Header onSelectUser={handleSelectUser} onGoHome={() => { setViewMode('feed'); setViewingProfileId(null); }} onOpenMessages={() => setIsMessagesOpen(true)} />

      <main className="pt-16 min-h-screen">
        {viewMode === 'vibes' ? <VibeFeed /> : 
         viewMode === 'profile' || viewingProfileId ? <UserProfile userId={viewingProfileId || currentUser?.uid || ''} onStartMessage={() => setIsMessagesOpen(true)} onSelectUser={handleSelectUser} /> : (
          <div className="container mx-auto max-w-lg py-4 pb-24 px-4">
            <PulseBar usersWithPulses={usersWithPulses} onViewPulses={id => {
                const author = usersWithPulses.find(u => u.author.id === id);
                if (author) setActivePulseAuthor(author);
            }} />
            <div className="flex flex-col gap-4 mt-4">
                {posts.map(p => (
                  <Post 
                    key={p.id} 
                    post={p} 
                    onPostDeleted={id => setPosts(prev => prev.filter(x => x.id !== id))} 
                    onForward={setForwardingPost}
                    onEditCaption={setEditingCaptionPost}
                    onEditMusic={setEditingMusicPost}
                    onInviteDuo={setDuoTargetPost}
                    onManageTags={setTagTargetPost}
                  />
                ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav currentView={viewingProfileId ? 'profile' : viewMode} onChangeView={v => { setViewMode(v); setViewingProfileId(null); }} onCreateClick={() => setIsMenuOpen(true)} />

      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end" onClick={() => setIsMenuOpen(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-t-2xl p-4 flex flex-col gap-2 pb-10" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setIsMenuOpen(false); setIsGalleryOpen(true); }} className="w-full p-4 text-left font-bold border-b dark:border-zinc-800">{t('header.createPost')}</button>
            <button onClick={() => { setIsMenuOpen(false); setIsCreatePulseOpen(true); }} className="w-full p-4 text-left font-bold border-b dark:border-zinc-800">{t('header.createPulse')}</button>
            <button onClick={() => { setIsMenuOpen(false); setIsCreateVibeOpen(true); }} className="w-full p-4 text-left font-bold">{t('header.createVibe')}</button>
            <button onClick={() => setIsMenuOpen(false)} className="w-full p-4 text-center text-zinc-500 font-semibold">{t('common.cancel')}</button>
          </div>
        </div>
      )}

      <GalleryModal isOpen={isGalleryOpen} onClose={() => setIsGalleryOpen(false)} onImagesSelected={imgs => { setSelectedMedia(imgs); setIsGalleryOpen(false); setIsCreatePostOpen(true); }} />
      <CreatePostModal isOpen={isCreatePostOpen} onClose={() => setIsCreatePostOpen(false)} onPostCreated={() => setIsCreatePostOpen(false)} initialImages={selectedMedia} />
      <CreatePulseModal isOpen={isCreatePulseOpen} onClose={() => setIsCreatePulseOpen(false)} onPulseCreated={() => setIsCreatePulseOpen(false)} />
      <CreateVibeModal isOpen={isCreateVibeOpen} onClose={() => setIsCreateVibeOpen(false)} onVibeCreated={() => setViewMode('vibes')} />
      <MessagesModal isOpen={isMessagesOpen} onClose={() => setIsMessagesOpen(false)} initialTargetUser={null} initialConversationId={null} />
      
      {activePulseAuthor && (
          <PulseViewerModal 
            pulses={activePulseAuthor.pulses} 
            authorInfo={activePulseAuthor.author} 
            initialPulseIndex={0} 
            onClose={() => setActivePulseAuthor(null)} 
            onDelete={(deletedPulse) => {
                // Atualização otimista: remove o pulso deletado da lista local para não precisar de re-fetch
                setActivePulseAuthor((prev: any) => {
                    if (!prev) return null;
                    const updatedPulses = prev.pulses.filter((p: any) => p.id !== deletedPulse.id);
                    if (updatedPulses.length === 0) return null;
                    return { ...prev, pulses: updatedPulses };
                });
            }} 
            onViewProfile={handleSelectUser}
          />
      )}

      {forwardingPost && <ForwardModal isOpen={true} onClose={() => setForwardingPost(null)} post={forwardingPost} />}
      {editingCaptionPost && <AddCaptionModal isOpen={true} onClose={() => setEditingCaptionPost(null)} postId={editingCaptionPost.id} onCaptionSaved={() => setEditingCaptionPost(null)} />}
      {editingMusicPost && <AddMusicModal isOpen={true} onClose={() => setEditingMusicPost(null)} postId={editingMusicPost.id} onMusicAdded={() => setEditingMusicPost(null)} />}
      
      <SearchFollowingModal isOpen={!!duoTargetPost} onClose={() => setDuoTargetPost(null)} title={t('post.inviteDuo')} onSelect={handleDuoSelect} />
      <SearchFollowingModal isOpen={!!tagTargetPost} onClose={() => setTagTargetPost(null)} title={t('post.tagFriends')} onSelect={handleTagSelect} />
    </>
  );
};

export default Feed;
