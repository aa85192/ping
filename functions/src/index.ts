import { createHash } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { handleApi, type Cache } from './api';

initializeApp();

const MAPS_KEY = defineSecret('GOOGLE_MAPS_SERVER_KEY');

/** Server-side cache in Firestore (clients can't read it: no rule matches apiCache). */
const firestoreCache: Cache = {
  async get<T>(key: string) {
    const snap = await getFirestore().collection('apiCache').doc(hash(key)).get();
    const d = snap.data();
    if (!d || d.expiresAt.toMillis() < Date.now()) return null;
    return d.value as T;
  },
  async set(key, value, ttlSec) {
    await getFirestore()
      .collection('apiCache')
      .doc(hash(key))
      .set({ key: key.slice(0, 500), value: JSON.parse(JSON.stringify(value)), expiresAt: Timestamp.fromMillis(Date.now() + ttlSec * 1000) });
  },
};

function hash(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

export const api = onRequest(
  {
    region: 'asia-east1',
    secrets: [MAPS_KEY],
    memory: '256MiB',
    maxInstances: 3, // two travellers; also caps the bill if a token ever leaks
    cors: isEmulator ? true : false, // production is same-origin through Firebase Hosting
  },
  async (req, res) => {
    if (!isEmulator) {
      const header = req.get('Authorization') ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';
      try {
        if (!token) throw new Error('missing token');
        await getAuth().verifyIdToken(token);
      } catch {
        res.status(401).json({ error: 'sign in required' });
        return;
      }
    }
    try {
      const out = await handleApi(
        { method: req.method, path: req.path, query: req.query as Record<string, string | undefined>, body: req.body },
        { mapsKey: MAPS_KEY.value() || undefined, metaToken: process.env.META_ACCESS_TOKEN, cache: firestoreCache },
      );
      res.status(out.status).json(out.json);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  },
);
