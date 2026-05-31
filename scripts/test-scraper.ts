/**
 * Script de test du scraper — à exécuter avec :
 *   npx ts-node scripts/test-scraper.ts
 *
 * Ce script scrape quelques pages et affiche les résultats
 * sans avoir besoin de MongoDB ni Qdrant configurés.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://bibliotheque-islamique.fr';
const DELAY_MS = 2000;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(url: string): Promise<string> {
  await delay(DELAY_MS);
  const res = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    },
    timeout: 30000,
  });
  return res.data;
}

async function scrapeBooks(sommairUrl: string) {
  console.log(`\n=== Scraping sommaire : ${sommairUrl} ===`);
  const html = await fetchPage(sommairUrl);
  const $ = cheerio.load(html);

  const books: { name: string; url: string }[] = [];

  $('a[href*="/hadith/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href === sommairUrl) return;

    const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    if (!fullUrl.includes('sahih-al-boukhari-') && !fullUrl.includes('livre')) return;

    const divs = $(el).find('div');
    let name = '';
    divs.each((i, div) => {
      if (i === 1) name = $(div).text().trim();
    });
    if (!name) name = $(el).text().trim().slice(0, 60);

    if (fullUrl && name) books.push({ name, url: fullUrl });
  });

  console.log(`Livres trouvés : ${books.length}`);
  books.slice(0, 3).forEach((b) => console.log(`  - ${b.name} → ${b.url}`));
  return books;
}

async function scrapeHadithPage(url: string, bookName: string) {
  console.log(`\n--- Scraping livre : ${bookName} ---`);
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const content = $('article, .entry-content, main').first();
  const hadiths: any[] = [];

  const paragraphs: string[] = [];
  content.find('p').each((_, el) => {
    paragraphs.push($(el).text().trim());
  });

  let current: { number: number; paras: string[] } | null = null;

  for (const para of paragraphs) {
    if (!para) continue;

    const numMatch = para.match(/hadith\s+n[°o]?\s*(\d+)/i);
    if (numMatch) {
      if (current && current.paras.length > 0) {
        hadiths.push(parseHadith(current));
      }
      current = { number: parseInt(numMatch[1]), paras: [] };
      continue;
    }
    if (current) current.paras.push(para);
  }
  if (current && current.paras.length > 0) hadiths.push(parseHadith(current));

  console.log(`Hadiths extraits : ${hadiths.length}`);

  // Afficher les 2 premiers
  hadiths.slice(0, 2).forEach((h) => {
    console.log(`\nHadith n°${h.number}`);
    console.log(`  Narrateur : ${h.narrator}`);
    console.log(`  FR : ${h.textFrench.slice(0, 120)}...`);
    console.log(`  AR : ${h.textArabic.slice(0, 80)}...`);
    console.log(`  Grade : ${h.gradeText || 'non précisé'}`);
  });

  return hadiths;
}

function parseHadith(raw: { number: number; paras: string[] }) {
  const arabicRegex = /[\u0600-\u06FF]/;
  const frParts: string[] = [];
  const arParts: string[] = [];
  let gradeText = '';

  for (const p of raw.paras) {
    if (/حكم|إسناده/.test(p)) { gradeText = p; continue; }

    const arCount = (p.match(/[\u0600-\u06FF]/g) || []).length;
    const frCount = (p.match(/[a-zA-ZÀ-ÿ]/g) || []).length;

    if (arCount > frCount) arParts.push(p);
    else frParts.push(p);
  }

  const textFrench = frParts.join(' ').replace(/\s+/g, ' ').trim();
  const narrator = textFrench.match(/D['']après\s+([^,(]+)/i)?.[1]?.trim() || '';

  return {
    number: raw.number,
    textFrench,
    textArabic: arParts.join(' ').replace(/\s+/g, ' ').trim(),
    narrator,
    gradeText,
  };
}

async function main() {
  console.log('=== TEST SCRAPER bibliotheque-islamique.fr ===\n');

  try {
    // 1. Scraper le sommaire Bukhari
    const books = await scrapeBooks(`${BASE_URL}/hadith/sommaire-al-boukhari`);

    if (books.length === 0) {
      console.log('\nAucun livre trouvé. Analyse du HTML de la page...');
      const html = await fetchPage(`${BASE_URL}/hadith/sommaire-al-boukhari`);
      const $ = cheerio.load(html);

      console.log('\nTous les liens /hadith/ trouvés :');
      $('a[href*="/hadith/"]').each((i, el) => {
        if (i < 10) console.log(`  ${$(el).attr('href')} — "${$(el).text().trim().slice(0, 50)}"`);
      });
      return;
    }

    // 2. Scraper le premier livre
    await scrapeHadithPage(books[0].url, books[0].name);

    console.log('\n=== TEST TERMINÉ AVEC SUCCÈS ===');
  } catch (err: any) {
    console.error('\nErreur:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
    }
  }
}

main();
