/**
 * Script de scraping complet — stocke directement dans MongoDB
 *
 * Usage :
 *   npx ts-node scripts/run-scraper.ts
 *   npx ts-node scripts/run-scraper.ts --collection bukhari
 *   npx ts-node scripts/run-scraper.ts --collection bukhari,muslim
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ScraperService } from '../src/modules/scraper/scraper.service';

async function main() {
  const args = process.argv.slice(2);
  let collectionIds: string[] | undefined;

  const collArg = args.find((a) => a.startsWith('--collection='));
  if (collArg) {
    collectionIds = collArg.replace('--collection=', '').split(',');
  }

  console.log('Démarrage du scraping...');
  if (collectionIds) {
    console.log(`Collections ciblées : ${collectionIds.join(', ')}`);
  } else {
    console.log('Toutes les collections seront scrapées');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const scraperService = app.get(ScraperService);
  const results = await scraperService.scrapeAll(collectionIds);

  console.log('\n=== RÉSUMÉ DU SCRAPING ===');
  results.forEach((r) => {
    console.log(`\n${r.collection}:`);
    console.log(`  Scraped  : ${r.totalScraped} hadiths`);
    console.log(`  Nouveaux : ${r.totalUpserted} hadiths`);
    console.log(`  Durée    : ${(r.durationMs / 1000).toFixed(1)}s`);
    if (r.errors.length > 0) {
      console.log(`  Erreurs  : ${r.errors.length}`);
      r.errors.forEach((e) => console.log(`    - ${e}`));
    }
  });

  const totalScraped = results.reduce((s, r) => s + r.totalScraped, 0);
  const totalNew = results.reduce((s, r) => s + r.totalUpserted, 0);
  console.log(`\nTotal : ${totalScraped} hadiths scrapés, ${totalNew} nouveaux`);

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
