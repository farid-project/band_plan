import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Input from '../components/Input';
import Button from '../components/Button';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage('');

    try {
      // Usamos la ruta específica para recuperación
      // Usamos la URL del proxy de vista previa para pruebas locales
      const redirectUrl = 'http://127.0.0.1:54582/recovery';
        
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      setSuccessMessage('Se ha enviado un enlace de recuperación a tu correo electrónico.');
      toast.success('Revisa tu correo electrónico para restablecer tu contraseña');
    } catch (error: any) {
      toast.error(error.message || 'No se pudo enviar el enlace de recuperación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white p-8 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          Recuperar Contraseña
        </h2>
        
        {successMessage ? (
          <div className="space-y-6">
            <div className="p-4 bg-green-50 text-green-700 rounded-md">
              {successMessage}
            </div>
            <div className="text-center">
              <Link to="/login" className="text-indigo-600 hover:text-indigo-500">
                Volver a iniciar sesión
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <p className="text-sm text-gray-600 mb-4">
              Introduce tu dirección de correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
            </p>
            
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
            />

            <Button type="submit" loading={loading} fullWidth>
              Enviar enlace de recuperación
            </Button>
            
            <div className="text-center text-sm">
              <Link to="/login" className="text-indigo-600 hover:text-indigo-500">
                Volver a iniciar sesión
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
