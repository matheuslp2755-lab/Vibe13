
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';

interface MusicTrack {
  id: string;
  name: string;
  artist_name: string;
  image: string;
  audio: string;
  duration: number;
}

interface VibeMusicAppProps {
  isOpen: boolean;
  onClose: () => void;
}

const VibeMusicApp: React.FC<VibeMusicAppProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<MusicTrack[]>([]);
    const [trending, setTrending] = useState<MusicTrack[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
    const [queue, setQueue] = useState<MusicTrack[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
    
    const audioRef = useRef<HTMLAudioElement>(null);

    // Proxy mais estável e direto (não encapsula em objeto contents)
    const PROXY_URL = "https://corsproxy.io/?";
    const DEEZER_SEARCH = "https://api.deezer.com/search?q=";
    const DEEZER_CHART = "https://api.deezer.com/chart";

    useEffect(() => {
        if (isOpen && trending.length === 0) {
            fetchTrending();
        }
    }, [isOpen]);

    const fetchTrending = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${PROXY_URL}${encodeURIComponent(DEEZER_CHART)}`);
            if (!res.ok) throw new Error("Falha na rede");
            const data = await res.json();
            
            if (data.tracks && data.tracks.data) {
                const mapped = data.tracks.data.map((track: any) => ({
                    id: track.id.toString(),
                    name: track.title,
                    artist_name: track.artist.name,
                    image: track.album.cover_medium || track.album.cover_big,
                    audio: track.preview,
                    duration: 30
                }));
                setTrending(mapped);
                if (!currentTrack) setQueue(mapped);
            }
        } catch (e: any) {
            console.error("Deezer Load Error:", e);
            setError("Não foi possível carregar as paradas de sucesso. Verifique sua conexão.");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const term = searchQuery.trim();
        if (!term) return;
        
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${PROXY_URL}${encodeURIComponent(DEEZER_SEARCH + term)}`);
            if (!res.ok) throw new Error("Erro na busca");
            const data = await res.json();
            
            if (data.data && data.data.length > 0) {
                const mapped = data.data.map((track: any) => ({
                    id: track.id.toString(),
                    name: track.title,
                    artist_name: track.artist.name,
                    image: track.album.cover_medium || track.album.cover_big,
                    audio: track.preview,
                    duration: 30
                }));
                setResults(mapped);
                setQueue(mapped);
            } else {
                setResults([]);
                setError(`Nenhum resultado para "${term}".`);
            }
        } catch (e: any) {
            console.error("Deezer Search Error:", e);
            setError("Erro ao pesquisar. Tente novamente mais tarde.");
        } finally {
            setLoading(false);
        }
    };

    const playTrack = (track: MusicTrack, index: number, fromList: MusicTrack[]) => {
        setQueue(fromList);
        setCurrentIndex(index);
        setCurrentTrack(track);
        setIsPlaying(true);
        setCurrentTime(0);
        setDuration(30);
        
        if (audioRef.current) {
            audioRef.current.src = track.audio;
            audioRef.current.play().catch(e => console.error("Play error:", e));
        }
    };

    const togglePlay = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().catch(e => console.error(e));
            setIsPlaying(true);
        }
    };

    const handleNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (queue.length > 0) {
            const nextIdx = (currentIndex + 1) % queue.length;
            playTrack(queue[nextIdx], nextIdx, queue);
        }
    };

    const handlePrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (audioRef.current && audioRef.current.currentTime > 3) {
            audioRef.current.currentTime = 0;
            return;
        }
        if (queue.length > 0) {
            const prevIdx = currentIndex === 0 ? queue.length - 1 : currentIndex - 1;
            playTrack(queue[prevIdx], prevIdx, queue);
        }
    };

    const toggleLike = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newLikes = new Set(likedIds);
        if (newLikes.has(id)) newLikes.delete(id);
        else newLikes.add(id);
        setLikedIds(newLikes);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const formatTime = (time: number) => {
        const seconds = Math.floor(time % 60);
        return `0:${seconds.toString().padStart(2, '0')}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col md:p-6 animate-fade-in overflow-hidden">
            <div className="flex-grow flex flex-col bg-zinc-950 md:rounded-[3rem] border border-white/5 overflow-hidden relative shadow-2xl">
                
                <div className={`flex flex-col h-full transition-all duration-500 ${isFullScreen ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}>
                    <header className="p-6 flex items-center gap-4 bg-black/40 backdrop-blur-3xl sticky top-0 z-20">
                        <button onClick={onClose} className="p-3 bg-zinc-900 rounded-full text-white hover:bg-zinc-800 transition-all active:scale-90">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M15 19l-7-7 7-7"/></svg>
                        </button>
                        
                        <div className="flex-grow flex flex-col">
                            <h2 className="text-sky-500 font-black text-xs uppercase tracking-[0.3em] mb-1">Vibe Music • Deezer</h2>
                            <form onSubmit={handleSearch} className="flex items-center bg-zinc-900 rounded-2xl px-5 py-3 border border-white/5 focus-within:border-sky-500/50 transition-all group">
                                <svg className="w-5 h-5 text-zinc-500 mr-3 group-focus-within:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                                <input 
                                    type="text" 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Taylor Swift, Drake, Anitta, Lo-fi..."
                                    className="bg-transparent outline-none w-full text-white font-bold text-sm"
                                />
                            </form>
                        </div>
                    </header>

                    <main className="flex-grow overflow-y-auto p-6 space-y-10 no-scrollbar pb-32">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin"></div>
                                <p className="text-zinc-500 font-black text-[10px] uppercase tracking-widest animate-pulse">Sintonizando hits...</p>
                            </div>
                        ) : error ? (
                            <div className="text-center py-20 px-10">
                                <p className="text-zinc-400 font-medium mb-6 text-sm">{error}</p>
                                <button onClick={fetchTrending} className="px-6 py-3 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-widest rounded-full hover:bg-zinc-800 transition-colors">Tentar novamente</button>
                            </div>
                        ) : (
                            <>
                                {results.length > 0 && (
                                    <div className="animate-fade-in">
                                        <h3 className="text-white font-black text-2xl mb-6 px-2 tracking-tighter flex items-center justify-between">Resultados</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {results.map((track, idx) => (
                                                <div 
                                                    key={track.id} 
                                                    onClick={() => playTrack(track, idx, results)}
                                                    className={`flex items-center gap-4 p-3 rounded-2xl transition-all border border-transparent hover:border-white/10 group cursor-pointer ${currentTrack?.id === track.id ? 'bg-sky-500/10 border-sky-500/20 shadow-lg' : 'bg-white/5'}`}
                                                >
                                                    <div className="relative w-16 h-16 shrink-0">
                                                        <img src={track.image} className="w-full h-full rounded-xl shadow-2xl object-cover" />
                                                        {currentTrack?.id === track.id && isPlaying && (
                                                            <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                                                                <div className="flex gap-1 items-end h-4">
                                                                    <div className="w-1 bg-sky-500 animate-music-bar-1" />
                                                                    <div className="w-1 bg-sky-500 animate-music-bar-2" />
                                                                    <div className="w-1 bg-sky-500 animate-music-bar-3" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="overflow-hidden flex-grow">
                                                        <p className={`font-black text-sm truncate ${currentTrack?.id === track.id ? 'text-sky-400' : 'text-white'}`}>{track.name}</p>
                                                        <p className="text-zinc-500 text-[10px] font-bold truncate mt-1 uppercase tracking-widest">{track.artist_name}</p>
                                                    </div>
                                                    <button onClick={(e) => toggleLike(e, track.id)} className={`p-2 transition-all ${likedIds.has(track.id) ? 'text-red-500 scale-110' : 'text-zinc-700 hover:text-white'}`}>
                                                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {results.length === 0 && (
                                    <div className="animate-slide-up">
                                        <h3 className="text-white font-black text-3xl mb-8 px-2 tracking-tight">Bombando no Mundo</h3>
                                        <div className="flex gap-6 overflow-x-auto no-scrollbar pb-4">
                                            {trending.map((track, idx) => (
                                                <div 
                                                    key={track.id} 
                                                    onClick={() => playTrack(track, idx, trending)}
                                                    className="flex-shrink-0 w-44 group cursor-pointer"
                                                >
                                                    <div className="relative aspect-square mb-4">
                                                        <img src={track.image} className="w-full h-full rounded-[2.5rem] object-cover shadow-[0_20px_50px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-all duration-500" />
                                                        <div className={`absolute inset-0 bg-black/40 rounded-[2.5rem] flex items-center justify-center transition-opacity ${currentTrack?.id === track.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black shadow-2xl active:scale-90 transition-transform">
                                                                {currentTrack?.id === track.id && isPlaying ? (
                                                                    <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                                                ) : (
                                                                    <svg className="w-6 h-6 ml-1 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p className="text-white font-black text-sm truncate">{track.name}</p>
                                                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-wider truncate">{track.artist_name}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </main>
                </div>

                {currentTrack && !isFullScreen && (
                    <div 
                        onClick={() => setIsFullScreen(true)}
                        className="absolute bottom-4 left-4 right-4 p-3 bg-zinc-900/95 backdrop-blur-3xl border border-white/10 rounded-2xl animate-slide-up cursor-pointer z-30 shadow-2xl group active:scale-[0.98] transition-all"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <img src={currentTrack.image} className={`w-12 h-12 rounded-xl shadow-lg object-cover transition-all ${isPlaying ? 'scale-105 rotate-3' : ''}`} />
                                <div className="overflow-hidden">
                                    <p className="text-white font-black text-xs truncate group-hover:text-sky-400 transition-colors">{currentTrack.name}</p>
                                    <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest truncate">{currentTrack.artist_name}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button onClick={togglePlay} className="p-3 bg-white rounded-full text-black active:scale-90 transition-all shadow-lg">
                                    {isPlaying ? (
                                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                    ) : (
                                        <svg className="w-5 h-5 ml-0.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5 overflow-hidden rounded-b-2xl">
                            <div className="h-full bg-sky-50 shadow-[0_0_8px_#0ea5e9] transition-all duration-300" style={{ width: `${(currentTime / 30) * 100}%` }} />
                        </div>
                    </div>
                )}

                {isFullScreen && currentTrack && (
                    <div className="absolute inset-0 z-50 flex flex-col bg-zinc-950 animate-slide-up">
                        <div className="absolute inset-0 opacity-50 pointer-events-none">
                            <img src={currentTrack.image} className="w-full h-full object-cover blur-[120px] scale-150" />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black" />
                        </div>

                        <header className="relative p-8 flex justify-between items-center z-10">
                            <button onClick={() => setIsFullScreen(false)} className="p-2 text-white/60 hover:text-white transition-colors active:scale-90">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M19 9l-7 7-7-7"/></svg>
                            </button>
                            <div className="text-center overflow-hidden max-w-[60%]">
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-1">Vibe Player • Preview</p>
                                <p className="text-xs font-black text-white truncate">{currentTrack.name}</p>
                            </div>
                            <button className="p-2 text-white/60 hover:text-white"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg></button>
                        </header>

                        <main className="relative flex-grow flex flex-col items-center justify-center p-8 z-10">
                            <div className="w-full max-w-sm aspect-square mb-12 relative">
                                <img 
                                    src={currentTrack.image} 
                                    className={`w-full h-full rounded-[4rem] object-cover shadow-[0_60px_120px_rgba(0,0,0,0.9)] transition-all duration-1000 ${isPlaying ? 'scale-100' : 'scale-90 opacity-60 blur-sm'}`} 
                                />
                            </div>

                            <div className="w-full max-w-sm flex items-end justify-between mb-8">
                                <div className="text-left overflow-hidden">
                                    <h2 className="text-3xl font-black text-white tracking-tighter mb-2 animate-slide-up truncate">{currentTrack.name}</h2>
                                    <p className="text-lg font-bold text-sky-400 tracking-tight opacity-90 truncate">{currentTrack.artist_name}</p>
                                </div>
                                <button onClick={(e) => toggleLike(e, currentTrack.id)} className={`p-4 transition-transform active:scale-150 ${likedIds.has(currentTrack.id) ? 'text-red-500' : 'text-white/20'}`}>
                                    <svg className="w-9 h-9 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                                </button>
                            </div>

                            <div className="w-full max-w-sm mb-12">
                                <input 
                                    type="range" min="0" max="30" step="0.1" value={currentTime}
                                    onChange={handleSeek}
                                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white hover:accent-sky-500 transition-all"
                                />
                                <div className="flex justify-between mt-4 text-[11px] font-black text-white/40 tracking-widest font-mono">
                                    <span>{formatTime(currentTime)}</span>
                                    <span>0:30</span>
                                </div>
                            </div>

                            <div className="w-full max-w-sm flex items-center justify-center gap-12">
                                <button onClick={handlePrev} className="p-4 text-white hover:scale-110 active:scale-95 transition-all">
                                    <svg className="w-10 h-10 fill-current" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6L21 6v12z" transform="rotate(180 13.5 12)"/></svg>
                                </button>
                                <button 
                                    onClick={() => togglePlay()}
                                    className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-black shadow-2xl hover:scale-105 active:scale-90 transition-all"
                                >
                                    {isPlaying ? (
                                        <svg className="w-12 h-12 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                    ) : (
                                        <svg className="w-12 h-12 ml-2" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                    )}
                                </button>
                                <button onClick={handleNext} className="p-4 text-white hover:scale-110 active:scale-95 transition-all">
                                    <svg className="w-10 h-10 fill-current" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6L21 6v12z"/></svg>
                                </button>
                            </div>
                        </main>
                    </div>
                )}

                <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={handleNext} />
            </div>

            <style>{`
                input[type='range']::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 14px;
                    height: 14px;
                    background: white;
                    border-radius: 50%;
                    box-shadow: 0 0 15px rgba(0,0,0,0.5);
                    transition: all 0.2s;
                }
                input[type='range']:hover::-webkit-slider-thumb {
                    transform: scale(1.4);
                    background: #0ea5e9;
                }
                @keyframes music-bar { 0%, 100% { height: 4px; } 50% { height: 16px; } }
                .animate-music-bar-1 { animation: music-bar 0.6s infinite ease-in-out; }
                .animate-music-bar-2 { animation: music-bar 0.8s infinite ease-in-out; animation-delay: 0.1s; }
                .animate-music-bar-3 { animation: music-bar 0.7s infinite ease-in-out; animation-delay: 0.2s; }
                @keyframes slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
};

export default VibeMusicApp;
