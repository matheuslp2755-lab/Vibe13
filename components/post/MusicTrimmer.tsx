
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';

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

interface MusicTrimmerProps {
  track: MusicTrackFromAPI;
  onConfirm: (musicInfo: MusicInfo) => void;
  onBack: () => void;
}

const PlayIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8.002v3.996a1 1 0 001.555.832l3.197-1.998a1 1 0 000-1.664l-3.197-1.998z" clipRule="evenodd" />
    </svg>
);

const PauseIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h1a1 1 0 100-2H9V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 001 1h1a1 1 0 100-2h-1V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);

const SNIPPET_DURATION = 25; // Solicitado trecho de 25 segundos

const MusicTrimmer: React.FC<MusicTrimmerProps> = ({ track, onConfirm, onBack }) => {
  const { t } = useLanguage();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [trackDuration, setTrackDuration] = useState(30);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.volume = 1.0;

    const handleLoadedMetadata = () => {
        setTrackDuration(audio.duration);
        audio.currentTime = startTime;
        audio.play().catch(() => setIsPlaying(false));
        setIsPlaying(true);
    };

    const handleTimeUpdate = () => {
        if (audio.currentTime >= startTime + SNIPPET_DURATION) {
            audio.currentTime = startTime; 
        }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [startTime]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartTime = parseFloat(e.target.value);
    setStartTime(newStartTime);
    if (audioRef.current) {
        audioRef.current.currentTime = newStartTime;
        if (!isPlaying) {
            audioRef.current.play().catch(() => setIsPlaying(false));
            setIsPlaying(true);
        }
    }
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      if (audio.currentTime < startTime || audio.currentTime > startTime + SNIPPET_DURATION) {
          audio.currentTime = startTime;
      }
      audio.play();
    }
  };

  const handleConfirm = () => {
    onConfirm({
      nome: track.trackName,
      artista: track.artistName,
      capa: track.artworkUrl100,
      preview: track.previewUrl,
      startTime: startTime,
    });
  };

  const maxStartTime = Math.max(0, trackDuration - SNIPPET_DURATION);
  const barCount = 60;

  return (
    <div className="p-4 flex flex-col items-center gap-6 text-center">
      <audio ref={audioRef} src={track.previewUrl} preload="auto" />
      <img src={track.artworkUrl100.replace('100x100', '400x400')} alt={track.trackName} className="w-48 h-48 rounded-lg shadow-lg border dark:border-zinc-800" />
      <div>
        <p className="font-bold text-lg">{track.trackName}</p>
        <p className="text-sm text-zinc-500">{track.artistName}</p>
      </div>

      <div className="w-full flex items-center gap-4 bg-transparent p-4 rounded-2xl border dark:border-zinc-800">
        <button onClick={togglePlayPause} className="text-sky-500 flex-shrink-0 active:scale-90 transition-transform">
          {isPlaying ? <PauseIcon className="w-10 h-10" /> : <PlayIcon className="w-10 h-10" />}
        </button>
        
        <div className="flex-grow flex flex-col gap-2">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-left">{t('musicSearch.trimInstructions')}</p>
            
            <div className="relative h-16 w-full flex items-center">
                {/* Ondas Sonoras da Música Inteira */}
                <div className="absolute inset-0 flex items-center justify-between gap-[2px]">
                    {Array.from({ length: barCount }).map((_, i) => {
                        const barTime = (i / barCount) * trackDuration;
                        const isActive = barTime >= startTime && barTime <= startTime + SNIPPET_DURATION;
                        
                        return (
                            <div 
                                key={i} 
                                className={`w-1 rounded-full transition-colors duration-300 ${isActive ? 'bg-sky-500' : 'bg-zinc-300 dark:bg-zinc-700'}`} 
                                style={{ height: `${25 + Math.abs(Math.sin(i * 0.5)) * 65}%` }}
                            />
                        );
                    })}
                </div>

                <input
                    type="range"
                    min="0"
                    max={maxStartTime}
                    step="0.1"
                    value={startTime}
                    onChange={handleSliderChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    disabled={maxStartTime <= 0}
                />
            </div>

             <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-mono font-bold">
                <span>0:00</span>
                <span>0:{Math.floor(trackDuration).toString().padStart(2, '0')}</span>
            </div>
        </div>
      </div>
      
      <div className="w-full flex gap-3">
          <button onClick={onBack} className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-full font-bold text-sm">
            {t('common.cancel')}
          </button>
          <Button onClick={handleConfirm} className="flex-1 !rounded-full !py-3">
            {t('musicSearch.done')}
          </Button>
      </div>
    </div>
  );
};

export default MusicTrimmer;
