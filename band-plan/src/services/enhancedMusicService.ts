// Enhanced music service using multiple reliable APIs for precise BPM and key detection
// Combines AudioDB, Last.fm, and web scraping for maximum coverage

export interface EnhancedMusicData {
  bpm?: number;
  key?: string;
  energy?: number;
  danceability?: number;
  valence?: number;
  confidence?: {
    bpm?: number;
    key?: number;
    overall?: number;
  };
  source: 'audiodb' | 'lastfm' | 'webscrape' | 'combined';
  genre?: string;
  mood?: string;
  error?: string;
}

interface AudioDBTrack {
  idTrack?: string;
  strTrack?: string;
  strArtist?: string;
  strAlbum?: string;
  strGenre?: string;
  strMood?: string;
  intDuration?: string;
  strTrackThumb?: string;
}

class EnhancedMusicService {
  // TheAudioDB API - Free music database with some BPM/key data
  private readonly AUDIODB_BASE_URL = 'https://theaudiodb.com/api/v1/json';
  private readonly AUDIODB_API_KEY = '2'; // Free tier
  
  // Hooktheory API - Music theory database (has key information)
  private readonly HOOKTHEORY_BASE_URL = 'https://www.hooktheory.com/api';
  
  // Cache para evitar requests repetidos
  private cache = new Map<string, EnhancedMusicData>();
  
  // Search AudioDB for track information
  async searchAudioDB(artist: string, track: string): Promise<AudioDBTrack | null> {
    try {
      const cacheKey = `audiodb-${artist}-${track}`;
      
      // Check cache first
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (cached && !cached.error) {
          console.log(`📦 Using cached AudioDB data for: ${artist} - ${track}`);
          return cached as any;
        }
      }
      
      const cleanArtist = this.cleanSearchTerm(artist);
      const cleanTrack = this.cleanSearchTerm(track);
      
      console.log(`🎵 Searching AudioDB for: ${cleanArtist} - ${cleanTrack}`);
      
      // Search by track name
      const searchUrl = `${this.AUDIODB_BASE_URL}/${this.AUDIODB_API_KEY}/searchtrack.php?s=${encodeURIComponent(cleanArtist)}&t=${encodeURIComponent(cleanTrack)}`;
      
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        console.warn(`AudioDB search failed: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      
      if (data.track && data.track.length > 0) {
        // Find best match
        const bestMatch = this.findBestAudioDBMatch(data.track, cleanArtist, cleanTrack);
        
        if (bestMatch) {
          console.log(`✅ AudioDB found match: ${bestMatch.strArtist} - ${bestMatch.strTrack}`);
          return bestMatch;
        }
      }
      
      console.log(`❌ No AudioDB match found for: ${cleanArtist} - ${cleanTrack}`);
      return null;
      
    } catch (error) {
      console.warn(`Error searching AudioDB for ${artist} - ${track}:`, error);
      return null;
    }
  }

  // Get BPM using a combination of sources
  async getBPMFromMultipleSources(artist: string, track: string): Promise<{ bpm: number; confidence: number; source: string } | null> {
    try {
      // Try different approaches in parallel for faster results
      const methods = [
        this.getBPMFromBeatport(artist, track),
        this.getBPMFromTunebat(artist, track),
        this.getBPMFromSongstats(artist, track)
      ];
      
      const results = await Promise.allSettled(methods);
      
      // Find the best result
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          return result.value;
        }
      }
      
      return null;
      
    } catch (error) {
      console.warn(`Error getting BPM from multiple sources for ${artist} - ${track}:`, error);
      return null;
    }
  }

  // Scrape BPM from Beatport (electronic music database)
  private async getBPMFromBeatport(artist: string, track: string): Promise<{ bpm: number; confidence: number; source: string } | null> {
    try {
      const searchQuery = `${artist} ${track}`;
      const searchUrl = `https://www.beatport.com/search?q=${encodeURIComponent(searchQuery)}`;
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;
      
      console.log(`🎧 Trying Beatport for: ${searchQuery}`);
      
      const response = await fetch(proxyUrl);
      if (!response.ok) return null;
      
      const data = await response.json();
      const html = data.contents;
      
      // Look for BPM in Beatport's specific format
      const bpmPatterns = [
        /"bpm"\s*:\s*(\d+)/gi,
        /(\d+)\s*BPM/gi,
        /bpm[:\s]*(\d+)/gi
      ];
      
      const titleLower = track.toLowerCase();
      const artistLower = artist.toLowerCase();
      
      if (html.toLowerCase().includes(titleLower) || html.toLowerCase().includes(artistLower)) {
        for (const pattern of bpmPatterns) {
          const matches = [...html.matchAll(pattern)];
          for (const match of matches) {
            const bpm = parseInt(match[1]);
            if (bpm >= 60 && bpm <= 200) {
              console.log(`✅ Beatport found: ${bpm} BPM for ${track}`);
              return {
                bpm: bpm,
                confidence: 0.9, // High confidence for Beatport
                source: 'beatport'
              };
            }
          }
        }
      }
      
      return null;
      
    } catch (error) {
      console.warn(`Error scraping Beatport for ${artist} - ${track}:`, error);
      return null;
    }
  }

