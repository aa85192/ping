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
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? '';

/** OAuth token of the function's own service account (needs the "Vertex AI User" role). */
let tokenCache: { value: string; expires: number } | null = null;
async function serviceAccountToken(): Promise<string> {
  if (tokenCache && tokenCache.expires > Date.now() + 60_000) return tokenCache.value;
  const res = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
    headers: { 'Metadata-Flavor': 'Google' },
  });
  if (!res.ok) throw new Error(`metadata token ${res.status}`);
  const t = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { value: t.access_token, expires: Date.now() + t.expires_in * 1000 };
  return t.access_token;
}

export const api = onRequest(
  {
    region: 'asia-east1',
    secrets: [MAPS_KEY],
    memory: '256MiB',
    timeoutSeconds: 60, // grounded Gemini lookups can take ~10–20 s
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
        {
          mapsKey: MAPS_KEY.value() || undefined,
          gemini: process.env.DISABLE_TRANSIT_AI === 'true' ? undefined : { kind: 'vertex', project: PROJECT_ID, token: serviceAccountToken },
          geminiModel: process.env.GEMINI_MODEL || undefined,
          metaToken: process.env.META_ACCESS_TOKEN,
          cache: firestoreCache,
        },
      );
      res.status(out.status).json(out.json);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  },
);
