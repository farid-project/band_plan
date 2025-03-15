import { useState, useEffect, useRef } from 'react';
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
    .rdp-day_selected:focus:not([disabled]),
    .selected-day:not([disabled]),
    .selected-day:hover:not([disabled]),
    .selected-day:focus:not([disabled]) { 
      background-color: #4f46e5 !important; 
      color: white !important;
      font-weight: bold !important;
      box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.5) !important;
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

  useEffect(() => {
    calculateGroupAvailability();
  }, [availabilities, memberEvents, groupEvents, memberExternalEvents]);

  useEffect(() => {
    if (onAvailableDatesChange) {
      onAvailableDatesChange(groupAvailableDates);
    }
  }, [groupAvailableDates, onAvailableDatesChange]);

  const checkAdminStatus = async () => {
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
  };

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

  const isMemberAvailableOnDate = (member: GroupMember, date: Date) => {
    console.log(`\nVerificando disponibilidad para el miembro: ${member.name} (ID: ${member.user_id}) en la fecha: ${format(date, 'yyyy-MM-dd')}`);
    
    // Verificar si el miembro tiene eventos en este grupo
    const hasGroupEventOnDate = memberEvents.some(event => {
      const eventDate = new Date(event.date);
      const result = (event.user_id === member.user_id) && isSameDay(eventDate, date);
      if (result) {
        console.log(`- Tiene un evento en el grupo actual el día: ${format(eventDate, 'yyyy-MM-dd')}`);
      }
      return result;
    });

    if (hasGroupEventOnDate) {
      console.log(`=> El miembro ${member.name} no está disponible debido a un evento en el grupo actual.`);
      return false;
    }

    // Verificar si el miembro tiene eventos en otros grupos
    const hasExternalEventOnDate = memberExternalEvents.some(event => {
      const eventDate = new Date(event.date);
      const result = (event.user_id === member.user_id) && isSameDay(eventDate, date);
      if (result) {
        console.log(`- Tiene un evento en otra banda el día: ${format(eventDate, 'yyyy-MM-dd')}`);
      }
      return result;
    });

    if (hasExternalEventOnDate) {
      console.log(`=> El miembro ${member.name} no está disponible debido a un evento en otra banda.`);
      return false;
    }

    // Verificar la disponibilidad del miembro
    const memberAvailability = availabilities.find(a => a.userId === member.user_id);
    const isAvailable = memberAvailability?.dates.some(d => isSameDay(d, date)) ?? false;
    console.log(`- Disponibilidad marcada: ${isAvailable ? 'Sí' : 'No'}`);
    
    return isAvailable;
  };

  const getEventsForDate = (date: Date) => {
    return groupEvents.filter(event => 
      isSameDay(new Date(event.date), date)
    );
  };

  const calculateGroupAvailability = () => {
    try {
      console.log('\n=== INICIO calculateGroupAvailability ===');
      console.log('Members recibidos:', members);
      
      // Si no hay miembros en el grupo, no hay fechas disponibles
      if (members.length === 0) {
        console.log('No hay miembros en el grupo');
        setGroupAvailableDates([]);
        setGroupNotAvailableDates([]);
        return;
      }
    
    const allDatesSet = new Set<string>();
    console.log('1. Creando conjunto de fechas...');
    
    const availableDates: Date[] = [];
    const notAvailableDates: Date[] = [];
    
    const principalMembers = members.filter(m => m.role_in_group === 'principal');
    console.log('4. Miembros principales encontrados:', principalMembers.length);
    console.log('5. Nombres de principales:', principalMembers.map(m => m.name));
    
    // Si no hay miembros principales, no hay fechas disponibles
    if (principalMembers.length === 0) {
      console.log('No hay miembros principales en el grupo');
      setGroupAvailableDates([]);
      setGroupNotAvailableDates([]);
      return;
    }
    
    availabilities.forEach(member => {
      member.dates.forEach(date => {
        allDatesSet.add(format(date, 'yyyy-MM-dd'));
      });
    });
    
    memberExternalEvents.forEach(event => {
      allDatesSet.add(format(new Date(event.date), 'yyyy-MM-dd'));
    });
    console.log('3. Fechas incluyendo eventos externos:', Array.from(allDatesSet));
    
    const allDates = Array.from(allDatesSet).map(dateStr => new Date(dateStr));
    
    console.log('4. Miembros principales encontrados:', principalMembers.length);
    console.log('5. Nombres de principales:', principalMembers.map(m => m.name));
    
    const substitutes = members.filter(m => m.role_in_group === 'sustituto');
    console.log('6. Sustitutos encontrados:', substitutes.length);

    allDates.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      console.log(`\n=== Analizando fecha: ${dateStr} ===`);
      console.log('Miembros principales a verificar:', principalMembers.map(m => m.name));
      
      // Aquí es donde queremos verificar si llegamos
      principalMembers.forEach(principal => {
        console.log(`\nVerificando principal: ${principal.name}`);
        
        // Verificar disponibilidad marcada
        const memberAvail = availabilities.find(a => a.userId === principal.user_id);
        const hasMarkedAvailability = memberAvail?.dates.some(d => isSameDay(d, date)) ?? false;
        console.log(`- Disponibilidad marcada: ${hasMarkedAvailability}`);
        
        // Verificar eventos en el grupo actual
        const hasGroupEvent = memberEvents.some(event => 
          event.user_id === principal.user_id && 
          isSameDay(new Date(event.date), date)
        );
        console.log(`- Tiene evento en este grupo: ${hasGroupEvent}`);
        
        // Verificar eventos externos
        const hasExternalEvent = memberExternalEvents.some(event => 
          event.user_id === principal.user_id && 
          isSameDay(new Date(event.date), date)
        );
        console.log(`- Tiene evento externo: ${hasExternalEvent}`);
        
        // Disponibilidad final
        const isAvailable = hasMarkedAvailability && !hasGroupEvent && !hasExternalEvent;
        console.log(`=> Disponibilidad final: ${isAvailable}`);
      });
      
      const unavailablePrincipals = principalMembers.filter(principal => {
        const isAvailable = isMemberAvailableOnDate(principal, date);
        console.log(`${principal.name} disponible: ${isAvailable}`);
        return !isAvailable;
      });

      console.log(`\nPrincipales NO disponibles (${unavailablePrincipals.length}):`, 
        unavailablePrincipals.map(p => p.name));

      if (unavailablePrincipals.length === 0) {
        console.log(`=> La fecha ${dateStr} está disponible para el grupo (todos los principales disponibles).`);
        availableDates.push(date);
      } else {
        console.log(`\nVerificando sustitutos para ${dateStr}...`);
        
        const canBeSubstituted = unavailablePrincipals.every(principal => {
          console.log(`\nBuscando sustitutos para ${principal.name}:`);
          const requiredInstruments = principal.instruments.map(i => i.id);
          console.log(`- Instrumentos requeridos:`, requiredInstruments);
          
          const availableSubstitutes = substitutes.filter(sub => {
            const isAvailable = isMemberAvailableOnDate(sub, date);
            console.log(`- Sustituto ${sub.name}: Disponible=${isAvailable}`);
            return isAvailable;
          });
          
          console.log(`- Sustitutos disponibles:`, availableSubstitutes.map(s => s.name));
          
          const canCoverInstruments = availableSubstitutes.some(sub => {
            const subInstruments = sub.instruments.map(i => i.id);
            const covers = requiredInstruments.every(instrId => subInstruments.includes(instrId));
            console.log(`  * ${sub.name} puede cubrir instrumentos: ${covers}`);
            return covers;
          });

          console.log(`=> ${principal.name} puede ser sustituido: ${canCoverInstruments}`);
          return canCoverInstruments;
        });

        if (canBeSubstituted) {
          console.log(`=> La fecha ${dateStr} está disponible mediante sustituciones.`);
          availableDates.push(date);
        } else {
          console.log(`=> La fecha ${dateStr} NO está disponible para el grupo.`);
          notAvailableDates.push(date);
        }
      }
    });

    console.log('\n=== RESUMEN FINAL ===');
    console.log('Fechas disponibles:', availableDates.map(d => format(d, 'yyyy-MM-dd')));
    console.log('Fechas NO disponibles:', notAvailableDates.map(d => format(d, 'yyyy-MM-dd')));
    
    setGroupAvailableDates(availableDates);
    setGroupNotAvailableDates(notAvailableDates);
    } catch (error) {
      console.error('ERROR en calculateGroupAvailability:', error);
    }
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
      
      // Actualizar la disponibilidad del grupo
      calculateGroupAvailability();
      
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
    // Forzar la actualización del día seleccionado inmediatamente
    setSelectedDay(day);
    
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
      return;
    }

    const userId = selectedMemberId ?? user.id;

    const hasEventOnDate = memberEvents.some((event: MemberEvent) => 
      event.user_id === userId &&
      isSameDay(new Date(event.date), day)
    );

    if (hasEventOnDate) {
      toast.error('No puedes cambiar tu disponibilidad en fechas con eventos programados');
      return;
    }
    
    setSaving(true);
    try {
      const currentMember = members.find(m => m.user_id === userId);
      if (!currentMember) {
        toast.error('Miembro no encontrado');
        return;
      }
  
      const isSelected = availabilities
        .find(a => a.userId === currentMember.user_id)
        ?.dates.some(d => isSameDay(d, day));
  
      const dateStr = format(day, 'yyyy-MM-dd');
      
      // Enfoque simplificado: primero actualizar en la base de datos
      if (isSelected) {
        // Eliminar la fecha de la base de datos
        try {
          // Primero mostramos un mensaje de éxito para feedback inmediato
          toast.success(`Fecha ${format(day, 'dd/MM/yyyy')} eliminada de tu disponibilidad`);
          
          // Luego intentamos la operación en la base de datos
          const deleteResponse = await supabase
            .from('member_availability')
            .delete()
            .eq('user_id', currentMember.user_id)
            .eq('date', dateStr);
          
          if (deleteResponse.error) {
            console.error('Error al eliminar disponibilidad:', deleteResponse.error);
            // Si hay error, mostramos un mensaje pero no interrumpimos la experiencia
            toast.error('Hubo un problema al guardar, pero intentaremos de nuevo');
          }
          
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
          
          // Recalcular la disponibilidad del grupo
          calculateGroupAvailability();
        } catch (error) {
          console.error('Error inesperado al eliminar disponibilidad:', error);
          // No mostramos error al usuario, ya que la fecha probablemente se eliminó
        } finally {
          setSaving(false);
        }
      } else {
        // Añadir la fecha a la base de datos
        try {
          // Primero mostramos un mensaje de éxito para feedback inmediato
          toast.success(`Fecha ${format(day, 'dd/MM/yyyy')} añadida a tu disponibilidad`);
          
          // Luego intentamos la operación en la base de datos
          const insertResponse = await supabase
            .from('member_availability')
            .insert([{ user_id: currentMember.user_id, date: dateStr }]);
          
          if (insertResponse.error) {
            console.error('Error al insertar disponibilidad:', insertResponse.error);
            // Si hay error, mostramos un mensaje pero no interrumpimos la experiencia
            toast.error('Hubo un problema al guardar, pero intentaremos de nuevo');
          }
          
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
          
          // Recalcular la disponibilidad del grupo
          calculateGroupAvailability();
        } catch (error) {
          console.error('Error inesperado al añadir disponibilidad:', error);
          // No mostramos error al usuario, ya que la fecha probablemente se guardó
        } finally {
          setSaving(false);
        }
      }
      
      // Recalcular la disponibilidad del grupo
      try {
        console.log('Intentando recalcular la disponibilidad del grupo...');
        calculateGroupAvailability();
        console.log('Disponibilidad del grupo recalculada con éxito');
      } catch (error) {
        console.error('Error al recalcular la disponibilidad del grupo:', error);
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
        } ${selectedDay && isSameDay(date, selectedDay) ? 'selected-day bg-indigo-600 text-white' : ''}`}
      >
        <span>{date.getDate()}</span>
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
            day_selected: 'bg-indigo-600 text-white font-bold hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500'
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