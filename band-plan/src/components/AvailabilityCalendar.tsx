import { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import { supabase } from '../lib/supabase';
import { safeSupabaseRequest } from '../lib/supabaseUtils';
import { useAuthStore } from '../store/authStore';
import { DayPicker } from 'react-day-picker';
import { format, isSameDay, startOfMonth, endOfMonth } from 'date-fns';
// Eliminamos importaciones no utilizadas
import { toast } from 'react-hot-toast';
import { Loader2, ChevronDown, Music, Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import 'react-day-picker/dist/style.css';
import { GroupMember } from '../types';
import { useParams } from 'react-router-dom';
import { es } from 'date-fns/locale';

interface MemberAvailability {
  userId: string | null; // Can be null for local members
  memberId: string; // Always present - group_member.id
  memberName: string;
  dates: Date[];
  instruments: { id: string; name: string; }[];
  roleInBand: 'principal' | 'sustituto';
  memberType: 'registered' | 'local';
}

interface MemberEvent {
  event_id: number;
  date: string;
  user_id: string;
  name: string;
  group_id: string;
}

interface AvailabilityCalendarProps {
  members: GroupMember[];
  onAvailableDatesChange?: (dates: Date[]) => void;
  groupName?: string;
}

export default function AvailabilityCalendar({ 
  members,
  onAvailableDatesChange,
  groupName = 'Sin nombre'
}: AvailabilityCalendarProps) {
  // Añadimos estilos CSS para la aplicación
  const dayPickerStyles = `
    /* Estilos para el calendario */
    .rdp {
      transition: none !important;
    }
    
    /* Contenedor del calendario con altura fija para evitar saltos */
    .calendar-container {
      min-height: 380px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    /* Capa de carga */
    .calendar-loading-overlay {
      position: absolute;
      inset: 0;
      background-color: rgba(255, 255, 255, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      border-radius: 0.5rem;
    }
    
    /* Estilos para días seleccionados - con mayor especificidad para garantizar que se apliquen */
    .rdp-day_selected:not([disabled]), 
    .rdp-day_selected:hover:not([disabled]),
    .rdp-day_selected:focus:not([disabled]) { 
      font-weight: bold !important;
      box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.5) !important;
    }
    
    /* Separamos los estilos para que el fondo no afecte a la visualización de los puntos */
    .rdp-day_selected .day-content:not(.selected-day),
    .rdp-day_selected:hover .day-content:not(.selected-day),
    .rdp-day_selected:focus .day-content:not(.selected-day) {
      background-color: #4f46e5 !important;
    }
    
    /* Estilos para días con eventos externos */
    .has-external-events {
      position: relative;
    }
    
    .has-external-events::after {
      content: '';
      position: absolute;
      top: 1px;
      left: 1px;
      right: 1px;
      bottom: 1px;
      border: 2px dashed #f97316;
      border-radius: 4px;
      pointer-events: none;
      z-index: 1;
    }
    
    /* Aseguramos que los días seleccionados siempre tengan prioridad visual */
    .rdp-day_selected .has-external-events::after,
    .selected-day .has-external-events::after {
      border-color: white;
    }
    
    /* Mejoramos la visibilidad de los puntos de disponibilidad */
    .availability-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      margin: 1px;
    }
    
    .availability-dot.you {
      background-color: #4f46e5;
    }
    
    .availability-dot.others {
      background-color: #c7d2fe;
    }
  `;
  const { id: groupId } = useParams<{ id: string }>();
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null); // This now holds group_member.id
  const [isAdmin, setIsAdmin] = useState(false);
  const [groupAvailableDates, setGroupAvailableDates] = useState<Date[]>([]);
  const [memberEvents, setMemberEvents] = useState<MemberEvent[]>([]);
  const [groupEvents, setGroupEvents] = useState<MemberEvent[]>([]);
  const [memberExternalEvents, setMemberExternalEvents] = useState<{ user_id: string; date: string; }[]>([]);
  const { user } = useAuthStore();
  
  // CARGA PROGRESIVA POR MES: Solo carga datos del mes visible + precargar adyacentes
  // Esto mejora significativamente el rendimiento inicial en grupos grandes
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [loadedMonths, setLoadedMonths] = useState<Set<string>>(new Set());
  const [monthlyAvailabilities, setMonthlyAvailabilities] = useState<Map<string, MemberAvailability[]>>(new Map());
  
  // Función para generar clave del mes
  const getMonthKey = (date: Date) => format(date, 'yyyy-MM');
  
  // Usar deferred value para suavizar las transiciones
  const deferredMonthlyAvailabilities = useDeferredValue(monthlyAvailabilities);
  
  // Combinar todas las availabilities cargadas para el procesamiento
  const availabilities = useMemo(() => {
    const combined: MemberAvailability[] = [];
    const seenMembers = new Set<string>();
    
    deferredMonthlyAvailabilities.forEach((monthData) => {
      monthData.forEach((memberAvailability) => {
        const key = memberAvailability.memberId;
        if (!seenMembers.has(key)) {
          seenMembers.add(key);
          combined.push({
            ...memberAvailability,
            dates: [] // Inicializar vacío
          });
        }
      });
    });
    
    // Combinar todas las fechas de todos los meses cargados
    combined.forEach((memberAvailability) => {
      const allDates: Date[] = [];
      deferredMonthlyAvailabilities.forEach((monthData) => {
        const matchingMember = monthData.find(m => m.memberId === memberAvailability.memberId);
        if (matchingMember) {
          allDates.push(...matchingMember.dates);
        }
      });
      memberAvailability.dates = allDates;
    });
    
    return combined;
  }, [deferredMonthlyAvailabilities]);

useEffect(() => {
  if (user) {
    checkAdminStatus();
    fetchAvailabilitiesForMonth(currentMonth);
    fetchGroupEvents();
    fetchMemberEvents();
    fetchMemberExternalEvents();
  }
}, [user, groupId]);

// Efecto para cargar datos cuando cambia el mes visible
useEffect(() => {
  if (!user) return;
  
  const monthKey = getMonthKey(currentMonth);
  if (!loadedMonths.has(monthKey)) {
    fetchAvailabilitiesForMonth(currentMonth);
  }
  
  // Precargar mes anterior y siguiente para mejor UX
  const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  
  const prevMonthKey = getMonthKey(prevMonth);
  const nextMonthKey = getMonthKey(nextMonth);
  
  // Precargar de forma asíncrona sin bloquear
  const timeoutId = setTimeout(() => {
    if (!loadedMonths.has(prevMonthKey)) {
      fetchAvailabilitiesForMonth(prevMonth);
    }
    if (!loadedMonths.has(nextMonthKey)) {
      fetchAvailabilitiesForMonth(nextMonth);
    }
  }, 500); // Esperar 500ms para no interferir con la carga principal
  
  // Cleanup timeout si el componente se desmonta o cambia
  return () => clearTimeout(timeoutId);
}, [currentMonth, user, loadedMonths.size]); // Usar .size en lugar del Set completo

  // OPTIMIZACIÓN DE RENDIMIENTO: Sistema de caché inteligente para evitar recálculos
  // Los siguientes useMemo pre-calculan datos pesados una sola vez y los cachean
  
  // ENFOQUE MINIMALISTA: Solo obtener fechas marcadas por cada miembro (sin cálculos complejos)
  const memberDateMap = useMemo(() => {
    
    const result = new Map<string, Set<string>>();
    
    // Solo crear el mapa de fechas marcadas por cada miembro
    availabilities.forEach(member => {
      const dateSet = new Set<string>();
      member.dates.forEach(date => {
        dateSet.add(format(date, 'yyyy-MM-dd'));
      });
      result.set(member.userId, dateSet);
    });
    
    return result;
  }, [availabilities]);

  // Crear mapas simples de eventos (solo para mostrar, sin cálculos complejos)
  const eventMaps = useMemo(() => {
    
    const groupEvents = new Map<string, Set<string>>();
    const externalEvents = new Map<string, Set<string>>();
    
    memberEvents.forEach(event => {
      if (!groupEvents.has(event.user_id)) {
        groupEvents.set(event.user_id, new Set());
      }
      groupEvents.get(event.user_id)!.add(format(new Date(event.date), 'yyyy-MM-dd'));
    });
    
    memberExternalEvents.forEach(event => {
      if (!externalEvents.has(event.user_id)) {
        externalEvents.set(event.user_id, new Set());
      }
      externalEvents.get(event.user_id)!.add(format(new Date(event.date), 'yyyy-MM-dd'));
    });
    
    
    return { groupEvents, externalEvents };
  }, [memberEvents, memberExternalEvents]);

  // Caché optimizado para miembros disponibles por fecha
  const availableMembersCache = useMemo(() => {
    const cache = new Map<string, ExtendedGroupMember[]>();
    
    // Pre-calcular disponibilidad para todas las fechas con actividad
    const allActiveDates = new Set<string>();
    memberDateMap.forEach(dates => {
      dates.forEach(date => allActiveDates.add(date));
    });
    
    allActiveDates.forEach(dateStr => {
      const availableMembers = members.filter(member => {
        if (member.user_id) {
          // Registered member - check availability and events
          const hasMarkedAvailability = memberDateMap.get(member.user_id)?.has(dateStr) ?? false;
          const hasGroupEvent = eventMaps.groupEvents.get(member.user_id)?.has(dateStr) ?? false;
          const hasExternalEvent = eventMaps.externalEvents.get(member.user_id)?.has(dateStr) ?? false;
          
          return hasMarkedAvailability && !hasGroupEvent && !hasExternalEvent;
        } else {
          // Local member - check availability in our state (no external events to worry about)
          const memberAvailability = availabilities.find(a => a.memberId === member.id);
          const hasMarkedAvailability = memberAvailability?.dates.some(d => 
            format(d, 'yyyy-MM-dd') === dateStr
          ) ?? false;
          
          return hasMarkedAvailability;
        }
      });
      
      cache.set(dateStr, availableMembers);
    });
    
    return cache;
  }, [members, memberDateMap, eventMaps, availabilities]);

  // Función optimizada para obtener miembros disponibles
  const getAvailableMembersForDate = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availableMembersCache.get(dateStr) || [];
  }, [availableMembersCache]);

  // Caché optimizado para verificar cobertura de instrumentos
  const instrumentCoverageCache = useMemo(() => {
    const cache = new Map<string, boolean>();
    const principalMembers = members.filter(m => m.role_in_group === 'principal');
    
    // Pre-calcular instrumentos requeridos una sola vez
    const requiredInstruments = new Set<string>();
    principalMembers.forEach(principal => {
      principal.instruments.forEach(instrument => {
        requiredInstruments.add(instrument.id);
      });
    });
    
    // Pre-calcular cobertura para todas las fechas activas
    availableMembersCache.forEach((availableMembers, dateStr) => {
      const availableSubstitutes = availableMembers.filter(m => m.role_in_group === 'sustituto');
      
      // Verificar que cada instrumento requerido esté cubierto
      const allCovered = Array.from(requiredInstruments).every(instrumentId => {
        // Verificar si algún principal disponible toca este instrumento
        const principalCovered = availableMembers.some(member => 
          member.role_in_group === 'principal' && 
          member.instruments.some(instrument => instrument.id === instrumentId)
        );
        
        // Si no hay principal disponible, verificar si algún sustituto puede cubrirlo
        if (!principalCovered) {
          const substituteCovered = availableSubstitutes.some(substitute => 
            substitute.instruments.some(instrument => instrument.id === instrumentId)
          );
          return substituteCovered;
        }
        
        return true;
      });
      
      cache.set(dateStr, allCovered);
    });
    
    return cache;
  }, [members, availableMembersCache]);

  // Función optimizada para verificar cobertura de instrumentos
  const areAllInstrumentsCovered = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return instrumentCoverageCache.get(dateStr) ?? false;
  }, [instrumentCoverageCache]);

  // Calcular fechas disponibles para el callback (optimizado con caché)
  const groupAvailableDatesCalculated = useMemo(() => {
    if (!onAvailableDatesChange) return []; // No calcular si no se necesita
    
    const principalMembers = members.filter(m => m.role_in_group === 'principal');
    if (principalMembers.length === 0) return [];
    
    const availableDates: Date[] = [];
    
    // Usar el caché pre-calculado para obtener fechas con cobertura completa
    instrumentCoverageCache.forEach((isCovered, dateStr) => {
      if (isCovered) {
        availableDates.push(new Date(dateStr));
      }
    });
    
    return availableDates.sort((a, b) => a.getTime() - b.getTime());
  }, [members, instrumentCoverageCache, onAvailableDatesChange]);

  // Actualizar el estado para el callback
  useEffect(() => {
    if (onAvailableDatesChange && groupAvailableDatesCalculated.length >= 0) {
      setGroupAvailableDates(groupAvailableDatesCalculated);
      onAvailableDatesChange(groupAvailableDatesCalculated);
    }
  }, [groupAvailableDatesCalculated, onAvailableDatesChange]);

  useEffect(() => {
    if (onAvailableDatesChange) {
      onAvailableDatesChange(groupAvailableDates);
    }
  }, [groupAvailableDates, onAvailableDatesChange]);

  const checkAdminStatus = useCallback(async () => {
    interface UserRole {
      role: string;
    }
    
    const response = await safeSupabaseRequest<UserRole>(
      async () => {
        return await supabase
          .from('users')
          .select('role')
          .eq('id', user?.id)
          .single();
      },
      'Error checking admin status'
    );

    if (response) {
      setIsAdmin(response.role === 'admin');
    }
  }, [user?.id]);

  const fetchMemberEvents = async () => {
    interface EventData {
      id: number;
      date: string;
      name: string;
      group_id: string;
      event_members?: { user_id: string }[];
    }

    const response = await safeSupabaseRequest(
      async () => {
        return await supabase
          .from('events')
          .select(`
            id,
            date,
            name,
            group_id,
            event_members (
              user_id
            )
          `);
      },
      'Error al obtener los eventos'
    );
  
    if (response) {
      const formattedEvents: MemberEvent[] = [];
      response.forEach((event: EventData) => {
        event.event_members?.forEach((member: { user_id: string }) => {
          formattedEvents.push({
            event_id: event.id,
            date: event.date,
            user_id: member.user_id,
            name: event.name,
            group_id: event.group_id
          });
        });
      });
      setMemberEvents(formattedEvents);
    }
  };
  

  const fetchGroupEvents = async () => {
    interface GroupEventData {
      id: number;
      date: string;
      name: string;
      group_id: string;
    }

    const response = await safeSupabaseRequest(
      async () => {
        return await supabase
          .from('events')
          .select(`
            id,
            date,
            name,
            group_id
          `)
          .eq('group_id', groupId);
      },
      'Error fetching group events'
    );

    if (response) {
      const formattedEvents: MemberEvent[] = response.map((event: GroupEventData) => ({
        event_id: event.id,
        date: event.date,
        user_id: '', // Este campo ya no es necesario para mostrar eventos
        name: event.name,
        group_id: event.group_id
      }));
      setGroupEvents(formattedEvents);
    }
  };

  const fetchMemberExternalEvents = async () => {
    
    // Realizamos la consulta de eventos externos
    const fullQuery = await supabase
      .from('events')
      .select(`
        id,
        date,
        group_id,
        name,
        event_members (
          user_id
        )
      `)
      .neq('group_id', groupId);
    
    
    if (fullQuery.error) {
      console.error('Error al obtener eventos externos:', fullQuery.error);
      return;
    }
    
    // Procesamos los datos para obtener un array de { user_id, date }
    const externalEventsData = fullQuery.data || [];
    const formattedExternalEvents: { user_id: string; date: string; }[] = [];
    
    externalEventsData.forEach(event => {
      event.event_members?.forEach(member => {
        formattedExternalEvents.push({
          user_id: member.user_id,
          date: event.date,
        });
      });
    });
    
    // Actualizamos el estado con los eventos externos formateados
    setMemberExternalEvents(formattedExternalEvents);
    
  };
  

  const fetchAvailabilitiesForMonth = async (targetMonth: Date) => {
    if (!groupId) return;
    
    const monthKey = getMonthKey(targetMonth);
    
    // Si ya está cargado, no hacer nada
    if (loadedMonths.has(monthKey)) {
      return;
    }
    
    // Solo mostrar loading general si es el primer mes o no hay meses cargados
    if (loadedMonths.size === 0) {
      setLoading(true);
    }
    try {
      // Get availability for all members (both registered and local)
      const registeredMemberIds = members
        .filter(m => m.user_id !== null)
        .map(m => m.user_id!);
      
      const localMemberIds = members
        .filter(m => m.user_id === null)
        .map(m => m.id);

      interface AvailabilityData {
        user_id: string | null;
        group_member_id: string | null;
        date: string;
      }

      // Calcular rango de fechas para el mes
      const monthStart = format(startOfMonth(targetMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(targetMonth), 'yyyy-MM-dd');

      // Fetch availability for both registered users and local members, filtered by month
      const response = await safeSupabaseRequest(
        async () => {
          if (registeredMemberIds.length === 0 && localMemberIds.length === 0) {
            return [];
          }
          
          let query = supabase
            .from('member_availability')
            .select('user_id, group_member_id, date')
            .gte('date', monthStart)
            .lte('date', monthEnd);
          
          const conditions = [];
          if (registeredMemberIds.length > 0) {
            conditions.push(`user_id.in.(${registeredMemberIds.join(',')})`);
          }
          if (localMemberIds.length > 0) {
            conditions.push(`group_member_id.in.(${localMemberIds.join(',')})`);
          }
          
          if (conditions.length > 0) {
            query = query.or(conditions.join(','));
          }
          
          return query.order('date');
        },
        `Error fetching availabilities for ${monthKey}`
      );

      if (response) {
        const formattedAvailabilities = members.map(member => {
          const availabilityItems = response
            .filter((item: AvailabilityData) => 
              (member.user_id && item.user_id === member.user_id) ||
              (!member.user_id && item.group_member_id === member.id)
            );
          
          const memberAvailability = {
            userId: member.user_id,
            memberId: member.id,
            memberName: member.name || 'Unknown Member',
            memberType: (member.member_type || 'registered') as 'registered' | 'local',
            dates: availabilityItems.map((item: AvailabilityData) => new Date(item.date)),
            instruments: member.instruments || [],
            roleInBand: (member.role_in_group as 'principal' | 'sustituto') || 'principal'
          };
          
          return memberAvailability;
        });
        
        // Actualizar el estado con los datos del mes específico
        setMonthlyAvailabilities(prev => new Map(prev.set(monthKey, formattedAvailabilities)));
        setLoadedMonths(prev => new Set(prev.add(monthKey)));
      }
    } catch (error) {
      console.error(`Error fetching availabilities for ${monthKey}:`, error);
      toast.error(`Error al obtener las disponibilidades de ${monthKey}`);
    } finally {
      setLoading(false);
    }
  };


  const getEventsForDate = (date: Date) => {
    return groupEvents.filter(event => 
      isSameDay(new Date(event.date), date)
    );
  };


  const canManageOtherMembers = () => {
    const currentMember = members.find(m => m.user_id === user?.id);
    return isAdmin || currentMember?.role_in_group === 'principal';
  };

  // Estado para controlar si estamos actualizando el calendario
  const [isUpdatingCalendar, setIsUpdatingCalendar] = useState(false);
  // Referencia al contenedor del calendario
  const calendarContainerRef = useRef<HTMLDivElement>(null);

  // Función para actualizar todos los datos del calendario sin recargar la página
  const refreshCalendarData = async (silent = false) => {
    try {
      // Guardar la posición de desplazamiento actual
      const scrollPosition = window.scrollY;
      
      // Mostrar el overlay de carga
      if (!silent) {
        setSaving(true);
      } else {
        setIsUpdatingCalendar(true);
      }
      
      // Pausar brevemente para permitir que el overlay se muestre
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Ejecutar las funciones existentes para cargar datos
      await Promise.all([
        fetchAvailabilitiesForMonth(currentMonth),
        fetchMemberEvents(),
        fetchGroupEvents(),
        fetchMemberExternalEvents()
      ]);
      
      // El cálculo de disponibilidad se actualiza automáticamente via useMemo
      
      // Restaurar la posición de desplazamiento
      window.scrollTo(0, scrollPosition);
      
      // Mostrar mensaje de éxito si no es silencioso
      if (!silent) {
        toast.success('Calendario actualizado correctamente');
      }
      
      return true;
    } catch (error) {
      console.error('Error al actualizar datos del calendario:', error);
      if (!silent) {
        toast.error('Error al actualizar el calendario');
      }
      return false;
    } finally {
      // Ocultar el overlay de carga con un retraso
      setTimeout(() => {
        if (!silent) {
          setSaving(false);
        }
        setIsUpdatingCalendar(false);
      }, 500);
    }
  };

  const handleDayClick = async (day: Date) => {
    // Mostrar feedback visual inmediato de la selección
    
    if (!user) {
      toast.error('Debes iniciar sesión para gestionar la disponibilidad');
      return;
    }
    
    // Evitar múltiples clics rápidos
    if (saving) {
      return;
    }
    
    setSaving(true);

    // Get the member we're managing (either selected member or current user)
    const targetMemberId = selectedMemberId || members.find(m => m.user_id === user.id)?.id;
    const targetMember = members.find(m => m.id === targetMemberId);
    
    if (!targetMember) {
      toast.error('Miembro no encontrado');
      setSaving(false);
      return;
    }

    // Check permissions
    const currentUserMember = members.find(m => m.user_id === user.id);
    const canManage = isAdmin || 
      currentUserMember?.role_in_group === 'principal' || 
      targetMember.user_id === user.id;

    if (!canManage) {
      toast.error('No tienes permisos para gestionar esta disponibilidad');
      setSaving(false);
      return;
    }

    // Check for existing events on this date (only for registered members)
    if (targetMember.user_id) {
      const hasEventOnDate = memberEvents.some((event: MemberEvent) => 
        event.user_id === targetMember.user_id &&
        isSameDay(new Date(event.date), day)
      );

      if (hasEventOnDate) {
        toast.error('No puedes cambiar la disponibilidad en fechas con eventos programados');
        setSaving(false);
        return;
      }
    }
    
    try {
      const isSelected = availabilities
        .find(a => a.memberId === targetMember.id)
        ?.dates.some(d => isSameDay(d, day));
  
      const dateStr = format(day, 'yyyy-MM-dd');
      
      if (isSelected) {
        // Delete availability
        try {
          let deleteResponse;
          if (targetMember.user_id) {
            // Registered member - use user_id
            deleteResponse = await supabase
              .from('member_availability')
              .delete()
              .eq('user_id', targetMember.user_id)
              .eq('date', dateStr);
          } else {
            // Local member - use group_member_id
            deleteResponse = await supabase
              .from('member_availability')
              .delete()
              .eq('group_member_id', targetMember.id)
              .eq('date', dateStr);
          }
          
          if (deleteResponse.error) {
            console.error('Error al eliminar disponibilidad:', deleteResponse.error);
            toast.error('Hubo un problema al guardar');
            setSaving(false);
            return;
          }
          
          // Update visual state
          setSelectedDay(day);
          toast.success(`Fecha ${format(day, 'dd/MM/yyyy')} eliminada de la disponibilidad`);
          
          // Update local state using the new monthly system
          const monthKey = getMonthKey(day);
          setMonthlyAvailabilities(prev => {
            const updated = new Map(prev);
            let monthData = updated.get(monthKey);
            
            // If month is not loaded, ensure it's loaded first
            if (!monthData) {
              fetchAvailabilitiesForMonth(day);
              return prev; // Return unchanged until data is loaded
            }
            
            const updatedMonthData = monthData.map(avail => {
              if (avail.memberId === targetMember.id) {
                const newDates = avail.dates.filter(d => !isSameDay(d, day));
                return {
                  ...avail,
                  dates: newDates
                };
              }
              return avail;
            });
            updated.set(monthKey, updatedMonthData);
            return updated;
          });
          
        } catch (error) {
          console.error('Error inesperado al eliminar disponibilidad:', error);
          toast.error('Ha ocurrido un error al procesar tu solicitud');
        }
      } else {
        // Add availability
        try {
          let insertResponse;
          if (targetMember.user_id) {
            // Registered member - use user_id
            insertResponse = await supabase
              .from('member_availability')
              .insert([{ user_id: targetMember.user_id, date: dateStr }]);
          } else {
            // Local member - use group_member_id
            insertResponse = await supabase
              .from('member_availability')
              .insert([{ group_member_id: targetMember.id, date: dateStr }]);
          }
          
          if (insertResponse.error) {
            console.error('Error al insertar disponibilidad:', insertResponse.error);
            toast.error('Hubo un problema al guardar');
            setSaving(false);
            return;
          }
          
          // Update visual state
          setSelectedDay(day);
          toast.success(`Fecha ${format(day, 'dd/MM/yyyy')} añadida a la disponibilidad`);
          
          // Update local state using the new monthly system
          const monthKey = getMonthKey(day);
          setMonthlyAvailabilities(prev => {
            const updated = new Map(prev);
            let monthData = updated.get(monthKey);
            
            // If month is not loaded, ensure it's loaded first
            if (!monthData) {
              fetchAvailabilitiesForMonth(day);
              return prev; // Return unchanged until data is loaded
            }
            
            const updatedMonthData = monthData.map(avail => {
              if (avail.memberId === targetMember.id) {
                const newDates = [...avail.dates, day];
                return {
                  ...avail,
                  dates: newDates
                };
              }
              return avail;
            });
            updated.set(monthKey, updatedMonthData);
            return updated;
          });
          
        } catch (error) {
          console.error('Error inesperado al añadir disponibilidad:', error);
          toast.error('Ha ocurrido un error al procesar tu solicitud');
        }
      }
    } catch (error) {
      console.error('Error en handleDayClick:', error);
      toast.error('Ha ocurrido un error al procesar tu solicitud');
    } finally {
      setSaving(false);
    }
  };

    // Eliminamos la función no utilizada para evitar warnings

  // Caché optimizado para miembros por día (disponibles + con eventos)
  const membersForDayCache = useMemo(() => {
    const cache = new Map<string, ExtendedGroupMember[]>();
    
    // Pre-calcular para todas las fechas activas
    const allActiveDates = new Set<string>();
    memberDateMap.forEach(dates => {
      dates.forEach(date => allActiveDates.add(date));
    });
    eventMaps.groupEvents.forEach(dates => {
      dates.forEach(date => allActiveDates.add(date));
    });
    
    allActiveDates.forEach(dateStr => {
      const availableMembers = availableMembersCache.get(dateStr) || [];
      
      // También incluir miembros que tienen eventos del grupo (aunque no estén "disponibles")
      const membersWithGroupEvents = members.filter(member => 
        member.user_id && eventMaps.groupEvents.get(member.user_id)?.has(dateStr)
      );
      
      // Combinar ambos grupos sin duplicados usando Set para mejor rendimiento
      const memberIds = new Set(availableMembers.map(m => m.id));
      const allMembers = [...availableMembers];
      
      membersWithGroupEvents.forEach(member => {
        if (!memberIds.has(member.id)) {
          allMembers.push(member);
          memberIds.add(member.id);
        }
      });
      
      cache.set(dateStr, allMembers);
    });
    
    return cache;
  }, [members, availableMembersCache, eventMaps]);

  // Función optimizada para obtener miembros para un día
  const getMembersForDay = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return membersForDayCache.get(dateStr) || [];
  }, [membersForDayCache]);

  const DayContent = (props: { date: Date }) => {
    const { date } = props;
    const dateStr = format(date, 'yyyy-MM-dd');
    const membersForDay = getMembersForDay(date);
    const availableMembers = getAvailableMembersForDate(date);
    
    // Check if current user is involved
    const currentMemberId = selectedMemberId || members.find(m => m.user_id === user?.id)?.id;
    const currentMember = members.find(m => m.id === currentMemberId);
    const isCurrentUserInvolved = membersForDay.some(m => m.id === currentMemberId);
    
    // Check if current user has external events (simple lookup) - only for registered members
    const currentUserHasExternalEvent = currentMember?.user_id && 
      eventMaps.externalEvents.get(currentMember.user_id)?.has(dateStr) || false;
    
    // Get other members (not the current user)
    const otherMembers = membersForDay.filter(m => m.id !== currentMemberId);
    const otherMembersCount = otherMembers.length;
    
    // Count other members with external events (simple lookups)
    const otherMembersWithExternalEvents = otherMembers.filter(member => 
      member.user_id && eventMaps.externalEvents.get(member.user_id)?.has(dateStr)
    ).length;
    
    // Verificar disponibilidad del grupo considerando sustitutos
    const isGroupAvailable = areAllInstrumentsCovered(date);
    
    const events = getEventsForDate(date);
    const hasEvent = events.length > 0;
    
    // Check if any member has external events
    const hasMembersWithExternalEvents = currentUserHasExternalEvent || otherMembersWithExternalEvents > 0;

    return (
      <div
        className={`day-content ${isGroupAvailable ? 'group-available' : ''} ${
          hasEvent ? 'has-event' : ''
        } ${
          hasMembersWithExternalEvents ? 'has-external-events' : ''
        } ${selectedDay && isSameDay(date, selectedDay) ? 'selected-day' : ''}`}
      >
        <span className={`${selectedDay && isSameDay(date, selectedDay) ? 'text-indigo-900 font-bold' : ''}`}>{date.getDate()}</span>
        {(isCurrentUserInvolved || otherMembersCount > 0 || hasEvent) && (
          <>
            <div className="availability-dots">
              {isCurrentUserInvolved && (
                <div className={`availability-dot you ${currentUserHasExternalEvent ? 'border border-orange-500 bg-orange-200' : ''}`} />
              )}
              {otherMembers.slice(0, 3).map((member, i) => {
                const hasExternalEvent = memberExternalEvents.some(event => 
                  event.user_id === member.user_id && 
                  isSameDay(new Date(event.date), date)
                );
                return (
                  <div key={i} className={`availability-dot others ${hasExternalEvent ? 'border border-orange-500 bg-orange-200' : ''}`} />
                );
              })}
            </div>
            <div className="day-tooltip">
              <div className="text-sm font-medium text-gray-900 mb-2">
                {format(date, 'MMMM d, yyyy')}
                <div className="flex flex-wrap gap-1 mt-1">
                  {isGroupAvailable && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                      Grupo disponible
                    </span>
                  )}
                  {hasEvent && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                      {events.length > 1 ? `${events[0].name} y ${events.length - 1} más` : events[0].name}
                    </span>
                  )}
                  {hasMembersWithExternalEvents && (
                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                      {otherMembersWithExternalEvents + (currentUserHasExternalEvent ? 1 : 0)} miembro(s) con eventos externos
                    </span>
                  )}
                </div>
              </div>
              {membersForDay.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Miembros:</p>
                  {membersForDay.map((member) => {
                    const isAvailable = availableMembers.some(m => m.id === member.id);
                    const memberHasExternalEvent = member.user_id && 
                      eventMaps.externalEvents.get(member.user_id)?.has(dateStr) || false;
                    
                    // La información de eventos externos ya se muestra en el tooltip general

                    return (
                      <div
                        key={member.id}
                        className={`tooltip-member ${
                          member.id === (selectedMemberId || members.find(m => m.user_id === user?.id)?.id) ? 'you' : 'other'
                        }`}
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between w-full">
                            <span className="font-medium">{member.name}</span>
                            <div className="flex items-center gap-2">
                              {member.role_in_group === 'sustituto' && (
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full">
                                  Sustituto
                                </span>
                              )}
                              {isAvailable && !memberHasExternalEvent && (
                                <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">
                                  Disponible
                                </span>
                              )}
                              {memberHasExternalEvent && (
                                <span className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded-full">
                                  Con Evento
                                </span>
                              )}
                              {member.id === (selectedMemberId || members.find(m => m.user_id === user?.id)?.id) && (
                                <span className="text-xs bg-indigo-200 px-1.5 py-0.5 rounded-full">
                                  Tú
                                </span>
                              )}
                            </div>
                          </div>
                          {member.instruments.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {member.instruments.map((instrument, idx) => (
                                <span
                                  key={`${member.id}-${instrument.id}-${idx}`}
                                  className="inline-flex items-center text-xs text-gray-600"
                                >
                                  <Music className="w-3 h-3 mr-1" />
                                  {instrument.name}
                                  {idx < member.instruments.length - 1 && ", "}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const downloadAvailabilityDates = () => {
    // Usar el cálculo simple para obtener fechas disponibles
    const availableDatesWithoutEvents = groupAvailableDatesCalculated
      .filter(date => getEventsForDate(date).length === 0)
      .sort((a, b) => a.getTime() - b.getTime());

    // Agrupar fechas por mes
    const datesByMonth = availableDatesWithoutEvents.reduce((acc, date) => {
      const monthKey = format(date, 'MMMM yyyy', { locale: es });
      if (!acc[monthKey]) {
        acc[monthKey] = {
          withPrincipals: [],
          withSubstitutes: []
        };
      }

      const membersForDay = getMembersForDay(date);
      const unavailablePrincipals = members
        .filter(m => m.role_in_group === 'principal')
        .filter(principal => !membersForDay.some(m => m.user_id === principal.user_id));

      if (unavailablePrincipals.length === 0) {
        acc[monthKey].withPrincipals.push(date);
      } else {
        acc[monthKey].withSubstitutes.push(date);
      }

      return acc;
    }, {} as Record<string, { withPrincipals: Date[], withSubstitutes: Date[] }>);

    // Generar el contenido del archivo
    let content = `FECHAS DISPONIBLES DEL GRUPO ${groupName.toUpperCase()}\n\n`;

    if (Object.keys(datesByMonth).length === 0) {
      content += "No hay fechas disponibles sin eventos programados.\n";
    } else {
      Object.entries(datesByMonth).forEach(([month, dates]) => {
        content += `${month.toUpperCase()}\n`;
        
        if (dates.withPrincipals.length > 0) {
          content += "Fechas con miembros principales:\n";
          content += dates.withPrincipals
            .map(date => `${format(date, 'd(EEE)', { locale: es })}`)
            .join(', ');
          content += "\n\n";
        }

        if (dates.withSubstitutes.length > 0) {
          content += "Fechas con sustitutos:\n";
          content += dates.withSubstitutes
            .map(date => `${format(date, 'd(EEE)', { locale: es })}`)
            .join(', ');
          content += "\n\n";
        }
        
        content += "\n";
      });
    }

    // Crear y descargar el archivo
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `disponibilidad_${groupName.toLowerCase().replace(/\s+/g, '_')}_${format(new Date(), 'dd-MM-yyyy')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const downloadAvailabilityPDF = async () => {
    // Obtener todas las disponibilidades futuras desde la base de datos
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    toast.loading('Generando PDF...', { id: 'pdf-generation' });
    
    try {
      // Obtener disponibilidades de los próximos 12 meses
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const registeredMemberIds = members
        .filter(m => m.user_id !== null)
        .map(m => m.user_id!);
      
      const localMemberIds = members
        .filter(m => m.user_id === null)
        .map(m => m.id);

      if (registeredMemberIds.length === 0 && localMemberIds.length === 0) {
        toast.error('No hay miembros en el grupo', { id: 'pdf-generation' });
        return;
      }

      // Obtener todas las disponibilidades futuras
      let query = supabase
        .from('member_availability')
        .select('user_id, group_member_id, date')
        .gte('date', format(today, 'yyyy-MM-dd'))
        .lte('date', format(futureDate, 'yyyy-MM-dd'));

      const conditions = [];
      if (registeredMemberIds.length > 0) {
        conditions.push(`user_id.in.(${registeredMemberIds.join(',')})`);
      }
      if (localMemberIds.length > 0) {
        conditions.push(`group_member_id.in.(${localMemberIds.join(',')})`);
      }

      if (conditions.length > 0) {
        query = query.or(conditions.join(','));
      }

      const { data: futureAvailabilities, error } = await query;

      if (error) {
        console.error('Error fetching future availabilities:', error);
        toast.error('Error al obtener las disponibilidades', { id: 'pdf-generation' });
        return;
      }

      if (!futureAvailabilities) {
        toast.error('No se pudieron obtener las disponibilidades', { id: 'pdf-generation' });
        return;
      }

      // Procesar las disponibilidades para crear el mapa de fechas por miembro
      const memberAvailabilityMap = new Map<string, Set<string>>();
      
      futureAvailabilities.forEach(avail => {
        const memberId = avail.user_id || avail.group_member_id;
        if (!memberId) return;
        
        if (!memberAvailabilityMap.has(memberId)) {
          memberAvailabilityMap.set(memberId, new Set<string>());
        }
        memberAvailabilityMap.get(memberId)!.add(format(new Date(avail.date), 'yyyy-MM-dd'));
      });

      // Calcular fechas donde todos los instrumentos principales están cubiertos
      const principalMembers = members.filter(m => m.role_in_group === 'principal');
      if (principalMembers.length === 0) {
        toast.error('No hay miembros principales en el grupo', { id: 'pdf-generation' });
        return;
      }

      // Obtener todos los instrumentos requeridos (de los principales)
      const requiredInstruments = new Set<string>();
      principalMembers.forEach(member => {
        if (member.instruments && member.instruments.length > 0) {
          member.instruments.forEach(instrument => {
            requiredInstruments.add(instrument.id);
          });
        }
      });

      if (requiredInstruments.size === 0) {
        toast.error('Los miembros principales no tienen instrumentos asignados', { id: 'pdf-generation' });
        return;
      }

      const availableDates: Date[] = [];
      
      // Revisar cada día de los próximos 12 meses
      const currentDate = new Date(today);
      while (currentDate <= futureDate) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        
        // Obtener miembros principales disponibles en esta fecha
        const availablePrincipals = principalMembers.filter(member => {
          const memberKey = member.user_id || member.id;
          return memberAvailabilityMap.get(memberKey)?.has(dateStr) || false;
        });

        // Verificar si todos los instrumentos requeridos están cubiertos
        const coveredInstruments = new Set<string>();
        availablePrincipals.forEach(member => {
          if (member.instruments && member.instruments.length > 0) {
            member.instruments.forEach(instrument => {
              coveredInstruments.add(instrument.id);
            });
          }
        });

        // Si todos los instrumentos requeridos están cubiertos, la fecha está disponible
        const allInstrumentsCovered = Array.from(requiredInstruments).every(instrumentId => 
          coveredInstruments.has(instrumentId)
        );

        if (allInstrumentsCovered) {
          availableDates.push(new Date(currentDate));
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Filtrar fechas que no tienen eventos y ordenar
      const availableDatesWithoutEvents = availableDates
        .filter(date => getEventsForDate(date).length === 0)
        .sort((a, b) => a.getTime() - b.getTime());

      if (availableDatesWithoutEvents.length === 0) {
        toast.error('No hay fechas disponibles para mostrar en el PDF', { id: 'pdf-generation' });
        return;
      }

      // Agrupar fechas por mes
      const datesByMonth = availableDatesWithoutEvents.reduce((acc, date) => {
        const monthKey = format(date, 'MMMM yyyy', { locale: es });
        if (!acc[monthKey]) {
          acc[monthKey] = {
            withPrincipals: [],
            withSubstitutes: []
          };
        }

        const dateStr = format(date, 'yyyy-MM-dd');
        
        // Obtener miembros principales disponibles en esta fecha
        const availablePrincipals = principalMembers.filter(member => {
          const memberKey = member.user_id || member.id;
          return memberAvailabilityMap.get(memberKey)?.has(dateStr) || false;
        });

        // Verificar si todos los instrumentos están cubiertos solo por principales
        const principalCoveredInstruments = new Set<string>();
        availablePrincipals.forEach(member => {
          if (member.instruments && member.instruments.length > 0) {
            member.instruments.forEach(instrument => {
              principalCoveredInstruments.add(instrument.id);
            });
          }
        });

        const allInstrumentsCoveredByPrincipals = Array.from(requiredInstruments).every(instrumentId => 
          principalCoveredInstruments.has(instrumentId)
        );

        // Si todos los instrumentos están cubiertos por principales, es una fecha ideal
        // Si no, significa que necesita sustitutos
        if (allInstrumentsCoveredByPrincipals) {
          acc[monthKey].withPrincipals.push(date);
        } else {
          acc[monthKey].withSubstitutes.push(date);
        }

        return acc;
      }, {} as Record<string, { withPrincipals: Date[], withSubstitutes: Date[] }>);

    // Crear PDF con diseño minimalista
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 25;
    let yPosition = margin;

    // Header minimalista
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'light');
    pdf.setTextColor(40, 40, 40);
    pdf.text(groupName, margin, yPosition);
    yPosition += 12;

    // Subtítulo elegante
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(120, 120, 120);
    pdf.text('FECHAS DISPONIBLES', margin, yPosition);
    yPosition += 6;

    // Fecha de generación discreta
    pdf.setFontSize(9);
    pdf.setTextColor(160, 160, 160);
    pdf.text(format(new Date(), 'dd MMMM yyyy', { locale: es }), margin, yPosition);
    
    // Línea sutil
    yPosition += 8;
    pdf.setDrawColor(230, 230, 230);
    pdf.setLineWidth(0.3);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 20;

    // Verificar si hay fechas disponibles
    if (Object.keys(datesByMonth).length === 0) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(120, 120, 120);
      pdf.text('No hay fechas disponibles próximas.', margin, yPosition);
    } else {
      // Procesar cada mes con diseño elegante
      Object.entries(datesByMonth).forEach(([month, dates], index) => {
        // Verificar si necesitamos nueva página
        if (yPosition > pageHeight - 80) {
          pdf.addPage();
          yPosition = margin + 40; // Menos margen superior en páginas adicionales
        }

        // Título del mes elegante
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(60, 60, 60);
        pdf.text(month.charAt(0).toUpperCase() + month.slice(1), margin, yPosition);
        yPosition += 12;

        // Contenedor visual sutil
        const sectionStartY = yPosition;

        // Fechas principales (prioritarias)
        if (dates.withPrincipals.length > 0) {
          const principalDatesFormatted = dates.withPrincipals
            .map(date => format(date, 'd (EEE)', { locale: es }))
            .join(' • ');
          
          pdf.setFontSize(18);
          pdf.setFont('helvetica', 'light');
          pdf.setTextColor(40, 40, 40);
          
          const splitText = pdf.splitTextToSize(principalDatesFormatted, pageWidth - 2 * margin);
          pdf.text(splitText, margin, yPosition);
          yPosition += splitText.length * 8 + 2;
          
          // Etiqueta discreta para fechas principales
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 180, 100);
          pdf.text('FORMACIÓN COMPLETA', margin, yPosition);
          yPosition += 8;
        }

        // Fechas con sustitutos (menos prominentes)
        if (dates.withSubstitutes.length > 0) {
          if (dates.withPrincipals.length > 0) {
            yPosition += 4; // Espacio adicional si hay ambos tipos
          }
          
          const substituteDatesFormatted = dates.withSubstitutes
            .map(date => format(date, 'd (EEE)', { locale: es }))
            .join(' • ');
          
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'light');
          pdf.setTextColor(120, 120, 120);
          
          const splitText = pdf.splitTextToSize(substituteDatesFormatted, pageWidth - 2 * margin);
          pdf.text(splitText, margin, yPosition);
          yPosition += splitText.length * 6 + 2;
          
          // Etiqueta discreta para fechas con sustitutos
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(180, 140, 100);
          pdf.text('CON SUSTITUTOS', margin, yPosition);
          yPosition += 8;
        }

        // Línea separadora sutil entre meses (excepto el último)
        if (index < Object.keys(datesByMonth).length - 1) {
          yPosition += 8;
          pdf.setDrawColor(245, 245, 245);
          pdf.setLineWidth(0.2);
          pdf.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 16;
        } else {
          yPosition += 12;
        }
      });

      // Footer minimalista con contacto
      yPosition += 15;
      
      // Información de contacto discreta (si tienes estos datos disponibles)
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(160, 160, 160);
      
      const totalIdealDates = Object.values(datesByMonth).reduce((sum, dates) => sum + dates.withPrincipals.length, 0);
      const totalSubstituteDates = Object.values(datesByMonth).reduce((sum, dates) => sum + dates.withSubstitutes.length, 0);
      
      if (totalIdealDates > 0 || totalSubstituteDates > 0) {
        pdf.text(`${totalIdealDates + totalSubstituteDates} fechas disponibles`, margin, pageHeight - 25);
      }
    }

    // Footer elegante y discreto
    const totalPages = pdf.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(200, 200, 200);
      if (totalPages > 1) {
        pdf.text(`${i}`, pageWidth - margin, pageHeight - 15);
      }
    }

      // Abrir PDF en nueva pestaña
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
      
      // Limpiar la URL después de un tiempo para liberar memoria
      setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
      }, 1000);

      toast.success('PDF generado correctamente', { id: 'pdf-generation' });
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el PDF', { id: 'pdf-generation' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(isAdmin || canManageOtherMembers()) && members.length > 0 && (
        <div>
          <label htmlFor="member-select" className="block text-sm font-medium text-gray-700 mb-2">
            Gestionando disponibilidad para:
          </label>
          <div className="relative w-full max-w-xs">
            <select
              id="member-select"
              value={selectedMemberId || (members.find(m => m.user_id === user?.id)?.id) || ''}
              onChange={(e) => {
                const currentUserMember = members.find(m => m.user_id === user?.id);
                setSelectedMemberId(e.target.value === currentUserMember?.id ? null : e.target.value);
              }}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md shadow-sm"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} {member.user_id === user?.id ? '(Tú)' : ''} {!member.user_id ? '(Local)' : ''}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: dayPickerStyles }} />
      <div 
        ref={calendarContainerRef}
        className="flex justify-center relative bg-white rounded-lg shadow-sm p-4 calendar-container" 
      >
        <div 
          className={`fixed top-0 left-0 w-screen h-screen flex items-center justify-center z-50 ${(saving || isUpdatingCalendar) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
          style={{ transition: 'opacity 0.2s ease-in-out' }}
        >
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="bg-white p-4 rounded-lg shadow-lg z-10 flex items-center space-x-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span>Actualizando calendario...</span>
          </div>
        </div>
        <DayPicker
          mode="single"
          selected={selectedDay}
          month={currentMonth}
          onSelect={setSelectedDay}
          onDayClick={handleDayClick}
          onMonthChange={(month) => {
            setCurrentMonth(month);
          }}
          modifiersClassNames={{
            selected: 'rdp-day_selected'
          }}
          classNames={{
            day_selected: 'font-bold hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500'
          }}
          fromDate={new Date()}
          components={{
            DayContent
          }}
          weekStartsOn={1}
          locale={es}
        />
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Calendario de Disponibilidad</h3>
        <button
          onClick={(e) => {
            // Prevenir comportamiento por defecto que podría causar recarga
            e.preventDefault();
            
            // Usar la función refreshCalendarData para actualizar los datos
            refreshCalendarData();
          }}
          disabled={saving}
          className={`px-3 py-1 text-sm ${saving ? 'bg-gray-100 cursor-not-allowed' : 'bg-blue-100 hover:bg-blue-200'} rounded-md flex items-center`}
        >
          <span className="mr-1">{saving ? '...' : '↻'}</span>
          {saving ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="font-medium text-gray-900 mb-3">Legend:</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50">
            <div className="w-4 h-4 rounded-full bg-indigo-600 shadow-sm"></div>
            <span className="text-sm text-gray-600">Tu disponibilidad</span>
          </div>
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50">
            <div className="w-4 h-4 rounded-full bg-indigo-200"></div>
            <span className="text-sm text-gray-600">Other members</span>
          </div>
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-600">Grupo disponible</span>
          </div>
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-sm text-gray-600">Event scheduled</span>
          </div>
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50">
            <div className="w-4 h-4 rounded-full border-2 border-orange-500 bg-orange-200"></div>
            <span className="text-sm text-gray-600">Con evento externo</span>
          </div>
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50">
            <div className="w-4 h-4 rounded-full bg-indigo-400 text-white flex items-center justify-center text-xs font-bold">✓</div>
            <span className="text-sm text-gray-600">Fecha seleccionada</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex space-x-3">
          <button
            onClick={downloadAvailabilityPDF}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <FileText className="w-4 h-4 mr-2" />
            Ver PDF
          </button>
          <button
            onClick={downloadAvailabilityDates}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar TXT
          </button>
        </div>
      </div>
    </div>
  );
}