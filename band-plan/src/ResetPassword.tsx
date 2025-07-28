import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from './lib/supabase';
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

  // Efecto para verificar la sesión y el token de recuperación
  useEffect(() => {
    const checkAuthAndToken = async () => {
      
      try {
        // Verificar si tenemos una sesión de Supabase activa
        const { data } = await supabase.auth.getSession();
        
        // Verificar si hay un token en la URL (parámetros de consulta)
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        const type = params.get('type');
        
        // Verificar si hay un código de recuperación en el state (enviado desde PasswordResetHandler)
        const resetCode = location.state?.resetCode;
        
        // Verificar si hay un token guardado en localStorage
        const storedToken = localStorage.getItem('recovery_token');
        
        
        // Comprobar si estamos en un flujo de recuperación válido (múltiples opciones)
        if (token && type === 'recovery') {
          setCanResetPassword(true);
        } else if (resetCode) {
          setCanResetPassword(true);
          
          // Intentar verificar el código OTP
          try {
            await supabase.auth.verifyOtp({
              token_hash: resetCode,
              type: 'recovery'
            });
          } catch (otpError) {
            // Continuamos aunque falle, ya que podríamos tener una sesión válida
          }
        } else if (storedToken) {
          setCanResetPassword(true);
          localStorage.removeItem('recovery_token'); // Limpiar después de usar
          
          // Intentar verificar el código OTP
          try {
            await supabase.auth.verifyOtp({
              token_hash: storedToken,
              type: 'recovery'
            });
          } catch (otpError) {
            // Continuamos aunque falle, ya que podríamos tener una sesión válida
          }
        } else if (data.session) {
          // Si hay una sesión activa y estamos en la página de reset, probablemente
          // el usuario ya ha sido autenticado por Supabase automáticamente
          setCanResetPassword(true);
        } else if (!resetSuccess) {
          // No hay token válido ni sesión activa
          navigate('/login');
        }
      } catch (error) {
        console.error('Error al verificar autenticación:', error);
        navigate('/login');
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
      setMessage('¡Contraseña actualizada correctamente! Redirigiendo al inicio...');
      
      // Mantener la sesión iniciada y redirigir al inicio
      // Nota: No cerramos la sesión, mantenemos al usuario autenticado
      
      // Redirigir después de un breve retraso
      setTimeout(() => {
        navigate('/', { replace: true });
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
