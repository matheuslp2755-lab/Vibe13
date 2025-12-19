
import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';
import TextInput from '../common/TextInput';

interface AIGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImageGenerated: (file: File, preview: string) => void;
}

const AIGeneratorModal: React.FC<AIGeneratorModalProps> = ({ isOpen, onClose, onImageGenerated }) => {
    const { t } = useLanguage();
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedPreview, setGeneratedPreview] = useState<string | null>(null);
    const [generatedFile, setGeneratedFile] = useState<File | null>(null);
    const [error, setError] = useState('');

    const handleGenerate = async () => {
        if (!prompt.trim() || isGenerating) return;

        setIsGenerating(true);
        setError('');
        setGeneratedPreview(null);
        setGeneratedFile(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: prompt }] },
                config: {
                    imageConfig: { 
                        aspectRatio: "1:1"
                    }
                }
            });

            let foundImage = false;
            // O retorno do Gemini 2.5 Flash Image vem como inlineData em uma das partes
            const parts = response.candidates?.[0]?.content?.parts || [];
            
            for (const part of parts) {
                if (part.inlineData) {
                    const base64Data = part.inlineData.data;
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    const imageUrl = `data:${mimeType};base64,${base64Data}`;
                    
                    // Converter para File para ser compatível com o fluxo de upload do app
                    const res = await fetch(imageUrl);
                    const blob = await res.blob();
                    const file = new File([blob], `ia-vibe-${Date.now()}.png`, { type: mimeType });

                    setGeneratedPreview(imageUrl);
                    setGeneratedFile(file);
                    foundImage = true;
                    break;
                }
            }

            if (!foundImage) {
                setError(t('aiGenerator.error'));
            }

        } catch (err: any) {
            console.error("Erro na geração IA:", err);
            setError(t('aiGenerator.error'));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConfirm = () => {
        if (generatedFile && generatedPreview) {
            onImageGenerated(generatedFile, generatedPreview);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-950 w-full max-w-xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                    <h2 className="text-xl font-black italic bg-gradient-to-r from-indigo-500 to-pink-500 text-transparent bg-clip-text">
                        {t('aiGenerator.title')}
                    </h2>
                    <button onClick={onClose} className="text-zinc-400 text-3xl font-light hover:text-zinc-600 transition-colors">&times;</button>
                </header>

                <div className="p-8 space-y-6">
                    <div className="relative aspect-square w-full rounded-3xl bg-zinc-100 dark:bg-zinc-900 border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-center overflow-hidden group">
                        {isGenerating ? (
                            <div className="flex flex-col items-center gap-4 text-center">
                                <div className="relative w-20 h-20">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-pink-500 rounded-full animate-ping opacity-20"></div>
                                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-pink-500 rounded-full animate-spin-slow"></div>
                                </div>
                                <p className="text-sm font-black text-zinc-500 animate-pulse">{t('aiGenerator.generating')}</p>
                            </div>
                        ) : generatedPreview ? (
                            <img src={generatedPreview} className="w-full h-full object-cover animate-fade-in" alt="Gerada por IA" />
                        ) : (
                            <div className="text-center p-10 opacity-30 group-hover:opacity-50 transition-opacity">
                                <svg className="w-20 h-20 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" strokeWidth={1.5}/></svg>
                                <p className="font-bold text-sm">Pronto para criar sua vibe?</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <TextInput 
                            id="ai-prompt"
                            label={t('aiGenerator.promptLabel')}
                            placeholder={t('aiGenerator.promptPlaceholder')}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            disabled={isGenerating}
                        />

                        <div className="flex gap-3 pt-2">
                            <Button 
                                onClick={handleGenerate} 
                                disabled={isGenerating || !prompt.trim()}
                                className={`!py-4 !rounded-2xl !font-black !text-xs !uppercase !tracking-widest transition-all ${isGenerating ? 'opacity-50' : 'bg-gradient-to-r from-indigo-600 to-pink-600 shadow-lg shadow-indigo-500/20 active:scale-95'}`}
                            >
                                {isGenerating ? t('aiGenerator.generating') : t('aiGenerator.generate')}
                            </Button>
                            
                            {generatedPreview && !isGenerating && (
                                <Button 
                                    onClick={handleConfirm}
                                    className="!bg-zinc-100 dark:!bg-zinc-800 !text-zinc-900 dark:!text-white !py-4 !rounded-2xl !font-black !text-xs !uppercase !tracking-widest active:scale-95"
                                >
                                    {t('aiGenerator.useImage')}
                                </Button>
                            )}
                        </div>
                        {error && <p className="text-red-500 text-[10px] font-black text-center uppercase tracking-widest animate-shake">{error}</p>}
                    </div>
                </div>
            </div>
            <style>{`
                .animate-spin-slow { animation: spin 4s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
                .animate-shake { animation: shake 0.3s ease-in-out; }
            `}</style>
        </div>
    );
};

export default AIGeneratorModal;
