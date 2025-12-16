
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

const Spinner: React.FC = () => (
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-sky-500"></div>
);

type PostType = {
    id: string;
    userId: string;
    username: string;
    userAvatar: string;
    imageUrl: string;
    caption: string;
    likes: string[]; // array of userIds
    timestamp: { seconds: number; nanoseconds: number };
    isVentMode?: boolean;
    allowedUsers?: string[];
    musicInfo?: {
      nome: string;
      artista: string;
      capa: string;
      preview: string;
      startTime?: number;
    };
    duoPartner?: { userId: string; username: string; userAvatar: string; };
    pendingDuoPartner?: { userId: string; username: string; userAvatar: string; };
};

type PulseType = {
    id: string;
    mediaUrl: string;
    legenda: string;
    createdAt: { seconds: number; nanoseconds: number };
    authorId: string;
    isVentMode?: boolean;
    allowedUsers?: string[];
};

type UserWithPulses = {
    author: {
        id: string;
        username: string;
        avatar: string;
    };
    pulses: PulseType[];
}

type LiveSession = {
    liveId: string;
    host: {
        id: string;
        username: string;
        avatar: string;
    };
    status: 'live' | 'ended';
};


const EmptyFeed: React.FC = () => {
    const { t } = useLanguage();
    return (
      <div className="container mx-auto max-w-lg py-8">
        <div className="flex flex-col items-center justify-center text-center p-16 bg-white dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-zinc-300 dark:text-zinc-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <h2 className="text-2xl font-bold mb-2">{t('feed.welcome')}</h2>
          <p className="text-zinc-500 dark:text-zinc-400">
            {t('feed.empty')}
          </p>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            {t('feed.emptySuggestion')}
          </p>
        </div>
      </div>
    );
};


