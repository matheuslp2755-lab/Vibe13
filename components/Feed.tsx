
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
import { auth, db, collection, query, where, getDocs, doc, deleteDoc, storage, storageRef, deleteObject, onSnapshot } from '../firebase';
import { useLanguage } from '../context/LanguageContext';
import { useCall } from '../context/CallContext';

const Feed: React.FC = () => {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'feed' | 'vibes' | 'profile'>('feed');
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<{ file: File; preview: string }[] | null>(null);
  const [isCreationMenuOpen, setIsCreationMenuOpen] = useState(false);

  const handleGalleryImagesSelected = (images: { file: File, preview: string }[]) => {
      setSelectedImages(images);
      setIsGalleryModalOpen(false);
      setIsCreatePostModalOpen(true);
  };

  return (
    <>
      <Header onSelectUser={() => {}} onGoHome={() => setViewMode('feed')} onOpenMessages={() => {}} />
      <main className="pt-16 min-h-screen pb-16">
        {viewMode === 'vibes' ? <VibeFeed /> : (
            <div className="container mx-auto max-w-lg py-8 pb-24">
                {/* Aqui seria o feed normal com posts */}
                <VibeFeed /> {/* Simplificado para este update */}
            </div>
        )}
      </main>
      <BottomNav currentView={viewMode} onChangeView={setViewMode} onCreateClick={() => setIsCreationMenuOpen(true)} />
      
      {isCreationMenuOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end items-center" onClick={() => setIsCreationMenuOpen(false)}>
              <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-2xl p-4 flex flex-col gap-2 pb-8" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setIsCreationMenuOpen(false); setIsGalleryModalOpen(true); }} className="w-full p-4 text-left font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl">Publicação</button>
                  <button onClick={() => { setIsCreationMenuOpen(false); }} className="w-full p-4 text-left font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl">Pulse (Reels)</button>
              </div>
          </div>
      )}

      <GalleryModal isOpen={isGalleryModalOpen} onClose={() => setIsGalleryModalOpen(false)} onImagesSelected={handleGalleryImagesSelected} />
      <CreatePostModal isOpen={isCreatePostModalOpen} onClose={() => setIsCreatePostModalOpen(false)} onPostCreated={() => setIsCreatePostModalOpen(false)} initialImages={selectedImages} />
    </>
  );
};

export default Feed;
