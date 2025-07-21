import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { safeSupabaseRequest } from '../lib/supabaseUtils';
import { useAuthStore } from '../store/authStore';
import { DayPicker } from 'react-day-picker';
import { format, isSameDay } from 'date-fns';
// Eliminamos importaciones no utilizadas
import { toast } from 'react-hot-toast';
import { Loader2, ChevronDown, Music, Download } from 'lucide-react';
import 'react-day-picker/dist/style.css';
import { GroupMember } from '../types';
import { useParams } from 'react-router-dom';
import { es } from 'date-fns/locale';

interface MemberAvailability {
  userId: string;
  memberName: string;
  dates: Date[];
  instruments: { id: string; name: string; }[];
  roleInBand: 'principal' | 'sustituto';
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
  const [availabilities, setAvailabilities] = useState<MemberAvailability[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [groupAvailableDates, setGroupAvailableDates] = useState<Date[]>([]);
  const [memberEvents, setMemberEvents] = useState<MemberEvent[]>([]);
  const [groupEvents, setGroupEvents] = useState<MemberEvent[]>([]);
  const [memberExternalEvents, setMemberExternalEvents] = useState<{ user_id: string; date: string; }[]>([]);
  const [groupNotAvailableDates, setGroupNotAvailableDates] = useState<Date[]>([]);
  const { user } = useAuthStore();

useEffect(() => {
  if (user) {
    checkAdminStatus();
    fetchAllAvailabilities();
    fetchGroupEvents();
    fetchMemberEvents();
    fetchMemberExternalEvents();
  }
}, [user, groupId]);

  // Memoizar el cálculo de disponibilidad del grupo con algoritmo optimizado por miembro
  const { groupAvailableDatesCalculated, groupNotAvailableDatesCalculated } = useMemo(() => {
    console.log('\n=== INICIO cálculo ULTRA-OPTIMIZADO de disponibilidad ===');
    
    // Si no hay miembros en el grupo, no hay fechas disponibles
    if (members.length === 0) {
      console.log('No hay miembros en el grupo');
      return {
        groupAvailableDatesCalculated: [],
        groupNotAvailableDatesCalculated: []
      };
    }

    const principalMembers = members.filter(m => m.role_in_group === 'principal');
    const substitutes = members.filter(m => m.role_in_group === 'sustituto');
    
    console.log(`Miembros principales: ${principalMembers.length}, Sustitutos: ${substitutes.length}`);
    
    // Si no hay miembros principales, no hay fechas disponibles
    if (principalMembers.length === 0) {
      console.log('No hay miembros principales en el grupo');
      return {
        groupAvailableDatesCalculated: [],
        groupNotAvailableDatesCalculated: []
      };
    }
    
    // PRE-PROCESAMIENTO: Crear Maps optimizados
    console.log('🚀 Pre-procesando datos una sola vez...');
    
    // Map de disponibilidades marcadas: userId -> Set de fechas
    const availabilityMap = new Map<string, Set<string>>();
    availabilities.forEach(member => {
      const dateSet = new Set<string>();
      member.dates.forEach(date => {
        dateSet.add(format(date, 'yyyy-MM-dd'));
      });
      availabilityMap.set(member.userId, dateSet);
    });
    
    // Map de eventos del grupo: userId -> Set de fechas
    const groupEventMap = new Map<string, Set<string>>();
    memberEvents.forEach(event => {
      if (!groupEventMap.has(event.user_id)) {
        groupEventMap.set(event.user_id, new Set());
      }
      groupEventMap.get(event.user_id)!.add(format(new Date(event.date), 'yyyy-MM-dd'));
    });
    
    // Map de eventos externos: userId -> Set de fechas
    const externalEventMap = new Map<string, Set<string>>();
    memberExternalEvents.forEach(event => {
      if (!externalEventMap.has(event.user_id)) {
        externalEventMap.set(event.user_id, new Set());
      }
      externalEventMap.get(event.user_id)!.add(format(new Date(event.date), 'yyyy-MM-dd'));
    });
    
    // Map de instrumentos: userId -> Set de instrumentos
    const instrumentMap = new Map<string, Set<string>>();
    [...principalMembers, ...substitutes].forEach(member => {
      if (member.user_id) {
        instrumentMap.set(member.user_id, new Set(member.instruments.map(i => i.id)));
      }
    });
    
    // PASO 1: PRE-CALCULAR disponibilidad real POR MIEMBRO (una sola vez por miembro)
    console.log('📅 Calculando disponibilidad real por miembro...');
    
    interface MemberAvailabilityInfo {
      member: GroupMember;
      reallyAvailableDates: Set<string>;
      allMarkedDates: Set<string>;
      blockedByGroupEvents: Set<string>;
      blockedByExternalEvents: Set<string>;
    }
    
    const calculateRealAvailabilityForMember = (member: GroupMember): MemberAvailabilityInfo => {
      if (!member.user_id) {
        return {
          member,
          reallyAvailableDates: new Set(),
          allMarkedDates: new Set(),
          blockedByGroupEvents: new Set(),
          blockedByExternalEvents: new Set()
        };
      }
      
      const markedDates = availabilityMap.get(member.user_id) || new Set();
      const groupEventDates = groupEventMap.get(member.user_id) || new Set();
      const externalEventDates = externalEventMap.get(member.user_id) || new Set();
      
      // Fechas realmente disponibles = marcadas - eventos del grupo - eventos externos
      const reallyAvailable = new Set<string>();
      markedDates.forEach(date => {
        if (!groupEventDates.has(date) && !externalEventDates.has(date)) {
          reallyAvailable.add(date);
        }
      });
      
      console.log(`${member.name}: ${markedDates.size} marcadas, ${groupEventDates.size} eventos grupo, ${externalEventDates.size} eventos externos => ${reallyAvailable.size} realmente disponibles`);
      
      return {
        member,
        reallyAvailableDates: reallyAvailable,
        allMarkedDates: markedDates,
        blockedByGroupEvents: groupEventDates,
        blockedByExternalEvents: externalEventDates
      };
    };
    
    // Calcular disponibilidad real para TODOS los miembros
    const principalAvailability = principalMembers.map(calculateRealAvailabilityForMember);
    const substituteAvailability = substitutes.map(calculateRealAvailabilityForMember);
    
    // PASO 2: Encontrar TODAS las fechas únicas mencionadas
    const allPossibleDates = new Set<string>();
    [...principalAvailability, ...substituteAvailability].forEach(memberInfo => {
      memberInfo.allMarkedDates.forEach(date => allPossibleDates.add(date));
      memberInfo.blockedByGroupEvents.forEach(date => allPossibleDates.add(date));
      memberInfo.blockedByExternalEvents.forEach(date => allPossibleDates.add(date));
    });
    
    console.log(`🎯 Total de fechas únicas a evaluar: ${allPossibleDates.size}`);
    
    // PASO 3: Evaluar disponibilidad del grupo (UNA SOLA VEZ por fecha, no por miembro)
    const availableDates: Date[] = [];
    const notAvailableDates: Date[] = [];
    
    Array.from(allPossibleDates).forEach(dateStr => {
      console.log(`\n📅 Evaluando fecha: ${dateStr}`);
      
      // Principales disponibles en esta fecha
      const availablePrincipals = principalAvailability.filter(pInfo => 
        pInfo.reallyAvailableDates.has(dateStr)
      );
      
      // Principales NO disponibles en esta fecha
      const unavailablePrincipals = principalAvailability.filter(pInfo => 
        !pInfo.reallyAvailableDates.has(dateStr)
      );
      
      console.log(`   Principales disponibles: ${availablePrincipals.length}/${principalMembers.length}`);
      
      if (unavailablePrincipals.length === 0) {
        // Todos los principales disponibles
        console.log(`   ✅ DISPONIBLE: Todos los principales disponibles`);
        availableDates.push(new Date(dateStr));
      } else {
        // Verificar si los principales faltantes pueden ser sustituidos
        console.log(`   🔄 Verificando sustitutos para ${unavailablePrincipals.length} principales faltantes...`);
        
        const canBeFullySubstituted = unavailablePrincipals.every(principalInfo => {
          const requiredInstruments = instrumentMap.get(principalInfo.member.user_id!) || new Set();
          
          // Sustitutos disponibles en esta fecha
          const availableSubsForDate = substituteAvailability.filter(subInfo => 
            subInfo.reallyAvailableDates.has(dateStr)
          );
          
          // ¿Algún sustituto disponible puede cubrir todos los instrumentos requeridos?
          const canBeCovered = availableSubsForDate.some(subInfo => {
            const subInstruments = instrumentMap.get(subInfo.member.user_id!) || new Set();
            return Array.from(requiredInstruments).every(instrId => subInstruments.has(instrId));
          });
          
          console.log(`     ${principalInfo.member.name} puede ser sustituido: ${canBeCovered}`);
          return canBeCovered;
        });
        
        if (canBeFullySubstituted) {
          console.log(`   ✅ DISPONIBLE: Con sustitutos`);
          availableDates.push(new Date(dateStr));
        } else {
          console.log(`   ❌ NO DISPONIBLE: No se pueden cubrir todos los principales faltantes`);
          notAvailableDates.push(new Date(dateStr));
        }
      }
    });

    console.log('\n=== RESUMEN ULTRA-OPTIMIZADO ===');
    console.log(`📊 Fechas evaluadas: ${allPossibleDates.size}`);
    console.log(`✅ Fechas disponibles: ${availableDates.length}`);
    console.log(`❌ Fechas NO disponibles: ${notAvailableDates.length}`);
    console.log(`🎯 Logs por fecha reducidos de ~${allPossibleDates.size * (principalMembers.length + substitutes.length)} a ${allPossibleDates.size}`);
    
    return {
      groupAvailableDatesCalculated: availableDates,
      groupNotAvailableDatesCalculated: notAvailableDates
    };
  }, [members, availabilities, memberEvents, memberExternalEvents]);

  // Actualizar el estado cuando cambie el cálculo memoizado
  useEffect(() => {
    setGroupAvailableDates(groupAvailableDatesCalculated);
    setGroupNotAvailableDates(groupNotAvailableDatesCalculated);
  }, [groupAvailableDatesCalculated, groupNotAvailableDatesCalculated]);

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
    console.log('=== INICIO fetchMemberExternalEvents ===');
    console.log('GroupId actual:', groupId);
    
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
    
    console.log('4. Query completa:', fullQuery.data);
    
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
    
    console.log('Eventos externos formateados:', formattedExternalEvents);
    console.log('=== FIN fetchMemberExternalEvents ===');
  };
  

