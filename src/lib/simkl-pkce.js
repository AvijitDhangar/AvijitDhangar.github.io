// PKCE (Proof Key for Code Exchange) helpers for Simkl Auth V2 (S256)

export function generateRandomString(length = 64) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, (x) => charset[x % charset.length]).join('');
}

export async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  
  // Base64-URL encode without padding
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function getRedirectUri() {
  // Matches http://localhost:4321/auth/simkl or https://avijitdhangar.github.io/auth/simkl
  const origin = window.location.origin;
  return `${origin}/auth/simkl`;
}

export async function initiateSimklAuth(clientId) {
  if (!clientId) {
    throw new Error('Simkl Client ID is required to initiate sign-in.');
  }

  const verifier = generateRandomString(64);
  const challenge = await generateCodeChallenge(verifier);
  const redirectUri = getRedirectUri();

  // Save verifier and state for verification on return
  sessionStorage.setItem('simkl_pkce_verifier', verifier);
  sessionStorage.setItem('simkl_client_id', clientId);
  sessionStorage.setItem('simkl_redirect_uri', redirectUri);

  const authUrl = new URL('https://simkl.com/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  window.location.href = authUrl.toString();
}

export async function exchangeCodeForToken(code) {
  const verifier = sessionStorage.getItem('simkl_pkce_verifier');
  const clientId = sessionStorage.getItem('simkl_client_id') || localStorage.getItem('simkl_client_id');
  const redirectUri = sessionStorage.getItem('simkl_redirect_uri') || getRedirectUri();

  if (!verifier) {
    throw new Error('Missing PKCE code verifier. Please initiate sign-in again.');
  }
  if (!clientId) {
    throw new Error('Missing Simkl Client ID. Please re-enter your Client ID.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code: code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  // Try standard endpoint https://api.simkl.com/oauth2/token
  let response = await fetch('https://api.simkl.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: body.toString(),
  });

  // Fallback to /oauth/token if /oauth2/token redirects
  if (!response.ok && response.status === 404) {
    response = await fetch('https://api.simkl.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    });
  }

  const data = await response.json();

  if (!response.ok || data.error) {
    const errorMsg = data.message || data.error_description || data.error || 'Failed to exchange token with Simkl.';
    throw new Error(errorMsg);
  }

  // Clean up verifier
  sessionStorage.removeItem('simkl_pkce_verifier');

  // Store tokens
  if (data.access_token) {
    localStorage.setItem('simkl_access_token', data.access_token);
    if (clientId) localStorage.setItem('simkl_client_id', clientId);
  }
  if (data.refresh_token) {
    localStorage.setItem('simkl_refresh_token', data.refresh_token);
  }

  return data;
}
