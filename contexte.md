# Contexte du Projet - Assistant Juridique Gabonais

## Objectif
Créer un assistant juridique spécialisé dans le Droit du Travail et de la Protection Sociale au Gabon.

## Architecture Cible

### 1. Moteur d'IA : Groq (Llama 3.3 70B)
- **Avantages** : Rapidité, capacité de raisonnement, coût réduit
- **Configuration** : Variable d'environnement `GROQ_API_KEY`

### 2. Mémoire & RAG : PostgreSQL (Neon) avec pgvector
- Base existante : Drizzle ORM avec PostgreSQL
- Extension à ajouter : pgvector pour les embeddings
- Usage futur : Recherche dans les PDFs du Code du Travail gabonais

### 3. Interface : Artifacts du template
- Composants existants : `components/artifact.tsx`, `components/document.tsx`
- Types d'artifacts : text, code, sheet, image

---

## Analyse du Codebase

### Points d'injection identifiés

#### 1. System Prompt Juridique
**Fichier** : `lib/ai/prompts.ts`
- **Ligne 40-42** : Variable `regularPrompt` - c'est ici qu'il faut injecter le prompt juridique gabonais
- **Ligne 59-77** : Fonction `systemPrompt()` qui combine les prompts

```typescript
// Actuel (ligne 40-42)
export const regularPrompt = `You are a friendly assistant!...`;

// À remplacer par un prompt juridique gabonais
```

#### 2. Configuration des Modèles
**Fichier** : `lib/ai/models.ts`
- Liste des modèles disponibles dans `chatModels[]`
- Modèle par défaut : `DEFAULT_CHAT_MODEL` (ligne 2)

**Fichier** : `lib/ai/providers.ts`
- Utilise `@ai-sdk/gateway` (Vercel AI Gateway)
- Fonction `getLanguageModel()` pour récupérer un modèle

#### 3. Route API Chat
**Fichier** : `app/(chat)/api/chat/route.ts`
- Ligne 143 : `model: getLanguageModel(selectedChatModel)`
- Le modèle est sélectionné côté client et passé dans le body

---

## Schéma Base de Données Actuel

**Fichier** : `lib/db/schema.ts`

### Tables existantes
| Table | Description |
|-------|-------------|
| `User` | Utilisateurs |
| `Chat` | Conversations |
| `Message_v2` | Messages (nouveau format) |
| `Vote_v2` | Votes sur messages |
| `Document` | Documents/artifacts |
| `Suggestion` | Suggestions de modifications |
| `Stream` | Flux resumables |

### Table Knowledge (à créer pour RAG)
```sql
-- Exemple de schéma pour la table Knowledge
CREATE TABLE "Knowledge" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  article_number TEXT,
  embedding vector(1536), -- pgvector
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index pour recherche vectorielle
CREATE INDEX ON "Knowledge" USING ivfflat (embedding vector_cosine_ops);
```

---

## Tâches de Configuration

### 1. Installer le SDK Groq ✅
```bash
pnpm add @ai-sdk/groq  # Installé: @ai-sdk/groq 3.0.24
```

### 2. Variables d'environnement (.env.local) ⚠️ À CONFIGURER
```env
GROQ_API_KEY=gsk_xxxxx          # Obligatoire pour Groq
POSTGRES_URL=postgresql://...   # Neon - déjà configuré
```

### 3. Synchronisation Base de Données ⏳
**Statut** : En attente de synchronisation

```bash
pnpm exec drizzle-kit push
```

> ⚠️ **Note** : Si problème de connexion (ECONNRESET) depuis WSL, exécuter depuis Windows PowerShell ou utiliser la "Pooled connection URL" de Neon (port 6543).

### 3. Modifier `lib/ai/providers.ts` ✅
- Import de `createGroq` depuis `@ai-sdk/groq`
- Instance Groq configurée avec `process.env.GROQ_API_KEY`
- Fonction `getLanguageModel()` gère les IDs commençant par `groq-`

### 4. Ajouter Llama 3.3 70B dans `lib/ai/models.ts` ✅
```typescript
{
  id: "groq-llama-3.3-70b-versatile",
  name: "Llama 3.3 70B (Gabon)",
  provider: "groq",
  description: "Assistant juridique gabonais - Droit du Travail & Protection Sociale",
}
```

### 5. System Prompt Juridique ✅
Modifié dans `lib/ai/prompts.ts` - variable `regularPrompt`

---

## Prochaines Étapes

1. [x] Analyse du codebase
2. [x] Créer le system prompt juridique gabonais
3. [x] Configurer Groq comme provider
4. [x] Modèle Llama 3.3 70B configuré par défaut
5. [ ] Ajouter la variable GROQ_API_KEY dans .env.local
6. [ ] Synchroniser le schéma DB avec `pnpm exec drizzle-kit push`
7. [ ] Ajouter la table Knowledge avec pgvector
8. [ ] Implémenter le RAG pour les PDFs juridiques
9. [ ] Créer un artifact "article-loi" pour l'affichage

---

## Ressources Juridiques Gabonaises (à intégrer)

- Code du Travail gabonais
- Code de la Sécurité Sociale
- Conventions collectives
- Jurisprudence relevante

---

## Notes de Session

*Ce fichier servira de mémoire vive pour les sessions futures.*
