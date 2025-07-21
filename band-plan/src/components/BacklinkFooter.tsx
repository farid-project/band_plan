// Backlink component for GetSongBPM and GetSongKey APIs
// Required for using their free API services

import React from 'react';

export default function BacklinkFooter() {
  return (
    <div className="py-4 text-center text-xs text-gray-500 bg-gray-50 border-t">
      <div className="container mx-auto px-4">
        <p className="mb-2">
          Análisis musical potenciado por:
        </p>
        <div className="flex flex-wrap justify-center items-center gap-2 md:gap-4">
          <a
            href="https://getsongbpm.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline transition-colors"
          >
            GetSongBPM.com
          </a>
          <span className="hidden md:inline">•</span>
          <a
            href="https://getsongkey.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline transition-colors"
          >
            GetSongKey.com
          </a>
          <span className="hidden md:inline">•</span>
          <a
            href="https://theaudiodb.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline transition-colors"
          >
            TheAudioDB
          </a>
          <span className="hidden md:inline">•</span>
          <a
            href="https://musicbrainz.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline transition-colors"
          >
            MusicBrainz
          </a>
        </div>
      </div>
    </div>
  );
}