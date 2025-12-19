
import React, { useState, useEffect, useRef } from 'react';
import { 
    auth, 
    db, 
    doc, 
    collection, 
    query, 
    orderBy, 
    onSnapshot, 
    writeBatch, 
    serverTimestamp, 
    deleteDoc, 
    updateDoc, 
    getDocs, 
    limit, 
    getDoc, 
    storage, 
    storageRef, 
    uploadString, 
    getDownloadURL, 
    uploadBytes,
    addDoc 
} from '../../firebase';
import ConnectionCrystal from './ConnectionCrystal';
import OnlineIndicator from '../common/OnlineIndicator';
import { useLanguage } from '../../context/LanguageContext';
import { useCall } from '../../context/CallContext';

interface ChatWindowProps {
    conversationId: string | null;
    onBack: () => void;
    isCurrentUserAnonymous: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ conversationId, onBack, isCurrentUserAnonymous }) => {
    const { t } = useLanguage();
    const { startCall } = useCall();
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [convData, setConvData] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    const currentUser = auth.currentUser;
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!conversationId) return;

        const unsubConv = onSnapshot(doc(db, 'conversations', conversationId), (snap) => {
            setConvData(snap.data());
        });

        const q = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('timestamp', 'asc'));
        const unsubMsgs = onSnapshot(q, (snap) => {
            setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => { unsubConv(); unsubMsgs(); };
    }, [conversationId]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !conversationId || !currentUser) return;

        const text = newMessage.trim();
        setNewMessage('');

        await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
            senderId: currentUser.uid,
            senderUsername: currentUser.displayName,
            senderAvatar: currentUser.photoURL,
            text,
            timestamp: serverTimestamp()
        });

        await updateDoc(doc(db, 'conversations', conversationId), {
            lastMessage: { text, senderId: currentUser.uid, timestamp: serverTimestamp() },
            timestamp: serverTimestamp()
        });
    };

    if (!conversationId || !convData) return null;

    const isGroup = convData.type === 'group';
    const otherUserId = convData.participants.find((p: string) => p !== currentUser?.uid);
    const otherUser = convData.participantInfo[otherUserId || ''];

    const handleStartCall = (isVideo: boolean) => {
        if (isGroup || !otherUserId || !otherUser) return;
        startCall({
            id: otherUserId,
            username: otherUser.username,
            avatar: otherUser.avatar
        }, isVideo);
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black animate-fade-in">
            <header className="flex items-center gap-3 p-4 border-b dark:border-zinc-800">
                <button onClick={onBack} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 19l-7-7 7-7"/></svg>
                </button>
                
                {isGroup ? (
                    <div className="flex -space-x-3">
                        {convData.participants.slice(0, 3).map((p: string) => (
                            <img key={p} src={convData.participantInfo[p]?.avatar} className="w-8 h-8 rounded-full border-2 border-white dark:border-black object-cover" />
                        ))}
                    </div>
                ) : (
                    <div className="relative">
                        <img src={otherUser?.avatar} className="w-10 h-10 rounded-full object-cover" />
                        <OnlineIndicator className="bottom-0 right-0 border-2 border-white dark:border-black h-3 w-3" />
                    </div>
                )}

                <div className="flex-grow">
                    <p className="font-black text-sm">{isGroup ? convData.name : otherUser?.username}</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">{isGroup ? `${convData.participants.length} participantes` : 'Visto recentemente'}</p>
                </div>

                {!isGroup && (
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => handleStartCall(false)}
                            className="p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                            title={t('call.voiceCall')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                        </button>
                        <button 
                            onClick={() => handleStartCall(true)}
                            className="p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                            title={t('call.videoCall')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                    </div>
                )}
            </header>

            <div className="flex-grow overflow-y-auto p-4 space-y-4 no-scrollbar">
                {messages.map(msg => {
                    const isMe = msg.senderId === currentUser?.uid;
                    return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            {!isMe && isGroup && <span className="text-[10px] font-black text-zinc-500 ml-1 mb-1">{msg.senderUsername}</span>}
                            <div className={`max-w-[75%] p-3 rounded-2xl text-sm font-medium ${isMe ? 'bg-sky-500 text-white rounded-tr-none' : 'bg-zinc-100 dark:bg-zinc-800 rounded-tl-none'}`}>
                                {msg.text}
                            </div>
                        </div>
                    );
                })}
                <div ref={scrollRef} />
            </div>

            <form onSubmit={handleSend} className="p-4 border-t dark:border-zinc-800 flex items-center gap-2">
                <input 
                    type="text" 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder={t('messages.messagePlaceholder')}
                    className="flex-grow bg-zinc-100 dark:bg-zinc-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-sky-500/20"
                />
                <button type="submit" className="p-3 text-sky-500 hover:scale-110 active:scale-95 transition-all">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                </button>
            </form>
        </div>
    );
};

export default ChatWindow;
