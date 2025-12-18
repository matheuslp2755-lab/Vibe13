
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
    <div className="flex justify-center items-center p-4">
        <svg className="animate-spin h-5 w-5 text-zinc-500 dark:text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
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
    // Carregar sugestões iniciais (Trending)
    const fetchSuggestions = async () => {
        try {
            const res = await fetch(`https://itunes.apple.com/search?term=pop&entity=song&limit=6`);
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
          <div className="p-4 flex flex-col h-[60vh] md:h-auto">
              <MusicTrimmer
                  track={trimmingTrack}
                  onConfirm={handleConfirmTrim}
                  onBack={() => setTrimmingTrack(null)}
              />
          </div>
      );
  }

  return (
    <div className="p-4 flex flex-col h-[60vh] md:h-auto">
        <div className="flex items-center gap-3 mb-6">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Voltar">
                <BackArrowIcon className="w-6 h-6"/>
            </button>
            <form onSubmit={handleSearch} className="flex-grow relative">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t('createPost.searchMusicPlaceholder')}
                    className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-sky-500 font-medium"
                    autoFocus
                />
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </form>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar">
            {loading && <Spinner />}
            
            {!searchTerm && suggestions.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4 px-2">{t('musicSearch.suggestions')}</h3>
                    <div className="flex flex-col gap-1">
                        {suggestions.map((track) => (
                            <button key={track.trackId} onClick={() => setTrimmingTrack(track)} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all text-left group">
                                <img src={track.artworkUrl100} className="w-14 h-14 rounded-xl object-cover shadow-md group-hover:scale-105 transition-transform" />
                                <div className="flex-grow overflow-hidden">
                                    <p className="font-bold text-sm truncate">{track.trackName}</p>
                                    <p className="text-xs text-zinc-500 truncate font-semibold">{track.artistName}</p>
                                </div>
                                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <svg className="w-4 h-4 text-sky-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8.002v3.996a1 1 0 001.555.832l3.197-1.998a1 1 0 000-1.664l-3.197-1.998z" /></svg>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {error && <p className="text-zinc-500 text-center py-4">{error}</p>}
            
            <div className="flex flex-col gap-1">
                {results.map((track) => (
                    <button key={track.trackId} onClick={() => setTrimmingTrack(track)} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all text-left group">
                        <img src={track.artworkUrl100} alt={track.trackName} className="w-14 h-14 rounded-xl object-cover shadow-md group-hover:scale-105 transition-transform" />
                        <div className="flex-grow overflow-hidden">
                            <p className="font-bold text-sm truncate">{track.trackName}</p>
                            <p className="text-xs text-zinc-500 truncate font-semibold">{track.artistName}</p>
                        </div>
                        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity">
                             <svg className="w-4 h-4 text-sky-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8.002v3.996a1 1 0 001.555.832l3.197-1.998a1 1 0 000-1.664l-3.197-1.998z" /></svg>
                        </div>
                    </button>
                ))}
            </div>
      </div>
    </div>
  );
};

export default MusicSearch;
