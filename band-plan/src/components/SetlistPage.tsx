import React, { useState } from 'react';
import SongManagement from './SongManagement';
import SetlistManagement from './SetlistManagement';

interface SetlistPageProps {
  groupId: string;
  canManageSongs?: boolean;
  canManageSetlists?: boolean;
}

type TabType = 'songs' | 'setlists';

export default function SetlistPage({ groupId, canManageSongs = true, canManageSetlists = true }: SetlistPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('songs');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('songs')}
              className={`${
                activeTab === 'songs'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Pool de Canciones
            </button>
            <button
              onClick={() => setActiveTab('setlists')}
              className={`${
                activeTab === 'setlists'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Setlists
            </button>
          </nav>
        </div>
        
        <div className="p-6">
          {activeTab === 'songs' && (
            <SongManagement groupId={groupId} canManageSongs={canManageSongs} />
          )}
          
          {activeTab === 'setlists' && (
            <SetlistManagement groupId={groupId} canManageSetlists={canManageSetlists} />
          )}
        </div>
      </div>
    </div>
  );
} 