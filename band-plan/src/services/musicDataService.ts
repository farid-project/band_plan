// Enhanced service to get music data from multiple sources
// Priority: 1) Free APIs (AudioDB, iTunes, Deezer), 2) GetSongBPM/GetSongKey, 3) MusicBrainz/AcousticBrainz, 4) LastFM, 5) Local algorithms

import { musicBrainzService, EnhancedMusicData } from './musicBrainzService';
import { songAnalysisService, PreciseMusicData } from './songAnalysisService';
import { freeApiService, FreeMusicData } from './freeApiService';

export interface MusicData {
  bpm?: number;
  key?: string;
  energy?: number;
  danceability?: number;
  valence?: number;
  confidence?: {
    tempo?: number;
    key?: number;
    overall?: number;
  };
  source?: 'spotify' | 'audiodb' | 'itunes' | 'deezer' | 'musicbrainz' | 'genius' | 'getsongbpm' | 'getsongkey' | 'combined' | 'acousticbrainz' | 'lastfm' | 'estimation';
}

interface LastFMTrackInfo {
  name: string;
  artist: string;
  album?: string;
  duration?: number;
  playcount?: number;
  listeners?: number;
  tags?: Array<{ name: string; count: number }>;
}

class MusicDataService {
  private readonly LASTFM_API_KEY = import.meta.env.VITE_LASTFM_API_KEY;
  private readonly LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';
  // Database of known artists and their typical characteristics
  private artistGenreMap: { [key: string]: string } = {
    // Rock artists
    'queen': 'rock',
    'led zeppelin': 'rock',
    'the beatles': 'rock',
    'pink floyd': 'rock',
    'the rolling stones': 'rock',
    'ac/dc': 'metal',
    'metallica': 'metal',
    'iron maiden': 'metal',
    'black sabbath': 'metal',
    
    // Pop artists  
    'madonna': 'pop',
    'michael jackson': 'pop',
    'britney spears': 'pop',
    'taylor swift': 'pop',
    'ariana grande': 'pop',
    'ed sheeran': 'pop',
    'adele': 'ballad',
    
    // Electronic/Dance
    'daft punk': 'electronic',
    'calvin harris': 'dance',
    'david guetta': 'dance',
    'skrillex': 'electronic',
    'deadmau5': 'electronic',
    
    // Hip hop
    'eminem': 'hip hop',
    'jay-z': 'hip hop',
    'kanye west': 'hip hop',
    'drake': 'hip hop',
    'kendrick lamar': 'hip hop',
    
    // Alternative
    'alanis morissette': 'alternative',
    'nirvana': 'grunge',
    'radiohead': 'alternative',
    'foo fighters': 'alternative',
    
    // Latin
    'shakira': 'latin',
    'jennifer lopez': 'latin pop',
    'ricky martin': 'latin pop',
    'manu chao': 'latin',
    
    // Spanish artists
    'jesse & joy': 'latin pop',
    'alejandro sanz': 'latin ballad',
    'mecano': 'spanish pop',
    'heroes del silencio': 'spanish rock',
    'maldita nerea': 'spanish pop',
    'la oreja de van gogh': 'spanish pop',
  };

  // BPM ranges by genre
  private genreBPMMap: { [key: string]: { min: number, max: number, typical: number } } = {
    'rock': { min: 110, max: 140, typical: 125 },
    'pop': { min: 100, max: 130, typical: 115 },
    'dance': { min: 120, max: 140, typical: 128 },
    'electronic': { min: 110, max: 150, typical: 130 },
    'hip hop': { min: 80, max: 100, typical: 90 },
    'jazz': { min: 100, max: 180, typical: 120 },
    'blues': { min: 60, max: 120, typical: 80 },
    'reggae': { min: 60, max: 90, typical: 75 },
    'folk': { min: 80, max: 120, typical: 100 },
    'classical': { min: 60, max: 200, typical: 120 },
    'metal': { min: 140, max: 200, typical: 160 },
    'punk': { min: 150, max: 200, typical: 175 },
    'ballad': { min: 60, max: 90, typical: 75 },
    'disco': { min: 110, max: 130, typical: 120 },
    'funk': { min: 100, max: 120, typical: 110 },
    'country': { min: 80, max: 140, typical: 110 },
    'latin': { min: 90, max: 140, typical: 115 },
    'reggaeton': { min: 90, max: 100, typical: 95 },
    'alternative': { min: 100, max: 140, typical: 120 },
    'grunge': { min: 110, max: 140, typical: 125 },
    'latin pop': { min: 100, max: 130, typical: 115 },
    'latin ballad': { min: 70, max: 100, typical: 85 },
    'spanish pop': { min: 100, max: 130, typical: 115 },
    'spanish rock': { min: 110, max: 140, typical: 125 },
  };

