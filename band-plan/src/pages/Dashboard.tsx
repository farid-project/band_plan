import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Group, User } from '../types';
import Button from '../components/Button';
import { Plus, Users, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-hot-toast';
import CreateGroupModal from '../components/CreateGroupModal';
import DeleteGroupModal from '../components/DeleteGroupModal';
import { CardSkeleton } from '../components/Skeleton';

interface GroupWithRole extends Group {
  userRole: 'creator' | 'member' | 'none';
  principal_count: number;
  sustituto_count: number;
}

export default function Dashboard() {
  const [groups, setGroups] = useState<GroupWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isActive = true;

    const initializeDashboard = async () => {
      if (user?.id && isActive) {
        await fetchGroups();
      }
    };

    initializeDashboard();

    return () => {
      isActive = false;
    };
  }, [user?.id]);

  const fetchGroups = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // Primero obtener el estado de admin actual
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;
      const isUserAdmin = userData?.role === 'admin';
      setIsAdmin(isUserAdmin);

      if (isUserAdmin) {
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select('*')
          .order('created_at', { ascending: false });

        if (groupsError) throw groupsError;

        // Primero obtener los grupos donde el usuario es miembro
        const { data: memberGroups, error: memberError } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id);

        if (memberError) throw memberError;

        const memberGroupIds = new Set(memberGroups?.map(g => g.group_id) || []);

        // Obtener los miembros de cada grupo por separado
        const groupsWithCounts = await Promise.all((groupsData || []).map(async (group) => {
          const { data: principalMembers } = await supabase
            .from('group_members')
            .select('id')
            .eq('group_id', group.id)
            .eq('role_in_group', 'principal');

          const { data: sustitutoMembers } = await supabase
            .from('group_members')
            .select('id')
            .eq('group_id', group.id)
            .eq('role_in_group', 'sustituto');

          return {
            ...group,
            userRole: memberGroupIds.has(group.id) ? 'member' : 'none',
            principal_count: principalMembers?.length || 0,
            sustituto_count: sustitutoMembers?.length || 0
          };
        }));

        setGroups(groupsWithCounts);
        return;
      }

      // Para usuarios normales
      const { data: memberGroups, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      const memberGroupIds = new Set(memberGroups?.map(g => g.group_id) || []);

      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .or(`created_by.eq.${user.id},id.in.(${Array.from(memberGroupIds).join(',')})`)
        .order('created_at', { ascending: false });

      if (groupsError) throw groupsError;

      // Obtener los miembros de cada grupo por separado
      const groupsWithCounts = await Promise.all((groupsData || []).map(async (group) => {
        const { data: principalMembers } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', group.id)
          .eq('role_in_group', 'principal');

        const { data: sustitutoMembers } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', group.id)
          .eq('role_in_group', 'sustituto');

        return {
          ...group,
          userRole: memberGroupIds.has(group.id) ? 'member' : 'none',
          principal_count: principalMembers?.length || 0,
          sustituto_count: sustitutoMembers?.length || 0
        };
      }));

      setGroups(groupsWithCounts);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Error al cargar los grupos');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGroupClick = (groupId: string) => {
    navigate(`/group/${groupId}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, group: Group) => {
    e.stopPropagation(); // Evita que se active el onClick del contenedor
    setSelectedGroup(group);
    setIsDeleteModalOpen(true);
  };

  // Función auxiliar para agrupar los grupos por rol
  const groupedGroups = () => {
    const filteredGroups = groups.filter(g => 
      g.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    const created = filteredGroups.filter(g => g.created_by === user?.id);
    const member = filteredGroups.filter(g => g.userRole === 'member' && g.created_by !== user?.id);
    const other = isAdmin ? filteredGroups.filter(g => 
      g.userRole === 'none' && 
      g.created_by !== user?.id && 
      !member.some(m => m.id === g.id)
    ) : [];
    
    return { created, member, other };
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mis Grupos</h1>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Crear Grupo</span>
        </Button>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar grupos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="h-7 w-48 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-10 w-32 bg-gray-200 animate-pulse rounded"></div>
          </div>
          <CardSkeleton count={6} />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">
            No tienes grupos disponibles. ¡Crea uno para empezar!
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Grupos creados */}
          {groupedGroups().created.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Grupos que administras
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedGroups().created.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    user={user}
                    isAdmin={isAdmin}
                    onDelete={handleDeleteClick}
                    onClick={() => handleGroupClick(group.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Grupos donde es miembro */}
          {groupedGroups().member.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Grupos donde participas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedGroups().member.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    user={user}
                    isAdmin={isAdmin}
                    onDelete={handleDeleteClick}
                    onClick={() => handleGroupClick(group.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Otros grupos (solo para admin) */}
          {isAdmin && groupedGroups().other.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Otros grupos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedGroups().other.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    user={user}
                    isAdmin={isAdmin}
                    onDelete={handleDeleteClick}
                    onClick={() => handleGroupClick(group.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <CreateGroupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onGroupCreated={fetchGroups}
        isAdmin={isAdmin}
      />

      {selectedGroup && (
        <DeleteGroupModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedGroup(null);
          }}
          onGroupDeleted={fetchGroups}
          group={selectedGroup}
        />
      )}
    </div>
  );
}

// Componente para la tarjeta de grupo
interface GroupCardProps {
  group: GroupWithRole;
  user: User | null;
  isAdmin: boolean;
  onDelete: (e: React.MouseEvent, group: Group) => void;
  onClick: () => void;
}

const GroupCard = ({ group, user, isAdmin, onDelete, onClick }: GroupCardProps) => {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-900">{group.name}</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center text-sm text-gray-600" title="Miembros principales">
              <Users className="w-5 h-5 text-indigo-600 mr-1" />
              <span className="font-medium">{group.principal_count}</span>
              <span className="text-xs ml-1">prin</span>
            </div>
            <div className="flex items-center text-sm text-gray-600" title="Miembros sustitutos">
              <Users className="w-5 h-5 text-orange-600 mr-1" />
              <span className="font-medium">{group.sustituto_count}</span>
              <span className="text-xs ml-1">sust</span>
            </div>
          </div>
          {(isAdmin || group.created_by === user?.id) && (
            <button
              onClick={(e) => onDelete(e, group)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-full"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {group.created_by === user?.id && (
          <span className="text-sm px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
            Creador
          </span>
        )}
        {group.userRole === 'member' && (
          <span className="text-sm px-2 py-1 rounded-full bg-green-100 text-green-700">
            Miembro
          </span>
        )}
        {group.userRole === 'none' && (
          <span className="text-sm px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            Grupo
          </span>
        )}
      </div>
    </div>
  );
};