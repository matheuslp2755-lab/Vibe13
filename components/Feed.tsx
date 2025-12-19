
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
import VibeBrowser from './browser/VibeBrowser';
import { auth, db, collection, query, onSnapshot, orderBy, getDocs, where, doc, getDoc, updateDoc, arrayUnion, addDoc, serverTimestamp, deleteDoc, limit } from '../firebase';
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
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  
  const [targetUserForMessages, setTargetUserForMessages] = useState<any>(null);
  const [targetConversationId, setTargetConversationId] = useState<string | null>(null);
  
  const [selectedMedia, setSelectedMedia] = useState<any[]>([]);
  const [forwardingPost, setForwardingPost] = useState<any>(null);
  const [sharedPostToPulse, setSharedPostToPulse] = useState<any>(null);
  const [activePulseAuthor, setActivePulseAuthor] = useState<any>(null);
  
  const [editingCaptionPost, setEditingCaptionPost] = useState<any>(null);
  const [editingMusicPost, setEditingMusicPost] = useState<any>(null);
  const [duoTargetPost, setDuoTargetPost] = useState<any>(null);
  const [tagTargetPost, setTagTargetPost] = useState<any>(null);

  // Desktop Search Logic
  const [desktopSearchQuery, setDesktopSearchQuery] = useState('');
  const [desktopSearchResults, setDesktopSearchResults] = useState<any[]>([]);
  const [isDesktopSearching, setIsDesktopSearching] = useState(false);

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
    if (!desktopSearchQuery.trim()) {
      setDesktopSearchResults([]);
      return;
    }
    setIsDesktopSearching(true);
    const timeoutId = setTimeout(async () => {
      const q = query(
        collection(db, 'users'),
        where('username_lowercase', '>=', desktopSearchQuery.toLowerCase()),
        where('username_lowercase', '<=', desktopSearchQuery.toLowerCase() + '\uf8ff'),
        limit(10)
      );
      try {
        const snap = await getDocs(q);
        setDesktopSearchResults(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.id !== currentUser?.uid));
      } catch (e) {
        console.error(e);
      } finally {
        setIsDesktopSearching(false);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [desktopSearchQuery, currentUser]);

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
    setDesktopSearchQuery('');
    setDesktopSearchResults([]);
  };

  const handleOpenMessages = (user?: any, conversationId?: string) => {
    setTargetUserForMessages(user || null);
    setTargetConversationId(conversationId || null);
    setIsMessagesOpen(true);
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
      {/* Sidebar Desktop */}
      <div className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 border-r dark:border-zinc-800 bg-white dark:bg-black p-6 z-40">
        <div className="mb-10 pt-6">
            <h1 
                onClick={() => { setViewMode('feed'); setViewingProfileId(null); }} 
                className="text-6xl font-black italic cursor-pointer bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500 text-transparent bg-clip-text tracking-tighter drop-shadow-[0_10px_20px_rgba(168,85,247,0.5)] transition-all hover:scale-105 active:scale-95 animate-pulse-slow"
            >
                Vibe
            </h1>
        </div>

        {/* Desktop Search Bar */}
        <div className="mb-8 relative">
            <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900 border border-transparent focus-within:border-zinc-300 dark:focus-within:border-zinc-700 rounded-xl px-3 py-2 transition-all">
                <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input 
                    type="text" 
                    placeholder={t('header.searchPlaceholder')}
                    value={desktopSearchQuery}
                    onChange={e => setDesktopSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none font-medium"
                />
            </div>
            {desktopSearchQuery && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-50 animate-fade-in">
                    {isDesktopSearching ? (
                        <div className="p-4 flex justify-center"><div className="w-5 h-5 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin"></div></div>
                    ) : desktopSearchResults.length > 0 ? desktopSearchResults.map(user => (
                        <div key={user.id} onClick={() => handleSelectUser(user.id)} className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors border-b last:border-0 dark:border-zinc-800">
                            <img src={user.avatar} className="w-10 h-10 rounded-full object-cover border dark:border-zinc-700" />
                            <span className="text-sm font-bold">{user.username}</span>
                        </div>
                    )) : <p className="p-4 text-center text-xs text-zinc-500 font-bold">{t('header.noResults')}</p>}
                </div>
            )}
        </div>

        <nav className="flex flex-col gap-4">
            <button onClick={() => { setViewMode('feed'); setViewingProfileId(null); }} className={`flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all ${viewMode === 'feed' && !viewingProfileId ? 'font-bold bg-zinc-50 dark:bg-zinc-900 shadow-sm' : ''}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7-7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                <span>{t('header.home')}</span>
            </button>
            <button onClick={() => setViewMode('vibes')} className={`flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all ${viewMode === 'vibes' ? 'font-bold bg-zinc-50 dark:bg-zinc-900 shadow-sm' : ''}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>{t('header.vibes')}</span>
            </button>
            <button onClick={() => handleOpenMessages()} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                <span>{t('header.messages')}</span>
            </button>
            <button onClick={() => setIsBrowserOpen(true)} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                <span>{t('header.browser')}</span>
            </button>
            <button onClick={() => setIsMenuOpen(true)} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span>{t('header.create')}</span>
            </button>
            <button onClick={() => handleSelectUser(currentUser?.uid || '')} className={`flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all ${viewMode === 'profile' && viewingProfileId === currentUser?.uid ? 'font-bold bg-zinc-50 dark:bg-zinc-900 shadow-sm' : ''}`}>
                <img src={currentUser?.photoURL || ''} className="w-6 h-6 rounded-full object-cover border dark:border-zinc-700" />
                <span>{t('header.profile')}</span>
            </button>
        </nav>
        <button onClick={() => auth.signOut()} className="mt-auto flex items-center gap-4 p-3 rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-all font-semibold">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span>{t('header.logOut')}</span>
        </button>
      </div>
      
      {/* Oculta Header no Mobile se for Vibes */}
      <div className={`${viewMode === 'vibes' ? 'hidden' : 'block'} lg:hidden`}>
        <Header 
            onSelectUser={handleSelectUser} 
            onGoHome={() => { setViewMode('feed'); setViewingProfileId(null); }} 
            onOpenMessages={(id) => handleOpenMessages(null, id)} 
            onOpenBrowser={() => setIsBrowserOpen(true)}
        />
      </div>

      <main className={`transition-all duration-300 ${viewMode === 'vibes' ? 'lg:pl-64 h-[calc(100dvh-4rem)] lg:h-auto' : 'lg:pl-64 lg:pr-4 pt-16 lg:pt-8'}`}>
        {viewMode === 'vibes' ? <VibeFeed /> : 
         viewMode === 'profile' || viewingProfileId ? (
           <div className="container mx-auto max-w-4xl py-4">
             <UserProfile userId={viewingProfileId || currentUser?.uid || ''} onStartMessage={(u) => handleOpenMessages(u)} onSelectUser={handleSelectUser} />
           </div>
         ) : (
          <div className="container mx-auto max-w-lg py-4 pb-24 px-4">
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
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl lg:rounded-3xl p-6 flex flex-col gap-3 pb-10 lg:pb-6 lg:w-[400px] lg:shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="hidden lg:block text-center font-black text-lg mb-4 border-b dark:border-zinc-800 pb-4">O que você vai postar?</h3>
            <button onClick={() => { setIsMenuOpen(false); setIsGalleryOpen(true); }} className="w-full p-4 text-left font-bold rounded-2xl border dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center justify-between group">
                <span>{t('header.createPost')}</span>
                <svg className="w-5 h-5 text-zinc-400 group-hover:text-sky-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
            </button>
            <button onClick={() => { setIsMenuOpen(false); setIsCreatePulseOpen(true); }} className="w-full p-4 text-left font-bold rounded-2xl border dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center justify-between group">
                <span>{t('header.createPulse')}</span>
                <svg className="w-5 h-5 text-zinc-400 group-hover:text-purple-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
            </button>
            <button onClick={() => { setIsMenuOpen(false); setIsCreateVibeOpen(true); }} className="w-full p-4 text-left font-bold rounded-2xl border dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center justify-between group">
                <span>{t('header.createVibe')}</span>
                <svg className="w-5 h-5 text-zinc-400 group-hover:text-pink-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
            </button>
            <button onClick={() => { setIsMenuOpen(false); setIsCreateStatusOpen(true); }} className="w-full p-4 text-left font-bold rounded-2xl border dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center justify-between group">
                <span>{t('header.createStatus')}</span>
                <svg className="w-5 h-5 text-zinc-400 group-hover:text-amber-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
            </button>
            <button onClick={() => setIsMenuOpen(false)} className="w-full p-4 text-center text-zinc-500 font-bold mt-2 lg:hidden">{t('common.cancel')}</button>
          </div>
        </div>
      )}

      <GalleryModal isOpen={isGalleryOpen} onClose={() => setIsGalleryOpen(false)} onImagesSelected={imgs => { setSelectedMedia(imgs); setIsGalleryOpen(false); setIsCreatePostOpen(true); }} />
      <CreatePostModal isOpen={isCreatePostOpen} onClose={() => setIsCreatePostOpen(false)} onPostCreated={() => setIsCreatePostOpen(false)} initialImages={selectedMedia} />
      <CreatePulseModal 
        isOpen={isCreatePulseOpen} 
        onClose={() => { setIsCreatePulseOpen(false); setSharedPostToPulse(null); }} 
        onPulseCreated={() => setIsCreatePulseOpen(false)} 
        initialSharedContent={sharedPostToPulse}
      />
      <CreateVibeModal isOpen={isCreateVibeOpen} onClose={() => setIsCreateVibeOpen(false)} onVibeCreated={() => setViewMode('vibes')} />
      <CreateStatusModal isOpen={isCreateStatusOpen} onClose={() => setIsCreateStatusOpen(false)} onPostCreated={() => { setViewMode('feed'); setViewingProfileId(null); }} />
      <MessagesModal 
        isOpen={isMessagesOpen} 
        onClose={() => {
            setIsMessagesOpen(false);
            setTargetUserForMessages(null);
            setTargetConversationId(null);
        }} 
        initialTargetUser={targetUserForMessages} 
        initialConversationId={targetConversationId} 
      />
      
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

      {forwardingPost && (
        <ForwardModal 
          isOpen={true} 
          onClose={() => setForwardingPost(null)} 
          post={forwardingPost} 
          onShareToPulse={(content) => {
            setSharedPostToPulse(content);
            setForwardingPost(null);
            setIsCreatePulseOpen(true);
          }}
        />
      )}
      {editingCaptionPost && <AddCaptionModal isOpen={true} onClose={() => setEditingCaptionPost(null)} postId={editingCaptionPost.id} onCaptionSaved={() => setEditingCaptionPost(null)} />}
      {editingMusicPost && <AddMusicModal isOpen={true} onClose={() => setEditingMusicPost(null)} postId={editingMusicPost.id} onMusicAdded={() => setEditingMusicPost(null)} />}
      
      <SearchFollowingModal isOpen={!!duoTargetPost} onClose={() => setDuoTargetPost(null)} title={t('post.inviteDuo')} onSelect={u => {}} />
      <SearchFollowingModal isOpen={!!tagTargetPost} onClose={() => setTagTargetPost(null)} title={t('post.tagFriends')} onSelect={u => {}} />

      {isBrowserOpen && <VibeBrowser onClose={() => setIsBrowserOpen(false)} />}

      <style>{`
        @keyframes pulse-slow {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.9; transform: scale(1.02); }
        }
        .animate-pulse-slow {
            animation: pulse-slow 4s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Feed;
