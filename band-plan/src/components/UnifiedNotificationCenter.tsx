import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Settings, Wifi, WifiOff, X } from 'lucide-react';
import { notificationService } from '../services/notificationService';
import { usePWA } from '../hooks/usePWA';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  data: {
    group_id: string;
    group_name: string;
    group_member_id: string;
    role: string;
  };
}

export const UnifiedNotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isOnline } = usePWA();
  
  // Notification states
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  
  // Reminder notification states
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [showReminderSettings, setShowReminderSettings] = useState(false);

  useEffect(() => {
    if (user) {
      setPermissionStatus(notificationService.getPermissionStatus());
      fetchNotifications();
      setupRealtimeSubscription();

      return () => {
        if (channel) {
          channel.unsubscribe();
        }
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user?.id)
      .eq('read', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    setNotifications(data || []);
  };

  const setupRealtimeSubscription = async () => {
    try {
      if (channel) {
        await channel.unsubscribe();
      }

      const newChannel = supabase.channel(`notifications:${user?.id}`, {
        config: {
          broadcast: { self: true }
        }
      });

      newChannel
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`
        }, (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          
          toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-white shadow-lg rounded-lg p-4 flex items-center space-x-3`}>
              <Bell className="h-6 w-6 text-indigo-500" />
              <div>
                <p className="font-medium">{newNotification.title}</p>
                <p className="text-sm text-gray-500">{newNotification.message}</p>
              </div>
            </div>
          ), {
            duration: 5000,
            position: 'top-right'
          });
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`
        }, (payload) => {
          setNotifications(prev => 
            prev.map(n => n.id === payload.new.id ? payload.new as Notification : n)
          );
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`
        }, (payload) => {
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
        });

      await newChannel.subscribe();
      setChannel(newChannel);
    } catch (error) {
      console.error('Error al configurar suscripción en tiempo real:', error);
    }
  };

  const handleInvitation = async (notification: Notification, accept: boolean) => {
    try {
      const { error } = await supabase.rpc('handle_group_invitation', {
        p_group_member_id: notification.data.group_member_id,
        p_accept: accept
      });

      if (error) throw error;

      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notification.id);

      setNotifications(prev => prev.filter(n => n.id !== notification.id));

      toast.success(accept ? 'Invitación aceptada' : 'Invitación rechazada');
      
      if (accept) {
        navigate(`/group/${notification.data.group_id}`);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEnableReminders = async () => {
    const granted = await notificationService.requestPermission();
    
    if (granted) {
      setPermissionStatus('granted');
      toast.success('¡Recordatorios activados!');
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

  const getConnectionIcon = () => {
    return isOnline ? (
      <Wifi className="w-4 h-4 text-green-500" />
    ) : (
      <WifiOff className="w-4 h-4 text-red-500" />
    );
  };

  const getNotificationIcon = () => {
    const hasUnread = notifications.length > 0;
    const hasReminders = permissionStatus === 'granted';
    
    if (hasReminders) {
      return <Bell className="w-5 h-5 text-white" />;
    } else if (hasUnread) {
      return <Bell className="w-5 h-5 text-yellow-300" />;
    } else {
      return <BellOff className="w-5 h-5 text-gray-300" />;
    }
  };

  return (
    <div className="relative">
      {/* Main notification button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-white hover:text-indigo-200 rounded-lg hover:bg-indigo-700 transition-colors"
        title="Centro de notificaciones"
      >
        <div className="flex items-center space-x-2">
          {getConnectionIcon()}
          {getNotificationIcon()}
        </div>
        
        {/* Notification badge */}
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform bg-red-600 rounded-full">
            {notifications.length}
          </span>
        )}
        
        {/* Reminder status indicator */}
        {permissionStatus === 'granted' && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-green-400 border-2 border-indigo-600 rounded-full"></span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg z-50 border border-gray-200">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Centro de Notificaciones</h3>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 text-xs">
                  {getConnectionIcon()}
                  <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <button
                  onClick={() => setShowDropdown(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {/* Reminder Settings Section */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Recordatorios de Eventos</span>
                <button
                  onClick={() => setShowReminderSettings(!showReminderSettings)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Settings className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              
              <div className="flex items-center space-x-2">
                {permissionStatus === 'granted' ? (
                  <div className="flex items-center space-x-2">
                    <Bell className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600">Activos</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <BellOff className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Desactivados</span>
                  </div>
                )}
              </div>

              {/* Reminder settings expanded */}
              {showReminderSettings && (
                <div className="mt-3 space-y-2">
                  {permissionStatus !== 'granted' ? (
                    <button
                      onClick={handleEnableReminders}
                      className="w-full bg-indigo-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                      Activar Recordatorios
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="bg-green-50 border border-green-200 rounded p-2">
                        <p className="text-xs text-green-700">
                          Recibirás recordatorios 24h, 2h y 30min antes de tus eventos
                        </p>
                      </div>
                      <button
                        onClick={handleTestNotification}
                        className="w-full bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-200 transition-colors"
                      >
                        Probar notificación
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Invitations Section */}
            <div className="p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Invitaciones de Grupo</h4>
              
              {notifications.length === 0 ? (
                <div className="text-center py-4">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-500 text-sm">No hay invitaciones pendientes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map(notification => (
                    <div key={notification.id} className="p-3 border border-gray-200 rounded-lg">
                      <h5 className="font-medium text-gray-900 text-sm">{notification.title}</h5>
                      <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                      {notification.type === 'group_invitation' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleInvitation(notification, true)}
                            className="flex-1 px-3 py-1.5 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
                          >
                            Aceptar
                          </button>
                          <button
                            onClick={() => handleInvitation(notification, false)}
                            className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};