  // Key preferences by genre
  private genreKeyMap: { [key: string]: string[] } = {
    'rock': ['E', 'A', 'G', 'D', 'C'],
    'pop': ['C', 'G', 'F', 'D', 'A'],
    'dance': ['C', 'G', 'F', 'A', 'D'],
    'electronic': ['C', 'G', 'F', 'A', 'D'],
    'hip hop': ['C', 'F', 'G', 'Bb', 'Eb'],
    'jazz': ['F', 'Bb', 'C', 'G', 'D'],
    'blues': ['E', 'A', 'G', 'C', 'D'],
    'folk': ['G', 'C', 'D', 'A', 'F'],
    'country': ['G', 'C', 'D', 'A', 'F'],
    'metal': ['E', 'D', 'C', 'A', 'F#'],
    'ballad': ['C', 'G', 'F', 'D', 'A'],
    'alternative': ['E', 'A', 'D', 'G', 'C'],
    'grunge': ['E', 'A', 'D', 'G', 'C'],
    'latin': ['C', 'G', 'F', 'D', 'A'],
    'latin pop': ['C', 'G', 'F', 'D', 'A'],
    'spanish pop': ['C', 'G', 'F', 'D', 'A'],
    'spanish rock': ['E', 'A', 'G', 'D', 'C'],
  };

  // Detect genre from artist name
  private detectGenreFromArtist(artist: string): string | null {
    const artistLower = artist.toLowerCase();
    
    // Direct match
    if (this.artistGenreMap[artistLower]) {
      return this.artistGenreMap[artistLower];
    }
    
    // Partial matches for bands with "the" etc.
    for (const [knownArtist, genre] of Object.entries(this.artistGenreMap)) {
      if (artistLower.includes(knownArtist) || knownArtist.includes(artistLower)) {
        return genre;
      }
    }
    
    return null;
  }

  // Detect genre from song title patterns
  private detectGenreFromTitle(title: string): string | null {
    const titleLower = title.toLowerCase();
    
    // Dance/Electronic keywords
    if (titleLower.includes('remix') || titleLower.includes('mix') || 
        titleLower.includes('club') || titleLower.includes('dance')) {
      return 'dance';
    }
    
    // Ballad keywords
    if (titleLower.includes('love') || titleLower.includes('heart') || 
        titleLower.includes('forever') || titleLower.includes('tears')) {
      return 'ballad';
    }
    
    // Rock keywords
    if (titleLower.includes('rock') || titleLower.includes('roll') || 
        titleLower.includes('wild') || titleLower.includes('break')) {
      return 'rock';
    }
    
    return null;
  }

  // Generate hash from string for consistent randomization
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Get consistent random value between min and max based on track
  private getConsistentRandom(artist: string, track: string, min: number, max: number): number {
    const hash = this.hashString(artist + track);
    const normalizedHash = hash % 1000 / 1000; // 0-1
    return Math.round(min + normalizedHash * (max - min));
  }

  // Get track info from LastFM API
  private async getLastFMTrackInfo(artist: string, track: string): Promise<LastFMTrackInfo | null> {
    if (!this.LASTFM_API_KEY || this.LASTFM_API_KEY === 'tu_lastfm_api_key_aqui') {
      console.warn('LastFM API key not configured');
      return null;
    }

    try {
      const params = new URLSearchParams({
        method: 'track.getInfo',
        api_key: this.LASTFM_API_KEY,
        artist: artist,
        track: track,
        format: 'json'
      });

      const response = await fetch(`${this.LASTFM_BASE_URL}?${params}`);
      const data = await response.json();

      if (data.error) {
        console.warn(`LastFM API error: ${data.message}`);
        return null;
      }

      const trackInfo = data.track;
      if (!trackInfo) return null;

      return {
        name: trackInfo.name,
        artist: trackInfo.artist?.name || artist,
        album: trackInfo.album?.title,
        duration: trackInfo.duration ? parseInt(trackInfo.duration) * 1000 : undefined, // Convert to ms
        playcount: parseInt(trackInfo.playcount) || 0,
        listeners: parseInt(trackInfo.listeners) || 0,
        tags: trackInfo.toptags?.tag?.map((tag: any) => ({
          name: tag.name,
          count: parseInt(tag.count) || 0
        })) || []
      };
    } catch (error) {
      console.warn(`Error fetching from LastFM: ${error}`);
      return null;
    }
  }

  // Get artist info from LastFM API for additional genre detection
  private async getLastFMArtistInfo(artist: string): Promise<{ tags: Array<{ name: string; count: number }> } | null> {
    if (!this.LASTFM_API_KEY || this.LASTFM_API_KEY === 'tu_lastfm_api_key_aqui') {
      return null;
    }

    try {
      const params = new URLSearchParams({
        method: 'artist.getInfo',
        api_key: this.LASTFM_API_KEY,
        artist: artist,
        format: 'json'
      });

      const response = await fetch(`${this.LASTFM_BASE_URL}?${params}`);
      const data = await response.json();

      if (data.error || !data.artist) return null;

      return {
        tags: data.artist.tags?.tag?.map((tag: any) => ({
          name: tag.name.toLowerCase(),
          count: parseInt(tag.count) || 0
        })) || []
      };
    } catch (error) {
      console.warn(`Error fetching artist from LastFM: ${error}`);
      return null;
    }
  }

