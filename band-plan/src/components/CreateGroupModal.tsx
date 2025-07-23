import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import Button from './Button';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: () => void;
  isAdmin: boolean;
}

const CreateGroupModal = ({
  isOpen,
  onClose,
  onGroupCreated,
  isAdmin = false,
}: CreateGroupModalProps) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('groups')
        .insert([{ name: name.trim() }]);

      if (error) throw error;

      toast.success('Grupo creado exitosamente');
      onGroupCreated();
      onClose();
      setName('');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al crear el grupo');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    const { data, error } = await supabase
      .from('roles')
      .select('*');

    if (error) throw error;
    setRoles(data);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 z-10 overflow-y-auto"
    >
      <div className="flex min-h-screen items-center justify-center">
        <div className="fixed inset-0 bg-black opacity-30" />

        <div className="relative bg-white rounded-lg w-full max-w-md p-4 sm:p-6 mx-4 max-h-[90vh] overflow-y-auto">
          <div className="absolute right-4 top-4">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <Dialog.Title className="text-xl font-semibold mb-4">
            Crear Nuevo Grupo
          </Dialog.Title>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Nombre del grupo
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ingresa el nombre del grupo"
                required
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={loading}
                fullWidth
                className="sm:w-auto"
              >
                Cancelar
              </Button>
              <Button type="submit" loading={loading} fullWidth className="sm:w-auto">
                Crear Grupo
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Dialog>
  );
};

export default CreateGroupModal;