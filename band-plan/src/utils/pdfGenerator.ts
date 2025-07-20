import jsPDF from 'jspdf';
import { Setlist, Event, Medley, SetlistSong } from '../types';

export const generateSetlistPDF = (
  setlist: Setlist,
  event?: Event,
  bandName?: string,
  printFriendly: boolean = false
) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // --- COLORS & FONTS ---
  const backgroundColor = printFriendly ? '#FFFFFF' : '#1E2A47'; // White or Dark Blue
  const textColor = printFriendly ? '#000000' : '#F95738'; // Black or Bright Orange
  const font = 'helvetica';

  // --- BACKGROUND ---
  if (!printFriendly) {
    pdf.setFillColor(backgroundColor);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  }

  // --- SETLIST ITEMS ---
  const combinedItems = [
    ...(setlist.songs?.map(s => ({ ...s, type: 'song' })) || []),
    ...(setlist.medleys?.map(m => ({ ...m, type: 'medley' })) || []),
  ].sort((a, b) => a.position - b.position);

  // --- Calculations for positioning ---
  const songListStartY = 30;
  let totalTextHeight = 0;
  const baseLineHeight = 10;
  const baseMaxWidth = pageWidth - 60;
  
  // Determine if we should use two columns based on number of items
  const useTwoColumns = combinedItems.length > 20;
  const columnWidth = useTwoColumns ? (baseMaxWidth - 20) / 2 : baseMaxWidth;
  const leftColumnX = 20;
  const rightColumnX = leftColumnX + columnWidth + 20;
  
  // Adjust font size and line height based on number of items
  let fontSize = 18;
  let lineHeight = baseLineHeight;
  
  if (combinedItems.length > 30) {
    fontSize = 14;
    lineHeight = 8;
  } else if (combinedItems.length > 25) {
    fontSize = 16;
    lineHeight = 9;
  }

  // --- SETLIST ITEMS (Drawing) ---
  pdf.setFont(font, 'bold');
  pdf.setFontSize(fontSize);
  pdf.setTextColor(textColor);

  let currentY = songListStartY;
  let firstItemY = currentY;
  
  if (useTwoColumns) {
    // Split items into two columns
    const midPoint = Math.ceil(combinedItems.length / 2);
    const leftColumnItems = combinedItems.slice(0, midPoint);
    const rightColumnItems = combinedItems.slice(midPoint);
    
    // Draw left column
    let leftY = currentY;
    leftColumnItems.forEach((item, index) => {
      let text = '';
      if (item.type === 'song') {
        const songItem = item as SetlistSong;
        if (songItem.song) text = songItem.song.title;
      } else if (item.type === 'medley') {
        text = (item as Medley).name || 'Medley';
      }

      const number = String(index + 1).padStart(2, '0');
      const numberedText = `${number}. ${text}`;
      const textLines = pdf.splitTextToSize(numberedText.toUpperCase(), columnWidth);
      pdf.text(textLines, leftColumnX, leftY);
      leftY += textLines.length * lineHeight;
    });

    // Draw right column
    let rightY = currentY;
    rightColumnItems.forEach((item, index) => {
      let text = '';
      if (item.type === 'song') {
        const songItem = item as SetlistSong;
        if (songItem.song) text = songItem.song.title;
      } else if (item.type === 'medley') {
        text = (item as Medley).name || 'Medley';
      }

      const number = String(midPoint + index + 1).padStart(2, '0');
      const numberedText = `${number}. ${text}`;
      const textLines = pdf.splitTextToSize(numberedText.toUpperCase(), columnWidth);
      pdf.text(textLines, rightColumnX, rightY);
      rightY += textLines.length * lineHeight;
    });
  } else {
    // Single column layout
    combinedItems.forEach((item, index) => {
      // Check if we need a new page (fallback for very long single column)
      if (currentY > pageHeight - 50) {
        pdf.addPage();
        
        if (!printFriendly) {
          pdf.setFillColor(backgroundColor);
          pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        }
        
        currentY = songListStartY;
        pdf.setFont(font, 'bold');
        pdf.setFontSize(fontSize);
        pdf.setTextColor(textColor);
      }

      let text = '';
      if (item.type === 'song') {
        const songItem = item as SetlistSong;
        if (songItem.song) text = songItem.song.title;
      } else if (item.type === 'medley') {
        text = (item as Medley).name || 'Medley';
      }

      const number = String(index + 1).padStart(2, '0');
      const numberedText = `${number}. ${text}`;
      const textLines = pdf.splitTextToSize(numberedText.toUpperCase(), columnWidth);
      pdf.text(textLines, leftColumnX, currentY);
      currentY += textLines.length * lineHeight;
    });
  }

  // --- VERTICAL BAND NAME (on all pages) ---
  const totalPages = pdf.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    pdf.setPage(pageNum);
    pdf.setFont(font, 'bold');
    pdf.setFontSize(48);
    pdf.setTextColor(textColor);
    const verticalText = (bandName || 'YOUR BAND').toUpperCase();
    pdf.text(verticalText, pageWidth - 20, songListStartY, {
      angle: -90,
      align: 'left',
    });
  }

  // --- EVENT INFO (BOTTOM RIGHT) ---
  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (event) {
    pdf.setFont(font, 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(textColor);
    const eventLines = [
      event.name || 'The Arena',
      event.location || 'Town, Country',
      formatEventDate(event.date),
    ];
    pdf.text(eventLines, pageWidth - 20, pageHeight - 30, { align: 'right' });
  }

  return pdf;
};