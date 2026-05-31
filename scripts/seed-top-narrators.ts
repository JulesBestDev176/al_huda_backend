import mongoose, { model, Schema } from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI manquant dans .env');
  process.exit(1);
}

const NarratorSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    aliases: { type: [String], default: [] },
    role: { type: String, default: 'Narrateur' },
    biography: { type: String, default: '' },
    bibliography: { type: [String], default: [] },
    sources: { type: [String], default: [] },
  },
  { timestamps: true }
);

const TOP_NARRATORS = [
  {
    name: 'Abou Hourayra',
    aliases: ['Abu Hurayrah', 'Abû Hurayrah', 'Abou Houraira', 'Abu Hurairah', 'Abû Hurayra', 'Abu Harayrah'],
    role: 'Compagnon (Sahabi)',
    biography: "Abou Hourayra (en arabe : أبو هريرة), littéralement « le père des chatons », est l'un des plus célèbres compagnons du prophète Mahomet. Il est reconnu comme le compagnon ayant rapporté le plus grand nombre de hadiths, avec plus de 5374 traditions recensées. Sa mémoire exceptionnelle et son dévouement à apprendre du Prophète font de lui une figure centrale de la transmission de la Sunna.",
    bibliography: ['Musnad d\'Ahmad', 'Sahih al-Bukhari', 'Sahih Muslim'],
    sources: ['Wikipedia', 'Encyclopédie de la Sunna']
  },
  {
    name: 'Aïcha',
    aliases: ['Aisha', '‘Aicha', 'Aïchah', 'Aïsha bint Abou Bakr', 'Aishah'],
    role: 'Mère des croyants',
    biography: "Aïcha bint Abou Bakr (en arabe : عائشة بنت أبي بكر) est la troisième épouse du prophète Mahomet. Fille d'Abou Bakr, elle est reconnue pour sa très grande érudition religieuse et sa transmission de nombreux hadiths (environ 2210), en particulier sur la vie privée du Prophète et les règles de jurisprudence.",
    bibliography: ['Sahih al-Bukhari', 'Sahih Muslim'],
    sources: ['Wikipedia', 'Sira']
  },
  {
    name: 'Abdullah Ibn Oumar',
    aliases: ['Ibn ‘Umar', 'Ibn `Umar', 'Ibn Oumar', 'Abdallah Ibn Omar'],
    role: 'Compagnon (Sahabi)',
    biography: "Abdullah ibn Omar (arabe : عبدالله بن عمر بن الخطاب) est le fils du deuxième calife Omar ibn al-Khattâb. Il est célèbre pour son attachement strict à la Sunna du Prophète et figure parmi les compagnons ayant rapporté le plus de hadiths (plus de 2630).",
    bibliography: ['Muwatta Malik', 'Sahihs'],
    sources: ['Wikipedia']
  },
  {
    name: 'Abdullah Ibn Abbas',
    aliases: ['Ibn ‘Abbas', 'ibn Abbâs', 'Ibn Abbas', 'Abdallah Ibn Abbas', '‘Abdallah Ibn ‘Abbas'],
    role: 'Compagnon (Sahabi) - Exégète',
    biography: "Abdullah ibn Abbas est le cousin paternel du Prophète. Surnommé « l'érudit de la communauté » (Hibr al-Umma), il est considéré comme le père de l'exégèse coranique (Tafsir). Il a rapporté environ 1660 hadiths.",
    bibliography: ['Tafsir Ibn Abbas', 'Musnad'],
    sources: ['Wikipedia']
  },
  {
    name: 'Anas Ibn Malik',
    aliases: ['Anas Ibn Mâlik', 'Anas ibn Malik', 'Anas'],
    role: 'Compagnon (Sahabi)',
    biography: "Anas ibn Malik a été au service du Prophète Mahomet pendant dix ans à Médine. Cette proximité lui a permis d'être un témoin privilégié de la vie quotidienne du Prophète et de rapporter plus de 2286 hadiths.",
    bibliography: ['Musnad', 'Sahihs'],
    sources: ['Wikipedia']
  },
  {
    name: 'Omar ibn al-Khattâb',
    aliases: ['‘Omar ibn El Khattab', 'Omar', 'Umar ibn al-Khattab', '‘Omar'],
    role: 'Deuxième Calife',
    biography: "Omar ibn al-Khattâb, surnommé Al-Fâroûq, est l'un des plus proches compagnons du Prophète et le deuxième calife de l'Islam. Ses décisions et narrations ont eu un impact profond sur la jurisprudence islamique.",
    bibliography: ['Sahihs'],
    sources: ['Wikipedia']
  },
  {
    name: 'Jabir ibn Abdillah',
    aliases: ['Jabir Ibn ‘Abdillah', 'ibn Jabir `Abdullah', 'Jabir ibn Abdullah'],
    role: 'Compagnon (Sahabi)',
    biography: "Jabir ibn Abdillah al-Ansari est un compagnon médinois (Ansari). Il a participé à de nombreuses expéditions avec le Prophète et a transmis un grand nombre de hadiths, estimés à environ 1540.",
    bibliography: ['Sahihs'],
    sources: ['Wikipedia']
  },
  {
    name: 'Abou Saïd Al Khoudri',
    aliases: ['Abou Said Al Khoudrî', 'Abu Sa\'id al-Khudri', 'Abou Saïd'],
    role: 'Compagnon (Sahabi)',
    biography: "Abou Saïd al-Khoudri, de la tribu médinoise des Banu Khazraj, fut l'un des jeunes compagnons du Prophète. Il a rapporté de nombreux hadiths (1170) et était fréquemment consulté pour ses connaissances après la mort du Prophète.",
    bibliography: ['Sahihs'],
    sources: ['Wikipedia']
  },
  {
    name: 'Ibn Mas\'ud',
    aliases: ['Abdallah Ibn Mass’oud', 'Ibn Mas’ud', 'Abdullah ibn Masud'],
    role: 'Compagnon (Sahabi)',
    biography: "Abdullah ibn Mas'ud fut l'un des premiers convertis à l'Islam. Le Prophète l'a recommandé pour l'apprentissage de la récitation du Coran. Il fut également un grand juriste et a rapporté environ 848 hadiths.",
    bibliography: ['Sahihs'],
    sources: ['Wikipedia']
  }
];

async function main() {
  console.log('Connexion à MongoDB...');
  await mongoose.connect(MONGODB_URI!, { dbName: 'hadith_db' });
  const NarratorModel = (mongoose.models.Narrator as any) || mongoose.model<any>('Narrator', NarratorSchema);

  for (const person of TOP_NARRATORS) {
    const existing = await NarratorModel.findOne({ name: person.name });
    
    if (existing) {
      await NarratorModel.updateOne(
        { name: person.name },
        { $set: person }
      );
      console.log(`Mis à jour: ${person.name}`);
    } else {
      await NarratorModel.create(person);
      console.log(`Créé: ${person.name}`);
    }

    // Nettoyer les doublons créés par le scraper automatique (les alias vides)
    if (person.aliases && person.aliases.length > 0) {
      await NarratorModel.deleteMany({
        name: { $in: person.aliases }
      });
      console.log(`  -> Doublons supprimés pour les alias de ${person.name}`);
    }
  }

  console.log('Terminé avec succès.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  mongoose.disconnect().finally(() => process.exit(1));
});
