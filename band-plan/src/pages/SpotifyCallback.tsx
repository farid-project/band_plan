import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { spotifyService } from '../services/spotifyService';
import { toast } from 'react-hot-toast';

const SpotifyCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        const state = params.get('state');
        const error = params.get('error');

        console.log('🎵 SpotifyCallback: Processing callback...', {
          hasCode: !!code,
          hasState: !!state,
          error
        });

        if (error) {
          console.error('❌ Spotify auth error:', error);
          toast.error(`Error de autenticación de Spotify: ${error}`);
          navigate('/');
          return;
        }

        if (!code || !state) {
          console.error('❌ Missing code or state parameters');
          toast.error('Parámetros de autenticación faltantes');
          navigate('/');
          return;
        }

        const success = await spotifyService.handleAuthCallback(code, state);

        if (success) {
          console.log('✅ Spotify authentication successful');
          const userData = await spotifyService.getCurrentUser();
          toast.success(`¡Conectado a Spotify como ${userData.display_name}!`);
          
          // Notify components that auth completed
          window.dispatchEvent(new CustomEvent('spotifyAuthCompleted'));
          
          // Redirect back to the original page
          const returnUrl = localStorage.getItem('spotify_return_url');
          if (returnUrl) {
            localStorage.removeItem('spotify_return_url');
            window.location.href = returnUrl;
          } else {
            navigate('/');
          }
        } else {
          console.error('❌ Spotify authentication failed');
          toast.error('Error al conectar con Spotify. Inténtalo de nuevo.');
          navigate('/');
        }
      } catch (error) {
        console.error('❌ Error in Spotify callback:', error);
        
        if (error.message.includes('State mismatch')) {
          spotifyService.clearAuthState();
          toast.error('Error de autenticación de Spotify. Los parámetros han sido limpiados. Puedes intentar conectar de nuevo.');
        } else {
          toast.error(`Error al autenticar con Spotify: ${error.message}`);
        }
        
        navigate('/');
      } finally {
        setProcessing(false);
      }
    };

    handleCallback();
  }, [location.search, navigate]);

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Conectando con Spotify...
          </h2>
          <p className="text-gray-600">
            Por favor espera mientras procesamos tu autenticación
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default SpotifyCallback;