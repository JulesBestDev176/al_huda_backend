import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('HUGGINGFACE_API_KEY', '');
    this.model = this.configService.get<string>(
      'EMBEDDING_MODEL',
      'intfloat/multilingual-e5-large',
    );
  }

  // ─── Génère l'embedding d'un texte via HuggingFace Inference API ──────────
  async embed(text: string): Promise<number[]> {
    // Pour multilingual-e5, on préfixe la requête avec "query: "
    const input = `query: ${text}`;
    return this.callHuggingFace(input);
  }

  // Pour les documents (hadiths stockés), on préfixe avec "passage: "
  async embedDocument(text: string): Promise<number[]> {
    const input = `passage: ${text}`;
    return this.callHuggingFace(input);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const inputs = texts.map((t) => `passage: ${t}`);
    const url = `https://router.huggingface.co/hf-inference/models/${this.model}`;

    try {
      const response = await axios.post(
        url,
        { inputs },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        },
      );
      return response.data as number[][];
    } catch (err: any) {
      this.logger.error(`Erreur embedding batch: ${err.message}`);
      throw err;
    }
  }

  private async callHuggingFace(input: string): Promise<number[]> {
    const url = `https://router.huggingface.co/hf-inference/models/${this.model}`;

    try {
      const response = await axios.post(
        url,
        { inputs: input },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      // L'API retourne un tableau ou un tableau de tableaux
      const data = response.data;
      if (Array.isArray(data) && Array.isArray(data[0])) return data[0];
      if (Array.isArray(data)) return data;
      throw new Error('Format de réponse inattendu');
    } catch (err: any) {
      // Si le modèle est en chargement (503), attendre et réessayer
      if (err.response?.status === 503) {
        this.logger.warn('Modèle en chargement, attente 20s...');
        await new Promise((r) => setTimeout(r, 20000));
        return this.callHuggingFace(input);
      }
      this.logger.error(`Erreur embedding: ${err.message}`);
      throw err;
    }
  }

  // ─── Génère un résumé textuel via Groq (gratuit, OpenAI-compatible) ───────
  async chat(messages: Array<{ role: string; content: string }>, maxTokens = 300): Promise<string> {
    const groqKey = this.configService.get<string>('GROQ_API_KEY', '');
    if (!groqKey) throw new Error('GROQ_API_KEY non configuré');

    const model = this.configService.get<string>('SUMMARY_MODEL', 'llama-3.1-8b-instant');

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      { model, messages, max_tokens: maxTokens, stream: false },
      {
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    );

    return response.data.choices[0].message.content as string;
  }

  // Calcule la similarité cosinus entre deux vecteurs
  cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
    const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
    if (magA === 0 || magB === 0) return 0;
    return dot / (magA * magB);
  }
}
