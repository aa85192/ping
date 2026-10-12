import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const cloudEnabled = Boolean(config.apiKey && config.projectId);

let appPromise: Promise<{ app: FirebaseApp; auth: Auth }> | null = null;

/** Firebase is only downloaded when it is configured. */
export function getFirebase() {
  if (!cloudEnabled) throw new Error('Firebase not configured');
  appPromise ??= (async () => {
    const { initializeApp } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');
    const app = initializeApp(config);
    return { app, auth: getAuth(app) };
  })();
  return appPromise;
}

export async function watchUser(cb: (u: User | null) => void): Promise<() => void> {
  const { auth } = await getFirebase();
  const { onAuthStateChanged } = await import('firebase/auth');
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle(): Promise<void> {
  const { auth } = await getFirebase();
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    // Installed iOS PWAs block popups; fall back to a full-page redirect.
    if (code.includes('popup-blocked') || code.includes('operation-not-supported')) await signInWithRedirect(auth, provider);
    else throw e;
  }
}

export async function signOutUser(): Promise<void> {
  const { auth } = await getFirebase();
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}

export async function getIdToken(): Promise<string | null> {
  if (!cloudEnabled) return null;
  const { auth } = await getFirebase();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}
