import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Group, GroupMember, Instrument } from '../types';
import Button from '../components/Button';
import { Plus, Music, User, Edit2, Calendar, Loader2, Trash2, ListMusic, BarChart3 } from 'lucide-react';
import AddMemberModal from '../components/AddMemberModal';
import EditMemberModal from '../components/EditMemberModal';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import EventsList from '../components/EventsList';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { safeSupabaseRequest } from '../lib/supabaseUtils';
import CalendarInstructionsModal from '../components/CalendarInstructionsModal';
import SetlistPage from '../components/SetlistPage';
import AnalyticsDashboard from '../components/AnalyticsDashboard';

interface ExtendedGroupMember extends GroupMember {
  instruments: {
    name: string;
    id: string;
  }[];
}

interface GroupManagementProps {
  defaultTab?: 'overview' | 'songs' | 'setlists' | 'analytics';
}

export default function GroupManagement({ defaultTab }: GroupManagementProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<ExtendedGroupMember[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ExtendedGroupMember | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<ExtendedGroupMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [canAddMembers, setCanAddMembers] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [isPrincipalMember, setIsPrincipalMember] = useState(false);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const { user } = useAuthStore();
  const [isUserMember, setIsUserMember] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState('');
  // Determine active tab based on URL and defaultTab
  const getActiveTab = (): 'overview' | 'songs' | 'setlists' | 'analytics' => {
    if (defaultTab) return defaultTab;
    
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    
    if (location.pathname.endsWith('/songs')) return 'songs';
    if (location.pathname.endsWith('/setlists')) return 'setlists';
    if (tabParam === 'analytics') return 'analytics';
    
    return 'overview';
  };
  
  const [activeTab, setActiveTab] = useState<'overview' | 'songs' | 'setlists' | 'analytics'>(getActiveTab());

  // Handle tab navigation
  const handleTabChange = (tab: 'overview' | 'songs' | 'setlists' | 'analytics') => {
    setActiveTab(tab);
    
    // Navigate to appropriate URL
    switch (tab) {
      case 'songs':
        navigate(`/group/${id}/songs`);
        break;
      case 'setlists':
        navigate(`/group/${id}/setlists`);
        break;
      case 'analytics':
        // For analytics, we'll use a query parameter to stay on the main route
        navigate(`/group/${id}?tab=analytics`);
        break;
      case 'overview':
      default:
        navigate(`/group/${id}`);
        break;
    }
  };

  // Update active tab when URL changes
  useEffect(() => {
    setActiveTab(getActiveTab());
  }, [location.pathname, location.search, defaultTab]);

  useEffect(() => {
    if (id) {
      fetchGroupData();
    }
  }, [id, user]);

  useEffect(() => {
    if (id && user) {
      checkPermissions();
    }
  }, [id, user, members]);

  const checkPermissions = async () => {
    if (!user) return;

    try {
      const userData = await safeSupabaseRequest(
        () => supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single(),
        'Error checking permissions'
      );

      if (userData) {
        setUserRole(userData.role);
        setCanAddMembers(userData.role === 'admin');
      }

      const userMember = members.find(m => m.user_id === user.id);
      setIsUserMember(!!userMember);
      setIsPrincipalMember(userMember?.role_in_group === 'principal' || false);
      
      if (userMember?.role_in_group === 'principal') {
        setCanAddMembers(true);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const fetchGroupData = async () => {
    try {
      const groupData = await safeSupabaseRequest(
        () => supabase
          .from('groups')
          .select('*')
          .eq('id', id)
          .single(),
        'Error loading group'
      );

      if (groupData) {
        setGroup(groupData);
      }

      const membersData = await safeSupabaseRequest(
        () => supabase
          .from('group_members')
          .select(`
            *,
            group_member_roles!group_member_roles_group_member_id_fkey (
              role:roles (
                id,
                name
              )
            )
          `)
          .eq('group_id', id)
          .order('role_in_group', { ascending: false })
          .order('name'),
        'Error loading members'
      );

      if (membersData) {
        const transformedMembers: ExtendedGroupMember[] = membersData.map(member => ({
          ...member,
          instruments: (member.group_member_roles || [])
            .filter(gmr => gmr?.role)
            .map(gmr => ({
              id: gmr.role.id,
              name: gmr.role.name
            }))
        }));

        setMembers(transformedMembers);
      }

      const instrumentsData = await safeSupabaseRequest(
        () => supabase
          .from('roles')
          .select('*')
          .eq('group_id', id)
          .order('name'),
        'Error loading roles'
      );

      if (instrumentsData) {
        setInstruments(instrumentsData);
      }
    } catch (error) {
      console.error('Error fetching group data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkMember = async (memberId: string) => {
    if (!user || !id) return;

    try {
      await safeSupabaseRequest(
        () => supabase.rpc('link_group_member', {
          p_member_id: memberId,
          p_user_id: user.id,
          p_group_id: id
        }),
        'Error linking member'
      );

      toast.success("¡Te has vinculado correctamente!");
      await fetchGroupData();
      await checkPermissions();
    } catch (error) {
      console.error('Error linking member:', error);
    }
  };

  const handleEditMember = (member: ExtendedGroupMember) => {
    setSelectedMember(member);
    setIsEditModalOpen(true);
  };

  const handleDeleteMember = (member: ExtendedGroupMember) => {
    setMemberToDelete(member);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteMember = async () => {
    if (!memberToDelete) return;

    try {
      await safeSupabaseRequest(
        () => supabase
          .from('group_members')
          .delete()
          .eq('id', memberToDelete.id),
        'Error deleting member'
      );

      toast.success('Miembro eliminado correctamente');
      setIsDeleteModalOpen(false);
      setMemberToDelete(null);
      fetchGroupData();
    } catch (error) {
      console.error('Error deleting member:', error);
    }
  };

  // Group members by role
  const principalMembers = members.filter(m => m.role_in_group === 'principal');
  const substituteMembers = members.filter(m => m.role_in_group === 'sustituto');

  const renderMemberGroup = (groupMembers: ExtendedGroupMember[], title: string) => (
    <div>
      <div className="bg-gray-50 px-3 py-2">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      </div>
      <div className="divide-y">
        {groupMembers.map((member) => (
          <div key={member.id} className="p-3 hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900">
                    {member.name}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    member.role_in_group === 'principal'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {member.role_in_group === 'principal' ? 'Principal' : 'Sustituto'}
                  </span>
                  {!member.user_id && (
                    <span className="text-xs text-gray-500">(Sin vincular)</span>
                  )}
                </div>
                {member.instruments.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {member.instruments.map((instrument, idx) => (
                      <span
                        key={`${member.id}-${instrument.id}-${idx}`}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                      >
                        <Music className="w-3 h-3 mr-1" />
                        {instrument.name}
                      </span>
                    ))}
                  </div>
                )}
                {member.user_id === user?.id && (
                  <div className="mt-2 flex items-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={member.sync_calendar}
                        onChange={async () => {
                          try {
                            await safeSupabaseRequest(
                              () => supabase
                                .from('group_members')
                                .update({ sync_calendar: !member.sync_calendar })
                                .eq('id', member.id),
                              'Error actualizando preferencias de calendario'
                            );
                            toast.success('Preferencias de calendario actualizadas');
                            fetchGroupData();
                          } catch (error) {
                            console.error('Error:', error);
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-3 text-sm font-medium text-gray-700">
                        Sincronizar eventos al calendario
                      </span>
                    </label>
                  </div>
                )}
                {member.user_id === user?.id && member.sync_calendar && (
                  <button
                    onClick={() => getCalendarSubscriptionUrl(member.id)}
                    className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 flex items-center"
                  >
                    <Calendar className="w-4 h-4 mr-1" />
                    Obtener enlace de suscripción al calendario
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                {(userRole === 'admin' || member.user_id === user?.id) && (
                  <button
                    onClick={() => handleEditMember(member)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                    title="Editar miembro"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                {(userRole === 'admin' || isPrincipalMember) && (
                  <button
                    onClick={() => handleDeleteMember(member)}
                    className="p-1 text-red-400 hover:text-red-600 rounded-full hover:bg-red-50"
                    title="Eliminar miembro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {!member.user_id && !isUserMember && (
              <Button
                onClick={() => handleLinkMember(member.id)}
                variant="secondary"
                className="w-full mt-2 text-sm py-1"
              >
                <User className="w-3 h-3 mr-1" />
                Soy este miembro
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const getCalendarSubscriptionUrl = async (memberId: string) => {
    try {
      // Primero generamos el calendario
      const { data: calendarData, error: calendarError } = await supabase
        .rpc('get_group_calendar', {
          p_group_id: group?.id,
          p_member_id: memberId
        });

      if (calendarError) throw calendarError;
      if (!calendarData) throw new Error('No se pudo generar el calendario');

      // Convertimos el texto del calendario a un archivo Blob
      const calendarBlob = new Blob([calendarData], { type: 'text/calendar' });
      const calendarFile = new File([calendarBlob], 'calendar.ics', { type: 'text/calendar' });

      // Subimos el archivo a Supabase Storage
      const { error: uploadError } = await supabase
        .storage
        .from('calendars')
        .upload(`${group?.id}/${memberId}/calendar.ics`, calendarFile, {
          cacheControl: '0',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Obtenemos la URL pública
      const { data: { publicUrl } } = await supabase
        .storage
        .from('calendars')
        .getPublicUrl(`${group?.id}/${memberId}/calendar.ics`);

      if (publicUrl) {
        setCalendarUrl(publicUrl);
        setIsCalendarModalOpen(true);
      } else {
        throw new Error('No se pudo generar el enlace público');
      }
    } catch (error) {
      console.error('Error:', error);
      if (error.message === 'new row violates row-level security policy') {
        toast.error('Error de permisos al generar el calendario. Por favor, contacta con el administrador.');
      } else {
        toast.error('Error al generar el enlace del calendario');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-gray-900">Grupo no encontrado</h2>
        <p className="text-gray-500 mt-2">El grupo que buscas no existe o no tienes acceso a él.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
          <p className="text-gray-500 mt-1">Gestiona miembros y disponibilidad</p>
        </div>
        {(canAddMembers || isPrincipalMember) && (!isUserMember || userRole === 'admin' || isPrincipalMember) && (
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>{userRole === 'admin' || isPrincipalMember ? 'Añadir Miembro' : 'Unirse al Grupo'}</span>
          </Button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => handleTabChange('overview')}
            className={`${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
          >
            <Calendar className="w-4 h-4" />
            <span>Vista General</span>
          </button>
          <button
            onClick={() => handleTabChange('songs')}
            className={`${
              activeTab === 'songs' || activeTab === 'setlists'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
          >
            <ListMusic className="w-4 h-4" />
            <span>Canciones y Setlists</span>
          </button>
          <button
            onClick={() => handleTabChange('analytics')}
            className={`${
              activeTab === 'analytics'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analytics</span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Members List */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Miembros del Grupo</h2>
              </div>
              {members.length === 0 ? (
                <div className="text-center py-8">
                  <User className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">
                    No hay miembros aún. {canAddMembers ? '¡Haz clic en "Unirse al Grupo" para ser el primer miembro!' : 'Espera a que alguien se una al grupo.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {principalMembers.length > 0 && renderMemberGroup(principalMembers, 'Miembros Principales')}
                  {substituteMembers.length > 0 && renderMemberGroup(substituteMembers, 'Miembros Sustitutos')}
                </div>
              )}
            </div>

            {/* Availability Calendar */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Disponibilidad</h2>
              </div>
              <div className="p-4">
                <AvailabilityCalendar 
                  members={members} 
                  onAvailableDatesChange={setAvailableDates}
                  groupName={group.name}
                />
              </div>
            </div>
          </div>

          {/* Events List */}
          {group && id && (
            <div className="mt-6 bg-white rounded-lg shadow-md">
              <EventsList
                groupId={id}
                canManageEvents={userRole === 'admin' || isPrincipalMember}
                availableDates={availableDates}
                members={members}
              />
            </div>
          )}
        </>
      )}

      {(activeTab === 'songs' || activeTab === 'setlists') && group && id && (
        <SetlistPage 
          groupId={id} 
          canManageSongs={userRole === 'admin' || isPrincipalMember}
          canManageSetlists={userRole === 'admin' || isPrincipalMember}
          defaultTab={activeTab === 'setlists' ? 'setlists' : 'songs'}
        />
      )}

      {activeTab === 'analytics' && group && id && (
        <AnalyticsDashboard groupId={id} />
      )}

      {/* Modals */}
      {group && (canAddMembers || isPrincipalMember) && (!isUserMember || userRole === 'admin' || isPrincipalMember) && (
        <AddMemberModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          groupId={group.id}
          instruments={instruments}
          onMemberAdded={fetchGroupData}
          isEmptyGroup={members.length === 0}
          userRole={userRole}
        />
      )}

      {selectedMember && (
        <EditMemberModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedMember(null);
          }}
          member={selectedMember}
          instruments={instruments}
          onMemberUpdated={fetchGroupData}
          userRole={userRole}
        />
      )}

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setMemberToDelete(null);
        }}
        onConfirm={confirmDeleteMember}
        title="Eliminar Miembro"
        message={`¿Estás seguro de que quieres eliminar a ${memberToDelete?.name}? Esta acción no se puede deshacer.`}
      />

      <CalendarInstructionsModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        calendarUrl={calendarUrl}
      />
    </div>
  );
}