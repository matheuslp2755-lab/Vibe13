
import React, { useEffect, useRef } from 'react';
import { useCall } from '../../context/CallContext';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';
import { auth } from '../../firebase';

const CallTimer: React.FC = () => {
    const [seconds, setSeconds] = React.useState(0);

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

    useEffect(() => {
        if (!activeCall) return;

        // Handle Audio Streams (for both voice and video calls, though video tag handles audio too if present)
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

        // Handle Video Streams
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
                hangUp(true); // cleanup only
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

    // Separate Render Logic for Video Calls
    if (isVideoCall && activeCall.status === 'connected') {
        return (
            <div className="fixed inset-0 bg-black z-[100]" aria-modal="true" role="dialog">
                {/* Remote Video (Full Screen) */}
                <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                />
                
                {/* Controls Overlay */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
                    <div className="flex justify-between items-start pointer-events-auto">
                        <div className="bg-black/40 backdrop-blur-md p-2 rounded-lg text-white">
                            <h3 className="font-semibold shadow-black drop-shadow-md">{otherUser.username}</h3>
                            <CallTimer />
                        </div>
                    </div>

                    <div className="flex justify-center pointer-events-auto">
                        <Button onClick={() => hangUp()} className="!w-auto !bg-red-600 hover:!bg-red-700 rounded-full p-4 shadow-lg">
                            {/* Hangup Icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </Button>
                    </div>
                </div>

                {/* Local Video (PiP) */}
                <div className="absolute bottom-24 right-4 w-32 h-48 bg-zinc-900 rounded-lg overflow-hidden shadow-xl border border-zinc-700 pointer-events-auto">
                    <video 
                        ref={localVideoRef} 
                        autoPlay 
                        muted 
                        playsInline 
                        className="w-full h-full object-cover mirrored"
                        style={{ transform: 'scaleX(-1)' }}
                    />
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
                        {/* Preview Local Video if outgoing video call */}
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
            <div className="bg-zinc-900 text-white rounded-lg shadow-xl w-full max-w-sm p-6 border border-zinc-700">
                {renderContent()}
            </div>
            {/* Audio elements for WebRTC streams (Voice Call Fallback / Audio track handling) */}
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
