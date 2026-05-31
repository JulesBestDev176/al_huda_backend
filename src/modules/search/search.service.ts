import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Hadith, HadithDocument } from '../hadith/schemas/hadith.schema';
import { EmbeddingService } from '../embedding/embedding.service';
import { VectorService } from './vector.service';
import { HadithService } from '../hadith/hadith.service';
import { AuthenticityGrade, AUTHENTICITY_SCORE } from '../../common/enums/authenticity.enum';
import { SearchHadithDto } from '../hadith/dto/search-hadith.dto';

export interface SearchResultItem {
  hadith: HadithDocument;
  score: number;
  scoreVector: number;
  scoreText: number;
  scoreAuthenticity: number;
  matchType: 'vector' | 'text' | 'hybrid';
}

export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  query: string;
  took: number; // ms
  summary?: SearchSummary;
}

export interface SearchSummary {
  text: string;
  keyPoints: string[];
  references: Array<{
    id: string;
    collection: string;
    reference: string;
    grade: string;
  }>;
  generatedBy: 'local-extractive';
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectModel(Hadith.name) private hadithModel: Model<HadithDocument>,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorService: VectorService,
    private readonly hadithService: HadithService,
  ) {}

  // ─── Recherche hybride principale ─────────────────────────────────────────
  async search(dto: SearchHadithDto): Promise<SearchResponse> {
    const start = Date.now();
    const { q, grade, collection, topic, narrator, excludeMawdu = true, limit = 10, offset = 0 } = dto;

    this.logger.debug(`Recherche : "${q}"`);

    // Lancer les deux recherches en parallèle
    const [vectorResults, textResults] = await Promise.allSettled([
      this.vectorSearch(q, grade, collection, excludeMawdu, 30),
      this.fullTextSearch(q, grade, collection, topic, narrator, excludeMawdu, 30),
    ]);

    const vResults =
      vectorResults.status === 'fulfilled' ? vectorResults.value : [];
    const tResults =
      textResults.status === 'fulfilled' ? textResults.value : [];

    if (vectorResults.status === 'rejected') {
      this.logger.warn(`Vector search échouée: ${vectorResults.reason?.message}`);
    }

    // Fusion RRF (Reciprocal Rank Fusion)
    const merged = this.reciprocalRankFusion(vResults, tResults);

    // Re-ranking par authenticité
    const reranked = await this.rerankByAuthenticity(merged);

    // Pagination
    const paginated = reranked.slice(offset, offset + limit);

    return {
      results: paginated,
      total: reranked.length,
      query: q,
      took: Date.now() - start,
      summary: await this.generateSummary(q, paginated),
    };
  }

  private async generateSummary(query: string, results: SearchResultItem[]): Promise<SearchSummary | undefined> {
    if (results.length === 0) return undefined;

    const topResults = results.slice(0, 5);

    const hadithsContext = topResults.slice(0, 3).map((r, i) => {
      const grade = r.hadith.authenticity?.grade || 'unknown';
      const text = r.hadith.textFrench.replace(/\s+/g, ' ').trim().slice(0, 350);
      return `[${i + 1}] ${r.hadith.collectionLabel} n°${r.hadith.numberInCollection} (${grade}) :\n${text}`;
    }).join('\n\n');

    let summaryText: string;
    try {
      summaryText = await this.embeddingService.chat([
        {
          role: 'system',
          content:
            "Tu es un assistant islamique spécialisé en hadiths. Tu rédiges des réponses courtes, claires et naturelles en français. Tu n'utilises jamais de listes à puces. Tu écris uniquement un paragraphe fluide de 2 à 4 phrases qui répond directement à la question posée, en t'appuyant sur les hadiths fournis.",
        },
        {
          role: 'user',
          content: `Question : "${query}"\n\nHadiths :\n${hadithsContext}\n\nRéponds en un seul paragraphe naturel et humain, directement lié à la question.`,
        },
      ], 280);
    } catch (err: any) {
      this.logger.warn(`Génération résumé IA échouée: ${err.message}`);
      return undefined;
    }

    return {
      text: summaryText.trim(),
      keyPoints: [],
      references: topResults.map((r) => ({
        id: (r.hadith._id as any).toString(),
        collection: r.hadith.collectionLabel,
        reference: r.hadith.reference || `n°${r.hadith.numberInCollection}`,
        grade: r.hadith.authenticity?.grade || 'unknown',
      })),
      generatedBy: 'local-extractive',
    };
  }

  // ─── Autocomplétion / suggestions ─────────────────────────────────────────
  async suggest(query: string, limit = 5): Promise<string[]> {
    const hadiths = await this.hadithModel
      .find(
        { $text: { $search: query } },
        { score: { $meta: 'textScore' }, narrator: 1, textFrench: 1 },
      )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .exec();

    // Retourner les premiers mots des textes trouvés comme suggestions
    return hadiths.map((h) => {
      const words = h.textFrench.split(' ').slice(0, 8).join(' ');
      return `${words}...`;
    });
  }

  // ─── Recherche vectorielle via Qdrant ─────────────────────────────────────
  private async vectorSearch(
    query: string,
    grade?: string,
    collection?: string,
    excludeMawdu = true,
    limit = 30,
  ): Promise<Array<{ id: string; score: number }>> {
    const queryVector = await this.embeddingService.embed(query);

    const filter = this.buildQdrantFilter(grade, collection, excludeMawdu);
    const results = await this.vectorService.search(queryVector, limit, filter);

    return results.map((r) => ({ id: r.id, score: r.score }));
  }

  // ─── Recherche full-text MongoDB ──────────────────────────────────────────
  private async fullTextSearch(
    query: string,
    grade?: string,
    collection?: string,
    topic?: string,
    narrator?: string,
    excludeMawdu = true,
    limit = 30,
  ): Promise<Array<{ id: string; score: number }>> {
    const filter: any = { $text: { $search: query } };

    if (grade) filter['authenticity.grade'] = grade;
    if (collection) filter.collection = collection;
    if (topic) filter.topics = topic;
    if (narrator) filter.narrator = { $regex: narrator, $options: 'i' };
    if (excludeMawdu && !grade) {
      filter['authenticity.grade'] = { $ne: AuthenticityGrade.MAWDU };
    }

    const hadiths = await this.hadithModel
      .find(filter, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .exec();

    // Normaliser les scores entre 0 et 1
    const maxScore = Math.max(...hadiths.map((h: any) => h._doc?.score || h.score || 1));

    return hadiths.map((h: any) => ({
      id: (h._id as any).toString(),
      score: ((h._doc?.score || h.score || 0) / maxScore) as number,
    }));
  }

  // ─── Fusion RRF (Reciprocal Rank Fusion) ──────────────────────────────────
  // Combine les deux listes de résultats en un score unifié
  private reciprocalRankFusion(
    vectorResults: Array<{ id: string; score: number }>,
    textResults: Array<{ id: string; score: number }>,
    k = 60,
  ): Map<string, { scoreVector: number; scoreText: number; rrfScore: number }> {
    const scores = new Map<
      string,
      { scoreVector: number; scoreText: number; rrfScore: number }
    >();

    // Ajouter scores vectoriels
    vectorResults.forEach((r, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      scores.set(r.id, {
        scoreVector: r.score,
        scoreText: 0,
        rrfScore,
      });
    });

    // Fusionner scores texte
    textResults.forEach((r, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      if (scores.has(r.id)) {
        const existing = scores.get(r.id)!;
        existing.scoreText = r.score;
        existing.rrfScore += rrfScore;
      } else {
        scores.set(r.id, {
          scoreVector: 0,
          scoreText: r.score,
          rrfScore,
        });
      }
    });

    return scores;
  }

  // ─── Re-ranking par authenticité ──────────────────────────────────────────
  private async rerankByAuthenticity(
    rrfScores: Map<string, { scoreVector: number; scoreText: number; rrfScore: number }>,
  ): Promise<SearchResultItem[]> {
    if (rrfScores.size === 0) return [];

    // Récupérer les hadiths depuis MongoDB
    const ids = [...rrfScores.keys()];
    const hadiths = await this.hadithModel
      .find({ _id: { $in: ids } })
      .exec();

    const hadithMap = new Map(hadiths.map((h) => [(h._id as any).toString(), h]));

    const results: SearchResultItem[] = [];

    for (const [id, scores] of rrfScores) {
      const hadith = hadithMap.get(id);
      if (!hadith) continue;

      const scoreAuthenticity = hadith.authenticity?.score ?? 0.6;

      // Score final = RRF × authenticité (les hadiths sahih remontent)
      const finalScore = scores.rrfScore * (0.6 + 0.4 * scoreAuthenticity);

      const matchType =
        scores.scoreVector > 0 && scores.scoreText > 0
          ? 'hybrid'
          : scores.scoreVector > 0
          ? 'vector'
          : 'text';

      results.push({
        hadith,
        score: finalScore,
        scoreVector: scores.scoreVector,
        scoreText: scores.scoreText,
        scoreAuthenticity,
        matchType,
      });
    }

    // Trier par score final décroissant
    return results.sort((a, b) => b.score - a.score);
  }

  private buildQdrantFilter(
    grade?: string,
    collection?: string,
    excludeMawdu = true,
  ): Record<string, any> | undefined {
    const must: any[] = [];
    const mustNot: any[] = [];

    if (grade) must.push({ key: 'grade', match: { value: grade } });
    if (collection) must.push({ key: 'collection', match: { value: collection } });
    if (excludeMawdu && !grade) {
      mustNot.push({ key: 'grade', match: { value: AuthenticityGrade.MAWDU } });
    }

    if (must.length === 0 && mustNot.length === 0) return undefined;
    const filter: any = {};
    if (must.length > 0) filter.must = must;
    if (mustNot.length > 0) filter.must_not = mustNot;
    return filter;
  }

  // ─── Indexation des embeddings (à lancer après le scraping) ───────────────
  async indexPendingEmbeddings(batchSize = 50): Promise<{ indexed: number; errors: number }> {
    let indexed = 0;
    let errors = 0;

    while (true) {
      const hadiths = await this.hadithService.findNotEmbedded(batchSize);
      if (hadiths.length === 0) break;

      this.logger.log(`Indexation de ${hadiths.length} hadiths...`);

      // Préparer les textes pour l'embedding
      // On combine le texte arabe et français pour un meilleur matching multilingue
      const texts = hadiths.map(
        (h) => `${h.textFrench} ${h.narrator} ${h.topics?.join(' ') || ''}`.trim(),
      );

      try {
        const vectors = await this.embeddingService.embedBatch(texts);

        const points = hadiths.map((h, i) => ({
          id: (h._id as any).toString(),
          vector: vectors[i],
          payload: {
            collection: h.collection,
            grade: h.authenticity.grade,
            narrator: h.narrator,
            number: h.number,
          },
        }));

        await this.vectorService.upsertBatch(points);

        // Marquer comme indexés
        await Promise.all(
          hadiths.map((h, i) =>
            this.hadithService.markEmbedded(
              (h._id as any).toString(),
              `qdrant_${i}`,
            ),
          ),
        );

        indexed += hadiths.length;
      } catch (err: any) {
        this.logger.error(`Erreur batch embedding: ${err.message}`);
        errors += hadiths.length;
      }
    }

    this.logger.log(`Indexation terminée: ${indexed} indexés, ${errors} erreurs`);
    return { indexed, errors };
  }
}
