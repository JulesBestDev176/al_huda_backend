/**
 * Script standalone : scrape bibliotheque-islamique.fr et sauvegarde dans MongoDB
 * Ne nécessite pas de démarrer NestJS — juste Mongoose + Cheerio + Axios.
 *
 * Usage :
 *   npx ts-node -r dotenv/config scripts/scrape-to-db.ts
 *   npx ts-node -r dotenv/config scripts/scrape-to-db.ts bukhari
 *   npx ts-node -r dotenv/config scripts/scrape-to-db.ts bukhari muslim tirmidhi
 */

import mongoose, { Schema, model, Model } from 'mongoose';
import axios from 'axios';
import * as cheerio from 'cheerio';

// ─── Connexion MongoDB ────────────────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI manquant dans .env');
  process.exit(1);
}

// ─── Schéma Mongoose simplifié (même structure que hadith.schema.ts) ──────────

const HadithSchema = new Schema(
  {
    number:             { type: Number, required: true },
    numberInCollection: { type: String, required: true },
    textFrench:         { type: String, required: true },
    textArabic:         { type: String, default: '' },
    narrator:           { type: String, default: 'Non précisé' },
    isnad:              { type: String, default: '' },
    collection:         { type: String, required: true, index: true },
    collectionLabel:    { type: String, required: true },
    bookName:           { type: String, required: true },
    bookSlug:           { type: String, default: '' },
    chapterName:        { type: String },
    authenticity: {
      grade:       { type: String, default: 'unknown' },
      gradeArabic: { type: String, default: '' },
      gradeFrench: { type: String, default: '' },
      gradeRaw:    { type: String },
      score:       { type: Number, default: 0.6 },
      scholar:     { type: String },
    },
    topics:     { type: [String], default: [] },
    sourceUrl:  { type: String, required: true },
    reference:  { type: String, default: '' },
    isEmbedded: { type: Boolean, default: false },
    views:      { type: Number, default: 0 },
    shares:     { type: Number, default: 0 },
  },
  { timestamps: true, suppressReservedKeysWarning: true },
);

// Index texte pour la recherche full-text
HadithSchema.index(
  { textFrench: 'text', textArabic: 'text', narrator: 'text', topics: 'text' },
  { weights: { textFrench: 10, narrator: 5, topics: 8, textArabic: 6 } },
);
HadithSchema.index({ collection: 1, 'authenticity.grade': 1 });

// ─── Constantes ───────────────────────────────────────────────────────────────

const BASE_URL = 'https://bibliotheque-islamique.fr';
const DELAY_MS = parseInt(process.env.SCRAPER_DELAY_MS || '1500', 10);
const CONCURRENCY = parseInt(process.env.SCRAPER_CONCURRENCY || '2', 10);

const COLLECTIONS = [
  { id: 'bukhari',    label: 'Sahih Al Boukhari',   sommairUrl: '/hadith/sommaire-al-boukhari',     prefix: 'sahih-al-boukhari-' },
  { id: 'muslim',     label: 'Sahih Mouslim',        sommairUrl: '/hadith/sommaire-mouslim',          prefix: 'sahih-mouslim-' },
  { id: 'tirmidhi',   label: "Jami' at-Tirmidhi",   sommairUrl: '/hadith/sommaire-jami-at-tirmidhi/', prefix: 'jami-at-tirmidhi-' },
  { id: 'ibnmajah',   label: 'Sunan Ibn Majah',      sommairUrl: '/hadith/sommaire-sahih-ibn-majah/',  prefix: 'sunan-ibn-majah-' },
  { id: 'nasai',      label: "Sunan Nasa'i",         sommairUrl: '/hadith/sommaire-sahih-an-nasai/',   prefix: 'sunan-nasai-' },
  { id: 'abudaoud',   label: 'Sunan Abi Daoud',      sommairUrl: '/hadith/sommaire-sahih-abou-daoud', prefix: 'sunan-abou-daoud-' },
  { id: 'riyad',      label: 'Riyad as-Salihine',    sommairUrl: '/hadith/sommaire-riyad-as-salihin',  prefix: 'riyad-as-salihin-' },
  { id: 'nawawi40',   label: '40 Hadith Nawawi',     sommairUrl: '/hadith/sommaire-40-hadith-nawawi',  prefix: '40-hadith-nawawi' },
  { id: 'qoudousi40', label: '40 Hadith Qoudousi',  sommairUrl: '/hadith/40-hadith-qoudousi',         prefix: '40-hadith-qoudousi' },
];

