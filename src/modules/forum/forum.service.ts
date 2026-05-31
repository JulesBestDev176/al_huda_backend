import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { ForumQuestion, ForumQuestionDocument } from './schemas/forum-question.schema';
import { ForumAnswer, ForumAnswerDocument } from './schemas/forum-answer.schema';
import { CreateQuestionDto } from './dto/create-question.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';

interface AiModeration {
  approved: boolean;
  reason: string;
  flags: string[];
  topics?: string[];
}

export interface SimilarQuestion {
  _id: string;
  title: string;
  score: number;
}

export type CreateQuestionResult =
  | {
      duplicate: true;
      similar: SimilarQuestion[];
    }
  | {
      duplicate: false;
      question: {
        _id: unknown;
        title: string;
        status: string;
        approved: boolean;
        reason: string;
      };
    };

@Injectable()
export class ForumService {
  private readonly logger = new Logger(ForumService.name);

  constructor(
    @InjectModel(ForumQuestion.name) private questionModel: Model<ForumQuestionDocument>,
    @InjectModel(ForumAnswer.name) private answerModel: Model<ForumAnswerDocument>,
    private readonly configService: ConfigService,
  ) {}

  // ─── Liste des questions approuvées ───────────────────────────────────────
  async getQuestions(limit = 20, offset = 0, topic?: string) {
    const filter: any = { status: 'approved' };
    if (topic) filter.topics = topic;

    const [data, total] = await Promise.all([
      this.questionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .select('-authorEmail -aiAnalysis -views')
        .lean()
        .exec(),
      this.questionModel.countDocuments(filter),
    ]);

    const questionIds = data.map((q: any) => q._id);
    const answerCounts = await this.answerModel.aggregate([
      { $match: { questionId: { $in: questionIds }, status: 'approved' } },
      { $group: { _id: '$questionId', count: { $sum: 1 } } },
    ]);
    const countsByQuestionId = new Map(
      answerCounts.map((item) => [item._id.toString(), item.count]),
    );

    return {
      data: data.map((question: any) => ({
        ...question,
        answersCount: countsByQuestionId.get(question._id.toString()) ?? 0,
      })),
      total,
    };
  }

  // ─── Détail d'une question avec ses réponses approuvées ───────────────────
  async getQuestion(id: string) {
    const questionId = new Types.ObjectId(id);

    const [question, answers] = await Promise.all([
      this.questionModel.findById(id).select('-authorEmail -views').lean().exec(),
      this.answerModel
        .find({ questionId, status: 'approved' })
        .sort({ createdAt: 1 })
        .select('-authorEmail')
        .lean()
        .exec(),
    ]);

    return {
      question: question ? { ...question, answersCount: answers.length } : question,
      answers,
    };
  }

  // ─── Créer une question (avec analyse IA + détection doublon) ─────────────
  async createQuestion(dto: CreateQuestionDto): Promise<CreateQuestionResult> {
    // 1. Détecter les doublons
    const similar = await this.findSimilarQuestions(dto.title + ' ' + dto.body);
    if (similar.length > 0) {
      return { duplicate: true, similar };
    }

    // 2. Modération IA de la question
    const moderation = await this.moderateContent(
      'question',
      `Titre: ${dto.title}\n\nContenu: ${dto.body}`,
    );

    const status = moderation.approved ? 'approved' : 'rejected';

    // Topics : préférer la classification IA, sinon fallback keyword
    const aiTopics = moderation.topics?.filter((t) => t.trim().length > 0) ?? [];
    const topics = aiTopics.length > 0 ? aiTopics.slice(0, 3) : this.extractTopics(dto.title + ' ' + dto.body);

    const question = await this.questionModel.create({
      title: dto.title,
      body: dto.body,
      authorEmail: dto.authorEmail,
      authorName: dto.authorName || 'Anonyme',
      status,
      aiAnalysis: moderation,
      topics,
    });

    return {
      duplicate: false,
      question: {
        _id: question._id,
        title: question.title,
        status: question.status,
        approved: moderation.approved,
        reason: moderation.reason,
      },
    };
  }

