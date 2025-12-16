
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
} from '../../firebase';
import Button from '../common/Button';
import TextAreaInput from '../common/TextAreaInput';
import { useLanguage } from '../../context/LanguageContext';

interface CreateVibeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVibeCreated: () => void;
}

const VideoUploadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-24 h-24 text-zinc-800 dark:text-zinc-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

const CreateVibeModal: React.FC<CreateVibeModalProps> = ({ isOpen, onClose, onVibeCreated }) => {
    const { t } = useLanguage();
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setMediaFile(null);
            setMediaPreview(null);
            setCaption('');
            setError('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setError('');

            if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = function() {
                    window.URL.revokeObjectURL(video.src);
                    if (video.duration > 60) {
                        setError(t('createVibe.videoTooLong'));
                        return;
                    }
                    setMediaFile(file);
                    setMediaPreview(URL.createObjectURL(file));
                };
                video.onerror = function() {
                    setError(t('createVibe.invalidFileError'));
                };
                video.src = URL.createObjectURL(file);
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
            const mediaUploadRef = storageRef(storage, `vibes/${currentUser.uid}/${Date.now()}-${mediaFile.name}`);
            await uploadBytes(mediaUploadRef, mediaFile);
            const downloadURL = await getDownloadURL(mediaUploadRef);

            await addDoc(collection(db, 'vibes'), {
                userId: currentUser.uid,
                videoUrl: downloadURL,
                caption,
                likes: [],
                commentsCount: 0,
                createdAt: serverTimestamp(),
            });

            onVibeCreated();
            onClose();

        } catch (err) {
            console.error("Error creating vibe:", err);
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
                className="bg-white dark:bg-black rounded-lg shadow-xl w-full max-w-4xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]"
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
                                <video src={mediaPreview} controls className="max-h-[60vh] max-w-full object-contain" />
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
                                {error && <p className="text-red-500 text-xs text-center mt-2">{error}</p>}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-16 h-64">
                            <VideoUploadIcon />
                            <h3 className="text-xl mt-4 mb-2">{t('createVibe.selectVideo')}</h3>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleMediaChange} 
                                style={{ opacity: 0, width: '0.1px', height: '0.1px', position: 'absolute', overflow: 'hidden', zIndex: -1 }} 
                                accept="video/*" 
                            />
                            <Button onClick={triggerFileInput}>
                                {t('createPost.selectFromComputer')}
                            </Button>
                            {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
};

export default CreateVibeModal;