// Grades d'authenticité avec leurs mots-clés
const GRADE_KEYWORDS: Array<[string, string, string]> = [
  // [motClé arabe, grade, score]
  ['صحيح على شرط الشيخين', 'sahih', '1.0'],
  ['صحيح على شرط البخاري',  'sahih', '1.0'],
  ['صحيح على شرط مسلم',    'sahih', '1.0'],
  ['إسناده صحيح',           'sahih', '1.0'],
  ['صحيح الإسناد',          'sahih', '1.0'],
  ['حسن صحيح',              'sahih_hasan', '0.95'],
  ['صحيح حسن',              'sahih_hasan', '0.95'],
  ['إسناده حسن',            'hasan', '0.85'],
  ['حسن الإسناد',           'hasan', '0.85'],
  ['إسناده ضعيف',           'daif', '0.4'],
  ['ضعيف الإسناد',          'daif', '0.4'],
  ['ضعيف',                  'daif', '0.4'],
  ['موضوع',                 'mawdu', '0.0'],
  ['مكذوب',                 'mawdu', '0.0'],
  ['صحيح',                  'sahih', '1.0'],
  ['حسن',                   'hasan', '0.85'],
];

const SAHIH_COLLECTIONS = new Set(['bukhari', 'muslim', 'nawawi40', 'qoudousi40']);

// ─── HTTP ─────────────────────────────────────────────────────────────────────

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'fr-FR,fr;q=0.9,ar;q=0.8',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
});

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(path: string, retries = 3): Promise<string> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await delay(DELAY_MS);
      const { data } = await http.get(url);
      return data;
    } catch (err: any) {
      log(`warn`, `Tentative ${attempt}/${retries} pour ${url}: ${err.message}`);
      if (attempt === retries) throw err;
      await delay(DELAY_MS * attempt * 2);
    }
  }
  throw new Error(`Impossible de charger ${url}`);
}

// ─── Scraping ─────────────────────────────────────────────────────────────────

async function getBooks(collection: typeof COLLECTIONS[0]): Promise<Array<{ name: string; url: string }>> {
  const html = await fetchPage(collection.sommairUrl);
  const $ = cheerio.load(html);
  const books: Array<{ name: string; url: string }> = [];
  const seen = new Set<string>();

  if (collection.id === 'qoudousi40') {
    return [{ name: collection.label, url: `${BASE_URL}${collection.sommairUrl}` }];
  }

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    const fullUrl = normalizeScrapeUrl(href);
    if (!fullUrl) return;
    if (!isScrapableBookUrl(fullUrl, collection.prefix)) return;

    const dedupeKey = fullUrl.split('#')[0];
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    // Chercher le titre du livre dans les divs enfants
    const divs = $(el).find('div');
    let name = '';
    divs.each((i, div) => { if (i === 1) name = $(div).text().trim(); });
    if (!name) name = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 80);
    if (isShareLinkLabel(name)) return;
    if (name) books.push({ name, url: fullUrl });
  });

  return books;
}

