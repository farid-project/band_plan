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
}

export const useSpotify = (): UseSpotifyReturn => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Note: Auth callback is now handled globally in App.tsx
  // This hook just checks current auth status

  const checkAuthStatus = async () => {
    try {
      console.log('🎵 Checking Spotify auth status...');
      console.log('🎵 Is authenticated:', spotifyService.isAuthenticated());
      
      if (spotifyService.isAuthenticated()) {
        console.log('🎵 Getting user data...');
        const userData = await spotifyService.getCurrentUser();
        console.log('🎵 User data:', userData);
        setUser(userData);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('❌ Error checking Spotify auth status:', error);
      spotifyService.logout();
    } finally {
      setLoading(false);
    }
  };


  const login = useCallback(async () => {
    const authUrl = await spotifyService.getAuthUrl();
    window.location.href = authUrl;
  }, []);

  const logout = useCallback(() => {
    spotifyService.logout();
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
  };
};