
import React, { useState, useRef, useEffect } from 'react';
import {
    auth,
    db,
    storage,
    addDoc,
    collection,
    serverTimestamp,
    storageRef,
    uploadString,
    getDownloadURL,
    getDocs
} from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import MusicSearch from '../post/MusicSearch';

interface CreatePulseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPulseCreated: () => void;
}

type Follower = {
    id: string;
    username: string;
    avatar: string;
};

type MusicInfo = {
  nome: string;
  artista: string;
  capa: string;
  preview: string;
  startTime?: number;
};

const MusicIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M19.952 1.651a.75.75 0 01.298.599V16.303a3 3 0 01-2.176 2.884l-4.62 1.32a2.724 2.724 0 01-3.446-2.307 2.724 2.724 0 012.198-2.642l4.293-1.226V4.726l-7.396 2.113v11.082a3 3 0 01-2.176 2.884l-4.62 1.32a2.724 2.724 0 01-3.446-2.307 2.724 2.724 0 012.198-2.642l4.293-1.226V6.049c0-.77.548-1.43 1.31-1.647l8.621-2.462a.75.75 0 01.918.711z" clipRule="evenodd" />
    </svg>
);

const TextIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M2.273 5.625A4.483 4.483 0 015.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0018.75 3H5.25a3 3 0 00-2.977 2.625zM2.273 8.625A4.483 4.483 0 015.25 7.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0018.75 6H5.25a3 3 0 00-2.977 2.625zM5.25 9a3 3 0 00-3 3v2.25a3 3 0 003 3h13.5a3 3 0 003-3V12a3 3 0 00-3-3H5.25zM2.25 14.25a3 3 0 003 3V19.5a3 3 0 003 3h5.25a3 3 0 003-3v-2.25h-11.25z" />
    </svg>
);

const StickerIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 00-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 01-.189-.866c0-.298.059-.605.189-.866zm2.023 6.828a.75.75 0 10-1.06-1.06 3.752 3.752 0 01-5.304 0 .75.75 0 00-1.06 1.06 5.25 5.25 0 007.424 0z" clipRule="evenodd" />
    </svg>
);

const CloseIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const StarIcon: React.FC<{className?: string, active?: boolean}> = ({className, active}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill={active ? "#4ade80" : "currentColor"} stroke={active ? "#4ade80" : "currentColor"}>
        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
    </svg>
);

