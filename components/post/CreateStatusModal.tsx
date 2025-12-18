
import React, { useState, useEffect } from 'react';
import { auth, db, addDoc, collection, serverTimestamp } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';
import AddMusicModal from './AddMusicModal';

interface CreateStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

const BG_GRADIENTS = [
  "from-zinc-900 to-black",
  "from-purple-600 to-blue-500",
  "from-pink-500 to-rose-500",
  "from-amber-400 to-orange-600",
  "from-emerald-500 to-teal-700",
  "from-indigo-500 to-purple-800",
  "from-slate-700 to-slate-900"
];

const FONTS = [
  { id: 'classic', family: 'sans-serif' },
  { id: 'modern', family: 'serif' },
  { id: 'neon', family: 'cursive' },
  { id: 'strong', family: 'Impact, sans-serif' }
];

type MusicInfo = {
  nome: string;
  artista: string;
  capa: string;
  preview: string;
  startTime?: number;
};

const CreateStatusModal: React.FC<CreateStatusModalProps> = ({ isOpen, onClose, onPostCreated }) => {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [bgIndex, setBgIndex] = useState(0);
  const [fontIndex, setFontIndex] = useState(0);
  const [music, setMusic] = useState<MusicInfo | null>(null);
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setText('');
      setBgIndex(0);
      setFontIndex(0);
      setMusic(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleShare = async () => {
    if (!text.trim() && !music) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'posts'), {
        userId: auth.currentUser?.uid,
        username: auth.currentUser?.displayName,
        userAvatar: auth.currentUser?.photoURL,
        type: 'status',
        text: text.trim(),
        bgColor: BG_GRADIENTS[bgIndex],
        font: FONTS[fontIndex].id,
        musicInfo: music,
        likes: [],
        timestamp: serverTimestamp(),
      });
      onPostCreated();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[70] flex flex-col md:p-10" onClick={onClose}>
      <div 
        className="w-full h-full max-w-lg mx-auto bg-white dark:bg-zinc-950 md:rounded-3xl shadow-2xl flex flex-col overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Preview Area */}
        <div className={`flex-grow relative flex flex-col items-center justify-center p-8 bg-gradient-to-br ${BG_GRADIENTS[bgIndex]} transition-all duration-500`}>
          
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
            <button onClick={onClose} className="text-white text-3xl font-light">&times;</button>
            <Button onClick={handleShare} disabled={submitting || (!text.trim() && !music)} className="!w-auto !bg-white !text-black !rounded-full !px-6 !py-1 font-bold">
              {submitting ? t('createStatus.sharing') : t('createStatus.share')}
            </Button>
          </div>

          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t('createStatus.placeholder')}
            className={`w-full bg-transparent text-white text-center text-3xl font-bold outline-none resize-none leading-tight placeholder:text-white/50`}
            style={{ fontFamily: FONTS[fontIndex].family }}
          />

          {music && (
            <div className="mt-8 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 flex items-center gap-3 animate-fade-in w-full max-w-xs shadow-xl">
              <img src={music.capa} className="w-12 h-12 rounded-lg object-cover" />
              <div className="flex-grow overflow-hidden text-left">
                <p className="text-white font-bold text-sm truncate">{music.nome}</p>
                <p className="text-white/70 text-xs truncate">{music.artista}</p>
              </div>
              <button onClick={() => setMusic(null)} className="text-white/50 hover:text-white text-lg">&times;</button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-6 bg-white dark:bg-zinc-900 border-t dark:border-zinc-800 space-y-6">
          
          {/* Gradients */}
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">{t('createStatus.background')}</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {BG_GRADIENTS.map((grad, i) => (
                <button
                  key={i}
                  onClick={() => setBgIndex(i)}
                  className={`w-10 h-10 rounded-full shrink-0 bg-gradient-to-br ${grad} border-2 ${bgIndex === i ? 'border-sky-500 scale-110' : 'border-transparent'} transition-all`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            {/* Fonts */}
            <div className="flex-grow">
               <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">{t('createStatus.font')}</p>
               <div className="flex gap-2">
                 {FONTS.map((f, i) => (
                   <button
                    key={i}
                    onClick={() => setFontIndex(i)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${fontIndex === i ? 'bg-sky-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}
                   >
                     {f.id === 'classic' ? 'Sans' : f.id === 'modern' ? 'Serif' : f.id === 'neon' ? 'Neon' : 'Strong'}
                   </button>
                 ))}
               </div>
            </div>

            {/* Music Button */}
            <button 
              onClick={() => setIsMusicModalOpen(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all ${music ? 'bg-green-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
              {music ? t('post.changeMusic') : t('post.addMusic')}
            </button>
          </div>
        </div>
      </div>

      <AddMusicModal 
        isOpen={isMusicModalOpen} 
        onClose={() => setIsMusicModalOpen(false)} 
        postId="" 
        isProfileModal={true} 
        onMusicAdded={m => { setMusic(m); setIsMusicModalOpen(false); }} 
      />
    </div>
  );
};

export default CreateStatusModal;
