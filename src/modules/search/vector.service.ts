import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface VectorSearchResult {
  id: string;
  score: number;
  payload: Record<string, any>;
}

@Injectable()
export class VectorService implements OnModuleInit {
  private readonly logger = new Logger(VectorService.name);
  private readonly http: AxiosInstance | null = null;
  private readonly collection: string;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    const qdrantUrl = this.configService.get<string>('QDRANT_URL', '');
    const apiKey = this.configService.get<string>('QDRANT_API_KEY', '');
    this.collection = this.configService.get<string>('QDRANT_COLLECTION', 'hadiths');

    this.enabled = this.isValidUrl(qdrantUrl);

    if (this.enabled) {
      this.http = axios.create({
        baseURL: qdrantUrl,
        headers: apiKey ? { 'api-key': apiKey } : {},
        timeout: 10000,
      });
    } else {
      this.logger.warn('QDRANT_URL non configuré — recherche vectorielle désactivée');
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  async onModuleInit() {
    if (this.enabled) await this.ensureCollection();
  }

  // ─── Crée la collection Qdrant si elle n'existe pas ───────────────────────
  async ensureCollection(): Promise<void> {
    if (!this.http) return;
    try {
      await this.http.get(`/collections/${this.collection}`);
      this.logger.log(`Collection Qdrant "${this.collection}" existe déjà`);
    } catch {
      this.logger.log(`Création de la collection Qdrant "${this.collection}"...`);
      await this.http.put(`/collections/${this.collection}`, {
        vectors: {
          size: 1024, // taille des vecteurs multilingual-e5-large
          distance: 'Cosine',
        },
      });
      this.logger.log('Collection Qdrant créée');
    }
  }

  // ─── Indexer un hadith ────────────────────────────────────────────────────
  async upsert(
    id: string,
    vector: number[],
    payload: Record<string, any>,
  ): Promise<void> {
    if (!this.http) return;
    await this.http.put(`/collections/${this.collection}/points`, {
      points: [{ id: this.hashId(id), vector, payload: { ...payload, mongoId: id } }],
    });
  }

  async upsertBatch(
    points: Array<{ id: string; vector: number[]; payload: Record<string, any> }>,
  ): Promise<void> {
    if (!this.http) return;
    const qdrantPoints = points.map((p) => ({
      id: this.hashId(p.id),
      vector: p.vector,
      payload: { ...p.payload, mongoId: p.id },
    }));

    await this.http.put(`/collections/${this.collection}/points`, {
      points: qdrantPoints,
    });
  }

  // ─── Recherche par similarité vectorielle ─────────────────────────────────
  async search(
    vector: number[],
    limit = 20,
    filter?: Record<string, any>,
  ): Promise<VectorSearchResult[]> {
    if (!this.http) return [];
    const body: any = {
      vector,
      limit,
      with_payload: true,
      with_vector: false,
    };

    if (filter) {
      body.filter = filter;
    }

    const response = await this.http.post(
      `/collections/${this.collection}/points/search`,
      body,
    );

    return response.data.result.map((r: any) => ({
      id: r.payload.mongoId,
      score: r.score,
      payload: r.payload,
    }));
  }

  // ─── Filtre Qdrant pour le grade d'authenticité ───────────────────────────
  buildGradeFilter(grade?: string, excludeMawdu = true): Record<string, any> | undefined {
    const must: any[] = [];

    if (grade) {
      must.push({ key: 'grade', match: { value: grade } });
    }

    if (excludeMawdu && !grade) {
      must.push({
        key: 'grade',
        match: { except: ['mawdu'] },
      });
    }

    return must.length > 0 ? { must } : undefined;
  }

  // Convertit un string MongoDB ObjectId en entier Qdrant (requis par l'API)
  private hashId(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  async getCollectionInfo(): Promise<any> {
    if (!this.http) return null;
    const response = await this.http.get(`/collections/${this.collection}`);
    return response.data.result;
  }
}
