
import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';
import Button from '../common/Button';

interface LiveViewerModalProps {
    isOpen: boolean;
}

const LiveViewerModal: React.FC<LiveViewerModalProps> = ({ isOpen }) => {
    const { t } = useLanguage();
    const { activeLive, leaveLive, endLive, localStream, liveStream } = useCall();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [viewerCount, setViewerCount] = useState(1);

    // Effect to attach the correct stream to the video element
    useEffect(() => {
        if (!isOpen || !videoRef.current) return;

        if (activeLive?.isHost) {
            // Host sees their own local stream
            if (localStream) {
                videoRef.current.srcObject = localStream;
            }
        } else {
            // Viewer sees the remote live stream
            if (liveStream) {
                videoRef.current.srcObject = liveStream;
            }
        }
    }, [isOpen, activeLive, localStream, liveStream]);

    // Mock viewer count update (can be replaced with real-time count from Firestore later)
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            setViewerCount(prev => Math.max(1, prev + Math.floor(Math.random() * 3) - 1));
        }, 3000);
        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen || !activeLive) return null;

    const isLoading = !activeLive.isHost && !liveStream;

    return (
        <div className="fixed inset-0 bg-black z-[70] flex flex-col">
            <div className="relative flex-grow bg-zinc-900 flex items-center justify-center">
                {/* Video Element */}
                <video 
                    ref={videoRef} 
                    autoPlay 
                    muted={activeLive.isHost} // Host muted to prevent echo, Viewer unmuted
                    playsInline 
                    className={`w-full h-full object-cover ${activeLive.isHost ? 'mirrored' : ''}`}
                    style={activeLive.isHost ? { transform: 'scaleX(-1)' } : {}}
                />

                {/* Loading State for Viewers */}
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-10">
                        <img 
                            src={activeLive.host.avatar} 
                            alt={activeLive.host.username} 
                            className="w-24 h-24 rounded-full mb-4 border-4 border-red-500 animate-pulse object-cover"
                        />
                        <h2 className="text-xl font-bold text-white mb-2">{activeLive.host.username}</h2>
                        <div className="flex items-center gap-2 text-zinc-400">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce delay-75"></div>
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce delay-150"></div>
                            <span className="text-sm font-semibold">Conectando à transmissão...</span>
                        </div>
                    </div>
                )}

                {/* Overlays */}
                <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
                    <div className="bg-red-600 px-2 py-1 rounded text-white text-xs font-bold animate-pulse">
                        {t('pulseBar.live')}
                    </div>
                    <div className="bg-black/50 px-2 py-1 rounded text-white text-xs flex items-center gap-1 backdrop-blur-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        {viewerCount}
                    </div>
                </div>

                <button 
                    onClick={activeLive.isHost ? endLive : leaveLive}
                    className="absolute top-4 right-4 z-20 text-white text-3xl font-light hover:text-red-500 transition-colors drop-shadow-lg"
                >
                    &times;
                </button>

                {/* Bottom Info Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent z-20">
                    <div className="flex items-center gap-3">
                        <img src={activeLive.host.avatar} alt={activeLive.host.username} className="w-10 h-10 rounded-full border border-white/50 object-cover" />
                        <div className="text-white">
                            <p className="font-semibold text-sm">{activeLive.host.username}</p>
                            {!activeLive.isHost && <p className="text-xs text-zinc-300">Transmitindo ao vivo</p>}
                        </div>
                    </div>
                    
                    {activeLive.isHost && (
                        <div className="mt-4">
                            <Button 
                                onClick={endLive} 
                                className="!bg-red-600 hover:!bg-red-700 !w-full !rounded-full font-bold"
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
