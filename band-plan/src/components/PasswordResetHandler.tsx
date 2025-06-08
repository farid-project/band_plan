import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import Dashboard from '../pages/Dashboard';

export default function PasswordResetHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  useEffect(() => {
    const handlePasswordReset = async () => {
      const searchParams = new URLSearchParams(location.search);
      const code = searchParams.get('code');
      const token = searchParams.get('token');
      const type = searchParams.get('type');
      
      console.log('PasswordResetHandler: Verificando parámetros de recuperación', { 
        code: code ? 'presente' : 'ausente',
        token: token ? 'presente' : 'ausente',
        type
      });
      
      // Verificar si ya tenemos tokens guardados
      const storedToken = localStorage.getItem('recovery_token');
      const storedCode = localStorage.getItem('recovery_code');
      
      if (storedToken || storedCode) {
        console.log('PasswordResetHandler: Ya hay token/código guardado, redirigiendo a /reset-password');
        navigate('/reset-password', { replace: true });
        return;
      }
      
      // Manejar código de recuperación
      if (code) {
        console.log('PasswordResetHandler: Código de recuperación detectado');
        localStorage.setItem('recovery_code', code);
        
        try {
          // Cerrar sesión para evitar inicio automático
          await supabase.auth.signOut();
          console.log('PasswordResetHandler: Sesión cerrada, redirigiendo a /reset-password');
          navigate('/reset-password', { replace: true });
        } catch (error) {
          console.error('PasswordResetHandler: Error al cerrar sesión', error);
          navigate('/reset-password', { replace: true });
        }
        return;
      }
      
      // Manejar token de recuperación
      if (token && type === 'recovery') {
        console.log('PasswordResetHandler: Token de recuperación detectado');
        localStorage.setItem('recovery_token', token);
        
        try {
          // Cerrar sesión para evitar inicio automático
          await supabase.auth.signOut();
          console.log('PasswordResetHandler: Sesión cerrada, redirigiendo a /reset-password');
          navigate('/reset-password', { replace: true });
        } catch (error) {
          console.error('PasswordResetHandler: Error al cerrar sesión', error);
          navigate('/reset-password', { replace: true });
        }
        return;
      }
      
      // Si no hay código ni token y estamos en la página principal, redirigir al login
      if (location.pathname === '/') {
        navigate('/login', { replace: true });
      }
    };
    
    handlePasswordReset();
  }, [location, navigate]);

  // Si el usuario está autenticado, mostrar el dashboard
  if (user) {
    return <Dashboard />;
  }
  
  // Estado de carga mientras se redirige
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );
}
