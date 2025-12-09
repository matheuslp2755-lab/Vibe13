
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { auth, db, doc, addDoc, collection, onSnapshot, updateDoc, getDoc, deleteDoc, serverTimestamp, setDoc } from '../firebase';
import type { Unsubscribe } from 'firebase/firestore';

// WebRTC configuration - using public STUN servers
const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

type CallStatus = 'idle' | 'ringing-outgoing' | 'ringing-incoming' | 'connected' | 'ended' | 'declined' | 'cancelled';

interface UserInfo {
    id: string;
    username: string;
    avatar: string;
}

interface ActiveCall {
    callId: string;
    caller: UserInfo;
    receiver: UserInfo;
    status: CallStatus;
    isVideo: boolean;
}

interface LiveSession {
    liveId: string;
    host: UserInfo;
    status: 'live' | 'ended';
    isHost: boolean;
}

interface CallContextType {
    activeCall: ActiveCall | null;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    startCall: (receiver: UserInfo, isVideo?: boolean) => Promise<void>;
    answerCall: () => Promise<void>;
    hangUp: (isCleanupOnly?: boolean) => Promise<void>;
    declineCall: () => Promise<void>;
    setIncomingCall: (callData: any) => void;
    error: string | null;
    // Live Streaming
    activeLive: LiveSession | null;
    liveStream: MediaStream | null; // Stream for viewers
    startLive: () => Promise<void>;
    joinLive: (liveId: string, host: UserInfo) => void;
    endLive: () => Promise<void>;
    leaveLive: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // 1:1 Call State
    const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const pc = useRef<RTCPeerConnection | null>(null);
    const candidatesQueue = useRef<RTCIceCandidate[]>([]);

    // Live Streaming State
    const [activeLive, setActiveLive] = useState<LiveSession | null>(null);
    const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
    
    // Host side: Keep track of all viewer connections (Mesh topology)
    const hostConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
    // Viewer side: Single connection to host
    const viewerPC = useRef<RTCPeerConnection | null>(null);
    
    const liveUnsubs = useRef<Unsubscribe[]>([]);

    const activeCallRef = useRef(activeCall);
    useEffect(() => {
        activeCallRef.current = activeCall;
    }, [activeCall]);


    const resetCallState = useCallback(() => {
        console.log("Resetting call state.");
        if (pc.current) {
            pc.current.close();
            pc.current = null;
        }
        candidatesQueue.current = [];
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        setRemoteStream(null);
        setActiveCall(null);
        setError(null);
    }, [localStream]);

