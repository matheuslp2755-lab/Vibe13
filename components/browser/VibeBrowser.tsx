
import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';

interface VibeBrowserProps {
    onClose: () => void;
}

const VibeBrowser: React.FC<VibeBrowserProps> = ({ onClose }) => {
    const { t } = useLanguage();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [resultText, setResultText] = useState('');
    const [sources, setSources] = useState<any[]>([]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setResultText('');
        setSources([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: query,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });

            setResultText(response.text || "Nenhuma resposta clara encontrada. Tente reformular a pergunta.");
            
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks) {
                const urls = groundingChunks
                    .filter((chunk: any) => chunk.web)
                    .map((chunk: any) => ({
                        uri: chunk.web.uri,
                        title: chunk.web.title || chunk.web.uri
                    }));
                setSources(urls);
            }
        } catch (err) {
            console.error(err);
            setResultText("Ops! Ocorreu um erro ao navegar na rede. Verifique sua conexão.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-white dark:bg-black z-[100] flex flex-col animate-fade-in overflow-hidden">
            {/* Header do Navegador Estilo Safari/Moderno */}
            <header className="flex items-center gap-4 p-4 border-b dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                <button 
                    onClick={onClose}
                    className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-all active:scale-90"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M15 19l-7-7 7-7"/></svg>
                </button>
                
                <form onSubmit={handleSearch} className="flex-grow flex items-center bg-white dark:bg-zinc-900 rounded-2xl px-4 py-2.5 border dark:border-zinc-700 shadow-inner group focus-within:ring-2 ring-sky-500/20">
                    <svg className="w-4 h-4 text-zinc-400 mr-3 group-focus-within:text-sky-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input 
                        autoFocus
                        type="text" 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('browser.placeholder')}
                        className="w-full bg-transparent outline-none text-sm font-bold placeholder:text-zinc-500"
                    />
                    {loading && (
                        <div className="w-4 h-4 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin"></div>
                    )}
                </form>

                <div className="hidden sm:block">
                    <h2 className="text-xl font-black italic bg-gradient-to-r from-sky-500 to-indigo-500 text-transparent bg-clip-text">Explorer</h2>
                </div>
            </header>

            {/* Área de Conteúdo Livre */}
            <main className="flex-grow overflow-y-auto no-scrollbar bg-white dark:bg-black p-6">
                <div className="max-w-3xl mx-auto">
                    {!resultText && !loading && (
                        <div className="py-24 text-center flex flex-col items-center opacity-40 select-none">
                            <div className="w-24 h-24 mb-6 rounded-[2rem] bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
                            </div>
                            <h3 className="text-2xl font-black tracking-tight">{t('browser.empty')}</h3>
                            <p className="text-sm mt-2 font-medium">Sua busca livre começa aqui</p>
                        </div>
                    )}

                    {loading && (
                        <div className="space-y-6 animate-pulse">
                            <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full w-3/4" />
                            <div className="space-y-2">
                                <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full w-full" />
                                <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full w-full" />
                                <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full w-5/6" />
                            </div>
                        </div>
                    )}

                    {resultText && (
                        <div className="animate-fade-in pb-10">
                            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm mb-10">
                                <div className="prose prose-zinc dark:prose-invert max-w-none text-base md:text-lg leading-relaxed font-medium whitespace-pre-wrap">
                                    {resultText}
                                </div>
                            </div>
                            
                            {sources.length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-6 flex items-center gap-4">
                                        {t('browser.sources')}
                                        <div className="h-px flex-grow bg-zinc-100 dark:bg-zinc-800" />
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {sources.map((src, i) => (
                                            <a 
                                                key={i} 
                                                href={src.uri} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="group flex items-center justify-between p-4 bg-white dark:bg-zinc-900 hover:bg-sky-50 dark:hover:bg-sky-900/10 rounded-2xl transition-all border border-zinc-100 dark:border-zinc-800 shadow-sm active:scale-95"
                                            >
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="text-xs font-black text-sky-500 group-hover:underline truncate mb-1">{src.title}</span>
                                                    <span className="text-[10px] text-zinc-400 truncate uppercase tracking-widest">{new URL(src.uri).hostname}</span>
                                                </div>
                                                <svg className="w-4 h-4 text-zinc-300 group-hover:text-sky-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
            
            {/* Barra de Ações Inferior Estilo Browser */}
            <div className="bg-zinc-50 dark:bg-zinc-950 border-t dark:border-zinc-800 p-4 flex justify-around items-center text-zinc-400">
                <button className="p-2 hover:text-sky-500 transition-colors"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/></svg></button>
                <button className="p-2 hover:text-sky-500 transition-colors"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/></svg></button>
                <button className="p-3 bg-white dark:bg-zinc-900 rounded-full shadow-lg text-zinc-800 dark:text-white border dark:border-zinc-800 active:scale-90 transition-all"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></button>
                <button className="p-2 hover:text-sky-500 transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg></button>
            </div>
        </div>
    );
};

export default VibeBrowser;
