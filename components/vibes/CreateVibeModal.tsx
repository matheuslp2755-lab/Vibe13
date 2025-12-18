
import React, { useState, useRef, useEffect } from 'react';
import {
    auth,
    db,
    storage,
    addDoc,
    collection,
    serverTimestamp,
    storageRef,
    uploadBytes,
    getDownloadURL,
    uploadString,
} from '../../firebase';
import Button from '../common/Button';
import TextAreaInput from '../common/TextAreaInput';
import { useLanguage } from '../../context/LanguageContext';
import AddMusicModal from '../post/AddMusicModal';

interface CreateVibeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVibeCreated: () => void;
}

type MusicInfo = {
  nome: string;
  artista: string;
  capa: string;
  preview: string;
  startTime?: number;
};

const MediaUploadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-24 h-24 text-zinc-800 dark:text-zinc-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const CreateVibeModal: React.FC<CreateVibeModalProps> = ({ isOpen, onClose, onVibeCreated }) => {
    const { t } = useLanguage();
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    const [caption, setCaption] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [selectedMusic, setSelectedMusic] = useState<MusicInfo | null>(null);
    const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setMediaFile(null);
            setMediaPreview(null);
            setMediaType(null);
            setCaption('');
            setError('');
            setSelectedMusic(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setError('');
            setSelectedMusic(null);

            if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = function() {
                    window.URL.revokeObjectURL(video.src);
                    if (video.duration > 60) {
                        setError(t('createVibe.videoTooLong'));
                        return;
                    }
                    setMediaType('video');
                    setMediaFile(file);
                    setMediaPreview(URL.createObjectURL(file));
                };
                video.onerror = function() {
                    setError(t('createVibe.invalidFileError'));
                };
                video.src = URL.createObjectURL(file);
            } else if (file.type.startsWith('image/')) {
                setMediaType('image');
                setMediaFile(file);
                const reader = new FileReader();
                reader.onload = (ev) => setMediaPreview(ev.target?.result as string);
                reader.readAsDataURL(file);
            } else {
                setError(t('createVibe.invalidFileError'));
            }
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
            const path = `vibes/${currentUser.uid}/${Date.now()}-${mediaFile.name}`;
            const mediaUploadRef = storageRef(storage, path);
            let downloadURL = '';

            if (mediaType === 'image') {
                await uploadString(mediaUploadRef, mediaPreview, 'data_url');
                downloadURL = await getDownloadURL(mediaUploadRef);
            } else {
                await uploadBytes(mediaUploadRef, mediaFile);
                downloadURL = await getDownloadURL(mediaUploadRef);
            }

            await addDoc(collection(db, 'vibes'), {
                userId: currentUser.uid,
                videoUrl: downloadURL, // Mantido o nome videoUrl por compatibilidade, mas agora aceita imagem
                mediaType: mediaType,
                caption,
                likes: [],
                commentsCount: 0,
                musicInfo: selectedMusic,
                createdAt: serverTimestamp(),
            });

            onVibeCreated();
            onClose();

        } catch (err: any) {
            console.error("Error creating vibe:", err?.message || err);
            setError(t('createPost.publishError'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-4xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                    <h2 className="text-lg font-semibold">{t('createVibe.title')}</h2>
                    {mediaPreview && (
                         <Button onClick={handleSubmit} disabled={submitting} className="!w-auto !py-0 !px-3 !text-sm">
                            {submitting ? t('createVibe.publishing') : t('createVibe.publish')}
                        </Button>
                    )}
                </div>
                <div className="flex-grow overflow-y-auto">
                    {mediaPreview ? (
                        <div className="flex flex-col md:flex-row h-full">
                            <div className="w-full md:w-1/2 bg-black flex items-center justify-center">
                                {mediaType === 'video' ? (
                                    <video src={mediaPreview} controls className="max-h-[60vh] max-w-full object-contain" />
                                ) : (
                                    <img src={mediaPreview} className="max-h-[60vh] max-w-full object-contain" />
                                )}
                            </div>
                            <div className="w-full md:w-1/2 p-4 flex flex-col">
                                <div className="flex items-center mb-4">
                                    <img src={auth.currentUser?.photoURL || ''} alt={auth.currentUser?.displayName || 'User'} className="w-8 h-8 rounded-full object-cover"/>
                                    <p className="font-semibold text-sm ml-3">{auth.currentUser?.displayName}</p>
                                </div>
                                <TextAreaInput 
                                    id="caption"
                                    label={t('createVibe.captionLabel')}
                                    value={caption}
                                    onChange={(e) => setCaption(e.target.value)}
                                    className="!min-h-[100px]"
                                />
                                
                                {mediaType === 'image' && (
                                    <div className="mt-4">
                                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Trilha Sonora</p>
                                        {selectedMusic ? (
                                            <div className="flex items-center gap-3 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl border dark:border-zinc-700">
                                                <img src={selectedMusic.capa} className="w-12 h-12 rounded-lg" />
                                                <div className="flex-grow overflow-hidden">
                                                    <p className="font-bold text-sm truncate">{selectedMusic.nome}</p>
                                                    <p className="text-xs text-zinc-500 truncate">{selectedMusic.artista}</p>
                                                </div>
                                                <button onClick={() => setIsMusicModalOpen(true)} className="text-sky-500 font-bold text-xs">Trocar</button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => setIsMusicModalOpen(true)}
                                                className="w-full p-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl flex flex-col items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                                                <span className="text-sm font-semibold text-zinc-500">{t('createPost.addMusic')}</span>
                                            </button>
                                        )}
                                    </div>
                                )}

                                {error && <p className="text-red-500 text-xs text-center mt-2">{error}</p>}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-16 h-64">
                            <MediaUploadIcon />
                            <h3 className="text-xl mt-4 mb-2">Vídeo vertical ou Foto</h3>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleMediaChange} 
                                style={{ opacity: 0, width: '0.1px', height: '0.1px', position: 'absolute', overflow: 'hidden', zIndex: -1 }} 
                                accept="video/*,image/*" 
                            />
                            <Button onClick={triggerFileInput}>
                                {t('createPost.selectFromComputer')}
                            </Button>
                            {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
                        </div>
                    )}
                </div>
            </div>
            <AddMusicModal isOpen={isMusicModalOpen} onClose={() => setIsMusicModalOpen(false)} postId="" isProfileModal={true} onMusicAdded={(m) => { setSelectedMusic(m); setIsMusicModalOpen(false); }} />
        </div>
    )
};

export default CreateVibeModal;
