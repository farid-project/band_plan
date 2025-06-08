import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import Dashboard from '../pages/Dashboard';

export default function PasswordResetHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  useEffect(() => {
    // Check if there's a code parameter in the URL (password reset flow)
    const searchParams = new URLSearchParams(location.search);
    const code = searchParams.get('code');
    
    if (code) {
      console.log('Code detected in URL, handling password reset');
      
      // Supabase automáticamente inicia sesión cuando usas el enlace 
      // Desconectamos al usuario primero y luego redirigimos
      const handleResetFlow = async () => {
        try {
          // Guardar el código de recuperación en localStorage para permitir múltiples intentos
          localStorage.setItem('recovery_token', code);
          console.log('Código de recuperación guardado en localStorage');
          
          // Forzar cierre de sesión primero para evitar inicio de sesión automático
          await supabase.auth.signOut();
          
          // Redirigir a la página manual de restablecimiento
          navigate('/update-password-manual', { 
            replace: true,
            state: { resetCode: code }
          });
        } catch (err) {
          console.error('Error preparing reset flow:', err);
          toast.error('Error al preparar el flujo de recuperación');
          navigate('/login', { replace: true });
        }
      };
      
      handleResetFlow();
      return;
    }
    
    // If no code is present and the user is not logged in, redirect to login
    if (!user && !code && location.pathname === '/') {
      navigate('/login', { replace: true });
    }
  }, [location, navigate, user]);

  // If there's no code, render the normal dashboard if user is logged in
  if (user) {
    return <Dashboard />;
  }
  
  // This is just a loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );
}
