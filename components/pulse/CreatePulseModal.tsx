import React, { useState, useRef, useEffect } from 'react';
import { auth, db, storage, addDoc, collection, serverTimestamp, storageRef, uploadString, getDownloadURL } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';
import AddMusicModal from '../post/AddMusicModal';

const FILTERS = [
    { id: 'none', label: 'createPulse.effectNone', emoji: '🚫', style: { filter: 'none' } },
    { id: 'bloom', label: 'createPulse.effectBloom', emoji: '✨', style: { filter: 'brightness(1.1) saturate(1.2) contrast(0.9)' } },
    { id: 'noir', label: 'createPulse.effectNoir', emoji: '🕶️', style: { filter: 'grayscale(1) contrast(1.5) brightness(0.8)' } },
    { id: 'cyber', label: 'createPulse.effectCyber', emoji: '🧬', style: { filter: 'hue-rotate(280deg) saturate(2) contrast(1.1)' } },
    { id: 'retro', label: 'createPulse.effectRetro', emoji: '🎞️', style: { filter: 'sepia(0.6) contrast(0.8) brightness(1.1)' } },
    { id: 'aura', label: 'createPulse.effectAura', emoji: '🔮', style: { filter: 'brightness(1.3) saturate(1.6) hue-rotate(-20deg)' } }
];

// Added explicit typing for LensElement to fix property access errors in capturePhoto and JSX
type LensElement = 
    | { type: 'img'; src: string; x: number; y: number; size: number }
    | { type: 'overlay'; color: string; filter: string };

interface ARLens {
    id: string;
    emoji: string;
    elements: LensElement[];
}

const AR_LENSES: ARLens[] = [
    { id: 'none', emoji: '😶', elements: [] },
    { id: 'dog', emoji: '🐶', elements: [
        { type: 'img', src: 'https://cdn-icons-png.flaticon.com/512/620/620851.png', x: 50, y: 35, size: 450 } // Máscara Puppy
    ]},
    { id: 'beauty', emoji: '💄', elements: [
        { type: 'overlay', color: 'rgba(255, 100, 100, 0.1)', filter: 'blur(20px) contrast(1.1)' }
    ]},
    { id: 'vampire', emoji: '🧛', elements: [
        { type: 'img', src: 'https://cdn-icons-png.flaticon.com/512/1216/1216663.png', x: 50, y: 55, size: 200 }
    ]}
];

const PULSE_GRADIENTS = [
  "from-zinc-900 to-black",
  "from-sky-500 to-indigo-600",
  "from-purple-600 to-pink-500",
  "from-emerald-500 to-teal-700",
  "from-amber-400 to-orange-600",
  "from-slate-700 to-slate-900"
];

const FONTS = [
    { id: 'classic', name: 'Sans', family: 'sans-serif' },
    { id: 'modern', name: 'Serif', family: 'serif' },
    { id: 'neon', name: 'Neon', family: 'cursive' },
    { id: 'strong', name: 'Forte', family: 'Impact, sans-serif' }
];

type MusicInfo = { nome: string; artista: string; capa: string; preview: string; startTime?: number; };
type Sticker = { id: string; url: string; x: number; y: number; scale: number; };

interface CreatePulseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPulseCreated: () => void;
  initialSharedContent?: any;
}

