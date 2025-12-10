
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


const SNIPPET_DURATION = 25; // Updated to 25 seconds

const MusicTrimmer: React.FC<MusicTrimmerProps> = ({ track, onConfirm, onBack }) => {
  const { t } = useLanguage();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [trackDuration, setTrackDuration] = useState(30); // iTunes previews are usually 30s

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Set volume to max
    audio.volume = 1.0;

    const handleLoadedMetadata = () => {
        setTrackDuration(audio.duration);
        // Start playing when loaded
        audio.currentTime = startTime;
        audio.play().catch(() => setIsPlaying(false));
        setIsPlaying(true);
    };

    const handleTimeUpdate = () => {
        // Loop logic: if current playhead exceeds selected window, restart from start of window
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
  }, [startTime]); // Re-run effect when window start changes to ensure loop is correct

  // When user drags, update start time and seek audio immediately
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
      // Ensure we start playing from the selected start time if stopped
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

  // Max valid start time to ensure we always have SNIPPET_DURATION remaining
  // If track is shorter than snippet, max start is 0
  const maxStartTime = Math.max(0, trackDuration - SNIPPET_DURATION);
  
  // Visual calculation for the "window"
  // If track is shorter than snippet, window is 100%
  const windowPercentage = Math.min(100, (SNIPPET_DURATION / trackDuration) * 100);
  const leftPositionPercentage = (startTime / trackDuration) * 100;

  return (
    <div className="p-4 flex flex-col items-center gap-6 text-center">
      <audio ref={audioRef} src={track.previewUrl} preload="auto" />
      <img src={track.artworkUrl100.replace('100x100', '400x400')} alt={track.trackName} className="w-48 h-48 rounded-lg shadow-lg" />
      <div>
        <p className="font-bold text-lg">{track.trackName}</p>
        <p className="text-sm text-zinc-500">{track.artistName}</p>
      </div>

      <div className="w-full flex items-center gap-4">
        <button onClick={togglePlayPause} className="text-sky-500 flex-shrink-0">
          {isPlaying ? <PauseIcon className="w-10 h-10" /> : <PlayIcon className="w-10 h-10" />}
        </button>
        
        <div className="flex-grow flex flex-col gap-2">
            <p className="text-xs text-zinc-400 text-left">{t('musicSearch.trimInstructions')}</p>
            
            {/* Custom Visual Timeline Control */}
            <div className="relative h-12 w-full bg-zinc-200 dark:bg-zinc-800 rounded-md overflow-hidden flex items-center">
                {/* Simulated Waveform Background (Static pattern for visual cue) */}
                <div className="absolute inset-0 opacity-20 flex items-center justify-center gap-[2px]">
                    {Array.from({ length: 40 }).map((_, i) => (
                        <div 
                            key={i} 
                            className="bg-zinc-500 dark:bg-zinc-400 w-1 rounded-full" 
                            style={{ height: `${Math.random() * 80 + 20}%` }}
                        />
                    ))}
                </div>

                {/* Highlighted Window (The selected 15s) */}
                <div 
                    className="absolute h-full border-2 border-sky-500 bg-sky-500/20 backdrop-blur-sm z-10 pointer-events-none rounded-md transition-all duration-75 ease-linear"
                    style={{ 
                        left: `${leftPositionPercentage}%`, 
                        width: `${windowPercentage}%` 
                    }}
                >
                    {/* Optional: Add grab handles visuals if desired */}
                </div>

                {/* Invisible Range Input on top for interaction */}
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

             <div className="flex justify-between text-xs text-zinc-500 mt-1 font-mono">
                <span>0:00</span>
                <span>0:{Math.floor(trackDuration)}</span>
            </div>
        </div>
      </div>
      
      <Button onClick={handleConfirm} className="w-full">
        {t('musicSearch.done')}
      </Button>
    </div>
  );
};

export default MusicTrimmer;
