# Rapport d'Audit Technique - Assistant Juridique Gabonais

## Vue d'ensemble

Le projet est un fork du **Vercel AI Chatbot SDK v3.1.0**, basé sur **Next.js 16**, **Auth.js v5 beta**, **Drizzle ORM 0.34** (Neon Postgres) et **AI SDK v6**. Le modèle principal a été migré vers **Groq Llama 3.3 70B** et le system prompt a été entièrement réécrit pour le droit gabonais.

---

## 1. BUGS CRITIQUES ET FAILLES

### 1.1 CREDENTIALS BASE DE DONNÉES EN CLAIR DANS LE CODE SOURCE

**Fichier:** `drizzle.config.ts:9-10`
```
url: process.env.POSTGRES_URL ||
  "postgresql://neondb_owner:npg_gdQ9Jq1euDvh@ep-orange-bread-alc8d7ms..."
```

**Sévérité: CRITIQUE.** Le mot de passe Neon est en dur dans le fallback. Ce fichier est versionné dans Git. **Ces credentials doivent être révoquées immédiatement** via le dashboard Neon, puis le fallback supprimé.

---

### 1.2 BUG DANS `voteMessage()` - WHERE clause incomplète

**Fichier:** `lib/db/queries.ts:292-295`
```typescript
const [existingVote] = await db
  .select()
  .from(vote)
  .where(and(eq(vote.messageId, messageId)));
  //          ^^^ chatId manquant dans le SELECT
```

Le `and()` ne contient qu'une seule condition alors que la clé primaire de `Vote_v2` est `(chatId, messageId)`. La recherche du vote existant ignore `chatId`, ce qui peut matcher un vote d'un autre chat. L'update (ligne 301) utilise bien les deux colonnes, mais le SELECT initial est incorrect.

---

### 1.3 COLONNE `kind` NOMMÉE `"text"` DANS LE SCHÉMA

**Fichier:** `lib/db/schema.ts:112`
```typescript
kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
```

Le champ TypeScript s'appelle `kind`, mais la colonne SQL s'appelle `"text"`. C'est fonctionnel (Drizzle mappe le nom TS au nom SQL) mais crée une confusion majeure : le nom de colonne en base est `text` et non `kind`. Ceci vient d'un copier-coller du template original et doit être corrigé pour la lisibilité et la maintenance.

---

### 1.4 PAS DE CONTRAINTE UNIQUE SUR `User.email`

**Fichier:** `lib/db/schema.ts:16`
```typescript
email: varchar("email", { length: 64 }).notNull(),
//     ^^^ pas de .unique()
```

Rien n'empêche d'insérer deux utilisateurs avec le même email. Cela casse la logique d'authentification dans `getUser()` qui suppose un résultat unique.

---

### 1.5 COLLISION POSSIBLE DES EMAILS GUEST

**Fichier:** `lib/db/queries.ts:66`
```typescript
const email = `guest-${Date.now()}`;
```

`Date.now()` a une précision à la milliseconde. Sous charge, deux requêtes simultanées peuvent générer le même email. Sans contrainte UNIQUE (cf. 1.4), les deux s'inséreront sans erreur, créant des doublons.

---

### 1.6 ABSENCE DE CASCADE DELETE

Aucune table n'a de `ON DELETE CASCADE`. Supprimer un utilisateur laisse des chats, messages, votes et documents orphelins. Le code de `deleteChatById()` et `deleteAllChatsByUserId()` fait le nettoyage manuellement, mais :
- Ce n'est pas transactionnel (pas de `db.transaction()`)
- Si une suppression intermédiaire échoue, les données sont dans un état incohérent

---

## 2. POINTS DE FRICTION EN DÉVELOPPEMENT LOCAL

### 2.1 VARIABLE D'ENVIRONNEMENT `GROQ_API_KEY` ABSENTE DU `.env.example`

Le fichier `.env.example` ne mentionne pas `GROQ_API_KEY`, qui est pourtant **obligatoire** pour le modèle par défaut (`groq-llama-3.3-70b-versatile`). Un développeur clonant le repo n'aura aucune indication de cette dépendance.

De même, `AI_GATEWAY_API_KEY` est requis pour tous les modèles non-Groq (Anthropic, OpenAI, Google, xAI via Vercel Gateway).

