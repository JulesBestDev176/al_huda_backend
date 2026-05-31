export interface HadithRaw {
  number: number;
  numberInCollection: string; // ex: "7071" tel qu'affiché sur le site
  textFrench: string;
  textArabic: string;
  narrator: string;
  isnad?: string;
  collection: string;        // ex: "bukhari"
  collectionLabel: string;   // ex: "Sahih Al Boukhari"
  bookName: string;
  bookSlug: string;
  chapterName?: string;
  gradeText?: string;        // texte brut du grade (arabe ou fr)
  topics?: string[];
  commentary?: string;
  scholarRef?: string;
  scholarCommentaries?: Array<{ scholar: string; work: string; text: string }>;
  sourceUrl: string;
  reference: string;         // ex: "Rapporté par Al Boukhary dans son Sahih n°1"
}

export interface CollectionInfo {
  id: string;           // ex: "bukhari"
  label: string;        // ex: "Sahih Al Boukhari"
  sommairUrl: string;
  totalHadiths: number;
}

export interface BookInfo {
  collectionId: string;
  bookNumber: number;
  nameFrench: string;
  nameArabic?: string;
  url: string;
  hadithRange?: { from: number; to: number };
}
