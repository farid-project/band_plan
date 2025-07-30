import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { GroupMember, MemberAvailability, Event } from '../types';
import { Users, Calendar, TrendingUp, BarChart3, Clock, MapPin } from 'lucide-react';
import { format, isAfter, isBefore, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

interface GroupStatisticsProps {
  groupId: string;
  members: GroupMember[];
}

interface AvailabilityStats {
  totalAvailableDays: number;
  averageAvailabilityPerMember: number;
  mostAvailableMember: string;
  leastAvailableMember: string;
  upcomingAvailableDays: number;
}

interface EventStats {
  totalEvents: number;
  upcomingEvents: number;
  averageEventFrequency: string;
  mostCommonLocation: string;
  eventsThisMonth: number;
  eventsLastMonth: number;
}

interface MemberAvailabilityExtended extends MemberAvailability {
  member_name?: string;
}

export default function GroupStatistics({ groupId, members }: GroupStatisticsProps) {
  const [availabilities, setAvailabilities] = useState<MemberAvailabilityExtended[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatisticsData();
  }, [groupId]);

  const fetchStatisticsData = async () => {
    setLoading(true);
    try {
      // Fetch member availabilities for group members
      const memberIds = members.map(m => m.user_id).filter(Boolean);
      
      const { data: availabilityData, error: availabilityError } = await supabase
        .from('member_availability')
        .select('*')
        .in('user_id', memberIds)
        .gte('date', format(subMonths(new Date(), 6), 'yyyy-MM-dd'));

      if (availabilityError) throw availabilityError;

      const transformedAvailabilities = availabilityData?.map(item => {
        const member = members.find(m => m.user_id === item.user_id);
        return {
          ...item,
          member_name: member?.name || 'Unknown'
        };
      }) || [];

      setAvailabilities(transformedAvailabilities);

      // Fetch events with event_members
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          event_members (
            group_member_id,
            user_id
          )
        `)
        .eq('group_id', groupId)
        .order('date', { ascending: false });

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);

    } catch (error) {
      console.error('Error fetching statistics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const availabilityStats = useMemo((): AvailabilityStats => {
    const today = new Date();
    const memberStats = new Map<string, number>();
    
    // Count availability per member
    availabilities.forEach(availability => {
      const memberName = availability.member_name || 'Unknown';
      memberStats.set(memberName, (memberStats.get(memberName) || 0) + 1);
    });

    // Calculate stats
    const totalAvailableDays = availabilities.length;
    const averageAvailabilityPerMember = members.length > 0 ? totalAvailableDays / members.length : 0;
    
    let mostAvailableMember = 'N/A';
    let leastAvailableMember = 'N/A';
    let maxAvailability = 0;
    let minAvailability = Infinity;

    if (memberStats.size > 0) {
      for (const [member, count] of memberStats.entries()) {
        if (count > maxAvailability) {
          maxAvailability = count;
          mostAvailableMember = member;
        }
        if (count < minAvailability) {
          minAvailability = count;
          leastAvailableMember = member;
        }
      }
    }

    const upcomingAvailableDays = availabilities.filter(
      a => isAfter(new Date(a.date), today)
    ).length;

    return {
      totalAvailableDays,
      averageAvailabilityPerMember,
      mostAvailableMember,
      leastAvailableMember,
      upcomingAvailableDays
    };
  }, [availabilities, members]);

  const eventStats = useMemo((): EventStats => {
    const today = new Date();
    const thisMonthStart = startOfMonth(today);
    const thisMonthEnd = endOfMonth(today);
    const lastMonthStart = startOfMonth(subMonths(today, 1));
    const lastMonthEnd = endOfMonth(subMonths(today, 1));

    const totalEvents = events.length;
    const upcomingEvents = events.filter(
      e => isAfter(new Date(e.date), today)
    ).length;

    const eventsThisMonth = events.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate >= thisMonthStart && eventDate <= thisMonthEnd;
    }).length;

    const eventsLastMonth = events.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate >= lastMonthStart && eventDate <= lastMonthEnd;
    }).length;

    // Calculate average frequency (events per month)
    const sixMonthsAgo = subMonths(today, 6);
    const recentEvents = events.filter(e => isAfter(new Date(e.date), sixMonthsAgo));
    const averageEventFrequency = `${(recentEvents.length / 6).toFixed(1)} eventos/mes`;

    // Find most common location
    const locationCounts = new Map<string, number>();
    events.forEach(event => {
      const location = event.location || 'Sin ubicación';
      locationCounts.set(location, (locationCounts.get(location) || 0) + 1);
    });

    let mostCommonLocation = 'N/A';
    let maxLocationCount = 0;
    for (const [location, count] of locationCounts.entries()) {
      if (count > maxLocationCount) {
        maxLocationCount = count;
        mostCommonLocation = location;
      }
    }

    return {
      totalEvents,
      upcomingEvents,
      averageEventFrequency,
      mostCommonLocation,
      eventsThisMonth,
      eventsLastMonth
    };
  }, [events]);

  const memberAvailabilityData = useMemo(() => {
    const memberAvailabilityMap = new Map<string, number>();
    
    members.forEach(member => {
      const memberAvailabilities = availabilities.filter(
        a => a.member_name === member.name
      ).length;
      memberAvailabilityMap.set(member.name, memberAvailabilities);
    });

    return Array.from(memberAvailabilityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10 most active members
  }, [members, availabilities]);

  const memberEventParticipationData = useMemo(() => {
    const memberEventMap = new Map<string, number>();
    
    // Initialize all members with 0 events
    members.forEach(member => {
      memberEventMap.set(member.name, 0);
    });

    // Count events for each member using event_members
    events.forEach(event => {
      if (event.event_members && event.event_members.length > 0) {
        event.event_members.forEach(eventMember => {
          const member = members.find(m => m.id === eventMember.group_member_id);
          if (member) {
            const currentCount = memberEventMap.get(member.name) || 0;
            memberEventMap.set(member.name, currentCount + 1);
          }
        });
      }
    });

    return Array.from(memberEventMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10 most participating members
  }, [members, events]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-6">
              <div className="h-6 w-24 bg-gray-200 animate-pulse rounded mb-2"></div>
              <div className="h-8 w-16 bg-gray-200 animate-pulse rounded"></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="h-6 w-32 bg-gray-200 animate-pulse rounded mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 animate-pulse rounded"></div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="h-6 w-32 bg-gray-200 animate-pulse rounded mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 animate-pulse rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, title, value, subtitle, color = "indigo" }: {
    icon: any;
    title: string;
    value: string | number;
    subtitle?: string;
    color?: string;
  }) => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center">
        <div className={`p-2 rounded-lg bg-${color}-100`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          title="Miembros Activos"
          value={members.length}
          color="blue"
        />
        <StatCard
          icon={Calendar}
          title="Días Disponibles"
          value={availabilityStats.upcomingAvailableDays}
          subtitle="próximos"
          color="green"
        />
        <StatCard
          icon={TrendingUp}
          title="Eventos Próximos"
          value={eventStats.upcomingEvents}
          color="purple"
        />
        <StatCard
          icon={Clock}
          title="Eventos Este Mes"
          value={eventStats.eventsThisMonth}
          subtitle={`vs ${eventStats.eventsLastMonth} el mes pasado`}
          color="orange"
        />
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Availability Statistics */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <Calendar className="w-5 h-5 text-indigo-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Estadísticas de Disponibilidad</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Total días marcados:</span>
              <span className="font-medium">{availabilityStats.totalAvailableDays}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Promedio por miembro:</span>
              <span className="font-medium">{availabilityStats.averageAvailabilityPerMember.toFixed(1)} días</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Más disponible:</span>
              <span className="font-medium text-green-600">{availabilityStats.mostAvailableMember}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Menos disponible:</span>
              <span className="font-medium text-orange-600">{availabilityStats.leastAvailableMember}</span>
            </div>
          </div>
        </div>

        {/* Event Statistics */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <BarChart3 className="w-5 h-5 text-indigo-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Estadísticas de Eventos</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Total eventos:</span>
              <span className="font-medium">{eventStats.totalEvents}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Frecuencia promedio:</span>
              <span className="font-medium">{eventStats.averageEventFrequency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Ubicación más común:</span>
              <span className="font-medium flex items-center">
                <MapPin className="w-4 h-4 mr-1" />
                {eventStats.mostCommonLocation}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tendencia mensual:</span>
              <span className={`font-medium ${
                eventStats.eventsThisMonth >= eventStats.eventsLastMonth 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {eventStats.eventsThisMonth >= eventStats.eventsLastMonth ? '↗' : '↘'} 
                {eventStats.eventsThisMonth >= eventStats.eventsLastMonth ? ' Creciente' : ' Decreciente'}
              </span>
            </div>
          </div>
        </div>

        {/* Member Availability Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <Calendar className="w-5 h-5 text-indigo-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Disponibilidad por Miembro</h3>
            <span className="ml-2 text-sm text-gray-500">(últimos 6 meses)</span>
          </div>
          {memberAvailabilityData.length > 0 ? (
            <div className="space-y-3">
              {memberAvailabilityData.map(([memberName, count], index) => {
                const maxCount = Math.max(...memberAvailabilityData.map(([, c]) => c));
                const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                
                return (
                  <div key={memberName} className="flex items-center space-x-3">
                    <div className="w-24 text-sm text-gray-600 truncate" title={memberName}>
                      {memberName}
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          index === 0 ? 'bg-green-500' :
                          index === 1 ? 'bg-blue-500' :
                          index === 2 ? 'bg-purple-500' : 'bg-gray-400'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="text-sm font-medium text-gray-700 w-12 text-right">
                      {count} días
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No hay datos de disponibilidad</p>
            </div>
          )}
        </div>

        {/* Member Event Participation Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <Users className="w-5 h-5 text-purple-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Participación en Eventos</h3>
            <span className="ml-2 text-sm text-gray-500">(todos los eventos)</span>
          </div>
          {memberEventParticipationData.length > 0 ? (
            <div className="space-y-3">
              {memberEventParticipationData.map(([memberName, count], index) => {
                const maxCount = Math.max(...memberEventParticipationData.map(([, c]) => c));
                const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                
                return (
                  <div key={memberName} className="flex items-center space-x-3">
                    <div className="w-24 text-sm text-gray-600 truncate" title={memberName}>
                      {memberName}
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          index === 0 ? 'bg-purple-500' :
                          index === 1 ? 'bg-pink-500' :
                          index === 2 ? 'bg-orange-500' : 'bg-gray-400'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="text-sm font-medium text-gray-700 w-16 text-right">
                      {count} evento{count !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No hay datos de eventos disponibles</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Summary */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen de Actividad Reciente</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{availabilityStats.upcomingAvailableDays}</div>
            <div className="text-sm text-green-700">Días disponibles próximos</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{eventStats.upcomingEvents}</div>
            <div className="text-sm text-blue-700">Eventos programados</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{members.length}</div>
            <div className="text-sm text-purple-700">Miembros en el grupo</div>
          </div>
        </div>
      </div>
    </div>
  );
}