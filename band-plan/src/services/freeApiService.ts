// Free Music APIs service - Only using official free APIs without scraping
// Reliable and stable APIs with official documentation

export interface FreeMusicData {
  bpm?: number;
  key?: string;
  genre?: string;
  energy?: number;
  danceability?: number;
  valence?: number;
  confidence?: {
    bpm?: number;
    key?: number;
    overall?: number;
  };
  source: 'audiodb' | 'musicbrainz' | 'deezer' | 'itunes' | 'genius' | 'combined';
  error?: string;
}

class FreeApiService {
  // TheAudioDB - Completely free music database
  private readonly AUDIODB_BASE_URL = 'https://theaudiodb.com/api/v1/json';
  private readonly AUDIODB_API_KEY = '2'; // Free tier key
  
  // iTunes Search API - Apple's free API
  private readonly ITUNES_BASE_URL = 'https://itunes.apple.com/search';
  
  // Deezer API - Free tier (no auth required for search)
  private readonly DEEZER_BASE_URL = 'https://api.deezer.com';
  
  // Genius API - Free tier with registration
  private readonly GENIUS_BASE_URL = 'https://api.genius.com';
  private readonly GENIUS_ACCESS_TOKEN = import.meta.env.VITE_GENIUS_ACCESS_TOKEN;
  
  // MusicBrainz API - Completely free
  private readonly MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
  
  // Cache to avoid repeated requests
  private cache = new Map<string, FreeMusicData>();

