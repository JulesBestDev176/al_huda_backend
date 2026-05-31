import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import {
  HadithRaw,
  CollectionInfo,
  BookInfo,
} from '../../../common/interfaces/hadith-raw.interface';
import {
  AuthenticityGrade,
  AUTHENTICITY_SCORE,
  GRADE_KEYWORDS,
  GRADE_KEYWORDS_FR,
} from '../../../common/enums/authenticity.enum';

const BASE_URL = 'https://bibliotheque-islamique.fr';

// Toutes les collections disponibles sur le site
const COLLECTIONS: CollectionInfo[] = [
  {
    id: 'bukhari',
    label: 'Sahih Al Boukhari',
    sommairUrl: `${BASE_URL}/hadith/sommaire-al-boukhari`,
    totalHadiths: 665,
  },
  {
    id: 'muslim',
    label: 'Sahih Mouslim',
    sommairUrl: `${BASE_URL}/hadith/sommaire-mouslim`,
    totalHadiths: 556,
  },
  {
    id: 'tirmidhi',
    label: "Jami' at-Tirmidhi",
    sommairUrl: `${BASE_URL}/hadith/sommaire-jami-at-tirmidhi/`,
    totalHadiths: 366,
  },
  {
    id: 'ibnmajah',
    label: 'Sunan Ibn Majah',
    sommairUrl: `${BASE_URL}/hadith/sommaire-sahih-ibn-majah/`,
    totalHadiths: 173,
  },
  {
    id: 'nasai',
    label: "Sunan Nasa'i",
    sommairUrl: `${BASE_URL}/hadith/sommaire-sahih-an-nasai/`,
    totalHadiths: 110,
  },
  {
    id: 'abudaoud',
    label: 'Sunan Abi Daoud',
    sommairUrl: `${BASE_URL}/hadith/sommaire-sahih-abou-daoud`,
    totalHadiths: 293,
  },
  {
    id: 'riyad',
    label: 'Riyad as-Salihine',
    sommairUrl: `${BASE_URL}/hadith/sommaire-riyad-as-salihin`,
    totalHadiths: 71,
  },
  {
    id: 'nawawi40',
    label: '40 Hadith Nawawi',
    sommairUrl: `${BASE_URL}/hadith/sommaire-40-hadith-nawawi`,
    totalHadiths: 42,
  },
  {
    id: 'qoudousi40',
    label: '40 Hadith Qoudousi',
    sommairUrl: `${BASE_URL}/hadith/40-hadith-qoudousi`,
    totalHadiths: 14,
  },
];

@Injectable()
export class BibliothequeIslamiqueScraper {
  private readonly logger = new Logger(BibliothequeIslamiqueScraper.name);
  private readonly http: AxiosInstance;
  private readonly delayMs: number;

  constructor(private configService: ConfigService) {
    this.delayMs = this.configService.get<number>('SCRAPER_DELAY_MS', 1500);

    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9,ar;q=0.8',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
  }

  getCollections(): CollectionInfo[] {
    return COLLECTIONS;
  }

  // ─── Récupère la liste des livres d'une collection ────────────────────────
  async scrapeBooks(collection: CollectionInfo): Promise<BookInfo[]> {
    this.logger.log(`Scraping sommaire : ${collection.label}`);
    const html = await this.fetchWithRetry(collection.sommairUrl);
    const $ = cheerio.load(html);
    const books: BookInfo[] = [];

    // Les livres sont des liens <a href="/hadith/..."> contenant des <div> avec numéro et titres
    $('a[href*="/hadith/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || href === collection.sommairUrl) return;

      // Filtrer : le lien doit pointer vers un livre de cette collection
      const collectionSlugMap: Record<string, string> = {
        bukhari: 'sahih-al-boukhari-',
        muslim: 'sahih-mouslim-',
        tirmidhi: 'jami-at-tirmidhi-',
        ibnmajah: 'sunan-ibn-majah-',
        nasai: 'sahih-an-nasai-',
        abudaoud: 'sunan-abou-daoud-',
        riyad: 'riyad-as-salihin-',
        nawawi40: '40-hadith-nawawi',
        qoudousi40: '40-hadith-qoudousi',
      };

      const prefix = collectionSlugMap[collection.id];
      if (!prefix) return;

      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      if (!fullUrl.includes(prefix) && !fullUrl.includes(collection.id)) return;

      const divs = $(el).find('div');
      let bookNumber = 0;
      let nameFrench = '';
      let nameArabic = '';

      divs.each((i, div) => {
        const text = $(div).text().trim();
        if (i === 0) bookNumber = parseInt(text, 10) || 0;
        else if (i === 1) nameFrench = text;
        else if (i === 2) nameArabic = text;
      });

      if (!nameFrench && $(el).text().trim()) {
        nameFrench = $(el).text().trim();
      }

      if (fullUrl && nameFrench) {
        books.push({
          collectionId: collection.id,
          bookNumber,
          nameFrench,
          nameArabic: nameArabic || undefined,
          url: fullUrl,
        });
      }
    });