  const fetchAllAvailabilities = async () => {
    if (!groupId) return;
    
    setLoading(true);
    try {
      const groupMemberIds = members
        .filter((m): m is GroupMember & { user_id: string } => m.user_id !== null)
        .map(m => m.user_id);

      interface AvailabilityData {
        user_id: string;
        date: string;
      }

      const response = await safeSupabaseRequest(
        async () => {
          return await supabase
            .from('member_availability')
            .select('user_id, date')
            .in('user_id', groupMemberIds)
            .order('date');
        },
        'Error fetching availabilities'
      );

      if (response) {
        const formattedAvailabilities = members
          .filter((m): m is GroupMember & { user_id: string } => m.user_id !== null)
          .map(member => ({
            userId: member.user_id,
            memberName: member.name || 'Unknown Member',
            dates: response
              .filter((item: AvailabilityData) => item.user_id === member.user_id)
              .map((item: AvailabilityData) => new Date(item.date)),
            instruments: member.instruments || [],
            roleInBand: (member.role_in_group as 'principal' | 'sustituto') || 'principal'
          }));
        setAvailabilities(formattedAvailabilities);
      }
    } catch (error) {
      console.error('Error fetching availabilities:', error);
      toast.error('Error al obtener las disponibilidades');
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
        fetchAllAvailabilities(),
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
    console.log(`Fecha seleccionada: ${format(day, 'dd/MM/yyyy')}`);
    
    if (!user) {
      toast.error('Debes iniciar sesión para gestionar la disponibilidad');
      return;
    }
    
    // Evitar múltiples clics rápidos
    if (saving) {
      return;
    }
    
    setSaving(true);

    const currentMember = members.find(m => m.user_id === user.id);
    const canManage = isAdmin || 
      currentMember?.role_in_group === 'principal' || 
      user.id === (selectedMemberId ?? user.id);

    if (!canManage) {
      toast.error('No tienes permisos para gestionar esta disponibilidad');
      setSaving(false);
      return;
    }

    const userId = selectedMemberId ?? user.id;

    const hasEventOnDate = memberEvents.some((event: MemberEvent) => 
      event.user_id === userId &&
      isSameDay(new Date(event.date), day)
    );

    if (hasEventOnDate) {
      toast.error('No puedes cambiar tu disponibilidad en fechas con eventos programados');
      setSaving(false);
      return;
    }
    
    try {
      const currentMember = members.find(m => m.user_id === userId);
      if (!currentMember) {
        toast.error('Miembro no encontrado');
        setSaving(false);
        return;
      }
  
      const isSelected = availabilities
        .find(a => a.userId === currentMember.user_id)
        ?.dates.some(d => isSameDay(d, day));
  
      const dateStr = format(day, 'yyyy-MM-dd');
      
      // Actualizar el estado visual del día seleccionado después de determinar si está disponible o no
      // Solo actualizamos el día seleccionado si la operación es exitosa
      
      if (isSelected) {
        // Eliminar la fecha de la base de datos
        try {
          // Luego intentamos la operación en la base de datos
          const deleteResponse = await supabase
            .from('member_availability')
            .delete()
            .eq('user_id', currentMember.user_id)
            .eq('date', dateStr);
          
          if (deleteResponse.error) {
            console.error('Error al eliminar disponibilidad:', deleteResponse.error);
            toast.error('Hubo un problema al guardar');
            setSaving(false);
            return;
          }
          
          // Si la operación fue exitosa, actualizamos el estado visual
          setSelectedDay(day);
          toast.success(`Fecha ${format(day, 'dd/MM/yyyy')} eliminada de tu disponibilidad`);
          
          // Actualizar el estado local sin hacer fetch
          setAvailabilities(prev => prev.map(avail => {
            if (avail.userId === currentMember.user_id) {
              return {
                ...avail,
                dates: avail.dates.filter(d => !isSameDay(d, day))
              };
            }
            return avail;
          }));
          
          // La disponibilidad del grupo se recalcula automáticamente
        } catch (error) {
          console.error('Error inesperado al eliminar disponibilidad:', error);
          toast.error('Ha ocurrido un error al procesar tu solicitud');
        }
      } else {
        // Añadir la fecha a la base de datos
        try {
          // Luego intentamos la operación en la base de datos
          const insertResponse = await supabase
            .from('member_availability')
            .insert([{ user_id: currentMember.user_id, date: dateStr }]);
          
          if (insertResponse.error) {
            console.error('Error al insertar disponibilidad:', insertResponse.error);
            toast.error('Hubo un problema al guardar');
            setSaving(false);
            return;
          }
          
          // Si la operación fue exitosa, actualizamos el estado visual
          setSelectedDay(day);
          toast.success(`Fecha ${format(day, 'dd/MM/yyyy')} añadida a tu disponibilidad`);
          
          // Actualizar el estado local sin hacer fetch
          setAvailabilities(prev => prev.map(avail => {
            if (avail.userId === currentMember.user_id) {
              return {
                ...avail,
                dates: [...avail.dates, day]
              };
            }
            return avail;
          }));
          
          // La disponibilidad del grupo se recalcula automáticamente
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

  function getMembersForDay(date: Date) {
    return members.filter(member => {
      const isAvailable = availabilities
        .find(a => a.userId === member.user_id)
        ?.dates.some(d => isSameDay(d, date)) ?? false;

      // Verificamos si hay eventos externos (no se usa actualmente pero podría ser útil)
      // const memberHasExternalEvent = memberExternalEvents.some(event => 
      //   event.user_id === member.user_id && 
      //   isSameDay(new Date(event.date), date)
      // );

      const hasGroupEvent = groupEvents.some(event => 
        event.user_id === member.user_id && 
        isSameDay(new Date(event.date), date)
      );

      return isAvailable || hasGroupEvent;
    });
  }

  const DayContent = (props: { date: Date }) => {
    const { date } = props;
    const membersForDay = getMembersForDay(date);
    
    // Check if current user is involved
    const isCurrentUserInvolved = membersForDay.some(
      m => m.user_id === (selectedMemberId || user?.id)
    );
    
    // Check if current user has external events
    const currentUserHasExternalEvent = isCurrentUserInvolved && memberExternalEvents.some(event => 
      event.user_id === (selectedMemberId || user?.id) && 
      isSameDay(new Date(event.date), date)
    );
    
    // Get other members (not the current user)
    const otherMembers = membersForDay.filter(
      m => m.user_id !== (selectedMemberId || user?.id)
    );
    const otherMembersCount = otherMembers.length;
    
    // Count how many other members have external events
    const otherMembersWithExternalEvents = otherMembers.filter(member => 
      memberExternalEvents.some(event => 
        event.user_id === member.user_id && 
        isSameDay(new Date(event.date), date)
      )
    ).length;
    
    const isGroupAvailable = groupAvailableDates.some(d => isSameDay(d, date));
    const isGroupNotAvailable = groupNotAvailableDates.some(d => isSameDay(d, date));
    const events = getEventsForDate(date);
    const hasEvent = events.length > 0;
    
    // Check if any member has external events
    const hasMembersWithExternalEvents = currentUserHasExternalEvent || otherMembersWithExternalEvents > 0;

    return (
      <div
        className={`day-content ${isGroupAvailable ? 'group-available' : ''} ${
          isGroupNotAvailable ? 'group-not-available' : ''
        } ${hasEvent ? 'has-event' : ''} ${
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
                    const isAvailable = availabilities
                      .find(a => a.userId === member.user_id)
                      ?.dates.some(d => isSameDay(d, date)) ?? false;

                    const memberHasExternalEvent = memberExternalEvents.some(event => 
                      event.user_id === member.user_id && 
                      isSameDay(new Date(event.date), date)
                    );
                    
                    // La información de eventos externos ya se muestra en el tooltip general

                    return (
                      <div
                        key={member.id}
                        className={`tooltip-member ${
                          member.user_id === (selectedMemberId || user?.id) ? 'you' : 'other'
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
                              {member.user_id === (selectedMemberId || user?.id) && (
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
    // Filtrar fechas disponibles sin eventos
    const availableDatesWithoutEvents = groupAvailableDates
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
              value={selectedMemberId || user?.id || ''}
              onChange={(e) => setSelectedMemberId(e.target.value === user?.id ? null : e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md shadow-sm"
            >
              {members.map((member) => (
                <option key={member.id} value={member.user_id || ''}>
                  {member.name} {member.user_id === user?.id ? '(Tú)' : ''}
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
          onSelect={setSelectedDay}
          onDayClick={handleDayClick}
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
        <button
          onClick={downloadAvailabilityDates}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Download className="w-4 h-4 mr-2" />
          Descargar Fechas Disponibles del Grupo
        </button>
      </div>
    </div>
  );
}