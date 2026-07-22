import { getGeminiAI } from "./ai.service.js";
import { db, Tender } from "./db.js";

// Cache for vector embeddings in-memory to prevent redundant API calls
const embeddingCache = new Map<string, number[]>();

/**
 * Generates an embedding vector for a given text string.
 * Uses Gemini's text-embedding-004 model or a deterministic fallback vector if API is disabled/failed.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const sanitizedText = (text || "").trim().substring(0, 10000); // chunk limit
  if (!sanitizedText) {
    return new Array(768).fill(0);
  }

  if (embeddingCache.has(sanitizedText)) {
    return embeddingCache.get(sanitizedText)!;
  }

  const ai = getGeminiAI();
  if (ai) {
    try {
      console.log(`[Vector Search] Requesting embedding from Gemini for text: "${sanitizedText.substring(0, 40)}..."`);
      const response = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: sanitizedText,
      }) as any;

      if (response && response.embedding && response.embedding.values) {
        const values = response.embedding.values;
        embeddingCache.set(sanitizedText, values);
        return values;
      }
    } catch (err) {
      console.warn("[Vector Search] Gemini embedding API failed, falling back to local simulator:", err);
    }
  }

  // Deterministic local mock embedding generator (length 768)
  // Ensures same text generates same mock vector so search behaves consistently without API keys
  const vector = new Array(768).fill(0);
  for (let i = 0; i < 768; i++) {
    // Generate deterministic pseudo-random float between -1 and 1 based on text hash
    let hash = 0;
    const strForHash = sanitizedText + `_dim_${i}`;
    for (let charIndex = 0; charIndex < strForHash.length; charIndex++) {
      hash = (hash << 5) - hash + strForHash.charCodeAt(charIndex);
      hash = hash & hash; // Convert to 32bit integer
    }
    vector[i] = Math.sin(hash) * 0.95; // bound values
  }

  // Normalize the simulated vector
  let sumSq = 0;
  for (const val of vector) {
    sumSq += val * val;
  }
  const magnitude = Math.sqrt(sumSq) || 1;
  const normalizedVector = vector.map(v => v / magnitude);

  embeddingCache.set(sanitizedText, normalizedVector);
  return normalizedVector;
}

/**
 * Computes cosine similarity between two numerical vectors of the same length.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Searches tenders semantically using cosine similarity over query and tender embeddings.
 */
export async function searchTendersSemantic(
  query: string,
  limit: number = 10
): Promise<{ tender: Tender; similarity: number }[]> {
  const queryVec = await getEmbedding(query);
  const tenders = db.data.tenders;

  const results: { tender: Tender; similarity: number }[] = [];

  for (const tender of tenders) {
    // Build representative text for the tender to embed
    const tenderRepresentativeText = `
      Title: ${tender.title}
      Department: ${tender.department}
      State: ${tender.state}
      Category: ${tender.category}
      Location: ${tender.location}
      Description: ${tender.workDescription}
      Specs: ${tender.technicalSpecs}
    `.trim();

    try {
      const tenderVec = await getEmbedding(tenderRepresentativeText);
      const similarity = cosineSimilarity(queryVec, tenderVec);
      results.push({ tender, similarity });
    } catch (err) {
      console.error(`[Vector Search] Failed to process embedding for tender ${tender.id}:`, err);
      // Fallback search score: simple keyword match check
      const queryLower = query.toLowerCase();
      const hasTitleMatch = tender.title.toLowerCase().includes(queryLower);
      const similarity = hasTitleMatch ? 0.6 : 0.1;
      results.push({ tender, similarity });
    }
  }

  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, limit);
}