    // --- 1:1 Call Logic (Existing) ---
    // (Kept mostly as is, but ensuring it doesn't conflict with Live)
    useEffect(() => {
        const currentUser = auth.currentUser;
        if (!activeCall?.callId || !pc.current || !currentUser) return;
        
        const callId = activeCall.callId;
        const callDocRef = doc(db, 'calls', callId);
        
        const unsubs: Unsubscribe[] = [];

        unsubs.push(onSnapshot(callDocRef, async (snapshot) => {
            const data = snapshot.data();
            if (!data) {
                resetCallState();
                return;
            };
            const status = data.status as CallStatus;

            if (['ended', 'declined', 'cancelled'].includes(status) && activeCallRef.current?.status !== status) {
                 setActiveCall(prev => prev ? { ...prev, status } : null);
                 return;
            }
            if (status === 'connected' && activeCallRef.current?.status !== 'connected') {
                setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
            }
            if (data.answer && pc.current?.remoteDescription?.type !== 'answer') {
                try {
                    await pc.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                    // Flush queued candidates
                    while (candidatesQueue.current.length > 0) {
                        const candidate = candidatesQueue.current.shift();
                        if (candidate) {
                            pc.current.addIceCandidate(candidate).catch(e => console.warn("Error adding queued candidate:", e));
                        }
                    }
                } catch (e) {
                    console.error("Error setting remote description.", e);
                }
            }
        }));
        
        const isCaller = activeCall.caller.id === currentUser.uid;
        const candidatesCollectionName = isCaller ? 'receiverCandidates' : 'callerCandidates';
        const candidatesCollection = collection(db, 'calls', callId, candidatesCollectionName);
        
        unsubs.push(onSnapshot(candidatesCollection, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    try {
                        const candidate = new RTCIceCandidate(change.doc.data());
                        if (pc.current && pc.current.remoteDescription) {
                            pc.current.addIceCandidate(candidate).catch(console.error);
                        } else {
                            candidatesQueue.current.push(candidate);
                        }
                    } catch (e) {
                        console.warn("Invalid ICE candidate");
                    }
                }
            });
        }));

        return () => {
            unsubs.forEach(unsub => unsub());
        };
    }, [activeCall, resetCallState]);
    
    const setupPeerConnection = (stream: MediaStream, callId: string, isCaller: boolean) => {
        pc.current = new RTCPeerConnection(servers);
        stream.getTracks().forEach(track => pc.current?.addTrack(track, stream));
    
        pc.current.onicecandidate = event => {
            if (event.candidate) {
                const candidatesCollection = collection(db, 'calls', callId, isCaller ? 'callerCandidates' : 'receiverCandidates');
                addDoc(candidatesCollection, event.candidate.toJSON());
            }
        };
    
        pc.current.ontrack = event => {
            setRemoteStream(event.streams[0]);
        };
    
        pc.current.onconnectionstatechange = () => {
            if(pc.current && pc.current.connectionState === 'failed') setError("call.callError");
        };
    };

    const startCall = async (receiver: UserInfo, isVideo: boolean = false) => {
        const currentUser = auth.currentUser;
        if (!currentUser || activeCallRef.current) return;
        setError(null);
        candidatesQueue.current = [];
        
        try {
            const constraints = isVideo ? { audio: true, video: { facingMode: 'user' } } : { audio: true };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setLocalStream(stream);
            
            const callDocRef = await addDoc(collection(db, 'calls'), {
                callerId: currentUser.uid,
                callerUsername: currentUser.displayName,
                callerAvatar: currentUser.photoURL,
                receiverId: receiver.id,
                receiverUsername: receiver.username,
                receiverAvatar: receiver.avatar,
                status: 'ringing',
                type: isVideo ? 'video' : 'audio'
            });
            const callId = callDocRef.id;
            
            setupPeerConnection(stream, callId, true);
            
            const offerDescription = await pc.current!.createOffer();
            await pc.current!.setLocalDescription(offerDescription);

            await updateDoc(callDocRef, { offer: { sdp: offerDescription.sdp, type: offerDescription.type } });

            setActiveCall({
                callId,
                caller: { id: currentUser.uid, username: currentUser.displayName || '', avatar: currentUser.photoURL || '' },
                receiver,
                status: 'ringing-outgoing',
                isVideo
            });
        } catch (err: any) {
            console.error("Error starting call:", err);
            resetCallState();
            setError("call.noMicrophone");
        }
    };
    
    const setIncomingCall = (callData: any) => {
        setActiveCall({
            callId: callData.callId,
            caller: { id: callData.callerId, username: callData.callerUsername, avatar: callData.callerAvatar },
            receiver: { id: callData.receiverId, username: callData.receiverUsername, avatar: callData.receiverAvatar },
            status: 'ringing-incoming',
            isVideo: callData.type === 'video'
        });
    };

    const answerCall = async () => {
        const call = activeCallRef.current;
        if (!call || call.status !== 'ringing-incoming') return;
        setError(null);
        candidatesQueue.current = [];
        
        try {
            const callDocRef = doc(db, 'calls', call.callId);
            const callDocSnap = await getDoc(callDocRef);
            if (!callDocSnap.exists()) throw new Error("Call not found");
            
            const callData = callDocSnap.data();
            const isVideo = callData.type === 'video';
            const constraints = isVideo ? { audio: true, video: { facingMode: 'user' } } : { audio: true };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setLocalStream(stream);

            setupPeerConnection(stream, call.callId, false);
            
            await pc.current!.setRemoteDescription(new RTCSessionDescription(callData.offer));
            // Queue should be processed here if any (though usually empty for receiver at this point if useEffect hasn't run)
             while (candidatesQueue.current.length > 0) {
                const candidate = candidatesQueue.current.shift();
                if (candidate) {
                    pc.current!.addIceCandidate(candidate).catch(console.error);
                }
            }

            const answerDescription = await pc.current!.createAnswer();
            await pc.current!.setLocalDescription(answerDescription);

            await updateDoc(callDocRef, { answer: { sdp: answerDescription.sdp, type: answerDescription.type }, status: 'connected' });
            
            setActiveCall(prev => prev ? ({ ...prev, status: 'connected', isVideo }) : null);

        } catch (err: any) {
            console.error("Error answering call:", err);
            resetCallState();
            setError("call.callError");
        }
    };
    
    const hangUp = useCallback(async (isCleanupOnly = false) => {
        const call = activeCallRef.current;
        if (call && !isCleanupOnly) {
            const callDocRef = doc(db, 'calls', call.callId);
            // Fire and forget update to prevent hanging UI
            updateDoc(callDocRef, { status: call.status === 'ringing-outgoing' ? 'cancelled' : 'ended' }).catch(() => {});
        }
        resetCallState();
    }, [resetCallState]);

    const declineCall = useCallback(async () => {
        const call = activeCallRef.current;
        if(call) {
            const callDocRef = doc(db, 'calls', call.callId);
            await updateDoc(callDocRef, { status: 'declined' });
        }
        resetCallState();
    }, [resetCallState]);

    // --- Live Streaming Logic (Mesh Topology) ---

    // Clean up live listeners and connections
    const cleanupLive = useCallback(() => {
        liveUnsubs.current.forEach(u => u());
        liveUnsubs.current = [];
        
        // Host cleanup
        hostConnections.current.forEach(pc => pc.close());
        hostConnections.current.clear();

        // Viewer cleanup
        if (viewerPC.current) {
            viewerPC.current.close();
            viewerPC.current = null;
        }

        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
            setLocalStream(null);
        }
        
        setLiveStream(null);
        setActiveLive(null);
    }, [localStream]);

    const startLive = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
            setLocalStream(stream);

            // Renamed collection to 'live_sessions' to clear old lives
            const liveDocRef = await addDoc(collection(db, 'live_sessions'), {
                hostId: currentUser.uid,
                hostUsername: currentUser.displayName,
                hostAvatar: currentUser.photoURL,
                status: 'live',
                startedAt: serverTimestamp(),
            });

            setActiveLive({
                liveId: liveDocRef.id,
                host: { id: currentUser.uid, username: currentUser.displayName || '', avatar: currentUser.photoURL || '' },
                status: 'live',
                isHost: true
            });

            // HOST LOGIC: Listen for new viewers in 'viewers' subcollection
            const viewersCollection = collection(db, 'live_sessions', liveDocRef.id, 'viewers');
            const unsubViewers = onSnapshot(viewersCollection, (snapshot) => {
                snapshot.docChanges().forEach(async (change) => {
                    if (change.type === 'added') {
                        const viewerId = change.doc.id;
                        const data = change.doc.data();
                        
                        if (data.offer) {
                            console.log(`Host: New viewer ${viewerId} joined. Creating PC.`);
                            const pc = new RTCPeerConnection(servers);
                            hostConnections.current.set(viewerId, pc);
                            const candidateQueue: RTCIceCandidate[] = [];

                            // Add local tracks to this viewer's PC
                            stream.getTracks().forEach(track => pc.addTrack(track, stream));

                            // Handle ICE candidates from Viewer
                            const candidatesColl = collection(db, 'live_sessions', liveDocRef.id, 'viewers', viewerId, 'candidates');
                            const unsubCandidates = onSnapshot(candidatesColl, (candSnap) => {
                                candSnap.docChanges().forEach((cChange) => {
                                    if (cChange.type === 'added') {
                                        const candData = cChange.doc.data();
                                        const candidate = new RTCIceCandidate(candData);
                                        if (pc.remoteDescription) {
                                            pc.addIceCandidate(candidate).catch(console.error);
                                        } else {
                                            candidateQueue.push(candidate);
                                        }
                                    }
                                });
                            });
                            liveUnsubs.current.push(unsubCandidates);

                            // Send Host ICE candidates to Viewer
                            pc.onicecandidate = (event) => {
                                if (event.candidate) {
                                    // Viewer listens to this specific doc update or subcollection?
                                    // Let's put host candidates in the main viewer doc for simplicity or a 'hostCandidates' subcol
                                    const hostCandColl = collection(db, 'live_sessions', liveDocRef.id, 'viewers', viewerId, 'hostCandidates');
                                    addDoc(hostCandColl, event.candidate.toJSON());
                                }
                            };

                            // Set Remote Desc (Viewer's Offer)
                            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                            
                            // Process queued candidates
                            while (candidateQueue.length > 0) {
                                pc.addIceCandidate(candidateQueue.shift()!).catch(console.error);
                            }
                            
                            // Create Answer
                            const answer = await pc.createAnswer();
                            await pc.setLocalDescription(answer);

                            // Send Answer back to Viewer
                            await updateDoc(doc(db, 'live_sessions', liveDocRef.id, 'viewers', viewerId), {
                                answer: { type: answer.type, sdp: answer.sdp }
                            });
                        }
                    }
                });
            });
            liveUnsubs.current.push(unsubViewers);

        } catch (err: any) {
            console.error("Error starting live:", err);
            cleanupLive();
            setError("live.error");
        }
    };

    const joinLive = async (liveId: string, host: UserInfo) => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        setActiveLive({ liveId, host, status: 'live', isHost: false });

        try {
            const pc = new RTCPeerConnection(servers);
            viewerPC.current = pc;
            const candidateQueue: RTCIceCandidate[] = [];

            // Receive tracks from Host
            pc.ontrack = (event) => {
                console.log("Viewer: Received remote track from host.");
                setLiveStream(event.streams[0]);
            };

            // Create Viewer Document
            const viewerDocRef = doc(db, 'live_sessions', liveId, 'viewers', currentUser.uid);
            
            // Send ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    const candColl = collection(viewerDocRef, 'candidates');
                    addDoc(candColl, event.candidate.toJSON());
                }
            };

            // Add Transceiver (We want to receive video/audio)
            pc.addTransceiver('video', { direction: 'recvonly' });
            pc.addTransceiver('audio', { direction: 'recvonly' });

            // Create Offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Write Offer to Firestore
            await setDoc(viewerDocRef, {
                userId: currentUser.uid,
                username: currentUser.displayName,
                offer: { type: offer.type, sdp: offer.sdp }
            });

            // Listen for Answer and Host Candidates
            const unsubViewerDoc = onSnapshot(viewerDocRef, async (snapshot) => {
                const data = snapshot.data();
                if (data?.answer && !pc.currentRemoteDescription) {
                    console.log("Viewer: Received answer from host.");
                    const rtcSessionDescription = new RTCSessionDescription(data.answer);
                    await pc.setRemoteDescription(rtcSessionDescription);
                    
                    // Process queued candidates
                    while (candidateQueue.length > 0) {
                        pc.addIceCandidate(candidateQueue.shift()!).catch(console.error);
                    }
                }
            });
            liveUnsubs.current.push(unsubViewerDoc);

            const hostCandidatesColl = collection(viewerDocRef, 'hostCandidates');
            const unsubHostCand = onSnapshot(hostCandidatesColl, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        const candidate = new RTCIceCandidate(data);
                        if (pc.remoteDescription) {
                            pc.addIceCandidate(candidate).catch(console.error);
                        } else {
                            candidateQueue.push(candidate);
                        }
                    }
                });
            });
            liveUnsubs.current.push(unsubHostCand);

        } catch (err) {
            console.error("Error joining live:", err);
            setError("live.error");
        }
    };

    const endLive = async () => {
        if (!activeLive || !activeLive.isHost) return;
        try {
            const liveRef = doc(db, 'live_sessions', activeLive.liveId);
            // "Apagar" - Delete the document
            await deleteDoc(liveRef);
        } catch (err) { console.error(err); }
        cleanupLive();
    };

    const leaveLive = () => {
        if (activeLive && !activeLive.isHost) {
            // Remove viewer doc to be polite
            if (auth.currentUser) {
                deleteDoc(doc(db, 'live_sessions', activeLive.liveId, 'viewers', auth.currentUser.uid)).catch(console.error);
            }
        }
        cleanupLive();
    };

    // Auto-cleanup
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (activeCallRef.current) hangUp();
            if (activeLive) {
                if (activeLive.isHost) endLive();
                else leaveLive();
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hangUp, activeLive]);

    const value = {
        activeCall,
        localStream,
        remoteStream,
        startCall,
        answerCall,
        hangUp,
        declineCall,
        setIncomingCall,
        error,
        activeLive,
        liveStream, // Exported for the viewer modal
        startLive,
        joinLive,
        endLive,
        leaveLive
    };

    return (
        <CallContext.Provider value={value}>
            {children}
        </CallContext.Provider>
    );
};

export const useCall = (): CallContextType => {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error('useCall must be used within a CallProvider');
    }
    return context;
};
