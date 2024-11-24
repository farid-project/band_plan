import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Button from './Button';
import Input from './Input';
import { X, Plus, Music } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Instrument } from '../types';
import { useAuthStore } from '../store/authStore';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  instruments: Instrument[];
  onMemberAdded: () => void;
  isEmptyGroup: boolean;
  userRole: 'admin' | 'user' | null;
}

interface NewInstrument {
  id: string;
  name: string;
  isNew: true;
}

type LocalInstrument = Instrument | NewInstrument;

export default function AddMemberModal({
  isOpen,
  onClose,
  groupId,
  instruments: initialInstruments,
  onMemberAdded,
  isEmptyGroup,
  userRole
}: AddMemberModalProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'principal' | 'sustituto'>('principal');
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [newInstrumentName, setNewInstrumentName] = useState('');
  const [showNewInstrumentInput, setShowNewInstrumentInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localInstruments, setLocalInstruments] = useState<LocalInstrument[]>(initialInstruments);
  const [isPrincipalMember, setIsPrincipalMember] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    setLocalInstruments(initialInstruments);
  }, [initialInstruments]);

  useEffect(() => {
    if (user) {
      checkPrincipalStatus();
      if (userRole === 'user' && !isPrincipalMember) {
        getUserName();
      } else {
        setName('');
      }
    }
  }, [user, userRole, isPrincipalMember]);

  const checkPrincipalStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('group_members')
        .select('role_in_group')
        .eq('group_id', groupId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setIsPrincipalMember(data?.[0]?.role_in_group === 'principal');
    } catch (error) {
      console.error('Error checking principal status:', error);
      setIsPrincipalMember(false);
    }
  };

  const getUserName = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (data?.name) {
        setName(data.name);
      }
    } catch (error) {
      console.error('Error fetching user name:', error);
    }
  };

  if (!isOpen || !user) return null;

  const handleAddNewInstrument = () => {
    if (!newInstrumentName.trim()) {
      toast.error('Please enter an instrument name');
      return;
    }

    const exists = localInstruments.some(
      inst => inst.name.toLowerCase() === newInstrumentName.trim().toLowerCase()
    );

    if (exists) {
      toast.error('This instrument already exists');
      return;
    }

    const tempId = `new-${Date.now()}`;
    const newInstrument: NewInstrument = {
      id: tempId,
      name: newInstrumentName.trim(),
      isNew: true
    };

    setLocalInstruments([...localInstruments, newInstrument]);
    setSelectedInstruments([...selectedInstruments, tempId]);
    setNewInstrumentName('');
    setShowNewInstrumentInput(false);
    toast.success('Instrument added and selected');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a member name');
      return;
    }

    if (selectedInstruments.length === 0) {
      toast.error('Please select at least one instrument');
      return;
    }

    setLoading(true);

    try {
      const existingInstruments = selectedInstruments.filter(id => !id.startsWith('new-'));
      const newInstruments = localInstruments
        .filter((inst): inst is NewInstrument => 
          'isNew' in inst && 
          inst.isNew && 
          selectedInstruments.includes(inst.id)
        )
        .map(inst => inst.name);

      const { data: memberData, error: memberError } = await supabase.rpc(
        'add_group_member_with_instruments',
        {
          p_group_id: groupId,
          p_name: name,
          p_role: isEmptyGroup ? 'principal' : role,
          p_user_id: userRole === 'user' && !isPrincipalMember ? user.id : null,
          p_instruments: existingInstruments,
          p_new_instruments: newInstruments
        }
      );

      if (memberError) throw memberError;

      if (!memberData) {
        throw new Error('Failed to add group member');
      }

      toast.success(userRole === 'user' && !isPrincipalMember ? 'Successfully joined the group!' : 'Member added successfully!');
      onMemberAdded();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Error adding member:', error);
      if (error.message.includes('permission denied')) {
        toast.error('You do not have permission to perform this action');
      } else {
        toast.error(error.message || 'Failed to add member');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setRole('principal');
    setSelectedInstruments([]);
    setNewInstrumentName('');
    setShowNewInstrumentInput(false);
    setLocalInstruments(initialInstruments);
  };

  const isJoining = userRole === 'user' && !isPrincipalMember;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">
            {isJoining ? 'Join Group' : 'Add New Member'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
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
            disabled={isJoining}
          />

          {!isEmptyGroup && userRole === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'principal' | 'sustituto')}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="principal">Principal</option>
                <option value="sustituto">Sustituto</option>
              </select>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Instruments
              </label>
              {!showNewInstrumentInput && (userRole === 'admin' || isEmptyGroup || isPrincipalMember) && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowNewInstrumentInput(true)}
                  className="text-sm py-1"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add New
                </Button>
              )}
            </div>

            {showNewInstrumentInput && (
              <div className="flex gap-2 mb-3">
                <Input
                  label=""
                  value={newInstrumentName}
                  onChange={(e) => setNewInstrumentName(e.target.value)}
                  placeholder="Enter instrument name"
                  className="flex-1"
                />
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    onClick={handleAddNewInstrument}
                    className="whitespace-nowrap"
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowNewInstrumentInput(false);
                      setNewInstrumentName('');
                    }}
                    className="whitespace-nowrap"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {localInstruments.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No instruments available. Add one above.
                </p>
              ) : (
                localInstruments.map((instrument) => (
                  <label key={instrument.id} className="flex items-center space-x-2 hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedInstruments.includes(instrument.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInstruments([...selectedInstruments, instrument.id]);
                        } else {
                          setSelectedInstruments(selectedInstruments.filter(id => id !== instrument.id));
                        }
                      }}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="flex items-center capitalize">
                      <Music className="w-3 h-3 mr-1" />
                      {instrument.name}
                      {'isNew' in instrument && <span className="ml-2 text-xs text-indigo-600">(New)</span>}
                    </span>
                  </label>
                ))
              )}
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
            <Button
              type="submit"
              loading={loading}
            >
              {isJoining ? 'Join Group' : 'Add Member'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}