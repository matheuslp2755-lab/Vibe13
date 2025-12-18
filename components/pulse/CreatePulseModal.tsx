
import React, { useState, useRef, useEffect } from 'react';
import { auth, db, storage, addDoc, collection, serverTimestamp, storageRef, uploadString, getDownloadURL } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';

const FILTERS = [
    { name: 'Normal', filter: 'none' },
    { name: 'P&B', filter: 'grayscale(1)' },
    { name: 'Sépia', filter: 'sepia(1)' },
    { name: 'Vibrante', filter: 'saturate(2)' },
    { name: 'Invertido', filter: 'invert(1)' },
    { name: 'Frio', filter: 'hue-rotate(180deg)' }
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
    const [isSwiping, setIsSwiping] = useState(false);
    const startX = useRef(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) { setMediaFile(null); setMediaPreview(null); setFilterIndex(0); }
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
        if (mediaFile?.type.startsWith('video/')) return;
        startX.current = 'touches' in e ? e.touches[0].clientX : e.clientX;
        setIsSwiping(true);
    };

    const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isSwiping) return;
        const endX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
        const deltaX = endX - startX.current;
        if (Math.abs(deltaX) > 50) {
            setFilterIndex(prev => deltaX > 0 ? (prev === 0 ? FILTERS.length - 1 : prev - 1) : (prev === FILTERS.length - 1 ? 0 : prev + 1));
        }
        setIsSwiping(false);
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
        <div className="fixed inset-0 bg-black z-[70] flex flex-col">
            <header className="p-4 flex justify-between items-center z-10">
                <button onClick={onClose} className="text-white text-3xl">&times;</button>
                {mediaPreview && <Button onClick={handleSubmit} disabled={submitting} className="!w-auto">{t('createPulse.publish')}</Button>}
            </header>

            <div className="flex-grow flex items-center justify-center relative overflow-hidden" onMouseDown={handleTouchStart} onMouseUp={handleTouchEnd} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                {mediaPreview ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                        <div className="w-full h-full" style={{ filter: FILTERS[filterIndex].filter }}>
                            {mediaFile?.type.startsWith('video/') ? <video src={mediaPreview} autoPlay loop muted playsInline className="w-full h-full object-contain" /> : <img src={mediaPreview} className="w-full h-full object-contain" />}
                        </div>
                        {!mediaFile?.type.startsWith('video/') && (
                            <div className="absolute bottom-10 bg-black/40 text-white px-4 py-2 rounded-full backdrop-blur-md">
                                Filtro: {FILTERS[filterIndex].name}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center text-white cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <p>{t('createPulse.selectMedia')}</p>
                    </div>
                )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleMediaChange} style={{ display: 'none' }} accept="image/*,video/*" />
        </div>
    );
};

export default CreatePulseModal;
