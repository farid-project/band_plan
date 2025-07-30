import React from 'react';
import { Music, AlertCircle } from 'lucide-react';
import { GroupMember } from '../types';

interface ExtendedGroupMember extends GroupMember {
  instruments: {
    name: string;
    id: string;
  }[];
}

interface EventMemberSelectorProps {
  members: ExtendedGroupMember[];
  selectedMembers: {
    memberId: string;
    userId: string | null;
    selected: boolean;
    isAvailable: boolean;
    isBusyInOtherEvent: boolean;
    wasInitiallyAvailable: boolean;
    sync_calendar: boolean;
  }[];
  onMemberSelectionChange: (memberId: string, selected: boolean) => void;
  validationError: boolean;
}

export default function EventMemberSelector({
  members,
  selectedMembers,
  onMemberSelectionChange,
  validationError
}: EventMemberSelectorProps) {
  // Group members by role
  const principalMembers = selectedMembers.filter(m => {
    const member = members.find(bm => bm.id === m.memberId);
    return member?.role_in_group === 'principal';
  });

  const substituteMembers = selectedMembers.filter(m => {
    const member = members.find(bm => bm.id === m.memberId);
    return member?.role_in_group === 'sustituto';
  });

  const renderMemberGroup = (groupMembers: typeof selectedMembers, title: string) => (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">{title}</h4>
      {groupMembers.map((member) => {
        const groupMember = members.find(m => m.id === member.memberId);
        if (!groupMember) return null;

        // Determine member status and styling
        const isSelectableWhenNotAvailable = !member.wasInitiallyAvailable && !member.isBusyInOtherEvent;
        const isDisabled = member.isBusyInOtherEvent && !member.selected;
        
        let bgClass = 'bg-gray-50 hover:bg-gray-100';
        let statusBadge = null;
        
        if (member.isBusyInOtherEvent) {
          bgClass = 'bg-gray-100';
          statusBadge = (
            <span className="inline-flex items-center text-xs text-gray-700 bg-gray-200 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3 mr-1" />
              Ocupado en otro evento
            </span>
          );
        } else if (!member.wasInitiallyAvailable) {
          bgClass = 'bg-orange-50 hover:bg-orange-100';
          statusBadge = (
            <span className="inline-flex items-center text-xs text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3 mr-1" />
              No disponible
            </span>
          );
        }

        return (
          <div
            key={member.memberId}
            className={`flex items-center justify-between p-2 rounded-lg transition-colors ${bgClass} ${
              isDisabled ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={member.selected}
                onChange={(e) => onMemberSelectionChange(member.memberId, e.target.checked)}
                className={`rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 ${
                  isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isDisabled}
                title={member.isBusyInOtherEvent ? 'Este miembro está ocupado en otro evento' : ''}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${isDisabled ? 'text-gray-500' : 'text-gray-900'}`}>
                    {groupMember.name}
                  </span>
                  {statusBadge}
                </div>
                <div className={`flex items-center text-sm ${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>
                  <Music className="w-3 h-3 mr-1" />
                  {groupMember.instruments.map(i => i.name).join(', ')}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );


  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Miembros</h3>
        <p className="mt-1 text-sm text-gray-500">
          Puedes seleccionar miembros que no estaban disponibles. Al guardar, se añadirá automáticamente esta fecha a su disponibilidad.
        </p>
      </div>
      
      <div className="space-y-6">
        {renderMemberGroup(principalMembers, "Miembros Principales")}
        {substituteMembers.length > 0 && renderMemberGroup(substituteMembers, "Sustitutos")}
      </div>

      {validationError && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg flex items-start">
          <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
          <p>
            Por favor, asegúrate de que todos los instrumentos estén cubiertos por los miembros seleccionados.
            Si un miembro principal no está disponible, debes seleccionar un sustituto que cubra sus instrumentos.
          </p>
        </div>
      )}
    </div>
  );
}