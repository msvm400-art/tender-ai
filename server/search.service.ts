import { Tender } from "./db.js";

export class SearchEngine {
  // Inverted index maps lowercase word token -> Set of tender IDs
  private index: Map<string, Set<string>> = new Map();
  // Store document references for quick lookup
  private documentMap: Map<string, Tender> = new Map();
  // List of standard stop words to exclude from indexing
  private stopWords: Set<string> = new Set([
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "arent", "as", 
    "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "cant", "cannot", 
    "could", "couldnt", "did", "didnt", "do", "does", "doesnt", "doing", "dont", "down", "during", "each", "few", 
    "for", "from", "further", "had", "hadnt", "has", "hasnt", "have", "havent", "having", "he", "hed", "hell", 
    "hes", "her", "here", "heres", "hers", "herself", "him", "himself", "his", "how", "hows", "i", "id", "ill", 
    "im", "ive", "if", "in", "into", "is", "isnt", "it", "its", "itself", "lets", "me", "more", "most", "mustnt", 
    "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", 
    "ourselves", "out", "over", "own", "same", "shant", "she", "shed", "shell", "shes", "should", "shouldnt", 
    "so", "some", "such", "than", "that", "thats", "the", "their", "theirs", "them", "themselves", "then", 
    "there", "theres", "these", "they", "theyd", "theyll", "theyre", "theyve", "this", "those", "through", 
    "to", "too", "under", "until", "up", "very", "was", "wasnt", "we", "wed", "well", "were", "weve", "werent", 
    "what", "whats", "when", "whens", "where", "wheres", "which", "while", "who", "whos", "whom", "why", "whys", 
    "with", "wont", "would", "wouldnt", "you", "youd", "youll", "youre", "youve", "your", "yours", "yourself", 
    "yourselves"
  ]);

  constructor() {}

  /**
   * Tokenize an input string into unique clean words
   */
  public tokenize(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ") // keep alphanumeric and hyphens
      .split(/[\s_]+/)
      .map(token => token.trim())
      .filter(token => token.length > 1 && !this.stopWords.has(token));
  }

  /**
   * Rebuild the entire inverted index from a list of tenders
   */
  public indexTenders(tenders: Tender[]): void {
    const startTime = Date.now();
    this.index.clear();
    this.documentMap.clear();

    tenders.forEach(tender => {
      this.indexTender(tender);
    });

    console.log(`[Search Indexer] Indexed ${tenders.length} tenders in ${Date.now() - startTime}ms. Index size: ${this.index.size} distinct keys.`);
  }

  /**
   * Index a single doc/tender
   */
  public indexTender(tender: Tender): void {
    const id = tender.id;
    this.documentMap.set(id, tender);

    // Combine all fields with specific weights for potential scoring
    const titleTokens = this.tokenize(tender.title);
    const descTokens = this.tokenize(tender.workDescription || "");
    const deptTokens = this.tokenize(tender.department);
    const categoryTokens = this.tokenize(tender.category);
    const subCatTokens = this.tokenize(tender.subCategory || "");
    const stateTokens = this.tokenize(tender.state);
    const locationTokens = this.tokenize(tender.location);
    const specTokens = this.tokenize(tender.technicalSpecs || "");
    const rawTokens = this.tokenize(tender.rawText || "");

    // Amalgamate unique tokens
    const allTokens = new Set([
      ...titleTokens,
      ...descTokens,
      ...deptTokens,
      ...categoryTokens,
      ...subCatTokens,
      ...stateTokens,
      ...locationTokens,
      ...specTokens,
      ...rawTokens
    ]);

    allTokens.forEach(token => {
      if (!this.index.has(token)) {
        this.index.set(token, new Set());
      }
      this.index.get(token)!.add(id);
    });
  }

  /**
   * Remove a single tender from index (e.g. if deleted)
   */
  public removeTender(id: string): void {
    this.documentMap.delete(id);
    for (const [_, postings] of this.index.entries()) {
      postings.delete(id);
    }
  }

