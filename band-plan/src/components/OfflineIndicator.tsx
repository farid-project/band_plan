import React from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

interface OfflineIndicatorProps {
  className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ className = '' }) => {
  const { isOnline } = usePWA();

  if (isOnline) {
    return null;
  }

  return (
    <div className={`bg-red-500 text-white px-4 py-2 text-sm font-medium flex items-center justify-center space-x-2 ${className}`}>
      <WifiOff className="w-4 h-4" />
      <span>Sin conexión - Trabajando offline</span>
    </div>
  );
};

// Connection status component for navbar
export const ConnectionStatus: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isOnline } = usePWA();

  return (
    <div className={`flex items-center space-x-1 ${className}`} title={isOnline ? 'Conectado' : 'Sin conexión'}>
      {isOnline ? (
        <Wifi className="w-4 h-4 text-green-500" />
      ) : (
        <WifiOff className="w-4 h-4 text-red-500" />
      )}
      <span className={`text-xs ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
};