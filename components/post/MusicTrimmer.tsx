
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';

type MusicTrackFromAPI = {
  id: string;
  name: string;
  artist_name: string;
  image: string;
  audio: string;
  duration: number;
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

const SNIPPET_DURATION = 25; // Mantido em 25s para os posts

const MOCK_LYRICS = [
  { time: 0, text: "🎶 Sente a batida, aumenta o volume..." },
  { time: 4, text: "A música certa pro momento perfeito ✨" },
  { time: 8, text: "Tudo que a gente viveu agora faz sentido 🚀" },
  { time: 12, text: "Vivendo cada nota dessa canção 🌟" },
  { time: 16, text: "Nossa vibe brilha mais que as luzes 🔥" },
  { time: 20, text: "Sob o céu da cidade, o som nos guia 🏙️" },
  { time: 24, text: "O ritmo que contagia o coração 🌈" },
  { time: 28, text: "Esse é o nosso momento, agora! 💎" }
];

const MusicTrimmer: React.FC<MusicTrimmerProps> = ({ track, onConfirm, onBack }) => {
  const { t } = useLanguage();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30); // Previews do Deezer são fixos em 30s
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
        setDuration(audio.duration);
        audio.currentTime = 0;
    };

    const onTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
        if (!isDragging && audio.currentTime >= startTime + SNIPPET_DURATION) {
            audio.currentTime = startTime;
        }
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [startTime, isDragging]);

  useEffect(() => {
    if (audioRef.current && !isDragging) {
        audioRef.current.currentTime = startTime;
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
    }
  }, [startTime, isDragging]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setStartTime(val);
    if (audioRef.current) {
        audioRef.current.currentTime = val;
    }
  };

  const activeLyricIndex = useMemo(() => {
    const time = isDragging ? startTime : currentTime;
    let index = 0;
    for (let i = 0; i < MOCK_LYRICS.length; i++) {
        if (MOCK_LYRICS[i].time <= time) index = i;
        else break;
    }
    return index;
  }, [currentTime, startTime, isDragging]);

  // Max startTime ajustado para sobrar ao menos 1s de áudio
  const maxStartTime = Math.max(0, 30 - SNIPPET_DURATION - 1); 
  const barCount = 60;

  return (
    <div className="flex flex-col items-center gap-6 p-6 h-full bg-white dark:bg-black animate-fade-in overflow-hidden">
      <audio ref={audioRef} src={track.audio} />

      <div className="w-full h-40 flex flex-col items-center justify-center relative mt-4">
         <div className="absolute inset-0 bg-gradient-to-b from-white dark:from-black via-transparent to-white dark:to-black z-10 pointer-events-none" />
         <div 
            className="flex flex-col items-center gap-4 transition-all duration-700 cubic-bezier(0.23, 1, 0.32, 1)"
            style={{ transform: `translateY(${(activeLyricIndex * -48) + 24}px)` }}
         >
            {MOCK_LYRICS.map((line, idx) => {
                const isActive = idx === activeLyricIndex;
                const isFar = Math.abs(idx - activeLyricIndex) > 1;
                return (
                    <p 
                        key={idx}
                        className={`text-center font-black transition-all duration-500 max-w-xs ${
                            isActive 
                            ? 'text-3xl text-zinc-900 dark:text-white scale-110 opacity-100 drop-shadow-sm' 
                            : isFar ? 'text-lg opacity-5 blur-[2px]' : 'text-xl text-zinc-300 dark:text-zinc-800 opacity-40 blur-[0.5px]'
                        }`}
                    >
                        {line.text}
                    </p>
                );
            })}
         </div>
      </div>

      <div className="relative mt-2">
        <div className={`w-48 h-48 rounded-full border-[10px] border-zinc-100 dark:border-zinc-900 shadow-2xl overflow-hidden relative ${isPlaying ? 'animate-spin-slow' : ''}`}>
             <img src={track.image} className="w-full h-full object-cover" alt={track.name} />
             <div className="absolute inset-0 border-[30px] border-black/10 rounded-full pointer-events-none" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-zinc-800 rounded-full border-4 border-black/40 shadow-inner" />
        </div>
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-sky-500 px-4 py-1.5 rounded-full shadow-xl border-4 border-white dark:border-black animate-pulse">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8.002v3.996a1 1 0 001.555.832l3.197-1.998a1 1 0 001.555-.832l3.197-1.998z" /></svg>
        </div>
      </div>

      <div className="text-center space-y-1">
        <h3 className="font-black text-2xl tracking-tighter">{track.name}</h3>
        <p className="text-sky-500 font-black text-[10px] uppercase tracking-[0.25em] opacity-80">{track.artist_name}</p>
      </div>

      <div className="w-full space-y-6 px-4 mt-4">
        <div className="relative h-24 w-full flex items-center bg-zinc-50 dark:bg-zinc-900/20 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 overflow-hidden group">
            
            <div className="absolute inset-0 flex items-center justify-between gap-[2px] px-6 opacity-10">
                {Array.from({ length: barCount }).map((_, i) => (
                    <div key={i} className="w-[3px] rounded-full bg-zinc-500" style={{ height: `${20 + Math.abs(Math.sin(i * 0.5)) * 50}%` }} />
                ))}
            </div>

            <div 
                className="absolute inset-0 flex items-center justify-between gap-[2px] px-6 pointer-events-none transition-all duration-100"
                style={{ clipPath: `inset(0 ${100 - ((startTime + SNIPPET_DURATION) / (duration || 30)) * 100}% 0 ${(startTime / (duration || 30)) * 100}%)` }}
            >
                {Array.from({ length: barCount }).map((_, i) => (
                    <div key={i} className="w-[3px] rounded-full bg-sky-500 shadow-[0_0_10px_#0ea5e9]" style={{ height: `${25 + Math.abs(Math.sin(i * 0.5)) * 65}%` }} />
                ))}
            </div>

            <input
                type="range" min="0" max={maxStartTime} step="0.1" value={startTime}
                onMouseDown={() => setIsDragging(true)} onMouseUp={() => setIsDragging(false)}
                onTouchStart={() => setIsDragging(true)} onTouchEnd={() => setIsDragging(false)}
                onChange={handleSliderChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
            />

            <div 
                className="absolute h-full border-x-4 border-sky-500 bg-sky-500/10 pointer-events-none transition-all duration-75 shadow-[0_0_25px_rgba(14,165,233,0.2)]"
                style={{ left: `${(startTime / (duration || 30)) * 100}%`, width: `${(SNIPPET_DURATION / (duration || 30)) * 100}%` }}
            >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-sky-500 text-[8px] font-black text-white px-3 py-0.5 rounded-full whitespace-nowrap shadow-lg">Recortar 25s</div>
            </div>
        </div>

        <div className="flex justify-between items-center text-[9px] font-black text-zinc-400 uppercase tracking-widest px-4">
            <span className="text-sky-500/60">0:00</span>
            <span className="text-zinc-500 animate-pulse">Deslize para escolher a melhor parte</span>
            <span className="text-zinc-500">0:30s</span>
        </div>
      </div>

      <div className="w-full flex gap-3 mt-auto pb-4">
        <button 
            onClick={onBack} 
            className="flex-1 py-4 rounded-3xl bg-zinc-100 dark:bg-zinc-900 font-black text-xs uppercase tracking-widest text-zinc-500 hover:bg-zinc-200 transition-all active:scale-95"
        >
            {t('common.cancel')}
        </button>
        <Button 
            onClick={() => onConfirm({
                nome: track.name,
                artista: track.artist_name,
                capa: track.image,
                preview: track.audio,
                startTime: startTime,
            })} 
            className="flex-1 !rounded-3xl !py-4 !text-xs !font-black !uppercase !tracking-widest !bg-zinc-900 dark:!bg-white !text-white dark:!text-black shadow-2xl active:scale-95"
        >
            {t('musicSearch.done')}
        </Button>
      </div>

      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
      `}</style>
    </div>
  );
};

export default MusicTrimmer;
