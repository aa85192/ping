import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from './env';

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

/** Returns null when the request is allowed, or an error message. */
export async function checkAuth(req: Request, env: Env): Promise<string | null> {
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) return null; // auth disabled (local / single-device mode)
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return 'missing token';
  try {
    await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    return null;
  } catch {
    return 'invalid token';
  }
}
