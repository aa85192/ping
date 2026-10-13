import { collection, deleteDoc, doc, getFirestore, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { deleteObject, getBlob, getStorage, ref, updateMetadata, uploadBytesResumable } from 'firebase/storage';
import { idbDel, idbGet, idbPut } from '../lib/idb';
import { getFirebase } from './firebase';
import { newId } from './model';

export interface TripFile {
  id: string;
  name: string;
  contentType: string;
  size: number;
  /** true = only the uploader can see it (enforced by Firestore + Storage rules). */
  private: boolean;
  ownerUid: string;
  storagePath: string;
  note?: string | null;
  createdAt: number;
}

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ACCEPT = 'image/*,application/pdf';

async function services() {
  const { app, auth } = await getFirebase();
  return { db: getFirestore(app), storage: getStorage(app), uid: auth.currentUser?.uid ?? '' };
}

/**
 * Two queries because rules only let you list shared files plus your own;
 * a single unfiltered listener would be rejected once a private file exists.
 */
export function watchFiles(tripId: string, cb: (files: TripFile[]) => void, onError?: (e: Error) => void): () => void {
  let stop = () => {};
  let cancelled = false;
  void services().then(({ db, uid }) => {
    if (cancelled) return;
    const col = collection(db, 'trips', tripId, 'files');
    const shared = new Map<string, TripFile>();
    const mine = new Map<string, TripFile>();
    const emit = () => cb([...new Map([...shared, ...mine]).values()].sort((a, b) => b.createdAt - a.createdAt));
    const u1 = onSnapshot(query(col, where('private', '==', false)), (s) => {
      shared.clear();
      s.docs.forEach((d) => shared.set(d.id, d.data() as TripFile));
      emit();
    }, (e) => onError?.(e));
    const u2 = onSnapshot(query(col, where('ownerUid', '==', uid)), (s) => {
      mine.clear();
      s.docs.forEach((d) => mine.set(d.id, d.data() as TripFile));
      emit();
    }, (e) => onError?.(e));
    stop = () => {
      u1();
      u2();
    };
  });
  return () => {
    cancelled = true;
    stop();
  };
}

export async function uploadTripFile(tripId: string, file: File, isPrivate: boolean, onProgress: (pct: number) => void): Promise<void> {
  if (file.size > MAX_FILE_BYTES) throw new Error('檔案超過 20 MB');
  if (!/^image\//.test(file.type) && file.type !== 'application/pdf') throw new Error('只支援圖片和 PDF');
  const { db, storage, uid } = await services();
  const id = newId('f_');
  const safeName = file.name.replace(/[\\/#?[\]*]/g, '_').slice(0, 120) || 'file';
  const storagePath = `trips/${tripId}/files/${id}/${safeName}`;
  const task = uploadBytesResumable(ref(storage, storagePath), file, {
    contentType: file.type,
    customMetadata: { owner: uid, private: String(isPrivate) },
  });
  await new Promise<void>((resolve, reject) =>
    task.on('state_changed', (s) => onProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)), reject, () => resolve()),
  );
  const meta: TripFile = { id, name: file.name, contentType: file.type, size: file.size, private: isPrivate, ownerUid: uid, storagePath, note: null, createdAt: Date.now() };
  await setDoc(doc(db, 'trips', tripId, 'files', id), meta);
  await idbPut(id, file); // the uploader already has it offline
}

/** Offline copy first; otherwise download with the user's sign-in (no public URL) and keep a copy. */
export async function loadFileBlob(f: TripFile): Promise<Blob> {
  const cached = await idbGet(f.id);
  if (cached) return cached;
  const { storage } = await services();
  const blob = await getBlob(ref(storage, f.storagePath));
  await idbPut(f.id, blob);
  return blob;
}

export async function setFilePrivate(tripId: string, f: TripFile, isPrivate: boolean): Promise<void> {
  const { db, storage } = await services();
  await updateMetadata(ref(storage, f.storagePath), { customMetadata: { owner: f.ownerUid, private: String(isPrivate) } });
  await updateDoc(doc(db, 'trips', tripId, 'files', f.id), { private: isPrivate });
}

export async function renameFile(tripId: string, f: TripFile, name: string, note: string | null): Promise<void> {
  const { db } = await services();
  await updateDoc(doc(db, 'trips', tripId, 'files', f.id), { name, note });
}

export async function deleteTripFile(tripId: string, f: TripFile): Promise<void> {
  const { db, storage } = await services();
  await deleteObject(ref(storage, f.storagePath)).catch((e: { code?: string }) => {
    if (e.code !== 'storage/object-not-found') throw e;
  });
  await deleteDoc(doc(db, 'trips', tripId, 'files', f.id));
  await idbDel(f.id);
}

export async function currentUid(): Promise<string> {
  return (await services()).uid;
}
