import React, { useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Setlist, SetlistSong } from '../types';
import { X, Music, Printer } from 'lucide-react';

// This component is ONLY for printing. It's invisible on screen.
interface PrintableSetlistProps {
  setlist: Setlist | null;
  eventName?: string;
  eventDate?: string; // ISO string
  bandName?: string;
}

const PrintableSetlist: React.FC<PrintableSetlistProps> = ({ setlist, eventName, eventDate, bandName }) => {
  if (!setlist) return null;

  const combinedItems = !setlist?.songs ? [] : setlist.songs.map(s => ({
    ...s,
    type: s.song?.type === 'medley' ? 'medley' as const : 'song' as const
  })).sort((a, b) => a.position - b.position);

  const renderItem = (item: (typeof combinedItems)[0], index: number) => {
    const isMedley = item.type === 'medley';
    const title = item.song?.title;
    const number = String(index + 1).padStart(2, '0');

    return (
      <li key={`item-${item.id}`} className="py-1.5 border-b border-gray-300 break-inside-avoid flex items-start">
        <span className="font-mono font-bold text-base w-7 mr-3 flex-shrink-0 pt-0.5">{number}</span>
        <div className="flex-grow">
          <span className="text-base font-semibold">{title}</span>
          {isMedley && item.song?.medley_song_ids && (
            <div className="pt-1 space-y-0.5">
              {/* Note: For printing, we would need to fetch the actual song details */}
              <p className="text-xs text-gray-600">Medley ({item.song.medley_song_ids.length} canciones)</p>
            </div>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="p-6 font-sans bg-white text-black">
      <header className="text-center pb-3 mb-6 border-b-2 border-black">

        <h1 className="font-serif text-4xl font-bold my-0.5 tracking-wider">{bandName || ''}</h1>
        <p className="text-base italic text-gray-700">
          {eventName && eventDate ? `${eventName} - ${new Date(eventDate).toLocaleDateString()}` : (setlist.description || 'Evento / Fecha')}
        </p>
      </header>

      <main>
        <ol className="list-none p-0 m-0" style={{ columnCount: 2, columnGap: '32px' }}>
          {combinedItems.map((item, index) => renderItem(item, index))}
        </ol>
      </main>
    </div>
  );
};



interface SetlistPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  setlist: Setlist | null;
  eventName?: string;
  eventDate?: string; // ISO string
  bandName?: string;
}

const SetlistPreviewModal: React.FC<SetlistPreviewModalProps> = ({ isOpen, onClose, setlist, eventName, eventDate, bandName }) => {
  const [showArtists, setShowArtists] = useState(true);

  const handlePrint = () => {
    // 1. Create a container for the printable content
    const printContainer = document.createElement('div');
    printContainer.id = 'printable-content';
    document.body.appendChild(printContainer);

    // 2. Render the printable component into the container
    const root = createRoot(printContainer);
    root.render(<PrintableSetlist setlist={setlist} eventName={eventName} eventDate={eventDate} bandName={bandName} />);

    // 3. Trigger the print dialog
    // We need a slight delay to ensure the content is rendered before printing.
    setTimeout(() => {
      window.print();
    }, 50);

    // 4. Clean up after printing
    window.onafterprint = () => {
      root.unmount();
      document.body.removeChild(printContainer);
      window.onafterprint = null; // Clean up the event listener
    };
  };

  return (
    <>
      {/* This section is the interactive modal, hidden during printing */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} print:hidden`}
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
                <div className="flex items-center gap-4 print:hidden">
                  <button onClick={handlePrint} className="p-2 text-gray-500 hover:text-indigo-600 transition-colors" title="Imprimir Setlist">
                    <Printer className="w-5 h-5" />
                  </button>
                  <div className="flex items-center space-x-2">
                    <label htmlFor="showArtists" className="text-sm font-medium text-gray-600">Artistas</label>
                    <button 
                      onClick={() => setShowArtists(!showArtists)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showArtists ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showArtists ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-grow">
                {setlist.description && (
                  <p className="text-sm text-gray-600 italic mb-6 bg-gray-50 p-3 rounded-md border border-gray-200">{setlist.description}</p>
                )}

                {(() => {
                  const combinedItems = useMemo(() => {
                    if (!setlist?.songs) return [];
                    
                    return setlist.songs.map(s => ({
                      ...s,
                      type: s.song?.type === 'medley' ? 'medley' as const : 'song' as const
                    })).sort((a, b) => a.position - b.position);
                  }, [setlist?.songs]);

                  const totalItems = combinedItems.length;
                  const useTwoColumns = totalItems > 10;
                  const numRows = useTwoColumns ? Math.ceil(totalItems / 2) : totalItems;

                  if (totalItems === 0) {
                    return (
                      <div className="text-center py-10">
                        <p className="text-gray-500">Este setlist está vacío.</p>
                      </div>
                    );
                  }

                  return (
                    <div 
                      className="grid gap-x-8"
                      style={{
                        gridTemplateRows: `repeat(${numRows}, auto)`,
                        gridAutoFlow: 'column',
                        gridTemplateColumns: useTwoColumns ? '1fr 1fr' : '1fr',
                      }}
                    >
                      {combinedItems.map((item, index) => {
                        if (item.type === 'medley') {
                          return (
                            <div key={`medley-${item.id}`} className="bg-slate-50 rounded-lg p-2 my-1 transition-all duration-300">
                              <div className="flex items-center space-x-3 text-sm">
                                <span className="text-gray-400 font-mono w-5 text-right pt-1 self-start">{index + 1}.</span>
                                <div className="flex-grow">
                                  <p className="text-indigo-600 font-bold">{item.song?.title}</p>
                                  <p className="text-xs text-gray-400">Medley ({item.song?.medley_song_ids?.length || 0} canciones)</p>
                                </div>
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div key={`song-${item.song?.id || index}`} className="flex items-baseline space-x-3 text-sm group py-1 min-h-[3.25rem]">
                              <span className="text-gray-400 font-mono w-5 text-right">{index + 1}.</span>
                              <div>
                                <p className="text-gray-800 font-medium group-hover:text-indigo-600 transition-colors">{item.song?.title || 'N/A'}</p>
                                <p className={`text-gray-500 text-xs transition-all duration-300 ease-in-out ${showArtists && item.song?.artist ? 'opacity-100 h-4' : 'opacity-0 h-0'}`}>
                                  {item.song?.artist}
                                </p>
                              </div>
                            </div>
                          );
                        }
                      })}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default SetlistPreviewModal;
