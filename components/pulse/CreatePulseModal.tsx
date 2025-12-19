
import React, { useState, useRef, useEffect } from 'react';
import { auth, db, storage, addDoc, collection, serverTimestamp, storageRef, uploadString, getDownloadURL } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';
import AddMusicModal from '../post/AddMusicModal';

const LENSES = [
    { id: 'none', label: 'createPulse.effectNone', emoji: '🚫', style: { filter: 'none' } },
    { id: 'bloom', label: 'createPulse.effectBloom', emoji: '✨', style: { filter: 'brightness(1.1) saturate(1.2) blur(0.2px) contrast(0.9)' } },
    { id: 'noir', label: 'createPulse.effectNoir', emoji: '🕶️', style: { filter: 'grayscale(1) contrast(1.5) brightness(0.8)' } },
    { id: 'cyber', label: 'createPulse.effectCyber', emoji: '🧬', style: { filter: 'hue-rotate(280deg) saturate(2) contrast(1.1)' } },
    { id: 'retro', label: 'createPulse.effectRetro', emoji: '🎞️', style: { filter: 'sepia(0.6) contrast(0.8) brightness(1.1)' } },
    { id: 'aura', label: 'createPulse.effectAura', emoji: '🔮', style: { filter: 'brightness(1.3) saturate(1.6) hue-rotate(-20deg)' } }
];

const FONTS = [
    { id: 'classic', name: 'Sans', family: 'sans-serif' },
    { id: 'modern', name: 'Serif', family: 'serif' },
    { id: 'neon', name: 'Neon', family: 'cursive' },
    { id: 'strong', name: 'Forte', family: 'Impact, sans-serif' }
];

type MusicInfo = { nome: string; artista: string; capa: string; preview: string; startTime?: number; };

interface CreatePulseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPulseCreated: () => void;
}

const FlipIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
);

