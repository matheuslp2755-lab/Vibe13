
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { auth, db, doc, addDoc, collection, onSnapshot, updateDoc, getDoc, deleteDoc, serverTimestamp, setDoc } from '../firebase';
import type { Unsubscribe } from 'firebase/firestore';

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
    activeLive: LiveSession | null;
    liveStream: MediaStream | null; 
    startLive: () => Promise<void>;
    joinLive: (liveId: string, host: UserInfo) => void;
    endLive: () => Promise<void>;
    leaveLive: () => void;
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
            pc.current = new RTCPeerConnection(servers);
            stream.getTracks().forEach(track => pc.current?.addTrack(track, stream));
            pc.current.onicecandidate = event => {
                if (event.candidate) {
                    const coll = collection(db, 'calls', callDocRef.id, 'callerCandidates');
                    addDoc(coll, event.candidate.toJSON());
                }
            };
            pc.current.ontrack = event => { setRemoteStream(event.streams[0]); };
            const offer = await pc.current.createOffer();
            await pc.current.setLocalDescription(offer);
            await updateDoc(callDocRef, { offer: { sdp: offer.sdp, type: offer.type } });
            setActiveCall({
                callId: callDocRef.id, caller: { id: currentUser.uid, username: currentUser.displayName || '', avatar: currentUser.photoURL || '' },
                receiver, status: 'ringing-outgoing', isVideo
            });
        } catch (err: any) { resetCallState(); setError("call.noMicrophone"); }
    };
    
    const answerCall = async () => {
        const call = activeCallRef.current;
        if (!call || call.status !== 'ringing-incoming') return;
        try {
            const callDocSnap = await getDoc(doc(db, 'calls', call.callId));
            const data = callDocSnap.data();
            const constraints = data.type === 'video' ? { audio: true, video: { facingMode: 'user' } } : { audio: true };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setLocalStream(stream);
            pc.current = new RTCPeerConnection(servers);
            stream.getTracks().forEach(track => pc.current?.addTrack(track, stream));
            pc.current.onicecandidate = event => {
                if (event.candidate) {
                    const coll = collection(db, 'calls', call.callId, 'receiverCandidates');
                    addDoc(coll, event.candidate.toJSON());
                }
            };
            pc.current.ontrack = event => { setRemoteStream(event.streams[0]); };
            await pc.current.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            await updateDoc(doc(db, 'calls', call.callId), { answer: { sdp: answer.sdp, type: answer.type }, status: 'connected' });
            setActiveCall(prev => prev ? ({ ...prev, status: 'connected' }) : null);
        } catch (err: any) { resetCallState(); setError("call.callError"); }
    };
    
    const hangUp = useCallback(async (isCleanupOnly = false) => {
        const call = activeCallRef.current;
        if (call && !isCleanupOnly) {
            updateDoc(doc(db, 'calls', call.callId), { status: 'ended' }).catch(() => {});
        }
        resetCallState();
    }, [resetCallState]);

    const declineCall = useCallback(async () => {
        const call = activeCallRef.current;
        if(call) await updateDoc(doc(db, 'calls', call.callId), { status: 'declined' });
        resetCallState();
    }, [resetCallState]);

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
        } catch (err: any) { setError("live.error"); }
    };

    const joinLive = (liveId: string, host: UserInfo) => {
        setActiveLive({ liveId, host, status: 'live', isHost: false });
    };

    const endLive = async () => {
        if (!activeLive || !activeLive.isHost) return;
        await deleteDoc(doc(db, 'live_sessions', activeLive.liveId));
        setActiveLive(null);
        if (localStream) localStream.getTracks().forEach(t => t.stop());
    };

    const leaveLive = () => {
        setActiveLive(null);
    };

    const value = {
        activeCall, localStream, remoteStream, startCall, answerCall, hangUp, declineCall, setIncomingCall: setActiveCall, error,
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
