
import React, { useState, useRef, useEffect } from 'react';
import { auth, db, storage, addDoc, collection, serverTimestamp, storageRef, uploadString, getDownloadURL, getDocs, query, where, doc, getDoc } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';
import AddMusicModal from '../post/AddMusicModal';
import SearchFollowingModal from '../post/SearchFollowingModal';

const PHOTO_FILTERS = [
    { id: 'none', label: 'Original', emoji: '🚫', filter: 'none' },
    { id: 'soft', label: 'Suave', emoji: '✨', filter: 'brightness(1.1) saturate(1.2) contrast(0.9)' },
    { id: 'noir', label: 'Cinema Noir', emoji: '🕶️', filter: 'grayscale(1) contrast(1.5) brightness(0.8)' },
    { id: 'cyber', label: 'Cyberpunk', emoji: '🧬', filter: 'hue-rotate(280deg) saturate(2) contrast(1.1)' },
    { id: 'retro', label: 'Vintage', emoji: '🎞️', filter: 'sepia(0.5) contrast(1.2) brightness(0.9)' },
    { id: 'aura', label: 'Místico', emoji: '🔮', filter: 'hue-rotate(90deg) saturate(1.5) brightness(1.1)' },
    { id: 'vivid', label: 'Vívido', emoji: '🌈', filter: 'saturate(1.8) contrast(1.1)' },
    { id: 'warm', label: 'Quente', emoji: '☀️', filter: 'sepia(0.3) saturate(1.4) brightness(1.1)' },
    { id: 'cold', label: 'Frio', emoji: '❄️', filter: 'hue-rotate(180deg) saturate(1.1) brightness(1.05)' },
    { id: 'drama', label: 'Dramático', emoji: '🎬', filter: 'contrast(1.6) brightness(0.9) saturate(1.2)' },
    { id: 'mist', label: 'Névoa', emoji: '🌫️', filter: 'brightness(1.2) contrast(0.7) saturate(0.8)' },
    { id: 'ocean', label: 'Oceano', emoji: '🌊', filter: 'hue-rotate(160deg) saturate(1.3) brightness(0.95)' },
    { id: 'forest', label: 'Floresta', emoji: '🌲', filter: 'hue-rotate(60deg) saturate(1.2) brightness(0.9)' },
    { id: 'blush', label: 'Blush', emoji: '🌸', filter: 'hue-rotate(330deg) saturate(1.3) brightness(1.05)' },
    { id: 'ghost', label: 'Fantasma', emoji: '👻', filter: 'brightness(1.5) contrast(0.8) grayscale(0.5)' },
    { id: 'crimson', label: 'Rubi', emoji: '💎', filter: 'hue-rotate(350deg) saturate(2) contrast(1.2)' },
    { id: 'lemon', label: 'Cítrico', emoji: '🍋', filter: 'hue-rotate(40deg) saturate(1.5) brightness(1.1)' },
    { id: 'twilight', label: 'Crepúsculo', emoji: '🌆', filter: 'hue-rotate(240deg) saturate(1.2) brightness(0.8) contrast(1.2)' },
    { id: 'neon', label: 'Neon Glow', emoji: '⚡', filter: 'contrast(1.4) brightness(1.1) saturate(2.5) hue-rotate(-20deg)' },
    { id: 'vapor', label: 'Vaporwave', emoji: '🏄', filter: 'hue-rotate(290deg) brightness(1.1) saturate(1.8) contrast(0.9)' }
];

const MUSIC_STYLES = [
    { id: 'standard', label: 'Padrão', emoji: '🎵' },
    { id: 'vinyl', label: 'Vinil', emoji: '💿' },
    { id: 'cassette', label: 'Cassete', emoji: '📻' },
    { id: 'glass', label: 'Vidro', emoji: '💎' }
];

const PULSE_GRADIENTS = [
    "from-zinc-900 to-black", 
    "from-sky-500 to-indigo-600", 
    "from-purple-600 to-pink-500", 
    "from-amber-400 to-orange-600",
    "from-emerald-400 to-cyan-500",
    "from-rose-400 to-purple-600"
];

