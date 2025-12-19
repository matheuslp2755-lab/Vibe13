
import React, { useState, useEffect, StrictMode, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, doc, updateDoc, serverTimestamp, collection, query, where, onSnapshot, getDoc } from './firebase';
import Login from './components/Login';
import SignUp from './context/SignUp';
import Feed from './components/Feed';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { CallProvider, useCall } from './context/CallContext';
import WelcomeAnimation from './components/feed/WelcomeAnimation';
import Toast from './components/common/Toast';
import CallUI from './components/call/CallUI';

const GalaxyBackground = ({ variant = 'default' }: { variant?: 'default' | 'subtle' }) => (
  <div className="fixed inset-0 z-0 bg-black overflow-hidden pointer-events-none">
    <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-black to-slate-950 opacity-100"></div>
    <div className={`absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-900/30 rounded-full blur-[120px] animate-pulse transition-opacity duration-1000 ${variant === 'subtle' ? 'opacity-20' : 'opacity-100'}`}></div>
    <div className={`absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-900/30 rounded-full blur-[120px] animate-pulse transition-opacity duration-1000 ${variant === 'subtle' ? 'opacity-20' : 'opacity-100'}`} style={{ animationDelay: '2s' }}></div>
    <style>{`
        .star-field {
            background-image: 
                radial-gradient(1px 1px at 25px 5px, white, transparent),
                radial-gradient(1px 1px at 50px 25px, white, transparent),
                radial-gradient(1px 1px at 12px 45px, white, transparent),
                radial-gradient(1.5px 1.5px at 80px 10px, white, transparent),
                radial-gradient(1px 1px at 60px 70px, white, transparent);
            background-size: 150px 150px;
            opacity: ${variant === 'subtle' ? 0.3 : 0.6};
            animation: star-move 60s linear infinite;
        }
        .star-field-2 {
            background-image: 
                radial-gradient(1.5px 1.5px at 15px 15px, white, transparent),
                radial-gradient(1px 1px at 85px 35px, white, transparent),
                radial-gradient(1.5px 1.5px at 45px 85px, white, transparent);
            background-size: 200px 200px;
            opacity: ${variant === 'subtle' ? 0.2 : 0.4};
            animation: star-move 100s linear infinite reverse;
        }
        @keyframes star-move {
            from { transform: translateY(0); }
            to { transform: translateY(-500px); }
        }
    `}</style>
    <div className="absolute inset-0 star-field"></div>
    <div className="absolute inset-0 star-field-2"></div>
  </div>
);

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [authPage, setAuthPage] = useState<'login' | 'signup'>('login');
  const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const prevUser = useRef<any | null>(null);
  const { setIncomingCall, activeCall } = useCall();

  useEffect(() => {
    const welcomeKey = 'hasSeenWelcome_Vibe';
    const hasSeen = localStorage.getItem(welcomeKey);
    if (!hasSeen) {
      setShowWelcomeAnimation(true);
      localStorage.setItem(welcomeKey, 'true');
    }
  }, []);

  useEffect(() => {
    const requestMediaPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (err: any) {
        console.warn("Media permissions denied or error:", err?.message || String(err));
      }
    };
    requestMediaPermissions();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && !prevUser.current) {
        setToastMessage(t('welcome.title'));
        setShowToast(true);
        setTimeout(() => {
          setShowToast(false);
        }, 4000); 
      }
      prevUser.current = currentUser;
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [t]);
  
  // Listener para chamadas recebidas com carregamento de dados do chamador
  useEffect(() => {
    if (!user || activeCall) return;

    const callsRef = collection(db, 'calls');
    const q = query(callsRef, where('receiverId', '==', user.uid), where('status', '==', 'ringing'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        if (!snapshot.empty) {
            const callDoc = snapshot.docs[0];
            const callData = callDoc.data();
            
            // Garantir que temos os dados do chamador (pode vir de cache ou Firestore)
            setIncomingCall({ 
                callId: callDoc.id, 
                caller: { 
                    id: callData.callerId, 
                    username: callData.callerUsername || t('common.user'), 
                    avatar: callData.callerAvatar || '' 
                },
                receiver: { 
                    id: user.uid, 
                    username: user.displayName || '', 
                    avatar: user.photoURL || '' 
                },
                status: 'ringing-incoming',
                isVideo: callData.type === 'video'
            });
        }
    });

    return () => unsubscribe();
  }, [user, activeCall, setIncomingCall, t]);

  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    const updateUserLastSeen = () => {
        updateDoc(userDocRef, {
            lastSeen: serverTimestamp()
        }).catch(err => {
            console.error("Failed to update last seen:", err?.message || String(err));
        });
    };
    updateUserLastSeen();
    const intervalId = setInterval(updateUserLastSeen, 5 * 60 * 1000);
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') updateUserLastSeen();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', updateUserLastSeen);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', updateUserLastSeen);
    };
}, [user]);

  const switchAuthPage = (page: 'login' | 'signup') => {
    setAuthPage(page);
  };

  const renderApp = () => {
    if (loading) {
      return (
        <div className="bg-zinc-50 dark:bg-black min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-sky-500"></div>
        </div>
      );
    }

    if (!user) {
      return (
        <div className="font-sans text-zinc-900 dark:text-zinc-100 min-h-screen flex flex-col relative overflow-hidden">
          <GalaxyBackground />
          <main className="flex-grow flex items-center justify-center py-10 px-4 z-10">
            {authPage === 'login' ? (
              <Login onSwitchMode={() => switchAuthPage('signup')} />
            ) : (
              <SignUp onSwitchMode={() => switchAuthPage('login')} />
            )}
          </main>
        </div>
      );
    }

    return (
      <div className="font-sans text-zinc-900 dark:text-zinc-100 min-h-screen relative">
        <GalaxyBackground variant="subtle" />
        <div className="relative z-10">
            <Feed />
        </div>
      </div>
    );
  };

  return (
    <>
      {showWelcomeAnimation && (
        <WelcomeAnimation onAnimationEnd={() => setShowWelcomeAnimation(false)} />
      )}
      <Toast message={toastMessage} show={showToast} />
      <CallUI />
      {renderApp()}
    </>
  );
};

const App: React.FC = () => (
  <StrictMode>
    <LanguageProvider>
        <CallProvider>
            <AppContent />
        </CallProvider>
    </LanguageProvider>
  </StrictMode>
);

export default App;
