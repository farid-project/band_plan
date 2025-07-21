import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Settings } from 'lucide-react';
import { notificationService } from '../services/notificationService';
import toast from 'react-hot-toast';

interface NotificationManagerProps {
  className?: string;
}

export const NotificationManager: React.FC<NotificationManagerProps> = ({ className = '' }) => {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setPermissionStatus(notificationService.getPermissionStatus());
  }, []);

  const handleEnableNotifications = async () => {
    const granted = await notificationService.requestPermission();
    
    if (granted) {
      setPermissionStatus('granted');
      toast.success('¡Notificaciones activadas!');
      
      // Send test notification
      await notificationService.sendTestNotification();
    } else {
      toast.error('Permisos de notificación denegados');
    }
  };

  const handleTestNotification = async () => {
    if (permissionStatus !== 'granted') {
      toast.error('Primero debes activar las notificaciones');
      return;
    }

    await notificationService.sendTestNotification();
    toast.success('Notificación de prueba enviada');
  };

  const getStatusIcon = () => {
    switch (permissionStatus) {
      case 'granted':
        return <Bell className="w-5 h-5 text-green-600" />;
      case 'denied':
        return <BellOff className="w-5 h-5 text-red-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (permissionStatus) {
      case 'granted':
        return 'Notificaciones activadas';
      case 'denied':
        return 'Notificaciones bloqueadas';
      default:
        return 'Notificaciones desactivadas';
    }
  };

  const getStatusColor = () => {
    switch (permissionStatus) {
      case 'granted':
        return 'text-green-600';
      case 'denied':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Status indicator */}
      <div className="flex items-center space-x-2">
        {getStatusIcon()}
        <span className={`text-sm ${getStatusColor()}`}>
          {getStatusText()}
        </span>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          title="Configurar notificaciones"
        >
          <Settings className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Settings dropdown */}
      {showSettings && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Configuración de Notificaciones
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Recibe recordatorios automáticos de tus eventos programados
              </p>
            </div>

            {permissionStatus !== 'granted' && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800 mb-2">
                  ¡Activa las notificaciones para no perderte ningún evento!
                </p>
                <button
                  onClick={handleEnableNotifications}
                  className="w-full bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Activar Notificaciones
                </button>
              </div>
            )}

            {permissionStatus === 'granted' && (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <div className="flex items-center space-x-2">
                    <Bell className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-800 font-medium">
                      Notificaciones activas
                    </span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    Recibirás recordatorios 24h, 2h y 30min antes de tus eventos
                  </p>
                </div>

                <button
                  onClick={handleTestNotification}
                  className="w-full bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Enviar notificación de prueba
                </button>
              </div>
            )}

            {permissionStatus === 'denied' && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex items-center space-x-2">
                  <BellOff className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-800 font-medium">
                    Notificaciones bloqueadas
                  </span>
                </div>
                <p className="text-sm text-red-700 mt-1">
                  Para activarlas, ve a la configuración de tu navegador y permite las notificaciones para este sitio.
                </p>
              </div>
            )}

            <div className="border-t pt-3">
              <p className="text-xs text-gray-500">
                Las notificaciones se envían automáticamente cuando tienes eventos programados. 
                Asegúrate de mantener esta pestaña abierta para recibir recordatorios.
              </p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={() => setShowSettings(false)}
            className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded-md"
          >
            <span className="sr-only">Cerrar</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};