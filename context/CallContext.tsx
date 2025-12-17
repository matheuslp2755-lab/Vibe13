
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
    liveStream: MediaStream | null; 
    startLive: () => Promise<void>;
    joinLive: (liveId: string, host: UserInfo) => void;
    endLive: () => Promise<void>;
    leaveLive: () => void;
    // Global Audio Pref
    isGlobalMuted: boolean;
    setGlobalMuted: (muted: boolean) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isGlobalMuted, setIsGlobalMuted] = useState(true);
    const pc = useRef<RTCPeerConnection | null>(null);
    const candidatesQueue = useRef<RTCIceCandidate[]>([]);

    const [activeLive, setActiveLive] = useState<LiveSession | null>(null);
    const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
    
    const hostConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
    const viewerPC = useRef<RTCPeerConnection | null>(null);
    const liveUnsubs = useRef<Unsubscribe[]>([]);

    const activeCallRef = useRef(activeCall);
    useEffect(() => {
        activeCallRef.current = activeCall;
    }, [activeCall]);

    const resetCallState = useCallback(() => {
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

    useEffect(() => {
        const currentUser = auth.currentUser;
        if (!activeCall?.callId || !pc.current || !currentUser) return;
        
        const callId = activeCall.callId;
        const callDocRef = doc(db, 'calls', callId);
        const unsubs: Unsubscribe[] = [];

        unsubs.push(onSnapshot(callDocRef, async (snapshot) => {
            const data = snapshot.data();
            if (!data) { resetCallState(); return; };
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
                    while (candidatesQueue.current.length > 0) {
                        const candidate = candidatesQueue.current.shift();
                        if (candidate) pc.current.addIceCandidate(candidate).catch(console.warn);
                    }
                } catch (e) { console.error(e); }
            }
        }));
        
        const isCaller = activeCall.caller.id === currentUser.uid;
        const candidatesCollection = collection(db, 'calls', callId, isCaller ? 'receiverCandidates' : 'callerCandidates');
        unsubs.push(onSnapshot(candidatesCollection, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    try {
                        const candidate = new RTCIceCandidate(change.doc.data());
                        if (pc.current && pc.current.remoteDescription) {
                            pc.current.addIceCandidate(candidate).catch(console.error);
                        } else { candidatesQueue.current.push(candidate); }
                    } catch (e) { console.warn("Invalid ICE candidate"); }
                }
            });
        }));
        return () => { unsubs.forEach(unsub => unsub()); };
    }, [activeCall, resetCallState]);
    
    const setupPeerConnection = (stream: MediaStream, callId: string, isCaller: boolean) => {
        pc.current = new RTCPeerConnection(servers);
        stream.getTracks().forEach(track => pc.current?.addTrack(track, stream));
        pc.current.onicecandidate = event => {
            if (event.candidate) {
                const coll = collection(db, 'calls', callId, isCaller ? 'callerCandidates' : 'receiverCandidates');
                addDoc(coll, event.candidate.toJSON());
            }
        };
        pc.current.ontrack = event => { setRemoteStream(event.streams[0]); };
        pc.current.onconnectionstatechange = () => {
            if(pc.current && pc.current.connectionState === 'failed') setError("call.callError");
        };
    };

    const startCall = async (receiver: UserInfo, isVideo: boolean = false) => {
        const currentUser = auth.currentUser;
        if (!currentUser || activeCallRef.current) return;
        setError(null);
        try {
            const constraints = isVideo ? { audio: true, video: { facingMode: 'user' } } : { audio: true };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setLocalStream(stream);
            const callDocRef = await addDoc(collection(db, 'calls'), {
                callerId: currentUser.uid, callerUsername: currentUser.displayName, callerAvatar: currentUser.photoURL,
                receiverId: receiver.id, receiverUsername: receiver.username, receiverAvatar: receiver.avatar,
                status: 'ringing', type: isVideo ? 'video' : 'audio'
            });
            setupPeerConnection(stream, callDocRef.id, true);
            const offer = await pc.current!.createOffer();
            await pc.current!.setLocalDescription(offer);
            await updateDoc(callDocRef, { offer: { sdp: offer.sdp, type: offer.type } });
            setActiveCall({
                callId: callDocRef.id, caller: { id: currentUser.uid, username: currentUser.displayName || '', avatar: currentUser.photoURL || '' },
                receiver, status: 'ringing-outgoing', isVideo
            });
        } catch (err: any) { resetCallState(); setError("call.noMicrophone"); }
    };
    
    const setIncomingCall = (callData: any) => {
        setActiveCall({
            callId: callData.callId,
            caller: { id: callData.callerId, username: callData.callerUsername, avatar: callData.callerAvatar },
            receiver: { id: callData.receiverId, username: callData.receiverUsername, avatar: callData.receiverAvatar },
            status: 'ringing-incoming', isVideo: callData.type === 'video'
        });
    };

    const answerCall = async () => {
        const call = activeCallRef.current;
        if (!call || call.status !== 'ringing-incoming') return;
        try {
            const callDocSnap = await getDoc(doc(db, 'calls', call.callId));
            if (!callDocSnap.exists()) throw new Error("Call not found");
            const data = callDocSnap.data();
            const constraints = data.type === 'video' ? { audio: true, video: { facingMode: 'user' } } : { audio: true };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setLocalStream(stream);
            setupPeerConnection(stream, call.callId, false);
            await pc.current!.setRemoteDescription(new RTCSessionDescription(data.offer));
            while (candidatesQueue.current.length > 0) {
                const cand = candidatesQueue.current.shift();
                if (cand) pc.current!.addIceCandidate(cand).catch(console.error);
            }
            const answer = await pc.current!.createAnswer();
            await pc.current!.setLocalDescription(answer);
            await updateDoc(doc(db, 'calls', call.callId), { answer: { sdp: answer.sdp, type: answer.type }, status: 'connected' });
            setActiveCall(prev => prev ? ({ ...prev, status: 'connected', isVideo: data.type === 'video' }) : null);
        } catch (err: any) { resetCallState(); setError("call.callError"); }
    };
    
    const hangUp = useCallback(async (isCleanupOnly = false) => {
        const call = activeCallRef.current;
        if (call && !isCleanupOnly) {
            updateDoc(doc(db, 'calls', call.callId), { status: call.status === 'ringing-outgoing' ? 'cancelled' : 'ended' }).catch(() => {});
        }
        resetCallState();
    }, [resetCallState]);

    const declineCall = useCallback(async () => {
        const call = activeCallRef.current;
        if(call) await updateDoc(doc(db, 'calls', call.callId), { status: 'declined' });
        resetCallState();
    }, [resetCallState]);

    const cleanupLive = useCallback(() => {
        liveUnsubs.current.forEach(u => u());
        liveUnsubs.current = [];
        hostConnections.current.forEach(pc => pc.close());
        hostConnections.current.clear();
        if (viewerPC.current) { viewerPC.current.close(); viewerPC.current = null; }
        if (localStream) { localStream.getTracks().forEach(t => t.stop()); setLocalStream(null); }
        setLiveStream(null); setActiveLive(null);
    }, [localStream]);

    const startLive = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
            setLocalStream(stream);
            const liveDocRef = await addDoc(collection(db, 'live_sessions'), {
                hostId: currentUser.uid, hostUsername: currentUser.displayName, hostAvatar: currentUser.photoURL,
                status: 'live', startedAt: serverTimestamp(),
            });
            setActiveLive({
                liveId: liveDocRef.id, host: { id: currentUser.uid, username: currentUser.displayName || '', avatar: currentUser.photoURL || '' },
                status: 'live', isHost: true
            });
            const unsubViewers = onSnapshot(collection(db, 'live_sessions', liveDocRef.id, 'viewers'), (snapshot) => {
                snapshot.docChanges().forEach(async (change) => {
                    if (change.type === 'added') {
                        const viewerId = change.doc.id;
                        const data = change.doc.data();
                        if (data.offer) {
                            const pc = new RTCPeerConnection(servers);
                            hostConnections.current.set(viewerId, pc);
                            const q = [];
                            stream.getTracks().forEach(track => pc.addTrack(track, stream));
                            const unsubCandidates = onSnapshot(collection(db, 'live_sessions', liveDocRef.id, 'viewers', viewerId, 'candidates'), (snap) => {
                                snap.docChanges().forEach((c) => {
                                    if (c.type === 'added') {
                                        const candidate = new RTCIceCandidate(c.doc.data());
                                        if (pc.remoteDescription) pc.addIceCandidate(candidate).catch(console.error);
                                        else q.push(candidate);
                                    }
                                });
                            });
                            liveUnsubs.current.push(unsubCandidates);
                            pc.onicecandidate = (event) => {
                                if (event.candidate) {
                                    const hostCandColl = collection(db, 'live_sessions', liveDocRef.id, 'viewers', viewerId, 'hostCandidates');
                                    addDoc(hostCandColl, event.candidate.toJSON());
                                }
                            };
                            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                            while (q.length > 0) pc.addIceCandidate(q.shift()!).catch(console.error);
                            const answer = await pc.createAnswer();
                            await pc.setLocalDescription(answer);
                            await updateDoc(doc(db, 'live_sessions', liveDocRef.id, 'viewers', viewerId), {
                                answer: { type: answer.type, sdp: answer.sdp }
                            });
                        }
                    }
                });
            });
            liveUnsubs.current.push(unsubViewers);
        } catch (err: any) { cleanupLive(); setError("live.error"); }
    };

    const joinLive = async (liveId: string, host: UserInfo) => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        setActiveLive({ liveId, host, status: 'live', isHost: false });
        try {
            const pc = new RTCPeerConnection(servers);
            viewerPC.current = pc;
            const q: RTCIceCandidate[] = [];
            pc.ontrack = (event) => { setLiveStream(event.streams[0]); };
            const viewerDocRef = doc(db, 'live_sessions', liveId, 'viewers', currentUser.uid);
            pc.onicecandidate = (event) => {
                if (event.candidate) addDoc(collection(viewerDocRef, 'candidates'), event.candidate.toJSON());
            };
            pc.addTransceiver('video', { direction: 'recvonly' });
            pc.addTransceiver('audio', { direction: 'recvonly' });
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await setDoc(viewerDocRef, { userId: currentUser.uid, username: currentUser.displayName, offer: { type: offer.type, sdp: offer.sdp } });
            liveUnsubs.current.push(onSnapshot(viewerDocRef, async (snap) => {
                const data = snap.data();
                if (data?.answer && !pc.currentRemoteDescription) {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                    while (q.length > 0) pc.addIceCandidate(q.shift()!).catch(console.error);
                }
            }));
            liveUnsubs.current.push(onSnapshot(collection(viewerDocRef, 'hostCandidates'), (snap) => {
                snap.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const candidate = new RTCIceCandidate(change.doc.data());
                        if (pc.remoteDescription) pc.addIceCandidate(candidate).catch(console.error);
                        else q.push(candidate);
                    }
                });
            }));
        } catch (err) { setError("live.error"); }
    };

    const endLive = async () => {
        if (!activeLive || !activeLive.isHost) return;
        try { await deleteDoc(doc(db, 'live_sessions', activeLive.liveId)); } catch (err) { console.error(err); }
        cleanupLive();
    };

    const leaveLive = () => {
        if (activeLive && !activeLive.isHost && auth.currentUser) {
            deleteDoc(doc(db, 'live_sessions', activeLive.liveId, 'viewers', auth.currentUser.uid)).catch(console.error);
        }
        cleanupLive();
    };

    useEffect(() => {
        const handleBeforeUnload = () => {
            if (activeCallRef.current) hangUp();
            if (activeLive) { if (activeLive.isHost) endLive(); else leaveLive(); }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hangUp, activeLive]);

    const value = {
        activeCall, localStream, remoteStream, startCall, answerCall, hangUp, declineCall, setIncomingCall, error,
        activeLive, liveStream, startLive, joinLive, endLive, leaveLive,
        isGlobalMuted, setGlobalMuted: (muted: boolean) => setIsGlobalMuted(muted)
    };

    return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export const useCall = (): CallContextType => {
    const context = useContext(CallContext);
    if (!context) throw new Error('useCall must be used within a CallProvider');
    return context;
};
