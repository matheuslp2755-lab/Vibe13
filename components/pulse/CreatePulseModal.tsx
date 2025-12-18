
import React, { useState, useRef, useEffect } from 'react';
import { auth, db, storage, addDoc, collection, serverTimestamp, storageRef, uploadString, getDownloadURL, uploadBytes } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';
import AddMusicModal from '../post/AddMusicModal';
import { GoogleGenAI } from "@google/genai";

const FILTERS = [
    { name: 'Normal', filter: 'none' },
    { name: 'Clarendon', filter: 'contrast(1.2) saturate(1.35)' },
    { name: 'Moon', filter: 'grayscale(1) contrast(1.1) brightness(1.1)' },
    { name: 'Lark', filter: 'saturate(1.2) brightness(1.05)' },
    { name: 'Juno', filter: 'saturate(1.4) contrast(1.1) hue-rotate(-10deg)' },
    { name: 'Ludwig', filter: 'contrast(1.1) brightness(1.1) saturate(1.3)' },
    { name: 'Aden', filter: 'hue-rotate(-20deg) contrast(0.9) saturate(0.85) brightness(1.2)' },
    { name: 'Perpetua', filter: 'saturate(1.1) contrast(1.1) brightness(1.1)' },
    { name: 'Reyes', filter: 'sepia(0.2) contrast(0.85) brightness(1.1) saturate(0.75)' },
    { name: 'Gingham', filter: 'brightness(1.05) hue-rotate(-10deg)' }
];

const FONTS = [
    { id: 'classic', name: 'Clássico', family: 'sans-serif' },
    { id: 'modern', name: 'Moderno', family: 'serif' },
    { id: 'neon', name: 'Neon', family: 'cursive' },
    { id: 'typewriter', name: 'Máquina', family: 'monospace' },
    { id: 'strong', name: 'Forte', family: 'Impact, sans-serif' }
];

type MusicInfo = { nome: string; artista: string; capa: string; preview: string; startTime?: number; };

interface CreatePulseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPulseCreated: () => void;
}

const DownloadIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
);

const TrashIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const LocationIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
);