  // Enhanced genre detection using LastFM tags
  private detectGenreFromLastFM(trackInfo: LastFMTrackInfo, artistInfo: { tags: Array<{ name: string; count: number }> } | null): string | null {
    const allTags = [...(trackInfo.tags || []), ...(artistInfo?.tags || [])];
    
    if (allTags.length === 0) return null;

    // Map LastFM tags to our genre system
    const tagToGenreMap: { [key: string]: string } = {
      // Rock genres
      'rock': 'rock',
      'classic rock': 'rock',
      'hard rock': 'rock',
      'alternative rock': 'alternative',
      'indie rock': 'alternative',
      'punk rock': 'punk',
      'metal': 'metal',
      'heavy metal': 'metal',
      'death metal': 'metal',
      'black metal': 'metal',
      'grunge': 'grunge',
      
      // Pop genres
      'pop': 'pop',
      'pop rock': 'pop',
      'synthpop': 'pop',
      'electropop': 'electronic',
      'indie pop': 'pop',
      
      // Electronic genres
      'electronic': 'electronic',
      'house': 'dance',
      'techno': 'electronic',
      'trance': 'dance',
      'drum and bass': 'electronic',
      'dubstep': 'electronic',
      'edm': 'dance',
      'dance': 'dance',
      
      // Hip hop genres
      'hip hop': 'hip hop',
      'rap': 'hip hop',
      'hip-hop': 'hip hop',
      
      // Other genres
      'jazz': 'jazz',
      'blues': 'blues',
      'country': 'country',
      'folk': 'folk',
      'reggae': 'reggae',
      'funk': 'funk',
      'disco': 'disco',
      'ballad': 'ballad',
      'latin': 'latin',
      'spanish': 'spanish pop'
    };

    // Find the most relevant genre based on tag popularity
    let bestGenre = null;
    let bestScore = 0;

    for (const tag of allTags) {
      const genre = tagToGenreMap[tag.name.toLowerCase()];
      if (genre && tag.count > bestScore) {
        bestGenre = genre;
        bestScore = tag.count;
      }
    }

    return bestGenre;
  }

