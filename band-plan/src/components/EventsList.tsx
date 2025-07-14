import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Event, GroupMember, Setlist } from '../types';
import { Calendar, Clock, Trash2, Edit2, Users, MapPin, Music } from 'lucide-react';
import { format, parseISO, isFuture, startOfDay } from 'date-fns';
import { toast } from 'react-hot-toast';
import Button from './Button';
import EventModal from './EventModal';
import { safeSupabaseRequest } from '../lib/supabaseUtils';
import { updateGroupCalendar } from '../utils/calendarSync';
import SetlistPreviewModal from './SetlistPreviewModal';


interface EventsListProps {
  groupId: string;
  canManageEvents: boolean;
  availableDates: Date[];
  members: GroupMember[];
}

interface EventMember {
  group_member_id: string;
  user_id: string | null;
  member_name: string;
  role_in_group: string;
}

interface EventWithMembers extends Event {
  members: EventMember[];
}

export default function EventsList({
  groupId,
  canManageEvents,
  availableDates,
  members,
}: EventsListProps) {
  const [events, setEvents] = useState<EventWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  // Estado para el modal de setlist preview
  const [previewSetlist, setPreviewSetlist] = useState<Setlist | null>(null);
  const [previewEventInfo, setPreviewEventInfo] = useState<{ name: string; date: string } | null>(null);
  const [previewBandName, setPreviewBandName] = useState<string>('');

  useEffect(() => {
    fetchEvents();
  }, [groupId]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data: eventsData, error } = await supabase
        .from('events')
        .select(`
          *,
          setlist:setlists (
            id,
            name,
            songs:setlist_songs(id),
            medleys(id)
          )
        `)
        .eq('group_id', groupId)
        .order('date')
        .order('time');

      if (error) {
        throw error;
      }

      if (eventsData) {
        const eventsWithMembers = await Promise.all(
          eventsData.map(async (event) => {
            const { data: eventMembers, error: membersError } = await supabase
              .from('event_members')
              .select('group_member_id, user_id')
              .eq('event_id', event.id);

            if (membersError) {
              console.error('Error loading event members:', membersError);
              return { ...event, members: [] };
            }

            const mappedMembers: EventMember[] =
              eventMembers?.map((em) => {
                const member = members.find((m) => m.id === em.group_member_id);
                return {
                  group_member_id: em.group_member_id,
                  user_id: em.user_id,
                  member_name: member?.name || 'Unknown Member',
                  role_in_group: member?.role_in_group || 'principal',
                };
              }) || [];

            return {
              ...event,
              members: mappedMembers,
            };
          })
        );

        setEvents(eventsWithMembers);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Error loading events');
    } finally {
      setLoading(false);
    }
  };



  const handleDelete = async (eventId: number) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este evento?')) {
      return;
    }

    try {
      const { data: eventMembers, error: membersError } = await supabase
        .from('event_members')
        .select(`
          group_member_id,
          user_id,
          group_members!event_members_group_member_id_fkey(sync_calendar)
        `)
        .eq('event_id', eventId);

      if (membersError) throw membersError;

      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (deleteError) throw deleteError;

      if (eventMembers && eventMembers.length > 0) {
        console.log('Actualizando calendarios después de eliminar evento');
        await Promise.all(
          eventMembers
            .filter(member => member.group_members.sync_calendar)
            .map(async (member) => {
              try {
                await updateGroupCalendar(groupId, member.group_member_id);
                console.log('Calendario actualizado para miembro:', member.group_member_id);
              } catch (error) {
                console.error('Error actualizando calendario para miembro:', member.group_member_id, error);
              }
            })
        );
      }

      toast.success('Evento eliminado correctamente');
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Error al eliminar el evento');
    }
  };

  const handleEdit = (event: Event) => {
    setSelectedEvent(event);
    setIsEditModalOpen(true);
  };

  const handlePreviewSetlist = async (event: EventWithMembers) => {
    // Fetch band name
    try {
      const { data: group, error } = await supabase
        .from('groups')
        .select('name')
        .eq('id', event.group_id)
        .single();
      if (error) throw error;
      setPreviewBandName(group?.name || '');
    } catch (err) {
      setPreviewBandName('');
    }

  const setlist = event.setlist;
  if (!setlist) {
    console.warn('Se intentó abrir un preview con un setlist undefined');
    return;
  }

  // store event info for modal
  setPreviewEventInfo({ name: event.name, date: event.date });
    if (!setlist) {
      console.warn('Se intentó abrir un preview con un setlist undefined');
      return;
    }

    try {
      const { data: fullSetlist, error } = await supabase
        .from('setlists')
        .select(`
          *,
          songs: setlist_songs(*, song: songs(*)),
          medleys: medleys(*, songs: medley_songs(*, song: songs(*)))
        `)
        .eq('id', setlist.id)
        .single();

      if (error) throw error;

      if (fullSetlist) {
        setPreviewSetlist(fullSetlist as Setlist);
      }
    } catch (error) {
      console.error('Error al cargar el setlist completo:', error);
      toast.error('Error al cargar el setlist');
    }
  };

  if (loading) {
    return <div className="text-center py-4">Cargando eventos...</div>;
  }

  const groupEventsByMonth = (eventsToGroup: EventWithMembers[]) => {
    const grouped = eventsToGroup.reduce((acc, event) => {
      const monthYear = format(parseISO(event.date), 'MMMM yyyy');
      if (!acc[monthYear]) {
        acc[monthYear] = [];
      }
      acc[monthYear].push(event);
      return acc;
    }, {} as Record<string, EventWithMembers[]>);

    return Object.entries(grouped);
  };

  const getLocationText = (location: string | undefined): string => {
    if (!location) return '';
    
    console.log('Location raw:', location);
    
    // Si es un objeto directo (no un string)
    if (typeof location === 'object' && location !== null) {
      return location.name || String(location);
    }

    if (typeof location !== 'string') {
      return String(location);
    }

    // Si es un string que representa un objeto
    if (location.startsWith('{') || location.startsWith('[')) {
      try {
        const locationData = JSON.parse(location);
        return locationData.name || locationData.formatted_address || locationData.description || String(locationData);
      } catch (error) {
        console.log('Location parse error:', error);
        return location;
      }
    }

    // Si es un string normal
    return location;
  };

  const openLocation = (location: string | undefined) => {
    if (!location) return;
    const query = getLocationText(location);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
  };

  const renderEventMembers = (event: EventWithMembers) => {
    const principalMembers = event.members.filter(m => m.role_in_group === 'principal');
    const substituteMembers = event.members.filter(m => m.role_in_group === 'sustituto');

    return (
      <div className="mt-1.5 space-y-1">
        <div className="flex flex-wrap gap-1">
          {principalMembers.map((member) => (
            <span
              key={member.group_member_id}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700"
            >
              {member.member_name}
            </span>
          ))}
        </div>

        {substituteMembers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-gray-500 mr-1">Sustitutos:</span>
            {substituteMembers.map((member) => (
              <span
                key={member.group_member_id}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-700"
              >
                {member.member_name}
              </span>
            ))}
          </div>
        )}

        {event.location && (
          <div className="flex items-center gap-1 mt-1">
            <button
              onClick={() => openLocation(event.location)}
              className="inline-flex items-center text-xs text-gray-600 hover:text-indigo-600"
            >
              <MapPin className="w-3 h-3 mr-1" />
              <span className="underline">
                {truncateLocation(getLocationText(event.location))}
              </span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const truncateLocation = (location: string, maxLength: number = 40) => {
    if (!location) return '';
    
    // Si la ubicación tiene una coma, mostrar solo la primera parte
    if (location.includes(',')) {
      const firstPart = location.split(',')[0];
      if (firstPart.length <= maxLength) return firstPart;
      return `${firstPart.slice(0, maxLength)}...`;
    }
    
    // Si no tiene coma, truncar normalmente
    return location.length > maxLength 
      ? `${location.slice(0, maxLength)}...` 
      : location;
  };

  const futureEvents = events.filter(event => 
    isFuture(startOfDay(parseISO(event.date)))
  );

  const pastEvents = events.filter(event => 
    !isFuture(startOfDay(parseISO(event.date)))
  );

  const getMemberRole = (member: GroupMember) => {
    return member.role?.name || 'Sin rol';
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Eventos</h2>
            {canManageEvents && (
              <Button onClick={() => setIsAddModalOpen(true)}>
                Añadir Evento
              </Button>
            )}
          </div>

          {events.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No hay eventos programados</p>
            </div>
          ) : (
            <div className="mt-4">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('upcoming')}
                    className={`${
                      activeTab === 'upcoming'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
                  >
                    <span>Próximos eventos</span>
                    {futureEvents.length > 0 && (
                      <span className={`${
                        activeTab === 'upcoming' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-900'
                      } py-0.5 px-2.5 rounded-full text-xs font-medium`}>
                        {futureEvents.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('past')}
                    className={`${
                      activeTab === 'past'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
                  >
                    <span>Eventos pasados</span>
                    {pastEvents.length > 0 && (
                      <span className={`${
                        activeTab === 'past' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-900'
                      } py-0.5 px-2.5 rounded-full text-xs font-medium`}>
                        {pastEvents.length}
                      </span>
                    )}
                  </button>
                </nav>
              </div>

              <div className="mt-4 space-y-6">
                {groupEventsByMonth(
                  activeTab === 'upcoming' ? futureEvents : pastEvents
                ).map(([monthYear, monthEvents]) => (
                  <div key={monthYear} className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                      {monthYear}
                    </h3>
                    <div className="space-y-1">
                      {monthEvents.map((event) => (
                        <div
                          key={event.id}
                          className="bg-white rounded-lg shadow-sm border border-gray-100 hover:border-gray-200 transition-colors"
                        >
                          <div className="p-3">
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-3">
                                  <div className="flex-shrink-0 w-12 text-center">
                                    <div className="text-lg font-bold text-gray-900">
                                      {format(parseISO(event.date), 'd')}
                                    </div>
                                    <div className="text-xs text-gray-500 uppercase">
                                      {format(parseISO(event.date), 'EEE')}
                                    </div>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-medium text-gray-900 truncate">
                                      {event.name}
                                    </h3>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                      <div className="flex items-center">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {format(
                                          parseISO(`2000-01-01T${event.time}`),
                                          'h:mm a'
                                        )}
                                      </div>
                                      <div className="flex items-center">
                                        <Users className="w-3 h-3 mr-1" />
                                        {event.members.length}
                                      </div>
                                      {event.setlist ? (
                                        <div className="flex items-center">
                                          <Music className="w-3 h-3 mr-1 text-blue-500" />
                                          <span 
                                            className="text-indigo-600 font-medium cursor-pointer hover:underline"
                                            onClick={() => event.setlist && handlePreviewSetlist(event)}
                                          >
                                            {event.setlist.name}
                                          </span>
                                          <span className="text-gray-400 ml-1">
                                            ({event.setlist.songs?.length || 0} canciones
                                            {event.setlist.medleys?.length > 0 && `, ${event.setlist.medleys.length} medleys`})
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center">
                                          <Music className="w-3 h-3 mr-1 text-gray-300" />
                                          <span className="text-gray-400 italic">
                                            Sin setlist
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {renderEventMembers(event)}
                                {event.notes && (
                                  <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                                    {event.notes}
                                  </p>
                                )}
                              </div>
                              {canManageEvents && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleEdit(event)}
                                    className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                                    title="Editar evento"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(event.id)}
                                    className="p-1 text-red-400 hover:text-red-600 rounded-full hover:bg-red-50"
                                    title="Eliminar evento"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <EventModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        groupId={groupId}
        onEventSaved={() => {
          fetchEvents();
          setIsAddModalOpen(false);
        }}
        availableDates={availableDates}
        members={members}
      />

      {selectedEvent && (
        <EventModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedEvent(null);
          }}
          groupId={groupId}
          event={selectedEvent}
          onEventSaved={() => {
            fetchEvents();
            setIsEditModalOpen(false);
            setSelectedEvent(null);
          }}
          availableDates={[...availableDates, parseISO(selectedEvent.date)]}
          members={members}
        />
      )}
      
      {previewSetlist && (
        <SetlistPreviewModal
          isOpen={!!previewSetlist}
          onClose={() => { setPreviewSetlist(null); setPreviewEventInfo(null); setPreviewBandName(''); }}
          setlist={previewSetlist}
          eventName={previewEventInfo?.name}
          eventDate={previewEventInfo?.date}
          bandName={previewBandName}
        />
      )}
    </div>
  );
}
