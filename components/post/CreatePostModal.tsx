
import React, { useState, useEffect } from 'react';
import { auth, db, storage, addDoc, collection, serverTimestamp, storageRef, uploadString, getDownloadURL } from '../../firebase';
import Button from '../common/Button';
import TextAreaInput from '../common/TextAreaInput';
import { useLanguage } from '../../context/LanguageContext';

interface GalleryImage {
    file: File;
    preview: string;
}

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
  initialImages?: GalleryImage[] | null;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ isOpen, onClose, onPostCreated, initialImages }) => {
    const { t } = useLanguage();
    const [caption, setCaption] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [images, setImages] = useState<GalleryImage[]>([]);

    useEffect(() => {
        if (isOpen && initialImages) setImages(initialImages);
        if (!isOpen) { setCaption(''); setImages([]); }
    }, [isOpen, initialImages]);

    const handleSubmit = async () => {
        if (images.length === 0 || submitting) return;
        setSubmitting(true);
        try {
            const mediaUrls = await Promise.all(images.map(async (img) => {
                const ref = storageRef(storage, `posts/${auth.currentUser?.uid}/${Date.now()}-${img.file.name}`);
                await uploadString(ref, img.preview, 'data_url');
                return { url: await getDownloadURL(ref), type: img.file.type.startsWith('video/') ? 'video' : 'image' };
            }));

            await addDoc(collection(db, 'posts'), {
                userId: auth.currentUser?.uid,
                username: auth.currentUser?.displayName,
                userAvatar: auth.currentUser?.photoURL,
                media: mediaUrls,
                imageUrl: mediaUrls[0].url, // Compatibilidade com código antigo
                caption,
                likes: [],
                timestamp: serverTimestamp(),
            });
            onPostCreated();
        } catch (e) { console.error(e); }
        setSubmitting(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-black rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-zinc-800 flex justify-between items-center">
                    <h2 className="text-lg font-semibold">{t('createPost.title')}</h2>
                    <Button onClick={handleSubmit} disabled={submitting} className="!w-auto !py-1 !px-4 !text-sm">
                        {submitting ? t('createPost.sharing') : t('createPost.share')}
                    </Button>
                </header>
                <div className="flex-grow overflow-y-auto p-4 flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-1/2 grid grid-cols-2 gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg">
                        {images.map((img, i) => (
                            <div key={i} className="aspect-square relative">
                                {img.file.type.startsWith('video/') ? <video src={img.preview} className="w-full h-full object-cover" /> : <img src={img.preview} className="w-full h-full object-cover" />}
                            </div>
                        ))}
                    </div>
                    <div className="w-full md:w-1/2 flex flex-col gap-4">
                        <TextAreaInput label={t('createPost.captionLabel')} value={caption} onChange={e => setCaption(e.target.value)} id="post-caption" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreatePostModal;
