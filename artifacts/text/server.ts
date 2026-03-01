import { streamText } from "ai";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { getArtifactModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

const documentSystemPrompt = `Tu es un assistant spécialisé dans la rédaction de documents juridiques et professionnels en français pour la République Gabonaise.
Rédige le document demandé de manière complète et structurée. Utilise le Markdown pour la mise en forme : titres (##, ###), listes, gras pour les termes importants.
Adapte le style au type de document (contrat, lettre, note, tableau, etc.). Ne fournis que le contenu du document, sans commentaires ni explications.`;

export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    const { textStream } = streamText({
      model: getArtifactModel(),
      system: documentSystemPrompt,
      prompt: title,
    });

    for await (const text of textStream) {
      draftContent += text;
      dataStream.write({
        type: "data-textDelta",
        data: text,
        transient: true,
      });
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = "";

    const { textStream } = streamText({
      model: getArtifactModel(),
      system: updateDocumentPrompt(document.content, "text"),
      prompt: description,
    });

    for await (const text of textStream) {
      draftContent += text;
      dataStream.write({
        type: "data-textDelta",
        data: text,
        transient: true,
      });
    }

    return draftContent;
  },
});