const Feed: React.FC = () => {
  const { t } = useLanguage();
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [profileKey, setProfileKey] = useState(0);
  const [feedPosts, setFeedPosts] = useState<PostType[]>([]);
  const [pulsesByAuthor, setPulsesByAuthor] = useState<Map<string, UserWithPulses>>(new Map());
  const [viewingUserWithPulses, setViewingUserWithPulses] = useState<UserWithPulses | null>(null);
  const [activeLives, setActiveLives] = useState<LiveSession[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedKey, setFeedKey] = useState(0);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [selectedImageForPost, setSelectedImageForPost] = useState<{ file: File; preview: string } | null>(null);
  const [isCreatePulseModalOpen, setIsCreatePulseModalOpen] = useState(false);
  const [isMessagesModalOpen, setIsMessagesModalOpen] = useState(false);
  const [initialMessageTarget, setInitialMessageTarget] = useState<{ id: string, username: string, avatar: string } | null>(null);
  const [initialConversationId, setInitialConversationId] = useState<string | null>(null);
  const [playingMusicPostId, setPlayingMusicPostId] = useState<string | null>(null);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [viewMode, setViewMode] = useState<'feed' | 'vibes' | 'profile'>('feed');
  const [isCreateVibeModalOpen, setIsCreateVibeModalOpen] = useState(false);
  const [isCreationMenuOpen, setIsCreationMenuOpen] = useState(false);
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(false);
  
  // State to hold the list of user IDs we are following + our own ID
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [isFollowingListLoaded, setIsFollowingListLoaded] = useState(false);

  const { joinLive, activeLive } = useCall();

  // 1. Fetch Following List (Prerequisite)
  useEffect(() => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const fetchFollowing = async () => {
          try {
              const followingRef = collection(db, 'users', currentUser.uid, 'following');
              const followingSnap = await getDocs(followingRef);
              const ids = followingSnap.docs.map(doc => doc.id);
              // Include current user to see own content
              setFollowingList([currentUser.uid, ...ids]);
              setIsFollowingListLoaded(true);
          } catch (error) {
              console.error("Error fetching following list:", error);
              setFollowingList([currentUser.uid]);
              setIsFollowingListLoaded(true);
          }
      };
      fetchFollowing();
  }, [auth.currentUser]);

  // 2. Real-time Lives Listener (Depends on Following List)
  useEffect(() => {
      if (!isFollowingListLoaded || followingList.length === 0) return;

      // Renamed collection to 'live_sessions' to ignore old stuck lives
      const q = query(
          collection(db, 'live_sessions'),
          where('status', '==', 'live')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
          const lives: LiveSession[] = [];
          snapshot.forEach(doc => {
              const data = doc.data();
              // Filter: Only show lives from people I follow (or myself)
              if (followingList.includes(data.hostId)) {
                  lives.push({
                      liveId: doc.id,
                      host: {
                          id: data.hostId,
                          username: data.hostUsername,
                          avatar: data.hostAvatar
                      },
                      status: 'live'
                  });
              }
          });
          setActiveLives(lives);
      }, (error) => {
          console.error("Error listening to lives:", error);
      });

      return () => unsubscribe();
  }, [isFollowingListLoaded, followingList]);

  // 3. Fetch Feed Content (Posts & Pulses) - Static Fetching on Load/Refresh
  useEffect(() => {
    if (viewingProfileId || viewMode !== 'feed' || !auth.currentUser || !isFollowingListLoaded) return;

    const fetchFeedContent = async () => {
        setFeedLoading(true);
        try {
            const userIdsToQuery = followingList;
            
            if (userIdsToQuery.length > 0) {
                const userIdChunks: string[][] = [];
                for (let i = 0; i < userIdsToQuery.length; i += 30) {
                    userIdChunks.push(userIdsToQuery.slice(i, i + 30));
                }

                // --- Fetch Posts ---
                let allPosts: PostType[] = [];
                for (const chunk of userIdChunks) {
                    if (chunk.length === 0) continue;
                    const postsQuery = query(collection(db, 'posts'), where('userId', 'in', chunk));
                    const duoPostsQuery = query(collection(db, 'posts'), where('duoPartner.userId', 'in', chunk));
                    
                    const [postsSnap, duoPostsSnap] = await Promise.all([getDocs(postsQuery), getDocs(duoPostsQuery)]);
                    
                    const combinedDocs = [...postsSnap.docs, ...duoPostsSnap.docs];
                    const postsMap = new Map<string, PostType>();
                    combinedDocs.forEach(doc => postsMap.set(doc.id, { id: doc.id, ...doc.data() } as PostType));
                    
                    allPosts.push(...Array.from(postsMap.values()));
                }

                allPosts = allPosts.filter(post => {
                    if (!post.isVentMode) return true; // public post
                    if (post.userId === auth.currentUser?.uid) return true; // it's my own post
                    return post.allowedUsers?.includes(auth.currentUser!.uid); // I'm in the allowed list
                });
                
                allPosts.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
                setFeedPosts(allPosts.slice(0, 20));

                // --- Fetch Pulses ---
                let allPulses: PulseType[] = [];
                for (const chunk of userIdChunks) {
                    if (chunk.length === 0) continue;
                    const pulsesQuery = query(
                        collection(db, 'pulses'),
                        where('authorId', 'in', chunk)
                    );
                    const pulsesSnap = await getDocs(pulsesQuery);
                    const pulses = pulsesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PulseType));
                    allPulses.push(...pulses);
                }

                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const recentPulses = allPulses.filter(pulse => {
                    if (!pulse.createdAt?.seconds) return false;
                    const pulseDate = new Date(pulse.createdAt.seconds * 1000);
                    return pulseDate >= twentyFourHoursAgo;
                });
                
                const filteredPulses = recentPulses.filter(pulse => {
                    if (!pulse.isVentMode) return true;
                    if (pulse.authorId === auth.currentUser?.uid) return true;
                    return pulse.allowedUsers?.includes(auth.currentUser!.uid);
                });

                const pulsesByAuthorId: { [key: string]: PulseType[] } = {};
                const authorIds = new Set<string>();
                filteredPulses.forEach(pulse => {
                    if (!pulsesByAuthorId[pulse.authorId]) pulsesByAuthorId[pulse.authorId] = [];
                    pulsesByAuthorId[pulse.authorId].push(pulse);
                    authorIds.add(pulse.authorId);
                });

                // Fetch author info for pulses if needed
                const authorInfoMap = new Map<string, { username: string, avatar: string }>();
                if (authorIds.size > 0) {
                    // We can reuse user info if available, or fetch
                    const idsToFetch = Array.from(authorIds);
                    // Optimization: We could check local cache or state, but for now simple fetch
                    const userChunks = [];
                    for(let i=0; i<idsToFetch.length; i+=30) userChunks.push(idsToFetch.slice(i,i+30));
                    
                    for(const chunk of userChunks) {
                         const q = query(collection(db, 'users'), where('__name__', 'in', chunk));
                         const snap = await getDocs(q);
                         snap.forEach(d => authorInfoMap.set(d.id, { username: d.data().username, avatar: d.data().avatar }));
                    }
                }
                
                const finalGroupedPulses = new Map<string, UserWithPulses>();
                for (const [authorId, pulses] of Object.entries(pulsesByAuthorId)) {
                    const author = authorInfoMap.get(authorId);
                    if (author) {
                        pulses.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
                        finalGroupedPulses.set(authorId, { author: { id: authorId, ...author }, pulses });
                    }
                }
                setPulsesByAuthor(finalGroupedPulses);

            } else {
                setFeedPosts([]);
                setPulsesByAuthor(new Map());
            }

        } catch (error) {
            console.error("Error fetching feed content:", error);
        } finally {
            setFeedLoading(false);
        }
    };
    fetchFeedContent();
  }, [viewingProfileId, feedKey, auth.currentUser, isFollowingListLoaded, followingList, viewMode]);

  const handleSelectUser = (userId: string) => {
    // If it's the current user, go to profile tab logic
    if (userId === auth.currentUser?.uid) {
        setViewingProfileId(null);
        setViewMode('profile');
    } else {
        setViewingProfileId(userId);
    }
    setProfileKey(prev => prev + 1); 
  };

  const handleGoHome = () => {
    setViewingProfileId(null);
    setViewMode('feed');
  };
  
  const handleStartMessage = (targetUser: { id: string, username: string, avatar: string }) => {
    setInitialMessageTarget(targetUser);
    setIsMessagesModalOpen(true);
  };

  const handleOpenMessages = (conversationId?: string) => {
    setInitialMessageTarget(null);
    setInitialConversationId(conversationId || null);
    setIsMessagesModalOpen(true);
  }

  const handlePostDeleted = (postId: string) => {
    setFeedPosts(currentPosts => currentPosts.filter(p => p.id !== postId));
  };
  
  const handleViewUserPulses = (authorId: string) => {
    const data = pulsesByAuthor.get(authorId);
    if (data) {
        setViewingUserWithPulses(data);
    }
  };
  
  const handleJoinLive = (liveId: string, host: any) => {
      joinLive(liveId, host);
  };
  
  const handlePulseDeleted = async (pulseToDelete: PulseType) => {
    try {
        const pulseRef = doc(db, 'pulses', pulseToDelete.id);
        const mediaRef = storageRef(storage, pulseToDelete.mediaUrl);
        
        await deleteDoc(pulseRef);
        await deleteObject(mediaRef);
        
        setViewingUserWithPulses((prev: UserWithPulses | null) => {
            if (!prev) return null;
            const updatedPulses = prev.pulses.filter(p => p.id !== pulseToDelete.id);
            if (updatedPulses.length === 0) return null;
            return { author: prev.author, pulses: updatedPulses };
        });
        
        setPulsesByAuthor((prevMap: Map<string, UserWithPulses>) => {
            const newMap = new Map(prevMap);
            const authorData = newMap.get(pulseToDelete.authorId);
            if (authorData) {
                const updatedPulses = authorData.pulses.filter(p => p.id !== pulseToDelete.id);
                if (updatedPulses.length === 0) {
                    newMap.delete(pulseToDelete.authorId);
                } else {
                    newMap.set(pulseToDelete.authorId, { author: authorData.author, pulses: updatedPulses });
                }
            }
            return newMap;
        });
        
    } catch (error) {
        console.error("Error deleting pulse:", error);
    }
  };

  const handleGalleryImageSelected = (image: { file: File, preview: string }) => {
      setSelectedImageForPost(image);
      setIsGalleryModalOpen(false);
      setIsCreatePostModalOpen(true);
  };

  const renderContent = () => {
      if (viewingProfileId) {
          return (
            <UserProfile 
                userId={viewingProfileId} 
                key={`${viewingProfileId}-${profileKey}`} 
                onStartMessage={handleStartMessage} 
                onSelectUser={handleSelectUser}
            />
          );
      }

      switch (viewMode) {
          case 'vibes':
              return <VibeFeed />;
          case 'profile':
              return auth.currentUser ? (
                <UserProfile 
                    userId={auth.currentUser.uid} 
                    key={`${auth.currentUser.uid}-${profileKey}`} 
                    onStartMessage={handleStartMessage} 
                    onSelectUser={handleSelectUser}
                />
              ) : null;
          case 'feed':
          default:
              return (
                <div className="container mx-auto max-w-lg py-8 pb-24">
                    {feedLoading ? (
                    <div className="flex justify-center"><Spinner/></div>
                    ) : (
                        <>
                            {(pulsesByAuthor.size > 0 || activeLives.length > 0) && (
                                <PulseBar
                                    usersWithPulses={Array.from(pulsesByAuthor.values())}
                                    onViewPulses={handleViewUserPulses}
                                    activeLives={activeLives}
                                    onJoinLive={handleJoinLive}
                                />
                            )}
                            {feedPosts.length > 0 ? (
                                <div className={`flex flex-col gap-8 ${(pulsesByAuthor.size > 0 || activeLives.length > 0) ? 'mt-4' : ''}`}>
                                    {feedPosts.map(post => <Post key={post.id} post={post} onPostDeleted={handlePostDeleted} playingMusicPostId={playingMusicPostId} setPlayingMusicPostId={setPlayingMusicPostId} isMusicMuted={isMusicMuted} setIsMusicMuted={setIsMusicMuted} />)}
                                </div>
                            ) : (
                                <EmptyFeed />
                            )}
                        </>
                    )}
                </div>
              );
      }
  };

  return (
    <>
      <Header 
        onSelectUser={handleSelectUser} 
        onGoHome={handleGoHome}
        onOpenMessages={handleOpenMessages}
      />
      
      <main className="pt-16 min-h-screen pb-16">
        {renderContent()}
      </main>

      {/* Creation Menu Overlay */}
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
                      Pulse
                  </button>

                  <button onClick={() => { setIsCreationMenuOpen(false); setIsCreateVibeModalOpen(true); }} className="w-full p-4 text-left font-semibold text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl flex items-center gap-3">
                      <div className="bg-pink-100 dark:bg-pink-900 p-2 rounded-lg text-pink-600 dark:text-pink-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      {t('header.createVibe')}
                  </button>

                  <button onClick={() => { setIsCreationMenuOpen(false); setIsLiveModalOpen(true); }} className="w-full p-4 text-left font-semibold text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl flex items-center gap-3">
                      <div className="bg-red-100 dark:bg-red-900 p-2 rounded-lg text-red-600 dark:text-red-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      {t('header.live')}
                  </button>
              </div>
          </div>
      )}

      <BottomNav 
        currentView={viewingProfileId ? 'profile' : viewMode}
        onChangeView={(view) => {
            setViewMode(view);
            setViewingProfileId(null);
        }}
        onCreateClick={() => setIsCreationMenuOpen(true)}
      />
      
      <GalleryModal
        isOpen={isGalleryModalOpen}
        onClose={() => setIsGalleryModalOpen(false)}
        onImageSelected={handleGalleryImageSelected}
      />

      <CreatePostModal
        isOpen={isCreatePostModalOpen}
        onClose={() => {
            setIsCreatePostModalOpen(false);
            setSelectedImageForPost(null);
        }}
        onPostCreated={() => {
            setIsCreatePostModalOpen(false);
            setSelectedImageForPost(null);
            setFeedKey(prev => prev + 1);
            if(viewingProfileId === auth.currentUser?.uid) {
                setProfileKey(prev => prev + 1);
            }
        }}
        initialImage={selectedImageForPost}
      />
      <CreatePulseModal
        isOpen={isCreatePulseModalOpen}
        onClose={() => {
            setIsCreatePulseModalOpen(false);
        }}
        onPulseCreated={() => {
            setIsCreatePulseModalOpen(false);
            setFeedKey(prev => prev + 1);
        }}
      />
      <CreateVibeModal
        isOpen={isCreateVibeModalOpen}
        onClose={() => setIsCreateVibeModalOpen(false)}
        onVibeCreated={() => {
            setViewMode('vibes');
        }}
      />
      <MessagesModal
        isOpen={isMessagesModalOpen}
        onClose={() => {
            setIsMessagesModalOpen(false);
            setInitialMessageTarget(null);
            setInitialConversationId(null);
        }}
        initialTargetUser={initialMessageTarget}
        initialConversationId={initialConversationId}
      />
      {viewingUserWithPulses && (
            <PulseViewerModal
                pulses={viewingUserWithPulses.pulses}
                initialPulseIndex={0}
                authorInfo={viewingUserWithPulses.author}
                onClose={() => setViewingUserWithPulses(null)}
                onDelete={handlePulseDeleted}
                onViewProfile={handleSelectUser}
            />
        )}
      <LiveViewerModal 
        isOpen={!!activeLive} 
      />
    </>
  );
};

export default Feed;
