// Agregar estos imports al inicio del archivo
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

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
  tracks: {
    total: number;
  };
}

class SpotifyService {
  private clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  private redirectUri = this.getRedirectUri();
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
    // Load tokens from storage on initialization
    this.loadTokensFromStorage();
    
    // Subscribe to auth changes
    this.subscribeToAuthChanges();
    
    // Start periodic token refresh check
    this.startPeriodicTokenCheck();
    
  }

  private getRedirectUri(): string {
    // Si tenemos una variable de entorno específica, úsala
    if (import.meta.env.VITE_SPOTIFY_REDIRECT_URI) {
      console.log('🎵 Using env redirect URI:', import.meta.env.VITE_SPOTIFY_REDIRECT_URI);
      return import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
    }

    // Detectar automáticamente basado en el hostname
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;
    let redirectUri: string;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Desarrollo local
      const portSuffix = port ? `:${port}` : '';
      redirectUri = `${protocol}//${hostname}${portSuffix}/spotify/callback`;
    } else {
      // Producción - usa el dominio actual
      redirectUri = `${protocol}//${hostname}/spotify/callback`;
    }

    console.log('🎵 Auto-detected redirect URI:', redirectUri);
    return redirectUri;
  }

  // Authentication methods
  async getAuthUrl(): Promise<string> {
    
    // Only clear auth state if we're not currently processing auth
    if (!this.isProcessingAuth) {
      localStorage.removeItem('spotify_auth_state');
      localStorage.removeItem('spotify_code_verifier');
    } else {
    }
    
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

    console.log('🎵 SpotifyService: Starting handleAuthCallback...');
    this.isProcessingAuth = true;

    try {
      const storedState = localStorage.getItem('spotify_auth_state');
      const codeVerifier = localStorage.getItem('spotify_code_verifier');

      console.log('🎵 SpotifyService: Auth callback data:', {
        receivedState: state ? state.substring(0, 10) + '...' : 'NULL',
        storedState: storedState ? storedState.substring(0, 10) + '...' : 'NULL',
        hasCodeVerifier: !!codeVerifier,
        codeLength: code?.length,
        receivedStateLength: state?.length,
        storedStateLength: storedState?.length,
        statesMatch: state === storedState
      });

      if (!storedState) {
        console.error('❌ No stored state found');
        throw new Error('No stored state found');
      }

      if (state !== storedState) {
        console.error('❌ State mismatch:', { 
          received: state, 
          stored: storedState,
          receivedLength: state?.length,
          storedLength: storedState?.length,
          match: state === storedState 
        });
        // Clear potentially corrupted state
        localStorage.removeItem('spotify_auth_state');
        localStorage.removeItem('spotify_code_verifier');
        localStorage.removeItem('spotify_return_url');
        throw new Error('State mismatch - auth state was corrupted. Please try connecting to Spotify again.');
      }
      
      if (!codeVerifier) {
        console.error('❌ Code verifier not found');
        throw new Error('Code verifier not found');
      }

      console.log('🎵 SpotifyService: All validations passed, making token request...');

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

      console.log('🎵 SpotifyService: Token request response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ SpotifyService: Token request failed:', response.status, errorData);
        throw new Error(`Failed to exchange code for tokens: ${response.status} ${errorData}`);
      }

      console.log('🎵 SpotifyService: Token request successful, parsing response...');
      const data = await response.json();
      console.log('🎵 SpotifyService: Token data received:', {
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        expiresIn: data.expires_in
      });
      
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);
      console.log('🎵 SpotifyService: Tokens stored in memory, saving to storage...');

      await this.saveTokensToStorage();
      console.log('🎵 SpotifyService: Tokens saved to storage, cleaning up...');
      
      localStorage.removeItem('spotify_auth_state');
      localStorage.removeItem('spotify_code_verifier');
      console.log('🎵 SpotifyService: Auth callback completed successfully!');

      return true;
    } catch (error) {
      console.error('Error in Spotify auth callback:', error);
      // Clear any remaining auth state on error
      localStorage.removeItem('spotify_auth_state');
      localStorage.removeItem('spotify_code_verifier');
      localStorage.removeItem('spotify_return_url');
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

      await this.saveTokensToStorage();
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
    const response = await this.apiRequest<{ items: any[] }>(`/me/playlists?limit=${limit}`);
    return response.items.map((playlist: any) => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description || '',
      external_urls: playlist.external_urls,
      images: playlist.images || [],
      tracks: playlist.tracks || { total: 0 }
    }));
  }

  async getPlaylistTracks(playlistId: string, limit: number = 100): Promise<SpotifyTrack[]> {
    const response = await this.apiRequest<{ items: { track: SpotifyTrack }[] }>(`/playlists/${playlistId}/tracks?limit=${limit}`);
    return response.items.map(item => item.track);
  }

  // Periodic token check to ensure it stays fresh
  private startPeriodicTokenCheck(): void {
    // Check every 5 minutes
    setInterval(async () => {
      if (this.accessToken && this.tokenExpiry) {
        const timeUntilExpiry = this.tokenExpiry - Date.now();
        
        // If token expires within 10 minutes, refresh it
        if (timeUntilExpiry <= 10 * 60 * 1000) {
          await this.refreshAccessToken();
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Manual method to check and refresh token (for debugging)
  async checkTokenStatus(): Promise<void> {
    console.log('🎵 Token status:', {
      hasAccessToken: !!this.accessToken,
      hasRefreshToken: !!this.refreshToken,
      expiresAt: this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : null,
      secondsUntilExpiry: this.tokenExpiry ? Math.round((this.tokenExpiry - Date.now()) / 1000) : null
    });
    
    if (this.tokenExpiry) {
      const timeUntilExpiry = this.tokenExpiry - Date.now();
      if (timeUntilExpiry <= 10 * 60 * 1000) {
        console.log('🎵 Refreshing token...');
        await this.refreshAccessToken();
      }
    }
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!(this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry);
  }

  async logout(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.isProcessingAuth = false;
    
    // Clear from both localStorage and Supabase
    await this.clearTokensFromStorage();
    
    localStorage.removeItem('spotify_auth_state');
    localStorage.removeItem('spotify_code_verifier');
    localStorage.removeItem('spotify_return_url');
    
    console.log('✅ Spotify logout completed - tokens cleared from all sources');
  }

  // Clear auth state manually (useful for error recovery)
  clearAuthState(): void {
    console.log('🎵 Clearing Spotify auth state manually');
    this.isProcessingAuth = false;
    localStorage.removeItem('spotify_auth_state');
    localStorage.removeItem('spotify_code_verifier');
    localStorage.removeItem('spotify_return_url');
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

  // Modificar los métodos de almacenamiento
  private async saveTokensToStorage(): Promise<void> {
    console.log('🎵 saveTokensToStorage: Starting...');
    const { user } = useAuthStore.getState();
    console.log('🎵 saveTokensToStorage: User check:', { hasUser: !!user, userId: user?.id });
    
    if (!user) {
      console.log('🎵 saveTokensToStorage: No user, falling back to localStorage');
      // Fallback a localStorage si no hay usuario autenticado
      this.saveTokensToLocalStorage();
      return;
    }

    try {
      console.log('🎵 saveTokensToStorage: Attempting database save...');
      const { error } = await supabase
        .from('spotify_tokens')
        .upsert({
          user_id: user.id,
          access_token: this.accessToken,
          refresh_token: this.refreshToken,
          expires_at: new Date(this.tokenExpiry!).toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('🎵 saveTokensToStorage: Database error:', error);
        throw error;
      }
      console.log('✅ Spotify tokens saved to database');
    } catch (error) {
      console.error('Error saving tokens to database:', error);
      console.log('🎵 saveTokensToStorage: Falling back to localStorage due to error');
      // Fallback a localStorage
      this.saveTokensToLocalStorage();
    }
  }

  private async loadTokensFromStorage(): Promise<void> {
    const { user } = useAuthStore.getState();
    
    if (!user) {
      // Cargar desde localStorage si no hay usuario
      this.loadTokensFromLocalStorage();
      return;
    }

    try {
      const { data, error } = await supabase
        .from('spotify_tokens')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        // No hay tokens en la base de datos, intentar localStorage
        this.loadTokensFromLocalStorage();
        return;
      }

      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.tokenExpiry = new Date(data.expires_at).getTime();
      
      // También guardar en localStorage para acceso rápido
      this.saveTokensToLocalStorage();
      
      console.log('✅ Spotify tokens loaded from database');
    } catch (error) {
      console.error('Error loading tokens from database:', error);
      this.loadTokensFromLocalStorage();
    }
  }

  // Métodos auxiliares para localStorage (como fallback)
  private saveTokensToLocalStorage(): void {
    console.log('🎵 SpotifyService: Saving tokens to storage...', {
      hasAccessToken: !!this.accessToken,
      hasRefreshToken: !!this.refreshToken,
      hasTokenExpiry: !!this.tokenExpiry,
      accessTokenLength: this.accessToken?.length,
      tokenExpiry: this.tokenExpiry
    });
    
    if (this.accessToken) {
      localStorage.setItem('spotify_access_token', this.accessToken);
      console.log('✅ Access token saved to localStorage');
    }
    if (this.refreshToken) {
      localStorage.setItem('spotify_refresh_token', this.refreshToken);
      console.log('✅ Refresh token saved to localStorage');
    }
    if (this.tokenExpiry) {
      localStorage.setItem('spotify_token_expiry', this.tokenExpiry.toString());
      console.log('✅ Token expiry saved to localStorage');
    }
    
    // Verify tokens were actually saved
    const savedAccessToken = localStorage.getItem('spotify_access_token');
    const savedRefreshToken = localStorage.getItem('spotify_refresh_token');
    const savedTokenExpiry = localStorage.getItem('spotify_token_expiry');
    
    console.log('🎵 Verification - tokens in localStorage:', {
      hasAccessToken: !!savedAccessToken,
      hasRefreshToken: !!savedRefreshToken,
      hasTokenExpiry: !!savedTokenExpiry,
      accessTokenMatches: savedAccessToken === this.accessToken,
      refreshTokenMatches: savedRefreshToken === this.refreshToken
    });
  }

  private loadTokensFromLocalStorage(): void {
    this.accessToken = localStorage.getItem('spotify_access_token');
    this.refreshToken = localStorage.getItem('spotify_refresh_token');
    const expiry = localStorage.getItem('spotify_token_expiry');
    this.tokenExpiry = expiry ? parseInt(expiry) : null;
  }

  private async clearTokensFromStorage(): Promise<void> {
    // Clear from localStorage
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_token_expiry');
    
    // Clear from Supabase if user is authenticated
    const { user } = useAuthStore.getState();
    
    if (user) {
      try {
        const { error } = await supabase
          .from('spotify_tokens')
          .delete()
          .eq('user_id', user.id);
          
        if (error) {
          console.error('Error deleting Spotify tokens from database:', error);
        } else {
          console.log('✅ Spotify tokens deleted from database');
        }
      } catch (error) {
        console.error('Error clearing Spotify tokens from database:', error);
      }
    }
  }

  // Subscription to auth changes for real-time sync
  private subscribeToAuthChanges(): void {
    // Listen for auth state changes
    useAuthStore.subscribe((state) => {
      if (state.user && !this.accessToken) {
        // User logged in and we don't have tokens, try to load them
        this.loadTokensFromStorage();
      } else if (!state.user && this.accessToken) {
        // User logged out, clear tokens
        this.logout();
      }
    });
  }

  // Method to manually refresh tokens from database (for cross-device sync)
  async refreshTokensFromDatabase(): Promise<boolean> {
    const { user } = useAuthStore.getState();
    
    if (!user) return false;

    // Don't refresh if user has explicitly logged out
    if (!this.accessToken && 
        !localStorage.getItem('spotify_access_token')) {
      console.log('🎵 User appears to have logged out, skipping database refresh');
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('spotify_tokens')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        // No tokens in database, respect local logout state
        return false;
      }

      const dbTokenExpiry = new Date(data.expires_at).getTime();
      
      // Only update if database has newer or different tokens
      if (!this.accessToken || 
          data.access_token !== this.accessToken || 
          dbTokenExpiry !== this.tokenExpiry) {
        
        const wasAuthenticated = this.isAuthenticated();
        
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        this.tokenExpiry = dbTokenExpiry;
        
        // Also save to localStorage
        this.saveTokensToLocalStorage();
        
        console.log('✅ Spotify tokens refreshed from database');
        
        // Only dispatch event if authentication state actually changed
        if (!wasAuthenticated && this.isAuthenticated()) {
          console.log('🎵 Authentication state changed, dispatching event');
          window.dispatchEvent(new CustomEvent('spotifyAuthCompleted'));
        } else {
          console.log('🎵 Tokens updated but auth state unchanged, no event dispatched');
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error refreshing tokens from database:', error);
      return false;
    }
  }

}

export const spotifyService = new SpotifyService();

// Expose globally for debugging
(window as any).spotifyService = spotifyService;