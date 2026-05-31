import 'reflect-metadata';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const QuestionSchema = new mongoose.Schema({
  answersCount: { type: Number, default: 0 },
});

const AnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumQuestion' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
});

const QuestionModel = mongoose.model('ForumQuestion', QuestionSchema);
const AnswerModel = mongoose.model('ForumAnswer', AnswerSchema);

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI manquant dans .env');
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: 'hadith_db' });

  const deleted = await AnswerModel.deleteMany({ status: 'rejected' });
  const removedViews = await QuestionModel.collection.updateMany({}, { $unset: { views: '' } });
  const questions = await QuestionModel.find({}, { _id: 1 }).lean();

  for (const question of questions) {
    const answersCount = await AnswerModel.countDocuments({
      questionId: question._id,
      status: 'approved',
    });
    await QuestionModel.updateOne({ _id: question._id }, { $set: { answersCount } });
  }

  const remainingRejected = await AnswerModel.countDocuments({ status: 'rejected' });

  console.log(`Réponses rejetées supprimées : ${deleted.deletedCount}`);
  console.log(`Champs views supprimés : ${removedViews.modifiedCount ?? 0} questions`);
  console.log(`Compteurs recalculés : ${questions.length} questions`);
  console.log(`Réponses rejetées restantes : ${remainingRejected}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Erreur:', err);
  process.exit(1);
});