### 2.2 MODÈLES GATEWAY INACCESSIBLES SANS VERCEL

Les modèles comme `anthropic/claude-haiku-4.5`, `openai/gpt-5.2` passent par `@ai-sdk/gateway` (Vercel AI Gateway). En dev local hors Vercel, il faut une `AI_GATEWAY_API_KEY`. Cette dépendance à Vercel est un point de blocage pour le dev local si on ne déploie pas sur Vercel.

### 2.3 `getTitleModel()` ET `getArtifactModel()` NE SUPPORTENT PAS GROQ

**Fichier:** `lib/ai/providers.ts:60-72`
```typescript
export function getTitleModel() {
  return gateway.languageModel("google/gemini-2.5-flash-lite");
}
export function getArtifactModel() {
  return gateway.languageModel("anthropic/claude-haiku-4.5");
}
```

Même si le chat utilise Groq, la génération de titres et la gestion des artifacts utilisent toujours le Gateway Vercel. Si le Gateway n'est pas configuré, **les titres de chat ne seront pas générés** et **les documents/artifacts échoueront silencieusement** (la génération de titre est dans un try/catch qui log un `console.warn` - `queries.ts:528`).

### 2.4 `REDIS_URL` OPTIONNELLE MAIS IMPACT SUR LES STREAMS

Le stream resumable utilise Redis. Sans `REDIS_URL`, les streams ne seront pas resumables en cas de déconnexion. Ce n'est pas bloquant mais dégrade l'expérience.

### 2.5 `DUMMY_PASSWORD` GÉNÉRÉ À CHAQUE DÉMARRAGE

**Fichier:** `lib/constants.ts:13`
```typescript
export const DUMMY_PASSWORD = generateDummyPassword();
```

Ce password bcrypt est régénéré à chaque restart du serveur. C'est correct (utilisé uniquement pour le timing attack mitigation), mais implique un hashage bcrypt à chaque démarrage, ce qui prend ~100ms. Mineur mais notable.

### 2.6 LONGUEUR DU CHAMP EMAIL TROP COURTE

`varchar("email", { length: 64 })` - La RFC 5321 autorise des emails jusqu'à 254 caractères. 64 est trop restrictif et rejettera des adresses valides.

---

## 3. PROBLÈMES DE CONCEPTION

### 3.1 TABLES DÉPRÉCIÉES NON NETTOYÉES

`Message` (v1) et `Vote` (v1) sont marquées `DEPRECATED` dans le schéma mais restent en base. Le helper de migration `01-core-to-parts.ts` est entièrement commenté. Le code actif utilise bien `Message_v2` et `Vote_v2`, mais les anciennes tables occupent de l'espace et prêtent à confusion.

### 3.2 DOCUMENT AVEC CLÉ PRIMAIRE COMPOSITE `(id, createdAt)`

```typescript
pk: primaryKey({ columns: [table.id, table.createdAt] }),
```

Ce design permet le versioning (même `id`, différents `createdAt`), mais :
- Complexifie les requêtes (il faut toujours spécifier les deux colonnes pour les FK)
- La table `Suggestion` a une FK composite vers `(documentId, documentCreatedAt)`
- `getDocumentById()` fait un `ORDER BY DESC createdAt LIMIT 1` pour récupérer la dernière version, ce qui est implicite et fragile

### 3.3 PAS DE TRANSACTIONS

Aucune requête n'utilise `db.transaction()`. Les opérations multi-tables (suppression chat + messages + votes + streams) ne sont pas atomiques.

### 3.4 GESTION D'ERREURS INCONSISTANTE

- `updateChatTitleById()` (`queries.ts:527-530`) : fait un `console.warn` et retourne `undefined` silencieusement
- Toutes les autres fonctions : lancent `ChatSDKError`
- `getChatsByUserId()` (`queries.ts:224-228`) : le catch ré-emballe l'erreur originale, y compris les `ChatSDKError` internes (not_found), les transformant toutes en `bad_request`

### 3.5 PROMPTS PARTIELLEMENT EN ANGLAIS

Le `regularPrompt` est entièrement en français, mais :
- `artifactsPrompt` est en anglais
- `codePrompt` est en anglais
- `titlePrompt` est en anglais
- `getRequestPromptFromHints` génère du texte en anglais

