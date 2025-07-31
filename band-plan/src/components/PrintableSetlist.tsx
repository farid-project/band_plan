import React, { useEffect } from 'react';
import { Setlist, Event, Medley } from '../types';
import { generateSetlistPDF } from '../utils/pdfGenerator';
import { Download } from 'lucide-react';

interface PrintableSetlistProps {
  setlist: Setlist;
  event?: Event;
  bandName?: string;
  preview?: boolean;
}

const PrintableSetlist: React.FC<PrintableSetlistProps> = ({ setlist, event, bandName, preview }) => {
  const handleDownloadPDF = (printFriendly: boolean = false) => {
    const pdf = generateSetlistPDF(setlist, event, bandName, printFriendly);
    const suffix = printFriendly ? ' (Print)' : ' (Digital)';
    const fileName = `${bandName || 'Setlist'} - ${event?.name || 'Event'}${suffix}.pdf`;
    
    // Always open in new tab instead of downloading
    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
    
    // Clean up the URL after a short delay
    setTimeout(() => {
      URL.revokeObjectURL(pdfUrl);
    }, 1000);
  };

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
        position: relative;
      }
      
      .pdf-download-buttons {
        position: absolute;
        top: 12px;
        right: 12px;
        display: flex;
        gap: 8px;
      }

      .pdf-download-btn {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 6px 10px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        transition: background-color 0.2s;
      }
      
      .pdf-download-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      header h1 {
        font-family: 'Florida Project Phase One', 'Special Elite', cursive;
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

      .song-list-container {
        width: 100%;
        overflow: hidden;
      }
      
      .song-column {
        float: left;
        width: 48%;
        margin-right: 4%;
        box-sizing: border-box;
      }
      
      .song-column:last-child {
        margin-right: 0;
      }

      .song-list {
        list-style-type: none;
        padding: 0;
        margin: 0;
      }

      .song-list li {
        padding: 8px 0 6px 0;
        margin-bottom: 2px;
        border-bottom: 1px dashed var(--border-color);
        display: flex;
        align-items: flex-start;
        font-size: 1em;
        line-height: 1.25;
      }

      .song-number {
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
        margin-bottom: 6px;
        color: #495057;
        font-size: 1.02em;
        border-bottom: 1px solid #e9ecef;
        padding-bottom: 4px;
      }

      .medley-songs {
        list-style-type: none;
        padding-left: 10px;
        margin: 0;
      }

      .medley-songs li {
        border: none;
        padding: 3px 0;
        font-size: 0.95em;
        color: #6c757d;
      }

      .medley-songs li span {
        line-height: 1.2;
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
      @page {
        margin: 0.5in 0.3in;
        size: letter;
        orphans: 1;
        widows: 1;
      }

      @media print {
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
          font-size: 10pt;
        }
        .container {
          box-shadow: none;
          border-radius: 0;
          max-width: 100%;
        }
        header {
          padding: 20px 10px;
          border-bottom: 2px solid #333;
        }
        header h1 {
          font-size: 24pt;
          color: #000;
        }
        header p {
          font-size: 12pt;
          color: #333;
        }
        main {
          padding: 15px 10px;
        }
        .song-list li {
          padding: 6px 0;
          border-bottom: 1px solid #ccc;
        }
        .song-number {
          font-size: 11pt;
        }
        .pdf-download-buttons {
          display: none;
        }
        .medley-container {
          background-color: #f9f9f9;
          border: 1px solid #ddd;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Combine and sort songs and medleys
  const combinedItems = [
    ...(setlist.songs?.map(s => ({ ...s, type: 'song' as const })) || []),
    ...(setlist.medleys?.map(m => ({ ...m, type: 'medley' as const })) || [])
  ].sort((a, b) => a.position - b.position);

  const midPoint = Math.ceil(combinedItems.length / 2);
  const leftColumn = combinedItems.slice(0, midPoint);
  const rightColumn = combinedItems.slice(midPoint);

  // Format event date
  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    // Format as DD/MM/YYYY
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const renderItem = (item: (typeof combinedItems)[0]) => {
    if (item.type === 'song' && item.song) {
      return (
        <span contentEditable={true}>
          {item.song.title}
          {item.song.artist && ` - ${item.song.artist}`}
        </span>
      );
    }

    if (item.type === 'medley') {
      const medley = item as Medley;
      return (
        <div className="medley-container">
          <div className="medley-title">{medley.name}</div>
          {!preview && (
            <ul className="medley-songs">
              {medley.songs?.map((medleySongItem: any) => (
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
      );
    }

    return null;
  };

  return (
    <div className="container printable-setlist">
      <header>
        <div className="pdf-download-buttons">
          <button 
            className="pdf-download-btn"
            onClick={() => handleDownloadPDF(false)}
            title="Descargar PDF Digital"
          >
            <Download size={16} />
            PDF Digital
          </button>
          <button 
            className="pdf-download-btn print-btn"
            onClick={() => handleDownloadPDF(true)}
            title="Descargar PDF para Imprimir"
          >
            <Download size={16} />
            PDF Impresión
          </button>
        </div>
        <h1 contentEditable={true}>{bandName || 'NOMBRE DE LA BANDA'}</h1>
        <p contentEditable={true}>
          {event ? `${event.name || 'Evento'} - ${formatEventDate(event.date)}` : 'Lugar del Evento - Fecha'}
        </p>
      </header>

      <main id="setlist">
        <div className="song-list-container">
          <div className="song-column">
            <ol className="song-list">
              {leftColumn.map((item, index) => (
                <li key={`${item.type}-${item.id}`} data-number={index + 1}>
                  <span className="song-number">{String(index + 1).padStart(2, '0')}</span>
                  {renderItem(item)}
                </li>
              ))}
            </ol>
          </div>
          
          <div className="song-column">
            <ol className="song-list" start={leftColumn.length + 1}>
              {rightColumn.map((item, index) => (
                <li key={`${item.type}-${item.id}`} data-number={leftColumn.length + index + 1}>
                  <span className="song-number">{String(leftColumn.length + index + 1).padStart(2, '0')}</span>
                  {renderItem(item)}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrintableSetlist; 