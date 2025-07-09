import React, { useEffect } from 'react';
import { Setlist, Event } from '../types';

interface PrintableSetlistProps {
  setlist: Setlist;
  event?: Event;
  bandName?: string;
  preview?: boolean;
}

const PrintableSetlist: React.FC<PrintableSetlistProps> = ({ setlist, event, bandName, preview }) => {
  useEffect(() => {
    // Apply the CSS styles
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --background-color: #f5f5f5;
        --text-color: #333;
        --primary-color: #2c3e50;
        --container-bg: #ffffff;
        --border-color: #ddd;
      }

      body {
        font-family: 'Roboto Mono', monospace;
        background-color: var(--background-color);
        color: var(--text-color);
        margin: 0;
        padding: 16px;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        min-height: 100vh;
        font-size: 0.92em;
      }

      .container {
        width: 100%;
        max-width: 1100px;
        background-color: var(--container-bg);
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        overflow: hidden;
      }

      header {
        background-color: #5B4FFF;
        color: #fff;
        padding: 24px 12px 16px 12px;
        text-align: center;
        border-bottom: 5px solid var(--border-color);
      }

      header h1 {
        font-family: 'Special Elite', cursive;
        font-size: 2.1em;
        margin: 0;
        letter-spacing: 2px;
      }

      header p {
        margin: 5px 0 0;
        font-style: italic;
        font-size: 1em;
      }

      main {
        padding: 24px 12px 24px 12px;
      }

      .song-list {
        list-style-type: none;
        padding: 0;
        margin: 0;
        column-count: 2;
        column-gap: 36px;
      }

      .song-list li {
        padding: 8px 0 6px 0;
        margin-bottom: 2px;
        border-bottom: 1px dashed var(--border-color);
        counter-increment: song-counter;
        display: flex;
        align-items: flex-start;
        break-inside: avoid-column;
        -webkit-column-break-inside: avoid;
        page-break-inside: avoid;
        font-size: 1em;
        line-height: 1.25;
      }

      .song-list li::before {
        content: counter(song-counter, decimal-leading-zero);
        font-weight: bold;
        color: var(--primary-color);
        margin-right: 14px;
        font-size: 1.08em;
        flex-shrink: 0;
        line-height: 1.1;
      }

      .song-list li span[contenteditable] {
        flex-grow: 1;
        outline: none;
        padding: 1px 3px;
        border-radius: 3px;
        transition: background-color 0.2s;
        font-size: 1em;
        line-height: 1.25;
        word-break: break-word;
        white-space: pre-line;
      }

      .song-list li span[contenteditable]:focus {
        background-color: #e8f4fd;
      }

      .medley-container {
        background-color: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        padding: 7px 10px;
        margin: 7px 0;
        min-width: 0;
      }

      .medley-title {
        font-weight: bold;
        font-style: italic;
        margin-bottom: 2px;
        color: #495057;
        font-size: 1em;
        line-height: 1.2;
        word-break: break-word;
      }

      .medley-songs {
        list-style-type: disc;
        margin: 0;
        padding-left: 16px;
        font-size: 0.93em;
      }

      .medley-songs li {
        border: none;
        padding: 1px 0;
        counter-increment: none;
        line-height: 1.2;
      }

      .medley-songs li::before {
        content: none;
      }

      footer {
        display: none;
      }

      /* Responsive Design */
      @media (max-width: 900px) {
        .song-list {
          column-count: 1;
        }
      }

      @media (max-width: 600px) {
        .song-list {
          column-count: 1;
        }
        header h1 {
          font-size: 1.4em;
        }
      }

      /* Print Styles */
      @media print {
        body * {
          visibility: hidden !important;
        }
        .printable-setlist, .printable-setlist * {
          visibility: visible !important;
          position: static !important;
          display: initial !important;
          color: #000 !important;
          background: #fff !important;
        }
        .printable-setlist {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          z-index: 9999 !important;
          background: #fff !important;
        }
        body {
          background-color: #fff;
          color: #000;
          padding: 0;
        }
        .container {
          box-shadow: none;
          border-radius: 0;
          max-width: 100%;
          background-color: #fff;
        }
        header {
          background-color: #fff;
          color: #000;
          border-bottom: 2px solid #000;
          padding: 10px;
        }
        header h1, header p {
          color: #000;
        }
        .song-list {
          color: #000;
          column-count: 2 !important;
          column-gap: 40px !important;
        }
        .song-list li {
          border-bottom: 1px solid #ccc;
          padding: 8px 0;
          margin-bottom: 0;
        }
        .song-list li::before {
          color: #000;
        }
        .song-list li span[contenteditable] {
          color: #000;
        }
        .medley-container {
          background-color: #fff;
          border: 1px solid #ccc;
          padding: 8px;
          margin: 4px 0;
        }
        .medley-title {
          color: #000;
        }
        :root {
          --primary-color: #000;
          --border-color: #ccc;
        }
      }
    `;
    document.head.appendChild(style);

    // Add Google Fonts
    const link1 = document.createElement('link');
    link1.rel = 'preconnect';
    link1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(link1);

    const link2 = document.createElement('link');
    link2.rel = 'preconnect';
    link2.href = 'https://fonts.gstatic.com';
    link2.crossOrigin = 'anonymous';
    document.head.appendChild(link2);

    const link3 = document.createElement('link');
    link3.href = 'https://fonts.googleapis.com/css2?family=Special+Elite&family=Roboto+Mono:wght@400;700&display=swap';
    link3.rel = 'stylesheet';
    document.head.appendChild(link3);

    return () => {
      document.head.removeChild(style);
      document.head.removeChild(link1);
      document.head.removeChild(link2);
      document.head.removeChild(link3);
    };
  }, []);

  console.log('PrintableSetlist render', { setlist, event, bandName });

  // Combine and sort songs and medleys
  const combinedItems = [
    ...(setlist.songs?.map(s => ({ ...s, type: 'song' })) || []),
    ...(setlist.medleys?.map(m => ({ ...m, type: 'medley' })) || [])
  ].sort((a, b) => a.position - b.position);

  // Format event date
  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="container printable-setlist">
      <header>
        <h1 contentEditable={true}>{bandName || 'NOMBRE DE LA BANDA'}</h1>
        <p contentEditable={true}>
          {event ? `${event.name || 'Evento'} / ${formatEventDate(event.date)}` : 'Lugar del Evento / Fecha'}
        </p>
      </header>

      <main id="setlist">
        <ol className="song-list">
          {combinedItems.map((item) => (
            <li key={`${item.type}-${item.id}`}>
              {item.type === 'song' ? (
                <span contentEditable={true}>
                  {(item as any).song.title}
                  {(item as any).song.artist && ` - ${(item as any).song.artist}`}
                </span>
              ) : (
                <div className="medley-container">
                  <div className="medley-title">{item.name}</div>
                  {!preview && (
                    <ul className="medley-songs">
                      {(item as any).songs.map((medleySongItem: any) => (
                        <li key={medleySongItem.song.id}>
                          <span contentEditable={true}>
                            {medleySongItem.song.title}
                            {medleySongItem.song.artist && ` - ${medleySongItem.song.artist}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
};

export default PrintableSetlist; 