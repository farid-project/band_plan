import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Music, Clock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Song {
  id: string;
  title: string;
  artist: string;
  duration_minutes?: number;
  key?: string;
  notes?: string;
  type?: 'song' | 'medley';
}

interface MedleySong {
  position: number;
  song: Song;
}

interface Medley {
  id: string;
  name: string;
  position: number;
  medley_songs: MedleySong[];
}

interface SetlistSong {
  id: string;
  position: number;
  song: Song;
}

interface SetlistItem {
  type: 'song' | 'medley';
  position: number;
  song?: Song;
  medley?: Medley;
}

interface Setlist {
  id: string;
  name: string;
  description?: string;
  songs: SetlistSong[];
  medleys?: Medley[];
}

interface Event {
  id: string;
  title: string;
  datetime: string;
  setlist?: Setlist;
}

export const LiveView: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [setlistItems, setSetlistItems] = useState<SetlistItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  // Prevent screen lock during live view
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('Screen wake lock activated');
        }
      } catch (error) {
        console.log('Wake lock not supported or failed:', error);
      }
    };

    requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release();
        console.log('Screen wake lock released');
      }
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'ArrowRight' || e.code === 'Space') {
        e.preventDefault();
        nextItem();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        previousItem();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'KeyN') {
        e.preventDefault();
        setShowNotes(!showNotes);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showNotes]);

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          setlist:setlists(
            *,
            songs:setlist_songs(
              position,
              song:songs(
                id,
                title,
                artist,
                duration_minutes,
                key,
                notes,
                type
              )
            ),
            medleys(
              id,
              name,
              position,
              medley_songs(
                position,
                song:songs(
                  id,
                  title,
                  artist,
                  duration_minutes,
                  key,
                  notes
                )
              )
            )
          )
        `)
        .eq('id', eventId)
        .single();

      if (error) throw error;

      setEvent(data);

      // Process setlist items (combine songs and medleys)
      if (data.setlist) {
        const items: SetlistItem[] = [];
        
        // Add regular songs
        if (data.setlist.songs) {
          data.setlist.songs.forEach((songItem: any) => {
            items.push({
              type: 'song',
              position: songItem.position,
              song: songItem.song
            });
          });
        }
        
        // Add medleys
        if (data.setlist.medleys) {
          data.setlist.medleys.forEach((medley: any) => {
            items.push({
              type: 'medley',
              position: medley.position,
              medley: medley
            });
          });
        }
        
        // Sort by position
        items.sort((a, b) => a.position - b.position);
        setSetlistItems(items);
      }
    } catch (error) {
      console.error('Error fetching event:', error);
    } finally {
      setLoading(false);
    }
  };

  const nextItem = () => {
    if (!setlistItems.length) return;
    setCurrentItemIndex(prev => 
      prev < setlistItems.length - 1 ? prev + 1 : prev
    );
  };

  const previousItem = () => {
    setCurrentItemIndex(prev => prev > 0 ? prev - 1 : prev);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Music className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <p className="text-xl">Cargando evento...</p>
        </div>
      </div>
    );
  }

  if (!setlistItems.length) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Music className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-xl mb-2">No hay setlist disponible</p>
          <p className="text-gray-400">Configura un setlist para este evento</p>
        </div>
      </div>
    );
  }

  const currentItem = setlistItems[currentItemIndex];
  const totalItems = setlistItems.length;
  const currentSong = currentItem?.song;
  const currentMedley = currentItem?.medley;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header with event info */}
      <div className="bg-gray-900 p-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold truncate">{event.title}</h1>
          <p className="text-gray-400 text-sm">{event.setlist.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">
            {currentItemIndex + 1} / {totalItems}
          </p>
          <p className="text-xs text-gray-500">
            {new Date(event.datetime).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Main content - Current item */}
      <div className="flex-1 flex flex-col justify-center p-6 text-center">
        {currentItem?.type === 'song' && currentSong && (
          <>
            {/* Song title and artist */}
            <div className="mb-8">
              <h2 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
                {currentSong.title}
              </h2>
              <p className="text-2xl md:text-3xl text-gray-300">
                {currentSong.artist}
              </p>
            </div>

            {/* Song details */}
            <div className="grid grid-cols-2 gap-4 mb-8 text-lg md:text-xl">
              {currentSong.key && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-sm">Tonalidad</p>
                  <p className="font-bold">{currentSong.key}</p>
                </div>
              )}
              
              {currentSong.duration_minutes && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-sm">Duración</p>
                  <p className="font-bold flex items-center justify-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {currentSong.duration_minutes} min
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            {showNotes && currentSong.notes && (
              <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4 mb-8">
                <h3 className="text-yellow-400 font-semibold mb-2">📝 Notas</h3>
                <p className="text-yellow-100 whitespace-pre-wrap">
                  {currentSong.notes}
                </p>
              </div>
            )}
          </>
        )}

        {currentItem?.type === 'medley' && currentMedley && (
          <>
            {/* Medley title */}
            <div className="mb-8">
              <h2 className="text-4xl md:text-6xl font-bold mb-4 leading-tight text-yellow-400">
                🎵 {currentMedley.name}
              </h2>
              <p className="text-2xl md:text-3xl text-gray-300">
                Medley
              </p>
            </div>

            {/* Medley songs */}
            <div className="mb-8">
              <div className="grid gap-3 text-lg max-w-2xl mx-auto">
                {currentMedley.medley_songs
                  ?.sort((a, b) => a.position - b.position)
                  .map((medleySong, idx) => (
                    <div key={medleySong.song.id} className="bg-gray-800 rounded-lg p-4 text-left">
                      <div className="flex items-center">
                        <span className="text-yellow-400 mr-3 font-bold">{idx + 1}.</span>
                        <div className="flex-1">
                          <p className="font-medium text-white">{medleySong.song.title}</p>
                          <p className="text-gray-400 text-sm">{medleySong.song.artist}</p>
                        </div>
                        {medleySong.song.duration_minutes && (
                          <span className="text-gray-500 text-sm">
                            {medleySong.song.duration_minutes}min
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Navigation controls */}
      <div className="bg-gray-900 p-4">
        {/* Progress bar */}
        <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentItemIndex + 1) / totalItems) * 100}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center">
          <button
            onClick={previousItem}
            disabled={currentItemIndex === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:block">Anterior</span>
          </button>

          <div className="flex space-x-2">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              title={showNotes ? "Ocultar notas" : "Mostrar notas"}
            >
              {showNotes ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              title="Pantalla completa"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>

          <button
            onClick={nextItem}
            disabled={currentItemIndex === totalItems - 1}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
          >
            <span className="hidden sm:block">Siguiente</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Keyboard shortcuts info */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            ⌨️ Atajos: ← → (navegar) | Espacio (siguiente) | F (pantalla completa) | N (notas)
          </p>
        </div>
      </div>
    </div>
  );
};