/**
 * Nettoie le fichier OCR du Code de Protection Sociale :
 * - Supprime les références d'images ![...](...)
 * - Supprime les numéros de page isolés
 * - Sauvegarde sous le nom canonique
 */
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dir, "../data/legal");

const inputFile  = resolve(dataDir, "code_securite_sociale.md");
const outputFile = resolve(dataDir, "Loi_n_028_2016_portant_code_de_protection_sociale.md");

let content = readFileSync(inputFile, "utf-8");
const originalLength = content.length;

// 1. Supprime les références d'images markdown : ![...](...)
content = content.replace(/!\[.*?\]\(.*?\)\n?/g, "");

// 2. Supprime les lignes contenant uniquement un numéro de page (ex: "4\n")
content = content.replace(/^\s*\d{1,3}\s*$/gm, "");

// 3. Supprime les lignes vides multiples consécutives (> 2)
content = content.replace(/\n{3,}/g, "\n\n");

// 4. Nettoie les espaces en début/fin de fichier
content = content.trim() + "\n";

writeFileSync(outputFile, content, "utf-8");
console.log(`✅ Nettoyage terminé`);
console.log(`   Avant : ${originalLength} caractères`);
console.log(`   Après : ${content.length} caractères`);
console.log(`   Fichier : ${outputFile}`);

// Supprime l'ancien fichier
unlinkSync(inputFile);
console.log(`🗑️  Supprimé : ${inputFile}`);
