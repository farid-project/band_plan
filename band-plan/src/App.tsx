import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
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


function App() {
  const { setUser, setSession } = useAuthStore();

  // Efecto para detectar tokens de recuperación en la URL
  useEffect(() => {
    const handleRecoveryTokens = async () => {
      // Detectar si hay un token de recuperación en la URL, independientemente de la ruta
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const type = params.get('type');
      const code = params.get('code');
      const hash = window.location.hash;
      
      console.log('App: Verificando token en URL:', { 
        token: token ? token.substring(0, 10) + '...' : null, 
        type,
        code: code ? code.substring(0, 10) + '...' : null,
        hash: hash.length > 0 ? hash.substring(0, 20) + '...' : null 
      });
      
      // Verificar si estamos en un flujo de recuperación de contraseña
      const isPasswordRecovery = 
        (token && type === 'recovery') || 
        code || 
        (hash.includes('access_token=') && hash.includes('type=recovery'));
      
      // Si estamos en un flujo de recuperación, cerrar sesión inmediatamente
      if (isPasswordRecovery) {
        console.log('App: Flujo de recuperación detectado, cerrando sesión por seguridad');
        try {
          await supabase.auth.signOut();
          console.log('App: Sesión cerrada exitosamente');
        } catch (error) {
          console.error('App: Error al cerrar sesión:', error);
        }
      }
      
      // Guardar cualquier token de recuperación para uso posterior
      if (token && type === 'recovery') {
        console.log('App: Guardando token de recuperación en localStorage');
        localStorage.setItem('recovery_token', token);
      }
      
      // Verificar código de recuperación (formato común de Supabase)
      if (code && window.location.pathname !== '/reset-password') {
        console.log('App: Código de recuperación detectado, redirigiendo a /reset-password');
        localStorage.setItem('recovery_code', code);
        // Redirigir a la página de reset manteniendo los parámetros
        window.location.replace(`/reset-password?code=${code}`);
        return;
      }
      
      // Verificar token PKCE en parámetros de consulta
      if (token && type === 'recovery' && window.location.pathname !== '/reset-password') {
        console.log('App: Token PKCE de recuperación detectado, redirigiendo a /reset-password');
        // Redirigir a la página de reset manteniendo los parámetros
        window.location.replace(`/reset-password?token=${token}&type=${type}`);
        return;
      }
      
      // Verificar token en hash (formato alternativo)
      if (hash.includes('access_token=') && hash.includes('type=recovery') && window.location.pathname !== '/reset-password') {
        console.log('App: Token hash de recuperación detectado, redirigiendo a /reset-password');
        window.location.replace('/reset-password' + hash);
        return;
      }
    };
    
    handleRecoveryTokens();
  }, []);

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
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          </Routes>
        </main>
        <Toaster position="top-right" />
      </div>
    </Router>
  );
}

export default App;