
import React, { useState, useEffect } from 'react';
import Button from './Button';
import Input from './Input';
import { X, Music } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { GroupMember } from '../types';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: GroupMember & { instruments: { id: string; name: string; }[] }; // Mantener 'instruments' para compatibilidad
  instruments: { id: string; name: string; }[]; // Mantener 'instruments' para compatibilidad
  onMemberUpdated: () => void;
  userRole: 'admin' | 'user' | null;
}

export default function EditMemberModal({
  isOpen,
  onClose,
  member,
  instruments: availableRoles, // Renombrar internamente a 'availableRoles'
  onMemberUpdated,
  userRole
}: EditMemberModalProps) {
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role_in_group);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    if (member) {
      setName(member.name);
      setRole(member.role_in_group);
      setSelectedRoles(member.instruments.map(i => i.id)); // Usar 'instruments' del miembro como roles
    }
  }, [member]);

  if (!isOpen || !user) return null;

  const canEdit = userRole === 'admin' || member.user_id === user.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error('You do not have permission to edit this member');
      return;
    }

    if (!name.trim()) {
      toast.error('Please enter a member name');
      return;
    }

    if (selectedRoles.length === 0) {
      toast.error('Please select at least one role');
      return;
    }

    setLoading(true);

    try {
      // Update member details
      const { error: updateError } = await supabase
        .from('group_members')
        .update({
          name: name.trim(),
          role_in_group: role
        })
        .eq('id', member.id);

      if (updateError) throw updateError;

      // Remove all existing role associations
      const { error: deleteError } = await supabase
        .from('group_member_roles')
        .delete()
        .eq('group_member_id', member.id);

      if (deleteError) throw deleteError;

      // Add new role associations
      const { error: insertError } = await supabase
        .from('group_member_roles')
        .insert(
          selectedRoles.map(roleId => ({
            group_member_id: member.id,
            role_id: roleId,
            created_by: user.id
          }))
        );

      if (insertError) throw insertError;

      toast.success('Member updated successfully!');
      onMemberUpdated();
      onClose();
    } catch (error: any) {
      console.error('Error updating member:', error);
      toast.error(error.message || 'Failed to update member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Edit Member</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Enter member name"
            disabled={!canEdit}
          />

          {userRole === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'principal' | 'sustituto')}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                disabled={!canEdit}
              >
                <option value="principal">Principal</option>
                <option value="sustituto">Sustituto</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Roles
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {availableRoles.map((role) => (
                <label key={role.id} className="flex items-center space-x-2 hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRoles([...selectedRoles, role.id]);
                      } else {
                        setSelectedRoles(selectedRoles.filter(id => id !== role.id));
                      }
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    disabled={loading || !canEdit}
                  />
                  <span className="flex items-center">
                    <Music className="w-3 h-3 mr-1" />
                    {role.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            {canEdit && (
              <Button
                type="submit"
                loading={loading}
              >
                Save Changes
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}