
import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';
import Button from '../common/Button';

interface LiveViewerModalProps {
    isOpen: boolean;
}

const LiveViewerModal: React.FC<LiveViewerModalProps> = ({ isOpen }) => {
    const { t } = useLanguage();
    const { activeLive, leaveLive, endLive, localStream } = useCall();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [viewerCount, setViewerCount] = useState(1); // Mocked for now

    // For Host: Show local stream
    // For Viewer: In a real app, this would be remoteStream. 
    // Since we simplified WebRTC to 1-to-1 in CallContext, a full broadcast isn't implemented.
    // For this UI demo, if you are the host, you see yourself. 
    // If you are a viewer, we will show a placeholder or try to reuse the logic if connection existed.
    // Given constraints, the Viewer will see a "Connecting..." or placeholder if not the host.

    useEffect(() => {
        if (activeLive?.isHost && localStream && videoRef.current) {
            videoRef.current.srcObject = localStream;
        }
    }, [activeLive, localStream]);

    // Mock viewer count update
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            setViewerCount(prev => Math.max(1, prev + Math.floor(Math.random() * 3) - 1));
        }, 3000);
        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen && (!activeLive || !activeLive.isHost)) return null;
    if (!activeLive) return null;

    return (
        <div className="fixed inset-0 bg-black z-[70] flex flex-col">
            <div className="relative flex-grow bg-zinc-900">
                {activeLive.isHost ? (
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        muted 
                        playsInline 
                        className="w-full h-full object-cover mirrored"
                        style={{ transform: 'scaleX(-1)' }}
                    />
                ) : (
                    // Viewer View Placeholder (since actual 1-to-many WebRTC is complex)
                    <div className="w-full h-full flex flex-col items-center justify-center text-white">
                        <img 
                            src={activeLive.host.avatar} 
                            alt={activeLive.host.username} 
                            className="w-24 h-24 rounded-full mb-4 border-4 border-red-500 animate-pulse"
                        />
                        <h2 className="text-xl font-bold">{activeLive.host.username}</h2>
                        <div className="mt-4 px-4 py-2 bg-red-600 rounded text-sm font-bold animate-pulse">
                            {t('pulseBar.live')}
                        </div>
                        <p className="mt-4 text-zinc-400 text-sm max-w-xs text-center">
                            (Transmissão de vídeo real requer infraestrutura de servidor de mídia)
                        </p>
                    </div>
                )}

                {/* Overlays */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                    <div className="bg-red-600 px-2 py-1 rounded text-white text-xs font-bold">
                        {t('pulseBar.live')}
                    </div>
                    <div className="bg-black/50 px-2 py-1 rounded text-white text-xs flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        {viewerCount}
                    </div>
                </div>

                <button 
                    onClick={activeLive.isHost ? endLive : leaveLive}
                    className="absolute top-4 right-4 z-20 text-white text-3xl font-light hover:text-red-500 transition-colors"
                >
                    &times;
                </button>

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="flex items-center gap-3">
                        <img src={activeLive.host.avatar} alt={activeLive.host.username} className="w-10 h-10 rounded-full border border-white/50" />
                        <div className="text-white">
                            <p className="font-semibold text-sm">{activeLive.host.username}</p>
                        </div>
                    </div>
                    
                    {activeLive.isHost && (
                        <div className="mt-4">
                            <Button 
                                onClick={endLive} 
                                className="!bg-red-600 hover:!bg-red-700 !w-full !rounded-full"
                            >
                                {t('live.end')}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveViewerModal;
