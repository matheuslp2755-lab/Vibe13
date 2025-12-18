
import React, { useState, useEffect, useRef } from 'react';
import Header from './common/Header';
import BottomNav from './common/BottomNav';
import UserProfile from './profile/UserProfile';
import Post from './feed/Post';
import CreatePostModal from './post/CreatePostModal';
import CreatePulseModal from './pulse/CreatePulseModal';
import CreateStatusModal from './post/CreateStatusModal';
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
import { auth, db, collection, query, onSnapshot, orderBy, getDocs, where, doc, getDoc, updateDoc, arrayUnion, addDoc, serverTimestamp, deleteDoc } from '../firebase';
import { useLanguage } from '../context/LanguageContext';

const Feed: React.FC = () => {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'feed' | 'vibes' | 'profile'>('feed');
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [usersWithPulses, setUsersWithPulses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [isAnyPulseOpen, setIsAnyPulseOpen] = useState(false);
  
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isCreatePulseOpen, setIsCreatePulseOpen] = useState(false);
  const [isCreateVibeOpen, setIsCreateVibeOpen] = useState(false);
  const [isCreateStatusOpen, setIsCreateStatusOpen] = useState(false);
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

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActivePostId(entry.target.getAttribute('data-post-id'));
          }
        });
      },
      { threshold: 0.6 }
    );

    const elements = document.querySelectorAll('[data-post-id]');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [posts, viewMode, viewingProfileId]);

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

  const handlePostDeleted = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'posts', id));
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error("Error deleting post from Firestore:", error);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Sidebar Desktop com Logo Destacado */}
      <div className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 border-r dark:border-zinc-800 bg-white dark:bg-black p-6 z-40">
        <div className="mb-10 pt-2">
            <h1 
                onClick={() => { setViewMode('feed'); setViewingProfileId(null); }} 
                className="text-4xl font-serif cursor-pointer font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-transparent bg-clip-text tracking-tighter"
            >
                {t('header.title')}
            </h1>
        </div>
        <nav className="flex flex-col gap-4">
            <button onClick={() => { setViewMode('feed'); setViewingProfileId(null); }} className={`flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors ${viewMode === 'feed' ? 'font-bold' : ''}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7-7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                <span>{t('header.home')}</span>
            </button>
            <button onClick={() => setViewMode('vibes')} className={`flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors ${viewMode === 'vibes' ? 'font-bold' : ''}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>{t('header.vibes')}</span>
            </button>
            <button onClick={() => setIsMessagesOpen(true)} className="flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                <span>{t('header.messages')}</span>
            </button>
            <button onClick={() => setIsMenuOpen(true)} className="flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span>{t('header.create')}</span>
            </button>
            <button onClick={() => handleSelectUser(currentUser?.uid || '')} className={`flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors ${viewMode === 'profile' && viewingProfileId === currentUser?.uid ? 'font-bold' : ''}`}>
                <img src={currentUser?.photoURL || ''} className="w-6 h-6 rounded-full object-cover" />
                <span>{t('header.profile')}</span>
            </button>
        </nav>
        <button onClick={() => auth.signOut()} className="mt-auto flex items-center gap-4 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span>{t('header.logOut')}</span>
        </button>
      </div>
      
      <div className="lg:hidden">
        <Header onSelectUser={handleSelectUser} onGoHome={() => { setViewMode('feed'); setViewingProfileId(null); }} onOpenMessages={() => setIsMessagesOpen(true)} />
      </div>

      <main className={`transition-all duration-300 ${viewMode === 'vibes' ? 'lg:pl-64' : 'lg:pl-64 lg:pr-4'}`}>
        {viewMode === 'vibes' ? <VibeFeed /> : 
         viewMode === 'profile' || viewingProfileId ? (
           <div className="container mx-auto max-w-4xl py-4 pt-16 lg:pt-8">
             <UserProfile userId={viewingProfileId || currentUser?.uid || ''} onStartMessage={() => setIsMessagesOpen(true)} onSelectUser={handleSelectUser} />
           </div>
         ) : (
          <div className="container mx-auto max-w-lg py-4 pb-24 px-4 pt-16 lg:pt-8">
            <PulseBar usersWithPulses={usersWithPulses} onViewPulses={id => {
                const author = usersWithPulses.find(u => u.author.id === id);
                if (author) {
                  setActivePulseAuthor(author);
                  setIsAnyPulseOpen(true);
                }
            }} />
            <div className="flex flex-col gap-4 mt-4">
                {posts.map(p => (
                  <div key={p.id} data-post-id={p.id}>
                    <Post 
                      post={p} 
                      isActive={p.id === activePostId && !isAnyPulseOpen}
                      onPostDeleted={handlePostDeleted} 
                      onForward={setForwardingPost}
                      onEditCaption={setEditingCaptionPost}
                      onEditMusic={setEditingMusicPost}
                      onInviteDuo={setDuoTargetPost}
                      onManageTags={setTagTargetPost}
                    />
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>

      <div className="lg:hidden">
        <BottomNav currentView={viewingProfileId ? 'profile' : viewMode} onChangeView={v => { setViewMode(v); setViewingProfileId(null); }} onCreateClick={() => setIsMenuOpen(true)} />
      </div>

      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end lg:items-center lg:justify-center" onClick={() => setIsMenuOpen(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-t-2xl lg:rounded-2xl p-4 flex flex-col gap-2 pb-10 lg:pb-4 lg:w-96 lg:shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="hidden lg:block text-center font-bold mb-4 border-b dark:border-zinc-800 pb-4">O que deseja criar?</h3>
            <button onClick={() => { setIsMenuOpen(false); setIsGalleryOpen(true); }} className="w-full p-4 text-left font-bold border-b dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">{t('header.createPost')}</button>
            <button onClick={() => { setIsMenuOpen(false); setIsCreatePulseOpen(true); }} className="w-full p-4 text-left font-bold border-b dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">{t('header.createPulse')}</button>
            <button onClick={() => { setIsMenuOpen(false); setIsCreateVibeOpen(true); }} className="w-full p-4 text-left font-bold border-b dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">{t('header.createVibe')}</button>
            <button onClick={() => { setIsMenuOpen(false); setIsCreateStatusOpen(true); }} className="w-full p-4 text-left font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">{t('header.createStatus')}</button>
            <button onClick={() => setIsMenuOpen(false)} className="w-full p-4 text-center text-zinc-500 font-semibold mt-2 lg:hidden">{t('common.cancel')}</button>
          </div>
        </div>
      )}

      <GalleryModal isOpen={isGalleryOpen} onClose={() => setIsGalleryOpen(false)} onImagesSelected={imgs => { setSelectedMedia(imgs); setIsGalleryOpen(false); setIsCreatePostOpen(true); }} />
      <CreatePostModal isOpen={isCreatePostOpen} onClose={() => setIsCreatePostOpen(false)} onPostCreated={() => setIsCreatePostOpen(false)} initialImages={selectedMedia} />
      <CreatePulseModal isOpen={isCreatePulseOpen} onClose={() => setIsCreatePulseOpen(false)} onPulseCreated={() => setIsCreatePulseOpen(false)} />
      <CreateVibeModal isOpen={isCreateVibeOpen} onClose={() => setIsCreateVibeOpen(false)} onVibeCreated={() => setViewMode('vibes')} />
      <CreateStatusModal isOpen={isCreateStatusOpen} onClose={() => setIsCreateStatusOpen(false)} onPostCreated={() => { setViewMode('feed'); setViewingProfileId(null); }} />
      <MessagesModal isOpen={isMessagesOpen} onClose={() => setIsMessagesOpen(false)} initialTargetUser={null} initialConversationId={null} />
      
      {activePulseAuthor && (
          <PulseViewerModal 
            pulses={activePulseAuthor.pulses} 
            authorInfo={activePulseAuthor.author} 
            initialPulseIndex={0} 
            onClose={() => { setActivePulseAuthor(null); setIsAnyPulseOpen(false); }} 
            onDelete={(deletedPulse) => {
                setActivePulseAuthor((prev: any) => {
                    if (!prev) return null;
                    const updatedPulses = prev.pulses.filter((p: any) => p.id !== deletedPulse.id);
                    if (updatedPulses.length === 0) {
                      setIsAnyPulseOpen(false);
                      return null;
                    }
                    return { ...prev, pulses: updatedPulses };
                });
            }} 
            onViewProfile={handleSelectUser}
          />
      )}

      {forwardingPost && <ForwardModal isOpen={true} onClose={() => setForwardingPost(null)} post={forwardingPost} />}
      {editingCaptionPost && <AddCaptionModal isOpen={true} onClose={() => setEditingCaptionPost(null)} postId={editingCaptionPost.id} onCaptionSaved={() => setEditingCaptionPost(null)} />}
      {editingMusicPost && <AddMusicModal isOpen={true} onClose={() => setEditingMusicPost(null)} postId={editingMusicPost.id} onMusicAdded={() => setEditingMusicPost(null)} />}
      
      <SearchFollowingModal isOpen={!!duoTargetPost} onClose={() => setDuoTargetPost(null)} title={t('post.inviteDuo')} onSelect={u => {}} />
      <SearchFollowingModal isOpen={!!tagTargetPost} onClose={() => setTagTargetPost(null)} title={t('post.tagFriends')} onSelect={u => {}} />
    </div>
  );
};

export default Feed;
