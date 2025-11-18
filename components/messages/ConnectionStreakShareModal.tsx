import React, { useState, useEffect, useRef } from 'react';
import { auth, db, storage, addDoc, collection, serverTimestamp, storageRef, uploadString, getDownloadURL } from '../../firebase';
import Button from '../common/Button';
import { useLanguage } from '../../context/LanguageContext';

interface CrystalData {
    streak: number;
    level: 'BRILHANTE' | 'EQUILIBRADO' | 'APAGADO' | 'RACHADO';
}

interface UserInfo {
    uid?: string;
    photoURL?: string | null;
    id: string;
    username: string;
    avatar: string;
}

interface ConnectionStreakShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  crystalData: CrystalData;
  currentUser: any; // Firebase User type
  otherUser: UserInfo;
  onPulseCreated: () => void;
}

const Spinner: React.FC = () => (
    <div className="flex justify-center items-center p-4">
        <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

// Helper to load image safely dealing with potential CORS via Blob
const loadImageSafe = async (url: string): Promise<HTMLImageElement> => {
    try {
        const response = await fetch(url, { mode: 'cors' });
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        return new Promise((resolve, reject) => {
            img.onload = () => {
                resolve(img);
            };
            img.onerror = (e) => {
                console.error("Error loading image blob", e);
                const fallbackImg = new Image();
                fallbackImg.crossOrigin = "anonymous";
                fallbackImg.onload = () => resolve(fallbackImg);
                fallbackImg.onerror = reject;
                fallbackImg.src = url;
            };
            img.src = objectUrl;
        });
    } catch (e) {
        console.warn("Fetch failed, falling back to direct load", e);
        const img = new Image();
        img.crossOrigin = "anonymous";
        return new Promise((resolve, reject) => {
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }
};

const ConnectionStreakShareModal: React.FC<ConnectionStreakShareModalProps> = ({ isOpen, onClose, crystalData, currentUser, otherUser, onPulseCreated }) => {
    const { t } = useLanguage();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(true);
    const [isPublishing, setIsPublishing] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setGeneratedImage(null);
            setIsGenerating(true);
            setError('');
            return;
        }

        const generateCard = async () => {
            setIsGenerating(true);
            setError('');
            const canvas = canvasRef.current;
            if (!canvas) {
                setError(t('crystal.canvasError'));
                setIsGenerating(false);
                return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                setError(t('crystal.canvasError'));
                setIsGenerating(false);
                return;
            }

            const W = 1080;
            const H = 1920;
            canvas.width = W;
            canvas.height = H;

            try {
                // 1. Generate Background using Pollinations.ai (Alternative Platform)
                let bgImage: HTMLImageElement | null = null;
                try {
                    let promptDescription = "";
                    switch(crystalData.level) {
                        case 'BRILHANTE':
                            promptDescription = "mystical glowing bright blue and cyan crystal energy background, divine atmosphere, magical, 8k resolution, vertical wallpaper style, dark vignette";
                            break;
                        case 'EQUILIBRADO':
                            promptDescription = "calm and balanced blue and purple gradient background with sacred geometry, harmonic, smooth, vertical wallpaper style, 8k";
                            break;
                        case 'RACHADO':
                            promptDescription = "dark moody background with cracked glowing red lines, dramatic lighting, dark grey tones, vertical wallpaper style, 8k";
                            break;
                        default: // APAGADO
                            promptDescription = "mysterious grey and misty background, minimal light, foggy atmosphere, vertical wallpaper style";
                    }

                    // Using Pollinations.ai API
                    // We add a random seed to ensure uniqueness each time
                    const seed = Math.floor(Math.random() * 100000);
                    const encodedPrompt = encodeURIComponent(promptDescription);
                    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1920&nologo=true&model=flux&seed=${seed}`;

                    bgImage = await loadImageSafe(imageUrl);

                } catch (aiError) {
                    console.error("AI Generation failed, falling back to gradient", aiError);
                    // Fallback handled below if bgImage is null
                }

                // 2. Draw Background
                if (bgImage) {
                    ctx.drawImage(bgImage, 0, 0, W, H);
                    // Add a dark overlay to ensure text readability
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                    ctx.fillRect(0, 0, W, H);
                } else {
                    // Fallback Gradient
                    const bgGradient = ctx.createLinearGradient(0, 0, W, H);
                    bgGradient.addColorStop(0, '#0f172a'); 
                    bgGradient.addColorStop(1, '#1e293b'); 
                    ctx.fillStyle = bgGradient;
                    ctx.fillRect(0, 0, W, H);
                    
                    // Particles Fallback
                    for (let i = 0; i < 150; i++) {
                        ctx.fillStyle = `rgba(253, 224, 71, ${Math.random() * 0.5 + 0.2})`;
                        ctx.beginPath();
                        ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2.5 + 1, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                // 3. Load Avatars Safely
                const userImgUrl = `${currentUser.photoURL}?t=${new Date().getTime()}`;
                const otherUserImgUrl = `${otherUser.avatar}?t=${new Date().getTime()}`;
                
                const [userImg, otherUserImg] = await Promise.all([
                    loadImageSafe(userImgUrl),
                    loadImageSafe(otherUserImgUrl)
                ]);

                // 4. Draw Avatars & Connection Line
                const avatarSize = 320;
                const avatarY = 550;
                const userAvatarX = W / 2 - avatarSize - 30;
                const otherAvatarX = W / 2 + 30;

                // Lightning/Connection Bolt
                const boltY = avatarY + avatarSize / 2;
                const boltStartX = userAvatarX + avatarSize;
                const boltEndX = otherAvatarX;
                
                ctx.save();
                ctx.shadowColor = '#fef08a'; 
                ctx.shadowBlur = 30;
                ctx.strokeStyle = '#fde047'; 
                ctx.lineWidth = 15;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(boltStartX, boltY);
                ctx.lineTo(boltStartX + 60, boltY + 40);
                ctx.lineTo(boltStartX + 30, boltY);
                ctx.lineTo(boltStartX + 90, boltY - 40);
                ctx.lineTo(boltEndX, boltY);
                ctx.stroke();
                ctx.restore();
                
                // User Avatar
                ctx.save();
                ctx.shadowColor = 'rgba(250, 204, 21, 0.7)';
                ctx.shadowBlur = 40;
                ctx.beginPath();
                ctx.arc(userAvatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(250, 204, 21, 0.8)';
                ctx.lineWidth = 8;
                ctx.stroke();
                ctx.clip();
                ctx.drawImage(userImg, userAvatarX, avatarY, avatarSize, avatarSize);
                ctx.restore();

                // Other User Avatar
                ctx.save();
                ctx.shadowColor = 'rgba(250, 204, 21, 0.7)';
                ctx.shadowBlur = 40;
                ctx.beginPath();
                ctx.arc(otherAvatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(250, 204, 21, 0.8)';
                ctx.lineWidth = 8;
                ctx.stroke();
                ctx.clip();
                ctx.drawImage(otherUserImg, otherAvatarX, avatarY, avatarSize, avatarSize);
                ctx.restore();

                // 5. Text Overlay
                // Title
                ctx.font = '70px "Times New Roman", serif';
                ctx.fillStyle = '#f1f5f9'; 
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 10;
                ctx.fillText(t('crystal.shareTitle'), W / 2, 300);

                // Streak Number
                const streakNumber = crystalData.streak.toString();
                ctx.font = 'bold 400px "Helvetica Neue", sans-serif';
                
                // Gold gradient for text
                const textGradient = ctx.createLinearGradient(0, 1000, 0, 1400);
                textGradient.addColorStop(0, '#fcd34d'); 
                textGradient.addColorStop(1, '#fbbf24'); 
                ctx.fillStyle = textGradient;
                
                ctx.shadowColor = 'rgba(0,0,0,0.6)';
                ctx.shadowBlur = 20;
                ctx.shadowOffsetX = 8;
                ctx.shadowOffsetY = 8;
                ctx.fillText(streakNumber, W / 2, 1150);
                
                // Reset Shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                // Subtitle
                ctx.font = '60px "Helvetica Neue", sans-serif';
                ctx.fillStyle = '#e2e8f0'; 
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 4;
                ctx.fillText(t('crystal.streakDays', { streak: '' }).trim(), W / 2, 1350);

                // Watermark
                ctx.font = 'italic 40px "Times New Roman", serif';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.fillText('Vibe', W / 2, H - 100);

                setGeneratedImage(canvas.toDataURL('image/jpeg', 0.9));
                setIsGenerating(false);

            } catch (e) {
                console.error("Generation failed:", e);
                setError(t('crystal.imageLoadError'));
                setIsGenerating(false);
            }
        };
        
        generateCard();

    }, [isOpen, crystalData, currentUser, otherUser, t]);

    const handlePublish = async () => {
        if (!generatedImage || !currentUser) return;
        
        setIsPublishing(true);
        setError('');

        try {
            const pulseRef = storageRef(storage, `pulses/${currentUser.uid}/streak_${Date.now()}.jpg`);
            await uploadString(pulseRef, generatedImage, 'data_url');
            const downloadURL = await getDownloadURL(pulseRef);

            await addDoc(collection(db, 'pulses'), {
                authorId: currentUser.uid,
                mediaUrl: downloadURL,
                legenda: t('crystal.streakDays', { streak: crystalData.streak }),
                createdAt: serverTimestamp(),
            });

            onPulseCreated();
        } catch (err) {
            console.error(err);
            setError(t('crystal.shareError'));
        } finally {
            setIsPublishing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[60]" onClick={onClose}>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div className="bg-zinc-800 text-white rounded-lg shadow-xl w-full max-w-sm p-4 border border-zinc-700 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">{t('crystal.shareTitle')}</h3>
                    <button onClick={onClose} className="text-2xl">&times;</button>
                </div>
                
                <div className="aspect-[9/16] w-full bg-zinc-900 rounded-md flex items-center justify-center overflow-hidden relative">
                    {isGenerating && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-10">
                             <Spinner />
                             <p className="text-xs text-zinc-400 mt-2">Gerando imagem com IA...</p>
                        </div>
                    )}
                    {error && !isGenerating && <p className="text-red-400 text-center p-4">{error}</p>}
                    {generatedImage && (
                        <img src={generatedImage} alt="Connection streak preview" className="w-full h-full object-contain" />
                    )}
                </div>

                <Button onClick={handlePublish} disabled={isGenerating || isPublishing || !!error}>
                    {isPublishing ? t('crystal.publishing') : t('crystal.shareAction')}
                </Button>
            </div>
        </div>
    );
};

export default ConnectionStreakShareModal;