const MISTRAL_EMBED_MODEL = "mistral-embed";
const MISTRAL_API_URL = "https://api.mistral.ai/v1/embeddings";

async function getEmbedding(text: string, retries = 3): Promise<number[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(MISTRAL_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MISTRAL_EMBED_MODEL,
        input: [text],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.data[0].embedding as number[];
    }

    const err = await response.text();

    // Retry sur erreurs transitoires (500, 502, 503, 429)
    if (attempt < retries && [429, 500, 502, 503].includes(response.status)) {
      const delay = attempt * 2000;
      console.warn(`  ⚠️ Mistral API ${response.status}, retry ${attempt}/${retries} dans ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    throw new Error(`Mistral Embeddings API error: ${err}`);
  }
  throw new Error("Mistral Embeddings API: toutes les tentatives ont échoué");
}

/**
 * Generate embedding for a search query.
 */
export async function embedQuery(text: string): Promise<number[]> {
  return getEmbedding(text);
}

/**
 * Generate embedding for a document passage.
 */
export async function embedPassage(text: string): Promise<number[]> {
  return getEmbedding(text);
}
