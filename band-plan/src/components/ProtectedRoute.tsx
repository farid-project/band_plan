import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { spotifyService } from '../services/spotifyService';
import { toast } from 'react-hot-toast';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  console.log('ProtectedRoute mounted');
  const { user } = useAuthStore();
  const location = useLocation();
  const [processingSpotify, setProcessingSpotify] = useState(false);
  
  console.log('ProtectedRoute check:', { user, currentPath: location.pathname });

  // Check for Spotify auth first, before checking user auth
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const spotifyCode = params.get('code');
    const spotifyState = params.get('state');
    const spotifyError = params.get('error');

    console.log('🎵 ProtectedRoute: Checking Spotify params:', { 
      spotifyCode: spotifyCode ? spotifyCode.substring(0, 10) + '...' : null, 
      spotifyState, 
      spotifyError 
    });

    if (spotifyError) {
      console.log('❌ Spotify auth error:', spotifyError);
      toast.error(`Error de autenticación de Spotify: ${spotifyError}`);
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, document.title, url.toString());
    } else if (spotifyCode && spotifyState && !processingSpotify) {
      console.log('✅ Processing Spotify auth in ProtectedRoute...');
      setProcessingSpotify(true);
      handleSpotifyAuth(spotifyCode, spotifyState);
    }
  }, [location.search, processingSpotify]);

  const handleSpotifyAuth = async (code: string, state: string) => {
    try {
      console.log('🎵 ProtectedRoute: Starting Spotify auth...');
      const success = await spotifyService.handleAuthCallback(code, state);
      
      if (success) {
        console.log('🎵 ProtectedRoute: Auth successful');
        const userData = await spotifyService.getCurrentUser();
        toast.success(`¡Conectado a Spotify como ${userData.display_name}!`);
        
        // Redirect back to the original page
        const returnUrl = localStorage.getItem('spotify_return_url');
        console.log('🎵 ProtectedRoute: Return URL:', returnUrl);
        
        if (returnUrl) {
          localStorage.removeItem('spotify_return_url');
          window.location.href = returnUrl;
          return;
        }
      } else {
        console.log('❌ ProtectedRoute: Auth failed');
        toast.error('Error al conectar con Spotify');
      }
    } catch (error) {
      console.error('❌ ProtectedRoute: Error in Spotify auth:', error);
      toast.error('Error al autenticar con Spotify');
    } finally {
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      window.history.replaceState({}, document.title, url.toString());
      setProcessingSpotify(false);
    }
  };

  // If processing Spotify, show loading
  if (processingSpotify) {
    return <div className="flex justify-center items-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p>Conectando con Spotify...</p>
      </div>
    </div>;
  }

  if (!user) {
    console.log('No user in ProtectedRoute, redirecting to login');
    return <Navigate 
      to="/login" 
      state={{ returnTo: location.pathname + location.search }}
      replace
    />;
  }

  return <>{children}</>;
}