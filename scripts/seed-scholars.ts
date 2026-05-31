import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ScholarsService } from '../src/modules/scholars/scholars.service';

const SCHOLARS = [
  {
    slug: 'ibn-taymiyya',
    name: 'Ibn Taymiyya',
    nameArabic: 'ابن تيمية',
    born: '1263',
    died: '1328',
    era: 'XIIIe–XIVe siècle',
    origin: 'Harran (actuelle Turquie)',
    school: 'Hanbalite',
    specialties: ['Aqida', 'Fiqh', 'Tafsir', 'Hadith'],
    biography: `Ahmad ibn Abd al-Halim ibn Taymiyya est l'un des plus grands savants de l'islam sunnite. Né à Harran en 661 H (1263 CE), il se distingue dès son jeune âge par une mémoire prodigieuse et une maîtrise précoce des sciences islamiques. Élève des plus grands savants de Damas, il devient lui-même une référence incontournable en théologie, jurisprudence et hadith.

Imam courageux, il s'oppose aux déviations de son époque avec une argumentation rigoureuse tirée du Coran et de la Sunna. Emprisonné à plusieurs reprises pour ses positions, il décède en prison à Damas en 728 H (1328 CE). Son œuvre monumentale continue d'influencer la pensée islamique mondiale.`,
    books: [
      {
        title: 'Majmou\' Al-Fatawa (Recueil de fatwa)',
        titleArabic: 'مجموع الفتاوى',
        description: 'Encyclopédie en 37 volumes regroupant l\'ensemble des consultations juridiques et théologiques d\'Ibn Taymiyya. Référence majeure du fiqh et de l\'aqida hanbalite.',
        publishYear: null,
        topics: ['Fiqh', 'Aqida', 'Hadith'],
      },
      {
        title: 'Al-Aqida Al-Wasitiyya',
        titleArabic: 'العقيدة الواسطية',
        description: 'Traité de théologie résumant les fondements de la foi sunnite selon le Coran et la Sunna. Traduit en français sous le titre "La profession de foi".',
        publishYear: null,
        topics: ['Aqida'],
      },
      {
        title: 'Minhadj As-Sunna An-Nabawiyya',
        titleArabic: 'منهاج السنة النبوية',
        description: 'Réfutation des positions chiites et mu\'tazilites en matière de théologie et d\'histoire islamique. Ouvrage en 9 volumes.',
        publishYear: null,
        topics: ['Aqida', 'Histoire'],
      },
      {
        title: 'Iqtidha\' As-Sirat Al-Mustaqim',
        titleArabic: 'اقتضاء الصراط المستقيم',
        description: 'Traité sur la nécessité de suivre la voie droite et de s\'écarter des innovations blâmables. Traduit en français.',
        publishYear: null,
        topics: ['Aqida', 'Comportement'],
      },
    ],
  },
  {
    slug: 'ibn-al-qayyim',
    name: 'Ibn Al-Qayyim Al-Jawziyya',
    nameArabic: 'ابن قيم الجوزية',
    born: '1292',
    died: '1350',
    era: 'XIIIe–XIVe siècle',
    origin: 'Damas, Syrie',
    school: 'Hanbalite',
    specialties: ['Tazkiya', 'Fiqh', 'Aqida', 'Tafsir'],
    biography: `Muhammad ibn Abi Bakr, connu sous le nom d'Ibn Qayyim Al-Jawziyya, est l'un des plus grands disciples d'Ibn Taymiyya et l'un des savants les plus prolifiques de l'Islam. Né à Damas en 691 H (1292 CE), il étudie auprès des plus grands maîtres de son époque avant de devenir l'élève attitré d'Ibn Taymiyya.

Son œuvre embrasse toutes les sciences islamiques avec une profondeur et une finesse remarquables. Ses livres sur la purification de l'âme (tazkiya) et sur la jurisprudence restent parmi les plus lus du monde islamique. Il décède à Damas en 751 H (1350 CE), laissant un héritage intellectuel considérable.`,
    books: [
      {
        title: 'Zad Al-Ma\'ad (La provision pour l\'au-delà)',
        titleArabic: 'زاد المعاد',
        description: 'En 5 volumes, cet ouvrage traite de la biographie prophétique sous l\'angle des actes d\'adoration, de la médecine prophétique et des règles de jurisprudence.',
        publishYear: null,
        topics: ['Sira', 'Fiqh', 'Médecine prophétique'],
      },
      {
        title: 'Madaridj As-Salikine (Les degrés des pèlerins)',
        titleArabic: 'مدارج السالكين',
        description: 'Chef-d\'œuvre de la spiritualité islamique en 3 volumes. Commentaire du livre "Manazil As-Sa\'irin" d\'Al-Harawi sur les stations spirituelles.',
        publishYear: null,
        topics: ['Tazkiya', 'Spiritualité'],
      },
      {
        title: 'Ighathat Al-Lahfan (Le secours du cœur affligé)',
        titleArabic: 'إغاثة اللهفان',
        description: 'Traité sur les pièges du diable et les maladies du cœur, leurs remèdes spirituels et pratiques.',
        publishYear: null,
        topics: ['Tazkiya', 'Comportement'],
      },
      {
        title: 'Al-Fawa\'id (Les bénéfices spirituels)',
        titleArabic: 'الفوائد',
        description: 'Recueil de réflexions spirituelles, morales et intellectuelles. Traduit en français, c\'est l\'un de ses ouvrages les plus accessibles.',
        publishYear: null,
        topics: ['Tazkiya', 'Spiritualité'],
      },
    ],
  },
  {
    slug: 'imam-nawawi',
    name: 'Imam An-Nawawi',
    nameArabic: 'الإمام النووي',
    born: '1233',
    died: '1277',
    era: 'XIIIe siècle',
    origin: 'Nawa, Syrie',
    school: 'Shafi\'ite',
    specialties: ['Hadith', 'Fiqh', 'Tazkiya'],
    biography: `Yahya ibn Sharaf An-Nawawi est l'un des imams les plus célèbres de l'école shafi\'ite et l'un des grands spécialistes du hadith. Né à Nawa (Syrie) en 631 H (1233 CE), il consacre sa vie à la science islamique au point de jeûner souvent et de dormir très peu pour maximiser ses heures d'étude.

Son commentaire du Sahih de Muslim en 18 volumes reste une référence mondiale. Son recueil des 40 hadiths est mémorisé par des millions de musulmans. Il décède à seulement 45 ans à Nawa, laissant une œuvre qui dépasse largement sa courte vie.`,
    books: [
      {
        title: '40 Hadiths Nawawi',
        titleArabic: 'الأربعون النووية',
        description: 'Le recueil de 42 hadiths fondamentaux de l\'islam, résumant les piliers de la foi et de la pratique. L\'un des textes les plus mémorisés et enseignés.',
        publishYear: null,
        topics: ['Hadith', 'Foi', 'Comportement'],
      },
      {
        title: 'Riyadh As-Salihine (Les jardins des vertueux)',
        titleArabic: 'رياض الصالحين',
        description: 'Anthologie de hadiths regroupés par thèmes moraux et spirituels. Traduit dans toutes les langues, c\'est une référence pour l\'éducation islamique.',
        publishYear: null,
        topics: ['Hadith', 'Comportement', 'Tazkiya'],
      },
      {
        title: 'Al-Minhaj fi Sharh Sahih Muslim',
        titleArabic: 'المنهاج في شرح صحيح مسلم',
        description: 'Commentaire monumental du Sahih de Muslim en 18 volumes. Référence incontournable pour la compréhension des hadiths.',
        publishYear: null,
        topics: ['Hadith', 'Fiqh'],
      },
    ],
  },
  {
    slug: 'imam-bukhari',
    name: 'Imam Al-Bukhari',
    nameArabic: 'الإمام البخاري',
    born: '810',
    died: '870',
    era: 'IXe siècle',
    origin: 'Boukhara (actuel Ouzbékistan)',
    school: 'Indépendant (Shafi\'ite de tendance)',
    specialties: ['Hadith', 'Rijal', 'Fiqh'],
    biography: `Muhammad ibn Isma\'il Al-Bukhari est le plus grand muhaddith de l\'histoire islamique. Né à Boukhara en 194 H (810 CE), il voyage dès son jeune âge dans tout le monde islamique pour collecter les hadiths du Prophète ﷺ. On dit qu\'il a mémorisé plus de 600 000 hadiths avec leurs chaînes de transmission.

Son "Sahih", compilé en 16 ans, est considéré comme le livre le plus authentique après le Coran. Parmi ses critères rigoureux: la continuité de la chaîne, la fiabilité de chaque transmetteur, et l\'absence de contradiction avec d\'autres hadiths authentiques. Il décède à Khartank (Ouzbékistan) en 256 H (870 CE).`,
    books: [
      {
        title: 'Al-Jami\' As-Sahih (Le Sahih d\'Al-Bukhari)',
        titleArabic: 'الجامع الصحيح',
        description: 'La collection la plus authentique de hadiths après le Coran. 7563 hadiths sélectionnés parmi 600 000, organisés en 97 livres thématiques.',
        publishYear: null,
        topics: ['Hadith', 'Fiqh', 'Aqida'],
      },
      {
        title: 'Al-Adab Al-Mufrad',
        titleArabic: 'الأدب المفرد',
        description: 'Recueil de hadiths sur l\'éthique et les bonnes mœurs islamiques. Traduit en français, très utilisé pour l\'éducation du comportement.',
        publishYear: null,
        topics: ['Comportement', 'Hadith'],
      },
    ],
  },
  {
    slug: 'imam-malik',
    name: 'Imam Malik ibn Anas',
    nameArabic: 'الإمام مالك بن أنس',
    born: '711',
    died: '795',
    era: 'VIIIe siècle',
    origin: 'Médine, Arabie',
    school: 'Malikite (fondateur)',
    specialties: ['Fiqh', 'Hadith', 'Usul'],
    biography: `Malik ibn Anas est le fondateur de l\'école malikite, l\'une des quatre grandes écoles juridiques sunnites. Né à Médine en 93 H (711 CE), il grandit dans la ville du Prophète ﷺ entouré des savants de la première génération. Il passe toute sa vie à Médine, refusant de quitter la cité du Prophète.

Son "Muwatta\'" est le premier recueil systématique de hadiths et de jurisprudence de l\'Islam. L\'école malikite est prédominante en Afrique de l\'Ouest, notamment au Sénégal, au Mali et en Mauritanie. Il décède à Médine en 179 H (795 CE).`,
    books: [
      {
        title: 'Al-Muwatta\' (La voie tracée)',
        titleArabic: 'الموطأ',
        description: 'Premier grand recueil de hadiths et de jurisprudence de l\'Islam. Fondement de l\'école malikite, très répandu en Afrique de l\'Ouest. Traduit en français.',
        publishYear: null,
        topics: ['Hadith', 'Fiqh'],
      },
    ],
  },
  {
    slug: 'cheikh-anta-diop',
    name: 'Dr Ahmad Lo',
    nameArabic: 'أحمد لو',
    born: '1950',
    died: null,
    era: 'XXe–XXIe siècle',
    origin: 'Sénégal',
    school: 'Malikite / Tijaniyya',
    specialties: ['Fiqh', 'Tazkiya', 'Éducation islamique', 'Langue arabe'],
    biography: `Le Docteur Ahmad Lo est l'un des grands savants islamiques sénégalais contemporains. Formé au Sénégal puis dans les grandes universités du monde arabe, il allie la rigueur scientifique islamique classique à une pédagogie adaptée au contexte africain et francophone.

Enseignant, auteur et conférencier reconnu, il œuvre pour la transmission des sciences islamiques en français et en wolof. Ses travaux couvrent le fiqh malikite, la spiritualité soufie et l'éducation islamique. Il est une référence pour la communauté musulmane d'Afrique de l'Ouest francophone.`,
    books: [
      {
        title: 'Introduction au Fiqh Malikite',
        titleArabic: null,
        description: 'Guide pédagogique en français sur les fondements du droit islamique selon l\'école malikite, adapté au contexte sénégalais et ouest-africain.',
        publishYear: null,
        topics: ['Fiqh', 'Éducation islamique'],
      },
      {
        title: 'La Spiritualité en Islam : Voie Tijaniyya',
        titleArabic: null,
        description: 'Présentation de la confrérie Tijaniyya, ses fondements spirituels, ses pratiques et son rôle dans l\'islam d\'Afrique de l\'Ouest.',
        publishYear: null,
        topics: ['Tazkiya', 'Spiritualité', 'Afrique'],
      },
    ],
  },
  {
    slug: 'tariq-ramadan',
    name: 'Tariq Ramadan',
    nameArabic: 'طارق رمضان',
    born: '1962',
    died: null,
    era: 'XXe–XXIe siècle',
    origin: 'Genève, Suisse',
    school: 'Sunni (renouveau islamique)',
    specialties: ['Philosophie islamique', 'Éthique', 'Réforme', 'Dialogue interreligieux'],
    biography: `Tariq Ramadan est un intellectuel musulman suisse de renom, petit-fils du fondateur des Frères musulmans Hassan Al-Banna. Professeur de philosophie islamique à l\'Université d\'Oxford, il est l\'auteur de nombreux ouvrages en français sur l\'islam contemporain, la citoyenneté et l\'éthique.

Ses œuvres visent à proposer une lecture renouvelée de l\'islam en contexte occidental et à encourager les musulmans à s\'engager pleinement dans leurs sociétés. Ses livres sont parmi les plus lus en français sur l\'islam contemporain.`,
    books: [
      {
        title: 'Islam, le face à face des civilisations',
        titleArabic: null,
        description: 'Analyse des relations entre le monde islamique et l\'Occident. Une réflexion sur l\'identité, le dialogue et la coexistence des civilisations.',
        publishYear: 1995,
        publisher: 'Tawhid',
        topics: ['Civilisation', 'Dialogue', 'Modernité'],
      },
      {
        title: 'Les musulmans d\'Occident et l\'avenir de l\'islam',
        titleArabic: null,
        description: 'Réflexion sur la condition des musulmans vivant en Europe et en Amérique du Nord. Propose une vision de l\'islam comme religion citoyenne.',
        publishYear: 2003,
        publisher: 'Sindbad',
        topics: ['Modernité', 'Occident', 'Citoyenneté'],
      },
      {
        title: 'Muhammad, vie du Prophète',
        titleArabic: null,
        description: 'Biographie du Prophète Muhammad ﷺ destinée au grand public francophone. Un des best-sellers islamiques en langue française.',
        publishYear: 2006,
        publisher: 'Presses du Châtelet',
        topics: ['Sira', 'Prophète'],
      },
    ],
  },
  {
    slug: 'hassan-iquioussen',
    name: 'Hassan Iquioussen',
    nameArabic: 'حسن إقيوسن',
    born: '1964',
    died: null,
    era: 'XXe–XXIe siècle',
    origin: 'France (origines marocaines)',
    school: 'Sunni',
    specialties: ['Prédication', 'Éducation islamique', 'Histoire islamique'],
    biography: `Hassan Iquioussen est l\'un des prédicateurs islamiques francophones les plus connus en France et en Europe. Né en France, il est formé aux sciences islamiques et se consacre à la prédication (da\'wa) en français depuis les années 1990.

Ses conférences audiovisuelles sur l\'histoire de l\'islam, les prophètes et les pratiques islamiques ont touché des millions de francophones. Auteur de plusieurs livres, il est une figure majeure de la transmission islamique en langue française.`,
    books: [
      {
        title: 'À la découverte du Coran',
        titleArabic: null,
        description: 'Introduction accessible au Coran : sa révélation, sa structure, ses thèmes et sa place dans la vie du musulman. Adapté aux francophones.',
        publishYear: null,
        topics: ['Coran', 'Éducation islamique'],
      },
      {
        title: 'Les grandes figures de l\'islam',
        titleArabic: null,
        description: 'Présentation des personnages majeurs de l\'histoire islamique : compagnons du Prophète, savants, conquérants et réformateurs.',
        publishYear: null,
        topics: ['Histoire', 'Biographies'],
      },
    ],
  },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const service = app.get(ScholarsService);

  console.log(`Seeding ${SCHOLARS.length} savants...`);
  for (const s of SCHOLARS) {
    await service.upsert(s as any);
    console.log(`  ✓ ${s.name}`);
  }
  console.log('Done.');
  await app.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