const MediaSelectIcon: React.FC = () => (
    <svg aria-label="Icon to represent media" className="w-24 h-24 text-zinc-600" fill="currentColor" role="img" viewBox="0 0 97.6 77.3"><path d="M16.3 24h.3c2.8-.2 4.9-2.6 4.8-5.4A4.9 4.9 0 0 0 16 13.6c-2.8.2-4.9 2.6-4.8 5.4.1 2.7 2.4 4.8 5.1 5zM42.4 28.9c-2.8.2-5.4-2-5.6-4.8-.2-2.8 2-5.4 4.8-5.6 2.8-.2 5.4 2 5.6 4.8.2 2.8-2 5.4-4.8 5.6z" fill="currentColor"></path><path d="M84.7 18.4 58 16.9l-.2-3.2c-.3-5.7-5.2-10.1-11-9.8L12.9 6c-5.7.3-10.1 5.2-9.8 11L5 51.1v.8c.3 5.7 5.2 10.1 11 9.8l24.7-1.9v-9.4l-14.4 1.1c-1.2.1-2.2-1-2.1-2.2l-.2-3.2 14.5-1.2c5.7-.3 10.1-5.2 9.8-11L51 15.1l18.7 1.4c1.2.1 2.2 1 2.1 2.2l.2 3.2-18.7-1.4c-5.7.3-10.1 5.2-9.8 11l-1.9 24.7c.1 1.2 1 2.2 2.2 2.1l14.4-1.1v9.4l-24.7 1.9c-5.7-.3-10.1-5.2-9.8-11L18.4 25.6v-.8c-.3-5.7 5.2-10.1 11-9.8l24.7 1.9v9.4l14.4-1.1c1.2-.1 2.2 1 2.1 2.2l.2 3.2-14.5 1.2c-5.7.3-10.1 5.2-9.8 11L49 60.3l-18.7-1.4c-1.2-.1-2.2-1-2.1-2.2l-.2-3.2 18.7 1.4c5.7-.3 10.1-5.2 9.8-11l1.9-24.7c-.1-1.2-1-2.2-2.2-2.1L31.2 20.1v-9.4l24.7-1.9c5.7.3 10.1 5.2 9.8 11l-2.1 28.9.2.6c.3 5.7-5.2-10.1-11 9.8L31.2 68.1v.8c.3 5.7 5.2 10.1 11 9.8l24.7-1.9v-9.4l-14.4 1.1c-1.2.1-2.2-1-2.1-2.2l-.2-3.2 14.5-1.2c5.7-.3 10.1-5.2 9.8-11L72.2 19l14.5-1.2c1.2-.1 2.2 1 2.1 2.2l-.2 3.2-14.5 1.2c-5.7.3-10.1 5.2-9.8 11l-1.9 24.7c.1 1.2 1 2.2 2.2 2.1l14.4-1.1v9.4l-24.7 1.9c-5.7-.3-10.1-5.2-9.8-11l2.1-28.9-.2-.6c-.3-5.7 5.2-10.1 11-9.8l21.5 1.7 2.1-28.9c-.3-5.7-5.2-10.1-11-9.8L21.5 4.9v.8c-.3 5.7 5.2 10.1 11 9.8l24.7-1.9v-9.4L31.2 6C25.5 5.7 21.1.8 21.4-5l2.1-28.9c.3-5.7 5.2-10.1 11-9.8l42.2-3.2c5.7-.3 10.1 5.2 9.8 11z" fill="currentColor"></path></svg>
);

