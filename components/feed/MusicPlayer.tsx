
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface MusicInfo {
  nome: string;
  artista: string;
  capa: string;
  preview: string;
  startTime?: number;
}

interface MusicPlayerProps {
  musicInfo: MusicInfo;
  isPlaying: boolean;
  isMuted: boolean;
  setIsMuted: (isMuted: boolean) => void;
}

const PlayIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const PauseIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const VolumeOnIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
);

const VolumeOffIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
);

const SNIPPET_DURATION = 25; 

const MusicPlayer: React.FC<MusicPlayerProps> = ({ musicInfo, isPlaying, isMuted, setIsMuted }) => {
    const { t } = useLanguage();
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(musicInfo.startTime || 0);

    const togglePlayPause = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!audioRef.current) return;
        
        if (isAudioPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(err => console.error("Error playing audio:", err?.message || String(err)));
        }
    };
    
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            const startTime = musicInfo.startTime || 0;
            // Garante que o áudio comece no ponto selecionado
            if (audio.currentTime < startTime || audio.currentTime >= startTime + SNIPPET_DURATION) {
                audio.currentTime = startTime;
            }
            audio.play().catch(() => {
                setIsAudioPlaying(false);
            });
        } else {
            audio.pause();
        }
    }, [isPlaying, musicInfo.startTime]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            const time = audio.currentTime;
            const startTime = musicInfo.startTime || 0;
            // Loop dentro dos 25 segundos
            if (time >= startTime + SNIPPET_DURATION) {
                audio.currentTime = startTime;
            }
            setCurrentTime(time);
        };
        const handlePlay = () => setIsAudioPlaying(true);
        const handlePause = () => setIsAudioPlaying(false);
        
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handlePause);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handlePause);
        };
    }, [musicInfo.startTime]);

    const startTime = musicInfo.startTime || 0;
    const relativeCurrentTime = Math.max(0, currentTime - startTime);
    const progressPercentage = Math.min(100, (relativeCurrentTime / SNIPPET_DURATION) * 100);

    return (
        <div className="p-3">
            <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0 w-12 h-12">
                    <img src={musicInfo.capa} alt={musicInfo.nome} className="w-full h-full rounded-md object-cover border dark:border-zinc-800"/>
                    <button 
                        onClick={togglePlayPause} 
                        className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 text-white rounded-md opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                       {isAudioPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8" />}
                    </button>
                </div>
                <div className="flex-grow overflow-hidden">
                    <p className="font-bold text-sm truncate">{musicInfo.nome}</p>
                    <p className="text-xs text-zinc-500 truncate">{musicInfo.artista}</p>
                     <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1 mt-2">
                        <div className="bg-sky-500 h-1 rounded-full transition-all duration-100" style={{ width: `${progressPercentage}%` }}></div>
                    </div>
                </div>
                 <button 
                    onClick={() => setIsMuted(!isMuted)} 
                    className="p-1 text-zinc-400 hover:text-sky-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full flex-shrink-0 transition-colors"
                    aria-label={isMuted ? "Unmute" : "Mute"}
                >
                    {isMuted ? <VolumeOffIcon className="w-5 h-5" /> : <VolumeOnIcon className="w-5 h-5" />}
                </button>
                {/* Aqui o audio src carrega a trilha inteira (original) */}
                <audio ref={audioRef} src={musicInfo.preview} preload="metadata" muted={isMuted} />
            </div>
        </div>
    );
};

export default MusicPlayer;
