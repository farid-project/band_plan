import { useState, useEffect, useCallback } from 'react';
import { spotifyService, SpotifyUser, SpotifyTrack } from '../services/spotifyService';
import { toast } from 'react-hot-toast';

interface UseSpotifyReturn {
  isAuthenticated: boolean;
  user: SpotifyUser | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
  searchTracks: (query: string) => Promise<SpotifyTrack[]>;
  createPlaylistFromSetlist: (setlistName: string, tracks: SpotifyTrack[]) => Promise<string | null>;
  playTrack: (trackUri: string) => Promise<void>;
  pausePlayback: () => Promise<void>;
  resumePlayback: () => Promise<void>;
  refreshAuthStatus: () => void;
}

export const useSpotify = (): UseSpotifyReturn => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

  // Check authentication status on mount only once
  useEffect(() => {
    if (initialized) return;
    
    const checkAuthStatus = async () => {
      if (isCheckingAuth) {
        console.log('🎵 Already checking auth, skipping...');
        return;
      }
      
      setIsCheckingAuth(true);
      try {
        console.log('🎵 Checking Spotify auth status...');
        
        // Try to refresh tokens from database first (for cross-device sync)
        await spotifyService.refreshTokensFromDatabase();
        
        console.log('🎵 Is authenticated:', spotifyService.isAuthenticated());
        
        if (spotifyService.isAuthenticated()) {
          console.log('🎵 Getting user data...');
          const userData = await spotifyService.getCurrentUser();
          console.log('🎵 User data:', userData);
          setUser(userData);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('❌ Error checking Spotify auth status:', error);
        await spotifyService.logout();
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setLoading(false);
        setInitialized(true);
        setIsCheckingAuth(false);
      }
    };

    checkAuthStatus();
  }, [initialized]);

  // Listen for spotify auth events
  useEffect(() => {
    const handleSpotifyAuth = async () => {
      if (isCheckingAuth) {
        console.log('🎵 Already checking auth, ignoring event...');
        return;
      }
      
      console.log('🎵 useSpotify: Received Spotify auth event, refreshing status...');
      setIsCheckingAuth(true);
      
      try {
        console.log('🎵 useSpotify: Checking if authenticated:', spotifyService.isAuthenticated());
        if (spotifyService.isAuthenticated()) {
          // Only fetch user data if we don't have it or it's different
          if (!user || !isAuthenticated) {
            console.log('🎵 useSpotify: Getting current user...');
            const userData = await spotifyService.getCurrentUser();
            console.log('🎵 useSpotify: User data received:', userData?.display_name);
            setUser(userData);
            setIsAuthenticated(true);
          } else {
            console.log('🎵 useSpotify: User already set, skipping fetch');
          }
        } else {
          console.log('🎵 useSpotify: Not authenticated, clearing state');
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error('❌ useSpotify: Error refreshing Spotify auth status:', error);
        await spotifyService.logout();
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    console.log('🎵 useSpotify: Adding event listener for spotifyAuthCompleted');
    window.addEventListener('spotifyAuthCompleted', handleSpotifyAuth);
    return () => {
      console.log('🎵 useSpotify: Removing event listener for spotifyAuthCompleted');
      window.removeEventListener('spotifyAuthCompleted', handleSpotifyAuth);
    };
  }, []); // No dependencies needed

  // Note: Auth callback is now handled globally in App.tsx
  // This hook just checks current auth status


  const login = useCallback(async () => {
    try {
      console.log('🎵 Starting Spotify login...');
      const authUrl = await spotifyService.getAuthUrl();
      console.log('🎵 Got auth URL, redirecting...');
      window.location.href = authUrl;
    } catch (error) {
      console.error('❌ Error getting Spotify auth URL:', error);
      toast.error(`Error al conectar con Spotify: ${error.message}`);
    }
  }, []);

  const logout = useCallback(async () => {
    await spotifyService.logout();
    setIsAuthenticated(false);
    setUser(null);
    toast.success('Desconectado de Spotify');
  }, []);

  const searchTracks = useCallback(async (query: string): Promise<SpotifyTrack[]> => {
    if (!isAuthenticated) {
      throw new Error('No authenticated with Spotify');
    }

    try {
      return await spotifyService.searchTracks(query);
    } catch (error) {
      console.error('Error searching tracks:', error);
      toast.error('Error al buscar canciones en Spotify');
      throw error;
    }
  }, [isAuthenticated]);

  const createPlaylistFromSetlist = useCallback(async (
    setlistName: string, 
    tracks: SpotifyTrack[]
  ): Promise<string | null> => {
    if (!isAuthenticated) {
      toast.error('Debes conectar con Spotify primero');
      return null;
    }

    try {
      const playlist = await spotifyService.createPlaylist(
        `Band Plan - ${setlistName}`,
        `Setlist generado automáticamente desde Band Plan`,
        false
      );

      const trackUris = tracks
        .filter(track => track.id) // Only tracks with valid IDs
        .map(track => `spotify:track:${track.id}`);

      if (trackUris.length > 0) {
        await spotifyService.addTracksToPlaylist(playlist.id, trackUris);
      }

      toast.success(`Playlist "${playlist.name}" creada en Spotify`);
      return playlist.external_urls.spotify;
    } catch (error) {
      console.error('Error creating playlist:', error);
      toast.error('Error al crear playlist en Spotify');
      return null;
    }
  }, [isAuthenticated]);

  const playTrack = useCallback(async (trackUri: string): Promise<void> => {
    if (!isAuthenticated) {
      toast.error('Debes conectar con Spotify primero');
      return;
    }

    try {
      await spotifyService.playTrack(trackUri);
    } catch (error) {
      console.error('Error playing track:', error);
      toast.error('Error al reproducir canción. Asegúrate de tener Spotify abierto.');
    }
  }, [isAuthenticated]);

  const pausePlayback = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) return;

    try {
      await spotifyService.pausePlayback();
    } catch (error) {
      console.error('Error pausing playback:', error);
      toast.error('Error al pausar reproducción');
    }
  }, [isAuthenticated]);

  const resumePlayback = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) return;

    try {
      await spotifyService.resumePlayback();
    } catch (error) {
      console.error('Error resuming playback:', error);
      toast.error('Error al reanudar reproducción');
    }
  }, [isAuthenticated]);

  // Function to refresh auth status (can be called externally)
  const refreshAuthStatus = useCallback(async () => {
    try {
      if (spotifyService.isAuthenticated()) {
        const userData = await spotifyService.getCurrentUser();
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('❌ Error refreshing Spotify auth status:', error);
      spotifyService.logout();
      setIsAuthenticated(false);
      setUser(null);
    }
  }, []);

  return {
    isAuthenticated,
    user,
    loading,
    login,
    logout,
    searchTracks,
    createPlaylistFromSetlist,
    playTrack,
    pausePlayback,
    resumePlayback,
    refreshAuthStatus,
  };
};