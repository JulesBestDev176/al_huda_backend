import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BibliothequeIslamiqueScraper } from './scrapers/bibliotheque-islamique.scraper';
import { HadithService } from '../hadith/hadith.service';
import {
  AuthenticityGrade,
  AUTHENTICITY_SCORE,
} from '../../common/enums/authenticity.enum';
import { HadithRaw, CollectionInfo } from '../../common/interfaces/hadith-raw.interface';

export interface ScrapeResult {
  collection: string;
  totalScraped: number;
  totalUpserted: number;
  errors: string[];
  durationMs: number;
}

export interface ScrapeStatus {
  isRunning: boolean;
  currentCollection?: string;
  currentBook?: string;
  progress?: { done: number; total: number };
  lastRun?: Date;
  lastResult?: ScrapeResult[];
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private status: ScrapeStatus = { isRunning: false };
  private readonly concurrency: number;

  constructor(
    private readonly scraper: BibliothequeIslamiqueScraper,
    private readonly hadithService: HadithService,
    private configService: ConfigService,
  ) {
    this.concurrency = this.configService.get<number>('SCRAPER_CONCURRENCY', 2);
  }

  getStatus(): ScrapeStatus {
    return this.status;
  }

  // ─── Scraper toutes les collections ───────────────────────────────────────
  async scrapeAll(collectionIds?: string[]): Promise<ScrapeResult[]> {
    if (this.status.isRunning) {
      this.logger.warn('Scraping déjà en cours, ignoré.');
      return [];
    }

    const collections = this.scraper
      .getCollections()
      .filter((c) => !collectionIds || collectionIds.includes(c.id));

    this.status = { isRunning: true, lastRun: new Date() };
    const results: ScrapeResult[] = [];

    for (const collection of collections) {
      const result = await this.scrapeCollection(collection);
      results.push(result);
    }

    this.status = { isRunning: false, lastRun: new Date(), lastResult: results };
    return results;
  }

  // ─── Scraper une collection ────────────────────────────────────────────────
  async scrapeCollection(collection: CollectionInfo): Promise<ScrapeResult> {
    const start = Date.now();
    const errors: string[] = [];
    let totalScraped = 0;
    let totalUpserted = 0;

    this.logger.log(`=== Début scraping : ${collection.label} ===`);
    this.status.currentCollection = collection.label;

    try {
      // 1. Récupérer la liste des livres
      const books = await this.scraper.scrapeBooks(collection);
      this.status.progress = { done: 0, total: books.length };

      // 2. Dédupliquer les URLs (ex: nawawi40 renvoie la même page 44 fois)
      const seenUrls = new Set<string>();
      const uniqueBooks = books.filter((b) => {
        const baseUrl = b.url.split('#')[0];
        if (seenUrls.has(baseUrl)) return false;
        seenUrls.add(baseUrl);
        return true;
      });
      this.logger.log(`  ${uniqueBooks.length} pages uniques (${books.length} livres)`);

      // 3. Scraper chaque livre avec concurrence limitée
      const chunks = this.chunk(uniqueBooks, this.concurrency);

      for (const chunk of chunks) {
        const promises = chunk.map(async (book) => {
          try {
            this.status.currentBook = book.nameFrench;
            const raws = await this.scraper.scrapeBookPage(book);
            const hadithsToSave = raws.map((r) => this.rawToHadith(r));
            const upserted = await this.hadithService.upsertMany(hadithsToSave);
            totalScraped += raws.length;
            totalUpserted += upserted;
            this.logger.log(
              `  ✓ ${book.nameFrench} : ${raws.length} hadiths (${upserted} nouveaux)`,
            );
          } catch (err: any) {
            const msg = `Erreur sur ${book.nameFrench}: ${err.message}`;
            this.logger.error(msg);
            errors.push(msg);
          } finally {
            this.status.progress!.done++;
          }
        });

        await Promise.all(promises);
      }
    } catch (err: any) {
      const msg = `Erreur fatale sur ${collection.label}: ${err.message}`;
      this.logger.error(msg);
      errors.push(msg);
    }

    const result: ScrapeResult = {
      collection: collection.id,
      totalScraped,
      totalUpserted,
      errors,
      durationMs: Date.now() - start,
    };

    this.logger.log(
      `=== Fin scraping ${collection.label} : ${totalScraped} hadiths, ${totalUpserted} nouveaux (${result.durationMs}ms) ===`,
    );

    return result;
  }

  // ─── Convertir HadithRaw → format Hadith (Mongoose) ───────────────────────
  private rawToHadith(raw: HadithRaw): any {
    const { grade, gradeArabic, gradeFrench } = this.scraper.detectGrade(
      raw.gradeText || '',
      raw.textFrench,
      { collectionId: raw.collection } as any,
    );

    return {
      number: raw.number,
      numberInCollection: raw.numberInCollection,
      textFrench: raw.textFrench,
      textArabic: raw.textArabic,
      narrator: raw.narrator,
      isnad: raw.isnad || '',
      collection: raw.collection,
      collectionLabel: raw.collectionLabel,
      bookName: raw.bookName,
      bookSlug: raw.bookSlug,
      authenticity: {
        grade,
        gradeArabic,
        gradeFrench,
        gradeRaw: raw.gradeText,
        score: AUTHENTICITY_SCORE[grade],
      },
      topics: raw.topics ?? [],
      commentary: raw.commentary,
      scholarRef: raw.scholarRef,
      scholarCommentaries: raw.scholarCommentaries ?? [],
      sourceUrl: raw.sourceUrl,
      reference: raw.reference,
      isEmbedded: false,
    };
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