const CreatePulseModal: React.FC<CreatePulseModalProps> = ({ isOpen, onClose, onPulseCreated }) => {
    const { t } = useLanguage();
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    const [caption, setCaption] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [isVentMode, setIsVentMode] = useState(false);
    const [allowedUsers, setAllowedUsers] = useState<string[]>([]);
    const [followers, setFollowers] = useState<Follower[]>([]);
    const [selectedMusic, setSelectedMusic] = useState<MusicInfo | null>(null);
    const [showMusicSearch, setShowMusicSearch] = useState(false);
    const [showMusicCover, setShowMusicCover] = useState(false);
    const [showCaptionInput, setShowCaptionInput] = useState(false);
    const [stickerPos, setStickerPos] = useState({ x: 50, y: 50 }); // Percentage 0-100

    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const initialPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (!isOpen) {
            setMediaFile(null);
            setMediaPreview(null);
            setMediaType(null);
            setCaption('');
            setError('');
            setIsVentMode(false);
            setAllowedUsers([]);
            setFollowers([]);
            setSelectedMusic(null);
            setShowMusicSearch(false);
            setShowMusicCover(false);
            setShowCaptionInput(false);
            setStickerPos({ x: 50, y: 50 });
        }
    }, [isOpen]);

    // Fetch followers for Vent Mode logic if needed
    useEffect(() => {
        if (isOpen && followers.length === 0) {
            const fetchFollowers = async () => {
                if (!auth.currentUser) return;
                try {
                    const followingRef = collection(db, 'users', auth.currentUser.uid, 'following');
                    const snapshot = await getDocs(followingRef);
                    const followersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Follower));
                    setFollowers(followersData);
                    // For Vent Mode, assume it sends to all followers by default when enabled, 
                    // or implement a selector. For simplicity in this UI, we'll select all followers if vent mode is on.
                    setAllowedUsers(followersData.map(f => f.id));
                } catch (error) {
                    console.error("Error fetching followers:", error);
                }
            };
            fetchFollowers();
        }
    }, [isOpen, followers.length]);


    if (!isOpen) return null;

    const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type.startsWith('image/')) {
                setMediaType('image');
            } else if (file.type.startsWith('video/')) {
                setMediaType('video');
            } else {
                setError(t('createPulse.invalidFileError'));
                return;
            }
            setMediaFile(file);
            setError('');
    
            const reader = new FileReader();
            reader.onload = (event) => {
                setMediaPreview(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleSubmit = async () => {
        const currentUser = auth.currentUser;
        if (!mediaFile || !currentUser || !mediaPreview) return;

        setSubmitting(true);
        setError('');
        try {
            const mediaUploadRef = storageRef(storage, `pulses/${currentUser.uid}/${Date.now()}-${mediaFile.name}`);
            await uploadString(mediaUploadRef, mediaPreview, 'data_url');
            const downloadURL = await getDownloadURL(mediaUploadRef);

            const pulseData: { [key: string]: any } = {
                authorId: currentUser.uid,
                mediaUrl: downloadURL,
                legenda: caption,
                createdAt: serverTimestamp(),
            };
            
            if (selectedMusic) {
                pulseData.musicInfo = selectedMusic;
                pulseData.showMusicCover = showMusicCover;
                pulseData.musicCoverPosition = stickerPos;
            }

            if (isVentMode) {
                pulseData.isVentMode = true;
                pulseData.allowedUsers = [...new Set([currentUser.uid, ...allowedUsers])];
            }

            await addDoc(collection(db, 'pulses'), pulseData);

            onPulseCreated();

        } catch (err) {
            console.error("Error creating pulse:", err);
            setError(t('createPulse.publishError'));
        } finally {
            setSubmitting(false);
        }
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        isDragging.current = true;
        dragStart.current = { x: e.clientX, y: e.clientY };
        initialPos.current = { ...stickerPos };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current || !previewContainerRef.current) return;
        e.preventDefault();
        e.stopPropagation();

        const rect = previewContainerRef.current.getBoundingClientRect();
        const deltaX = e.clientX - dragStart.current.x;
        const deltaY = e.clientY - dragStart.current.y;

        const deltaXPercent = (deltaX / rect.width) * 100;
        const deltaYPercent = (deltaY / rect.height) * 100;

        const newX = Math.max(0, Math.min(100, initialPos.current.x + deltaXPercent));
        const newY = Math.max(0, Math.min(100, initialPos.current.y + deltaYPercent));

        setStickerPos({ x: newX, y: newY });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    return (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col">
            {showMusicSearch && (
                <div className="absolute inset-0 bg-black z-50 flex flex-col">
                    <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                        <h2 className="text-white text-lg font-bold">Música</h2>
                        <button onClick={() => setShowMusicSearch(false)} className="text-white">Cancelar</button>
                    </div>
                    <div className="flex-grow overflow-y-auto">
                        <MusicSearch
                            onSelectMusic={(track) => {
                                setSelectedMusic(track);
                                setShowMusicCover(true);
                                setShowMusicSearch(false);
                            }}
                            onBack={() => setShowMusicSearch(false)}
                        />
                    </div>
                </div>
            )}

            {mediaPreview ? (
                <>
                    {/* Top Controls */}
                    <div className="absolute top-4 left-0 right-0 z-30 flex justify-between items-start px-4">
                        <button onClick={onClose} className="text-white drop-shadow-md">
                            <CloseIcon className="w-8 h-8" />
                        </button>
                        <div className="flex flex-col gap-4 items-center bg-black/40 backdrop-blur-sm rounded-full py-2 px-1">
                            <button onClick={() => setShowMusicSearch(true)} className="text-white p-2">
                                <MusicIcon className="w-6 h-6" />
                            </button>
                            <button onClick={() => setShowCaptionInput(!showCaptionInput)} className="text-white p-2">
                                <TextIcon className="w-6 h-6" />
                            </button>
                            {selectedMusic && (
                                <button onClick={() => setShowMusicCover(!showMusicCover)} className="text-white p-2">
                                    <StickerIcon className={`w-6 h-6 ${!showMusicCover ? 'opacity-50' : ''}`} />
                                </button>
                            )}
                            <button onClick={() => setIsVentMode(!isVentMode)} className="text-white p-2" title="Modo Desabafo">
                                <StarIcon className="w-6 h-6" active={isVentMode} />
                            </button>
                        </div>
                    </div>

                    {/* Main Canvas Area */}
                    <div 
                        ref={previewContainerRef}
                        className="flex-grow relative bg-zinc-900 flex items-center justify-center overflow-hidden touch-none"
                    >
                        {mediaType === 'image' && <img src={mediaPreview} alt="Preview" className="w-full h-full object-contain pointer-events-none" />}
                        {mediaType === 'video' && <video src={mediaPreview} autoPlay loop muted playsInline className="w-full h-full object-contain pointer-events-none" />}
                        
                        {/* Music Sticker */}
                        {selectedMusic && showMusicCover && (
                            <div 
                                className="absolute z-20 cursor-move touch-none"
                                style={{ 
                                    left: `${stickerPos.x}%`, 
                                    top: `${stickerPos.y}%`,
                                    transform: 'translate(-50%, -50%)'
                                }}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                            >
                                <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl border border-white/30 shadow-lg flex flex-col items-center gap-2 w-32 select-none">
                                    <img src={selectedMusic.capa} alt="Album Art" className="w-28 h-28 rounded-lg shadow-sm pointer-events-none" />
                                    <div className="text-center w-full">
                                        <p className="text-white text-xs font-bold truncate w-full pointer-events-none">{selectedMusic.nome}</p>
                                        <p className="text-white/80 text-[10px] truncate w-full pointer-events-none">{selectedMusic.artista}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Caption Overlay (Visual only, simple centered text for preview if typed) */}
                        {caption && !showCaptionInput && (
                            <div className="absolute bottom-32 left-0 right-0 px-8 text-center pointer-events-none">
                                <p className="text-white text-lg font-medium drop-shadow-md break-words">{caption}</p>
                            </div>
                        )}
                    </div>

                    {/* Caption Input Overlay */}
                    {showCaptionInput && (
                        <div className="absolute inset-0 bg-black/60 z-40 flex items-center justify-center" onClick={() => setShowCaptionInput(false)}>
                            <div className="w-full max-w-md px-4" onClick={e => e.stopPropagation()}>
                                <textarea
                                    value={caption}
                                    onChange={(e) => setCaption(e.target.value)}
                                    placeholder="Escreva uma legenda..."
                                    className="w-full bg-transparent text-white text-center text-xl placeholder:text-white/50 border-none outline-none resize-none font-medium"
                                    rows={3}
                                    autoFocus
                                />
                                <div className="text-center mt-4">
                                    <button onClick={() => setShowCaptionInput(false)} className="bg-white text-black px-6 py-2 rounded-full font-bold text-sm">
                                        Concluir
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bottom Controls */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 z-30 flex justify-end items-center bg-gradient-to-t from-black/80 to-transparent pt-12">
                        {error && <span className="text-red-500 text-xs mr-4">{error}</span>}
                        <button 
                            onClick={handleSubmit} 
                            disabled={submitting}
                            className="bg-white text-black px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-zinc-200 transition-colors disabled:opacity-50"
                        >
                            {submitting ? 'Publicando...' : 'Compartilhar'}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </>
            ) : (
                // Initial Select State
                <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
                    <button onClick={onClose} className="absolute top-4 right-4 text-white text-3xl font-light">&times;</button>
                    
                    <div onClick={triggerFileInput} className="cursor-pointer group flex flex-col items-center">
                        <MediaSelectIcon />
                        <h3 className="text-white text-xl font-bold mt-6 mb-2">Criar novo Pulso</h3>
                        <p className="text-zinc-400 text-sm">Selecione fotos e vídeos aqui</p>
                        <div className="mt-6 bg-sky-500 text-white font-semibold py-2 px-6 rounded-lg group-hover:bg-sky-600 transition-colors">
                            Selecionar do computador
                        </div>
                    </div>
                    
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleMediaChange} 
                        style={{ display: 'none' }} 
                        accept="image/*,video/*" 
                    />
                    {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
                </div>
            )}
        </div>
    )
};

export default CreatePulseModal;
