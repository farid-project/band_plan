import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import Input from './components/Input';
import Button from './components/Button';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [canResetPassword, setCanResetPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, setSession } = useAuthStore();

  // Efecto para verificar la sesión y el token de recuperación
  useEffect(() => {
    const checkAuthAndToken = async () => {
      console.log('Verificando autenticación para reset de contraseña');
      
      try {
        // Verificar si hay un token o código en la URL (parámetros de consulta)
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        const type = params.get('type');
        const code = params.get('code');
        
        // También verificar si hay tokens guardados en localStorage
        const storedToken = localStorage.getItem('recovery_token');
        const storedCode = localStorage.getItem('recovery_code');
        
        // Verificar si tenemos una sesión de Supabase activa
        const { data } = await supabase.auth.getSession();
        
        console.log('URL params:', { 
          token: token ? (token.substring(0, 10) + '...') : null, 
          type,
          code: code ? (code.substring(0, 10) + '...') : null 
        });
        console.log('Sesión activa:', !!data.session);
        console.log('Token almacenado:', !!storedToken);
        console.log('Código almacenado:', !!storedCode);
        
        // Si ya hemos completado el reset exitosamente, no hacer nada más
        if (resetSuccess) {
          console.log('Reset ya completado exitosamente');
          return;
        }
        
        // Comprobar primero si hay un token o código guardado
        // Esto es importante para mantener el estado entre visitas
        if (storedToken || storedCode) {
          console.log('Token o código de recuperación encontrado en localStorage');
          setCanResetPassword(true);
          return;
        }
        
        // Intentar verificar el código OTP si está presente
        if (code) {
          console.log('Código OTP detectado en URL, intentando verificar');
          try {
            // Guardar el código inmediatamente para evitar perderlo
            localStorage.setItem('recovery_code', code);
            
            const { error } = await supabase.auth.verifyOtp({
              token_hash: code,
              type: 'recovery'
            });
            
            if (!error) {
              console.log('Código OTP verificado correctamente');
              setCanResetPassword(true);
              return;
            } else {
              console.error('Error al verificar OTP:', error);
              // Aún si hay error, mantener el código para intentos posteriores
              setCanResetPassword(true);
              return;
            }
          } catch (otpError) {
            console.error('Error al procesar OTP:', otpError);
            // Aún si hay error, mantener el código para intentos posteriores
            setCanResetPassword(true);
            return;
          }
        }
        
        // Comprobar si estamos en un flujo de recuperación válido con token
        if (token && type === 'recovery') {
          console.log('Token de recuperación válido detectado en URL');
          // Guardar el token para uso posterior si el usuario no completa el proceso
          localStorage.setItem('recovery_token', token);
          setCanResetPassword(true);
          return;
        }
        
        // Si hay una sesión activa, permitir el reset
        if (data.session) {
          console.log('Sesión activa detectada, permitiendo reset de contraseña');
          setCanResetPassword(true);
          return;
        }
        
        // Si llegamos aquí, no hay token válido ni sesión activa
        console.log('No hay token de recuperación válido ni sesión activa');
        navigate('/login');
      } catch (error) {
        console.error('Error al verificar autenticación:', error);
        // Verificar si tenemos tokens guardados antes de redirigir
        const storedToken = localStorage.getItem('recovery_token');
        const storedCode = localStorage.getItem('recovery_code');
        
        if (storedToken || storedCode) {
          console.log('A pesar del error, hay token guardado, intentando continuar');
          setCanResetPassword(true);
        } else {
          navigate('/login');
        }
      }
    };
    
    checkAuthAndToken();
  }, [location, navigate, resetSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      // Actualizar la contraseña
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        throw error;
      }
      
      setResetSuccess(true);
      setMessage('¡Contraseña actualizada correctamente! Cerrando sesión...');
      
      // Eliminar todos los tokens de recuperación almacenados solo después de un cambio exitoso
      localStorage.removeItem('recovery_token');
      localStorage.removeItem('recovery_code');
      
      // Cierre de sesión inmediato y completo
      await supabase.auth.signOut();
      
      // Limpiar el estado de autenticación en la store
      setUser(null);
      setSession(null);
      
      // Redirigir después de un breve retraso
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } catch (error: any) {
      setMessage('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white p-8 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          Restablecer contraseña
        </h2>
        
        {canResetPassword ? (
          <>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Nueva contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
              
              <Button type="submit" loading={loading} fullWidth>
                Actualizar contraseña
              </Button>
            </form>
            
            {message && (
              <div className={`mt-4 p-3 rounded-lg ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {message}
              </div>
            )}
          </>
        ) : (
          <div className="py-6 text-center">
            <div className="animate-pulse inline-block p-3 mb-4 rounded-full bg-indigo-100">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-gray-700 mb-2">
              Verificando token de recuperación...
            </p>
            <p className="text-sm text-gray-500">
              Si no eres redirigido automáticamente, solicita un 
              <Link to="/forgot-password" className="text-indigo-600 hover:text-indigo-500"> nuevo enlace</Link>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
