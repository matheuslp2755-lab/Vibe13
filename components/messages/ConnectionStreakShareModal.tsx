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

// Helper to safely load image or return null if failed (prevents Promise.all rejection)
const loadImageSafe = async (url: string): Promise<HTMLImageElement | null> => {
    if (!url) return null;
    try {
        // Tenta fazer fetch com modo cors para obter Blob e evitar Tainted Canvas
        const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        return new Promise((resolve) => {
            img.onload = () => resolve(img);
            img.onerror = (e) => {
                console.warn("Error loading image blob from URL:", url, e);
                resolve(null); // Resolve with null instead of reject
            };
            img.src = objectUrl;
        });
    } catch (e) {
        console.warn("Fetch failed, falling back to direct load for:", url, e);
        // Fallback: tenta carregar direto. Se falhar, resolve com null.
        // Nota: Direct load pode causar tainted canvas se o servidor não enviar headers CORS corretos.
        const img = new Image();
        img.crossOrigin = "anonymous"; 
        return new Promise((resolve) => {
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.error("Final fallback failed for image:", url);
                resolve(null);
            };
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

            // Tamanho do Story/Pulse (9:16)
            const W = 1080;
            const H = 1920;
            canvas.width = W;
            canvas.height = H;

            try {
                // 1. Fundo de Neve (Snow Background) desenhado manualmente
                const bgGradient = ctx.createLinearGradient(0, 0, 0, H);
                bgGradient.addColorStop(0, '#020617'); // Slate 950 (Céu noturno escuro)
                bgGradient.addColorStop(0.5, '#1e3a8a'); // Blue 900 (Azul profundo)
                bgGradient.addColorStop(1, '#3b82f6'); // Blue 500 (Gelo na base)
                ctx.fillStyle = bgGradient;
                ctx.fillRect(0, 0, W, H);

                // Desenhando flocos de neve (Snowflakes)
                const snowflakeCount = 400;
                for (let i = 0; i < snowflakeCount; i++) {
                    const x = Math.random() * W;
                    const y = Math.random() * H;
                    const radius = Math.random() * 4 + 1;
                    const alpha = Math.random() * 0.6 + 0.1;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                    ctx.fill();
                }

                // Adiciona uma vinheta escura para focar no centro
                const vignette = ctx.createRadialGradient(W / 2, H / 2, W / 3, W / 2, H / 2, H);
                vignette.addColorStop(0, 'rgba(0,0,0,0)');
                vignette.addColorStop(1, 'rgba(0,0,0,0.6)');
                ctx.fillStyle = vignette;
                ctx.fillRect(0, 0, W, H);

                // 2. Carregar Avatares com URL Segura
                const getSafeUrl = (url: string) => {
                    if (!url) return '';
                    // Firebase storage URLs already have params, so use '&'
                    const separator = url.includes('?') ? '&' : '?';
                    return `${url}${separator}t=${new Date().getTime()}`;
                };

                const userImgUrl = getSafeUrl(currentUser.photoURL);
                const otherUserImgUrl = getSafeUrl(otherUser.avatar);
                
                const [userImg, otherUserImg] = await Promise.all([
                    loadImageSafe(userImgUrl),
                    loadImageSafe(otherUserImgUrl)
                ]);

                // 3. Desenhar Avatares e Conexão
                const avatarSize = 300; // Diâmetro
                const avatarY = 600;
                
                // Recalculando para centralizar o par de avatares exatamente
                const spacing = 60;
                const totalWidth = (avatarSize * 2) + spacing;
                const startX = (W - totalWidth) / 2;
                
                const userAvatarX = startX;
                const otherAvatarX = startX + avatarSize + spacing;

                // Linha de conexão (Raio/Energia) atrás dos avatares
                ctx.save();
                ctx.shadowColor = '#fef08a'; // Amarelo brilho
                ctx.shadowBlur = 40;
                ctx.strokeStyle = '#fde047'; // Amarelo
                ctx.lineWidth = 10;
                ctx.lineCap = 'round';
                
                const lineY = avatarY + (avatarSize / 2);
                const lineStartX = userAvatarX + avatarSize - 20;
                const lineEndX = otherAvatarX + 20;

                ctx.beginPath();
                ctx.moveTo(lineStartX, lineY);
                // Zig-zag simples
                ctx.lineTo(lineStartX + (lineEndX - lineStartX) * 0.3, lineY - 30);
                ctx.lineTo(lineStartX + (lineEndX - lineStartX) * 0.6, lineY + 30);
                ctx.lineTo(lineEndX, lineY);
                ctx.stroke();
                ctx.restore();

                // Função auxiliar para desenhar avatar circular com borda ou fallback
                const drawAvatar = (img: HTMLImageElement | null, x: number, y: number, size: number, name: string) => {
                    ctx.save();
                    
                    // Sombra do avatar
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                    ctx.shadowBlur = 20;
                    ctx.shadowOffsetY = 10;

                    // Cria o caminho circular
                    ctx.beginPath();
                    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 12;
                    ctx.stroke();
                    ctx.clip(); // Tudo desenhado depois daqui fica dentro do circulo

                    if (img) {
                        ctx.drawImage(img, x, y, size, size);
                    } else {
                        // Fallback se a imagem não carregar: Círculo com inicial
                        ctx.fillStyle = '#64748b'; // Slate 500
                        ctx.fillRect(x, y, size, size);
                        
                        ctx.font = 'bold 150px sans-serif';
                        ctx.fillStyle = 'white';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        // Reseta shadows para o texto interno
                        ctx.shadowColor = 'transparent';
                        ctx.fillText(name.charAt(0).toUpperCase(), x + size / 2, y + size / 2);
                    }
                    ctx.restore();
                };

                drawAvatar(userImg, userAvatarX, avatarY, avatarSize, currentUser.displayName || '?');
                drawAvatar(otherUserImg, otherAvatarX, avatarY, avatarSize, otherUser.username || '?');

                // 4. Textos
                // Título
                ctx.font = 'bold 80px "Helvetica Neue", sans-serif';
                ctx.fillStyle = '#f8fafc'; 
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 15;
                ctx.fillText(t('crystal.shareTitle'), W / 2, 300);

                // Número do Streak
                const streakNumber = crystalData.streak.toString();
                ctx.font = 'bold 500px "Helvetica Neue", sans-serif';
                
                // Gradiente no texto
                const textGradient = ctx.createLinearGradient(0, 1000, 0, 1500);
                textGradient.addColorStop(0, '#ffffff'); 
                textGradient.addColorStop(1, '#bae6fd'); // Azul claro gelo
                ctx.fillStyle = textGradient;
                
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 30;
                ctx.shadowOffsetY = 10;
                
                // Desenhando o número bem grande embaixo dos avatares
                ctx.fillText(streakNumber, W / 2, 1200);

                // Subtítulo "dias de conexão"
                ctx.font = 'bold 60px "Helvetica Neue", sans-serif';
                ctx.fillStyle = '#e0f2fe'; 
                ctx.shadowBlur = 5;
                ctx.fillText(t('crystal.streakDays', { streak: '' }).replace(/[0-9]/g, '').trim(), W / 2, 1450);

                // Marca d'água
                ctx.font = 'italic 40px serif';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.fillText('Vibe', W / 2, H - 100);

                // Finaliza
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
                             <p className="text-xs text-zinc-400 mt-2">Criando imagem...</p>
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