  // ─── Créer une réponse (avec modération IA) ───────────────────────────────
  async createAnswer(dto: CreateAnswerDto) {
    const question = await this.questionModel.findById(dto.questionId);
    if (!question) throw new BadRequestException('Question introuvable');

    // Modération IA de la réponse
    const moderation = await this.moderateContent(
      'answer',
      `Question: ${question.title}\n\nRéponse proposée: ${dto.body}`,
    );

    const status = moderation.approved ? 'approved' : 'rejected';

    if (status === 'rejected') {
      return {
        _id: '',
        status,
        approved: false,
        reason: moderation.reason,
        flags: moderation.flags,
      };
    }

    const answer = await this.answerModel.create({
      questionId: dto.questionId,
      body: dto.body,
      authorEmail: dto.authorEmail,
      authorName: dto.authorName || 'Anonyme',
      status,
      aiAnalysis: moderation,
    });

    await this.questionModel.updateOne(
      { _id: dto.questionId },
      { $inc: { answersCount: 1 } },
    );

    return {
      _id: answer._id,
      status: answer.status,
      approved: moderation.approved,
      reason: moderation.reason,
      flags: moderation.flags,
    };
  }

  // ─── Modération IA via Groq ────────────────────────────────────────────────
  private async moderateContent(type: 'question' | 'answer', content: string): Promise<AiModeration> {
    const groqKey = this.configService.get<string>('GROQ_API_KEY', '');
    if (!groqKey) {
      this.logger.warn('GROQ_API_KEY absent — modération désactivée, approbation automatique');
      return { approved: true, reason: 'Modération non configurée', flags: [] };
    }

    const systemPrompt = type === 'answer'
      ? `Tu es un modérateur islamique strict et bienveillant. Analyse ce message publié en réponse à une question islamique.

IMPORTANT :
- Le message peut être une réponse complète, une réponse partielle, une demande de précision, ou une nouvelle question liée à la question initiale.
- Une question de suivi ou une demande de clarification doit être approuvée si elle est respectueuse, sérieuse et liée à l'Islam.
- Ne rejette pas un message uniquement parce qu'il ne cite pas de source : cette exigence concerne surtout les affirmations religieuses présentées comme réponses.

RÈGLES D'APPROBATION :
- Tout message doit être respectueux, sérieux, et lié au sujet islamique discuté.
- Si le message pose une question ou demande une précision, approuve-le sauf s'il enfreint les règles de rejet.
- Si le message affirme un jugement religieux, il doit être basé sur le Coran, la Sunnah authentique, et les savants reconnus par la majorité des musulmans sunnites.
- Les citations d'autorités doctrinales doivent viser des savants classiques reconnus (Ibn Hajar, An-Nawawi, Ibn Taymiyya, Cheikh Al-Albani, Ibn Baz, Ibn Uthaymin, Al-Qurtubi, Ibn Kathir, etc.).
- Le message ne doit pas propager des innovations blameables (bid'a).
- Le message ne doit pas citer des guides de tariqas (confréries soufies) comme autorité doctrinale.
- Le message ne doit pas contenir de mensonges ou de hadiths inventés / faibles présentés comme authentiques.

RÈGLES DE REJET — rejeter si :
- Insultes ou langage irrespectueux envers quiconque
- Références à des doctrines de tariqas (Tijaniyya, Mouridiyya, Qadiriyya etc.) comme source de hukm
- Innovations doctrinales non fondées sur les textes
- Hadiths faibles (da'if) ou inventés (mawdu) cités comme preuve
- Contenu hors sujet islamique ou insensé

RÈGLES DE PRÉCISION :
- Ne mentionne jamais un problème absent du message. Si le message n'insulte personne, ne parle pas d'insultes.
- Les flags doivent décrire uniquement les problèmes réellement constatés.
- Si le message est trop vague, incomplet ou donne une règle religieuse manifestement fausse, explique précisément ce point.
- Exemple : "tu donnes tout ton argent. pas de calcule" doit être rejeté pour réponse inexacte/manque de précision sur le calcul, pas pour insulte.
- La raison doit être concrète et utile pour l'utilisateur, sans formulation générique.

Réponds UNIQUEMENT en JSON valide :
{"approved": true/false, "reason": "explication courte en français (max 100 chars)", "flags": ["liste des problèmes si rejeté"]}
`
      : `Tu es un modérateur islamique. Analyse cette question posée sur un forum islamique.

RÈGLES : La question doit être sérieuse, respectueuse, liée à l'Islam (Coran, Sunnah, fiqh, akida, ibadah, muamalat, adab). Rejeter si : insultes, provocation, blasphème, sujet hors Islam, spam, contenu politique violent.

THÈMES DISPONIBLES (choisir 1 à 3 parmi) :
Prière, Jeûne, Zakat, Hajj, Foi, Famille, Halal/Haram, Invocation, Comportement, Coran, Commerce, Funérailles

Réponds UNIQUEMENT en JSON valide :
{"approved": true/false, "reason": "explication courte en français (max 100 chars)", "flags": [], "topics": ["thème1", "thème2"]}
`;

    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: this.configService.get<string>('SUMMARY_MODEL', 'llama-3.1-8b-instant'),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content },
          ],
          max_tokens: 200,
          stream: false,
          temperature: 0.1,
        },
        {
          headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          timeout: 12000,
        },
      );

      const raw = response.data.choices[0].message.content as string;
      // Extraire le JSON même si entouré de texte
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Réponse IA non parseable');

      return JSON.parse(jsonMatch[0]) as AiModeration;
    } catch (err: any) {
      this.logger.error(`Modération IA échouée: ${err.message}`);
      // En cas d'erreur, approuver par défaut mais logger
      return { approved: true, reason: 'Modération temporairement indisponible', flags: [] };
    }
  }

  // ─── Détecter les questions similaires ────────────────────────────────────
  private async findSimilarQuestions(text: string): Promise<SimilarQuestion[]> {
    const results = await this.questionModel
      .find(
        { $text: { $search: text }, status: 'approved' },
        { score: { $meta: 'textScore' } },
      )
      .sort({ score: { $meta: 'textScore' } })
      .limit(3)
      .select('_id title')
      .exec();

    return results
      .map((r: any) => ({
        _id: (r._id as any).toString(),
        title: r.title as string,
        score: (r._doc?.score || r.score || 0) as number,
      }))
      .filter((r) => r.score > 1.5); // seuil de similarité
  }

  // ─── Extraction basique des topics ────────────────────────────────────────
  private extractTopics(text: string): string[] {
    const lower = text.toLowerCase();
    const map: Record<string, string[]> = {
      'Prière': ['prière', 'salat', 'sujud', 'wudu', 'ablution', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha'],
      'Jeûne': ['jeûne', 'ramadan', 'iftar', 'suhur', 'siyam'],
      'Zakat': ['zakat', 'aumône', 'zakât'],
      'Hajj': ['hajj', 'pèlerinage', 'umra', 'la mecque', 'ihram'],
      'Foi': ['foi', 'iman', 'aqida', 'akida', 'croyance', 'tawhid', 'unicité'],
      'Famille': ['mariage', 'divorce', 'famille', 'enfant', 'parent', 'mère', 'père'],
      'Halal/Haram': ['halal', 'haram', 'interdit', 'licite', 'illicite', 'permis'],
      'Invocation': ['dua', 'dhikr', 'invocation', 'supplication', 'dikr'],
      'Comportement': ['comportement', 'adab', 'morale', 'caractère', 'vertu'],
      'Coran': ['coran', 'sourate', 'verset', 'récitation', 'quran'],
      'Commerce': ['commerce', 'vente', 'achat', 'riba', 'intérêt', 'transaction'],
      'Funérailles': ['mort', 'décès', 'funéraille', 'janaza', 'deuil', 'enterrement'],
    };

    const found = new Set<string>();
    for (const [topic, keywords] of Object.entries(map)) {
      if (keywords.some((kw) => lower.includes(kw))) found.add(topic);
    }
    return Array.from(found).slice(0, 3);
  }
}
