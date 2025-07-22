import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeSubscriptionProps {
  table: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  onInsert?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  enabled?: boolean;
}

export function useRealtimeSubscription({
  table,
  filter,
  event = '*',
  onInsert,
  onUpdate,
  onDelete,
  onChange,
  enabled = true
}: UseRealtimeSubscriptionProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const channelName = `realtime-${table}-${filter || 'all'}`;
    
    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table,
          ...(filter && { filter })
        },
        (payload) => {
          console.log(`Realtime ${payload.eventType} on ${table}:`, payload);
          
          // Call specific event handlers
          if (payload.eventType === 'INSERT' && onInsert) {
            onInsert(payload);
          } else if (payload.eventType === 'UPDATE' && onUpdate) {
            onUpdate(payload);
          } else if (payload.eventType === 'DELETE' && onDelete) {
            onDelete(payload);
          }
          
          // Call generic change handler
          if (onChange) {
            onChange(payload);
          }
        }
      )
      .subscribe((status) => {
        console.log(`Subscription ${channelName} status:`, status);
      });

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [table, filter, event, onInsert, onUpdate, onDelete, onChange, enabled]);

  return {
    unsubscribe: () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    }
  };
}