
import React, { useState, useRef, useEffect } from 'react';
import { auth, db, storage, addDoc, collection, serverTimestamp, storageRef, uploadString, getDownloadURL, uploadBytes, doc, setDoc } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';
import TextAreaInput from '../common/TextAreaInput';
import AddMusicModal from './AddMusicModal';
import SearchFollowingModal from './SearchFollowingModal';
import AIGeneratorModal from './AIGeneratorModal';

const FILTERS = [
    { name: 'Normal', filter: 'none' },
    { name: 'Vibe', filter: 'contrast(1.1) saturate(1.2) brightness(1.05)' },
    { name: 'Night', filter: 'brightness(0.8) contrast(1.2) hue-rotate(-10deg)' },
    { name: 'Classic', filter: 'sepia(0.3) contrast(1.1)' },
    { name: 'B&W', filter: 'grayscale(1) contrast(1.1)' },
    { name: 'Gold', filter: 'sepia(0.5) saturate(1.5) brightness(1.1)' }
];

const FONTS = [
    { id: 'classic', name: 'Sans', family: 'sans-serif' },
    { id: 'modern', name: 'Serif', family: 'serif' },
    { id: 'neon', name: 'Neon', family: 'cursive' },
    { id: 'strong', name: 'Impact', family: 'Impact, sans-serif' }
];

type MusicInfo = { nome: string; artista: string; capa: string; preview: string; startTime?: number; };