  /**
   * Perform advanced fast-indexed search query
   */
  public search(params: {
    q?: string;
    category?: string[];
    location?: string[];
    department?: string;
    minAmount?: number;
    maxAmount?: number;
    publishedAfter?: string;
    publishedBefore?: string;
    deadlineBefore?: string;
    deadlineAfter?: string;
    status?: string;
  }): { results: Tender[]; scoreDetails?: Record<string, number> } {
    let candidateIds: Set<string> | null = null;

    // 1. Full text keywords using Inverted Index for O(1) retrieval
    if (params.q && params.q.trim()) {
      const queryTokens = this.tokenize(params.q);
      
      if (queryTokens.length > 0) {
        candidateIds = new Set();
        // Intersection or Union of postings depending on query length
        // We'll do a union first to broad search, but calculate scores based on overlap
        queryTokens.forEach((token) => {
          // Exact match token
          if (this.index.has(token)) {
            this.index.get(token)!.forEach(id => candidateIds!.add(id));
          }

          // Simple lookup prefix support for fast typing autocompletion
          for (const key of this.index.keys()) {
            if (key !== token && key.startsWith(token)) {
              this.index.get(key)!.forEach(id => candidateIds!.add(id));
            }
          }
        });
      }
    }

    // Prepare list to filter
    let list: Tender[] = [];
    if (candidateIds) {
      candidateIds.forEach(id => {
        const doc = this.documentMap.get(id);
        if (doc) list.push(doc);
      });
    } else {
      // If no query string, default to all documents
      list = Array.from(this.documentMap.values());
    }

    // 2. Multi-faceted Filtering & Pruning
    const categoryFilter = params.category && params.category.filter(Boolean);
    const locationFilter = params.location && params.location.filter(Boolean);

    let filtered = list.filter(t => {
      // Category match
      if (categoryFilter && categoryFilter.length > 0) {
        if (!categoryFilter.includes(t.category)) {
          return false;
        }
      }

      // Location match (Check state or location fields)
      if (locationFilter && locationFilter.length > 0) {
        const matchesLocation = locationFilter.some(loc => 
          t.state.toLowerCase().includes(loc.toLowerCase()) ||
          t.location.toLowerCase().includes(loc.toLowerCase())
        );
        if (!matchesLocation) return false;
      }

      // Department Match
      if (params.department && params.department.trim()) {
        const dept = params.department.toLowerCase();
        if (!t.department.toLowerCase().includes(dept)) {
          return false;
        }
      }

      // Budget value (Crores)
      if (params.minAmount !== undefined && t.tenderValue !== null) {
        if (t.tenderValue < params.minAmount) return false;
      }
      if (params.maxAmount !== undefined && t.tenderValue !== null) {
        if (t.tenderValue > params.maxAmount) return false;
      }

      // Date range filters
      if (params.publishedAfter) {
        if (new Date(t.publishedDate) < new Date(params.publishedAfter)) return false;
      }
      if (params.publishedBefore) {
        if (new Date(t.publishedDate) > new Date(params.publishedBefore)) return false;
      }
      if (params.deadlineAfter) {
        if (new Date(t.bidSubmissionDeadline) < new Date(params.deadlineAfter)) return false;
      }
      if (params.deadlineBefore) {
        if (new Date(t.bidSubmissionDeadline) > new Date(params.deadlineBefore)) return false;
      }

      // Status match
      if (params.status && params.status !== "ALL") {
        if (t.status !== params.status) return false;
      }

      return true;
    });

    // 3. Relevance ranking if search term is provided
    const scoreMap: Record<string, number> = {};
    if (params.q && params.q.trim()) {
      const qTokens = this.tokenize(params.q);
      
      filtered.forEach(t => {
        let score = 0;
        
        qTokens.forEach(token => {
          // Weight factors based on matching fields
          const titleLow = t.title.toLowerCase();
          const descLow = (t.workDescription || "").toLowerCase();
          const deptLow = t.department.toLowerCase();
          const catLow = t.category.toLowerCase();
          const subLow = (t.subCategory || "").toLowerCase();

          if (titleLow.includes(token)) score += 10;
          if (deptLow.includes(token)) score += 5;
          if (catLow.includes(token)) score += 4;
          if (subLow.includes(token)) score += 4;
          if (descLow.includes(token)) score += 2;
          
          // Exact matches get higher weight
          if (titleLow === token) score += 50;
        });

        scoreMap[t.id] = score;
      });

      // Sort by descending score
      filtered.sort((a, b) => (scoreMap[b.id] || 0) - (scoreMap[a.id] || 0));
    } else {
      // Default sort is newest published date first
      filtered.sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());
    }

    return {
      results: filtered,
      scoreDetails: scoreMap
    };
  }

  /**
   * Return metadata about the index size
   */
  public getIndexStatus() {
    return {
      totalDocuments: this.documentMap.size,
      totalTermsIndexed: this.index.size,
      memoryUsageEstimate: `${Math.round(JSON.stringify(Array.from(this.index.entries())).length / 1024)} KB`
    };
  }
}

export const searchEngine = new SearchEngine();
