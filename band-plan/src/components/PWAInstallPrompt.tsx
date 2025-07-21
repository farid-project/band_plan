import React from 'react';
import { Download, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';
import toast from 'react-hot-toast';

interface PWAInstallPromptProps {
  className?: string;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ className = '' }) => {
  const { canInstall, isInstalled, isOnline, installApp } = usePWA();

  const handleInstall = async () => {
    const success = await installApp();
    
    if (success) {
      toast.success('¡App instalada correctamente!');
    } else {
      toast.error('No se pudo instalar la app');
    }
  };

  // Don't show if already installed
  if (isInstalled) {
    return null;
  }

  // Don't show if can't install
  if (!canInstall) {
    return null;
  }

  return (
    <div className={`bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg p-4 shadow-lg ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <Smartphone className="w-8 h-8" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-semibold">¡Instala Band Manager!</h3>
            <div className="flex items-center space-x-1">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-green-300" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-300" />
              )}
            </div>
          </div>
          
          <p className="text-indigo-100 text-sm mb-3">
            Instala la app en tu dispositivo para:
          </p>
          
          <ul className="text-indigo-100 text-sm space-y-1 mb-4">
            <li className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-indigo-200 rounded-full"></span>
              <span>Acceso rápido desde tu pantalla principal</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-indigo-200 rounded-full"></span>
              <span>Funciona sin conexión a internet</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-indigo-200 rounded-full"></span>
              <span>Notificaciones automáticas</span>
            </li>
          </ul>
          
          <div className="flex space-x-3">
            <button
              onClick={handleInstall}
              className="flex items-center space-x-2 bg-white text-indigo-600 px-4 py-2 rounded-md font-medium hover:bg-indigo-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Instalar App</span>
            </button>
            
            <button
              onClick={() => {
                // Hide the prompt (you could store this in localStorage)
                const prompt = document.querySelector('[data-pwa-prompt]') as HTMLElement;
                if (prompt) {
                  prompt.style.display = 'none';
                }
              }}
              className="text-indigo-200 hover:text-white transition-colors text-sm px-2"
            >
              Más tarde
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;