const CreatePulseModal: React.FC<CreatePulseModalProps> = ({ isOpen, onClose, onPulseCreated }) => {
    const { t } = useLanguage();
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [filterIndex, setFilterIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [isSavingLocal, setIsSavingLocal] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    // Canvas & Scale
    const [imageScale, setImageScale] = useState(1);
    const initialDistance = useRef<number | null>(null);
    const lastScale = useRef<number>(1);

    // Draggable Elements
    const [isDragging, setIsDragging] = useState(false);
    const [dragOverTrash, setDragOverTrash] = useState(false);
    const [activeDragElement, setActiveDragElement] = useState<'text' | 'music' | 'location' | 'countdown' | 'poll' | null>(null);

    // Text Sticker
    const [overlayText, setOverlayText] = useState('');
    const [isAddingText, setIsAddingText] = useState(false);
    const [textPos, setTextPos] = useState({ x: 50, y: 30 });
    const [textSize, setTextSize] = useState(24);
    const [fontIndex, setFontIndex] = useState(0);

    // Music Sticker
    const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
    const [selectedMusic, setSelectedMusic] = useState<MusicInfo | null>(null);
    const [musicMode, setMusicMode] = useState<'cover' | 'lyrics'>('cover');
    const [musicPos, setMusicPos] = useState({ x: 50, y: 50 });

    // Location Sticker
    const [location, setLocation] = useState<{ name: string; x: number; y: number } | null>(null);
    const [isAddingLocation, setIsAddingLocation] = useState(false);
    const [tempLoc, setTempLoc] = useState('');
    const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
    const [isSearchingLoc, setIsSearchingLoc] = useState(false);

    // Poll Sticker
    const [poll, setPoll] = useState<{ question: string; opt1: string; opt2: string; x: number; y: number } | null>(null);
    const [isAddingPoll, setIsAddingPoll] = useState(false);
    const [pollQ, setPollQ] = useState('');
    const [pollO1, setPollO1] = useState('Sim');
    const [pollO2, setPollO2] = useState('Não');

    // Countdown Sticker
    const [countdown, setCountdown] = useState<{ title: string; date: string; x: number; y: number } | null>(null);
    const [isAddingCountdown, setIsAddingCountdown] = useState(false);
    const [cdTitle, setCdTitle] = useState('');
    const [cdDate, setCdDate] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const exportCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!isOpen) { 
            setMediaFile(null); setMediaPreview(null); setFilterIndex(0); 
            setSelectedMusic(null); setOverlayText(''); setIsAddingText(false);
            setLocation(null); setPoll(null); setCountdown(null);
            setImageScale(1); setTextSize(24); setFontIndex(0);
            initialDistance.current = null;
            lastScale.current = 1;
            setIsMenuOpen(false);
        }
    }, [isOpen]);

    // Busca de locais reais
    useEffect(() => {
        if (tempLoc.length < 3) {
            setLocationSuggestions([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearchingLoc(true);
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const response = await ai.models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: `Atue como um buscador de locais do Instagram. Retorne APENAS uma lista separada por ponto e vírgula de 5 nomes de locais reais, endereços ou cidades que correspondam ao termo: "${tempLoc}". Não adicione explicações ou introduções.`,
                    config: {
                        tools: [{ googleMaps: {} }],
                    },
                });

                const text = response.text || "";
                const suggested = text.split(';').map(s => s.trim()).filter(s => s.length > 0);
                setLocationSuggestions(suggested);
            } catch (err) {
                console.error("Erro na busca de locais:", err);
            } finally {
                setIsSearchingLoc(false);
            }
        }, 800);

        return () => clearTimeout(delayDebounceFn);
    }, [tempLoc]);

    const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setMediaFile(file);
            const reader = new FileReader();
            reader.onload = (ev) => setMediaPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialDistance.current = dist;
            lastScale.current = imageScale;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && initialDistance.current !== null) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const factor = dist / initialDistance.current;
            const nextScale = Math.max(0.5, Math.min(4, lastScale.current * factor));
            setImageScale(nextScale);
        }
    };

    const onDragStart = (type: typeof activeDragElement) => {
        setIsDragging(true);
        setActiveDragElement(type);
    };

    const onDragEnd = (type: typeof activeDragElement) => {
        if (dragOverTrash) {
            if (type === 'text') setOverlayText('');
            if (type === 'music') setSelectedMusic(null);
            if (type === 'location') setLocation(null);
            if (type === 'poll') setPoll(null);
            if (type === 'countdown') setCountdown(null);
        }
        setIsDragging(false);
        setActiveDragElement(null);
        setDragOverTrash(false);
    };

    const handleDragMove = (e: React.PointerEvent, setter: (pos: { x: number, y: number }) => void, type: typeof activeDragElement) => {
        if (!containerRef.current || e.buttons !== 1) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        if (y < 15 && x > 35 && x < 65) {
            setDragOverTrash(true);
        } else {
            setDragOverTrash(false);
        }

        setter({ x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) });
    };

    const handleDownload = async () => {
        if (!mediaPreview || isSavingLocal) return;
        setIsSavingLocal(true);

        const canvas = exportCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const W = 1080;
        const H = 1920;
        canvas.width = W;
        canvas.height = H;

        try {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, W, H);

            const mainMedia = new Image();
            mainMedia.crossOrigin = "anonymous";
            mainMedia.src = mediaPreview;
            await new Promise((resolve) => (mainMedia.onload = resolve));

            ctx.save();
            ctx.filter = FILTERS[filterIndex].filter === 'none' ? 'none' : FILTERS[filterIndex].filter;
            
            const scale = imageScale;
            const imgAspect = mainMedia.width / mainMedia.height;
            const canvasAspect = W / H;
            let drawW, drawH, drawX, drawY;

            if (imgAspect > canvasAspect) {
                drawH = H * scale;
                drawW = drawH * imgAspect;
            } else {
                drawW = W * scale;
                drawH = drawW / imgAspect;
            }
            drawX = (W - drawW) / 2;
            drawY = (H - drawH) / 2;

            ctx.drawImage(mainMedia, drawX, drawY, drawW, drawH);
            ctx.restore();

            // Render Text
            if (overlayText) {
                ctx.save();
                const tx = (textPos.x / 100) * W;
                const ty = (textPos.y / 100) * H;
                const finalSize = (textSize / 100) * W * 2;
                ctx.font = `bold ${finalSize}px ${FONTS[fontIndex].family}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const metrics = ctx.measureText(overlayText);
                const pad = finalSize * 0.4;
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.beginPath();
                ctx.roundRect(tx - metrics.width/2 - pad, ty - finalSize/2 - pad/2, metrics.width + pad*2, finalSize + pad, 20);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.fillText(overlayText, tx, ty);
                ctx.restore();
            }

            // Render Music
            if (selectedMusic) {
                ctx.save();
                const mx = (musicPos.x / 100) * W;
                const my = (musicPos.y / 100) * H;
                const musicImg = new Image();
                musicImg.crossOrigin = "anonymous";
                musicImg.src = selectedMusic.capa;
                await new Promise((resolve) => (musicImg.onload = resolve));

                if (musicMode === 'cover') {
                    const size = W * 0.35;
                    ctx.save();
                    ctx.beginPath(); ctx.roundRect(mx - size/2, my - size/2, size, size, 30); ctx.clip();
                    ctx.drawImage(musicImg, mx - size/2, my - size/2, size, size);
                    ctx.restore();
                } else {
                    const boxW = W * 0.65;
                    const boxH = W * 0.18;
                    ctx.fillStyle = 'rgba(0,0,0,0.7)';
                    ctx.beginPath(); ctx.roundRect(mx - boxW/2, my - boxH/2, boxW, boxH, 25); ctx.fill();
                    const thumb = boxH * 0.75;
                    ctx.drawImage(musicImg, mx - boxW/2 + 20, my - thumb/2, thumb, thumb);
                    ctx.fillStyle = '#ffffff'; ctx.font = `bold ${W * 0.04}px sans-serif`; ctx.textAlign = 'left';
                    ctx.fillText(selectedMusic.nome, mx - boxW/2 + thumb + 40, my - 15);
                    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `${W * 0.03}px sans-serif`;
                    ctx.fillText(selectedMusic.artista, mx - boxW/2 + thumb + 40, my + 25);
                }
                ctx.restore();
            }

            // Render Location
            if (location) {
                ctx.save();
                const lx = (location.x / 100) * W;
                const ly = (location.y / 100) * H;
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                const txt = `📍 ${location.name}`;
                ctx.font = `bold ${W * 0.04}px sans-serif`;
                const m = ctx.measureText(txt);
                const p = 30;
                ctx.beginPath(); ctx.roundRect(lx - m.width/2 - p, ly - 35, m.width + p*2, 70, 35); ctx.fill();
                ctx.fillStyle = '#000000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(txt, lx, ly);
                ctx.restore();
            }

            // Render Poll
            if (poll) {
                ctx.save();
                const px = (poll.x / 100) * W;
                const py = (poll.y / 100) * H;
                const bw = W * 0.6;
                const bh = W * 0.3;
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.beginPath(); ctx.roundRect(px - bw/2, py - bh/2, bw, bh, 30); ctx.fill();
                ctx.fillStyle = '#000'; ctx.font = `bold ${W * 0.045}px sans-serif`; ctx.textAlign = 'center';
                ctx.fillText(poll.question, px, py - 40);
                ctx.fillStyle = 'rgba(0,0,0,0.05)';
                ctx.beginPath(); ctx.roundRect(px - bw/2 + 20, py + 10, bw/2 - 30, 80, 15); ctx.fill();
                ctx.beginPath(); ctx.roundRect(px + 10, py + 10, bw/2 - 30, 80, 15); ctx.fill();
                ctx.fillStyle = '#000'; ctx.font = `bold ${W * 0.035}px sans-serif`;
                ctx.fillText(poll.opt1, px - bw/4 + 5, py + 55);
                ctx.fillText(poll.opt2, px + bw/4 - 5, py + 55);
                ctx.restore();
            }

            // Render Countdown
            if (countdown) {
                ctx.save();
                const cx = (countdown.x / 100) * W;
                const cy = (countdown.y / 100) * H;
                const cw = W * 0.7;
                const ch = W * 0.35;
                ctx.fillStyle = 'rgba(0,0,0,0.8)';
                ctx.beginPath(); ctx.roundRect(cx - cw/2, cy - ch/2, cw, ch, 30); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = `bold ${W * 0.04}px sans-serif`; ctx.textAlign = 'center';
                ctx.fillText(countdown.title, cx, cy - 60);
                ctx.font = `bold ${W * 0.08}px monospace`;
                ctx.fillText("00 : 00 : 00", cx, cy + 20);
                ctx.font = `${W * 0.025}px sans-serif`;
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.fillText(`${t('createPulse.days')}  :  ${t('createPulse.hours')}  :  ${t('createPulse.mins')}`, cx, cy + 80);
                ctx.restore();
            }

            const link = document.createElement('a');
            link.download = `vibe-pulse-${Date.now()}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.95);
            link.click();
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar foto.");
        } finally {
            setIsSavingLocal(false);
        }
    };

    const handleSubmit = async () => {
        if (!mediaPreview || submitting) return;
        setSubmitting(true);
        try {
            const path = `pulses/${auth.currentUser?.uid}/${Date.now()}`;
            const ref = storageRef(storage, path);
            let url = '';
            
            if (mediaFile?.type.startsWith('video/')) {
                await uploadBytes(ref, mediaFile);
                url = await getDownloadURL(ref);
            } else {
                await uploadString(ref, mediaPreview, 'data_url');
                url = await getDownloadURL(ref);
            }

            await addDoc(collection(db, 'pulses'), {
                authorId: auth.currentUser?.uid,
                mediaUrl: url,
                filter: FILTERS[filterIndex].filter,
                imageScale,
                musicInfo: selectedMusic,
                musicMode,
                musicCoverPosition: musicPos,
                legenda: overlayText,
                textPosition: textPos,
                textSize,
                textFont: FONTS[fontIndex].id,
                location,
                poll,
                countdown,
                createdAt: serverTimestamp(),
            });
            onPulseCreated();
            onClose();
        } catch (error: any) { 
            console.error(error); 
        }
        setSubmitting(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black z-[70] flex flex-col select-none touch-none overflow-hidden">
            <canvas ref={exportCanvasRef} className="hidden" />
            
            {/* Lixeira superior */}
            <div className={`absolute top-10 left-1/2 -translate-x-1/2 z-[90] transition-all duration-300 pointer-events-none ${isDragging ? 'opacity-100 scale-110' : 'opacity-0 scale-50'}`}>
                <div className={`p-4 rounded-full backdrop-blur-xl border-2 ${dragOverTrash ? 'bg-red-500 border-white text-white' : 'bg-black/30 border-white/20 text-white'}`}>
                    <TrashIcon className="w-8 h-8" />
                </div>
            </div>

            {/* Cabeçalho superior */}
            <header className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-[80] bg-gradient-to-b from-black/60 to-transparent">
                <button onClick={onClose} className="text-white text-3xl font-light">&times;</button>
                <div className="flex items-center gap-3">
                    {mediaPreview && (
                        <>
                            <button onClick={handleDownload} disabled={isSavingLocal} className="text-white p-2.5 bg-black/30 rounded-full backdrop-blur-md active:scale-90 transition-transform">
                                {isSavingLocal ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <DownloadIcon className="w-6 h-6" />}
                            </button>
                            <Button onClick={handleSubmit} disabled={submitting} className="!w-auto !py-1 !px-6 !bg-white !text-black rounded-full font-bold">
                                {submitting ? '...' : 'Enviar'}
                            </Button>
                        </>
                    )}
                </div>
            </header>

            {/* Menu Lateral de Opções com Animação */}
            {mediaPreview && (
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-[85] flex flex-col items-center gap-4">
                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`p-3 rounded-full backdrop-blur-md transition-all duration-300 shadow-lg ${isMenuOpen ? 'bg-white text-black rotate-45 scale-110' : 'bg-black/30 text-white border border-white/20'}`}
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M12 4v16m8-8H4"/></svg>
                    </button>

                    <div className={`flex flex-col gap-3 transition-all duration-500 origin-top ${isMenuOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-10 scale-50 pointer-events-none'}`}>
                        <button onClick={() => { setIsAddingText(true); setIsMenuOpen(false); }} className="w-12 h-12 flex items-center justify-center bg-black/40 text-white rounded-full border border-white/20 backdrop-blur-sm font-bold text-lg hover:bg-white/20 transition-all hover:scale-110 active:scale-90">Aa</button>
                        <button onClick={() => { setIsMusicModalOpen(true); setIsMenuOpen(false); }} className="w-12 h-12 flex items-center justify-center bg-black/40 text-white rounded-full border border-white/20 backdrop-blur-sm hover:bg-white/20 transition-all hover:scale-110 active:scale-90">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                        </button>
                        <button onClick={() => { setIsAddingLocation(true); setIsMenuOpen(false); }} className="w-12 h-12 flex items-center justify-center bg-black/40 text-white rounded-full border border-white/20 backdrop-blur-sm hover:bg-white/20 transition-all hover:scale-110 active:scale-90">
                            <LocationIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => { setIsAddingPoll(true); setIsMenuOpen(false); }} className="w-12 h-12 flex items-center justify-center bg-black/40 text-white rounded-full border border-white/20 backdrop-blur-sm hover:bg-white/20 transition-all hover:scale-110 active:scale-90">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
                        </button>
                        <button onClick={() => { setIsAddingCountdown(true); setIsMenuOpen(false); }} className="w-12 h-12 flex items-center justify-center bg-black/40 text-white rounded-full border border-white/20 backdrop-blur-sm hover:bg-white/20 transition-all hover:scale-110 active:scale-90">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                    </div>
                </div>
            )}

            <div ref={containerRef} className="flex-grow relative overflow-hidden flex items-center justify-center bg-black" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
                {mediaPreview ? (
                    <div className="w-full h-full relative flex items-center justify-center">
                        <div className="w-full h-full transition-transform duration-75 flex items-center justify-center" style={{ filter: FILTERS[filterIndex].filter, transform: `scale(${imageScale})` }}>
                            {mediaFile?.type.startsWith('video/') ? <video src={mediaPreview} autoPlay loop muted playsInline className="w-full h-full object-contain" /> : <img src={mediaPreview} className="w-full h-full object-contain" />}
                        </div>

                        {/* Stickers */}
                        {overlayText && (
                            <div 
                                onPointerDown={() => onDragStart('text')}
                                onPointerUp={() => onDragEnd('text')}
                                onPointerMove={(e) => handleDragMove(e, setTextPos, 'text')}
                                className="absolute cursor-move px-4 py-2 bg-black/40 backdrop-blur-sm rounded-lg text-white font-bold shadow-lg border border-white/20 text-center z-10"
                                style={{ left: `${textPos.x}%`, top: `${textPos.y}%`, transform: 'translate(-50%, -50%)', fontSize: `${textSize}px`, fontFamily: FONTS[fontIndex].family }}
                            >
                                {overlayText}
                            </div>
                        )}

                        {selectedMusic && (
                            <div 
                                onPointerDown={() => onDragStart('music')}
                                onPointerUp={() => onDragEnd('music')}
                                onPointerMove={(e) => handleDragMove(e, setMusicPos, 'music')}
                                onClick={() => !isDragging && setMusicMode(m => m === 'cover' ? 'lyrics' : 'cover')}
                                className={`absolute cursor-move backdrop-blur-md rounded-xl border border-white/30 shadow-xl flex items-center transition-all z-10 ${musicMode === 'cover' ? 'w-32 flex-col p-2 gap-1' : 'w-64 p-3 gap-3 bg-black/40'}`}
                                style={{ left: `${musicPos.x}%`, top: `${musicPos.y}%`, transform: 'translate(-50%, -50%)' }}
                            >
                                <img src={selectedMusic.capa} className={`${musicMode === 'cover' ? 'w-28 h-28 rounded-lg' : 'w-12 h-12 rounded-md'}`} />
                                <div className={`${musicMode === 'cover' ? 'text-center' : 'text-left'} w-full text-white overflow-hidden`}>
                                    <p className="text-[10px] font-bold truncate">{selectedMusic.nome}</p>
                                    <p className="text-[8px] opacity-70 truncate">{selectedMusic.artista}</p>
                                </div>
                            </div>
                        )}

                        {location && (
                            <div 
                                onPointerDown={() => onDragStart('location')}
                                onPointerUp={() => onDragEnd('location')}
                                onPointerMove={(e) => handleDragMove(e, (p) => setLocation({...location, ...p}), 'location')}
                                className="absolute cursor-move px-4 py-2 bg-white/90 backdrop-blur-md rounded-full text-black font-bold shadow-xl z-10 flex items-center gap-1.5"
                                style={{ left: `${location.x}%`, top: `${location.y}%`, transform: 'translate(-50%, -50%)' }}
                            >
                                <LocationIcon className="w-4 h-4 text-sky-500" />
                                <span className="text-sm">{location.name}</span>
                            </div>
                        )}

                        {poll && (
                            <div 
                                onPointerDown={() => onDragStart('poll')}
                                onPointerUp={() => onDragEnd('poll')}
                                onPointerMove={(e) => handleDragMove(e, (p) => setPoll({...poll, ...p}), 'poll')}
                                className="absolute cursor-move w-64 p-4 bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl z-10 text-center border border-white"
                                style={{ left: `${poll.x}%`, top: `${poll.y}%`, transform: 'translate(-50%, -50%)' }}
                            >
                                <p className="font-black text-lg mb-4 text-black leading-tight">{poll.question}</p>
                                <div className="flex gap-2">
                                    <div className="flex-1 p-3 bg-black/5 rounded-2xl font-bold text-sm text-zinc-800">{poll.opt1}</div>
                                    <div className="flex-1 p-3 bg-black/5 rounded-2xl font-bold text-sm text-zinc-800">{poll.opt2}</div>
                                </div>
                            </div>
                        )}

                        {countdown && (
                            <div 
                                onPointerDown={() => onDragStart('countdown')}
                                onPointerUp={() => onDragEnd('countdown')}
                                onPointerMove={(e) => handleDragMove(e, (p) => setCountdown({...countdown, ...p}), 'countdown')}
                                className="absolute cursor-move w-72 p-5 bg-zinc-900/90 backdrop-blur-xl rounded-3xl shadow-2xl z-10 text-center border border-white/10"
                                style={{ left: `${countdown.x}%`, top: `${countdown.y}%`, transform: 'translate(-50%, -50%)' }}
                            >
                                <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-4">{countdown.title}</p>
                                <div className="flex justify-center gap-4 text-white">
                                    <div className="flex flex-col"><span className="text-3xl font-black tabular-nums">00</span><span className="text-[10px] opacity-40">{t('createPulse.days')}</span></div>
                                    <span className="text-3xl font-black mt-[-4px]">:</span>
                                    <div className="flex flex-col"><span className="text-3xl font-black tabular-nums">00</span><span className="text-[10px] opacity-40">{t('createPulse.hours')}</span></div>
                                    <span className="text-3xl font-black mt-[-4px]">:</span>
                                    <div className="flex flex-col"><span className="text-3xl font-black tabular-nums">00</span><span className="text-[10px] opacity-40">{t('createPulse.mins')}</span></div>
                                </div>
                            </div>
                        )}

                        {/* Filtros inferiores */}
                        <div className="absolute bottom-10 left-0 right-0 flex justify-start gap-4 overflow-x-auto px-10 no-scrollbar py-4 bg-gradient-to-t from-black/80 to-transparent">
                            {FILTERS.map((f, i) => (
                                <button key={i} onClick={() => setFilterIndex(i)} className={`flex-shrink-0 flex flex-col items-center gap-1 transition-transform ${filterIndex === i ? 'scale-110' : 'opacity-60 scale-90'}`}>
                                    <div className="w-12 h-12 rounded-lg border-2 border-white/50 overflow-hidden bg-zinc-800" style={{ filter: f.filter }}>
                                        {mediaPreview && <img src={mediaPreview} className="w-full h-full object-cover" />}
                                    </div>
                                    <span className="text-[10px] text-white font-bold">{f.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-white cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-dashed border-white/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <p className="font-semibold text-lg">Criar Pulse</p>
                    </div>
                )}

                {/* Modais de Stickers */}
                {isAddingText && (
                    <div className="absolute inset-0 bg-black/80 z-[100] flex flex-col items-center justify-between p-10">
                        <div className="w-full flex justify-between items-center">
                            <button onClick={() => setIsAddingText(false)} className="text-white font-bold">{t('common.cancel')}</button>
                            <div className="flex gap-2">
                                {FONTS.map((f, i) => (
                                    <button key={f.id} onClick={() => setFontIndex(i)} className={`w-8 h-8 rounded-full border border-white flex items-center justify-center text-[10px] ${fontIndex === i ? 'bg-white text-black' : 'text-white'}`} style={{ fontFamily: f.family }}>A</button>
                                ))}
                            </div>
                            <button onClick={() => setIsAddingText(false)} className="text-white font-bold">OK</button>
                        </div>
                        <div className="flex-grow flex items-center justify-center w-full relative">
                            <input type="range" min="14" max="80" value={textSize} onChange={(e) => setTextSize(parseInt(e.target.value))} className="absolute left-[-40px] top-1/2 -translate-y-1/2 w-48 h-1 accent-white -rotate-90" />
                            <textarea autoFocus className="bg-transparent text-white font-bold text-center outline-none w-full resize-none leading-tight" style={{ fontSize: `${textSize}px`, fontFamily: FONTS[fontIndex].family }} placeholder="Escreva algo..." value={overlayText} onChange={(e) => setOverlayText(e.target.value)} />
                        </div>
                    </div>
                )}

                {isAddingLocation && (
                    <div className="absolute inset-0 bg-black/80 z-[100] flex flex-col p-6 items-center">
                        <div className="w-full max-w-sm bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-700 mt-20 flex flex-col max-h-[70vh]">
                            <h3 className="text-white font-black text-xl mb-4">{t('createPulse.location')}</h3>
                            <div className="relative">
                                <input autoFocus type="text" className="w-full bg-zinc-800 text-white p-4 rounded-2xl outline-none focus:ring-2 ring-sky-500" placeholder={t('createPulse.locationPlaceholder')} value={tempLoc} onChange={e => setTempLoc(e.target.value)} />
                                {isSearchingLoc && <div className="absolute right-4 top-1/2 -translate-y-1/2"><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div></div>}
                            </div>
                            <div className="mt-4 flex-grow overflow-y-auto">
                                {locationSuggestions.map((loc, i) => (
                                    <button key={i} onClick={() => { setLocation({ name: loc, x: 50, y: 50 }); setIsAddingLocation(false); setTempLoc(''); setLocationSuggestions([]); }} className="w-full text-left p-4 hover:bg-white/10 border-b border-white/5 last:border-0 text-white text-sm transition-colors flex items-center gap-3">
                                        <LocationIcon className="w-4 h-4 text-sky-500 shrink-0" />
                                        <span>{loc}</span>
                                    </button>
                                ))}
                                {tempLoc.length >= 3 && locationSuggestions.length === 0 && !isSearchingLoc && <p className="text-zinc-500 text-xs p-4 text-center">{t('createPulse.searchingLocations')}</p>}
                            </div>
                            <div className="flex gap-3 mt-6"><Button className="!bg-zinc-800" onClick={() => { setIsAddingLocation(false); setTempLoc(''); setLocationSuggestions([]); }}>{t('common.cancel')}</Button></div>
                        </div>
                    </div>
                )}

                {isAddingPoll && (
                    <div className="absolute inset-0 bg-black/80 z-[100] flex flex-col p-6 items-center">
                        <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl mt-20">
                            <h3 className="text-black font-black text-xl mb-4 text-center">{t('createPulse.poll')}</h3>
                            <input autoFocus type="text" className="w-full bg-zinc-100 text-black p-4 rounded-2xl outline-none mb-3 font-bold" placeholder={t('createPulse.pollQuestion')} value={pollQ} onChange={e => setPollQ(e.target.value)} />
                            <div className="flex gap-2">
                                <input type="text" className="w-1/2 bg-zinc-100 text-black p-3 rounded-xl outline-none text-center font-bold" placeholder={t('createPulse.pollOption1')} value={pollO1} onChange={e => setPollO1(e.target.value)} />
                                <input type="text" className="w-1/2 bg-zinc-100 text-black p-3 rounded-xl outline-none text-center font-bold" placeholder={t('createPulse.pollOption2')} value={pollO2} onChange={e => setPollO2(e.target.value)} />
                            </div>
                            <div className="flex gap-3 mt-6"><Button className="!bg-zinc-100 !text-black" onClick={() => setIsAddingPoll(false)}>{t('common.cancel')}</Button><Button onClick={() => { if(pollQ) setPoll({ question: pollQ, opt1: pollO1||'Sim', opt2: pollO2||'Não', x: 50, y: 50 }); setIsAddingPoll(false); setPollQ(''); }}>OK</Button></div>
                        </div>
                    </div>
                )}

                {isAddingCountdown && (
                    <div className="absolute inset-0 bg-black/80 z-[100] flex flex-col p-6 items-center">
                        <div className="w-full max-w-sm bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-700 mt-20">
                            <h3 className="text-white font-black text-xl mb-4">{t('createPulse.countdown')}</h3>
                            <input autoFocus type="text" className="w-full bg-zinc-800 text-white p-4 rounded-2xl outline-none mb-3" placeholder={t('createPulse.countdownTitle')} value={cdTitle} onChange={e => setCdTitle(e.target.value)} />
                            <input type="date" className="w-full bg-zinc-800 text-white p-4 rounded-2xl outline-none mb-3" value={cdDate} onChange={e => setCdDate(e.target.value)} />
                            <div className="flex gap-3 mt-6"><Button className="!bg-zinc-800" onClick={() => setIsAddingCountdown(false)}>{t('common.cancel')}</Button><Button onClick={() => { if(cdTitle) setCountdown({ title: cdTitle, date: cdDate, x: 50, y: 50 }); setIsAddingCountdown(false); setCdTitle(''); }}>OK</Button></div>
                        </div>
                    </div>
                )}
            </div>

            <input type="file" ref={fileInputRef} onChange={handleMediaChange} style={{ opacity: 0, width: '0.1px', height: '0.1px', position: 'absolute', overflow: 'hidden', zIndex: -1 }} accept="image/*,video/*" />
            <AddMusicModal isOpen={isMusicModalOpen} onClose={() => setIsMusicModalOpen(false)} postId="" isProfileModal={true} onMusicAdded={(m) => { setSelectedMusic(m); setIsMusicModalOpen(false); }} />
        </div>
    );
};

export default CreatePulseModal;
