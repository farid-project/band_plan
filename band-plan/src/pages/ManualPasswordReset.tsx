import React, { useState, useEffect } from 'react';
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
  const [isProcessingReset, setIsProcessingReset] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const checkRecoveryTokens = async () => {
      // Verificar si hay un código de recuperación en localStorage
      const storedToken = localStorage.getItem('recovery_token');
      const storedCode = localStorage.getItem('recovery_code');
      
      console.log('ManualPasswordReset: Verificando tokens almacenados', { 
        storedToken: !!storedToken, 
        storedCode: !!storedCode 
      });
      
      // Si hay un token o código almacenado, permitir el cambio de contraseña
      if (storedToken || storedCode) {
        console.log('ManualPasswordReset: Token o código encontrado, permitiendo cambio de contraseña');
        setResetSuccess(true);
        return true;
      }
      
      // Verificar si hay un código en la URL
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      
      if (code) {
        console.log('ManualPasswordReset: Código detectado en URL, intentando verificar');
        setIsProcessingReset(true);
        
        try {
          // Guardar el código inmediatamente para futuros intentos
          localStorage.setItem('recovery_code', code);
          
          // Intentar verificar el código
          const { error } = await supabase.auth.verifyOtp({
            token_hash: code,
            type: 'recovery'
          });
          
          if (error) {
            console.error('Error al verificar OTP:', error);
            toast.error('El código de recuperación no es válido o ha expirado');
            setIsProcessingReset(false);
            return false;
          }
          
          // Si llegamos aquí, el código es válido
          console.log('ManualPasswordReset: Código verificado correctamente');
          setResetSuccess(true);
          toast.success('Ahora puedes cambiar tu contraseña');
          setIsProcessingReset(false);
          return true;
        } catch (err) {
          console.error('Error al procesar el código de recuperación:', err);
          toast.error('Ocurrió un error al procesar tu solicitud');
          setIsProcessingReset(false);
          return false;
        }
      }
      
      // Si no hay token ni código, devolver false
      return false;
    };
    
    // Ejecutar la verificación y redirigir si es necesario
    checkRecoveryTokens().then(hasValidToken => {
      if (!hasValidToken) {
        console.log('ManualPasswordReset: No hay token ni código válido, redirigiendo al login');
        navigate('/login');
      }
    });
  }, [navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Si estamos en modo de recuperación exitosa (con código válido)
    if (resetSuccess) {
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
        // Actualizar la contraseña directamente (esto funciona porque ya verificamos el código)
        const { error } = await supabase.auth.updateUser({
          password
        });

        if (error) throw error;

        toast.success('Tu contraseña ha sido actualizada correctamente');
        
        // Eliminar todos los tokens de recuperación solo después de un cambio exitoso
        localStorage.removeItem('recovery_token');
        localStorage.removeItem('recovery_code');
        
        console.log('ManualPasswordReset: Tokens de recuperación eliminados después de cambio exitoso');
        
        // Cerrar sesión para forzar un nuevo inicio de sesión con la nueva contraseña
        await supabase.auth.signOut();
        
        navigate('/login', { replace: true });
      } catch (error: any) {
        toast.error(error.message || 'Error al actualizar la contraseña');
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // Modo normal (sin código de recuperación)
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
      // Enviar un correo de recuperación
      // Usamos la URL del proxy de vista previa para pruebas locales
      const redirectUrl = 'http://127.0.0.1:54582/recovery';
        
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });

      if (resetError) throw resetError;

      toast.success('Te hemos enviado un enlace de recuperación. Por favor revisa tu correo y sigue las instrucciones.');
      navigate('/login', { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Error al restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  // Si estamos procesando el código de recuperación, mostrar un spinner
  if (isProcessingReset) {
    return (
      <div className="max-w-md mx-auto mt-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white p-8 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          {resetSuccess ? 'Cambiar Contraseña' : 'Restablecer Contraseña'}
        </h2>

        {resetSuccess ? (
          <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-md">
            Tu identidad ha sido verificada. Ahora puedes establecer una nueva contraseña.
          </div>
        ) : (
          <div className="mb-6 p-4 bg-yellow-50 text-yellow-700 rounded-md">
            Para restablecer tu contraseña, por favor introduce tu correo electrónico y la nueva contraseña.
            Te enviaremos un enlace para confirmar el cambio.
          </div>
        )}
        
        <form onSubmit={handleResetPassword} className="space-y-6">
          {!resetSuccess && (
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
            />
          )}

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
            {resetSuccess ? 'Actualizar Contraseña' : 'Enviar Enlace de Recuperación'}
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
