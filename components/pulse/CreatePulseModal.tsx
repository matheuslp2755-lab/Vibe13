
import React, { useState, useRef, useEffect } from 'react';
import { auth, db, storage, addDoc, collection, serverTimestamp, storageRef, uploadString, getDownloadURL } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';

const FILTERS = [
    { name: 'Normal', filter: 'none' },
    { name: 'Clarendon', filter: 'contrast(1.2) saturate(1.35)' },
    { name: 'Gingham', filter: 'sepia(0.2) contrast(0.9) brightness(1.1)' },
    { name: 'Moon', filter: 'grayscale(1) contrast(1.1) brightness(1.1)' },
    { name: 'Lark', filter: 'saturate(1.2) brightness(1.05)' },
    { name: 'Reyes', filter: 'sepia(0.22) brightness(1.1) contrast(0.85) saturate(0.75)' },
    { name: 'Juno', filter: 'saturate(1.4) contrast(1.1) hue-rotate(-10deg)' },
    { name: 'P&B', filter: 'grayscale(1)' },
    { name: 'Sépia', filter: 'sepia(1)' },
    { name: 'Vibrante', filter: 'saturate(2)' }
];

interface CreatePulseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPulseCreated: () => void;
}

const CreatePulseModal: React.FC<CreatePulseModalProps> = ({ isOpen, onClose, onPulseCreated }) => {
    const { t } = useLanguage();
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [filterIndex, setFilterIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [swipeStart, setSwipeStart] = useState<number | null>(null);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) { setMediaFile(null); setMediaPreview(null); setFilterIndex(0); setSwipeOffset(0); }
    }, [isOpen]);

    const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setMediaFile(file);
            const reader = new FileReader();
            reader.onload = (ev) => setMediaPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        setSwipeStart(x);
    };

    const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (swipeStart === null) return;
        const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        setSwipeOffset(x - swipeStart);
    };

    const handleTouchEnd = () => {
        if (swipeStart === null) return;
        if (Math.abs(swipeOffset) > 80) {
            if (swipeOffset > 0) {
                setFilterIndex(prev => (prev === 0 ? FILTERS.length - 1 : prev - 1));
            } else {
                setFilterIndex(prev => (prev === FILTERS.length - 1 ? 0 : prev + 1));
            }
        }
        setSwipeStart(null);
        setSwipeOffset(0);
    };

    const handleSubmit = async () => {
        if (!mediaPreview || submitting) return;
        setSubmitting(true);
        try {
            const ref = storageRef(storage, `pulses/${auth.currentUser?.uid}/${Date.now()}.jpg`);
            await uploadString(ref, mediaPreview, 'data_url');
            const url = await getDownloadURL(ref);
            await addDoc(collection(db, 'pulses'), {
                authorId: auth.currentUser?.uid,
                mediaUrl: url,
                filter: FILTERS[filterIndex].filter,
                createdAt: serverTimestamp(),
            });
            onPulseCreated();
            onClose();
        } catch (e) { console.error(e); }
        setSubmitting(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black z-[70] flex flex-col select-none">
            <header className="p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
                <button onClick={onClose} className="text-white text-3xl font-light">&times;</button>
                {mediaPreview && (
                    <div className="flex items-center gap-4">
                        <span className="text-white text-sm font-semibold bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
                            {FILTERS[filterIndex].name}
                        </span>
                        <Button onClick={handleSubmit} disabled={submitting} className="!w-auto !py-1 !px-6">
                            {submitting ? '...' : 'Compartilhar'}
                        </Button>
                    </div>
                )}
            </header>

            <div 
                className="flex-grow flex items-center justify-center relative overflow-hidden" 
                onMouseDown={handleTouchStart} 
                onMouseMove={handleTouchMove}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                onTouchStart={handleTouchStart} 
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {mediaPreview ? (
                    <div className="w-full h-full flex flex-col items-center justify-center relative">
                        <div 
                            className="w-full h-full transition-all duration-300" 
                            style={{ 
                                filter: FILTERS[filterIndex].filter,
                                transform: `translateX(${swipeOffset * 0.5}px)`
                            }}
                        >
                            {mediaFile?.type.startsWith('video/') ? (
                                <video src={mediaPreview} autoPlay loop muted playsInline className="w-full h-full object-contain" />
                            ) : (
                                <img src={mediaPreview} className="w-full h-full object-contain" />
                            )}
                        </div>
                        
                        {/* Swipe Indicators */}
                        <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/20 to-transparent flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </div>
                        <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black/20 to-transparent flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-white cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-dashed border-white/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <p className="font-semibold text-lg">Selecione uma foto ou vídeo</p>
                        <p className="text-white/60 text-sm mt-2">Arraste para os lados para aplicar filtros nas fotos</p>
                    </div>
                )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleMediaChange} style={{ opacity: 0, width: '0.1px', height: '0.1px', position: 'absolute', overflow: 'hidden', zIndex: -1 }} accept="image/*,video/*" />
        </div>
    );
};

export default CreatePulseModal;
