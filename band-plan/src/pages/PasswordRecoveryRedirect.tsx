import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

/**
 * Este componente es una página de aterrizaje para los enlaces de recuperación de contraseña
 * que vienen de producción pero necesitan ser redirigidos a la versión local para pruebas.
 */
export default function PasswordRecoveryRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    // Mostrar mensaje informativo
    toast.success('Redirigiendo a la página de recuperación de contraseña local...');
    
    // Redirigir a la página de recuperación manual
    navigate('/update-password-manual', { replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirigiendo a la página de recuperación de contraseña...</p>
      </div>
    </div>
  );
}