    this.logger.log(`  → ${books.length} livres trouvés pour ${collection.label}`);
    return books;
  }

  // ─── Scrape tous les hadiths d'une page de livre ──────────────────────────
  async scrapeBookPage(book: BookInfo): Promise<HadithRaw[]> {
    this.logger.debug(`  Scraping livre : ${book.nameFrench} (${book.url})`);
    // Strip fragment identifier — HTTP request ignores it anyway
    const pageUrl = book.url.split('#')[0];
    const html = await this.fetchWithRetry(pageUrl);
    const $ = cheerio.load(html);
    const hadiths: HadithRaw[] = [];

    // Le site utilise div.row.book-item pour chaque hadith :
    //   div.tag_search   → numéro (ex: "۞ hadith n°0001" ou "40 Hadith Nawawi » Hadith 01")
    //   div.col-md-6     → texte français + <span class="b"> pour la référence
    //   div.col-md-6.arabic → texte arabe  + <span class="red"> pour la référence arabe
    const rows = $('div.row.book-item, div.row.book-item-white');

    rows.each((_, row) => {
      const $row = $(row);

      // ── Numéro du hadith ──────────────────────────────────────────────────
      const tagText = $row.find('.tag_search').text().trim();
      const numMatch = tagText.match(/hadith\s+(?:n[°o]?\s*)?0*(\d+)/i);
      if (!numMatch) return; // skip (ex: header)

      const number = parseInt(numMatch[1], 10);
      const numberStr = numMatch[1];

      // ── Texte français ────────────────────────────────────────────────────
      const frDiv = $row.find('.col-md-6').not('.arabic').first();
      const reference = frDiv.find('span.b').text().trim();
      frDiv.find('span.b').remove();
      const $fr = cheerio.load(frDiv.html() || '');
      $fr('br').replaceWith('\n');
      const textFrenchRaw = $fr.root().text().trim();

      // ── Texte arabe ───────────────────────────────────────────────────────
      const arDiv = $row.find('.col-md-6.arabic');
      arDiv.find('span.red').remove();
      const $ar = cheerio.load(arDiv.html() || '');
      $ar('br').replaceWith('\n');
      const textArabicRaw = $ar.root().text().trim();

      if (!textFrenchRaw && !textArabicRaw) return;

      const cleanedFr = this.cleanText(textFrenchRaw);
      const textArabic = this.cleanText(textArabicRaw);

      // Séparer texte principal / notes de savants / référence livre
      const { mainText, commentary, scholarRef, scholarCommentaries } = this.extractCommentary(cleanedFr);
      const textFrench = mainText || cleanedFr;

      const narrator = this.extractNarrator(textFrench);
      const isnad = this.extractIsnad(textArabic, textFrench, narrator);
      const topics = this.extractTopics(textFrench, book.nameFrench);

      const { grade, gradeFrench, gradeArabic } = this.detectGrade('', textFrench, book);

      const ref = reference || `${book.collectionId} n°${number}`;

      hadiths.push({
        number,
        numberInCollection: numberStr,
        textFrench,
        textArabic,
        narrator,
        isnad,
        collection: book.collectionId,
        collectionLabel: this.getCollectionLabel(book.collectionId),
        bookName: book.nameFrench,
        bookSlug: book.url.split('/').pop()?.split('#')[0] || '',
        topics,
        commentary: commentary || undefined,
        scholarRef: scholarRef || undefined,
        scholarCommentaries: scholarCommentaries.length > 0 ? scholarCommentaries : undefined,
        sourceUrl: book.url,
        reference: ref,
      });
    });

    this.logger.debug(`    → ${hadiths.length} hadiths extraits de "${book.nameFrench}"`);
    return hadiths;
  }

  // ─── Parse les paragraphes d'un hadith ────────────────────────────────────
  private parseHadithParagraphs(
    number: number,
    numberStr: string,
    paragraphs: string[],
    book: BookInfo,
  ): HadithRaw | null {
    const $ = cheerio.load('<div>' + paragraphs.join('') + '</div>');
    const fullText = $('div').text();

    // Séparer texte français et arabe
    // L'arabe contient des caractères Unicode arabes (U+0600–U+06FF)
    const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

    const frenchParts: string[] = [];
    const arabicParts: string[] = [];
    let gradeText = '';
    let reference = '';

    paragraphs.forEach((p) => {
      const $p = cheerio.load(p);
      $p('br').replaceWith('\n');
      const text = $p.root().text().trim();
      if (!text) return;

      // Détecter la référence de source (Rapporté par / رواه)
      if (/rapporté par|riwayat|رواه البخاري|رواه مسلم/i.test(text)) {
        if (arabicRegex.test(text)) {
          arabicParts.push(text);
        } else {
          reference = text;
          frenchParts.push(text);
        }
        return;
      }

      // Détecter le grade (حكم : إسناده ...)
      if (/حكم|إسناده|الإسناد|ضعيف|صحيح|حسن|موضوع/.test(text)) {
        gradeText = text;
        return;
      }

      // Classifier arabe vs français
      const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
      const latinChars = (text.match(/[a-zA-ZÀ-ÿ]/g) || []).length;

      if (arabicChars > latinChars) {
        arabicParts.push(text);
      } else {
        frenchParts.push(text);
      }
    });

    const textFrench = frenchParts.join('\n\n').trim();
    const textArabic = arabicParts.join('\n\n').trim();

    if (!textFrench && !textArabic) return null;

    // Extraire le narrateur
    const narrator = this.extractNarrator(textFrench);
    const isnad = this.extractIsnad(textArabic, textFrench, narrator);

    // Extraire les topics
    const topics = this.extractTopics(textFrench, book.nameFrench);

    // Déterminer le grade d'authenticité
    const { grade, gradeFrench, gradeArabic } = this.detectGrade(gradeText, textFrench, book);

    // Si pas de référence, construire une par défaut
    if (!reference) {
      const refMatch = textFrench.match(/\(Rapporté[^)]+\)/i);
      if (refMatch) reference = refMatch[0];
      else reference = `${book.collectionId} n°${number}`;
    }

    return {
      number,
      numberInCollection: numberStr,
      textFrench: this.cleanText(textFrench),
      textArabic: this.cleanText(textArabic),
      narrator,
      isnad,
      collection: book.collectionId,
      collectionLabel: this.getCollectionLabel(book.collectionId),
      bookName: book.nameFrench,
      bookSlug: book.url.split('/').pop() || '',
      gradeText: gradeText || undefined,
      topics,
      sourceUrl: book.url,
      reference,
    };
  }

  // ─── Détection du grade d'authenticité ────────────────────────────────────
  detectGrade(
    gradeText: string,
    textFrench: string,
    book: BookInfo,
  ): {
    grade: AuthenticityGrade;
    gradeFrench: string;
    gradeArabic: string;
  } {
    // 1. Chercher dans le texte du grade (arabe)
    if (gradeText) {
      for (const [keyword, grade] of Object.entries(GRADE_KEYWORDS)) {
        if (gradeText.includes(keyword)) {
          return { grade, gradeFrench: this.gradeFrenchLabel(grade), gradeArabic: keyword };
        }
      }
    }

    // 2. Chercher dans le texte français
    const textLower = textFrench.toLowerCase();
    for (const [keyword, grade] of Object.entries(GRADE_KEYWORDS_FR)) {
      if (textLower.includes(keyword)) {
        return { grade, gradeFrench: keyword, gradeArabic: '' };
      }
    }

    // 3. Par défaut selon la collection
    // Bukhari et Muslim sont des sahih par définition
    const sahihCollections = ['bukhari', 'muslim', 'nawawi40', 'qoudousi40'];
    if (sahihCollections.includes(book.collectionId)) {
      return { grade: AuthenticityGrade.SAHIH, gradeFrench: 'Authentique', gradeArabic: 'صحيح' };
    }

    return { grade: AuthenticityGrade.UNKNOWN, gradeFrench: 'Non précisé', gradeArabic: '' };
  }

  private gradeFrenchLabel(grade: AuthenticityGrade): string {
    const labels: Record<AuthenticityGrade, string> = {
      [AuthenticityGrade.SAHIH]: 'Authentique (Sahih)',
      [AuthenticityGrade.SAHIH_HASAN]: 'Authentique/Bon (Sahih Hasan)',
      [AuthenticityGrade.HASAN]: 'Bon (Hasan)',
      [AuthenticityGrade.DAIF]: 'Faible (Da\'if)',
      [AuthenticityGrade.MAWDU]: 'Inventé (Mawdu\')',
      [AuthenticityGrade.UNKNOWN]: 'Grade non précisé',
    };
    return labels[grade];
  }

  private extractNarrator(textFrench: string): string {
    // Chercher uniquement dans le 1er paragraphe pour éviter de capter les notes de savants
    const firstPara = textFrench.split(/\n\n/)[0] || textFrench;

    // "D'après [Prénom Nom] (qu'Allah l'agrée)..." — apostrophe unicode-safe
    const match = firstPara.match(
      /D.apr[eè]s\s+([^,:(]{3,50}?)(?:\s*[:(]|,|\s+le\s+[Pp]roph[eè]te|\s+qu.)/i,
    );
    if (match) return match[1].trim();

    // "Selon [Prénom Nom]..."
    const match2 = firstPara.match(/Selon\s+([^,(]{3,50}?)(?:\s*\(|,)/i);
    if (match2) return match2[1].trim();

    return 'Non précisé';
  }

  private extractIsnad(textArabic: string, textFrench: string, narrator: string): string {
    const arabic = this.cleanText(textArabic);
    const chainMarkers = /(حدثنا|حدثني|أخبرنا|أخبرني|أنبأنا|سمعت|عن)\s/;

    if (arabic && chainMarkers.test(arabic)) {
      const matnStart = arabic.search(/(?:قال رسول الله|أن رسول الله|أن النبي|عن النبي|النبي صلى الله عليه وسلم|النبي ﷺ|رسول الله ﷺ)/);
      const chain = matnStart > 25 ? arabic.slice(0, matnStart) : arabic;
      return this.cleanText(chain).slice(0, 700);
    }

    const frenchIntro =
      textFrench.match(/^(D['’]après[^:،.]+(?:a dit|rapporte|dit|:)?)/i)?.[1] ||
      textFrench.match(/^(Selon[^:،.]+(?:a dit|rapporte|dit|:)?)/i)?.[1];

    if (frenchIntro) return this.cleanText(frenchIntro).slice(0, 350);
    if (narrator && narrator !== 'Non précisé') return `D'après ${this.cleanText(narrator)}`;
    return '';
  }

  private getCollectionLabel(collectionId: string): string {
    const c = COLLECTIONS.find((c) => c.id === collectionId);
    return c?.label || collectionId;
  }

  private static readonly TOPIC_MAP: Record<string, string[]> = {
    'Intention': ['intention', 'niya', 'sincérité', 'sincere'],
    'Prière': ['prière', 'salat', 'sujud', 'prosternation', 'mosquée', 'imam', 'rak'],
    'Jeûne': ['jeûne', 'ramadan', 'iftar', 'suhur', 'rupture du jeûne'],
    'Zakat': ['zakat', 'aumône obligatoire', 'zakât'],
    'Pèlerinage': ['pèlerinage', 'hajj', 'umra', 'la mecque', 'ihram', 'kaaba'],
    'Foi': ['foi', 'iman', 'croyance', 'pilliers', 'shahada', 'témoignage'],
    'Islam': ['islam', 'piliers', 'soumission', 'musulman'],
    'Purification': ['pureté', 'ablution', 'wudu', 'ghusl', 'propre', 'purification', 'tayammum'],
    'Coran': ['coran', 'sourate', 'verset', 'récitation', 'quran'],
    'Famille': ['famille', 'père', 'mère', 'parent', 'enfant', 'femme', 'époux', 'épouse', 'mariage', 'divorce', 'orphelin'],
    'Commerce': ['commerce', 'vente', 'achat', 'marché', 'intérêt', 'riba', 'dette', 'contrat', 'transaction'],
    'Science': ['science', 'connaissance', 'apprendre', 'savoir', 'savant', 'ignorance'],
    'Patience': ['patience', 'épreuve', 'tribulation', 'adversité', 'patient'],
    'Repentir': ['repentir', 'pardon', 'péché', 'tawba', 'istighfar', 'grâce'],
    'Mort & Âme': ['mort', 'décès', 'paradis', 'enfer', 'âme', 'tombe', 'résurrection', 'jugement dernier', 'akhira'],
    'Invocation': ['invocation', 'dhikr', 'du\'a', 'dua', 'supplication', 'souvenir d\'allah'],
    'Licite & Illicite': ['licite', 'illicite', 'halal', 'haram', 'interdit', 'permis', 'défendu'],
    'Justice': ['justice', 'équité', 'jugement', 'droit', 'oppression', 'opprimé'],
    'Entraide': ['entraide', 'solidarité', 'aide', 'secours', 'pauvres', 'nécessiteux', 'générosité'],
    'Comportement': ['comportement', 'manière', 'adab', 'politesse', 'courtoisie', 'bonnes mœurs', 'caractère'],
    'Nourriture': ['nourriture', 'manger', 'boire', 'repas', 'alimentation', 'boisson'],
    'Guerre & Jihad': ['jihad', 'guerre', 'martyr', 'shahid', 'combat'],
    'Prophète': ['prophète', 'messager', 'muhammad', 'mohammed', 'envoyé d\'allah'],
  };

  private extractTopics(textFrench: string, bookName: string): string[] {
    const combined = (textFrench + ' ' + bookName).toLowerCase();
    const found = new Set<string>();

    for (const [topic, keywords] of Object.entries(BibliothequeIslamiqueScraper.TOPIC_MAP)) {
      for (const kw of keywords) {
        if (combined.includes(kw)) {
          found.add(topic);
          break;
        }
      }
    }

    return Array.from(found);
  }

  // ─── Table des savants reconnus ──────────────────────────────────────────
  private static readonly KNOWN_SCHOLARS: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /ibn\s+hajar/i,                    name: 'Ibn Hajar Al-Asqalani' },
    { pattern: /an?-?nawawi|imam\s+nawawi/i,       name: 'An-Nawawi' },
    { pattern: /ibn\s+rajab/i,                    name: 'Ibn Rajab Al-Hanbali' },
    { pattern: /cheikh\s+al[- ]albani|al-?albani/i, name: 'Cheikh Al-Albani' },
    { pattern: /ibn\s+al[- ]?qayyim|ibn\s+qayyim/i, name: 'Ibn Al-Qayyim' },
    { pattern: /al?-?mubarakpuri|moubarak/i,       name: 'Al-Mubarakpuri' },
    { pattern: /al[- ]etiopi|etiopi/i,            name: 'Cheikh Al-Etiopi' },
    { pattern: /al[- ]munawi|munawi/i,             name: 'Al-Munawi' },
    { pattern: /ibn\s+qudama|qudama/i,             name: 'Ibn Qudama' },
    { pattern: /ibn\s+battaal|battaal/i,           name: 'Ibn Battaal' },
    { pattern: /al[- ]khattabi|khattabi/i,         name: 'Al-Khattabi' },
    { pattern: /ibn\s+daqiq/i,                    name: "Ibn Daqiq Al-'Id" },
  ];

  private static readonly KNOWN_WORKS: Array<{ pattern: RegExp; work: string }> = [
    { pattern: /fath\s+al[- ]?bari/i,             work: 'Fath Al-Bari' },
    { pattern: /charh\s+sahih\s+mouslim|sharh\s+sahih\s+muslim/i, work: 'Sharh Sahih Muslim' },
    { pattern: /riyad\s+as[- ]?salihin/i,         work: 'Riyad As-Salihine' },
    { pattern: /silsilat\s+as[- ]?sahih|silsilah/i, work: 'Silsilah As-Sahihah' },
    { pattern: /tuhfat\s+al[- ]?ahwadhi/i,        work: 'Tuhfat Al-Ahwadhi' },
    { pattern: /mirqat\s+al[- ]?mafatih/i,        work: 'Mirqat Al-Mafatih' },
    { pattern: /charh\s+riyad|sharh\s+riyad/i,    work: 'Sharh Riyad As-Salihine' },
    { pattern: /tahdhib\s+al[- ]?asma/i,          work: 'Tahdhib Al-Asma' },
    { pattern: /al[- ]?mufhim/i,                  work: 'Al-Mufhim' },
    { pattern: /ihkam\s+al[- ]?ahkam/i,           work: "Ihkam Al-Ahkam" },
  ];

  private detectScholar(text: string): string {
    for (const { pattern, name } of BibliothequeIslamiqueScraper.KNOWN_SCHOLARS) {
      if (pattern.test(text)) return name;
    }
    // Pattern générique : "Cheikh/Sheikh X a dit"
    const generic = text.match(/(?:cheikh|sheikh|imam)\s+([A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ]+)?)/i);
    if (generic) return generic[1].trim();
    return '';
  }

  private detectWork(text: string): string {
    for (const { pattern, work } of BibliothequeIslamiqueScraper.KNOWN_WORKS) {
      if (pattern.test(text)) return work;
    }
    return '';
  }

  /**
   * Sépare le texte principal hadith des notes/commentaires de savants.
   * Format des notes : "(1) explication\n(2) explication..."
   * Format ref savant : "(Charh Sahih Mouslim...)" ou "(Charh ...)"
   * Retourne { mainText, commentary, scholarRef, scholarCommentaries }
   */
  extractCommentary(textFrench: string): {
    mainText: string;
    commentary: string;
    scholarRef: string;
    scholarCommentaries: Array<{ scholar: string; work: string; text: string }>;
  } {
    const lines = textFrench.split('\n');
    const mainLines: string[] = [];
    const commentaryLines: string[] = [];
    let scholarRef = '';
    let inCommentary = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Référence de livre de savant : (Charh Sahih Mouslim...) ou (Fath Al Bari...)
      if (/^\((?:Charh|Fath|Sharh|Tafsir|Silsilat|Sahih|Mirqat|Tuhfa)\s/i.test(trimmed)) {
        scholarRef = trimmed.replace(/^\(|\)$/g, '').trim();
        continue;
      }

      // Début d'une note numérotée : "(1) ..." ou "(1)" seul
      if (/^\(\d+\)/.test(trimmed)) {
        inCommentary = true;
        commentaryLines.push(trimmed);
        continue;
      }

      // Continuation de commentary
      if (inCommentary && trimmed && !/^\(Rapporté/.test(trimmed)) {
        commentaryLines.push(trimmed);
        continue;
      }

      if (/^\(Rapporté/.test(trimmed)) inCommentary = false;
      if (!inCommentary) mainLines.push(line);
    }

    const commentaryText = commentaryLines.join('\n').trim();

    // Construire les commentaires structurés par savant
    const scholarCommentaries: Array<{ scholar: string; work: string; text: string }> = [];

    // Depuis scholarRef (ex: "Charh Sahih Mouslim, Cheikh Al Etiopi, vol 11 p 414")
    if (scholarRef) {
      const scholar = this.detectScholar(scholarRef);
      const work = this.detectWork(scholarRef);
      if (scholar || work) {
        scholarCommentaries.push({ scholar: scholar || 'Savant', work, text: '' });
      }
    }

    // Depuis chaque note numérotée
    const noteRegex = /\((\d+)\)\s*(.+?)(?=\(\d+\)|$)/gs;
    let match: RegExpExecArray | null;
    while ((match = noteRegex.exec(commentaryText)) !== null) {
      const noteText = match[2].trim();
      if (!noteText || noteText.length < 20) continue;

      const scholar = this.detectScholar(noteText);
      const work = this.detectWork(noteText);

      if (scholar || work) {
        // Note attribuée à un savant reconnu
        scholarCommentaries.push({ scholar: scholar || 'Savant', work, text: noteText });
      } else {
        // Note générique — on l'attribue à "Les savants" ou laisse vide
        scholarCommentaries.push({ scholar: '', work: '', text: noteText });
      }
    }

    return {
      mainText: mainLines.join('\n').trim(),
      commentary: commentaryText,
      scholarRef,
      scholarCommentaries,
    };
  }

  private cleanText(text: string): string {
    return text
      .replace(/\u200B/g, '')       // zero-width space
      .replace(/\u00A0/g, ' ')      // non-breaking space → espace normale
      .replace(/[^\S\n]+/g, ' ')    // collapse espaces (sans toucher aux \n)
      .replace(/\n{3,}/g, '\n\n')   // max deux sauts de ligne consécutifs
      .replace(/«\s*/g, '«\u00A0')
      .replace(/\s*»/g, '\u00A0»')
      .trim();
  }

  // ─── HTTP avec retry et délai ─────────────────────────────────────────────
  async fetchWithRetry(url: string, retries = 3): Promise<string> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.delay(this.delayMs);
        const response = await this.http.get(url);
        return response.data;
      } catch (err: any) {
        this.logger.warn(
          `Tentative ${attempt}/${retries} échouée pour ${url}: ${err.message}`,
        );
        if (attempt === retries) throw err;
        await this.delay(this.delayMs * attempt * 2); // backoff exponentiel
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
