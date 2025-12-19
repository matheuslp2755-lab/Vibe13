
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

    return <p className="text-sm text-zinc-400">{formatTime(seconds)}</p>;
};

const ErrorUI: React.FC<{ error: string, onDismiss: () => void }> = ({ error, onDismiss }) => {
    const { t } = useLanguage();
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[100]" aria-modal="true" role="dialog">
            <div className="bg-zinc-900 text-white rounded-lg shadow-xl w-full max-w-sm p-6 border border-zinc-700 text-center">
                <h3 className="text-xl font-semibold text-red-500">{t('call.callError')}</h3>
                <p className="text-sm text-zinc-400 mt-2">{t(error) || t('call.callError')}</p>
                <Button onClick={onDismiss} className="w-full mt-10">{t('common.cancel')}</Button>
            </div>
        </div>
    );
}

const CallUI: React.FC = () => {
    const { activeCall, localStream, remoteStream, hangUp, answerCall, declineCall, error } = useCall();
    const { t } = useLanguage();
    
    const localAudioRef = useRef<HTMLAudioElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    const [selectedFilter, setSelectedFilter] = useState(CALL_FILTERS[0]);
    const [showEffectsMenu, setShowEffectsMenu] = useState(false);

    useEffect(() => {
        if (!activeCall) {
            setShowEffectsMenu(false);
            setSelectedFilter(CALL_FILTERS[0]);
            return;
        }

        if (localStream && localAudioRef.current && !activeCall.isVideo) {
            if (localAudioRef.current.srcObject !== localStream) {
                localAudioRef.current.srcObject = localStream;
            }
        }
        if (remoteStream && remoteAudioRef.current && !activeCall.isVideo) {
            if (remoteAudioRef.current.srcObject !== remoteStream) {
                remoteAudioRef.current.srcObject = remoteStream;
            }
        }

        if (activeCall.isVideo) {
            if (localStream && localVideoRef.current) {
                if (localVideoRef.current.srcObject !== localStream) {
                    localVideoRef.current.srcObject = localStream;
                }
            }
            if (remoteStream && remoteVideoRef.current) {
                if (remoteVideoRef.current.srcObject !== remoteStream) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
            }
        }
    }, [localStream, remoteStream, activeCall]);

    useEffect(() => {
        if (activeCall && ['ended', 'declined', 'cancelled'].includes(activeCall.status)) {
            const timer = setTimeout(() => {
                hangUp(true); 
            }, 2500);
            return () => clearTimeout(timer);
        }
    }, [activeCall, hangUp]);


    if (!activeCall && !error) return null;

    if (error) {
        return <ErrorUI error={error} onDismiss={() => hangUp(true)} />;
    }
    
    if (!activeCall) return null;

    const otherUser = activeCall.receiver.id === auth.currentUser?.uid ? activeCall.caller : activeCall.receiver;
    const isVideoCall = activeCall.isVideo;

    if (isVideoCall && activeCall.status === 'connected') {
        return (
            <div className="fixed inset-0 bg-black z-[100] flex flex-col overflow-hidden" aria-modal="true" role="dialog">
                {/* Vídeo Remoto */}
                <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover transition-all duration-500"
                    key={remoteStream ? remoteStream.id : 'remote-waiting'}
                />
                
                {/* Controles Overlay */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
                    <div className="flex justify-between items-start pointer-events-auto">
                        <div className="bg-black/40 backdrop-blur-md p-3 rounded-2xl text-white border border-white/10">
                            <h3 className="font-bold text-sm">{otherUser.username}</h3>
                            <CallTimer />
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-6 pointer-events-auto">
                        {/* Menu de Efeitos Horizontal */}
                        {showEffectsMenu && (
                            <div className="w-full max-w-sm bg-black/40 backdrop-blur-xl p-4 rounded-3xl border border-white/10 animate-slide-up">
                                <div className="flex justify-between items-center mb-3 px-2">
                                    <span className="text-white text-[10px] font-black uppercase tracking-widest">{t('call.effects')}</span>
                                    <button onClick={() => setShowEffectsMenu(false)} className="text-white/60 hover:text-white">&times;</button>
                                </div>
                                <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
                                    {CALL_FILTERS.map((f) => (
                                        <button 
                                            key={f.id}
                                            onClick={() => setSelectedFilter(f)}
                                            className="flex flex-col items-center gap-2 flex-shrink-0 group"
                                        >
                                            <div className={`w-14 h-14 rounded-full border-2 transition-all ${f.preview} ${selectedFilter.id === f.id ? 'border-sky-500 scale-110 shadow-lg shadow-sky-500/20' : 'border-white/20'}`} />
                                            <span className={`text-[9px] font-bold ${selectedFilter.id === f.id ? 'text-sky-400' : 'text-white/60'}`}>{t(`call.${f.label}`)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-4">
                            {/* Botão de Efeitos */}
                            <button 
                                onClick={() => setShowEffectsMenu(!showEffectsMenu)}
                                className={`p-4 rounded-full backdrop-blur-md border border-white/10 transition-all active:scale-90 ${showEffectsMenu ? 'bg-sky-500 text-white' : 'bg-black/40 text-white'}`}
                                title={t('call.effects')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                                </svg>
                            </button>

                            <Button onClick={() => hangUp()} className="!w-auto !bg-red-600 hover:!bg-red-700 rounded-full p-5 shadow-2xl border-2 border-white/10 active:scale-95 transition-transform">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Meu Vídeo (PiP) com Filtro Aplicado */}
                <div className="absolute bottom-32 right-4 w-32 h-48 bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 pointer-events-auto transition-all">
                    <video 
                        ref={localVideoRef} 
                        autoPlay 
                        muted 
                        playsInline 
                        className="w-full h-full object-cover"
                        style={{ 
                            transform: 'scaleX(-1)',
                            filter: selectedFilter.filter 
                        }}
                        key={localStream ? localStream.id : 'local-waiting'}
                    />
                    <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-black text-white border border-white/10">VOCÊ</div>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        switch (activeCall.status) {
            case 'ringing-outgoing':
                return (
                    <div className="text-center">
                        <img src={otherUser.avatar} alt={otherUser.username} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-zinc-700 animate-pulse object-cover" />
                        <h3 className="text-xl font-semibold">{t('call.calling', { username: otherUser.username })}</h3>
                        {isVideoCall && <p className="text-xs text-sky-500 font-semibold mt-1 uppercase">{t('call.videoCall')}</p>}
                        <p className="text-sm text-zinc-400 mt-2">{t('call.callInProgress')}</p>
                        <Button onClick={() => hangUp()} className="w-full mt-10 !bg-red-600 hover:!bg-red-700">{t('call.hangUp')}</Button>
                        {isVideoCall && localStream && (
                            <div className="mt-4 w-32 h-48 mx-auto bg-black rounded-lg overflow-hidden border border-zinc-700">
                                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                            </div>
                        )}
                    </div>
                );
            case 'ringing-incoming':
                return (
                    <div className="text-center">
                        <img src={otherUser.avatar} alt={otherUser.username} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-zinc-700 animate-pulse object-cover" />
                        <h3 className="text-xl font-semibold">{isVideoCall ? t('call.incomingVideoCall') : t('call.incomingCall', { username: otherUser.username })}</h3>
                        <div className="mt-6 grid grid-cols-2 gap-4">
                            <Button onClick={declineCall} className="!bg-red-600 hover:!bg-red-700">{t('call.decline')}</Button>
                            <Button onClick={answerCall} className="!bg-green-600 hover:!bg-green-700">{t('call.answer')}</Button>
                        </div>
                    </div>
                );
            case 'connected':
                return (
                     <div className="text-center">
                        <img src={otherUser.avatar} alt={otherUser.username} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-green-500 object-cover" />
                        <h3 className="text-xl font-semibold">{t('call.onCallWith', { username: otherUser.username })}</h3>
                        <CallTimer />
                        <Button onClick={() => hangUp()} className="w-full mt-10 !bg-red-600 hover:!bg-red-700">{t('call.hangUp')}</Button>
                    </div>
                );
            case 'ended':
                return (
                    <div className="text-center">
                         <img src={otherUser.avatar} alt={otherUser.username} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-zinc-700 object-cover" />
                        <h3 className="text-xl font-semibold">{t('call.callEnded')}</h3>
                    </div>
                );
            case 'declined':
                 return (
                    <div className="text-center">
                         <img src={otherUser.avatar} alt={otherUser.username} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-zinc-700 object-cover" />
                        <h3 className="text-xl font-semibold">{t('call.callDeclined', { username: otherUser.username })}</h3>
                    </div>
                );
            case 'cancelled':
                return (
                     <div className="text-center">
                        <img src={otherUser.avatar} alt={otherUser.username} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-zinc-700 object-cover" />
                        <h3 className="text-xl font-semibold">{t('call.callCancelled')}</h3>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[100]" aria-modal="true" role="dialog">
            <div className="bg-zinc-900 text-white rounded-3xl shadow-2xl w-full max-w-sm p-6 border border-white/10">
                {renderContent()}
            </div>
            {!isVideoCall && (
                <>
                    <audio ref={localAudioRef} autoPlay muted playsInline></audio>
                    <audio ref={remoteAudioRef} autoPlay playsInline></audio>
                </>
            )}
        </div>
    );
};

export default CallUI;
