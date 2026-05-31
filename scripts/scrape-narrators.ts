/**
 * Script standalone : scrape les informations des narrateurs via Wikipedia
 *
 * Usage :
 *   npx ts-node -r dotenv/config scripts/scrape-narrators.ts
 *   npx ts-node -r dotenv/config scripts/scrape-narrators.ts --limit 50
 */

import mongoose, { Schema, model } from 'mongoose';
import axios from 'axios';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI manquant dans .env');
  process.exit(1);
}

// ─── Schémas Mongoose ────────────────────────────────────────────────────────
const HadithSchema = new Schema({}, { strict: false, collection: 'hadiths' });
const NarratorSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    aliases: { type: [String], default: [] },
    role: { type: String, default: 'Narrateur' },
    biography: { type: String, default: '' },
    bibliography: { type: [String], default: [] },
    sources: { type: [String], default: [] },
  },
  { timestamps: true }
);

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Fetch Wikipedia ─────────────────────────────────────────────────────────
async function fetchWikipediaSummary(name: string): Promise<string | null> {
  try {
    // Essayer de chercher sur Wikipédia avec le nom exact
    // On remplace les espaces par des underscores
    const pageName = name.replace(/ /g, '_');
    const url = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageName)}`;
    
    const { data } = await axios.get(url, {
      timeout: 5000,
      headers: { 'User-Agent': 'HadithAppScraper/1.0' }
    });

    if (data && data.extract && data.type !== 'disambiguation') {
      return data.extract;
    }
    return null;
  } catch (err: any) {
    if (err.response && err.response.status === 404) {
      // Pas trouvé
      return null;
    }
    console.log(`[WARN] Erreur Wikipedia pour ${name}: ${err.message}`);
    return null;
  }
}

// ─── Script Principal ────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  let limit = 20; // Par défaut, les 20 narrateurs les plus fréquents
  
  const limitIndex = args.indexOf('--limit');
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    limit = parseInt(args[limitIndex + 1], 10);
  }

  console.log(`Connexion à MongoDB...`);
  await mongoose.connect(MONGODB_URI!, { dbName: 'hadith_db' });
  console.log('Connecté à MongoDB');

  const HadithModel = (mongoose.models.Hadith as any) || mongoose.model<any>('Hadith', HadithSchema);
  const NarratorModel = (mongoose.models.Narrator as any) || mongoose.model<any>('Narrator', NarratorSchema);

  console.log(`Agrégation des ${limit} narrateurs les plus fréquents...`);
  const topNarrators = await HadithModel.aggregate([
    { $match: { narrator: { $ne: 'Non précisé' } } },
    { $group: { _id: '$narrator', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);

  console.log(`${topNarrators.length} narrateurs trouvés. Début du scraping...`);

  let inserted = 0;
  let updated = 0;

  for (const item of topNarrators) {
    const name = item._id;
    if (!name) continue;

    process.stdout.write(`Traitement de "${name}" (${item.count} hadiths)... `);

    // Vérifier si existe déjà et si a déjà une bio
    const existing = await NarratorModel.findOne({ name });
    if (existing && existing.biography && existing.biography.length > 50) {
      console.log('Bio déjà présente. Ignoré.');
      continue;
    }

    // Sinon, on requête Wikipedia
    const summary = await fetchWikipediaSummary(name);
    await delay(500); // respect de l'API

    if (summary) {
      const updateDoc = {
        name,
        biography: summary,
        sources: ['Wikipedia']
      };

      if (existing) {
        await NarratorModel.updateOne({ name }, { $set: updateDoc });
        updated++;
        console.log('Mis à jour.');
      } else {
        await NarratorModel.create(updateDoc);
        inserted++;
        console.log('Créé.');
      }
    } else {
      console.log('Aucun résumé trouvé sur Wikipedia.');
      // On le crée quand même vide pour éviter de requêter en boucle
      if (!existing) {
        await NarratorModel.create({ name });
        inserted++;
      }
    }
  }

  console.log('\n--- TERMINÉ ---');
  console.log(`Insérés : ${inserted}`);
  console.log(`Mis à jour : ${updated}`);

  await mongoose.disconnect();
  console.log('Déconnecté de MongoDB');
  process.exit(0);
}

main().catch((err) => {
  console.error('Erreur fatale :', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
