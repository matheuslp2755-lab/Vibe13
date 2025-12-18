
import React, { useState, useEffect, useRef, useMemo } from 'react';
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

const SNIPPET_DURATION = 25;

// Letras sincronizadas mockadas para o sistema (No app real, viriam da API de letras)
const MOCK_LYRICS = [
  { time: 0, text: "🎶 Aumenta o som, sente a batida..." },
  { time: 4, text: "O universo conspira a nosso favor ✨" },
  { time: 8, text: "Nada pode nos parar agora 🚀" },
  { time: 12, text: "Vivendo intensamente cada segundo 🌟" },
  { time: 16, text: "Nossa conexão brilha mais que neon 🔥" },
  { time: 20, text: "Dançando sob as luzes da cidade 🏙️" },
  { time: 24, text: "A vibe que contagia todo mundo 🌈" },
  { time: 28, text: "O melhor momento é o agora 💎" },
  { time: 32, text: "Rumo ao infinito e além 🎸" },
  { time: 36, text: "Sintonizados na mesma frequência ⚡" },
  { time: 40, text: "Deixa a música guiar o coração ❤️" }
];

const MusicTrimmer: React.FC<MusicTrimmerProps> = ({ track, onConfirm, onBack }) => {
  const { t } = useLanguage();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0); 
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
        // Pega a duração real da música (inteira)
        setDuration(audio.duration);
        audio.currentTime = 0;
    };

    const onTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
        // Garante o loop infinito APENAS no trecho de 25s selecionado
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

  // Encontra o índice da letra ativa para o efeito de destaque e scroll
  const activeLyricIndex = useMemo(() => {
    const time = isDragging ? startTime : currentTime;
    let index = 0;
    for (let i = 0; i < MOCK_LYRICS.length; i++) {
        if (MOCK_LYRICS[i].time <= time) {
            index = i;
        } else {
            break;
        }
    }
    return index;
  }, [currentTime, startTime, isDragging]);

  const maxStartTime = Math.max(0, duration - SNIPPET_DURATION);
  const barCount = 100; // Waveform mais densa para a música toda

  return (
    <div className="flex flex-col items-center gap-6 p-6 h-full bg-white dark:bg-black animate-fade-in overflow-hidden">
      <audio ref={audioRef} src={track.previewUrl} />

      {/* LYRICS ENGINE: Visualização da Letra Sincronizada (Scrolling Centralizado) */}
      <div className="w-full h-36 flex flex-col items-center justify-center relative">
         <div className="absolute inset-0 bg-gradient-to-b from-white dark:from-black via-transparent to-white dark:to-black z-10 pointer-events-none" />
         <div 
            className="flex flex-col items-center gap-6 transition-all duration-500 ease-out"
            style={{ transform: `translateY(${(activeLyricIndex * -52) + 26}px)` }}
         >
            {MOCK_LYRICS.map((line, idx) => {
                const isActive = idx === activeLyricIndex;
                return (
                    <p 
                        key={idx}
                        className={`text-center font-black transition-all duration-500 max-w-xs ${
                            isActive 
                            ? 'text-4xl bg-gradient-to-r from-sky-400 via-purple-500 to-pink-500 text-transparent bg-clip-text scale-110 opacity-100 drop-shadow-md' 
                            : 'text-xl text-zinc-300 dark:text-zinc-800 opacity-20 blur-[1px]'
                        }`}
                    >
                        {line.text}
                    </p>
                );
            })}
         </div>
      </div>

      {/* Identidade Visual: Capa e Artista */}
      <div className="relative group mt-2">
        <img 
            src={track.artworkUrl100.replace('100x100', '600x600')} 
            alt={track.trackName} 
            className="w-44 h-44 rounded-[3rem] shadow-2xl border-4 border-zinc-100 dark:border-zinc-800 transition-transform group-hover:scale-105" 
        />
        <div className="absolute -bottom-2 -right-2 bg-sky-500 p-3 rounded-full shadow-lg border-2 border-white dark:border-black">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.447-.894L4 6.424V20.5a1 1 0 001.5 1.5h.01L17 18.424V4.5a1 1 0 00-1-1.5zM6 8.118l8-2.436v8.664l-8 2.436V8.118z" /></svg>
        </div>
      </div>

      <div className="text-center">
        <h3 className="font-black text-2xl tracking-tight leading-tight">{track.trackName}</h3>
        <p className="text-zinc-500 font-bold text-sm uppercase tracking-widest mt-1 opacity-60">{track.artistName}</p>
      </div>

      {/* WAVEFORM SELECTOR (SISTEMA DE MÚSICA COMPLETA) */}
      <div className="w-full space-y-6 px-2 mt-4">
        <div className="relative h-32 w-full flex items-center bg-zinc-50 dark:bg-zinc-900/40 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-inner">
            
            {/* Waveform Base: Representa a música INTEIRA */}
            <div className="absolute inset-0 flex items-center justify-between gap-[2px] px-8 opacity-10">
                {Array.from({ length: barCount }).map((_, i) => (
                    <div 
                        key={i} 
                        className="w-[2px] rounded-full bg-zinc-600 dark:bg-zinc-400" 
                        style={{ height: `${20 + Math.abs(Math.sin(i * 0.4)) * 60}%` }}
                    />
                ))}
            </div>

            {/* Janela de 25s: Highlight dinâmico que se move conforme o tempo */}
            <div 
                className="absolute inset-0 flex items-center justify-between gap-[2px] px-8 pointer-events-none overflow-hidden transition-all duration-100"
                style={{ 
                    clipPath: `inset(0 ${100 - ((startTime + SNIPPET_DURATION) / (duration || 1)) * 100}% 0 ${(startTime / (duration || 1)) * 100}%)` 
                }}
            >
                {Array.from({ length: barCount }).map((_, i) => (
                    <div 
                        key={i} 
                        className="w-[2px] rounded-full bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.9)]" 
                        style={{ height: `${25 + Math.abs(Math.sin(i * 0.4)) * 75}%` }}
                    />
                ))}
            </div>

            {/* Slider de Arraste da Timeline */}
            <input
                type="range"
                min="0"
                max={maxStartTime}
                step="0.01"
                value={startTime}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onTouchStart={() => setIsDragging(true)}
                onTouchEnd={() => setIsDragging(false)}
                onChange={handleSliderChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
                disabled={maxStartTime <= 0}
            />

            {/* Indicador Visual da Janela de 25s (Estilo Instagram) */}
            <div 
                className="absolute h-full border-x-4 border-sky-500 bg-sky-500/5 pointer-events-none transition-all duration-100 shadow-[0_0_30px_rgba(14,165,233,0.15)]"
                style={{ 
                    left: `${(startTime / (duration || 1)) * 100}%`, 
                    width: `${(SNIPPET_DURATION / (duration || 1)) * 100}%` 
                }}
            >
                <div className="absolute top-[-4px] left-0 right-0 h-1.5 bg-sky-500 rounded-full" />
                <div className="absolute bottom-[-4px] left-0 right-0 h-1.5 bg-sky-500 rounded-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[4.5rem] bg-sky-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full whitespace-nowrap shadow-xl border-2 border-white dark:border-black">
                    JANELA DE 25s
                </div>
            </div>
        </div>

        <div className="flex justify-between items-center text-[10px] font-black text-zinc-400 uppercase tracking-widest px-6">
            <span>0:00</span>
            <span className="text-sky-500 animate-pulse">{t('musicSearch.trimInstructions')}</span>
            <span>{Math.floor(duration / 60)}:{(duration % 60).toFixed(0).padStart(2, '0')}</span>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="w-full flex gap-3 mt-auto mb-2">
        <button 
            onClick={onBack} 
            className="flex-1 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 font-black text-xs uppercase tracking-widest text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
            {t('common.cancel')}
        </button>
        <Button 
            onClick={() => onConfirm({
                nome: track.trackName,
                artista: track.artistName,
                capa: track.artworkUrl100,
                preview: track.previewUrl,
                startTime: startTime,
            })} 
            className="flex-1 !rounded-2xl !py-4 !text-xs !font-black !uppercase !tracking-widest shadow-2xl shadow-sky-500/30"
        >
            {t('musicSearch.done')}
        </Button>
      </div>
    </div>
  );
};

export default MusicTrimmer;
