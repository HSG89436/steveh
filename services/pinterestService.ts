
import { PinterestBoard, GeneratedPin } from "../types";

const API_BASE = 'https://api.pinterest.com/v5';
const PROXY_BASE = 'https://corsproxy.io/?';

// Updated Default App ID
export const REQUIRED_APP_ID = '1539800';

/**
 * Cleanly detects the current URL for OAuth redirection.
 * Removes trailing slashes to ensure exact matches with Pinterest Dashboard.
 */
export const getDetectedRedirectUri = () => {
  // Overriding with the requested callback URI for this environment
  return 'http://localhost:9002/api/pinterest/callback';
};

export const REQUIRED_REDIRECT_URI = getDetectedRedirectUri();

// Pinterest V5 Scopes (Must be comma-separated)
export const REQUIRED_SCOPES = 'boards:read,boards:write,pins:read,pins:write,user_accounts:read';

const fetchWithCorsFallback = async (url: string, options: RequestInit) => {
  const timeout = 15000; 
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const config = { ...options, signal: controller.signal };

  try {
    const response = await fetch(url, config);
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    const isNetworkError = error.name === 'TypeError' && 
      (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'));
    const isTimeout = error.name === 'AbortError';

    if (isNetworkError || isTimeout) {
        const proxyController = new AbortController();
        const proxyId = setTimeout(() => proxyController.abort(), timeout);
        const proxyConfig = { ...options, signal: proxyController.signal };

        try {
            const proxyUrl = `${PROXY_BASE}${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl, proxyConfig);
            clearTimeout(proxyId);
            return response;
        } catch (proxyError: any) {
            clearTimeout(proxyId);
            throw new Error(`Connection Failed: ${proxyError.message || 'Unknown Network Error'}`);
        }
    }
    throw error;
  }
};

/**
 * Generates the OAuth URL for Pinterest V5.
 */
export const getOAuthUrl = (clientId: string, redirectUri: string): string => {
  const baseUrl = 'https://www.pinterest.com/oauth';
  
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  const state = array[0].toString(36);
  localStorage.setItem('pinterest_auth_state', state);
  
  const params = [
    `client_id=${clientId.trim()}`,
    `redirect_uri=${encodeURIComponent(redirectUri.trim())}`,
    `response_type=code`,
    `scope=${encodeURIComponent(REQUIRED_SCOPES)}`,
    `state=${state}`
  ].join('&');

  const finalUrl = `${baseUrl}?${params}`;
  console.group("Pinterest OAuth Debug");
  console.log("Base URL:", baseUrl);
  console.log("Client ID:", clientId.trim());
  console.log("Redirect URI:", redirectUri.trim());
  console.log("Scopes:", REQUIRED_SCOPES);
  console.log("Full OAuth URL:", finalUrl);
  console.groupEnd();

  return finalUrl;
};

export const exchangeAuthCode = async (clientId: string, clientSecret: string, code: string, redirectUri: string): Promise<string> => {
  const tokenUrl = `${API_BASE}/oauth/token`;
  const authString = `${clientId.trim()}:${clientSecret.trim()}`;
  const authHeader = btoa(authString);
  
  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', redirectUri.trim());

  try {
    const response = await fetchWithCorsFallback(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Token Exchange Error Response:", data);
      throw new Error(data.message || `API Error ${response.status}: ${JSON.stringify(data)}`);
    }
    return data.access_token;
  } catch (error: any) {
    console.error("Token Exchange Failed:", error);
    throw new Error(error.message || "OAuth Token Exchange Failed");
  }
};

export const fetchBoards = async (token: string): Promise<PinterestBoard[]> => {
  try {
    const url = `${API_BASE}/boards?page_size=100`;
    const response = await fetchWithCorsFallback(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) throw new Error(`API Error ${response.status}`);
    const data = await response.json();
    if (!data.items) return [];
    return data.items.map((b: any) => ({
      id: b.id,
      name: b.name,
      url: `https://www.pinterest.com${b.url || '/'}`
    }));
  } catch (error) {
    throw error;
  }
};

export const publishPin = async (
  token: string, 
  boardId: string, 
  pin: GeneratedPin,
  destinationUrl?: string 
): Promise<{ success: boolean; pinId?: string; error?: string }> => {
  try {
    let mediaSource;
    if (pin.imageUrl.startsWith('data:')) {
       const base64Data = pin.imageUrl.split(',')[1];
       mediaSource = {
         source_type: 'image_base64',
         content_type: 'image/jpeg',
         data: base64Data
       };
    } else {
       mediaSource = {
         source_type: 'image_url',
         url: pin.imageUrl
       };
    }

    const payload = {
      board_id: boardId,
      title: pin.headline,
      description: `${pin.subheadline}\n\n${pin.cta}`,
      media_source: mediaSource,
      link: destinationUrl 
    };

    const url = `${API_BASE}/pins`;
    const response = await fetchWithCorsFallback(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) return { success: false, error: data.message || `API Error ${response.status}` };
    return { success: true, pinId: data.id };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network Error during Publish' };
  }
};