Pour un assistant juridique gabonais, cette inconsistance linguistique peut perturber le comportement du modèle (réponses mixtes français/anglais).

---

## 4. RECOMMANDATIONS POUR L'INTÉGRATION RAG

### 4.1 EXTENSION DU SCHÉMA POUR pgvector

Neon supporte nativement `pgvector`. Voici l'architecture recommandée :

**Nouvelles tables à prévoir :**

| Table | Colonnes | But |
|-------|----------|-----|
| `LegalDocument` | `id`, `title`, `lawReference` (ex: "Loi n°022/2021"), `articleNumber`, `content`, `embedding vector(1536)`, `metadata jsonb` | Stocker les articles de loi avec leurs embeddings |
| `LegalChunk` | `id`, `documentId` (FK), `chunkIndex`, `content`, `embedding vector(1536)`, `tokens int` | Chunks pour le retrieval granulaire |
| `IngestionJob` | `id`, `status`, `sourceFile`, `createdAt`, `completedAt`, `errorLog` | Tracking des imports de documents |

**Index recommandé :**
```sql
CREATE INDEX ON "LegalChunk" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 4.2 PIPELINE D'INGESTION

1. **Parser PDF** des lois gabonaises (Loi n°022/2021, Loi n°028/2016)
2. **Chunking** par article juridique (découpage sémantique, pas par tokens fixes)
3. **Embedding** via un modèle comme `text-embedding-3-small` (OpenAI) ou un modèle open-source
4. **Stockage** dans pgvector via Drizzle

### 4.3 MODIFICATION DE LA COUCHE IA

Le flow actuel est :
```
User Query → System Prompt → LLM → Response
```

Le flow RAG serait :
```
User Query → Embedding → Vector Search → Context Injection → LLM → Response (avec citations)
```

**Concrètement :**
- Ajouter un tool `searchLegalArticles` dans `lib/ai/tools/`
- Le system prompt demande déjà des citations d'articles - le RAG fournirait le contenu réel au lieu de s'appuyer sur la connaissance interne du modèle (qui est limitée pour le droit gabonais)
- Le Llama 3.3 70B via Groq est un bon choix car il est rapide, mais sa connaissance du droit gabonais est quasi-nulle - le RAG est **indispensable**

### 4.4 MODIFICATIONS ARCHITECTURALES RECOMMANDÉES

1. **Séparer les providers** : Créer un provider dédié pour les embeddings (peut être différent du chat model)
2. **Ajouter un cache de contexte** : Les mêmes articles seront souvent récupérés - un cache Redis éviterait des requêtes vector répétitives
3. **Ajouter un type d'artifact "legal-article"** : Pour afficher les articles de loi dans un format structuré dans le panneau latéral
4. **Envisager un reranker** : Après la recherche vectorielle, un modèle de reranking (ex: Cohere Rerank) améliorerait la précision des résultats

---

## 5. RÉSUMÉ DES PRIORITÉS

| Priorité | Action | Impact |
|----------|--------|--------|
| **P0** | Révoquer les credentials Neon exposées dans `drizzle.config.ts` | Sécurité |
| **P0** | Ajouter `GROQ_API_KEY` au `.env.example` | Onboarding dev |
| **P1** | Ajouter `.unique()` sur `User.email` + migration | Intégrité données |
| **P1** | Corriger le `voteMessage()` (ajouter `chatId` au WHERE) | Bug logique |
| **P1** | Décider d'une stratégie pour `getTitleModel`/`getArtifactModel` sans Gateway | Dev local |
| **P2** | Ajouter `ON DELETE CASCADE` aux FK critiques | Intégrité données |
| **P2** | Harmoniser les prompts en français | UX cohérente |
| **P2** | Renommer la colonne `"text"` en `"kind"` (migration) | Maintenabilité |
| **P3** | Mettre en place pgvector + pipeline RAG | Feature core |
| **P3** | Ajouter des transactions pour les opérations multi-tables | Robustesse |
| **P3** | Nettoyer les tables dépréciées (Message v1, Vote v1) | Dette technique |

---

Ce rapport constitue une base pour prioriser les corrections avant de passer à l'intégration RAG. Le projet est bien structuré grâce au template Vercel, mais les adaptations pour le contexte gabonais nécessitent de stabiliser la couche données et de résoudre la dépendance au Vercel Gateway avant d'aller plus loin.
