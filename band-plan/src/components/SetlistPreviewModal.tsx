import React from 'react';
import { Setlist } from '../types';
import { X, Music } from 'lucide-react';

interface SetlistPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  setlist: Setlist | null;
}

const SetlistPreviewModal: React.FC<SetlistPreviewModalProps> = ({ isOpen, onClose, setlist }) => {
  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col font-sans relative transform transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {setlist && (
          <>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <Music className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 truncate">{setlist.name}</h2>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow">
              {setlist.description && (
                <p className="text-sm text-gray-600 italic mb-6 bg-gray-50 p-3 rounded-md border border-gray-200">{setlist.description}</p>
              )}

              {(() => {
                const songs = setlist.songs || [];
                const medleys = setlist.medleys || [];
                const totalItems = (songs.length || 0) + (medleys.reduce((acc, m) => acc + (m.songs?.length || 0), 0) || 0);
                const columns = totalItems > 10 ? 'grid-cols-2' : 'grid-cols-1';

                return (
                  <>
                    <div className={`grid ${columns} gap-x-8`}>
                      {songs.map((item: any, index: number) => (
                        <div key={`song-${item.song?.id || index}`} className="flex items-baseline space-x-3 text-sm group py-1">
                          <span className="text-gray-400 font-mono w-5 text-right">{index + 1}.</span>
                          <div>
                            <p className="text-gray-800 font-medium group-hover:text-indigo-600 transition-colors">{item.song?.title || 'N/A'}</p>
                            {item.song?.artist && (
                              <p className="text-gray-500 text-xs">{item.song.artist}</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {medleys.map((medley: any, medleyIndex: number) => (
                        <div key={`medley-${medley.id || medleyIndex}`} className="mt-4 col-span-1">
                          <h4 className="font-bold text-indigo-600 mb-1 truncate">{medley.name}</h4>
                          {medley.songs.map((item: any, songIndex: number) => (
                            <div key={`medley-song-${item.song?.id || songIndex}`} className="flex items-baseline space-x-3 text-sm group py-1 pl-5">
                              <span className="text-gray-400 font-mono w-5 text-right">{songIndex + 1}.</span>
                              <div>
                                <p className="text-gray-800 font-medium group-hover:text-indigo-600 transition-colors">{item.song?.title || 'N/A'}</p>
                                {item.song?.artist && (
                                  <p className="text-gray-500 text-xs">{item.song.artist}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    {totalItems === 0 && (
                      <div className="text-center py-10">
                        <p className="text-gray-500">Este setlist está vacío.</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SetlistPreviewModal;
