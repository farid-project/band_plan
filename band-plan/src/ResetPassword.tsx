import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const navigate = useNavigate();
  const { setUser, setSession } = useAuthStore();

  // Efecto para forzar el cierre de sesión inmediatamente al montar el componente
  useEffect(() => {
    const forceSignOut = async () => {
      // Verificar si hay un token de recuperación en la URL
      const hash = window.location.hash;
      const isRecovery = hash.includes('type=recovery');
      
      if (isRecovery) {
        // No cerramos sesión aquí porque necesitamos el token para actualizar la contraseña
        console.log('Flujo de recuperación de contraseña detectado');
      } else if (!resetSuccess) {
        // Si no es un flujo de recuperación y no se ha completado un reset exitoso,
        // redirigir al login
        navigate('/login');
      }
    };
    
    forceSignOut();
  }, [navigate, resetSuccess]);

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
      </form>
      {message && <p style={{ marginTop: 16 }}>{message}</p>}
    </div>
  );
}