  async enrichTrackData(artist: string, track: string): Promise<MusicData> {
    // Priority 1: Try Free Official APIs (AudioDB, iTunes, Deezer, etc.)
    try {
      console.log(`🎯 Trying Free Official APIs for: ${artist} - ${track}`);
      const freeData = await freeApiService.getFreeApiData(artist, track);
      
      if (freeData && !freeData.error && (freeData.bpm || freeData.key || freeData.genre)) {
        // We have data from free APIs
        const result: MusicData = {
          bpm: freeData.bpm,
          key: freeData.key,
          energy: freeData.energy,
          danceability: freeData.danceability,
          valence: freeData.valence,
          confidence: freeData.confidence,
          source: freeData.source as any
        };

        // If we have BPM from Deezer, that's great! Otherwise, continue to try other sources
        if (freeData.bpm) {
          console.log(`✅ Using Free API data for "${track}" by ${artist}:`, result);
          return result;
        } else {
          // Store the partial data and try to get BPM from other sources
          console.log(`📊 Got partial data from Free APIs, trying other sources for BPM...`);
        }
      }
    } catch (error) {
      console.warn(`Free API Service failed for ${artist} - ${track}:`, error);
    }

    // Priority 2: Try GetSongBPM/GetSongKey for precise data
    try {
      console.log(`🎯 Trying GetSongBPM/GetSongKey for: ${artist} - ${track}`);
      const preciseData = await songAnalysisService.getPreciseAnalysis(artist, track);
      
      if (preciseData && !preciseData.error && (preciseData.bpm || preciseData.key)) {
        // We have precise data from specialized APIs
        const result: MusicData = {
          bpm: preciseData.bpm,
          key: preciseData.key,
          confidence: preciseData.confidence,
          source: preciseData.source as any
        };

        console.log(`✅ Using GetSongBPM/GetSongKey data for "${track}" by ${artist}:`, result);
        return result;
      }
    } catch (error) {
      console.warn(`GetSongBPM/GetSongKey failed for ${artist} - ${track}:`, error);
    }

    // Priority 3: Try MusicBrainz/AcousticBrainz for precise data
    try {
      console.log(`🎯 Trying MusicBrainz/AcousticBrainz for: ${artist} - ${track}`);
      const musicBrainzData = await musicBrainzService.getEnhancedMusicData(artist, track);
      
      if (musicBrainzData && (musicBrainzData.bpm || musicBrainzData.key)) {
        // We have good data from AcousticBrainz
        const result: MusicData = {
          bpm: musicBrainzData.bpm,
          key: musicBrainzData.key,
          energy: musicBrainzData.energy,
          danceability: musicBrainzData.danceability,
          valence: musicBrainzData.valence,
          confidence: musicBrainzData.confidence,
          source: 'acousticbrainz'
        };

        console.log(`✅ Using AcousticBrainz data for "${track}" by ${artist}:`, result);
        return result;
      }
    } catch (error) {
      console.warn(`MusicBrainz/AcousticBrainz failed for ${artist} - ${track}:`, error);
    }

    // Priority 4: Fallback to LastFM + local estimation  
    console.log(`🔄 Falling back to LastFM + estimation for: ${artist} - ${track}`);
    
    const result: MusicData = { source: 'lastfm' };
    let genre = null;
    let lastfmTrack: LastFMTrackInfo | null = null;
    let lastfmArtist: { tags: Array<{ name: string; count: number }> } | null = null;

    try {
      // Get track and artist info from LastFM in parallel
      const [trackInfoPromise, artistInfoPromise] = await Promise.allSettled([
        this.getLastFMTrackInfo(artist, track),
        this.getLastFMArtistInfo(artist)
      ]);

      if (trackInfoPromise.status === 'fulfilled') {
        lastfmTrack = trackInfoPromise.value;
      }
      if (artistInfoPromise.status === 'fulfilled') {
        lastfmArtist = artistInfoPromise.value;
      }

      // Try to detect genre from LastFM data
      if (lastfmTrack || lastfmArtist) {
        genre = this.detectGenreFromLastFM(lastfmTrack || { name: track, artist, tags: [] }, lastfmArtist);
      }
    } catch (error) {
      console.warn(`Error getting LastFM data for ${artist} - ${track}:`, error);
    }

    // Priority 5: Fallback to local genre detection
    if (!genre) {
      genre = this.detectGenreFromArtist(artist);
      if (!genre) {
        genre = this.detectGenreFromTitle(track);
      }
      result.source = 'estimation';
    }
    
    // Default to pop if no genre detected
    if (!genre) {
      genre = 'pop';
      result.source = 'estimation';
    }

    // Get BPM based on genre
    const bpmRange = this.genreBPMMap[genre];
    if (bpmRange) {
      // Use consistent randomization within genre range
      result.bpm = this.getConsistentRandom(artist, track, bpmRange.min, bpmRange.max);
    }

    // Get key based on genre
    const possibleKeys = this.genreKeyMap[genre];
    if (possibleKeys) {
      const keyIndex = this.hashString(artist + track) % possibleKeys.length;
      result.key = possibleKeys[keyIndex];
    }

    // Estimate energy based on genre
    const energyMap: { [key: string]: number } = {
      'metal': 0.9,
      'punk': 0.9,
      'dance': 0.8,
      'electronic': 0.8,
      'rock': 0.7,
      'pop': 0.6,
      'hip hop': 0.6,
      'alternative': 0.6,
      'grunge': 0.7,
      'spanish rock': 0.7,
      'folk': 0.4,
      'ballad': 0.3,
      'latin ballad': 0.3,
      'blues': 0.4,
      'jazz': 0.5,
    };
    
    result.energy = energyMap[genre] || 0.6;
    
    // Estimate valence (positivity) based on genre and title
    let valence = 0.5; // Default neutral
    const titleLower = track.toLowerCase();
    
    if (titleLower.includes('happy') || titleLower.includes('love') || 
        titleLower.includes('party') || titleLower.includes('dance')) {
      valence = 0.8;
    } else if (titleLower.includes('sad') || titleLower.includes('cry') || 
               titleLower.includes('break') || titleLower.includes('hurt')) {
      valence = 0.2;
    } else if (genre === 'dance' || genre === 'pop') {
      valence = 0.7;
    } else if (genre === 'ballad' || genre === 'blues') {
      valence = 0.3;
    }
    
    result.valence = valence;

    // Add additional LastFM-based data to result
    const additionalInfo: any = {};
    if (lastfmTrack?.playcount) {
      additionalInfo.playcount = lastfmTrack.playcount;
    }
    if (lastfmTrack?.listeners) {
      additionalInfo.listeners = lastfmTrack.listeners;
    }

    console.log(`🎵 Generated enhanced data for "${track}" by ${artist}:`, {
      source: result.source,
      genre,
      bpm: result.bpm,
      key: result.key,
      energy: result.energy,
      valence: result.valence,
      confidence: result.confidence,
      ...additionalInfo
    });

    return result;
  }
}

export const musicDataService = new MusicDataService();