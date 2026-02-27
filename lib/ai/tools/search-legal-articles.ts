import { tool } from "ai";
import { z } from "zod";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { embedQuery } from "@/lib/ai/embedding";

// biome-ignore lint: Forbidden non-null assertion.
const client = neon(process.env.POSTGRES_URL!);
const db = drizzle(client);

export const searchLegalArticles = tool({
  description:
    "Rechercher des articles de loi dans le Code du Travail gabonais (Loi n°022/2021) " +
    "et le Code de la Protection Sociale (Loi n°028/2016). " +
    "Utilise cette fonction pour trouver les articles juridiques pertinents lorsque " +
    "l'utilisateur pose une question sur le droit du travail ou la protection sociale au Gabon.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "La question juridique ou les termes de recherche en français. " +
          "Exemple: 'durée légale du travail', 'licenciement abusif', 'congé maternité'"
      ),
    limit: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Nombre maximum de résultats (défaut: 5)"),
  }),
  execute: async ({ query, limit = 5 }) => {
    try {
      const queryEmbedding = await embedQuery(query);
      const embeddingStr = `[${queryEmbedding.join(",")}]`;

      const results = await db.execute(sql`
        SELECT
          lc."articleNumber",
          lc."content",
          ld."title" AS "documentTitle",
          ld."lawReference",
          1 - (lc."embedding" <=> ${embeddingStr}::vector) AS similarity
        FROM "LegalChunk" lc
        INNER JOIN "LegalDocument" ld ON lc."documentId" = ld."id"
        WHERE lc."embedding" IS NOT NULL
        ORDER BY lc."embedding" <=> ${embeddingStr}::vector
        LIMIT ${limit}
      `);

      if (!results.rows || results.rows.length === 0) {
        return {
          found: false,
          message:
            "Aucun article pertinent trouvé. La base de connaissances juridiques " +
            "n'a peut-être pas encore été alimentée.",
          articles: [],
        };
      }

      const articles = results.rows.map((row: Record<string, unknown>) => ({
        articleNumber: row.articleNumber as string,
        content: row.content as string,
        lawReference: row.lawReference as string,
        documentTitle: row.documentTitle as string,
        similarity: Math.round((row.similarity as number) * 100) / 100,
      }));

      return {
        found: true,
        count: articles.length,
        articles,
      };
    } catch (error) {
      console.error("Legal search error:", error);
      return {
        found: false,
        message: "Erreur lors de la recherche dans la base juridique.",
        articles: [],
      };
    }
  },
});
