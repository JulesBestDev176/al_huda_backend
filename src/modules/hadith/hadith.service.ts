import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Hadith, HadithDocument } from './schemas/hadith.schema';
import { Narrator, NarratorDocument } from './schemas/narrator.schema';
import { AuthenticityGrade } from '../../common/enums/authenticity.enum';

@Injectable()
export class HadithService {
  constructor(
    @InjectModel(Hadith.name) private hadithModel: Model<HadithDocument>,
    @InjectModel(Narrator.name) private narratorModel: Model<NarratorDocument>,
  ) {}

  async findById(id: string): Promise<HadithDocument> {
    const hadith = await this.hadithModel.findById(id).exec();
    if (!hadith) throw new NotFoundException(`Hadith ${id} introuvable`);
    await this.hadithModel.updateOne({ _id: id }, { $inc: { views: 1 } });
    return hadith;
  }

  async findByCollection(
    collection: string,
    limit = 20,
    offset = 0,
    grade?: AuthenticityGrade,
  ): Promise<{ data: HadithDocument[]; total: number }> {
    const filter: any = { collection };
    if (grade) filter['authenticity.grade'] = grade;

    const [data, total] = await Promise.all([
      this.hadithModel
        .find(filter)
        .sort({ number: 1 })
        .skip(offset)
        .limit(limit)
        .exec(),
      this.hadithModel.countDocuments(filter),
    ]);

    return { data, total };
  }

  async getCollections(): Promise<any[]> {
    return this.hadithModel.aggregate([
      {
        $group: {
          _id: '$collection',
          label: { $first: '$collectionLabel' },
          total: { $sum: 1 },
          sahihCount: {
            $sum: {
              $cond: [{ $eq: ['$authenticity.grade', 'sahih'] }, 1, 0],
            },
          },
        },
      },
      { $sort: { total: -1 } },
    ]);
  }

  async getRandomSahih(): Promise<HadithDocument> {
    const count = await this.hadithModel.countDocuments({
      'authenticity.grade': { $in: [AuthenticityGrade.SAHIH, AuthenticityGrade.SAHIH_HASAN] },
    });
    const random = Math.floor(Math.random() * count);
    return this.hadithModel
      .findOne({
        'authenticity.grade': { $in: [AuthenticityGrade.SAHIH, AuthenticityGrade.SAHIH_HASAN] },
      })
      .skip(random)
      .exec();
  }

