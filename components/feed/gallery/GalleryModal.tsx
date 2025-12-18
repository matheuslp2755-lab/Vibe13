
import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import Button from '../../common/Button';

interface GalleryImage {
    file: File;
    preview: string;
}

interface GalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImagesSelected: (images: GalleryImage[]) => void;
}

const GalleryModal: React.FC<GalleryModalProps> = ({ isOpen, onClose, onImagesSelected }) => {
    const { t } = useLanguage();
    const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
    const [selectedImages, setSelectedImages] = useState<GalleryImage[]>([]);
    const [activeTab, setActiveTab] = useState<'gallery' | 'camera'>('gallery');
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setGalleryImages([]);
            setSelectedImages([]);
            setActiveTab('gallery');
            setCameraError(null);
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                setCameraStream(null);
            }
        }
    }, [isOpen]);

    useEffect(() => {
        if (activeTab === 'camera' && isOpen) {
            const startCamera = async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ 
                        video: { facingMode: 'user' } 
                    });
                    setCameraStream(stream);
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (err) {
                    setCameraError(t('gallery.cameraError'));
                }
            };
            startCamera();
        } else {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                setCameraStream(null);
            }
        }
    }, [activeTab, isOpen]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files).slice(0, 20);
            const imagePromises = files
                .filter((file: File) => file.type.startsWith('image/') || file.type.startsWith('video/'))
                .map((file: File) => {
                    return new Promise<GalleryImage>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            resolve({ file, preview: event.target?.result as string });
                        };
                        reader.readAsDataURL(file);
                    });
                });

            Promise.all(imagePromises).then(images => {
                setGalleryImages(prev => [...images, ...prev]);
                if (images.length > 0 && selectedImages.length === 0) {
                    setSelectedImages([images[0]]);
                }
            });
        }
    };

    const toggleSelection = (image: GalleryImage) => {
        setSelectedImages(prev => {
            const isSelected = prev.some(img => img.preview === image.preview);
            if (isSelected) {
                return prev.filter(img => img.preview !== image.preview);
            } else if (prev.length < 20) {
                return [...prev, image];
            }
            return prev;
        });
    };

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0);
            const preview = canvas.toDataURL('image/jpeg');
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    const newImage = { file, preview };
                    setGalleryImages(prev => [newImage, ...prev]);
                    if (selectedImages.length < 20) setSelectedImages(prev => [...prev, newImage]);
                    setActiveTab('gallery');
                }
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-white dark:bg-black z-[60] flex flex-col">
            <header className="flex-shrink-0 flex items-center justify-between p-4 border-b dark:border-zinc-800">
                <button onClick={onClose}><XIcon className="w-6 h-6" /></button>
                <h2 className="text-lg font-semibold">{t('gallery.title')} ({selectedImages.length}/20)</h2>
                <Button onClick={() => onImagesSelected(selectedImages)} disabled={selectedImages.length === 0} className="!w-auto !py-1 !px-4 !text-sm">
                    {t('gallery.next')}
                </Button>
            </header>
            
            <div className="flex-grow flex flex-col overflow-hidden">
                {activeTab === 'gallery' ? (
                    <div className="w-full aspect-square bg-black flex items-center justify-center flex-shrink-0">
                        {selectedImages.length > 0 ? (
                            selectedImages[selectedImages.length - 1].file.type.startsWith('video/') ? (
                                <video src={selectedImages[selectedImages.length - 1].preview} controls className="max-h-full max-w-full" />
                            ) : (
                                <img src={selectedImages[selectedImages.length - 1].preview} className="max-h-full max-w-full object-contain" />
                            )
                        ) : <p className="text-zinc-500">Selecione até 20 fotos</p>}
                    </div>
                ) : (
                    <div className="relative flex-grow bg-black">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover mirrored" style={{ transform: 'scaleX(-1)' }} />
                        <button onClick={handleCapture} className="absolute bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full border-4 border-white flex items-center justify-center">
                            <div className="w-12 h-12 bg-white rounded-full"></div>
                        </button>
                    </div>
                )}

                <div className="flex justify-around border-b dark:border-zinc-800">
                    <button onClick={() => setActiveTab('gallery')} className={`w-full py-3 text-sm font-semibold ${activeTab === 'gallery' ? 'border-b-2 border-black dark:border-white' : 'text-zinc-500'}`}>{t('gallery.galleryTab')}</button>
                    <button onClick={() => setActiveTab('camera')} className={`w-full py-3 text-sm font-semibold ${activeTab === 'camera' ? 'border-b-2 border-black dark:border-white' : 'text-zinc-500'}`}>{t('gallery.cameraTab')}</button>
                </div>

                {activeTab === 'gallery' && (
                    <div className="flex-grow overflow-y-auto grid grid-cols-3 gap-0.5">
                        <div onClick={() => fileInputRef.current?.click()} className="aspect-square bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center cursor-pointer">
                            <PlusIcon className="w-8 h-8 text-zinc-400" />
                        </div>
                        {galleryImages.map((img, i) => {
                            const index = selectedImages.findIndex(s => s.preview === img.preview);
                            return (
                                <div key={i} onClick={() => toggleSelection(img)} className="relative aspect-square cursor-pointer">
                                    {img.file.type.startsWith('video/') ? <video src={img.preview} className="w-full h-full object-cover" /> : <img src={img.preview} className="w-full h-full object-cover" />}
                                    {index !== -1 && (
                                        <div className="absolute top-2 right-2 w-6 h-6 bg-sky-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white">
                                            {index + 1}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept="image/*,video/*" multiple />
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

const XIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
);
const PlusIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
);

export default GalleryModal;