  // Search TheAudioDB for comprehensive track data
  async searchAudioDB(artist: string, track: string): Promise<any | null> {
    try {
      const cacheKey = `audiodb-${artist}-${track}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      console.log(`🎵 Searching AudioDB API for: ${artist} - ${track}`);
      
      const cleanArtist = this.cleanSearchTerm(artist);
      const cleanTrack = this.cleanSearchTerm(track);
      
      const url = `${this.AUDIODB_BASE_URL}/${this.AUDIODB_API_KEY}/searchtrack.php?s=${encodeURIComponent(cleanArtist)}&t=${encodeURIComponent(cleanTrack)}`;
      
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (data.track && data.track.length > 0) {
        const bestMatch = this.findBestMatch(data.track, cleanArtist, cleanTrack, 'strArtist', 'strTrack');
        
        if (bestMatch) {
          console.log(`✅ AudioDB found: ${bestMatch.strArtist} - ${bestMatch.strTrack}`);
          return {
            genre: bestMatch.strGenre,
            mood: bestMatch.strMood,
            style: bestMatch.strStyle,
            source: 'audiodb'
          };
        }
      }
      
      return null;
      
    } catch (error) {
      console.warn(`Error searching AudioDB: ${error}`);
      return null;
    }
  }

  // Search iTunes API for track data
  async searchItunes(artist: string, track: string): Promise<any | null> {
    try {
      console.log(`🍎 Searching iTunes API for: ${artist} - ${track}`);
      
      const query = `${artist} ${track}`;
      const url = `${this.ITUNES_BASE_URL}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=10`;
      
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const bestMatch = this.findBestMatch(data.results, artist, track, 'artistName', 'trackName');
        
        if (bestMatch) {
          console.log(`✅ iTunes found: ${bestMatch.artistName} - ${bestMatch.trackName}`);
          return {
            genre: bestMatch.primaryGenreName,
            duration: bestMatch.trackTimeMillis,
            preview: bestMatch.previewUrl,
            source: 'itunes'
          };
        }
      }
      
      return null;
      
    } catch (error) {
      console.warn(`Error searching iTunes: ${error}`);
      return null;
    }
  }

  // Search Deezer API for track data (no auth required for search)
  async searchDeezer(artist: string, track: string): Promise<any | null> {
    try {
      console.log(`🎧 Searching Deezer API for: ${artist} - ${track}`);
      
      const query = `artist:"${artist}" track:"${track}"`;
      const url = `${this.DEEZER_BASE_URL}/search?q=${encodeURIComponent(query)}&limit=10`;
      
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const bestMatch = this.findBestMatch(data.data, artist, track, 'artist.name', 'title');
        
        if (bestMatch) {
          console.log(`✅ Deezer found: ${bestMatch.artist?.name} - ${bestMatch.title}`);
          
          // Try to get album info for more details
          let albumData = null;
          if (bestMatch.album?.id) {
            try {
              const albumResponse = await fetch(`${this.DEEZER_BASE_URL}/album/${bestMatch.album.id}`);
              if (albumResponse.ok) {
                albumData = await albumResponse.json();
              }
            } catch (e) {
              console.warn('Error fetching Deezer album data:', e);
            }
          }
          
          return {
            duration: bestMatch.duration,
            bpm: bestMatch.bpm || null, // Deezer sometimes has BPM data
            genre: albumData?.genres?.data?.[0]?.name || null,
            preview: bestMatch.preview,
            source: 'deezer'
          };
        }
      }
      
      return null;
      
    } catch (error) {
      console.warn(`Error searching Deezer: ${error}`);
      return null;
    }
  }

  // Search MusicBrainz for detailed metadata
  async searchMusicBrainz(artist: string, track: string): Promise<any | null> {
    try {
      console.log(`🎼 Searching MusicBrainz API for: ${artist} - ${track}`);
      
      // Rate limiting - MusicBrainz requires max 1 request per second
      await this.sleep(1000);
      
      const query = `artist:"${artist}" AND recording:"${track}"`;
      const url = `${this.MUSICBRAINZ_BASE_URL}/recording?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'BandPlan/1.0 ( https://bandplan.netlify.app )'
        }
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (data.recordings && data.recordings.length > 0) {
        const bestMatch = data.recordings[0]; // MusicBrainz returns sorted by relevance
        
        console.log(`✅ MusicBrainz found: ${bestMatch.title}`);
        
        return {
          id: bestMatch.id,
          title: bestMatch.title,
          length: bestMatch.length,
          tags: bestMatch.tags || [],
          source: 'musicbrainz'
        };
      }
      
      return null;
      
    } catch (error) {
      console.warn(`Error searching MusicBrainz: ${error}`);
      return null;
    }
  }

  // Search Genius API for track metadata (if token available)
  async searchGenius(artist: string, track: string): Promise<any | null> {
    try {
      if (!this.GENIUS_ACCESS_TOKEN || this.GENIUS_ACCESS_TOKEN === 'your_genius_token') {
        return null;
      }

      console.log(`🧠 Searching Genius API for: ${artist} - ${track}`);
      
      const query = `${artist} ${track}`;
      const url = `${this.GENIUS_BASE_URL}/search?q=${encodeURIComponent(query)}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.GENIUS_ACCESS_TOKEN}`
        }
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (data.response?.hits && data.response.hits.length > 0) {
        const bestMatch = data.response.hits[0].result;
        
        if (bestMatch) {
          console.log(`✅ Genius found: ${bestMatch.full_title}`);
          return {
            title: bestMatch.title,
            artist: bestMatch.primary_artist?.name,
            lyrics_url: bestMatch.url,
            stats: bestMatch.stats,
            source: 'genius'
          };
        }
      }
      
      return null;
      
    } catch (error) {
      console.warn(`Error searching Genius: ${error}`);
      return null;
    }
  }

  // Main method to get comprehensive free API data
  async getFreeApiData(artist: string, track: string): Promise<FreeMusicData> {
    try {
      const cacheKey = `free-${artist}-${track}`;
      
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        console.log(`📦 Using cached free API data for: ${artist} - ${track}`);
        return cached;
      }
      
      console.log(`🚀 Getting free API data for: ${artist} - ${track}`);
      
      // Search multiple APIs in parallel (with some delay for MusicBrainz)
      const [audioDbResult, itunesResult, deezerResult] = await Promise.allSettled([
        this.searchAudioDB(artist, track),
        this.searchItunes(artist, track),
        this.searchDeezer(artist, track)
      ]);
      
      // Search MusicBrainz separately due to rate limiting
      const musicBrainzResult = await Promise.allSettled([
        this.searchMusicBrainz(artist, track)
      ]);
      
      // Search Genius if token is available
      const geniusResult = await Promise.allSettled([
        this.searchGenius(artist, track)
      ]);
      
      let result: FreeMusicData = {
        source: 'combined'
      };
      
      let sources = [];
      
      // Process AudioDB data
      if (audioDbResult.status === 'fulfilled' && audioDbResult.value) {
        const data = audioDbResult.value;
        if (data.genre) result.genre = data.genre;
        sources.push('audiodb');
      }
      
      // Process iTunes data
      if (itunesResult.status === 'fulfilled' && itunesResult.value) {
        const data = itunesResult.value;
        if (data.genre && !result.genre) result.genre = data.genre;
        sources.push('itunes');
      }
      
      // Process Deezer data (may have BPM!)
      if (deezerResult.status === 'fulfilled' && deezerResult.value) {
        const data = deezerResult.value;
        if (data.bpm) {
          result.bpm = data.bpm;
          result.confidence = {
            bpm: 0.9, // High confidence for Deezer BPM data
            overall: 0.9
          };
        }
        if (data.genre && !result.genre) result.genre = data.genre;
        sources.push('deezer');
      }
      
      // Process MusicBrainz data
      if (musicBrainzResult[0].status === 'fulfilled' && musicBrainzResult[0].value) {
        sources.push('musicbrainz');
      }
      
      // Process Genius data
      if (geniusResult[0].status === 'fulfilled' && geniusResult[0].value) {
        sources.push('genius');
      }
      
      // Set source based on what we found
      if (sources.length > 1) {
        result.source = 'combined';
      } else if (sources.length === 1) {
        result.source = sources[0] as any;
      }
      
      // Cache result if we found anything useful
      if (result.bpm || result.genre || sources.length > 0) {
        this.cache.set(cacheKey, result);
        console.log(`✅ Free API analysis complete for "${track}" by ${artist}:`, {
          ...result,
          sourcesUsed: sources
        });
      } else {
        result.error = 'No data found from free APIs';
        console.log(`❌ No free API data found for "${track}" by ${artist}`);
      }
      
      return result;
      
    } catch (error) {
      console.warn(`Error in free API analysis for ${artist} - ${track}:`, error);
      return {
        source: 'combined',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper methods
  private cleanSearchTerm(term: string): string {
    return term
      .replace(/\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/feat\.|ft\./gi, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private findBestMatch(results: any[], targetArtist: string, targetTrack: string, artistField: string, trackField: string): any | null {
    if (!results || results.length === 0) return null;
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const result of results) {
      const resultArtist = this.getNestedValue(result, artistField) || '';
      const resultTrack = this.getNestedValue(result, trackField) || '';
      
      const score = this.calculateMatchScore(resultArtist, resultTrack, targetArtist, targetTrack);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = result;
      }
    }
    
    return bestScore > 0.5 ? bestMatch : null;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, p) => o && o[p], obj);
  }

  private calculateMatchScore(resultArtist: string, resultTrack: string, targetArtist: string, targetTrack: string): number {
    const artistScore = this.stringSimilarity(resultArtist.toLowerCase(), targetArtist.toLowerCase());
    const trackScore = this.stringSimilarity(resultTrack.toLowerCase(), targetTrack.toLowerCase());
    
    return (trackScore * 0.7) + (artistScore * 0.3);
  }

  private stringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    if (str1.includes(str2) || str2.includes(str1)) return 0.8;
    
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    let commonWords = 0;
    
    for (const word1 of words1) {
      if (words2.some(word2 => word1.includes(word2) || word2.includes(word1))) {
        commonWords++;
      }
    }
    
    return commonWords / Math.max(words1.length, words2.length);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const freeApiService = new FreeApiService();