import postgres from 'postgres';

const url = process.env.POSTGRES_URL;

if (!url) {
  console.error("❌ POSTGRES_URL non définie");
  process.exit(1);
}

console.log("🔗 Connexion à Neon...");

const client = postgres(url, { max: 1 });

console.log("🗑️ Suppression des anciennes tables...");

const tables = ["Stream", "Suggestion", "Document", "Vote_v2", "Vote", "Message_v2", "Message", "Chat", "User"];
for (const table of tables) {
  await client.unsafe(`DROP TABLE IF EXISTS "${table}" CASCADE`);
}

console.log("📦 Création des tables...");

await client.unsafe(`
CREATE TABLE "User" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(64) NOT NULL,
  "password" varchar(64)
)
`);

await client.unsafe(`
CREATE TABLE "Chat" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "createdAt" timestamp NOT NULL,
  "title" text NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "visibility" varchar NOT NULL DEFAULT 'private'
)
`);

await client.unsafe(`
CREATE TABLE "Message" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chatId" uuid NOT NULL REFERENCES "Chat"("id"),
  "role" varchar NOT NULL,
  "content" json NOT NULL,
  "createdAt" timestamp NOT NULL
)
`);

await client.unsafe(`
CREATE TABLE "Message_v2" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chatId" uuid NOT NULL REFERENCES "Chat"("id"),
  "role" varchar NOT NULL,
  "parts" json NOT NULL,
  "attachments" json NOT NULL,
  "createdAt" timestamp NOT NULL
)
`);

await client.unsafe(`
CREATE TABLE "Vote" (
  "chatId" uuid NOT NULL REFERENCES "Chat"("id"),
  "messageId" uuid NOT NULL REFERENCES "Message"("id"),
  "isUpvoted" boolean NOT NULL,
  PRIMARY KEY ("chatId", "messageId")
)
`);

await client.unsafe(`
CREATE TABLE "Vote_v2" (
  "chatId" uuid NOT NULL REFERENCES "Chat"("id"),
  "messageId" uuid NOT NULL REFERENCES "Message_v2"("id"),
  "isUpvoted" boolean NOT NULL,
  PRIMARY KEY ("chatId", "messageId")
)
`);

await client.unsafe(`
CREATE TABLE "Document" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "createdAt" timestamp NOT NULL,
  "title" text NOT NULL,
  "content" text,
  "kind" varchar NOT NULL DEFAULT 'text',
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  PRIMARY KEY ("id", "createdAt")
)
`);

await client.unsafe(`
CREATE TABLE "Suggestion" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId" uuid NOT NULL,
  "documentCreatedAt" timestamp NOT NULL,
  "originalText" text NOT NULL,
  "suggestedText" text NOT NULL,
  "description" text,
  "isResolved" boolean NOT NULL DEFAULT false,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "createdAt" timestamp NOT NULL,
  FOREIGN KEY ("documentId", "documentCreatedAt") REFERENCES "Document"("id", "createdAt")
)
`);

await client.unsafe(`
CREATE TABLE "Stream" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chatId" uuid NOT NULL REFERENCES "Chat"("id"),
  "createdAt" timestamp NOT NULL
)
`);

console.log("✅ Base de données synchronisée avec succès!");
await client.end();
