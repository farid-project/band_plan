import React from 'react';
import { useSpotify } from '../hooks/useSpotify';
import { Music, LogOut, Loader2, RotateCcw } from 'lucide-react';
import Button from './Button';
import { spotifyService } from '../services/spotifyService';
import { toast } from 'react-hot-toast';

interface SpotifyConnectProps {
  className?: string;
  compact?: boolean;
}

const SpotifyConnect: React.FC<SpotifyConnectProps> = ({ className = '', compact = false }) => {
  const { isAuthenticated, user, loading, login, logout, refreshAuthStatus } = useSpotify();


  const handleResetSpotify = () => {
    console.log('🎵 Resetting Spotify authentication state...');
    spotifyService.clearAuthState();
    localStorage.removeItem('spotify_auth_state');
    localStorage.removeItem('spotify_code_verifier');
    localStorage.removeItem('spotify_return_url');
    
    // Clear URL parameters if they exist
    const url = new URL(window.location.href);
    if (url.searchParams.has('code') || url.searchParams.has('state')) {
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      url.searchParams.delete('error');
      window.history.replaceState({}, document.title, url.toString());
    }
    
    toast.success('Estado de Spotify limpiado. Puedes intentar conectar de nuevo.');
  };

  const handleRefresh = () => {
    console.log('🎵 Manual refresh requested');
    refreshAuthStatus();
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-green-500" />
        <span className="text-sm text-gray-600">Conectando con Spotify...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (compact) {
      return (
        <button
          onClick={login}
          className={`flex items-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors text-sm ${className}`}
        >
          <Music className="w-4 h-4" />
          Conectar Spotify
        </button>
      );
    }

    return (
      <div className={`bg-gradient-to-r from-green-50 to-green-100 p-4 sm:p-6 rounded-lg border border-green-200 ${className}`}>
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="bg-green-500 p-2 sm:p-3 rounded-full flex-shrink-0">
            <Music className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
              Conecta con Spotify
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              Conecta tu cuenta de Spotify para acceder a funciones avanzadas como búsqueda de canciones, 
              creación automática de playlists, y reproducción de previews.
            </p>
            <ul className="text-xs sm:text-sm text-gray-600 mb-4 space-y-1">
              <li>• Búsqueda automática de canciones con datos completos</li>
              <li>• Crear playlists automáticamente desde tus setlists</li>
              <li>• Reproducir previews de canciones</li>
              <li>• Control de reproducción desde la app</li>
            </ul>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                onClick={login}
                variant="primary"
                className="bg-green-500 hover:bg-green-600 text-white w-full sm:w-auto"
                size="sm"
              >
                <Music className="w-4 h-4 mr-2" />
                Conectar con Spotify
              </Button>
              <Button
                onClick={handleRefresh}
                variant="secondary"
                className="text-blue-600 hover:text-blue-800 w-full sm:w-auto"
                title="Actualizar estado de autenticación"
                size="sm"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Refrescar
              </Button>
              <Button
                onClick={handleResetSpotify}
                variant="secondary"
                className="text-gray-600 hover:text-gray-800 w-full sm:w-auto"
                title="Limpiar estado de Spotify si hay problemas"
                size="sm"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated state
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {user?.images?.[0] && (
          <img 
            src={user.images[0].url} 
            alt={user.display_name} 
            className="w-6 h-6 rounded-full"
          />
        )}
        <span className="text-sm text-gray-700">{user?.display_name}</span>
        <button
          onClick={logout}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Desconectar Spotify"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-r from-green-50 to-green-100 p-3 sm:p-4 rounded-lg border border-green-200 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="bg-green-500 p-2 rounded-full flex-shrink-0">
            <Music className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {user?.images?.[0] && (
                <img 
                  src={user.images[0].url} 
                  alt={user.display_name} 
                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-shrink-0"
                />
              )}
              <span className="font-medium text-sm sm:text-base text-gray-900 truncate">
                Conectado como {user?.display_name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600">
              Spotify conectado correctamente
            </p>
          </div>
        </div>
        <Button
          onClick={logout}
          variant="secondary"
          size="sm"
          className="w-full sm:w-auto"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Desconectar
        </Button>
      </div>
    </div>
  );
};

export default SpotifyConnect;