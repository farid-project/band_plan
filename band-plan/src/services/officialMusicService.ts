// Official GetSongBPM and GetSongKey API service
// Uses official APIs with proper authentication and backlinks

export interface OfficialMusicData {
  bpm?: number;
  key?: string;
  tempo?: number;
  confidence?: {
    bpm?: number;
    key?: number;
  };
  source: 'getsongbpm_api' | 'getsongkey_api' | 'combined';
  error?: string;
}

class OfficialMusicService {
  // GetSongBPM Official API
  private readonly GETSONGBPM_API_BASE = 'https://api.getsongbpm.com/search/';
  private readonly GETSONGBPM_API_KEY = import.meta.env.VITE_GETSONGBPM_API_KEY;
  
  // GetSongKey Official API  
  private readonly GETSONGKEY_API_BASE = 'https://api.getsongkey.com/search/';
  private readonly GETSONGKEY_API_KEY = import.meta.env.VITE_GETSONGKEY_API_KEY;

  // Cache for API responses
  private cache = new Map<string, OfficialMusicData>();

  // Official GetSongBPM API call
  async getBPMFromAPI(artist: string, track: string): Promise<{ bpm: number; confidence: number } | null> {
    try {
      if (!this.GETSONGBPM_API_KEY || this.GETSONGBPM_API_KEY === 'your_getsongbpm_api_key_here') {
        console.warn('🎵 GetSongBPM API key not configured');
        return null;
      }

      console.log(`🎵 ===== GETSONGBPM OFFICIAL API CALL =====`);
      console.log(`🎵 Artist: "${artist}"`);
      console.log(`🎵 Track: "${track}"`);

      // Clean search terms
      const cleanArtist = this.cleanSearchTerm(artist);
      const cleanTrack = this.cleanSearchTerm(track);
      
      console.log(`🎵 Cleaned - Artist: "${cleanArtist}", Track: "${cleanTrack}"`);

      // Build API request
      const params = new URLSearchParams({
        api_key: this.GETSONGBPM_API_KEY,
        type: 'both', // Search both song and artist
        lookup: `song:${cleanTrack} artist:${cleanArtist}`
      });

      const apiUrl = `${this.GETSONGBPM_API_BASE}?${params.toString()}`;
      
      console.log(`🎵 API URL: ${apiUrl}`);
      console.log(`🎵 Request method: GET`);
      console.log(`🎵 API Key (masked): ${this.GETSONGBPM_API_KEY.substring(0, 8)}...`);

      const startTime = Date.now();
      const response = await fetch(apiUrl);
      const endTime = Date.now();

      console.log(`🎵 ===== API RESPONSE =====`);
      console.log(`🎵 Response time: ${endTime - startTime}ms`);
      console.log(`🎵 Status: ${response.status} ${response.statusText}`);
      console.log(`🎵 Headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error(`🎵 GetSongBPM API error: ${response.status} ${response.statusText}`);
        
        // Try to get error details
        try {
          const errorText = await response.text();
          console.error(`🎵 Error response body:`, errorText);
        } catch (e) {
          console.error(`🎵 Could not read error response`);
        }
        
        return null;
      }

      const data = await response.json();
      console.log(`🎵 ===== API RESPONSE DATA =====`);
      console.log(`🎵 Response data:`, data);
      console.log(`🎵 Data keys:`, Object.keys(data));

      if (data.search && data.search.length > 0) {
        console.log(`🎵 Found ${data.search.length} results`);
        
        // Find best match
        const bestMatch = this.findBestMatch(data.search, cleanArtist, cleanTrack);
        
        if (bestMatch && bestMatch.tempo) {
          const bpm = parseInt(bestMatch.tempo);
          const confidence = this.calculateConfidence(bestMatch, cleanArtist, cleanTrack);
          
          console.log(`🎵 ✅ SUCCESS: Found BPM ${bpm} with confidence ${confidence}`);
          console.log(`🎵 Best match:`, bestMatch);
          
          return {
            bpm: bpm,
            confidence: confidence
          };
        } else {
          console.log(`🎵 ❌ No valid BPM data in results`);
          data.search.forEach((result, index) => {
            console.log(`🎵 Result ${index + 1}:`, result);
          });
        }
      } else {
        console.log(`🎵 ❌ No search results returned`);
      }

      return null;

    } catch (error) {
      console.error(`🎵 GetSongBPM API error:`, error);
      return null;
    }
  }

  // Official GetSongKey API call
  async getKeyFromAPI(artist: string, track: string): Promise<{ key: string; confidence: number } | null> {
    try {
      if (!this.GETSONGKEY_API_KEY || this.GETSONGKEY_API_KEY === 'your_getsongkey_api_key_here') {
        console.warn('🔑 GetSongKey API key not configured');
        return null;
      }

      console.log(`🔑 ===== GETSONGKEY OFFICIAL API CALL =====`);
      console.log(`🔑 Artist: "${artist}"`);
      console.log(`🔑 Track: "${track}"`);

      // Clean search terms
      const cleanArtist = this.cleanSearchTerm(artist);
      const cleanTrack = this.cleanSearchTerm(track);
      
      console.log(`🔑 Cleaned - Artist: "${cleanArtist}", Track: "${cleanTrack}"`);

      // Build API request
      const params = new URLSearchParams({
        api_key: this.GETSONGKEY_API_KEY,
        type: 'both', // Search both song and artist
        lookup: `song:${cleanTrack} artist:${cleanArtist}`
      });

      const apiUrl = `${this.GETSONGKEY_API_BASE}?${params.toString()}`;
      
      console.log(`🔑 API URL: ${apiUrl}`);
      console.log(`🔑 Request method: GET`);
      console.log(`🔑 API Key (masked): ${this.GETSONGKEY_API_KEY.substring(0, 8)}...`);

      const startTime = Date.now();
      const response = await fetch(apiUrl);
      const endTime = Date.now();

      console.log(`🔑 ===== API RESPONSE =====`);
      console.log(`🔑 Response time: ${endTime - startTime}ms`);
      console.log(`🔑 Status: ${response.status} ${response.statusText}`);
      console.log(`🔑 Headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error(`🔑 GetSongKey API error: ${response.status} ${response.statusText}`);
        
        // Try to get error details
        try {
          const errorText = await response.text();
          console.error(`🔑 Error response body:`, errorText);
        } catch (e) {
          console.error(`🔑 Could not read error response`);
        }
        
        return null;
      }

      const data = await response.json();
      console.log(`🔑 ===== API RESPONSE DATA =====`);
      console.log(`🔑 Response data:`, data);
      console.log(`🔑 Data keys:`, Object.keys(data));

      if (data.search && data.search.length > 0) {
        console.log(`🔑 Found ${data.search.length} results`);
        
        // Find best match
        const bestMatch = this.findBestMatch(data.search, cleanArtist, cleanTrack);
        
        if (bestMatch && bestMatch.key) {
          const key = this.normalizeKey(bestMatch.key);
          const confidence = this.calculateConfidence(bestMatch, cleanArtist, cleanTrack);
          
          console.log(`🔑 ✅ SUCCESS: Found key ${key} with confidence ${confidence}`);
          console.log(`🔑 Best match:`, bestMatch);
          
          return {
            key: key,
            confidence: confidence
          };
        } else {
          console.log(`🔑 ❌ No valid key data in results`);
          data.search.forEach((result, index) => {
            console.log(`🔑 Result ${index + 1}:`, result);
          });
        }
      } else {
        console.log(`🔑 ❌ No search results returned`);
      }

      return null;

    } catch (error) {
      console.error(`🔑 GetSongKey API error:`, error);
      return null;
    }
  }

