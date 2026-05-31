/**
 * Génère les embeddings pour tous les hadiths non encore indexés
 * À lancer APRÈS run-scraper.ts
 *
 * Usage :
 *   npx ts-node scripts/run-embeddings.ts
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SearchService } from '../src/modules/search/search.service';

async function main() {
  console.log('Démarrage de l\'indexation des embeddings...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const searchService = app.get(SearchService);
  const result = await searchService.indexPendingEmbeddings(50);

  console.log('\n=== RÉSUMÉ EMBEDDINGS ===');
  console.log(`Indexés : ${result.indexed}`);
  console.log(`Erreurs : ${result.errors}`);

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
