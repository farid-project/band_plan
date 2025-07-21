import React from 'react';
import { useSpotify } from '../hooks/useSpotify';
import { Music, LogOut, Loader2 } from 'lucide-react';
import Button from './Button';

interface SpotifyConnectProps {
  className?: string;
  compact?: boolean;
}

const SpotifyConnect: React.FC<SpotifyConnectProps> = ({ className = '', compact = false }) => {
  const { isAuthenticated, user, loading, login, logout } = useSpotify();

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
      <div className={`bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg border border-green-200 ${className}`}>
        <div className="flex items-start gap-4">
          <div className="bg-green-500 p-3 rounded-full">
            <Music className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Conecta con Spotify
            </h3>
            <p className="text-gray-600 mb-4">
              Conecta tu cuenta de Spotify para acceder a funciones avanzadas como búsqueda de canciones, 
              creación automática de playlists, y reproducción de previews.
            </p>
            <ul className="text-sm text-gray-600 mb-4 space-y-1">
              <li>• Búsqueda automática de canciones con datos completos</li>
              <li>• Crear playlists automáticamente desde tus setlists</li>
              <li>• Reproducir previews de canciones</li>
              <li>• Control de reproducción desde la app</li>
            </ul>
            <Button
              onClick={login}
              variant="primary"
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              <Music className="w-4 h-4 mr-2" />
              Conectar con Spotify
            </Button>
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
    <div className={`bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-green-500 p-2 rounded-full">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {user?.images?.[0] && (
                <img 
                  src={user.images[0].url} 
                  alt={user.display_name} 
                  className="w-6 h-6 rounded-full"
                />
              )}
              <span className="font-medium text-gray-900">
                Conectado como {user?.display_name}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Spotify conectado correctamente
            </p>
          </div>
        </div>
        <Button
          onClick={logout}
          variant="secondary"
          size="sm"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Desconectar
        </Button>
      </div>
    </div>
  );
};

export default SpotifyConnect;