const STATIC_STICKERS = [
    "https://cdn-icons-png.flaticon.com/512/2165/2165920.png",
    "https://cdn-icons-png.flaticon.com/512/744/744465.png",
    "https://cdn-icons-png.flaticon.com/512/1029/1029183.png",
    "https://cdn-icons-png.flaticon.com/512/744/744922.png",
    "https://cdn-icons-png.flaticon.com/512/616/616490.png",
    "https://cdn-icons-png.flaticon.com/512/3533/3533544.png",
    "https://cdn-icons-png.flaticon.com/512/2583/2583218.png",
    "https://cdn-icons-png.flaticon.com/512/1998/1998592.png",
    "https://cdn-icons-png.flaticon.com/512/2935/2935413.png",
    "https://cdn-icons-png.flaticon.com/512/2995/2995101.png"
];

type MusicInfo = { nome: string; artista: string; capa: string; preview: string; startTime?: number; };
type Sticker = { id: string; url: string; x: number; y: number; scale: number; };

const CreatePulseModal: React.FC<{ isOpen: boolean; onClose: () => void; onPulseCreated: () => void; initialSharedContent?: any; }> = ({ isOpen, onClose, onPulseCreated, initialSharedContent }) => {
    const { t } = useLanguage();
    const [viewMode, setViewMode] = useState<'camera' | 'editing'>('camera');
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [filterIndex, setFilterIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    
    const [mediaScale, setMediaScale] = useState(1);
    const [bgIndex, setBgIndex] = useState(0);
    const [stickers, setStickers] = useState<Sticker[]>([]);
    const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);
    const [draggingStickerId, setDraggingStickerId] = useState<string | null>(null);

    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const requestRef = useRef<number | null>(null);

    const [overlayText, setOverlayText] = useState('');
    const [isAddingText, setIsAddingText] = useState(false);
    const [selectedMusic, setSelectedMusic] = useState<MusicInfo | null>(null);
    const [musicStyleIndex, setMusicStyleIndex] = useState(0);
    const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
    
    // Group Pulse
    const [isGroupPulse, setIsGroupPulse] = useState(false);
    const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);

    // Menu de Ferramentas
    const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
    const [activeControl, setActiveControl] = useState<'filters' | 'styles' | 'scale' | 'background' | null>(null);

    useEffect(() => {
        if (isOpen && initialSharedContent) {
            setViewMode('editing');
            if (initialSharedContent.musicInfo) setSelectedMusic(initialSharedContent.musicInfo);
        }
    }, [isOpen, initialSharedContent]);

    const processVideoFrame = () => {
        if (!videoRef.current || !canvasRef.current || viewMode !== 'camera') return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (video.readyState >= 2) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.save();
            if (facingMode === 'user') {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.restore();
        }
        requestRef.current = requestAnimationFrame(processVideoFrame);
    };

    useEffect(() => {
        let stream: MediaStream | null = null;
        const startStream = async () => {
            if (viewMode !== 'camera' || !isOpen || initialSharedContent) return;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current?.play();
                        processVideoFrame();
                    };
                }
            } catch (err) { console.error(err); }
        };
        startStream();
        return () => { 
            if (stream) stream.getTracks().forEach(t => t.stop());
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [viewMode, facingMode, isOpen, initialSharedContent]);

    const capturePhoto = () => {
        if (!canvasRef.current) return;
        setMediaPreview(canvasRef.current.toDataURL('image/jpeg', 0.9));
        setViewMode('editing');
    };

    const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setMediaPreview(ev.target?.result as string);
                setViewMode('editing');
            };
            reader.readAsDataURL(file);
        }
    };

    const addSticker = (url: string) => {
        setStickers([...stickers, { id: Date.now().toString(), url, x: 50, y: 50, scale: 1 }]);
        setIsStickerModalOpen(false);
    };

    const handleStickerDrag = (e: React.PointerEvent) => {
        if (!draggingStickerId || !editorContainerRef.current) return;
        
        const rect = editorContainerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        setStickers(prev => prev.map(s => 
            s.id === draggingStickerId ? { ...s, x, y } : s
        ));
    };

    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            let finalUrl = "";
            if (mediaPreview) {
              const img = new Image();
              img.src = mediaPreview;
              await new Promise(resolve => img.onload = resolve);
              
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = img.width;
              tempCanvas.height = img.height;
              const tCtx = tempCanvas.getContext('2d');
              if (tCtx) {
                  tCtx.filter = PHOTO_FILTERS[filterIndex].filter;
                  tCtx.drawImage(img, 0, 0);
                  const processedData = tempCanvas.toDataURL('image/jpeg', 0.85);
                  
                  const path = `pulses/${auth.currentUser?.uid}/${Date.now()}.jpg`;
                  const ref = storageRef(storage, path);
                  await uploadString(ref, processedData, 'data_url');
                  finalUrl = await getDownloadURL(ref);
              }
            }

            await addDoc(collection(db, 'pulses'), {
                authorId: auth.currentUser?.uid,
                mediaUrl: finalUrl,
                legenda: overlayText,
                musicInfo: selectedMusic,
                musicStyle: MUSIC_STYLES[musicStyleIndex].id,
                mediaScale: mediaScale,
                bgGradient: initialSharedContent ? PULSE_GRADIENTS[bgIndex] : null,
                stickers: stickers,
                createdAt: serverTimestamp(),
                type: initialSharedContent ? 'shared_post' : 'normal',
                sharedPostData: initialSharedContent || null,
                filter: PHOTO_FILTERS[filterIndex].filter,
                isGroup: isGroupPulse,
                members: selectedMembers.map(m => m.id)
            });
            onPulseCreated();
            onClose();
        } catch (error) { console.error(error); }
        setSubmitting(false);
    };

    if (!isOpen) return null;

    const ActionListButton = ({ icon, label, onClick, isActive = false }: any) => (
        <button 
            onClick={onClick} 
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${isActive ? 'bg-sky-500 text-white shadow-lg' : 'bg-white/5 dark:bg-zinc-800/40 text-white/80 border border-white/5 hover:bg-white/10'}`}
        >
            <div className={`w-8 h-8 flex items-center justify-center ${isActive ? 'text-white' : 'text-sky-500'}`}>
                {icon}
            </div>
            <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black z-[70] flex flex-col overflow-hidden select-none touch-none animate-fade-in">
            <video ref={videoRef} className="hidden" playsInline muted />
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleGalleryUpload} />
            
            {viewMode === 'camera' && !initialSharedContent && (
                <div className="relative flex-grow bg-black">
                    <canvas ref={canvasRef} className="w-full h-full object-contain" />
                    
                    <div className="absolute top-8 left-6 z-50">
                         <button onClick={onClose} className="text-white text-4xl font-light active:scale-90 transition-transform">&times;</button>
                    </div>

                    <div className="absolute bottom-12 left-0 right-0 flex items-center justify-between px-12 z-50">
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-14 h-14 rounded-2xl bg-zinc-800/80 border-2 border-white/30 overflow-hidden active:scale-90 transition-transform flex items-center justify-center shadow-2xl"
                        >
                            <svg className="w-7 h-7 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </button>

                        <button onClick={capturePhoto} className="w-24 h-24 rounded-full border-[8px] border-white p-2 active:scale-90 transition-transform shadow-2xl">
                            <div className="w-full h-full bg-white rounded-full shadow-inner"></div>
                        </button>

                        <button 
                            onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} 
                            className="w-14 h-14 rounded-full bg-black/40 border-2 border-white/20 flex items-center justify-center text-white active:rotate-180 transition-all duration-500"
                        >
                            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                        </button>
                    </div>
                </div>
            )}

            {viewMode === 'editing' && (
                <div 
                    ref={editorContainerRef}
                    onPointerMove={handleStickerDrag}
                    onPointerUp={() => setDraggingStickerId(null)}
                    className={`relative flex-grow flex flex-col transition-all duration-500 ${initialSharedContent ? `bg-gradient-to-br ${PULSE_GRADIENTS[bgIndex]}` : 'bg-black'}`}
                >
                    <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-gradient-to-b from-black/60 to-transparent">
                        <button onClick={() => initialSharedContent ? onClose() : setViewMode('camera')} className="text-white text-3xl font-light p-2 active:scale-90 transition-transform">&times;</button>
                        
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setIsActionMenuOpen(!isActionMenuOpen)} 
                                className={`w-12 h-12 rounded-full border border-white/20 flex items-center justify-center transition-all ${isActionMenuOpen ? 'bg-sky-500 text-white rotate-90 shadow-[0_0_20px_#0ea5e9]' : 'bg-black/40 backdrop-blur-2xl text-white'}`}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M4 6h16M4 12h16m-7 6h7" /></svg>
                            </button>
                        </div>

                        <Button onClick={handleSubmit} disabled={submitting} className="!w-auto !py-2.5 !px-8 !bg-white !text-black !rounded-full !font-black !text-[12px] !uppercase !tracking-widest shadow-2xl">
                            {submitting ? '...' : 'Enviar'}
                        </Button>
                    </header>

                    {/* Lista de Ações Animada */}
                    {isActionMenuOpen && (
                        <div className="absolute top-24 right-6 z-[60] w-60 flex flex-col gap-2 animate-slide-down">
                            <ActionListButton 
                                onClick={() => { setIsAddingText(true); setIsActionMenuOpen(false); }}
                                label="Escrever Texto"
                                icon={<span className="text-lg font-black">Aa</span>}
                            />
                            <ActionListButton 
                                onClick={() => { setIsStickerModalOpen(true); setIsActionMenuOpen(false); }}
                                label="Figurinhas"
                                icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                            />
                            <ActionListButton 
                                onClick={() => { setIsMusicModalOpen(true); setIsActionMenuOpen(false); }}
                                label={selectedMusic ? "Trocar Música" : "Adicionar Música"}
                                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>}
                                isActive={!!selectedMusic}
                            />
                            <ActionListButton 
                                onClick={() => { setIsMemberModalOpen(true); setIsActionMenuOpen(false); }}
                                label={t('createPulse.groupPulse')}
                                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                                isActive={isGroupPulse}
                            />
                            {selectedMusic && (
                                <ActionListButton 
                                    onClick={() => { setActiveControl('styles'); setIsActionMenuOpen(false); }}
                                    label="Visual da Capa"
                                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>}
                                    isActive={activeControl === 'styles'}
                                />
                            )}
                            {!initialSharedContent && (
                                <ActionListButton 
                                    onClick={() => { setActiveControl('filters'); setIsActionMenuOpen(false); }}
                                    label="Aplicar Filtro"
                                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                                    isActive={activeControl === 'filters'}
                                />
                            )}
                            {initialSharedContent && (
                                <ActionListButton 
                                    onClick={() => { setActiveControl('background'); setIsActionMenuOpen(false); }}
                                    label="Cor do Fundo"
                                    icon={<div className="w-5 h-5 rounded-full bg-gradient-to-tr from-pink-500 to-indigo-500" />}
                                    isActive={activeControl === 'background'}
                                />
                            )}
                            <ActionListButton 
                                onClick={() => { setActiveControl('scale'); setIsActionMenuOpen(false); }}
                                label="Zoom / Escala"
                                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>}
                                isActive={activeControl === 'scale'}
                            />
                        </div>
                    )}

                    <div className="flex-grow relative flex items-center justify-center overflow-hidden p-6">
                        <div 
                            className="relative transition-all duration-300 group" 
                            style={{ transform: `scale(${mediaScale})`, filter: !initialSharedContent ? PHOTO_FILTERS[filterIndex].filter : 'none' }}
                        >
                            {mediaPreview && !initialSharedContent && (
                                <img src={mediaPreview} className="max-w-full max-h-[75vh] object-contain shadow-[0_40px_80px_rgba(0,0,0,0.5)] rounded-[2.5rem] border border-white/10" />
                            )}
                            
                            {initialSharedContent && (
                                <div 
                                    onClick={() => setBgIndex((bgIndex + 1) % PULSE_GRADIENTS.length)}
                                    className="w-[85vw] max-w-[340px] bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden border dark:border-white/5 animate-slide-up cursor-pointer active:scale-95 transition-all"
                                >
                                    <div className="p-4 flex items-center gap-3 border-b dark:border-zinc-800">
                                        <img src={initialSharedContent.avatar} className="w-8 h-8 rounded-full object-cover border dark:border-zinc-700" />
                                        <span className="font-black text-xs">@{initialSharedContent.username}</span>
                                    </div>
                                    <div className="aspect-square bg-zinc-100 dark:bg-zinc-800">
                                        <img src={initialSharedContent.imageUrl} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="p-4 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Ver publicação</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {isGroupPulse && (
                            <div className="absolute top-32 left-1/2 -translate-x-1/2 bg-sky-500 text-white px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl animate-bounce">
                                {t('createPulse.groupPulseBadge')}
                            </div>
                        )}

                        {stickers.map(s => (
                            <div 
                                key={s.id} 
                                className="absolute cursor-move active:scale-110 transition-transform" 
                                style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%, -50%)' }}
                                onPointerDown={(e) => { e.stopPropagation(); setDraggingStickerId(s.id); }}
                            >
                                <img src={s.url} className="w-32 h-32 object-contain pointer-events-none" />
                            </div>
                        ))}

                        {overlayText && (
                            <div className="absolute px-8 py-4 bg-black/40 backdrop-blur-xl rounded-[2rem] text-white font-black text-4xl text-center shadow-2xl z-20 pointer-events-none border border-white/10">
                                {overlayText}
                            </div>
                        )}

                        {selectedMusic && (
                            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 animate-fade-in pointer-events-none flex flex-col items-center">
                                {musicStyleIndex === 0 && (
                                    <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 border border-white/20">
                                        <img src={selectedMusic.capa} className="w-6 h-6 rounded-md" />
                                        <span className="text-[10px] font-black text-white uppercase truncate max-w-[120px]">{selectedMusic.nome}</span>
                                    </div>
                                )}
                                {musicStyleIndex === 1 && (
                                    <div className="relative w-32 h-32 animate-spin-slow">
                                        <div className="absolute inset-0 bg-zinc-900 rounded-full border-4 border-black/20" />
                                        <img src={selectedMusic.capa} className="absolute inset-4 rounded-full border-2 border-white/10" />
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-black rounded-full border border-white/20" />
                                    </div>
                                )}
                                {musicStyleIndex === 2 && (
                                    <div className="bg-amber-100 p-2 rounded-lg shadow-xl border-t-4 border-amber-600 flex flex-col items-center gap-1 w-32 rotate-2">
                                        <div className="flex gap-4 mb-2">
                                            <div className="w-10 h-10 rounded-full bg-zinc-800 border-4 border-black" />
                                            <div className="w-10 h-10 rounded-full bg-zinc-800 border-4 border-black" />
                                        </div>
                                        <span className="text-[8px] font-mono text-zinc-800 uppercase text-center leading-none">{selectedMusic.nome}</span>
                                    </div>
                                )}
                                {musicStyleIndex === 3 && (
                                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-3 rounded-2xl flex items-center gap-3 w-48 shadow-2xl">
                                        <img src={selectedMusic.capa} className="w-10 h-10 rounded-xl" />
                                        <div className="flex-grow overflow-hidden">
                                            <p className="text-white font-black text-[10px] truncate">{selectedMusic.nome}</p>
                                            <p className="text-white/60 font-bold text-[8px] uppercase">{selectedMusic.artista}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Barra de Controles Contextuais */}
                    {activeControl && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/90 backdrop-blur-3xl border-t border-white/10 p-6 flex flex-col gap-4 animate-slide-up z-[70]">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                    {activeControl === 'filters' ? "Filtros de Imagem" : 
                                     activeControl === 'styles' ? "Estilo da Música" : 
                                     activeControl === 'background' ? "Cor de Fundo" : "Escala da Mídia"}
                                </span>
                                <button onClick={() => setActiveControl(null)} className="text-white/40 hover:text-white p-1 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M19 9l-7 7-7-7" /></svg>
                                </button>
                            </div>

                            {activeControl === 'filters' && (
                                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                                    {PHOTO_FILTERS.map((f, i) => (
                                        <button key={f.id} onClick={() => setFilterIndex(i)} className={`flex-shrink-0 flex flex-col items-center gap-2 group transition-all ${filterIndex === i ? 'scale-110' : 'opacity-40 scale-95'}`}>
                                            <div className={`w-14 h-14 rounded-2xl bg-zinc-800 border-2 overflow-hidden flex items-center justify-center text-2xl shadow-xl transition-all ${filterIndex === i ? 'border-sky-500' : 'border-transparent'}`}>
                                                {mediaPreview ? <img src={mediaPreview} className="w-full h-full object-cover" style={{ filter: f.filter }} /> : f.emoji}
                                            </div>
                                            <span className="text-[8px] font-black text-white uppercase tracking-tighter">{f.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {activeControl === 'styles' && (
                                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                                    {MUSIC_STYLES.map((style, idx) => (
                                        <button key={style.id} onClick={() => setMusicStyleIndex(idx)} className={`flex-shrink-0 flex flex-col items-center gap-2 group transition-all ${musicStyleIndex === idx ? 'scale-110' : 'opacity-40 scale-95'}`}>
                                            <div className={`w-14 h-14 rounded-2xl bg-zinc-800 border-2 flex items-center justify-center text-xl shadow-xl transition-all ${musicStyleIndex === idx ? 'border-sky-500' : 'border-transparent'}`}>
                                                {style.emoji}
                                            </div>
                                            <span className="text-[8px] font-black text-white uppercase">{style.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {activeControl === 'background' && (
                                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                                    {PULSE_GRADIENTS.map((g, i) => (
                                        <button key={i} onClick={() => setBgIndex(i)} className={`flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br ${g} border-2 transition-all ${bgIndex === i ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-white/10 opacity-60 scale-90'}`} />
                                    ))}
                                </div>
                            )}

                            {activeControl === 'scale' && (
                                <div className="flex items-center gap-6 py-4">
                                    <input type="range" min="0.5" max="1.5" step="0.01" value={mediaScale} onChange={(e) => setMediaScale(parseFloat(e.target.value))} className="flex-grow h-2 bg-zinc-800 accent-sky-500 rounded-full appearance-none cursor-pointer" />
                                    <span className="text-xs font-black text-white font-mono w-10">{(mediaScale * 100).toFixed(0)}%</span>
                                </div>
                            )}
                        </div>
                    )}

                    {isStickerModalOpen && (
                        <div className="absolute inset-0 bg-black/95 z-[100] flex flex-col p-6 animate-fade-in">
                            <header className="flex justify-between items-center mb-8">
                                <h3 className="text-white font-black uppercase tracking-[0.3em] text-sm">Figurinhas</h3>
                                <button onClick={() => setIsStickerModalOpen(false)} className="text-white text-4xl font-light">&times;</button>
                            </header>
                            <div className="flex-grow overflow-y-auto grid grid-cols-4 gap-4 no-scrollbar pb-10">
                                {STATIC_STICKERS.map((url, i) => (
                                    <button key={i} onClick={() => addSticker(url)} className="aspect-square bg-zinc-800/30 rounded-2xl p-2 overflow-hidden hover:scale-110 active:scale-95 transition-all border border-white/5">
                                        <img src={url} className="w-full h-full object-contain" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            <AddMusicModal isOpen={isMusicModalOpen} onClose={() => setIsMusicModalOpen(false)} postId="" isProfileModal={true} onMusicAdded={(m) => { setSelectedMusic(m); setIsMusicModalOpen(false); setIsActionMenuOpen(true); }} />
            
            <SearchFollowingModal 
                isOpen={isMemberModalOpen} 
                onClose={() => setIsMemberModalOpen(false)} 
                title={t('createPulse.groupPulse')}
                onSelect={(u) => {
                    if (selectedMembers.length < 9) {
                        setSelectedMembers([...selectedMembers, u]);
                        setIsGroupPulse(true);
                    }
                }}
            />

            <style>{`
                @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin-slow { animation: spin-slow 8s linear infinite; }
                @keyframes slide-down { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-slide-down { animation: slide-down 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default CreatePulseModal;
