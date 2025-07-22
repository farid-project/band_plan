import { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import { spotifyService } from './services/spotifyService';
import { toast } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupManagement from './pages/GroupManagement';
import ProtectedRoute from './components/ProtectedRoute';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AcceptInvitation from './pages/AcceptInvitation';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';


// Component inside Router to use useLocation
function AppContent() {
  const { setUser, setSession } = useAuthStore();
  const [processedCallbacks, setProcessedCallbacks] = useState<Set<string>>(new Set());
  const [processingSpotifyAuth, setProcessingSpotifyAuth] = useState(false);
  const location = useLocation();

  // Efecto para detectar tokens de recuperación y autenticación de Spotify en la URL
  useEffect(() => {
    // Detectar si hay un token de recuperación en la URL, independientemente de la ruta
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const type = params.get('type');
    const hash = location.hash;
    
    // Detectar autenticación de Spotify
    const spotifyCode = params.get('code');
    const spotifyState = params.get('state');
    const spotifyError = params.get('error');
    
    console.log('App: Verificando parámetros en URL:', { 
      token: token ? token.substring(0, 10) + '...' : null, 
      type, 
      hash: hash.length > 0 ? hash.substring(0, 20) + '...' : null,
      spotifyCode: spotifyCode ? spotifyCode.substring(0, 10) + '...' : null,
      spotifyState: spotifyState ? spotifyState.substring(0, 10) + '...' : null,
      spotifyError,
      fullURL: window.location.href,
      searchParams: location.search,
      hasSpotifyParams: !!(spotifyCode && spotifyState),
      pathname: location.pathname
    });
    
    // Manejar autenticación de Spotify
    if (spotifyError) {
      console.log('❌ Spotify auth error:', spotifyError);
      toast.error(`Error de autenticación de Spotify: ${spotifyError}`);
      // Limpiar URL
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, document.title, url.toString());
    } else if (spotifyCode && spotifyState && !processingSpotifyAuth) {
      // Create unique identifier for this callback
      const callbackId = `${spotifyCode.substring(0, 10)}-${spotifyState.substring(0, 10)}`;
      
      if (!processedCallbacks.has(callbackId)) {
        console.log('✅ Procesando autenticación de Spotify...', callbackId);
        console.log('🎵 Spotify Code:', spotifyCode.substring(0, 10) + '...');
        console.log('🎵 Spotify State:', spotifyState.substring(0, 10) + '...');
        console.log('🎵 Full URL:', window.location.href);
        
        // Mark this callback as processed and set processing flag
        setProcessedCallbacks(prev => new Set([...prev, callbackId]));
        setProcessingSpotifyAuth(true);
        console.log('🎵 About to call handleSpotifyAuth...');
        handleSpotifyAuth(spotifyCode, spotifyState);
      } else {
        console.log('🎵 Callback already processed, skipping:', callbackId);
      }
    } else if (spotifyCode || spotifyState) {
      console.log('⚠️ Spotify params parciales:', { spotifyCode: !!spotifyCode, spotifyState: !!spotifyState });
    }
    
    // Verificar token PKCE en parámetros de consulta
    else if (token && type === 'recovery' && location.pathname !== '/reset-password') {
      console.log('App: Token PKCE de recuperación detectado, redirigiendo a /reset-password');
      // Redirigir a la página de reset manteniendo los parámetros
      window.location.replace(`/reset-password?token=${token}&type=${type}`);
    }
    // Verificar token en hash (formato alternativo)
    else if (hash.includes('access_token=') && hash.includes('type=recovery') && location.pathname !== '/reset-password') {
      console.log('App: Token hash de recuperación detectado, redirigiendo a /reset-password');
      window.location.replace('/reset-password' + hash);
    }
  }, [location.search, location.pathname]); // React to URL changes

  const handleSpotifyAuth = async (code: string, state: string) => {
    try {
      console.log('🎵 App: Iniciando autenticación de Spotify...');
      console.log('🎵 App: Code length:', code?.length);
      console.log('🎵 App: State length:', state?.length);
      
      // Clear URL immediately to prevent re-processing
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      window.history.replaceState({}, document.title, url.toString());
      console.log('🎵 App: URL cleared, calling spotifyService.handleAuthCallback...');
      
      const success = await spotifyService.handleAuthCallback(code, state);
      console.log('🎵 App: handleAuthCallback returned:', success, typeof success);
      
      if (success === true) {
        console.log('🎵 App: Autenticación exitosa');
        const userData = await spotifyService.getCurrentUser();
        console.log('🎵 App: UserData received:', userData?.display_name);
        toast.success(`¡Conectado a Spotify como ${userData.display_name}!`);
        
        // Notify hooks that auth completed
        window.dispatchEvent(new CustomEvent('spotifyAuthCompleted'));
        console.log('🎵 App: Custom event dispatched');
        
        // Redirect back to the original page
        const returnUrl = localStorage.getItem('spotify_return_url');
        console.log('🎵 Return URL saved:', returnUrl);
        
        if (returnUrl) {
          const returnUrlObj = new URL(returnUrl);
          const currentUrlObj = new URL(window.location.href);
          
          // Compare without query parameters
          if (returnUrlObj.pathname !== currentUrlObj.pathname) {
            console.log('🎵 Redirecting back to:', returnUrl);
            localStorage.removeItem('spotify_return_url');
            window.location.href = returnUrl;
            return;
          } else {
            localStorage.removeItem('spotify_return_url');
          }
        }
      } else {
        console.log('❌ App: handleAuthCallback returned false or falsy value:', success);
        console.log('🎵 Debug - processingSpotifyAuth:', processingSpotifyAuth, 'success:', success);
        
        // Don't show error if it was just a duplicate call
        // success === false usually means "Already processing auth, skipping..."
        if (success !== false) {
          spotifyService.clearAuthState(); // Clear corrupted state
          toast.error('Error al conectar con Spotify. Inténtalo de nuevo.');
        } else {
          console.log('🎵 Skipping error message - duplicate call detected (success === false)');
        }
      }
    } catch (error) {
      console.error('❌ App: Error en callback de Spotify:', error);
      spotifyService.clearAuthState(); // Clear corrupted state
      
      if (error.message.includes('State mismatch')) {
        // For state mismatch, clear everything and force a page refresh to break the loop
        console.log('🎵 State mismatch detected, clearing all and refreshing...');
        localStorage.removeItem('spotify_auth_state');
        localStorage.removeItem('spotify_code_verifier');
        localStorage.removeItem('spotify_return_url');
        
        // Clear the URL parameters to stop the loop
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        url.searchParams.delete('error');
        window.history.replaceState({}, document.title, url.toString());
        
        // Clear processed callbacks to allow retry
        setProcessedCallbacks(new Set());
        
        toast.error('Error de autenticación de Spotify. Los parámetros han sido limpiados. Puedes intentar conectar de nuevo.');
      } else {
        toast.error(`Error al autenticar con Spotify: ${error.message}`);
      }
    } finally {
      setProcessingSpotifyAuth(false);
    }
  };

  useEffect(() => {
    console.log('AppContent mounted');
    // Check active session test
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session);
      setSession(session);
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', session);
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser, setSession]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/accept-invitation" element={<AcceptInvitation />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/group/:id" element={
            <ProtectedRoute>
              <GroupManagement />
            </ProtectedRoute>
          } />
          <Route path="/group/:id/songs" element={
            <ProtectedRoute>
              <GroupManagement defaultTab="songs" />
            </ProtectedRoute>
          } />
          <Route path="/group/:id/setlists" element={
            <ProtectedRoute>
              <GroupManagement defaultTab="setlists" />
            </ProtectedRoute>
          } />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        </Routes>
      </main>
      <Toaster position="top-right" />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;