  async getTopics(): Promise<string[]> {
    const result = await this.hadithModel.aggregate([
      { $unwind: '$topics' },
      { $group: { _id: '$topics', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]);
    return result.map((r) => r._id);
  }

  async findByTopic(
    topic: string,
    limit = 20,
    offset = 0,
  ): Promise<{ data: HadithDocument[]; total: number }> {
    const filter = { topics: topic };
    const [data, total] = await Promise.all([
      this.hadithModel
        .find(filter)
        .sort({ 'authenticity.score': -1 })
        .skip(offset)
        .limit(limit)
        .exec(),
      this.hadithModel.countDocuments(filter),
    ]);
    return { data, total };
  }

  async getNarratorProfile(name: string): Promise<any> {
    const decodedName = decodeURIComponent(name).trim();
    
    const dbNarrator = await this.narratorModel.findOne({
      $or: [
        { name: new RegExp('^' + decodedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
        { aliases: new RegExp('^' + decodedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
      ]
    }).exec();

    let baseAliases = this.getPersonAliases(decodedName);
    if (dbNarrator && dbNarrator.aliases) {
       baseAliases = [...new Set([...baseAliases, dbNarrator.name, ...dbNarrator.aliases])];
    }
    const aliases = baseAliases;
    const narratorFilter = { narrator: { $in: aliases } };

    const [hadiths, total, collections, books, grades] = await Promise.all([
      this.hadithModel
        .find(narratorFilter)
        .sort({ 'authenticity.score': -1, number: 1 })
        .limit(20)
        .exec(),
      this.hadithModel.countDocuments(narratorFilter),
      this.hadithModel.aggregate([
        { $match: narratorFilter },
        { $group: { _id: '$collection', label: { $first: '$collectionLabel' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.hadithModel.aggregate([
        { $match: narratorFilter },
        { $group: { _id: '$bookName', collection: { $first: '$collectionLabel' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),
      this.hadithModel.aggregate([
        { $match: narratorFilter },
        { $group: { _id: '$authenticity.grade', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const curated = this.getCuratedPerson(decodedName);
    if (!curated && !dbNarrator && total === 0) {
      throw new NotFoundException(`Personne ${decodedName} introuvable`);
    }

    return {
      name: dbNarrator?.name || curated?.name || decodedName,
      aliases,
      role: dbNarrator?.role || curated?.role || 'Narrateur présent dans le corpus',
      biography:
        dbNarrator?.biography ||
        curated?.biography ||
        `Cette fiche est générée depuis les hadiths actuellement présents dans la base. Elle regroupe les textes où "${decodedName}" apparaît comme narrateur principal.`,
      bibliography: dbNarrator?.bibliography?.length ? dbNarrator.bibliography : (curated?.bibliography || []),
      corpus: {
        totalHadiths: total,
        collections,
        books,
        grades,
        hadiths,
      },
      sources: [
        'Corpus local bibliotheque-islamique.fr',
        ...(dbNarrator?.sources || []),
        ...(curated?.sources || []),
      ],
    };
  }

  async findByGrade(
    grade: AuthenticityGrade,
    limit = 20,
    offset = 0,
  ): Promise<{ data: HadithDocument[]; total: number }> {
    const filter = { 'authenticity.grade': grade };
    const [data, total] = await Promise.all([
      this.hadithModel
        .find(filter)
        .sort({ 'authenticity.score': -1, number: 1 })
        .skip(offset)
        .limit(limit)
        .exec(),
      this.hadithModel.countDocuments(filter),
    ]);
    return { data, total };
  }

  async getTopNarrators(limit = 50, offset = 0): Promise<{ data: any[]; total: number }> {
    const pipeline = [
      { $match: { narrator: { $nin: ['', 'Non précisé', null] } } },
      { $group: { _id: '$narrator', count: { $sum: 1 } } },
      { $sort: { count: -1 as const } },
    ];

    const all = await this.hadithModel.aggregate(pipeline);
    const total = all.length;
    const data = all.slice(offset, offset + limit);
    return { data, total };
  }

  async getRecent(limit = 20): Promise<HadithDocument[]> {
    return this.hadithModel
      .find({ 'authenticity.grade': { $in: [AuthenticityGrade.SAHIH, AuthenticityGrade.SAHIH_HASAN, AuthenticityGrade.HASAN] } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  // Recherche full-text MongoDB (BM25)
  async fullTextSearch(
    query: string,
    limit = 20,
    excludeMawdu = true,
  ): Promise<HadithDocument[]> {
    const filter: any = { $text: { $search: query } };
    if (excludeMawdu) {
      filter['authenticity.grade'] = { $ne: AuthenticityGrade.MAWDU };
    }

    return this.hadithModel
      .find(filter, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .exec();
  }

  async upsertMany(hadiths: Partial<Hadith>[]): Promise<number> {
    let upserted = 0;
    for (const h of hadiths) {
      const result = await this.hadithModel.updateOne(
        { collection: h.collection, number: h.number },
        { $set: h },
        { upsert: true },
      );
      if (result.upsertedCount > 0) upserted++;
    }
    return upserted;
  }

  async markEmbedded(id: string, qdrantId: string): Promise<void> {
    await this.hadithModel.updateOne(
      { _id: id },
      { $set: { isEmbedded: true, qdrantId } },
    );
  }

  async findNotEmbedded(limit = 100): Promise<HadithDocument[]> {
    return this.hadithModel
      .find({ isEmbedded: false })
      .limit(limit)
      .exec();
  }

  // Re-parse les commentaires existants pour extraire les savants structurés
  async enrichCommentaries(batchSize = 100): Promise<{ updated: number }> {
    let updated = 0;
    let skip = 0;

    while (true) {
      const hadiths = await this.hadithModel
        .find({ commentary: { $exists: true, $ne: '' }, 'scholarCommentaries.0': { $exists: false } })
        .select('_id commentary scholarRef')
        .skip(skip)
        .limit(batchSize)
        .exec();

      if (hadiths.length === 0) break;

      for (const hadith of hadiths) {
        const commentaryText = hadith.commentary || '';
        if (!commentaryText) continue;

        // Re-parse avec l'extracteur amélioré (importer le scraper n'est pas possible ici,
        // on fait une extraction basique directement)
        const scholarCommentaries: Array<{ scholar: string; work: string; text: string }> = [];
        const noteRegex = /\((\d+)\)\s*(.+?)(?=\(\d+\)|$)/gs;
        let match: RegExpExecArray | null;
        while ((match = noteRegex.exec(commentaryText)) !== null) {
          const text = match[2].trim();
          if (text.length >= 20) {
            scholarCommentaries.push({ scholar: '', work: '', text });
          }
        }

        if (hadith.scholarRef) {
          scholarCommentaries.unshift({ scholar: '', work: hadith.scholarRef, text: '' });
        }

        if (scholarCommentaries.length > 0) {
          await this.hadithModel.updateOne(
            { _id: hadith._id },
            { $set: { scholarCommentaries } },
          );
          updated++;
        }
      }

      skip += batchSize;
    }

    return { updated };
  }

  async getStats(): Promise<any> {
    const [total, byColl, byGrade] = await Promise.all([
      this.hadithModel.countDocuments(),
      this.hadithModel.aggregate([
        { $group: { _id: '$collection', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.hadithModel.aggregate([
        { $group: { _id: '$authenticity.grade', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);
    return { total, byCollection: byColl, byGrade };
  }

  private getPersonAliases(name: string): string[] {
    const normalized = name.toLowerCase();
    const aliases = new Set([name]);

    for (const person of Object.values(CURATED_PEOPLE)) {
      if (
        person.name.toLowerCase() === normalized ||
        person.aliases.some((alias) => alias.toLowerCase() === normalized)
      ) {
        aliases.add(person.name);
        person.aliases.forEach((alias) => aliases.add(alias));
      }
    }

    return [...aliases];
  }

  private getCuratedPerson(name: string): CuratedPerson | undefined {
    const normalized = name.toLowerCase();
    return Object.values(CURATED_PEOPLE).find(
      (person) =>
        person.name.toLowerCase() === normalized ||
        person.aliases.some((alias) => alias.toLowerCase() === normalized),
    );
  }
}

interface CuratedPerson {
  name: string;
  aliases: string[];
  role: string;
  biography: string;
  bibliography: string[];
  sources?: string[];
}

const CURATED_PEOPLE: Record<string, CuratedPerson> = {
  bukhari: {
    name: 'Imam Al-Bukhari',
    aliases: ['Boukhari', 'Al Boukhari', 'Sahih Al Boukhari', 'Muhammad ibn Ismail Al-Bukhari'],
    role: 'Imam du hadith et compilateur',
    biography:
      'Muhammad ibn Ismail Al-Bukhari est un imam majeur de la science du hadith, connu pour son recueil Sahih Al-Bukhari, parmi les références les plus reconnues chez les sunnites.',
    bibliography: ['Sahih Al-Bukhari', 'Al-Adab Al-Mufrad'],
  },
  muslim: {
    name: 'Imam Muslim',
    aliases: ['Mouslim', 'Muslim', 'Sahih Mouslim', 'Muslim ibn al-Hajjaj'],
    role: 'Imam du hadith et compilateur',
    biography:
      'Muslim ibn al-Hajjaj est un imam du hadith connu pour Sahih Muslim, recueil central dans la transmission des hadiths authentiques.',
    bibliography: ['Sahih Muslim'],
  },
  tirmidhi: {
    name: 'Imam At-Tirmidhi',
    aliases: ['Tirmidhi', "Jami' at-Tirmidhi", 'At Tirmidhi'],
    role: 'Imam du hadith et compilateur',
    biography:
      'At-Tirmidhi est un savant du hadith connu pour son Jami, qui mentionne fréquemment les degrés d’authenticité et les avis des juristes.',
    bibliography: ["Jami' at-Tirmidhi", 'Ash-Shamail Al-Muhammadiyya'],
  },
  'abu-daoud': {
    name: 'Imam Abu Dawud',
    aliases: ['Abi Daoud', 'Abou Daoud', 'Abu Dawud', 'Sunan Abi Daoud'],
    role: 'Imam du hadith et compilateur',
    biography:
      'Abu Dawud est un imam du hadith connu pour ses Sunan, recueil particulièrement important pour les chapitres juridiques.',
    bibliography: ['Sunan Abi Dawud'],
  },
  nasai: {
    name: "Imam An-Nasa'i",
    aliases: ["Nasa'i", 'Nasai', 'An Nasai', "Sunan Nasa'i"],
    role: 'Imam du hadith et compilateur',
    biography:
      "An-Nasa'i est un imam du hadith connu pour ses Sunan, l’un des grands recueils de hadith dans la tradition sunnite.",
    bibliography: ["Sunan An-Nasa'i"],
  },
  'ibn-majah': {
    name: 'Imam Ibn Majah',
    aliases: ['Ibn Majah', 'Ibn Maja', 'Sunan Ibn Majah'],
    role: 'Imam du hadith et compilateur',
    biography:
      'Ibn Majah est un imam du hadith connu pour ses Sunan, recueil classé parmi les six grands livres de hadith.',
    bibliography: ['Sunan Ibn Majah'],
  },
};