interface GalleryImage {
    file: File;
    preview: string;
}

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
  initialImages?: GalleryImage[] | null;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ isOpen, onClose, onPostCreated, initialImages }) => {
    const { t } = useLanguage();
    const [mediaList, setMediaList] = useState<GalleryImage[]>([]);
    const [filterIndex, setFilterIndex] = useState(0);
    const [caption, setCaption] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Duo & Tags
    const [duoPartner, setDuoPartner] = useState<any>(null);
    const [taggedUsers, setTaggedUsers] = useState<any[]>([]);
    const [isDuoModalOpen, setIsDuoModalOpen] = useState(false);
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);

    // AI
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);

    // Text Sticker
    const [overlayText, setOverlayText] = useState('');
    const [isAddingText, setIsAddingText] = useState(false);
    const [textPos, setTextPos] = useState({ x: 50, y: 30 });
    const [fontIndex, setFontIndex] = useState(0);

    // Music
    const [selectedMusic, setSelectedMusic] = useState<MusicInfo | null>(null);
    const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && initialImages) setMediaList(initialImages);
        if (!isOpen) {
            setCaption(''); setMediaList([]); setFilterIndex(0);
            setDuoPartner(null); setTaggedUsers([]); setOverlayText('');
            setSelectedMusic(null); setIsMenuOpen(false);
        }
    }, [isOpen, initialImages]);

    const handleDragMove = (e: React.PointerEvent, setter: (pos: { x: number, y: number }) => void) => {
        if (!containerRef.current || e.buttons !== 1) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setter({ x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) });
    };

    const handleAIImageGenerated = (file: File, preview: string) => {
        setMediaList([{ file, preview }]);
    };

    const handleSubmit = async () => {
        if (mediaList.length === 0 || submitting) return;
        setSubmitting(true);
        try {
            const mediaUrls = await Promise.all(mediaList.map(async (img) => {
                const path = `posts/${auth.currentUser?.uid}/${Date.now()}-${img.file.name}`;
                const ref = storageRef(storage, path);
                await uploadBytes(ref, img.file);
                return { url: await getDownloadURL(ref), type: img.file.type.startsWith('video/') ? 'video' : 'image' };
            }));

            const postData = {
                userId: auth.currentUser?.uid,
                username: auth.currentUser?.displayName,
                userAvatar: auth.currentUser?.photoURL,
                media: mediaUrls,
                imageUrl: mediaUrls[0].url,
                caption,
                filter: FILTERS[filterIndex].filter,
                overlayText,
                textPosition: textPos,
                textFont: FONTS[fontIndex].id,
                musicInfo: selectedMusic,
                likes: [],
                timestamp: serverTimestamp(),
                duoPending: !!duoPartner,
                duoPartnerId: duoPartner?.id || null,
                tags: taggedUsers.map(u => ({ userId: u.id, username: u.username }))
            };

            const postRef = await addDoc(collection(db, 'posts'), postData);

            if (duoPartner) {
                await addDoc(collection(db, 'users', duoPartner.id, 'notifications'), {
                    type: 'duo_request',
                    fromUserId: auth.currentUser?.uid,
                    fromUsername: auth.currentUser?.displayName,
                    fromUserAvatar: auth.currentUser?.photoURL,
                    postId: postRef.id,
                    timestamp: serverTimestamp(),
                    read: false
                });
            }

            for (const tag of taggedUsers) {
                await addDoc(collection(db, 'users', tag.id, 'notifications'), {
                    type: 'tag_request',
                    fromUserId: auth.currentUser?.uid,
                    fromUsername: auth.currentUser?.displayName,
                    fromUserAvatar: auth.currentUser?.photoURL,
                    postId: postRef.id,
                    timestamp: serverTimestamp(),
                    read: false
                });
            }

            onPostCreated();
            onClose();
        } catch (e) { console.error(e); }
        setSubmitting(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 z-[70] flex flex-col md:p-10 overflow-hidden select-none touch-none">
            <div className="w-full h-full max-w-4xl mx-auto bg-white dark:bg-zinc-950 md:rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row overflow-hidden relative">
                
                {/* Lado Esquerdo: Preview de Edição */}
                <div 
                    ref={containerRef}
                    className="relative w-full md:w-[60%] aspect-square md:aspect-auto bg-black flex items-center justify-center overflow-hidden border-r dark:border-zinc-800"
                >
                    {mediaList.length > 0 ? (
                        <div className="w-full h-full flex items-center justify-center transition-all duration-300" style={{ filter: FILTERS[filterIndex].filter }}>
                            {mediaList[0]?.file.type.startsWith('video/') ? (
                                <video src={mediaList[0].preview} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                            ) : (
                                <img src={mediaList[0]?.preview} className="w-full h-full object-cover" />
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-zinc-500">
                             <svg className="w-16 h-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                             <p className="text-xs font-black uppercase tracking-widest">{t('memories.selectContent')}</p>
                        </div>
                    )}

                    {/* Sticker Texto */}
                    {overlayText && (
                        <div 
                            onPointerMove={(e) => handleDragMove(e, setTextPos)}
                            className="absolute cursor-move px-4 py-2 bg-black/40 backdrop-blur-md rounded-xl text-white font-bold shadow-2xl z-10 border border-white/20 text-center whitespace-pre-wrap max-w-[80%]"
                            style={{ left: `${textPos.x}%`, top: `${textPos.y}%`, transform: 'translate(-50%, -50%)', fontFamily: FONTS[fontIndex].family, fontSize: '24px' }}
                        >
                            {overlayText}
                        </div>
                    )}

                    {/* Botões Flutuantes laterais */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
                        <button onClick={() => setIsAIModalOpen(true)} className="p-3 bg-gradient-to-tr from-indigo-500 to-pink-500 rounded-full text-white shadow-xl hover:scale-110 active:scale-95 transition-all group" title="Criar com IA">
                             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                        </button>
                        <button onClick={() => setIsAddingText(true)} className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white border border-white/20 hover:bg-white/20">Aa</button>
                        <button onClick={() => setIsMusicModalOpen(true)} className={`p-3 backdrop-blur-md rounded-full border border-white/20 transition-all ${selectedMusic ? 'bg-sky-500 text-white' : 'bg-white/10 text-white'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                        </button>
                    </div>

                    {/* Filtros horizontais */}
                    {mediaList.length > 0 && (
                        <div className="absolute bottom-4 left-0 right-0 flex gap-2 px-4 overflow-x-auto no-scrollbar">
                            {FILTERS.map((f, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => setFilterIndex(i)}
                                    className={`flex-shrink-0 flex flex-col items-center gap-1 transition-all ${filterIndex === i ? 'scale-110' : 'opacity-60 scale-90'}`}
                                >
                                    <div className="w-12 h-12 rounded-lg border-2 border-white/50 overflow-hidden" style={{ filter: f.filter }}>
                                        <img src={mediaList[0]?.preview} className="w-full h-full object-cover" />
                                    </div>
                                    <span className="text-[9px] text-white font-black uppercase">{f.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Lado Direito: Opções de Postagem */}
                <div className="flex-grow flex flex-col p-6 bg-white dark:bg-zinc-950 overflow-y-auto">
                    <header className="flex justify-between items-center mb-6">
                        <button onClick={onClose} className="text-zinc-400 text-3xl font-light">&times;</button>
                        <h2 className="font-black text-lg">{t('createPost.title')}</h2>
                        <Button onClick={handleSubmit} disabled={submitting || mediaList.length === 0} className="!w-auto !py-1 !px-6 !text-xs !rounded-full">
                            {submitting ? '...' : t('createPost.share')}
                        </Button>
                    </header>

                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <img src={auth.currentUser?.photoURL || ''} className="w-10 h-10 rounded-full object-cover border-2 border-zinc-100 dark:border-zinc-800" />
                            <span className="font-bold text-sm">{auth.currentUser?.displayName}</span>
                        </div>

                        <TextAreaInput 
                            id="post-cap" 
                            label={t('createPost.captionLabel')} 
                            value={caption} 
                            onChange={e => setCaption(e.target.value)} 
                            className="!min-h-[120px] !bg-zinc-50 dark:!bg-zinc-900 !border-none !rounded-2xl"
                        />

                        {/* Botão Especial AI */}
                        <button 
                            onClick={() => setIsAIModalOpen(true)}
                            className="w-full p-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                            {t('aiGenerator.generate')}
                        </button>

                        <div className="grid grid-cols-1 gap-2">
                            <button 
                                onClick={() => setIsDuoModalOpen(true)}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${duoPartner ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/10' : 'border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                    <span className="text-sm font-bold">{duoPartner ? `Duo: ${duoPartner.username}` : t('post.inviteDuo')}</span>
                                </div>
                                {duoPartner && <span className="text-xs text-sky-500 font-black">X</span>}
                            </button>

                            <button 
                                onClick={() => setIsTagModalOpen(true)}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${taggedUsers.length > 0 ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' : 'border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M7 7h.01M7 3h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" /></svg>
                                    <span className="text-sm font-bold">{taggedUsers.length > 0 ? `${taggedUsers.length} Marcados` : t('post.tagFriends')}</span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Overlay Adição de Texto */}
                {isAddingText && (
                    <div className="absolute inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-10 animate-fade-in">
                        <div className="w-full max-w-lg flex flex-col items-center gap-8">
                            <div className="flex gap-3">
                                {FONTS.map((f, i) => (
                                    <button 
                                        key={f.id} 
                                        onClick={() => setFontIndex(i)}
                                        className={`px-4 py-2 rounded-full border border-white text-white font-bold text-xs ${fontIndex === i ? 'bg-white !text-black' : ''}`}
                                    >
                                        {f.name}
                                    </button>
                                ))}
                            </div>
                            <textarea 
                                autoFocus 
                                className="bg-transparent text-white text-center text-4xl font-black outline-none w-full resize-none leading-tight"
                                placeholder="Diga algo..."
                                value={overlayText}
                                onChange={e => setOverlayText(e.target.value)}
                            />
                            <Button onClick={() => setIsAddingText(false)} className="!w-auto !px-10">OK</Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modais de Seleção */}
            <AddMusicModal isOpen={isMusicModalOpen} onClose={() => setIsMusicModalOpen(false)} postId="" isProfileModal={true} onMusicAdded={m => { setSelectedMusic(m); setIsMusicModalOpen(false); }} />
            <SearchFollowingModal isOpen={isDuoModalOpen} onClose={() => setIsDuoModalOpen(false)} title={t('post.inviteDuo')} onSelect={u => { setDuoPartner(u); setIsDuoModalOpen(false); }} />
            <SearchFollowingModal isOpen={isTagModalOpen} onClose={() => setIsTagModalOpen(false)} title={t('post.tagFriends')} onSelect={u => { if(!taggedUsers.find(t=>t.id===u.id)) setTaggedUsers([...taggedUsers, u]); }} />
            <AIGeneratorModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} onImageGenerated={handleAIImageGenerated} />
        </div>
    );
};

export default CreatePostModal;
