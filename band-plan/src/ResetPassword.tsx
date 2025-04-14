import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
      
      setMessage('¡Contraseña actualizada correctamente!');
      
      // Cerrar sesión después de actualizar la contraseña
      setTimeout(async () => {
        await supabase.auth.signOut();
        // Redirigir al login después de 2 segundos
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }, 1000);
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
