import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Song, Setlist, Event, GroupMember } from '../types';
import { BarChart3, TrendingUp, Calendar, Users, Music, Award, Clock, Target } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface AnalyticsDashboardProps {
  groupId: string;
}

interface SongStats {
  song: Song;
  usageCount: number;
  lastUsed?: string;
}

interface EventStats {
  totalEvents: number;
  upcomingEvents: number;
  monthlyEvents: { month: string; count: number }[];
  averageSetlistSize: number;
}

interface SetlistStats {
  totalSetlists: number;
  averageSongsPerSetlist: number;
  longestSetlist: { name: string; songCount: number };
  shortestSetlist: { name: string; songCount: number };
}

interface MemberStats {
  totalMembers: number;
  activeMembers: number;
  memberParticipation: { member: GroupMember; eventCount: number }[];
}

interface ArtistStats {
  artist: string;
  songCount: number;
  usageCount: number;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ groupId }) => {
  const [loading, setLoading] = useState(true);
  const [songStats, setSongStats] = useState<SongStats[]>([]);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const [setlistStats, setSetlistStats] = useState<SetlistStats | null>(null);
  const [memberStats, setMemberStats] = useState<MemberStats | null>(null);
  const [artistStats, setArtistStats] = useState<ArtistStats[]>([]);
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y' | 'all'>('6m');

  useEffect(() => {
    if (groupId) {
      loadAnalytics();
    }
  }, [groupId, timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSongStats(),
        loadEventStats(),
        loadSetlistStats(),
        loadMemberStats(),
        loadArtistStats(),
      ]);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
    setLoading(false);
  };

  const getDateRange = () => {
    const now = new Date();
    switch (timeRange) {
      case '3m': return subMonths(now, 3);
      case '6m': return subMonths(now, 6);
      case '1y': return subMonths(now, 12);
      default: return new Date('2020-01-01'); // All time
    }
  };

  const loadSongStats = async () => {
    try {
      // Get all songs and their usage in setlists
      const { data: songs } = await supabase
        .from('songs')
        .select('*')
        .eq('group_id', groupId)
        .eq('type', 'song');

      const { data: setlistSongs } = await supabase
        .from('setlist_songs')
        .select(`
          song_id,
          setlist:setlists!inner(created_at)
        `)
        .gte('setlist.created_at', getDateRange().toISOString());

      if (songs && setlistSongs) {
        const songUsage = new Map<string, { count: number; lastUsed?: string }>();
        
        setlistSongs.forEach(item => {
          const current = songUsage.get(item.song_id) || { count: 0 };
          songUsage.set(item.song_id, {
            count: current.count + 1,
            lastUsed: item.setlist?.created_at || current.lastUsed
          });
        });

        const stats: SongStats[] = songs
          .map(song => ({
            song,
            usageCount: songUsage.get(song.id)?.count || 0,
            lastUsed: songUsage.get(song.id)?.lastUsed,
          }))
          .sort((a, b) => b.usageCount - a.usageCount);

        setSongStats(stats);
      }
    } catch (error) {
      console.error('Error loading song stats:', error);
    }
  };

  const loadEventStats = async () => {
    try {
      const dateRange = getDateRange();
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('group_id', groupId)
        .gte('created_at', dateRange.toISOString());

      const { data: setlists } = await supabase
        .from('setlists')
        .select(`
          id,
          songs:setlist_songs(count),
          medleys:setlist_medleys(count)
        `)
        .eq('group_id', groupId);

      if (events) {
        const now = new Date();
        const upcomingEvents = events.filter(e => new Date(e.date) >= now).length;
        
        // Monthly events for the last 6 months
        const monthlyEvents = [];
        for (let i = 5; i >= 0; i--) {
          const monthStart = startOfMonth(subMonths(now, i));
          const monthEnd = endOfMonth(subMonths(now, i));
          const monthEvents = events.filter(e => {
            const eventDate = new Date(e.date);
            return eventDate >= monthStart && eventDate <= monthEnd;
          });
          
          monthlyEvents.push({
            month: format(monthStart, 'MMM yyyy'),
            count: monthEvents.length
          });
        }

        // Calculate average setlist size
        let totalSongs = 0;
        let setlistCount = 0;
        if (setlists) {
          setlists.forEach(setlist => {
            const songCount = (setlist.songs?.[0]?.count || 0) + (setlist.medleys?.[0]?.count || 0);
            if (songCount > 0) {
              totalSongs += songCount;
              setlistCount++;
            }
          });
        }

        setEventStats({
          totalEvents: events.length,
          upcomingEvents,
          monthlyEvents,
          averageSetlistSize: setlistCount > 0 ? Math.round(totalSongs / setlistCount) : 0
        });
      }
    } catch (error) {
      console.error('Error loading event stats:', error);
    }
  };

  const loadSetlistStats = async () => {
    try {
      const { data: setlists } = await supabase
        .from('setlists')
        .select(`
          id,
          name,
          songs:setlist_songs(count),
          medleys:setlist_medleys(count)
        `)
        .eq('group_id', groupId);

      if (setlists) {
        const setlistsWithCounts = setlists.map(setlist => ({
          ...setlist,
          songCount: (setlist.songs?.[0]?.count || 0) + (setlist.medleys?.[0]?.count || 0)
        })).filter(s => s.songCount > 0);

        const totalSongs = setlistsWithCounts.reduce((sum, s) => sum + s.songCount, 0);
        const averageSongs = setlistsWithCounts.length > 0 ? Math.round(totalSongs / setlistsWithCounts.length) : 0;

        const longest = setlistsWithCounts.reduce((max, current) => 
          current.songCount > max.songCount ? current : max, 
          setlistsWithCounts[0] || { name: 'N/A', songCount: 0 }
        );

        const shortest = setlistsWithCounts.reduce((min, current) => 
          current.songCount < min.songCount ? current : min, 
          setlistsWithCounts[0] || { name: 'N/A', songCount: 0 }
        );

        setSetlistStats({
          totalSetlists: setlists.length,
          averageSongsPerSetlist: averageSongs,
          longestSetlist: { name: longest.name, songCount: longest.songCount },
          shortestSetlist: { name: shortest.name, songCount: shortest.songCount }
        });
      }
    } catch (error) {
      console.error('Error loading setlist stats:', error);
    }
  };

  const loadMemberStats = async () => {
    try {
      const { data: members } = await supabase
        .from('group_members')
        .select(`
          *,
          user:users(id, email)
        `)
        .eq('group_id', groupId);

      const { data: eventMembers } = await supabase
        .from('event_members')
        .select(`
          member_id,
          event:events!inner(date)
        `)
        .gte('event.date', getDateRange().toISOString());

      if (members) {
        const activeMembers = members.filter(m => m.user).length;
        
        // Calculate participation
        const participation = members.map(member => {
          const eventCount = eventMembers?.filter(em => em.member_id === member.id).length || 0;
          return { member, eventCount };
        }).sort((a, b) => b.eventCount - a.eventCount);

        setMemberStats({
          totalMembers: members.length,
          activeMembers,
          memberParticipation: participation
        });
      }
    } catch (error) {
      console.error('Error loading member stats:', error);
    }
  };

  const loadArtistStats = async () => {
    try {
      const { data: songs } = await supabase
        .from('songs')
        .select('*')
        .eq('group_id', groupId)
        .eq('type', 'song')
        .not('artist', 'is', null);

      const { data: setlistSongs } = await supabase
        .from('setlist_songs')
        .select(`
          song_id,
          song:songs!inner(artist)
        `);

      if (songs && setlistSongs) {
        const artistMap = new Map<string, { songCount: number; usageCount: number }>();

        // Count songs per artist
        songs.forEach(song => {
          if (song.artist) {
            const current = artistMap.get(song.artist) || { songCount: 0, usageCount: 0 };
            artistMap.set(song.artist, { ...current, songCount: current.songCount + 1 });
          }
        });

        // Count usage in setlists
        setlistSongs.forEach(item => {
          const artist = item.song?.artist;
          if (artist) {
            const current = artistMap.get(artist) || { songCount: 0, usageCount: 0 };
            artistMap.set(artist, { ...current, usageCount: current.usageCount + 1 });
          }
        });

        const stats: ArtistStats[] = Array.from(artistMap.entries())
          .map(([artist, data]) => ({ artist, ...data }))
          .sort((a, b) => b.usageCount - a.usageCount)
          .slice(0, 10);

        setArtistStats(stats);
      }
    } catch (error) {
      console.error('Error loading artist stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Analytics Dashboard</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="3m">Últimos 3 meses</option>
          <option value="6m">Últimos 6 meses</option>
          <option value="1y">Último año</option>
          <option value="all">Todo el tiempo</option>
        </select>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Eventos</p>
              <p className="text-2xl font-bold text-gray-900">{eventStats?.totalEvents || 0}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Próximos Eventos</p>
              <p className="text-2xl font-bold text-gray-900">{eventStats?.upcomingEvents || 0}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Setlists</p>
              <p className="text-2xl font-bold text-gray-900">{setlistStats?.totalSetlists || 0}</p>
            </div>
            <Music className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Miembros Activos</p>
              <p className="text-2xl font-bold text-gray-900">{memberStats?.activeMembers || 0}</p>
            </div>
            <Users className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Charts and detailed stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Songs */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-yellow-500" />
            <h3 className="text-lg font-semibold text-gray-800">Canciones Más Tocadas</h3>
          </div>
          <div className="space-y-3">
            {songStats.slice(0, 5).map((stat, index) => (
              <div key={stat.song.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-yellow-100 text-yellow-800 rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{stat.song.title}</p>
                    <p className="text-sm text-gray-500">{stat.song.artist}</p>
                  </div>
                </div>
                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm font-medium">
                  {stat.usageCount} veces
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Artists */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-800">Artistas Más Tocados</h3>
          </div>
          <div className="space-y-3">
            {artistStats.slice(0, 5).map((stat, index) => (
              <div key={stat.artist} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{stat.artist}</p>
                    <p className="text-sm text-gray-500">{stat.songCount} canciones</p>
                  </div>
                </div>
                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm font-medium">
                  {stat.usageCount} usos
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Setlist Stats */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-green-500" />
            <h3 className="text-lg font-semibold text-gray-800">Estadísticas de Setlists</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Promedio de canciones</span>
              <span className="font-bold text-gray-900">{setlistStats?.averageSongsPerSetlist || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Setlist más largo</span>
              <span className="font-bold text-gray-900">{setlistStats?.longestSetlist.songCount || 0} canciones</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Setlist más corto</span>
              <span className="font-bold text-gray-900">{setlistStats?.shortestSetlist.songCount || 0} canciones</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Promedio por evento</span>
              <span className="font-bold text-gray-900">{eventStats?.averageSetlistSize || 0} canciones</span>
            </div>
          </div>
        </div>

        {/* Member Participation */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-800">Participación de Miembros</h3>
          </div>
          <div className="space-y-3">
            {memberStats?.memberParticipation.slice(0, 5).map((stat, index) => (
              <div key={stat.member.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-purple-100 text-purple-800 rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{stat.member.name}</p>
                    <p className="text-sm text-gray-500">{stat.member.role?.name || 'Sin rol'}</p>
                  </div>
                </div>
                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm font-medium">
                  {stat.eventCount} eventos
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Events Chart (Simple) */}
      {eventStats?.monthlyEvents && eventStats.monthlyEvents.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-semibold text-gray-800">Eventos por Mes</h3>
          </div>
          <div className="flex items-end gap-2 h-32">
            {eventStats.monthlyEvents.map((month, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="bg-indigo-500 w-full rounded-t"
                  style={{ 
                    height: `${Math.max((month.count / Math.max(...eventStats.monthlyEvents.map(m => m.count))) * 100, 5)}%` 
                  }}
                ></div>
                <span className="text-xs text-gray-600 mt-2 transform -rotate-45 origin-left">
                  {month.month}
                </span>
                <span className="text-xs font-bold text-gray-900">{month.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;