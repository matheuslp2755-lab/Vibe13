
import React, { useState, useEffect } from 'react';
import Header from './common/Header';
import BottomNav from './common/BottomNav';
import UserProfile from './profile/UserProfile';
import Post from './feed/Post';
import CreatePostModal from './post/CreatePostModal';
import CreatePulseModal from './pulse/CreatePulseModal';
import MessagesModal from './messages/MessagesModal';
import PulseBar from './feed/PulseBar';
import PulseViewerModal from './pulse/PulseViewerModal';
import LiveViewerModal from './live/LiveViewerModal';
import GalleryModal from './feed/gallery/GalleryModal';
import CreateVibeModal from './vibes/CreateVibeModal';
import VibeFeed from './vibes/VibeFeed';
import { auth, db, collection, query, where, getDocs, doc, deleteDoc, storage, storageRef, deleteObject, onSnapshot, orderBy } from '../firebase';
import { useLanguage } from '../context/LanguageContext';
import { useCall } from '../context/CallContext';

const Feed: React.FC = () => {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'feed' | 'vibes' | 'profile'>('feed');
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<{ file: File; preview: string }[] | null>(null);
  const [isCreationMenuOpen, setIsCreationMenuOpen] = useState(false);
  const [isCreatePulseModalOpen, setIsCreatePulseModalOpen] = useState(false);
  const [isCreateVibeModalOpen, setIsCreateVibeModalOpen] = useState(false);
  const [isMessagesModalOpen, setIsMessagesModalOpen] = useState(false);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (viewMode !== 'feed' || viewingProfileId) return;
    
    setFeedLoading(true);
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFeedPosts(posts);
        setFeedLoading(false);
    });
    return () => unsubscribe();
  }, [viewMode, viewingProfileId]);

  const handleGalleryImagesSelected = (images: { file: File, preview: string }[]) => {
      setSelectedImages(images);
      setIsGalleryModalOpen(false);
      setIsCreatePostModalOpen(true);
  };

  const handleSelectUser = (userId: string) => {
      setViewingProfileId(userId);
      setViewMode('profile');
  };

  const renderMainContent = () => {
      if (viewingProfileId || viewMode === 'profile') {
          return (
              <UserProfile 
                  userId={viewingProfileId || currentUser?.uid || ''} 
                  onStartMessage={() => setIsMessagesModalOpen(true)}
                  onSelectUser={handleSelectUser}
              />
          );
      }

      if (viewMode === 'vibes') {
          return <VibeFeed />;
      }

      return (
          <div className="container mx-auto max-w-lg py-8 pb-24">
              {feedLoading ? (
                  <div className="flex justify-center py-20">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-sky-500"></div>
                  </div>
              ) : (
                  <div className="flex flex-col gap-6">
                      {feedPosts.map(post => (
                          <Post key={post.id} post={post} onPostDeleted={(id) => setFeedPosts(prev => prev.filter(p => p.id !== id))} />
                      ))}
                  </div>
              )}
          </div>
      );
  };

  return (
    <>
      <Header 
        onSelectUser={handleSelectUser} 
        onGoHome={() => { setViewMode('feed'); setViewingProfileId(null); }} 
        onOpenMessages={() => setIsMessagesModalOpen(true)} 
      />
      
      <main className="pt-16 min-h-screen">
        {renderMainContent()}
      </main>

      <BottomNav 
        currentView={viewingProfileId ? 'profile' : viewMode} 
        onChangeView={(view) => { setViewMode(view); setViewingProfileId(null); }} 
        onCreateClick={() => setIsCreationMenuOpen(true)} 
      />
      
      {isCreationMenuOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end items-center" onClick={() => setIsCreationMenuOpen(false)}>
              <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-2xl p-4 flex flex-col gap-2 pb-8 animate-slide-up" onClick={e => e.stopPropagation()}>
                  <div className="w-12 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-4"></div>
                  <button onClick={() => { setIsCreationMenuOpen(false); setIsGalleryModalOpen(true); }} className="w-full p-4 text-left font-semibold text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl flex items-center gap-3">
                      <div className="bg-sky-100 dark:bg-sky-900 p-2 rounded-lg text-sky-600 dark:text-sky-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      {t('header.createPost')}
                  </button>
                  <button onClick={() => { setIsCreationMenuOpen(false); setIsCreatePulseModalOpen(true); }} className="w-full p-4 text-left font-semibold text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl flex items-center gap-3">
                      <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg text-purple-600 dark:text-purple-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      Moment (Story)
                  </button>
                  <button onClick={() => { setIsCreationMenuOpen(false); setIsCreateVibeModalOpen(true); }} className="w-full p-4 text-left font-semibold text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl flex items-center gap-3">
                      <div className="bg-pink-100 dark:bg-pink-900 p-2 rounded-lg text-pink-600 dark:text-pink-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      Pulse (Reels)
                  </button>
              </div>
          </div>
      )}

      <GalleryModal isOpen={isGalleryModalOpen} onClose={() => setIsGalleryModalOpen(false)} onImagesSelected={handleGalleryImagesSelected} />
      <CreatePostModal isOpen={isCreatePostModalOpen} onClose={() => setIsCreatePostModalOpen(false)} onPostCreated={() => { setIsCreatePostModalOpen(false); setViewMode('feed'); }} initialImages={selectedImages} />
      <CreatePulseModal isOpen={isCreatePulseModalOpen} onClose={() => setIsCreatePulseModalOpen(false)} onPulseCreated={() => setIsCreatePulseModalOpen(false)} />
      <CreateVibeModal isOpen={isCreateVibeModalOpen} onClose={() => setIsCreateVibeModalOpen(false)} onVibeCreated={() => { setIsCreateVibeModalOpen(false); setViewMode('vibes'); }} />
      <MessagesModal isOpen={isMessagesModalOpen} onClose={() => setIsMessagesModalOpen(false)} initialTargetUser={null} initialConversationId={null} />
    </>
  );
};

export default Feed;