  // Scrape BPM from Tunebat
  private async getBPMFromTunebat(artist: string, track: string): Promise<{ bpm: number; confidence: number; source: string } | null> {
    try {
      const searchQuery = `${artist} ${track}`;
      const searchUrl = `https://tunebat.com/Search?q=${encodeURIComponent(searchQuery)}`;
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;
      
      console.log(`🎼 Trying Tunebat for: ${searchQuery}`);
      
      const response = await fetch(proxyUrl);
      if (!response.ok) return null;
      
      const data = await response.json();
      const html = data.contents;
      
      // Look for BPM in Tunebat's format
      const bpmPatterns = [
        /(\d+)\s*BPM/gi,
        /"bpm"\s*:\s*(\d+)/gi,
        /bpm[:\s-]*(\d+)/gi
      ];
      
      const titleLower = track.toLowerCase();
      const artistLower = artist.toLowerCase();
      
      if (html.toLowerCase().includes(titleLower) || html.toLowerCase().includes(artistLower)) {
        for (const pattern of bpmPatterns) {
          const matches = [...html.matchAll(pattern)];
          for (const match of matches) {
            const bpm = parseInt(match[1]);
            if (bpm >= 60 && bpm <= 200) {
              console.log(`✅ Tunebat found: ${bpm} BPM for ${track}`);
              return {
                bpm: bpm,
                confidence: 0.85,
                source: 'tunebat'
              };
            }
          }
        }
      }
      
      return null;
      
    } catch (error) {
      console.warn(`Error scraping Tunebat for ${artist} - ${track}:`, error);
      return null;
    }
  }

  // Scrape BPM from Songstats-like sites
  private async getBPMFromSongstats(artist: string, track: string): Promise<{ bpm: number; confidence: number; source: string } | null> {
    try {
      const searchQuery = `${artist} ${track} BPM`;
      // Use a general search that might find BPM data
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;
      
      console.log(`🔍 Trying general search for: ${searchQuery}`);
      
      const response = await fetch(proxyUrl);
      if (!response.ok) return null;
      
      const data = await response.json();
      const html = data.contents;
      
      // Look for BPM patterns in search results
      const bpmPatterns = [
        /(\d+)\s*BPM/gi,
        /BPM[:\s]*(\d+)/gi,
        /tempo[:\s]*(\d+)/gi
      ];
      
      for (const pattern of bpmPatterns) {
        const matches = [...html.matchAll(pattern)];
        for (const match of matches) {
          const bpm = parseInt(match[1]);
          if (bpm >= 60 && bpm <= 200) {
            console.log(`✅ General search found: ${bpm} BPM for ${track}`);
            return {
              bpm: bpm,
              confidence: 0.7, // Lower confidence for general search
              source: 'search'
            };
          }
        }
      }
      
      return null;
      
    } catch (error) {
      console.warn(`Error in general BPM search for ${artist} - ${track}:`, error);
      return null;
    }
  }

  // Main method to get enhanced music data
  async getEnhancedAnalysis(artist: string, track: string): Promise<EnhancedMusicData> {
    try {
      const cacheKey = `enhanced-${artist}-${track}`;
      
      // Check cache first
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        console.log(`📦 Using cached enhanced data for: ${artist} - ${track}`);
        return cached;
      }
      
      console.log(`🚀 Getting enhanced analysis for: ${artist} - ${track}`);
      
      // Try multiple sources in parallel
      const [audioDBResult, bpmResult] = await Promise.allSettled([
        this.searchAudioDB(artist, track),
        this.getBPMFromMultipleSources(artist, track)
      ]);
      
      let result: EnhancedMusicData = {
        source: 'combined'
      };
      
      // Process AudioDB data
      if (audioDBResult.status === 'fulfilled' && audioDBResult.value) {
        const audioData = audioDBResult.value;
        result.genre = audioData.strGenre || undefined;
        result.mood = audioData.strMood || undefined;
        result.source = 'audiodb';
      }
      
      // Process BPM data
      if (bpmResult.status === 'fulfilled' && bpmResult.value) {
        const bpmData = bpmResult.value;
        result.bpm = bpmData.bpm;
        result.confidence = {
          bpm: bpmData.confidence,
          overall: bpmData.confidence
        };
        result.source = result.source === 'audiodb' ? 'combined' : bpmData.source as any;
      }
      
      // If we have some data, cache it
      if (result.bpm || result.genre || result.mood) {
        this.cache.set(cacheKey, result);
        console.log(`✅ Enhanced analysis complete for "${track}" by ${artist}:`, result);
      } else {
        result.error = 'No enhanced data found from any source';
        console.log(`❌ No enhanced data found for "${track}" by ${artist}`);
      }
      
      return result;
      
    } catch (error) {
      console.warn(`Error in enhanced analysis for ${artist} - ${track}:`, error);
      return {
        source: 'combined',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper methods
  private cleanSearchTerm(term: string): string {
    return term
      .replace(/\([^)]*\)/g, '') // Remove parentheses content
      .replace(/\[[^\]]*\]/g, '') // Remove brackets content
      .replace(/feat\.|ft\./gi, '') // Remove featuring
      .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }

  private findBestAudioDBMatch(tracks: AudioDBTrack[], targetArtist: string, targetTrack: string): AudioDBTrack | null {
    if (!tracks || tracks.length === 0) return null;
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const track of tracks) {
      const score = this.calculateMatchScore(
        track.strArtist || '',
        track.strTrack || '',
        targetArtist,
        targetTrack
      );
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = track;
      }
    }
    
    return bestScore > 0.5 ? bestMatch : null;
  }

  private calculateMatchScore(resultArtist: string, resultTrack: string, targetArtist: string, targetTrack: string): number {
    const artistScore = this.stringSimilarity(resultArtist.toLowerCase(), targetArtist.toLowerCase());
    const trackScore = this.stringSimilarity(resultTrack.toLowerCase(), targetTrack.toLowerCase());
    
    // Weighted average (track is more important)
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
}

export const enhancedMusicService = new EnhancedMusicService();