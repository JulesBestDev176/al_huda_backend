// Script d'initialisation MongoDB
// Crée la base de données et l'utilisateur applicatif

db = db.getSiblingDB('hadith_db');

db.createUser({
  user: 'hadith_user',
  pwd: 'hadith_pass_2024',
  roles: [{ role: 'readWrite', db: 'hadith_db' }],
});

db.createCollection('hadiths');

db.hadiths.createIndex(
  { textFrench: 'text', textArabic: 'text', narrator: 'text', topics: 'text' },
  { weights: { textFrench: 10, narrator: 5, topics: 8, textArabic: 6 }, name: 'text_search' }
);

db.hadiths.createIndex({ collection: 1, 'authenticity.grade': 1 });
db.hadiths.createIndex({ 'authenticity.score': -1 });
db.hadiths.createIndex({ isEmbedded: 1 });

print('Base hadith_db initialisée avec succès');
