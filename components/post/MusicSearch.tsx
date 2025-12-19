
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';
import MusicTrimmer from './MusicTrimmer';

type MusicTrackFromAPI = {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100: string;
  previewUrl: string;
};

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
  const [results, setResults] = useState<MusicTrackFromAPI[]>([]);
  const [suggestions, setSuggestions] = useState<MusicTrackFromAPI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trimmingTrack, setTrimmingTrack] = useState<MusicTrackFromAPI | null>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
        try {
            const res = await fetch(`https://itunes.apple.com/search?term=trending&entity=song&limit=8`);
            const data = await res.json();
            setSuggestions(data.results);
        } catch (e) { console.error(e); }
    };
    fetchSuggestions();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchTerm.trim() === '') return;

    setLoading(true);
    setError('');
    setResults([]);
    try {
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=song&limit=30`);
      const data = await response.json();
      setResults(data.results);
      if (data.results.length === 0) {
          setError(t('createPost.musicNoResults'));
      }
    } catch (err: any) {
      setError(t('musicSearch.searchError'));
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
                        placeholder={t('createPost.searchMusicPlaceholder')}
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
                        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t('musicSearch.suggestions')}</h3>
                        <div className="h-px flex-grow bg-zinc-100 dark:bg-zinc-800 ml-4" />
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {suggestions.map((track, i) => (
                            <button 
                                key={track.trackId} 
                                onClick={() => setTrimmingTrack(track)} 
                                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all text-left group active:scale-95 animate-slide-up"
                                style={{ animationDelay: `${i * 50}ms` }}
                            >
                                <div className="relative shrink-0">
                                    <img src={track.artworkUrl100} className="w-14 h-14 rounded-xl object-cover shadow-lg group-hover:shadow-sky-500/10 transition-all" />
                                    <div className="absolute inset-0 bg-black/20 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8.002v3.996a1 1 0 001.555.832l3.197-1.998a1 1 0 000-1.664l-3.197-1.998z" /></svg>
                                    </div>
                                </div>
                                <div className="flex-grow overflow-hidden">
                                    <p className="font-black text-sm truncate tracking-tight">{track.trackName}</p>
                                    <p className="text-xs text-zinc-500 truncate font-bold uppercase tracking-wider mt-0.5 opacity-60">{track.artistName}</p>
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
                        key={track.trackId} 
                        onClick={() => setTrimmingTrack(track)} 
                        className="flex items-center gap-4 p-4 rounded-3xl hover:bg-sky-50 dark:hover:bg-sky-900/10 transition-all text-left group active:scale-95 animate-slide-up border border-transparent hover:border-sky-500/20"
                        style={{ animationDelay: `${i * 30}ms` }}
                    >
                        <img src={track.artworkUrl100} alt={track.trackName} className="w-16 h-16 rounded-2xl object-cover shadow-xl group-hover:rotate-3 transition-transform" />
                        <div className="flex-grow overflow-hidden">
                            <p className="font-black text-base truncate tracking-tighter">{track.trackName}</p>
                            <p className="text-xs text-zinc-500 truncate font-black uppercase tracking-widest mt-1 opacity-50">{track.artistName}</p>
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
