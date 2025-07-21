import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import BacklinkFooter from './components/BacklinkFooter';


function App() {
  const { setUser, setSession } = useAuthStore();

  // Efecto para detectar tokens de recuperación y autenticación de Spotify en la URL
  useEffect(() => {
    // Detectar si hay un token de recuperación en la URL, independientemente de la ruta
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const type = params.get('type');
    const hash = window.location.hash;
    
    // Detectar autenticación de Spotify
    const spotifyCode = params.get('code');
    const spotifyState = params.get('state');
    const spotifyError = params.get('error');
    
    console.log('App: Verificando parámetros en URL:', { 
      token: token ? token.substring(0, 10) + '...' : null, 
      type, 
      hash: hash.length > 0 ? hash.substring(0, 20) + '...' : null,
      spotifyCode: spotifyCode ? spotifyCode.substring(0, 10) + '...' : null,
      spotifyState,
      spotifyError,
      fullURL: window.location.href,
      searchParams: window.location.search
    });
    
    // Manejar autenticación de Spotify
    if (spotifyError) {
      console.log('❌ Spotify auth error:', spotifyError);
      toast.error(`Error de autenticación de Spotify: ${spotifyError}`);
      // Limpiar URL
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, document.title, url.toString());
    } else if (spotifyCode && spotifyState) {
      console.log('✅ Procesando autenticación de Spotify...');
      console.log('🎵 Spotify Code:', spotifyCode.substring(0, 10) + '...');
      console.log('🎵 Spotify State:', spotifyState);
      handleSpotifyAuth(spotifyCode, spotifyState);
    } else if (spotifyCode || spotifyState) {
      console.log('⚠️ Spotify params parciales:', { spotifyCode: !!spotifyCode, spotifyState: !!spotifyState });
    }
    
    // Verificar token PKCE en parámetros de consulta
    else if (token && type === 'recovery' && window.location.pathname !== '/reset-password') {
      console.log('App: Token PKCE de recuperación detectado, redirigiendo a /reset-password');
      // Redirigir a la página de reset manteniendo los parámetros
      window.location.replace(`/reset-password?token=${token}&type=${type}`);
    }
    // Verificar token en hash (formato alternativo)
    else if (hash.includes('access_token=') && hash.includes('type=recovery') && window.location.pathname !== '/reset-password') {
      console.log('App: Token hash de recuperación detectado, redirigiendo a /reset-password');
      window.location.replace('/reset-password' + hash);
    }
  }, []);

  const handleSpotifyAuth = async (code: string, state: string) => {
    try {
      console.log('🎵 App: Iniciando autenticación de Spotify...');
      const success = await spotifyService.handleAuthCallback(code, state);
      
      if (success) {
        console.log('🎵 App: Autenticación exitosa');
        const userData = await spotifyService.getCurrentUser();
        toast.success(`¡Conectado a Spotify como ${userData.display_name}!`);
        
        // Redirect back to the original page
        const returnUrl = localStorage.getItem('spotify_return_url');
        console.log('🎵 Return URL saved:', returnUrl);
        console.log('🎵 Current URL:', window.location.href);
        
        if (returnUrl) {
          const returnUrlObj = new URL(returnUrl);
          const currentUrlObj = new URL(window.location.href);
          
          // Compare without query parameters
          if (returnUrlObj.pathname !== currentUrlObj.pathname) {
            console.log('🎵 Redirecting back to:', returnUrl);
            localStorage.removeItem('spotify_return_url');
            window.location.href = returnUrl;
            return;
          }
        }
      } else {
        console.log('❌ App: Error en autenticación');
        toast.error('Error al conectar con Spotify');
      }
    } catch (error) {
      console.error('❌ App: Error en callback de Spotify:', error);
      toast.error('Error al autenticar con Spotify');
    } finally {
      // Limpiar URL
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      window.history.replaceState({}, document.title, url.toString());
    }
  };

  useEffect(() => {
    console.log('App mounted');
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
    <Router>
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
        <BacklinkFooter />
        <Toaster position="top-right" />
      </div>
    </Router>
  );
}

export default App;