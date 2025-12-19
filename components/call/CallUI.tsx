
import React, { useEffect, useRef, useState } from 'react';
import { useCall } from '../../context/CallContext';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';
import { auth } from '../../firebase';

const CALL_FILTERS = [
    { id: 'none', label: 'filters.none', filter: 'none', preview: 'bg-zinc-200' },
    { id: 'bw', label: 'filters.bw', filter: 'grayscale(1)', preview: 'bg-zinc-400' },
    { id: 'vintage', label: 'filters.vintage', filter: 'sepia(0.8) contrast(1.1)', preview: 'bg-orange-200' },
    { id: 'soft', label: 'filters.soft', filter: 'brightness(1.1) contrast(0.9) saturate(1.1)', preview: 'bg-pink-100' },
    { id: 'cool', label: 'filters.cool', filter: 'hue-rotate(180deg) saturate(0.8)', preview: 'bg-sky-200' },
    { id: 'focus', label: 'filters.focus', filter: 'blur(8px)', preview: 'bg-zinc-300 opacity-50' },
];

const CallTimer: React.FC = () => {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setSeconds(s => s + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const secs = (totalSeconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    return <p className="text-sm text-zinc-400 font-mono tracking-wider">{formatTime(seconds)}</p>;
};

const CallUI: React.FC = () => {
    const { activeCall, localStream, remoteStream, hangUp, answerCall, declineCall, error, isScreenSharing, toggleScreenSharing } = useCall();
    const { t } = useLanguage();
    
    const localAudioRef = useRef<HTMLAudioElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const ringtoneRef = useRef<HTMLAudioElement>(null);

    const [selectedFilter, setSelectedFilter] = useState(CALL_FILTERS[0]);
    const [showEffectsMenu, setShowEffectsMenu] = useState(false);

    // Gerenciar Ringtone
    useEffect(() => {
        if (activeCall?.status === 'ringing-incoming') {
            ringtoneRef.current?.play().catch(() => {});
        } else {
            ringtoneRef.current?.pause();
            if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
        }
    }, [activeCall?.status]);

    useEffect(() => {
        if (!activeCall) return;

        if (localStream && localAudioRef.current && !activeCall.isVideo) {
            localAudioRef.current.srcObject = localStream;
        }
        if (remoteStream && remoteAudioRef.current && !activeCall.isVideo) {
            remoteAudioRef.current.srcObject = remoteStream;
        }

        if (activeCall.isVideo) {
            if (localStream && localVideoRef.current) localVideoRef.current.srcObject = localStream;
            if (remoteStream && remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [localStream, remoteStream, activeCall]);

    if (!activeCall && !error) return null;

    const otherUser = activeCall?.receiver.id === auth.currentUser?.uid ? activeCall?.caller : activeCall?.receiver;
    const isVideoCall = activeCall?.isVideo;

    // UI de Chamada Conectada (Vídeo Full Screen)
    if (activeCall?.status === 'connected' && isVideoCall) {
        return (
            <div className="fixed inset-0 bg-black z-[100] flex flex-col overflow-hidden animate-fade-in">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                
                <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none">
                    <div className="bg-black/30 backdrop-blur-md p-4 rounded-2xl w-fit pointer-events-auto border border-white/10">
                        <p className="text-white font-bold text-sm">{otherUser?.username}</p>
                        <CallTimer />
                    </div>

                    <div className="flex flex-col items-center gap-6 pointer-events-auto">
                        {showEffectsMenu && (
                            <div className="w-full max-w-xs bg-black/60 backdrop-blur-xl p-4 rounded-3xl border border-white/20 animate-slide-up mb-4">
                                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                                    {CALL_FILTERS.map(f => (
                                        <button key={f.id} onClick={() => setSelectedFilter(f)} className="flex-shrink-0 flex flex-col items-center gap-1">
                                            <div className={`w-12 h-12 rounded-full border-2 ${f.preview} ${selectedFilter.id === f.id ? 'border-sky-500 scale-110' : 'border-white/20'}`} />
                                            <span className="text-[10px] text-white/70 font-bold">{t(`call.filters.${f.id}`)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-4 mb-8">
                            {/* Botão Compartilhar Tela */}
                            <button 
                                onClick={() => toggleScreenSharing()} 
                                className={`p-4 rounded-full backdrop-blur-md border border-white/10 transition-all ${isScreenSharing ? 'bg-orange-500 text-white' : 'bg-white/10 text-white'}`}
                                title={isScreenSharing ? t('call.stopShare') : t('call.shareScreen')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </button>

                            <button onClick={() => setShowEffectsMenu(!showEffectsMenu)} className={`p-4 rounded-full backdrop-blur-md border border-white/10 ${showEffectsMenu ? 'bg-sky-500' : 'bg-white/10 text-white'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </button>
                            <button onClick={() => hangUp()} className="bg-red-600 p-5 rounded-full text-white shadow-2xl hover:bg-red-700 transition-all active:scale-95">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-32 right-4 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-zinc-900">
                    <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: isScreenSharing ? 'none' : 'scaleX(-1)', filter: selectedFilter.filter }} />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[100] flex items-center justify-center p-6 transition-all duration-500">
            <audio ref={ringtoneRef} src="https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3" loop />
            
            <div className="bg-zinc-900/80 text-white rounded-[3rem] w-full max-w-sm p-10 border border-white/10 shadow-2xl text-center flex flex-col items-center animate-fade-in">
                
                {/* Avatar com Animação */}
                <div className="relative mb-8">
                    <div className={`absolute inset-0 rounded-full bg-sky-500/20 animate-ping ${activeCall?.status === 'ringing-incoming' ? 'block' : 'hidden'}`}></div>
                    <img 
                        src={otherUser?.avatar} 
                        alt={otherUser?.username} 
                        className="relative w-32 h-32 rounded-full border-4 border-white/20 object-cover shadow-2xl z-10" 
                    />
                </div>

                <h2 className="text-2xl font-black mb-1">{otherUser?.username}</h2>
                <p className="text-sky-400 font-bold uppercase tracking-widest text-[10px] mb-12">
                    {activeCall?.status === 'ringing-incoming' ? (isVideoCall ? t('call.incomingVideoCall') : t('call.incomingCall')) : 
                     activeCall?.status === 'ringing-outgoing' ? t('call.calling', { username: '' }).replace('...', '') : 
                     t('call.onCallWith', { username: '' }).replace('...', '')}
                </p>

                {/* Ações Dinâmicas */}
                {activeCall?.status === 'ringing-incoming' ? (
                    <div className="flex items-center gap-12 w-full justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <button 
                                onClick={declineCall} 
                                className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-red-700 transition-all active:scale-90"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">{t('call.decline')}</span>
                        </div>

                        <div className="flex flex-col items-center gap-3">
                            <button 
                                onClick={answerCall} 
                                className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-green-600 transition-all active:scale-90 animate-bounce-subtle"
                            >
                                {isVideoCall ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                )}
                            </button>
                            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">{t('call.answer')}</span>
                        </div>
                    </div>
                ) : (
                    <div className="w-full flex flex-col items-center">
                        {activeCall?.status === 'connected' && <CallTimer />}
                        <button 
                            onClick={() => hangUp()} 
                            className="mt-8 w-20 h-20 bg-red-600 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-red-700 transition-all active:scale-90"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                )}
            </div>

            {/* Áudio redundante para modo voz */}
            {!isVideoCall && (
                <>
                    <audio ref={localAudioRef} autoPlay muted playsInline />
                    <audio ref={remoteAudioRef} autoPlay playsInline />
                </>
            )}

            <style>{`
                @keyframes bounce-subtle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                .animate-bounce-subtle { animation: bounce-subtle 2s infinite ease-in-out; }
            `}</style>
        </div>
    );
};

export default CallUI;
