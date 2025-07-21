// MusicBrainz + AcousticBrainz service for precise music analysis
// MusicBrainz: Open music database for track identification
// AcousticBrainz: Real audio analysis (BPM, key, energy, etc.)

export interface MusicBrainzTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  length?: number; // in milliseconds
  score?: number; // matching confidence
}

export interface AcousticBrainzData {
  bpm?: number;
  key?: string;
  energy?: number;
  danceability?: number;
  valence?: number;
  acousticness?: number;
  instrumentalness?: number;
  liveness?: number;
  speechiness?: number;
  tempo_confidence?: number;
  key_confidence?: number;
}

export interface EnhancedMusicData {
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
  source: 'acousticbrainz' | 'lastfm' | 'estimation';
}

class MusicBrainzService {
  private readonly MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
  private readonly ACOUSTICBRAINZ_BASE_URL = 'https://acousticbrainz.org/api/v1';
  
  // Rate limiting: MusicBrainz allows 1 request per second
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second

  private async rateLimitedFetch(url: string): Promise<Response> {
    const now = Date.now();
    const timeToWait = this.MIN_REQUEST_INTERVAL - (now - this.lastRequestTime);
    
    if (timeToWait > 0) {
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    
    this.lastRequestTime = Date.now();
    
    return fetch(url, {
      headers: {
        'User-Agent': 'BandPlan/1.0 ( https://bandplan.netlify.app )'
      }
    });
  }

  // Search for track in MusicBrainz database
  async searchTrack(artist: string, track: string): Promise<MusicBrainzTrack[]> {
    try {
      // Clean and format search query
      const cleanArtist = artist.replace(/[^\w\s]/g, '').trim();
      const cleanTrack = track.replace(/[^\w\s]/g, '').trim();
      
      const query = `artist:"${cleanArtist}" AND recording:"${cleanTrack}"`;
      const encodedQuery = encodeURIComponent(query);
      
      const url = `${this.MUSICBRAINZ_BASE_URL}/recording?query=${encodedQuery}&fmt=json&limit=5`;
      
      console.log(`🔍 Searching MusicBrainz for: ${artist} - ${track}`);
      
      const response = await this.rateLimitedFetch(url);
      
      if (!response.ok) {
        console.warn(`MusicBrainz search failed: ${response.status}`);
        return [];
      }

      const data = await response.json();
      
      if (!data.recordings || data.recordings.length === 0) {
        console.log(`🔍 No recordings found in MusicBrainz for: ${artist} - ${track}`);
        return [];
      }

      const tracks: MusicBrainzTrack[] = data.recordings.map((recording: any) => ({
        id: recording.id,
        title: recording.title,
        artist: recording['artist-credit']?.[0]?.name || artist,
        album: recording.releases?.[0]?.title,
        length: recording.length,
        score: recording.score
      }));

      console.log(`✅ Found ${tracks.length} MusicBrainz matches for: ${artist} - ${track}`);
      return tracks.sort((a, b) => (b.score || 0) - (a.score || 0)); // Sort by confidence

    } catch (error) {
      console.warn(`Error searching MusicBrainz for ${artist} - ${track}:`, error);
      return [];
    }
  }

  // Get audio analysis from AcousticBrainz
  async getAudioAnalysis(musicbrainzId: string): Promise<AcousticBrainzData | null> {
    try {
      // Try high-level data first (more processed, easier to use)
      const highLevelUrl = `${this.ACOUSTICBRAINZ_BASE_URL}/${musicbrainzId}/high-level`;
      
      console.log(`🎵 Getting AcousticBrainz analysis for ID: ${musicbrainzId}`);
      
      let response = await fetch(highLevelUrl);
      
      if (response.ok) {
        const highLevelData = await response.json();
        
        // Also get low-level data for more technical details
        const lowLevelUrl = `${this.ACOUSTICBRAINZ_BASE_URL}/${musicbrainzId}/low-level`;
        const lowLevelResponse = await fetch(lowLevelUrl);
        
        let lowLevelData = null;
        if (lowLevelResponse.ok) {
          lowLevelData = await lowLevelResponse.json();
        }

        return this.processAcousticBrainzData(highLevelData, lowLevelData);
      } else {
        console.warn(`AcousticBrainz analysis not found for ID: ${musicbrainzId}`);
        return null;
      }
    } catch (error) {
      console.warn(`Error getting AcousticBrainz analysis for ${musicbrainzId}:`, error);
      return null;
    }
  }

  // Process AcousticBrainz data into our format
  private processAcousticBrainzData(highLevel: any, lowLevel: any): AcousticBrainzData {
    const result: AcousticBrainzData = {};

    try {
      // Extract BPM from low-level data (most accurate)
      if (lowLevel?.rhythm?.bpm) {
        result.bpm = Math.round(lowLevel.rhythm.bpm);
        result.tempo_confidence = lowLevel.rhythm.bpm_confidence || 0;
      }

      // Extract key from low-level data  
      if (lowLevel?.tonal?.key_key !== undefined && lowLevel?.tonal?.key_scale !== undefined) {
        const keyNumber = lowLevel.tonal.key_key;
        const scale = lowLevel.tonal.key_scale; // 0 = minor, 1 = major
        
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const keyName = keys[keyNumber];
        
        if (keyName) {
          result.key = scale === 0 ? `${keyName}m` : keyName;
          result.key_confidence = lowLevel.tonal.key_strength || 0;
        }
      }

      // Extract energy and other features from high-level data
      if (highLevel) {
        if (highLevel.mood_happy?.all?.happy) {
          result.valence = highLevel.mood_happy.all.happy;
        }
        
        if (highLevel.danceability?.all?.danceable) {
          result.danceability = highLevel.danceability.all.danceable;
        }

        if (highLevel.mood_aggressive?.all?.aggressive) {
          // Map aggressiveness to energy (rough approximation)
          result.energy = highLevel.mood_aggressive.all.aggressive;
        }

        if (highLevel.voice_instrumental?.all?.instrumental) {
          result.instrumentalness = highLevel.voice_instrumental.all.instrumental;
        }
      }

      // Extract additional features from low-level if available
      if (lowLevel?.highlevel) {
        // Sometimes AcousticBrainz has different structure
        const hl = lowLevel.highlevel;
        
        if (hl.mood_happy?.value) {
          result.valence = result.valence || parseFloat(hl.mood_happy.value);
        }
        
        if (hl.danceability?.value) {
          result.danceability = result.danceability || parseFloat(hl.danceability.value);
        }
      }

    } catch (error) {
      console.warn('Error processing AcousticBrainz data:', error);
    }

    return result;
  }

  // Main method to get enhanced music data
  async getEnhancedMusicData(artist: string, track: string): Promise<EnhancedMusicData | null> {
    try {
      // Step 1: Search for track in MusicBrainz
      const musicBrainzTracks = await this.searchTrack(artist, track);
      
      if (musicBrainzTracks.length === 0) {
        console.log(`❌ No MusicBrainz match found for: ${artist} - ${track}`);
        return null;
      }

      // Step 2: Try to get audio analysis for the best match
      const bestMatch = musicBrainzTracks[0];
      console.log(`🎯 Best MusicBrainz match: ${bestMatch.artist} - ${bestMatch.title} (score: ${bestMatch.score})`);
      
      const acousticData = await this.getAudioAnalysis(bestMatch.id);
      
      if (!acousticData || (!acousticData.bpm && !acousticData.key)) {
        console.log(`❌ No AcousticBrainz data found for: ${bestMatch.id}`);
        return null;
      }

      // Step 3: Build enhanced data
      const enhancedData: EnhancedMusicData = {
        bpm: acousticData.bpm,
        key: acousticData.key,
        energy: acousticData.energy,
        danceability: acousticData.danceability,
        valence: acousticData.valence,
        confidence: {
          tempo: acousticData.tempo_confidence,
          key: acousticData.key_confidence,
          overall: bestMatch.score ? bestMatch.score / 100 : 0.5
        },
        source: 'acousticbrainz'
      };

      console.log(`✅ AcousticBrainz analysis for "${track}" by ${artist}:`, {
        bpm: enhancedData.bpm,
        key: enhancedData.key,
        energy: enhancedData.energy,
        confidence: enhancedData.confidence
      });

      return enhancedData;

    } catch (error) {
      console.warn(`Error getting enhanced music data for ${artist} - ${track}:`, error);
      return null;
    }
  }
}

export const musicBrainzService = new MusicBrainzService();