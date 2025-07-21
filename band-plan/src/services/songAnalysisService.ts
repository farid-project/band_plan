// Specialized music analysis service using GetSongBPM and GetSongKey APIs
// These APIs are designed specifically for precise BPM and key detection

export interface PreciseMusicData {
  bpm?: number;
  key?: string;
  confidence?: {
    bpm?: number;
    key?: number;
  };
  source: 'getsongbpm' | 'getsongkey' | 'combined';
  error?: string;
}

class SongAnalysisService {
  // GetSongBPM.com API
  private readonly GETSONGBPM_BASE_URL = 'https://api.getsongbpm.com';
  
  // GetSongKey.com API  
  private readonly GETSONGKEY_BASE_URL = 'https://api.getsongkey.com';
  
  // Search for BPM using GetSongBPM website scraping
  async getBPMData(artist: string, title: string): Promise<{ bpm: number; confidence: number } | null> {
    try {
      const cleanArtist = this.cleanSearchTerm(artist);
      const cleanTitle = this.cleanSearchTerm(title);
      
      console.log(`🎵 ===== GETSONGBPM DEBUG START =====`);
      console.log(`🎵 Original search: "${artist}" - "${title}"`);
      console.log(`🎵 Cleaned search: "${cleanArtist}" - "${cleanTitle}"`);
      
      // Create search query
      const searchQuery = `${cleanArtist} ${cleanTitle}`;
      const searchUrl = `https://getsongbpm.com/search?q=${encodeURIComponent(searchQuery)}`;
      
      console.log(`🎵 Search query: "${searchQuery}"`);
      console.log(`🎵 GetSongBPM URL: ${searchUrl}`);
      
      // Use CORS proxy to access the website
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;
      
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        console.warn(`GetSongBPM website failed: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      const html = data.contents;
      
      // Parse HTML for BPM data using multiple patterns
      const patterns = [
        /(\d+)\s*BPM/gi,
        /bpm[:\s]*(\d+)/gi,
        /tempo[:\s]*(\d+)/gi,
        /"bpm"\s*:\s*(\d+)/gi
      ];
      
      let bpmFound = null;
      let matchFound = false;
      
      // Look for song match indicators first
      const titleLower = cleanTitle.toLowerCase();
      const artistLower = cleanArtist.toLowerCase();
      
      // Check if the search found relevant results
      if (html.toLowerCase().includes(titleLower) || html.toLowerCase().includes(artistLower)) {
        matchFound = true;
        
        for (const pattern of patterns) {
          const matches = html.matchAll(pattern);
          for (const match of matches) {
            const bpm = parseInt(match[1]);
            if (bpm >= 60 && bpm <= 200) { // Reasonable BPM range
              bpmFound = bpm;
              break;
            }
          }
          if (bpmFound) break;
        }
      }
      
      if (bpmFound && matchFound) {
        console.log(`✅ GetSongBPM website found: ${bpmFound} BPM for "${cleanTitle}" by ${cleanArtist}`);
        return {
          bpm: bpmFound,
          confidence: 0.85 // High confidence for website match
        };
      }
      
      console.log(`❌ No BPM data found on GetSongBPM website for: ${cleanArtist} - ${cleanTitle}`);
      return null;
      
    } catch (error) {
      console.warn(`Error scraping GetSongBPM for ${artist} - ${title}:`, error);
      return null;
    }
  }

  // Search for Key using GetSongKey website scraping
  async getKeyData(artist: string, title: string): Promise<{ key: string; confidence: number } | null> {
    try {
      const cleanArtist = this.cleanSearchTerm(artist);
      const cleanTitle = this.cleanSearchTerm(title);
      
      console.log(`🔑 ===== GETSONGKEY DEBUG START =====`);
      console.log(`🔑 Original search: "${artist}" - "${title}"`);
      console.log(`🔑 Cleaned search: "${cleanArtist}" - "${cleanTitle}"`);
      
      // Create search query
      const searchQuery = `${cleanArtist} ${cleanTitle}`;
      const searchUrl = `https://getsongkey.com/search?q=${encodeURIComponent(searchQuery)}`;
      
      console.log(`🔑 Search query: "${searchQuery}"`);
      console.log(`🔑 GetSongKey URL: ${searchUrl}`);
      
      // Use CORS proxy to access the website
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;
      console.log(`🔑 ===== PROXY CONFIGURATION =====`);
      console.log(`🔑 Target URL (what we want to fetch): ${searchUrl}`);
      console.log(`🔑 Encoded target URL: ${encodeURIComponent(searchUrl)}`);
      console.log(`🔑 Final proxy URL: ${proxyUrl}`);
      console.log(`🔑 Proxy service: api.allorigins.win`);
      console.log(`🔑 Proxy method: GET with url parameter`);
      
      // Create request with custom headers
      const requestOptions = {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      };
      
      console.log(`🔑 ===== REQUEST DETAILS =====`);
      console.log(`🔑 Making fetch request to proxy...`);
      console.log(`🔑 Method: ${requestOptions.method}`);
      console.log(`🔑 URL: ${proxyUrl}`);
      console.log(`🔑 Headers:`, requestOptions.headers);
      console.log(`🔑 Body: (none - GET request)`);
      console.log(`🔑 Request options:`, requestOptions);
      console.log(`🔑 ===== SENDING REQUEST =====`);
      
      const startTime = Date.now();
      const response = await fetch(proxyUrl, requestOptions);
      const endTime = Date.now();
      
      console.log(`🔑 ===== RESPONSE RECEIVED =====`);
      console.log(`🔑 Response time: ${endTime - startTime}ms`);
      console.log(`🔑 Status: ${response.status} ${response.statusText}`);
      console.log(`🔑 Headers:`, Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        console.warn(`🔑 GetSongKey website failed: ${response.status} ${response.statusText}`);
        console.log(`🔑 ===== GETSONGKEY DEBUG END (FAILED) =====`);
        return null;
      }
      
      console.log(`🔑 Response received, parsing JSON...`);
      const data = await response.json();
      console.log(`🔑 ===== PROXY RESPONSE DATA =====`);
      console.log(`🔑 Response object keys:`, Object.keys(data));
      console.log(`🔑 Status field:`, data.status);
      console.log(`🔑 Status code field:`, data.status?.http_code);
      console.log(`🔑 Response object:`, data);
      
      const html = data.contents;
      console.log(`🔑 ===== HTML CONTENT ANALYSIS =====`);
      console.log(`🔑 HTML exists:`, !!html);
      console.log(`🔑 HTML type:`, typeof html);
      console.log(`🔑 HTML length:`, html ? html.length : 'null');
      console.log(`🔑 HTML is string:`, typeof html === 'string');
      console.log(`🔑 HTML preview (first 500 chars):`, html ? html.substring(0, 500) : 'null');
      
      if (html && html.length > 0) {
        // Look for key indicators in the HTML
        const hasGetSongKey = html.toLowerCase().includes('getsongkey');
        const hasSearch = html.toLowerCase().includes('search');
        const hasKey = html.toLowerCase().includes('key');
        const hasBPM = html.toLowerCase().includes('bpm');
        console.log(`🔑 HTML contains 'getsongkey': ${hasGetSongKey}`);
        console.log(`🔑 HTML contains 'search': ${hasSearch}`);
        console.log(`🔑 HTML contains 'key': ${hasKey}`);
        console.log(`🔑 HTML contains 'bpm': ${hasBPM}`);
      }
      
      // Parse HTML for key data using multiple patterns
      const keyPatterns = [
        /key[:\s]*([A-G][#b]?(?:\s*(?:major|minor|maj|min|m))?)/gi,
        /([A-G][#b]?)\s*(?:major|minor|maj|min|m)/gi,
        /"key"\s*:\s*"([^"]+)"/gi,
        /\b([A-G][#b]?)\s+(?:major|minor)\b/gi
      ];
      
      let keyFound = null;
      let matchFound = false;
      
      // Look for song match indicators first
      const titleLower = cleanTitle.toLowerCase();
      const artistLower = cleanArtist.toLowerCase();
      
      console.log(`🔑 Looking for matches in HTML...`);
      console.log(`🔑 Searching for title: "${titleLower}"`);
      console.log(`🔑 Searching for artist: "${artistLower}"`);
      
      const titleInHtml = html && html.toLowerCase().includes(titleLower);
      const artistInHtml = html && html.toLowerCase().includes(artistLower);
      
      console.log(`🔑 Title found in HTML: ${titleInHtml}`);
      console.log(`🔑 Artist found in HTML: ${artistInHtml}`);
      
      // Check if the search found relevant results
      if (titleInHtml || artistInHtml) {
        matchFound = true;
        console.log(`🔑 Match found! Searching for key patterns...`);
        
        for (let i = 0; i < keyPatterns.length; i++) {
          const pattern = keyPatterns[i];
          console.log(`🔑 Trying pattern ${i + 1}: ${pattern}`);
          
          const matches = html.matchAll(pattern);
          let matchCount = 0;
          
          for (const match of matches) {
            matchCount++;
            const key = match[1].trim();
            console.log(`🔑 Found potential key match ${matchCount}: "${key}" (full match: "${match[0]}")`);
            
            // Validate key format
            if (/^[A-G][#b]?(?:\s*(?:major|minor|maj|min|m))?$/i.test(key)) {
              keyFound = this.normalizeKey(key);
              console.log(`🔑 Valid key found: "${keyFound}"`);
              break;
            } else {
              console.log(`🔑 Invalid key format: "${key}"`);
            }
          }
          
          console.log(`🔑 Pattern ${i + 1} found ${matchCount} matches`);
          if (keyFound) break;
        }
      } else {
        console.log(`🔑 No match found in HTML - neither title nor artist found`);
      }
      
      if (keyFound && matchFound) {
        console.log(`🔑 ✅ SUCCESS: GetSongKey website found: ${keyFound} for "${cleanTitle}" by ${cleanArtist}`);
        console.log(`🔑 ===== GETSONGKEY DEBUG END (SUCCESS) =====`);
        return {
          key: keyFound,
          confidence: 0.85 // High confidence for website match
        };
      }
      
      console.log(`🔑 ❌ FAILURE: No key data found on GetSongKey website for: ${cleanArtist} - ${cleanTitle}`);
      console.log(`🔑 ===== GETSONGKEY DEBUG END (NO DATA) =====`);
      return null;
      
    } catch (error) {
      console.error(`🔑 ERROR in GetSongKey scraping for ${artist} - ${title}:`, error);
      console.log(`🔑 ===== GETSONGKEY DEBUG END (ERROR) =====`);
      return null;
    }
  }

  // Helper: Normalize key notation
  private normalizeKey(key: string): string {
    const cleanKey = key.trim().replace(/\s+/g, ' ');
    
    // Convert different formats to standard notation
    const normalized = cleanKey
      .replace(/major/gi, '')
      .replace(/minor/gi, 'm')
      .replace(/maj/gi, '')
      .replace(/min/gi, 'm')
      .replace(/\s+/g, '')
      .trim();
    
    // Ensure proper format (e.g., "Cm" not "C m")
    return normalized.replace(/([A-G][#b]?)\s*m$/i, '$1m');
  }


  // Get comprehensive analysis combining both website sources
  async getPreciseAnalysis(artist: string, title: string): Promise<PreciseMusicData> {
    try {
      console.log(`🎯 Getting precise analysis from GetSongBPM + GetSongKey websites for: ${artist} - ${title}`);
      
      // Try to get both BPM and key data from websites in parallel
      const [bpmResult, keyResult] = await Promise.allSettled([
        this.getBPMData(artist, title),
        this.getKeyData(artist, title)
      ]);
      
      let bpm = null;
      let key = null;
      let bpmConfidence = 0;
      let keyConfidence = 0;
      
      // Process BPM result
      if (bpmResult.status === 'fulfilled' && bpmResult.value) {
        bpm = bpmResult.value.bpm;
        bpmConfidence = bpmResult.value.confidence;
      }
      
      // Process Key result
      if (keyResult.status === 'fulfilled' && keyResult.value) {
        key = keyResult.value.key;
        keyConfidence = keyResult.value.confidence;
      }
      
      const result: PreciseMusicData = {
        bpm: bpm || undefined,
        key: key || undefined,
        confidence: {
          bpm: bpmConfidence,
          key: keyConfidence
        },
        source: (bpm && key) ? 'combined' : (bpm ? 'getsongbpm' : (key ? 'getsongkey' : 'combined'))
      };
      
      if (bpm || key) {
        console.log(`✅ Website analysis complete for "${title}" by ${artist}:`, result);
      } else {
        console.log(`❌ No data found on GetSong websites for "${title}" by ${artist}`);
        result.error = 'No data found on GetSongBPM/GetSongKey websites';
      }
      
      return result;
      
    } catch (error) {
      console.warn(`Error in website analysis for ${artist} - ${title}:`, error);
      return {
        source: 'combined',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper: Clean search terms for better matching
  private cleanSearchTerm(term: string): string {
    return term
      .replace(/\([^)]*\)/g, '') // Remove parentheses content
      .replace(/\[[^\]]*\]/g, '') // Remove brackets content
      .replace(/feat\.|ft\./gi, '') // Remove featuring
      .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }

  // Helper: Find best match from search results
  private findBestMatch(results: any[], targetArtist: string, targetTitle: string): any {
    if (!results || results.length === 0) return null;
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const result of results) {
      const score = this.calculateMatchScore(result, targetArtist, targetTitle);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = result;
      }
    }
    
    // Only return if confidence is reasonable
    return bestScore > 0.5 ? bestMatch : null;
  }

  // Helper: Calculate match score between result and target
  private calculateMatchScore(result: any, targetArtist: string, targetTitle: string): number {
    const resultArtist = (result.artist || '').toLowerCase();
    const resultTitle = (result.song || result.title || '').toLowerCase();
    const targetArtistLower = targetArtist.toLowerCase();
    const targetTitleLower = targetTitle.toLowerCase();
    
    // Simple similarity scoring
    const artistScore = this.stringSimilarity(resultArtist, targetArtistLower);
    const titleScore = this.stringSimilarity(resultTitle, targetTitleLower);
    
    // Weighted average (title is more important)
    return (titleScore * 0.6) + (artistScore * 0.4);
  }

  // Helper: Calculate string similarity (simple Levenshtein-based)
  private stringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    // Simple approach: check if one contains the other
    if (str1.includes(str2) || str2.includes(str1)) return 0.8;
    
    // Check for word overlap
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

  // Helper: Calculate confidence based on match quality
  private calculateMatchConfidence(result: any, targetArtist: string, targetTitle: string): number {
    const matchScore = this.calculateMatchScore(result, targetArtist, targetTitle);
    return Math.min(matchScore, 0.95); // Cap at 95% confidence
  }
}

export const songAnalysisService = new SongAnalysisService();