const CreatePulseModal: React.FC<CreatePulseModalProps> = ({ isOpen, onClose, onPulseCreated }) => {
    const { t } = useLanguage();
    const [viewMode, setViewMode] = useState<'selection' | 'camera' | 'editing'>('selection');
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [lensId, setLensId] = useState('none');
    const [submitting, setSubmitting] = useState(false);
    const [isFlashActive, setIsFlashActive] = useState(false);
    
    // Camera state
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Editing state
    const [overlayText, setOverlayText] = useState('');
    const [isAddingText, setIsAddingText] = useState(false);
    const [textPos, setTextPos] = useState({ x: 50, y: 30 });
    const [textSize, setTextSize] = useState(32);
    const [fontIndex, setFontIndex] = useState(0);

    const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
    const [selectedMusic, setSelectedMusic] = useState<MusicInfo | null>(null);
    const [musicPos, setMusicPos] = useState({ x: 50, y: 70 });

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) { 
            stopCamera();
            setViewMode('selection');
            setMediaPreview(null); 
            setLensId('none');
            setSelectedMusic(null); 
            setOverlayText('');
        }
    }, [isOpen]);

    const startCamera = async (mode: 'user' | 'environment') => {
        stopCamera();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: mode,
                    width: { ideal: 1080 },
                    height: { ideal: 1920 }
                },
                audio: false 
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setViewMode('camera');
            setFacingMode(mode);
        } catch (err) {
            console.error("Camera access error:", err);
            alert("Não foi possível acessar a câmera.");
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const toggleCamera = () => {
        const nextMode = facingMode === 'user' ? 'environment' : 'user';
        startCamera(nextMode);
    };

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;
        
        setIsFlashActive(true);
        setTimeout(() => setIsFlashActive(false), 150);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const currentLens = LENSES.find(l => l.id === lensId);
        ctx.filter = currentLens?.style.filter || 'none';
        
        if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setMediaPreview(canvas.toDataURL('image/jpeg', 0.95));
        
        stopCamera();
        setViewMode('editing');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setMediaPreview(ev.target?.result as string);
                setViewMode('editing');
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!mediaPreview || submitting) return;
        setSubmitting(true);
        try {
            const path = `pulses/${auth.currentUser?.uid}/${Date.now()}.jpg`;
            const ref = storageRef(storage, path);
            await uploadString(ref, mediaPreview, 'data_url');
            const url = await getDownloadURL(ref);

            await addDoc(collection(db, 'pulses'), {
                authorId: auth.currentUser?.uid,
                mediaUrl: url,
                legenda: overlayText,
                textPosition: textPos,
                textSize,
                textFont: FONTS[fontIndex].id,
                musicInfo: selectedMusic,
                filter: LENSES.find(l => l.id === lensId)?.style.filter,
                createdAt: serverTimestamp(),
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

            {/* TELA DE SELEÇÃO */}
            {viewMode === 'selection' && (
                <div className="flex-grow flex flex-col items-center justify-center p-8 text-white gap-8 bg-zinc-950">
                    <div className="text-center">
                        <h2 className="text-4xl font-black italic tracking-tighter bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">Pulse</h2>
                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Crie o seu momento</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 w-full max-w-xs">
                        <button 
                            onClick={() => startCamera('user')}
                            className="w-full p-6 bg-white rounded-3xl flex items-center gap-4 active:scale-95 transition-all shadow-xl shadow-white/5"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            <div className="text-left">
                                <span className="block text-black font-black text-sm uppercase tracking-widest">{t('createPulse.takePhoto')}</span>
                                <span className="block text-zinc-400 text-[9px] font-bold uppercase">Usar câmera frontal ou traseira</span>
                            </div>
                        </button>

                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full p-6 bg-zinc-900 border border-white/10 rounded-3xl flex items-center gap-4 active:scale-95 transition-all"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
                                <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <div className="text-left">
                                <span className="block text-white font-black text-sm uppercase tracking-widest">{t('createPulse.gallery')}</span>
                                <span className="block text-zinc-500 text-[9px] font-bold uppercase">Escolher da galeria</span>
                            </div>
                        </button>
                    </div>
                    
                    <button onClick={onClose} className="mt-8 text-zinc-600 font-black uppercase text-[10px] tracking-[0.4em] hover:text-white transition-colors">{t('common.cancel')}</button>
                </div>
            )}

            {/* MODO CÂMERA */}
            {viewMode === 'camera' && (
                <div className="relative flex-grow bg-black">
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="w-full h-full object-cover"
                        style={{ 
                            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                            filter: LENSES.find(l => l.id === lensId)?.style.filter 
                        }}
                    />

                    {isFlashActive && <div className="absolute inset-0 bg-white z-[100]" />}
                    
                    {/* Controles do Topo */}
                    <div className="absolute top-8 left-0 right-0 px-6 flex justify-between items-center z-50">
                         <button onClick={() => setViewMode('selection')} className="text-white text-4xl font-light p-2 drop-shadow-xl">&times;</button>
                         <button 
                            onClick={toggleCamera}
                            className="p-4 bg-black/40 backdrop-blur-xl rounded-full text-white border border-white/20 active:rotate-180 transition-transform duration-500"
                         >
                            <FlipIcon className="w-6 h-6" />
                         </button>
                    </div>

                    {/* Controles da Base (Instagram Style) */}
                    <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-10">
                        
                        {/* Seletor Circular de Lentes */}
                        <div className="flex gap-5 items-center overflow-x-auto no-scrollbar w-full px-12 justify-center py-4">
                            {LENSES.map((lens) => (
                                <button
                                    key={lens.id}
                                    onClick={() => setLensId(lens.id)}
                                    className={`flex-shrink-0 transition-all duration-300 flex flex-col items-center ${lensId === lens.id ? 'scale-110' : 'scale-75 opacity-40'}`}
                                >
                                    <div className={`w-16 h-16 rounded-full border-[3px] flex items-center justify-center text-2xl bg-black/50 backdrop-blur-md transition-colors ${lensId === lens.id ? 'border-white' : 'border-white/30'}`}>
                                        {lens.emoji}
                                    </div>
                                    <span className={`block text-[8px] font-black text-white uppercase mt-2 tracking-[0.2em] transition-opacity ${lensId === lens.id ? 'opacity-100' : 'opacity-0'}`}>
                                        {t(lens.label)}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Botão Obturador */}
                        <button 
                            onClick={capturePhoto}
                            className="w-24 h-24 rounded-full border-4 border-white p-2 active:scale-90 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)] bg-white/10 backdrop-blur-sm"
                        >
                            <div className="w-full h-full bg-white rounded-full shadow-inner"></div>
                        </button>
                    </div>
                </div>
            )}

            {/* MODO EDIÇÃO */}
            {viewMode === 'editing' && (
                <div className="relative flex-grow bg-black flex flex-col">
                    <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent">
                        <button onClick={() => setViewMode('camera')} className="text-white text-3xl font-light p-2">&times;</button>
                        <div className="flex gap-4">
                            <button onClick={() => setIsAddingText(true)} className="w-12 h-12 bg-black/40 border border-white/20 rounded-full text-white backdrop-blur-xl font-black text-sm">Aa</button>
                            <button onClick={() => setIsMusicModalOpen(true)} className={`w-12 h-12 rounded-full border border-white/20 backdrop-blur-xl transition-all flex items-center justify-center ${selectedMusic ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'bg-black/40 text-white'}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                            </button>
                        </div>
                        <Button onClick={handleSubmit} disabled={submitting} className="!w-auto !py-2 !px-8 !bg-white !text-black !rounded-full !font-black !text-[11px] !uppercase !tracking-widest shadow-xl">
                            {submitting ? '...' : 'Enviar'}
                        </Button>
                    </header>

                    <div className="flex-grow relative flex items-center justify-center overflow-hidden">
                        {mediaPreview && (
                            <img 
                                src={mediaPreview} 
                                className="w-full h-full object-cover" 
                                alt="Pulse" 
                            />
                        )}
                        
                        {overlayText && (
                            <div 
                                className="absolute px-6 py-3 bg-black/40 backdrop-blur-md rounded-2xl text-white font-black text-center shadow-2xl border border-white/20"
                                style={{ left: `${textPos.x}%`, top: `${textPos.y}%`, transform: 'translate(-50%, -50%)', fontSize: `${textSize}px`, fontFamily: FONTS[fontIndex].family }}
                            >
                                {overlayText}
                            </div>
                        )}

                        {selectedMusic && (
                            <div 
                                className="absolute p-4 bg-black/70 backdrop-blur-xl rounded-[1.5rem] border border-white/20 flex items-center gap-4 w-64 shadow-2xl"
                                style={{ left: `${musicPos.x}%`, top: `${musicPos.y}%`, transform: 'translate(-50%, -50%)' }}
                            >
                                <img src={selectedMusic.capa} className="w-14 h-14 rounded-xl object-cover shadow-lg" alt="Cover" />
                                <div className="flex-grow overflow-hidden">
                                    <p className="text-white font-black text-sm truncate tracking-tight">{selectedMusic.nome}</p>
                                    <p className="text-white/50 text-[10px] truncate uppercase font-bold tracking-widest">{selectedMusic.artista}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {isAddingText && (
                        <div className="absolute inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-12 animate-fade-in">
                            <textarea 
                                autoFocus
                                className="bg-transparent text-white text-center text-5xl font-black outline-none w-full resize-none leading-tight placeholder:opacity-20"
                                placeholder="Diga algo..."
                                value={overlayText}
                                onChange={e => setOverlayText(e.target.value)}
                            />
                            <div className="flex gap-3 mt-12 overflow-x-auto no-scrollbar max-w-full p-2">
                                {FONTS.map((f, i) => (
                                    <button 
                                        key={f.id} 
                                        onClick={() => setFontIndex(i)}
                                        className={`px-6 py-2 rounded-full border-2 font-black text-[10px] uppercase tracking-[0.2em] transition-all whitespace-nowrap ${fontIndex === i ? 'bg-white border-white text-black scale-110' : 'border-white/20 text-white'}`}
                                    >
                                        {f.name}
                                    </button>
                                ))}
                            </div>
                            <Button onClick={() => setIsAddingText(false)} className="mt-12 !w-auto !px-16 !rounded-2xl !py-4 !font-black !uppercase !tracking-widest">Concluir</Button>
                        </div>
                    )}
                </div>
            )}

            <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept="image/*" />
            <AddMusicModal isOpen={isMusicModalOpen} onClose={() => setIsMusicModalOpen(false)} postId="" isProfileModal={true} onMusicAdded={(m) => { setSelectedMusic(m); setIsMusicModalOpen(false); }} />
        </div>
    );
};

export default CreatePulseModal;
