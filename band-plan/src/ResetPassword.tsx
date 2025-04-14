import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';

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
        // Verificar si tenemos una sesión de Supabase activa
        const { data } = await supabase.auth.getSession();
        
        // Verificar si hay un token en la URL (parámetros de consulta)
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        const type = params.get('type');
        
        console.log('URL params:', { token: token?.substring(0, 10) + '...', type });
        console.log('Sesión activa:', !!data.session);
        
        // Comprobar si estamos en un flujo de recuperación válido
        if (token && type === 'recovery') {
          console.log('Token de recuperación válido detectado en URL');
          setCanResetPassword(true);
        } else if (data.session) {
          // Si hay una sesión activa y estamos en la página de reset, probablemente
          // el usuario ya ha sido autenticado por Supabase automáticamente
          console.log('Sesión activa detectada, permitiendo reset de contraseña');
          setCanResetPassword(true);
        } else if (!resetSuccess) {
          // No hay token válido ni sesión activa
          console.log('No hay token de recuperación válido ni sesión activa');
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
      setMessage('¡Contraseña actualizada correctamente! Cerrando sesión...');
      
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
    <div style={{ maxWidth: 400, margin: 'auto', padding: 32 }}>
      <h2>Restablecer contraseña</h2>
      
      {canResetPassword ? (
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Nueva contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ width: '100%', marginBottom: 12, padding: 8 }}
          />
          <button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
          {message && <p style={{ marginTop: 16 }}>{message}</p>}
        </form>
      ) : (
        <div>
          <p style={{ marginBottom: 16 }}>
            Esperando verificación del token de recuperación...
          </p>
          <p style={{ fontSize: '0.9em', color: '#666' }}>
            Si no eres redirigido automáticamente, solicita un nuevo enlace de recuperación.
          </p>
        </div>
      )}
    </div>
  );
}