  // Main method to get official API data
  async getOfficialData(artist: string, track: string): Promise<OfficialMusicData> {
    try {
      const cacheKey = `official-${artist}-${track}`;
      
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        console.log(`📦 Using cached official data for: ${artist} - ${track}`);
        return cached;
      }

      console.log(`🚀 Getting official API data for: ${artist} - ${track}`);

      // Call both APIs in parallel
      const [bpmResult, keyResult] = await Promise.allSettled([
        this.getBPMFromAPI(artist, track),
        this.getKeyFromAPI(artist, track)
      ]);

      let result: OfficialMusicData = {
        source: 'combined'
      };

      // Process BPM result
      if (bpmResult.status === 'fulfilled' && bpmResult.value) {
        result.bpm = bpmResult.value.bpm;
        result.tempo = bpmResult.value.bpm; // Alias
        result.confidence = {
          ...result.confidence,
          bpm: bpmResult.value.confidence
        };
        result.source = result.source === 'combined' ? 'getsongbpm_api' : 'combined';
      }

      // Process Key result
      if (keyResult.status === 'fulfilled' && keyResult.value) {
        result.key = keyResult.value.key;
        result.confidence = {
          ...result.confidence,
          key: keyResult.value.confidence
        };
        result.source = result.source === 'getsongbpm_api' ? 'combined' : 
                       result.source === 'combined' ? 'getsongkey_api' : 'combined';
      }

      // Cache if we got any data
      if (result.bpm || result.key) {
        this.cache.set(cacheKey, result);
        console.log(`✅ Official API analysis complete for "${track}" by ${artist}:`, result);
      } else {
        result.error = 'No data found from official APIs';
        console.log(`❌ No official API data found for "${track}" by ${artist}`);
      }

      return result;

    } catch (error) {
      console.error(`Error in official API analysis for ${artist} - ${track}:`, error);
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

  private findBestMatch(results: any[], targetArtist: string, targetTrack: string): any | null {
    if (!results || results.length === 0) return null;
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const result of results) {
      const score = this.calculateMatchScore(result, targetArtist, targetTrack);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = result;
      }
    }
    
    return bestScore > 0.5 ? bestMatch : null;
  }

  private calculateMatchScore(result: any, targetArtist: string, targetTrack: string): number {
    const resultArtist = (result.artist || '').toLowerCase();
    const resultTrack = (result.song || result.title || '').toLowerCase();
    const targetArtistLower = targetArtist.toLowerCase();
    const targetTrackLower = targetTrack.toLowerCase();
    
    const artistScore = this.stringSimilarity(resultArtist, targetArtistLower);
    const trackScore = this.stringSimilarity(resultTrack, targetTrackLower);
    
    return (trackScore * 0.6) + (artistScore * 0.4);
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

  private calculateConfidence(match: any, targetArtist: string, targetTrack: string): number {
    const score = this.calculateMatchScore(match, targetArtist, targetTrack);
    return Math.min(score * 0.95, 0.95); // Cap at 95%
  }

  private normalizeKey(key: string): string {
    const cleanKey = key.trim().replace(/\s+/g, ' ');
    
    return cleanKey
      .replace(/major/gi, '')
      .replace(/minor/gi, 'm')
      .replace(/maj/gi, '')
      .replace(/min/gi, 'm')
      .replace(/\s+/g, '')
      .replace(/([A-G][#b]?)\s*m$/i, '$1m')
      .trim();
  }
}

export const officialMusicService = new OfficialMusicService();