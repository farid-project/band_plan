import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import Input from '../components/Input';
import Button from '../components/Button';

export default function ManualPasswordReset() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  // No need for useEffect anymore since we're just asking for the email
  // and sending a new reset link

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!email) {
      toast.error('Por favor ingresa tu dirección de email');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      // Intento 1: Iniciar sesión con este email (puede funcionar si es el email correcto)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: 'password-temporal-que-no-deberia-funcionar'
      });

      // Intento 2: Si no funciona, enviar un nuevo enlace
      if (signInError) {
        // Enviar un nuevo correo de recuperación
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/update-password'
        });

        if (resetError) throw resetError;

        toast.success('Te hemos enviado un nuevo enlace de recuperación. Por favor revisa tu correo y sigue las instrucciones.');
        navigate('/login', { replace: true });
        return;
      }

      // Si llegamos aquí, el inicio de sesión funcionó (muy improbable)
      // Actualizar la contraseña inmediatamente
      const { error: updateError } = await supabase.auth.updateUser({
        password
      });

      if (updateError) throw updateError;

      toast.success('Tu contraseña ha sido actualizada correctamente');
      navigate('/login', { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Error al restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white p-8 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          Restablecer Contraseña
        </h2>

        <div className="mb-6 p-4 bg-yellow-50 text-yellow-700 rounded-md">
          Para restablecer tu contraseña, por favor introduce tu correo electrónico y la nueva contraseña.
          Te enviaremos un enlace para confirmar el cambio.
        </div>
        
        <form onSubmit={handleResetPassword} className="space-y-6">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="tu@email.com"
          />

          <Input
            label="Nueva Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />

          <Input
            label="Confirmar Contraseña"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="••••••••"
          />

          <Button type="submit" loading={loading} fullWidth>
            Cambiar Contraseña
          </Button>

          <div className="text-center text-sm">
            <button 
              type="button" 
              onClick={() => navigate('/login')} 
              className="text-indigo-600 hover:text-indigo-500"
            >
              Volver a iniciar sesión
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
