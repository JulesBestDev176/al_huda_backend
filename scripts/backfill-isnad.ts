import mongoose, { Model, Schema, model } from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI manquant dans .env');
  process.exit(1);
}

const HadithSchema = new Schema(
  {
    textFrench: { type: String, required: true },
    textArabic: { type: String, default: '' },
    narrator: { type: String, default: 'Non précisé' },
    isnad: { type: String, default: '' },
  },
  { strict: false, timestamps: true, suppressReservedKeysWarning: true },
);

function cleanText(text: string): string {
  return (text || '').replace(/\u200B/g, '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractIsnad(textArabic: string, textFrench: string, narrator: string): string {
  const frenchIntro =
    textFrench.match(/^(D['’]après[^:،.]+(?:a dit|rapporte|dit|:)?)/i)?.[1] ||
    textFrench.match(/^(Selon[^:،.]+(?:a dit|rapporte|dit|:)?)/i)?.[1];

  if (frenchIntro) return cleanText(frenchIntro).slice(0, 350);
  if (narrator && narrator !== 'Non précisé') return `D'après ${cleanText(narrator)}`;
  return '';
}

async function main() {
  console.log('Connexion à MongoDB...');
  await mongoose.connect(MONGODB_URI!, { dbName: 'hadith_db' });

  const Hadith = (mongoose.models.Hadith || model('Hadith', HadithSchema)) as Model<any>;
  const cursor = Hadith.find({}).cursor();

  let checked = 0;
  let updated = 0;

  for await (const hadith of cursor) {
    checked++;
    const isnad = extractIsnad(hadith.textArabic, hadith.textFrench, hadith.narrator);
    if (!isnad) continue;

    await Hadith.updateOne({ _id: hadith._id }, { $set: { isnad } });
    updated++;
  }

  console.log(`Isnad vérifiés: ${checked}`);
  console.log(`Isnad ajoutés: ${updated}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
