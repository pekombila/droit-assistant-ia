import { generateText, streamText } from "ai";
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

    try {
      const { text } = await generateText({
        model: getArtifactModel(),
        system: documentSystemPrompt,
        prompt: title,
      });

      draftContent = text;

      if (text) {
        dataStream.write({
          type: "data-textDelta",
          data: text,
          transient: true,
        });
      }
    } catch (error) {
      const errMsg = `Erreur de génération : ${error instanceof Error ? error.message : String(error)}`;
      draftContent = errMsg;
      dataStream.write({ type: "data-textDelta", data: errMsg, transient: true });
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = "";

    try {
      const { text } = await generateText({
        model: getArtifactModel(),
        system: updateDocumentPrompt(document.content, "text"),
        prompt: description,
      });

      draftContent = text;

      if (text) {
        dataStream.write({
          type: "data-textDelta",
          data: text,
          transient: true,
        });
      }
    } catch (error) {
      const errMsg = `Erreur de génération : ${error instanceof Error ? error.message : String(error)}`;
      draftContent = errMsg;
      dataStream.write({ type: "data-textDelta", data: errMsg, transient: true });
    }

    return draftContent;
  },
});
