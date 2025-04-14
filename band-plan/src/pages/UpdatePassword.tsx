import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import Input from '../components/Input';
import Button from '../components/Button';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Extract the code from the URL
  useEffect(() => {
    // The hash part of the URL will have the form #access_token=...&refresh_token=...&type=...
    // or the query parameter will have ?code=...
    const hash = location.hash;
    const searchParams = new URLSearchParams(location.search);
    const code = searchParams.get('code');

    if (!hash && !code) {
      setError('No se encontró un código de recuperación válido en la URL.');
    }
  }, [location]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      // Handle password recovery via direct reset link with type=recovery in the hash
      if (location.hash && location.hash.includes('type=recovery')) {
        // Extract and parse the hash parameters
        const hashParams = new URLSearchParams(location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        
        // Set the session with the access token from the URL
        if (accessToken) {
          // Get the current session
          const { error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) throw sessionError;
          
          // Now update the user password
          const { error } = await supabase.auth.updateUser({
            password: password
          });
          
          if (error) throw error;
        } else {
          throw new Error('No se encontró un token de acceso válido');
        }
      } 
      // Handle the case where we already have an active session
      else {
        // Try to update the password directly - this works if the user is already authenticated
        const { error } = await supabase.auth.updateUser({
          password: password
        });

        if (error) {
          // If direct update fails, we may need to handle the recovery token differently
          throw error;
        }
      }

      toast.success('Tu contraseña ha sido actualizada correctamente');
      navigate('/login', { replace: true });
    } catch (error: any) {
      setError(error.message || 'No se pudo actualizar la contraseña');
      toast.error(error.message || 'No se pudo actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white p-8 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          Actualizar Contraseña
        </h2>

        {error && (
          <div className="p-4 mb-6 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        <form onSubmit={handleUpdatePassword} className="space-y-6">
          <Input
            label="Nueva Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            autoComplete="new-password"
          />

          <Input
            label="Confirmar Contraseña"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="••••••••"
            autoComplete="new-password"
          />

          <Button type="submit" loading={loading} fullWidth>
            Actualizar Contraseña
          </Button>
        </form>
      </div>
    </div>
  );
}
