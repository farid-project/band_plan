import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import Button from '../components/Button';

/**
 * Este componente es una página de aterrizaje para los enlaces de recuperación de contraseña
 * que vienen de producción pero necesitan ser redirigidos a la versión local para pruebas.
 */
export default function PasswordRecoveryRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    // Verificar si hay un error en la URL
    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.replace('#', ''));
    
    const urlError = searchParams.get('error') || hashParams.get('error');
    const errorCode = searchParams.get('error_code') || hashParams.get('error_code');
    
    if (urlError === 'access_denied' || errorCode === 'otp_expired') {
      setIsExpired(true);
      toast.error('El enlace de recuperación ha expirado o no es válido');
    } else {
      // Si no hay error, redirigir a la página de recuperación manual
      toast.success('Redirigiendo a la página de recuperación de contraseña...');
      navigate('/update-password-manual', { replace: true });
    }
  }, [navigate, location]);

  if (isExpired) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
            Enlace Expirado
          </h2>
          
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md">
            El enlace de recuperación de contraseña ha expirado o no es válido. 
            Por favor, solicita un nuevo enlace de recuperación.
          </div>
          
          <div className="space-y-4">
            <Button 
              onClick={() => navigate('/reset-password')} 
              fullWidth
            >
              Solicitar Nuevo Enlace
            </Button>
            
            <div className="text-center text-sm">
              <Link to="/login" className="text-indigo-600 hover:text-indigo-500">
                Volver a iniciar sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirigiendo a la página de recuperación de contraseña...</p>
      </div>
    </div>
  );
}
