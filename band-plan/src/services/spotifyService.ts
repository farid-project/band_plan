export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string; id: string }[];
  album: {
    name: string;
    images: { url: string; height: number; width: number }[];
    release_date: string;
  };
  duration_ms: number;
  popularity: number;
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
  audio_features?: {
    tempo: number;
    key: number;
    energy: number;
    valence: number;
    danceability: number;
  };
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: { url: string }[];
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  external_urls: {
    spotify: string;
  };
  images: { url: string }[];
}

class SpotifyService {
  private clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  private redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
  private scopes = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-modify-playback-state',
    'user-read-playback-state',
    'streaming'
  ].join(' ');

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;
  private isProcessingAuth: boolean = false;

  constructor() {
    // Load tokens from localStorage on initialization
    this.loadTokensFromStorage();
  }

  // Authentication methods
  async getAuthUrl(): Promise<string> {
    const state = this.generateRandomString(16);
    const codeVerifier = this.generateRandomString(128);

    // Save current page to return after auth
    localStorage.setItem('spotify_return_url', window.location.href);
    localStorage.setItem('spotify_auth_state', state);
    localStorage.setItem('spotify_code_verifier', codeVerifier);

    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: this.scopes,
      redirect_uri: this.redirectUri,
      state: state,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async handleAuthCallback(code: string, state: string): Promise<boolean> {
    // Prevent duplicate processing
    if (this.isProcessingAuth) {
      console.log('🎵 Already processing auth, skipping...');
      return false;
    }

    this.isProcessingAuth = true;

    try {
      const storedState = localStorage.getItem('spotify_auth_state');
      const codeVerifier = localStorage.getItem('spotify_code_verifier');

      console.log('🎵 Spotify auth callback:', {
        receivedState: state,
        storedState: storedState,
        hasCodeVerifier: !!codeVerifier,
        codeLength: code?.length
      });

      if (!storedState) {
        console.error('❌ No stored state found');
        throw new Error('No stored state found');
      }

      if (state !== storedState) {
        console.error('❌ State mismatch:', { received: state, stored: storedState });
        // Clear potentially corrupted state
        localStorage.removeItem('spotify_auth_state');
        localStorage.removeItem('spotify_code_verifier');
        throw new Error('State mismatch');
      }
      
      if (!codeVerifier) {
        console.error('❌ Code verifier not found');
        throw new Error('Code verifier not found');
      }

      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
          client_id: this.clientId,
          code_verifier: codeVerifier,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange code for tokens');
      }

      const data = await response.json();
      
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);

      this.saveTokensToStorage();
      localStorage.removeItem('spotify_auth_state');
      localStorage.removeItem('spotify_code_verifier');

      return true;
    } catch (error) {
      console.error('Error in Spotify auth callback:', error);
      return false;
    } finally {
      this.isProcessingAuth = false;
    }
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.clientId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh access token');
      }

      const data = await response.json();
      
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);
      
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }

      this.saveTokensToStorage();
      return true;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      this.logout();
      return false;
    }
  }

  async ensureValidToken(): Promise<boolean> {
    if (!this.accessToken) return false;
    
    if (this.tokenExpiry && Date.now() >= this.tokenExpiry - 60000) { // Refresh 1 min before expiry
      return await this.refreshAccessToken();
    }
    
    return true;
  }

  // API methods
  private async apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!(await this.ensureValidToken())) {
      throw new Error('No valid Spotify token available');
    }

    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, try refresh
        if (await this.refreshAccessToken()) {
          // Retry the request with new token
          return this.apiRequest(endpoint, options);
        }
      }
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }

    // Some Spotify endpoints return empty responses (like player controls)
    const contentLength = response.headers.get('content-length');
    if (contentLength === '0' || response.status === 204) {
      return null as T;
    }

    return response.json();
  }

  async getCurrentUser(): Promise<SpotifyUser> {
    return this.apiRequest<SpotifyUser>('/me');
  }

  async searchTracks(query: string, limit: number = 20): Promise<SpotifyTrack[]> {
    const params = new URLSearchParams({
      q: query,
      type: 'track',
      limit: limit.toString(),
    });

    const response = await this.apiRequest<{ tracks: { items: SpotifyTrack[] } }>(`/search?${params}`);
    return response.tracks.items;
  }

  async getTrack(trackId: string): Promise<SpotifyTrack> {
    return this.apiRequest<SpotifyTrack>(`/tracks/${trackId}`);
  }

  async getAudioFeatures(trackId: string): Promise<SpotifyTrack['audio_features']> {
    return this.apiRequest<SpotifyTrack['audio_features']>(`/audio-features/${trackId}`);
  }

  async createPlaylist(name: string, description: string, isPublic: boolean = false): Promise<SpotifyPlaylist> {
    const user = await this.getCurrentUser();
    
    return this.apiRequest<SpotifyPlaylist>(`/users/${user.id}/playlists`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        public: isPublic,
      }),
    });
  }

  async addTracksToPlaylist(playlistId: string, trackUris: string[]): Promise<void> {
    await this.apiRequest(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({
        uris: trackUris,
      }),
    });
  }

  async playTrack(trackUri: string, deviceId?: string): Promise<void> {
    const body: any = {
      uris: [trackUri],
    };

    if (deviceId) {
      body.device_id = deviceId;
    }

    await this.apiRequest('/me/player/play', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async pausePlayback(): Promise<void> {
    await this.apiRequest('/me/player/pause', {
      method: 'PUT',
    });
  }

  async resumePlayback(): Promise<void> {
    await this.apiRequest('/me/player/play', {
      method: 'PUT',
    });
  }

  async getPlaybackState(): Promise<any> {
    try {
      return await this.apiRequest('/me/player');
    } catch (error) {
      // No active device is not an error
      return null;
    }
  }

  async getUserPlaylists(limit: number = 50): Promise<SpotifyPlaylist[]> {
    const response = await this.apiRequest<{ items: SpotifyPlaylist[] }>(`/me/playlists?limit=${limit}`);
    return response.items;
  }

  async getPlaylistTracks(playlistId: string, limit: number = 100): Promise<SpotifyTrack[]> {
    const response = await this.apiRequest<{ items: { track: SpotifyTrack }[] }>(`/playlists/${playlistId}/tracks?limit=${limit}`);
    return response.items.map(item => item.track);
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!(this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry);
  }

  logout(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.isProcessingAuth = false;
    this.clearTokensFromStorage();
    localStorage.removeItem('spotify_auth_state');
    localStorage.removeItem('spotify_code_verifier');
  }

  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private generateRandomString(length: number): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], '');
  }

  private saveTokensToStorage(): void {
    if (this.accessToken) {
      localStorage.setItem('spotify_access_token', this.accessToken);
    }
    if (this.refreshToken) {
      localStorage.setItem('spotify_refresh_token', this.refreshToken);
    }
    if (this.tokenExpiry) {
      localStorage.setItem('spotify_token_expiry', this.tokenExpiry.toString());
    }
  }

  private loadTokensFromStorage(): void {
    this.accessToken = localStorage.getItem('spotify_access_token');
    this.refreshToken = localStorage.getItem('spotify_refresh_token');
    const expiry = localStorage.getItem('spotify_token_expiry');
    this.tokenExpiry = expiry ? parseInt(expiry) : null;
  }

  private clearTokensFromStorage(): void {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_token_expiry');
  }
}

export const spotifyService = new SpotifyService();