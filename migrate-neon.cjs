const https = require('https');
const querystring = require('querystring');

const DATABASE_URL = process.env.POSTGRES_URL;

function parseConnectionString(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || 5432,
    database: parsed.pathname.slice(1),
    user: parsed.username,
    password: parsed.password
  };
}

const config = parseConnectionString(DATABASE_URL);

// Neon SQL API endpoint
const NEON_API = `https://${config.host}/sql`;

console.log("⚠️ Cette approche nécessite l'API Neon.");
console.log("📋 Veuillez exécuter ce SQL manuellement dans Neon SQL Editor:");
console.log("");
console.log(`
-- SUPPRESSION DES ANCIENNES TABLES
DROP TABLE IF EXISTS "Stream" CASCADE;
DROP TABLE IF EXISTS "Suggestion" CASCADE;
DROP TABLE IF EXISTS "Document" CASCADE;
DROP TABLE IF EXISTS "Vote_v2" CASCADE;
DROP TABLE IF EXISTS "Vote" CASCADE;
DROP TABLE IF EXISTS "Message_v2" CASCADE;
DROP TABLE IF EXISTS "Message" CASCADE;
DROP TABLE IF EXISTS "Chat" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- TABLE User
CREATE TABLE "User" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(64) NOT NULL,
  "password" varchar(64)
);

-- TABLE Chat
CREATE TABLE "Chat" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "createdAt" timestamp NOT NULL,
  "title" text NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "visibility" varchar NOT NULL DEFAULT 'private'
);

-- TABLE Message
CREATE TABLE "Message" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chatId" uuid NOT NULL REFERENCES "Chat"("id"),
  "role" varchar NOT NULL,
  "content" json NOT NULL,
  "createdAt" timestamp NOT NULL
);

-- TABLE Message_v2
CREATE TABLE "Message_v2" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chatId" uuid NOT NULL REFERENCES "Chat"("id"),
  "role" varchar NOT NULL,
  "parts" json NOT NULL,
  "attachments" json NOT NULL,
  "createdAt" timestamp NOT NULL
);

-- TABLE Vote
CREATE TABLE "Vote" (
  "chatId" uuid NOT NULL REFERENCES "Chat"("id"),
  "messageId" uuid NOT NULL REFERENCES "Message"("id"),
  "isUpvoted" boolean NOT NULL,
  PRIMARY KEY ("chatId", "messageId")
);

-- TABLE Vote_v2
CREATE TABLE "Vote_v2" (
  "chatId" uuid NOT NULL REFERENCES "Chat"("id"),
  "messageId" uuid NOT NULL REFERENCES "Message_v2"("id"),
  "isUpvoted" boolean NOT NULL,
  PRIMARY KEY ("chatId", "messageId")
);

-- TABLE Document
CREATE TABLE "Document" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "createdAt" timestamp NOT NULL,
  "title" text NOT NULL,
  "content" text,
  "kind" varchar NOT NULL DEFAULT 'text',
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  PRIMARY KEY ("id", "createdAt")
);

-- TABLE Suggestion
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
);

-- TABLE Stream
CREATE TABLE "Stream" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chatId" uuid NOT NULL REFERENCES "Chat"("id"),
  "createdAt" timestamp NOT NULL
);
`);
