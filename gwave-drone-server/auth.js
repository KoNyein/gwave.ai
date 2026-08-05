// server/auth.js — gwave SSO verification (task 7.1)
// Modes (env AUTH_MODE):
//   off     — auth မလို (local sandbox)
//   dev     — HS256 shared-secret token (local multiplayer test)
//   gwave   — gwave.cc app data token (ES256, gw_at cookie) verified against
//             APP_JWT_PUBLIC_JWK — sub is profiles.id, same identity the whole
//             platform uses. Production mode on gwave.cc.
//   cognito — AWS Cognito JWKS verify (raw Cognito tokens; unused on gwave.cc
//             because the browser never holds one — kept for standalone hosts)
//     env: AWS_REGION, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID
import * as jose from 'jose';

const MODE = process.env.AUTH_MODE ?? 'off';
const DEV_SECRET = new TextEncoder().encode(process.env.DEV_SECRET ?? 'gwave-dev');

let gwaveKey = null;
async function gwavePublicKey() {
  gwaveKey ??= await jose.importJWK(JSON.parse(process.env.APP_JWT_PUBLIC_JWK), 'ES256');
  return gwaveKey;
}

let cognitoJWKS = null;
function cognitoIssuer() {
  return `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`;
}

export const authMode = MODE;

// returns { sub, name } | null
export async function verifyToken(token) {
  if (MODE === 'off') return { sub: 'anon-' + Math.random().toString(36).slice(2, 8), name: null };
  if (!token) return null;
  try {
    if (MODE === 'dev') {
      const { payload } = await jose.jwtVerify(token, DEV_SECRET);
      return { sub: payload.sub, name: payload.name ?? null };
    }
    if (MODE === 'gwave') {
      const { payload } = await jose.jwtVerify(token, await gwavePublicKey(), {
        audience: 'authenticated',
      });
      // user tokens only — the service_role bearer must never enter a game
      if (payload.role !== 'authenticated' || !payload.sub) return null;
      return {
        sub: payload.sub,                                  // profiles.id
        name: typeof payload.email === 'string' ? payload.email.split('@')[0] : null,
        avatarGlb: null,
      };
    }
    // cognito: JWKS cache + verify (ID token)
    cognitoJWKS ??= jose.createRemoteJWKSet(new URL(cognitoIssuer() + '/.well-known/jwks.json'));
    const { payload } = await jose.jwtVerify(token, cognitoJWKS, {
      issuer: cognitoIssuer(),
      audience: process.env.COGNITO_CLIENT_ID,
    });
    if (payload.token_use !== 'id' && payload.token_use !== 'access') return null;
    return {
      sub: payload.sub,
      name: payload.name ?? payload['cognito:username'] ?? null,
      avatarGlb: payload['custom:avatar_glb'] ?? null,   // gwave 3D scan URL (task 7.4)
    };
  } catch (e) {
    return null;
  }
}

// dev token ထုတ်ရန် (test/local): node -e "import('./auth.js').then(a=>a.signDevToken('u1','KoNyein').then(console.log))"
export async function signDevToken(sub, name) {
  return await new jose.SignJWT({ name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setExpirationTime('12h')
    .sign(DEV_SECRET);
}
