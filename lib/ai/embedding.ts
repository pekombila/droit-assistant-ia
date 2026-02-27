import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

const MODEL_NAME = "Xenova/multilingual-e5-small";

let embeddingPipeline: FeatureExtractionPipeline | null = null;

async function getEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline("feature-extraction", MODEL_NAME, {
      quantized: true,
    });
  }
  return embeddingPipeline;
}

/**
 * Generate embedding for a search query.
 * Prefixed with "query: " per E5 model requirements.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(`query: ${text}`, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data as Float32Array);
}

/**
 * Generate embedding for a document passage.
 * Prefixed with "passage: " per E5 model requirements.
 */
export async function embedPassage(text: string): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(`passage: ${text}`, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data as Float32Array);
}