function normalizeScrapeUrl(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (/^(mailto:|tel:|javascript:|#)/i.test(trimmed)) return null;
  if (/facebook\.com|twitter\.com|x\.com|whatsapp|sharer|mailto:/i.test(trimmed)) return null;

  try {
    const url = new URL(trimmed, BASE_URL);
    if (url.hostname !== 'bibliotheque-islamique.fr') return null;
    url.search = '';
    return url.toString();
  } catch {
    return null;
  }
}

function isScrapableBookUrl(url: string, collectionPrefix: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith('/hadith/')) return false;
    if (!parsed.pathname.includes(collectionPrefix)) return false;
    if (/\/category\/|\/tag\/|\/feed\/|\/comments\//i.test(parsed.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

function isShareLinkLabel(label: string): boolean {
  return /^(facebook|email|mail|twitter|x|whatsapp|partager)$/i.test(label.trim());
}

async function scrapeBook(
  bookUrl: string,
  bookName: string,
  collectionId: string,
  collectionLabel: string,
): Promise<any[]> {
  const html = await fetchPage(bookUrl);
  const $ = cheerio.load(html);

  const bookItemBlocks = scrapeBookItemHadithBlocks($, bookUrl, bookName, collectionId, collectionLabel);
  if (bookItemBlocks.length > 0) return bookItemBlocks;

  const structured = scrapeStructuredHadithBlocks($, bookUrl, bookName, collectionId, collectionLabel);
  if (structured.length > 0) return structured;

  // Récupérer tous les paragraphes du contenu principal
  const content = $('article, .entry-content, main, .post-content').first();
  const allParas: string[] = [];
  content.find('p').each((_, el) => {
    const text = $(el).text().trim();
    if (text) allParas.push(text);
  });

  // Grouper par hadith (chaque hadith commence par "hadith n°XXX")
  const hadithGroups: Array<{ number: number; numStr: string; paras: string[] }> = [];
  let current: { number: number; numStr: string; paras: string[] } | null = null;

  for (const para of allParas) {
    const match = para.match(/hadith\s+n[°o]?\s*(\d+)/i);
    if (match) {
      if (current) hadithGroups.push(current);
      current = { number: parseInt(match[1], 10), numStr: match[1], paras: [] };
    } else if (current) {
      current.paras.push(para);
    }
  }
  if (current) hadithGroups.push(current);

  // Transformer chaque groupe en objet hadith
  return hadithGroups
    .map((g) => parseHadithGroup(g, bookName, bookUrl, collectionId, collectionLabel))
    .filter(Boolean);
}

function scrapeBookItemHadithBlocks(
  $: any,
  bookUrl: string,
  bookName: string,
  collectionId: string,
  collectionLabel: string,
): any[] {
  const hadiths: any[] = [];

  $('.row.book-item.beige').each((_, row) => {
    const $row = $(row);
    const tagText = cleanText($row.find('.tag_search').first().text());
    const numberMatch = tagText.match(/hadith\s+n[°o]?\s*0*(\d+)/i);
    if (!numberMatch) return;

    const number = parseInt(numberMatch[1], 10);
    const frenchBlock = $row.children('.col-md-6').not('.arabic').first();
    const arabicBlock = $row.children('.col-md-6.arabic').first();
    if (!frenchBlock.length && !arabicBlock.length) return;

    const reference = cleanText(frenchBlock.find('span').first().text() || `${collectionLabel} n°${number}`);
    const arabicGrade = cleanText(arabicBlock.find('span').first().text());

    const frenchClone = frenchBlock.clone();
    frenchClone.find('span, script, footer, .juiz_sps_links').remove();
    const arabicClone = arabicBlock.clone();
    arabicClone.find('span, script, footer, .juiz_sps_links').remove();

    const textFrench = cleanText(frenchClone.text());
    const textArabic = cleanText(arabicClone.text());
    if (!textFrench && !textArabic) return;

    const narrator =
      textFrench.match(/D['’]après\s+([^,(]+?)(?:\s*\(|,|\s+a\s+dit|\s+rapporte|\s+du\s+haut)/i)?.[1]?.trim() ||
      textFrench.match(/Selon\s+([^,(]+?)(?:\s*\(|,)/i)?.[1]?.trim() ||
      'Non précisé';
    const isnad = extractIsnad(textArabic, textFrench, narrator);

    const gradeRaw = cleanText(`${reference} ${arabicGrade}`);
    const { grade, gradeArabic, gradeFrench, score } = detectGrade(gradeRaw, textFrench, collectionId);

    hadiths.push({
      number,
      numberInCollection: String(number),
      textFrench,
      textArabic,
      narrator: cleanText(narrator),
      isnad,
      collection: collectionId,
      collectionLabel,
      bookName,
      bookSlug: safeUrlPathname(bookUrl).split('/').filter(Boolean).pop() || '',
      authenticity: { grade, gradeArabic, gradeFrench, gradeRaw: gradeRaw || undefined, score },
      topics: [],
      sourceUrl: `${bookUrl.split('#')[0]}/hadith-${number}`,
      reference,
      isEmbedded: false,
    });
  });

  return hadiths;
}

function scrapeStructuredHadithBlocks(
  $: any,
  bookUrl: string,
  bookName: string,
  collectionId: string,
  collectionLabel: string,
): any[] {
  const hash = safeUrlHash(bookUrl);
  const anchors = hash
    ? [hash]
    : $('[id^="nawawi-"], [id^="qoudousi-"]')
        .map((_, el) => $(el).attr('id'))
        .get()
        .filter(Boolean);

  return anchors
    .map((anchor) => {
      const frenchBlock = $(`#${cssEscape(anchor)}`);
      if (!frenchBlock.length) return null;

      const arabicBlock = frenchBlock.nextAll('.arabic').first();
      const number =
        parseInt(anchor.match(/(\d+)/)?.[1] || '', 10) ||
        parseInt(frenchBlock.text().match(/Hadith\s+n[°o]\s*(\d+)/i)?.[1] || '', 10);
      if (!number) return null;

      const textFrench = cleanText(frenchBlock.clone().find('span').remove().end().text());
      const textArabic = cleanText(arabicBlock.clone().find('span').remove().end().text());
      const reference = cleanText(frenchBlock.find('span').first().text() || `${collectionLabel} n°${number}`);
      const gradeRaw = cleanText(`${reference} ${arabicBlock.find('span').first().text()}`);

      if (!textFrench && !textArabic) return null;

      const narrator =
        textFrench.match(/D['’]après\s+([^,(]+?)(?:\s*\(|,|\s+a\s+dit|\s+rapporte)/i)?.[1]?.trim() ||
        textFrench.match(/Selon\s+([^,(]+?)(?:\s*\(|,)/i)?.[1]?.trim() ||
        'Non précisé';
      const isnad = extractIsnad(textArabic, textFrench, narrator);
      const { grade, gradeArabic, gradeFrench, score } = detectGrade(gradeRaw, textFrench, collectionId);

      return {
        number,
        numberInCollection: String(number),
        textFrench,
        textArabic,
        narrator: cleanText(narrator),
        isnad,
        collection: collectionId,
        collectionLabel,
        bookName,
        bookSlug: safeUrlPathname(bookUrl).split('/').filter(Boolean).pop() || '',
        authenticity: { grade, gradeArabic, gradeFrench, gradeRaw: gradeRaw || undefined, score },
        topics: [],
        sourceUrl: `${bookUrl.split('#')[0]}#${anchor}`,
        reference,
        isEmbedded: false,
      };
    })
    .filter(Boolean);
}

function safeUrlHash(url: string): string {
  try {
    return new URL(url).hash.replace(/^#/, '');
  } catch {
    return '';
  }
}

function safeUrlPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function cssEscape(value: string): string {
  return value.replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, '\\$1');
}

function parseHadithGroup(
  group: { number: number; numStr: string; paras: string[] },
  bookName: string,
  bookUrl: string,
  collectionId: string,
  collectionLabel: string,
): any | null {
  if (group.paras.length === 0) return null;

  const frParts: string[] = [];
  const arParts: string[] = [];
  let gradeRaw = '';
  let reference = '';

  for (const para of group.paras) {
    // Grade arabe : contient حكم ou إسناده
    if (/حكم|إسناده|الإسناد/.test(para) && /[\u0600-\u06FF]/.test(para)) {
      gradeRaw = para;
      continue;
    }

    // Référence source
    if (/rapporté par|رواه/i.test(para)) {
      if (/[\u0600-\u06FF]/.test(para)) arParts.push(para);
      else { reference = para; frParts.push(para); }
      continue;
    }

    // Classer arabe vs français selon la majorité des caractères
    const arCount = (para.match(/[\u0600-\u06FF]/g) || []).length;
    const frCount = (para.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
    if (arCount > frCount) arParts.push(para);
    else frParts.push(para);
  }

  const textFrench = frParts.join(' ').replace(/\s+/g, ' ').trim();
  const textArabic = arParts.join(' ').replace(/\s+/g, ' ').trim();

  // On garde le hadith même si un seul texte est disponible
  if (!textFrench && !textArabic) return null;

  // Narrateur depuis le texte français
  const narrator =
    textFrench.match(/D['']après\s+([^,(]+?)(?:\s*\(|,|\s+le\s+Prophète|\s+qu')/i)?.[1]?.trim() ||
    textFrench.match(/Selon\s+([^,(]+?)(?:\s*\(|,)/i)?.[1]?.trim() ||
    'Non précisé';
  const isnad = extractIsnad(textArabic, textFrench, narrator);

  // Grade d'authenticité
  const { grade, gradeArabic, gradeFrench, score } = detectGrade(gradeRaw, textFrench, collectionId);

  // Référence par défaut
  if (!reference) {
    const refMatch = textFrench.match(/\(Rapporté[^)]+n°\s*\d+[^)]*\)/i);
    reference = refMatch ? refMatch[0] : `${collectionLabel} n°${group.numStr}`;
  }

  const bookSlug = bookUrl.split('/').pop() || '';

  return {
    number: group.number,
    numberInCollection: group.numStr,
    textFrench: cleanText(textFrench),
    textArabic: cleanText(textArabic),
    narrator: cleanText(narrator),
    isnad,
    collection: collectionId,
    collectionLabel,
    bookName,
    bookSlug,
    authenticity: { grade, gradeArabic, gradeFrench, gradeRaw: gradeRaw || undefined, score },
    topics: [],
    sourceUrl: bookUrl,
    reference: cleanText(reference),
    isEmbedded: false,
  };
}

function detectGrade(
  gradeRaw: string,
  textFrench: string,
  collectionId: string,
): { grade: string; gradeArabic: string; gradeFrench: string; score: number } {
  // 1. Chercher dans le texte du grade arabe
  const search = gradeRaw + ' ' + textFrench;
  for (const [keyword, grade, scoreStr] of GRADE_KEYWORDS) {
    if (search.includes(keyword)) {
      return {
        grade,
        gradeArabic: keyword,
        gradeFrench: gradeFrLabel(grade),
        score: parseFloat(scoreStr),
      };
    }
  }

  // 2. Mots français
  const lower = textFrench.toLowerCase();
  if (lower.includes('authentique') || lower.includes('sahih'))
    return { grade: 'sahih', gradeArabic: 'صحيح', gradeFrench: 'Authentique', score: 1.0 };
  if (lower.includes('hasan') || lower.includes(' bon '))
    return { grade: 'hasan', gradeArabic: 'حسن', gradeFrench: 'Bon', score: 0.85 };
  if (lower.includes("da'if") || lower.includes('daif') || lower.includes('faible'))
    return { grade: 'daif', gradeArabic: 'ضعيف', gradeFrench: 'Faible', score: 0.4 };

  // 3. Par défaut selon la collection (Bukhari et Muslim sont sahih par définition)
  if (SAHIH_COLLECTIONS.has(collectionId))
    return { grade: 'sahih', gradeArabic: 'صحيح', gradeFrench: 'Authentique', score: 1.0 };

  return { grade: 'unknown', gradeArabic: '', gradeFrench: 'Non précisé', score: 0.6 };
}

function gradeFrLabel(grade: string): string {
  const m: Record<string, string> = {
    sahih: 'Authentique', sahih_hasan: 'Authentique/Bon',
    hasan: 'Bon', daif: "Faible (Da'if)", mawdu: 'Inventé (Mawdu\')', unknown: 'Non précisé',
  };
  return m[grade] || 'Non précisé';
}

function cleanText(t: string): string {
  return t.replace(/\u200B/g, '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractIsnad(textArabic: string, textFrench: string, narrator: string): string {
  const frenchIntro =
    textFrench.match(/^(D['’]après[^:،.]+(?:a dit|rapporte|dit|:)?)/i)?.[1] ||
    textFrench.match(/^(Selon[^:،.]+(?:a dit|rapporte|dit|:)?)/i)?.[1];

  if (frenchIntro) return cleanText(frenchIntro).slice(0, 350);
  if (narrator && narrator !== 'Non précisé') return `D'après ${cleanText(narrator)}`;
  return '';
}

// ─── Sauvegarde MongoDB ────────────────────────────────────────────────────────

async function upsertHadiths(HadithModel: Model<any>, hadiths: any[]): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  // Upsert par lot de 50 pour ne pas surcharger MongoDB
  const batchSize = 50;
  for (let i = 0; i < hadiths.length; i += batchSize) {
    const batch = hadiths.slice(i, i + batchSize);
    const ops = batch.map((h) => ({
      updateOne: {
        filter: { collection: h.collection, number: h.number },
        update: { $set: h },
        upsert: true,
      },
    }));

    const result = await HadithModel.bulkWrite(ops, { ordered: false });
    inserted += result.upsertedCount;
    updated  += result.modifiedCount;
  }

  return { inserted, updated };
}

// ─── Logging coloré ──────────────────────────────────────────────────────────

const COLORS = { info: '\x1b[36m', success: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m', reset: '\x1b[0m' };
function log(level: keyof typeof COLORS, msg: string) {
  const ts = new Date().toTimeString().slice(0, 8);
  console.log(`${COLORS[level]}[${ts}] ${msg}${COLORS.reset}`);
}

function printProgress(done: number, total: number, label: string) {
  const pct = Math.round((done / total) * 100);
  const filled = Math.round(pct / 5);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
  process.stdout.write(`\r  [${bar}] ${pct}%  ${label.slice(0, 40).padEnd(40)}`);
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

async function main() {
  // Argument CLI : quelles collections scraper
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const targetIds = args.length > 0 ? new Set(args) : null;

  const collections = targetIds
    ? COLLECTIONS.filter((c) => targetIds.has(c.id))
    : COLLECTIONS;

  if (collections.length === 0) {
    console.error('Collections inconnues. Valeurs valides :', COLLECTIONS.map((c) => c.id).join(', '));
    process.exit(1);
  }

  // Connexion MongoDB
  log('info', `Connexion à MongoDB...`);
  await mongoose.connect(MONGODB_URI!, { dbName: 'hadith_db' });
  log('success', 'Connecté à MongoDB');

  const HadithModel = mongoose.models.Hadith || model('Hadith', HadithSchema);

  // Stats globales
  let globalScraped = 0;
  let globalInserted = 0;
  let globalUpdated = 0;
  let globalErrors = 0;
  const startAll = Date.now();

  // ── Scraper collection par collection ──────────────────────────────────────
  for (const collection of collections) {
    const startColl = Date.now();
    log('info', `\n=== ${collection.label} ===`);

    let books: Array<{ name: string; url: string }> = [];
    try {
      books = await getBooks(collection);
      log('info', `  ${books.length} livre(s) trouvé(s)`);
    } catch (err: any) {
      log('error', `  Impossible de récupérer les livres : ${err.message}`);
      globalErrors++;
      continue;
    }

    let collScraped = 0;
    let collInserted = 0;
    let collUpdated = 0;
    let booksDone = 0;

    // Traiter les livres par lots (concurrence limitée)
    for (let i = 0; i < books.length; i += CONCURRENCY) {
      const batch = books.slice(i, i + CONCURRENCY);

      await Promise.all(
        batch.map(async (book) => {
          try {
            printProgress(booksDone, books.length, book.name);

            const hadiths = await scrapeBook(book.url, book.name, collection.id, collection.label);

            if (hadiths.length > 0) {
              const { inserted, updated } = await upsertHadiths(HadithModel, hadiths);
              collScraped  += hadiths.length;
              collInserted += inserted;
              collUpdated  += updated;
              globalScraped  += hadiths.length;
              globalInserted += inserted;
              globalUpdated  += updated;
            }
          } catch (err: any) {
            log('warn', `\n  Erreur "${book.name}" : ${err.message}`);
            globalErrors++;
          } finally {
            booksDone++;
          }
        }),
      );
    }

    process.stdout.write('\r' + ' '.repeat(70) + '\r'); // effacer la barre de progression
    const dur = ((Date.now() - startColl) / 1000).toFixed(1);
    log('success', `  ✓ ${collection.label} : ${collScraped} hadiths | +${collInserted} nouveaux | ~${collUpdated} mis à jour | ${dur}s`);
  }

  // ── Résumé final ────────────────────────────────────────────────────────────
  const totalDur = ((Date.now() - startAll) / 1000).toFixed(1);
  const totalInDB = await HadithModel.countDocuments();

  console.log('\n' + '═'.repeat(55));
  console.log('  RÉSUMÉ DU SCRAPING');
  console.log('═'.repeat(55));
  console.log(`  Hadiths scrapés  : ${globalScraped}`);
  console.log(`  Nouveaux en base : ${globalInserted}`);
  console.log(`  Mis à jour       : ${globalUpdated}`);
  console.log(`  Erreurs          : ${globalErrors}`);
  console.log(`  Total en base    : ${totalInDB}`);
  console.log(`  Durée totale     : ${totalDur}s`);
  console.log('═'.repeat(55));

  await mongoose.disconnect();
  log('success', 'Déconnecté de MongoDB');
  process.exit(0);
}

main().catch((err) => {
  console.error('\x1b[31mErreur fatale :', err.message, '\x1b[0m');
  console.error(err.stack);
  mongoose.disconnect().finally(() => process.exit(1));
});