const CreatePulseModal: React.FC<CreatePulseModalProps> = ({ isOpen, onClose, onPulseCreated, initialSharedContent }) => {
    const { t } = useLanguage();
    const [viewMode, setViewMode] = useState<'selection' | 'camera' | 'editing'>('selection');
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [filterIndex, setFilterIndex] = useState(0);
    const [lensIndex, setLensIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    
    // Motor de Escala e Gestos
    const [mediaScale, setMediaScale] = useState(1);
    const [bgIndex, setBgIndex] = useState(0);
    const [stickers, setStickers] = useState<Sticker[]>([]);
    const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);
    const [giphyResults, setGiphyResults] = useState<any[]>([]);
    const [giphyQuery, setGiphyQuery] = useState('');

    // Camera state
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Editing state
    const [overlayText, setOverlayText] = useState('');
    const [isAddingText, setIsAddingText] = useState(false);
    const [fontIndex, setFontIndex] = useState(0);
    const [selectedMusic, setSelectedMusic] = useState<MusicInfo | null>(null);
    const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;
        const startStream = async () => {
            if (viewMode !== 'camera') return;
            try {
                // AJUSTE: Câmera original sem zoom forçado
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        facingMode: facingMode,
                        width: { ideal: 1080 },
                        height: { ideal: 1920 }
                    },
                    audio: false
                });
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err) {
                console.error(err);
                setViewMode('selection');
            }
        };
        if (viewMode === 'camera') startStream();
        return () => { if (stream) stream.getTracks().forEach(track => track.stop()); };
    }, [viewMode, facingMode]);

    useEffect(() => {
        if (!isOpen) { 
            setViewMode('selection');
            setMediaPreview(null); 
            setFilterIndex(0);
            setLensIndex(0);
            setMediaScale(1);
            setStickers([]);
            return;
        }
        if (initialSharedContent) {
            setViewMode('editing');
            if (initialSharedContent.musicInfo) setSelectedMusic(initialSharedContent.musicInfo);
        }
    }, [isOpen, initialSharedContent]);

    // Busca de Stickers Giphy
    useEffect(() => {
        if (!isStickerModalOpen) return;
        const fetchGiphy = async () => {
            const query = giphyQuery || 'trending';
            const res = await fetch(`https://api.giphy.com/v1/stickers/search?api_key=LIVD67SGH8u38vD53G1f1PebW8U1H6Qe&q=${query}&limit=20&rating=g`);
            const data = await res.json();
            setGiphyResults(data.data || []);
        };
        const timer = setTimeout(fetchGiphy, 500);
        return () => clearTimeout(timer);
    }, [giphyQuery, isStickerModalOpen]);

    const capturePhoto = async () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        ctx.filter = FILTERS[filterIndex].style.filter;
        
        ctx.save();
        if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // AR LENS Rendering
        const activeLens = AR_LENSES[lensIndex];
        for (const el of activeLens.elements) {
            if (el.type === 'img') {
                const img = new Image();
                img.crossOrigin = "anonymous";
                // Explicit typing allows safe access to properties after narrowing by type === 'img'
                img.src = el.src;
                await new Promise(r => img.onload = r);
                // Explicit typing allows safe access to properties after narrowing by type === 'img'
                ctx.drawImage(img, (el.x / 100) * canvas.width - el.size/2, (el.y / 100) * canvas.height - el.size/2, el.size, el.size);
            }
        }

        setMediaPreview(canvas.toDataURL('image/jpeg', 0.95));
        setViewMode('editing');
    };

    const addSticker = (url: string) => {
        setStickers([...stickers, { id: Date.now().toString(), url, x: 50, y: 50, scale: 1 }]);
        setIsStickerModalOpen(false);
    };

    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            let finalUrl = "";
            if (mediaPreview) {
              const path = `pulses/${auth.currentUser?.uid}/${Date.now()}.jpg`;
              const ref = storageRef(storage, path);
              await uploadString(ref, mediaPreview, 'data_url');
              finalUrl = await getDownloadURL(ref);
            }

            await addDoc(collection(db, 'pulses'), {
                authorId: auth.currentUser?.uid,
                mediaUrl: finalUrl,
                legenda: overlayText,
                textFont: FONTS[fontIndex].id,
                musicInfo: selectedMusic,
                mediaScale: mediaScale,
                bgGradient: initialSharedContent ? PULSE_GRADIENTS[bgIndex] : null,
                stickers: stickers,
                createdAt: serverTimestamp(),
                type: initialSharedContent ? 'shared_post' : 'normal',
                sharedPostData: initialSharedContent || null
            });
            onPulseCreated();
            onClose();
        } catch (error) { console.error(error); }
        setSubmitting(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black z-[70] flex flex-col overflow-hidden select-none touch-none animate-fade-in">
            <canvas ref={canvasRef} className="hidden" />

            {viewMode === 'selection' && (
                <div className="flex-grow flex flex-col items-center justify-center p-8 text-white gap-8 bg-zinc-950">
                    <h2 className="text-5xl font-black italic tracking-tighter bg-gradient-to-br from-white to-zinc-600 bg-clip-text text-transparent">Pulse</h2>
                    <div className="flex flex-col gap-4 w-full max-w-xs">
                        <button onClick={() => setViewMode('camera')} className="w-full p-6 bg-white rounded-[2rem] flex items-center gap-5 active:scale-95 transition-all shadow-2xl group">
                            <div className="w-14 h-14 rounded-2xl bg-zinc-900 flex items-center justify-center text-white group-hover:bg-black transition-colors">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            <div className="text-left"><span className="block text-black font-black text-lg uppercase tracking-tighter">Câmera Vibe</span><span className="block text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Lentes AR ativadas</span></div>
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} className="w-full p-6 bg-zinc-900/50 border border-white/10 rounded-[2rem] flex items-center gap-5 active:scale-95 transition-all">
                            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <div className="text-left"><span className="block text-white font-black text-lg uppercase tracking-tighter">Galeria</span><span className="block text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Escolher mídia salva</span></div>
                        </button>
                    </div>
                    <button onClick={onClose} className="mt-8 text-zinc-600 font-black uppercase text-xs tracking-[0.3em] hover:text-white transition-colors">{t('common.cancel')}</button>
                </div>
            )}

            {viewMode === 'camera' && (
                <div className="relative flex-grow bg-black">
                    {/* VIDEO CONTAINER: Original, sem zoom */}
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none', filter: FILTERS[filterIndex].style.filter }} />
                    
                    {/* AR LENS PREVIEW */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        {AR_LENSES[lensIndex].elements.map((el, i) => el.type === 'img' && (
                            <img key={i} src={el.src} className="absolute transition-all duration-300 animate-float" style={{ width: `${el.size}px`, left: `${el.x}%`, top: `${el.y}%`, transform: 'translate(-50%, -50%)' }} />
                        ))}
                    </div>

                    <div className="absolute top-8 left-0 right-0 px-6 flex justify-between items-center z-50">
                         <button onClick={() => setViewMode('selection')} className="text-white text-4xl font-light p-2 active:scale-90 transition-transform">&times;</button>
                         <button onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} className="p-4 bg-black/40 backdrop-blur-2xl rounded-full text-white border border-white/20 active:rotate-180 transition-all duration-500">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                         </button>
                    </div>

                    <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-8 z-50">
                        {/* LENS SELECTOR */}
                        <div className="flex gap-6 items-center overflow-x-auto no-scrollbar w-full px-12 justify-center py-4">
                            {AR_LENSES.map((lens, i) => (
                                <button key={lens.id} onClick={() => setLensIndex(i)} className={`flex-shrink-0 w-16 h-16 rounded-full border-4 transition-all flex items-center justify-center text-3xl ${lensIndex === i ? 'border-white scale-125 bg-white/20 shadow-[0_0_20px_rgba(255,255,255,0.4)]' : 'border-white/20 bg-black/40'}`}>
                                    {lens.emoji}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-14">
                            <div className="flex gap-3 overflow-x-auto no-scrollbar max-w-[120px]">
                                {FILTERS.map((f, i) => (
                                    <button key={f.id} onClick={() => setFilterIndex(i)} className={`flex-shrink-0 w-10 h-10 rounded-xl border-2 transition-all ${filterIndex === i ? 'border-sky-500 scale-110' : 'border-white/10'}`} style={{ filter: f.style.filter, background: 'rgba(255,255,255,0.1)' }} />
                                ))}
                            </div>

                            <button onClick={capturePhoto} className="w-24 h-24 rounded-full border-[6px] border-white p-2 active:scale-90 transition-transform shadow-2xl">
                                <div className="w-full h-full bg-white rounded-full shadow-inner"></div>
                            </button>

                            <div className="w-10 h-10" />
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'editing' && (
                <div ref={editorRef} className={`relative flex-grow flex flex-col transition-all duration-500 bg-gradient-to-br ${initialSharedContent ? PULSE_GRADIENTS[bgIndex] : 'bg-black'}`}>
                    {/* BARRA DE FERRAMENTAS SUPERIOR */}
                    <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-gradient-to-b from-black/40 to-transparent">
                        <button onClick={() => setViewMode('camera')} className="text-white text-3xl font-light p-2 active:scale-90 transition-transform">&times;</button>
                        <div className="flex gap-4">
                            <button onClick={() => setIsAddingText(true)} className="w-12 h-12 bg-black/40 backdrop-blur-2xl rounded-full text-white border border-white/20 font-black text-sm active:scale-90 transition-all">Aa</button>
                            <button onClick={() => setIsStickerModalOpen(true)} className="w-12 h-12 bg-black/40 backdrop-blur-2xl rounded-full text-white border border-white/20 flex items-center justify-center active:scale-90 transition-all">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </button>
                            <button onClick={() => setIsMusicModalOpen(true)} className={`w-12 h-12 rounded-full border border-white/20 backdrop-blur-2xl transition-all flex items-center justify-center active:scale-90 ${selectedMusic ? 'bg-sky-500 text-white' : 'bg-black/40 text-white'}`}>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                            </button>
                        </div>
                        <Button onClick={handleSubmit} disabled={submitting} className="!w-auto !py-2.5 !px-8 !bg-white !text-black !rounded-full !font-black !text-[12px] !uppercase !tracking-widest shadow-2xl">
                            {submitting ? '...' : 'Enviar'}
                        </Button>
                    </header>

                    <div className="flex-grow relative flex items-center justify-center overflow-hidden">
                        {/* CONTEÚDO PRINCIPAL COM MOTOR DE ESCALA */}
                        <div className="relative transition-transform duration-200 ease-out" style={{ transform: `scale(${mediaScale})` }}>
                            {mediaPreview && !initialSharedContent && (
                                <img src={mediaPreview} className="max-w-full max-h-[85vh] object-contain shadow-[0_40px_80px_rgba(0,0,0,0.5)] rounded-[2.5rem]" />
                            )}
                            
                            {initialSharedContent && (
                                <div className="w-80 bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.6)] overflow-hidden border dark:border-white/5 animate-slide-up">
                                    <div className="p-4 flex items-center gap-3 border-b dark:border-zinc-800">
                                        <img src={initialSharedContent.avatar} className="w-8 h-8 rounded-full object-cover" />
                                        <span className="font-black text-xs">@{initialSharedContent.username}</span>
                                    </div>
                                    <div className="aspect-square bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
                                        <img src={initialSharedContent.imageUrl} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="p-4 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Ver publicação</span></div>
                                </div>
                            )}
                        </div>

                        {/* STICKERS RENDERER */}
                        {stickers.map(s => (
                            <div 
                                key={s.id} 
                                className="absolute cursor-move active:scale-110 transition-transform"
                                style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%, -50%) scale(1)' }}
                            >
                                <img src={s.url} className="w-32 h-32 object-contain" />
                                <button onClick={() => setStickers(stickers.filter(st => st.id !== s.id))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black shadow-lg">&times;</button>
                            </div>
                        ))}

                        {/* TEXT OVERLAY */}
                        {overlayText && (
                            <div className="absolute px-8 py-4 bg-black/40 backdrop-blur-xl rounded-[2rem] text-white font-black text-4xl text-center shadow-2xl z-20 pointer-events-none border border-white/10" style={{ fontFamily: FONTS[fontIndex].family }}>
                                {overlayText}
                            </div>
                        )}

                        {/* CONTROLE DE ESCALA LATERAL (SLIDER) */}
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-50">
                            <div className="bg-black/60 backdrop-blur-3xl p-4 rounded-full border border-white/10 h-64 flex flex-col items-center justify-between shadow-2xl">
                                <span className="text-[10px] font-black text-white/50 uppercase vertical-text tracking-widest mb-4">{t('createPulse.scaleLabel')}</span>
                                <input 
                                    type="range" min="0.3" max="1.8" step="0.01" value={mediaScale} 
                                    onChange={(e) => setMediaScale(parseFloat(e.target.value))}
                                    className="h-44 accent-white vertical-slider"
                                    style={{ writingMode: 'bt-lr', appearance: 'slider-vertical' } as any}
                                />
                            </div>
                        </div>
                    </div>

                    {/* SELETOR DE GRADIENTE (MODO COMPARTILHADO) */}
                    {initialSharedContent && (
                        <div className="p-8 flex justify-center gap-4 overflow-x-auto no-scrollbar bg-gradient-to-t from-black/20 to-transparent">
                            {PULSE_GRADIENTS.map((grad, i) => (
                                <button key={i} onClick={() => setBgIndex(i)} className={`w-12 h-12 rounded-full border-[3px] transition-all ${bgIndex === i ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'border-white/20 scale-90'} bg-gradient-to-br ${grad}`} />
                            ))}
                        </div>
                    )}

                    {/* MODAL DE ADIÇÃO DE TEXTO */}
                    {isAddingText && (
                        <div className="absolute inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-12 animate-fade-in">
                            <textarea autoFocus className="bg-transparent text-white text-center text-6xl font-black outline-none w-full resize-none leading-tight placeholder:text-white/20" placeholder="Digite algo..." value={overlayText} onChange={e => setOverlayText(e.target.value)} />
                            <div className="flex gap-4 mt-12 overflow-x-auto no-scrollbar max-w-full p-2">
                                {FONTS.map((f, i) => (
                                    <button key={f.id} onClick={() => setFontIndex(i)} className={`px-8 py-3 rounded-full border-2 font-black text-xs uppercase tracking-widest transition-all ${fontIndex === i ? 'bg-white border-white text-black scale-105' : 'bg-transparent border-white/20 text-white/50 hover:border-white/40'}`}>{f.name}</button>
                                ))}
                            </div>
                            <Button onClick={() => setIsAddingText(false)} className="mt-16 !w-auto !px-20 !py-5 !rounded-full !font-black !text-sm !uppercase !tracking-[0.5em] !bg-sky-500 !text-white shadow-[0_15px_30px_rgba(14,165,233,0.3)] active:scale-95">Concluir</Button>
                        </div>
                    )}

                    {/* MODAL DE STICKERS GIPHY */}
                    {isStickerModalOpen && (
                        <div className="absolute inset-0 bg-black/90 z-[100] flex flex-col p-6 animate-fade-in">
                            <header className="flex justify-between items-center mb-8">
                                <h3 className="text-white font-black uppercase tracking-[0.3em] text-sm">{t('createPulse.stickers')}</h3>
                                <button onClick={() => setIsStickerModalOpen(false)} className="text-white text-4xl font-light">&times;</button>
                            </header>
                            <div className="relative mb-6">
                                <input type="text" value={giphyQuery} onChange={e => setGiphyQuery(e.target.value)} placeholder={t('createPulse.searchGifs')} className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl p-4 pl-12 text-white font-bold outline-none focus:border-sky-500 transition-all" />
                                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <div className="flex-grow overflow-y-auto grid grid-cols-3 gap-3 no-scrollbar pb-10">
                                {giphyResults.map(g => (
                                    <button key={g.id} onClick={() => addSticker(g.images.fixed_height.url)} className="aspect-square bg-zinc-800/30 rounded-2xl overflow-hidden hover:scale-105 active:scale-95 transition-all">
                                        <img src={g.images.fixed_height_small.url} className="w-full h-full object-contain" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <input type="file" ref={fileInputRef} onChange={(e) => { if(e.target.files?.[0]) { const reader = new FileReader(); reader.onload = ev => { setMediaPreview(ev.target?.result as string); setViewMode('editing'); }; reader.readAsDataURL(e.target.files[0]); } }} style={{ display: 'none' }} accept="image/*" />
            <AddMusicModal isOpen={isMusicModalOpen} onClose={() => setIsMusicModalOpen(false)} postId="" isProfileModal={true} onMusicAdded={(m) => { setSelectedMusic(m); setIsMusicModalOpen(false); }} />
            
            <style>{`
                .vertical-slider { -webkit-appearance: slider-vertical; width: 6px; border-radius: 4px; }
                .vertical-text { writing-mode: vertical-lr; text-orientation: mixed; }
                @keyframes float { 0%, 100% { transform: translate(-50%, -52%); } 50% { transform: translate(-50%, -48%); } }
                .animate-float { animation: float 3s ease-in-out infinite; }
            `}</style>
        </div>
    );
};

export default CreatePulseModal;