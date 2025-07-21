import { supabase } from '../lib/supabase';

export interface EventReminder {
  id: string;
  event_id: string;
  group_member_id: string;
  reminder_type: '24h' | '2h' | '30min';
  event_title: string;
  event_datetime: string;
  member_name: string;
  group_name: string;
}

export class NotificationService {
  private static instance: NotificationService;
  private permission: NotificationPermission = 'default';
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.init();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async init() {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return;
    }

    this.permission = Notification.permission;

    // Start checking for pending reminders every minute
    this.startReminderPolling();
  }

  public async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    const permission = await Notification.requestPermission();
    this.permission = permission;
    return permission === 'granted';
  }

  public async showNotification(title: string, options: NotificationOptions = {}): Promise<void> {
    if (this.permission !== 'granted') {
      const granted = await this.requestPermission();
      if (!granted) {
        console.warn('Notification permission denied');
        return;
      }
    }

    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });

    // Auto-close notification after 10 seconds
    setTimeout(() => {
      notification.close();
    }, 10000);
  }

  private startReminderPolling() {
    // Check every minute for pending reminders
    this.checkInterval = setInterval(() => {
      this.checkPendingReminders();
    }, 60000);

    // Check immediately
    this.checkPendingReminders();
  }

  private async checkPendingReminders() {
    try {
      const { data: reminders, error } = await supabase
        .rpc('get_pending_reminders');

      if (error) {
        console.error('Error fetching pending reminders:', error);
        return;
      }

      for (const reminder of reminders as EventReminder[]) {
        await this.sendReminderNotification(reminder);
        
        // Mark as sent
        await supabase.rpc('mark_reminder_sent', {
          reminder_id: reminder.id
        });
      }
    } catch (error) {
      console.error('Error checking reminders:', error);
    }
  }

  private async sendReminderNotification(reminder: EventReminder) {
    const eventDate = new Date(reminder.event_datetime);
    const timeString = eventDate.toLocaleString();
    
    const titles = {
      '24h': '📅 Evento mañana',
      '2h': '⏰ Evento en 2 horas',
      '30min': '🚨 Evento en 30 minutos'
    };

    const messages = {
      '24h': `Recuerda: "${reminder.event_title}" mañana a las ${eventDate.toLocaleTimeString()}`,
      '2h': `¡Prepárate! "${reminder.event_title}" en 2 horas`,
      '30min': `¡Ya casi! "${reminder.event_title}" en 30 minutos`
    };

    await this.showNotification(titles[reminder.reminder_type], {
      body: messages[reminder.reminder_type],
      tag: `event-${reminder.event_id}-${reminder.reminder_type}`,
      data: {
        eventId: reminder.event_id,
        type: 'event-reminder'
      },
      actions: [
        {
          action: 'view',
          title: 'Ver evento'
        },
        {
          action: 'dismiss',
          title: 'Descartar'
        }
      ]
    });
  }

  public stopReminderPolling() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // Manual method to send test notification
  public async sendTestNotification() {
    await this.showNotification('🎵 Band Plan', {
      body: 'Las notificaciones están funcionando correctamente',
      tag: 'test-notification'
    });
  }

  // Get notification permission status
  public getPermissionStatus(): NotificationPermission {
    return this.permission;
  }

  // Schedule a custom reminder for an event
  public async scheduleEventReminder(eventId: string, title: string, datetime: string, reminderTypes: string[] = ['24h', '2h', '30min']) {
    // This would typically be handled by the database trigger,
    // but we can also allow manual scheduling
    try {
      const { error } = await supabase
        .from('event_reminders')
        .insert(
          reminderTypes.map(type => ({
            event_id: eventId,
            reminder_type: type,
            scheduled_for: this.calculateReminderTime(datetime, type),
            notification_method: 'browser'
          }))
        );

      if (error) {
        console.error('Error scheduling reminders:', error);
        throw error;
      }
    } catch (error) {
      console.error('Failed to schedule event reminder:', error);
      throw error;
    }
  }

  private calculateReminderTime(eventDateTime: string, reminderType: string): string {
    const eventDate = new Date(eventDateTime);
    const reminderDate = new Date(eventDate);

    switch (reminderType) {
      case '24h':
        reminderDate.setHours(reminderDate.getHours() - 24);
        break;
      case '2h':
        reminderDate.setHours(reminderDate.getHours() - 2);
        break;
      case '30min':
        reminderDate.setMinutes(reminderDate.getMinutes() - 30);
        break;
    }

    return reminderDate.toISOString();
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();