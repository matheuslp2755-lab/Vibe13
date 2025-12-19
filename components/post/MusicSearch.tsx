
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';
import MusicTrimmer from './MusicTrimmer';

type MusicInfo = {
  nome: string;
  artista: string;
  capa: string;
  preview: string;
  startTime?: number;
};

interface MusicSearchProps {
  onSelectMusic: (track: MusicInfo) => void;
  onBack: () => void;
}

const Spinner: React.FC = () => (
    <div className="flex justify-center items-center p-10">
        <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-sky-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    </div>
);

const BackArrowIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"></path></svg>
);

const MusicSearch: React.FC<MusicSearchProps> = ({ onSelectMusic, onBack }) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trimmingTrack, setTrimmingTrack] = useState<any | null>(null);

  const PROXY_URL = "https://corsproxy.io/?";
  const DEEZER_SEARCH = "https://api.deezer.com/search?q=";
  const DEEZER_CHART = "https://api.deezer.com/chart";

  useEffect(() => {
    const fetchSuggestions = async () => {
        try {
            const res = await fetch(`${PROXY_URL}${encodeURIComponent(DEEZER_CHART)}`);
            if (!res.ok) throw new Error("Chart fetch failed");
            const data = await res.json();
            if (data.tracks) {
                setSuggestions(data.tracks.data.map((t: any) => ({
                    id: t.id.toString(),
                    name: t.title,
                    artist_name: t.artist.name,
                    image: t.album.cover_medium,
                    audio: t.preview,
                    duration: 30
                })));
            }
        } catch (e) { 
            console.error("Suggestions Error:", e);
        }
    };
    fetchSuggestions();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const term = searchTerm.trim();
    if (term === '') return;

    setLoading(true);
    setError('');
    setResults([]);
    try {
      const res = await fetch(`${PROXY_URL}${encodeURIComponent(DEEZER_SEARCH + term)}`);
      if (!res.ok) throw new Error("Search fetch failed");
      const data = await res.json();
      
      if (data.data && data.data.length > 0) {
          setResults(data.data.map((t: any) => ({
              id: t.id.toString(),
              name: t.title,
              artist_name: t.artist.name,
              image: t.album.cover_medium,
              audio: t.preview,
              duration: 30
          })));
      } else {
          setError(`Nada encontrado para "${term}".`);
      }
    } catch (err: any) {
      console.error("Search Error:", err);
      setError("Erro ao pesquisar música. Tente outro termo.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleConfirmTrim = (musicInfo: MusicInfo) => {
    onSelectMusic(musicInfo);
    setTrimmingTrack(null);
  };

  if (trimmingTrack) {
      return (
          <div className="h-full bg-white dark:bg-black overflow-hidden">
              <MusicTrimmer
                  track={trimmingTrack}
                  onConfirm={handleConfirmTrim}
                  onBack={() => setTrimmingTrack(null)}
              />
          </div>
      );
  }

  return (
    <div className="p-4 flex flex-col h-[75vh] md:h-full bg-white dark:bg-black">
        <div className="flex items-center gap-4 mb-8">
            <button onClick={onBack} className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 hover:scale-110 active:scale-95 transition-all" aria-label="Voltar">
                <BackArrowIcon className="w-5 h-5"/>
            </button>
            <form onSubmit={handleSearch} className="flex-grow relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-sky-500 to-purple-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition-opacity" />
                <div className="relative flex items-center bg-zinc-100 dark:bg-zinc-900 rounded-2xl px-4 py-3.5 border border-transparent focus-within:border-sky-500/50 transition-all">
                    <svg className="w-5 h-5 text-zinc-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Busque artistas famosos aqui..."
                        className="w-full bg-transparent text-sm outline-none font-bold placeholder:text-zinc-500"
                        autoFocus
                    />
                </div>
            </form>
        </div>

        <div className="flex-grow overflow-y-auto no-scrollbar pb-10">
            {loading && <Spinner />}
            
            {!searchTerm && suggestions.length > 0 && !loading && (
                <div className="animate-fade-in">
                    <div className="flex items-center justify-between mb-6 px-2">
                        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Hits do Momento</h3>
                        <div className="h-px flex-grow bg-zinc-100 dark:bg-zinc-800 ml-4" />
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {suggestions.map((track, i) => (
                            <button 
                                key={track.id} 
                                onClick={() => setTrimmingTrack(track)} 
                                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all text-left group active:scale-95 animate-slide-up"
                                style={{ animationDelay: `${i * 50}ms` }}
                            >
                                <div className="relative shrink-0">
                                    <img src={track.image} className="w-14 h-14 rounded-xl object-cover shadow-lg group-hover:shadow-sky-500/10 transition-all" />
                                </div>
                                <div className="flex-grow overflow-hidden">
                                    <p className="font-black text-sm truncate tracking-tight">{track.name}</p>
                                    <p className="text-xs text-zinc-500 truncate font-bold uppercase tracking-wider mt-0.5 opacity-60">{track.artist_name}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {error && <div className="p-10 text-center animate-bounce"><p className="text-zinc-500 font-bold text-sm">{error}</p></div>}
            
            <div className="flex flex-col gap-2">
                {results.map((track, i) => (
                    <button 
                        key={track.id} 
                        onClick={() => setTrimmingTrack(track)} 
                        className="flex items-center gap-4 p-4 rounded-3xl hover:bg-sky-50 dark:hover:bg-sky-900/10 transition-all text-left group active:scale-95 animate-slide-up border border-transparent hover:border-sky-500/20"
                        style={{ animationDelay: `${i * 30}ms` }}
                    >
                        <img src={track.image} alt={track.name} className="w-16 h-16 rounded-2xl object-cover shadow-xl group-hover:rotate-3 transition-transform" />
                        <div className="flex-grow overflow-hidden">
                            <p className="font-black text-base truncate tracking-tighter">{track.name}</p>
                            <p className="text-xs text-zinc-500 truncate font-black uppercase tracking-widest mt-1 opacity-50">{track.artist_name}</p>
                        </div>
                        <svg className="w-5 h-5 text-sky-500 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                    </button>
                ))}
            </div>
      </div>
    </div>
  );
};

export default MusicSearch;
