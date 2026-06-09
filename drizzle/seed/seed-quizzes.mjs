import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pkg from "pg";

const { Client } = pkg;

// Charger les variables d'environnement
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL non défini dans .env");
  process.exit(1);
}

// Parser la DATABASE_URL
const client = new Client({
  connectionString: DATABASE_URL,
});

async function seedQuizzes() {
  try {
    // Créer une connexion
    await client.connect();
    console.log("✓ Connecté à la base de données");

    // Lire les données des quiz
    const quizzesPath = path.resolve("./drizzle/seed/quizzes_data.json");
    const quizzesData = JSON.parse(fs.readFileSync(quizzesPath, "utf-8"));
    console.log(
      `✓ ${quizzesData.length} quiz chargés depuis quizzes_data.json`,
    );

    // Vérifier si les quiz existent déjà
    const existingQuizzesResult = await client.query(
      "SELECT COUNT(*) as count FROM quizzes",
    );
    if (parseInt(existingQuizzesResult.rows[0].count, 10) > 0) {
      console.log(
        `⚠ ${existingQuizzesResult.rows[0].count} quiz existent déjà. Abandon du seed.`,
      );
      return;
    }

    // Insérer les quiz et les questions
    for (const quiz of quizzesData) {
      // Insérer le quiz
      const quizResult = await client.query(
        'INSERT INTO quizzes ("weekNumber", "date", "label") VALUES ($1, $2, $3) RETURNING id',
        [quiz.weekNumber, quiz.date, quiz.label],
      );

      const quizId = quizResult.rows[0].id;

      // Insérer les questions
      for (let i = 0; i < quiz.questions.length; i++) {
        const question = quiz.questions[i];
        await client.query(
          'INSERT INTO questions ("quizId", "questionText", "options", "correctAnswer", "explanation", "orderIndex") VALUES ($1, $2, $3, $4, $5, $6)',
          [
            quizId,
            question.text,
            JSON.stringify(question.options),
            question.correctAnswer,
            question.explanation,
            i + 1,
          ],
        );
      }

      console.log(
        `✓ ${quiz.weekNumber} - ${quiz.label} inséré avec ${quiz.questions.length} questions`,
      );
    }

    console.log(
      `\n✓ Seed complété! ${quizzesData.length} quiz et ${quizzesData.reduce((sum, q) => sum + q.questions.length, 0)} questions insérés.`,
    );
  } catch (error) {
    console.error("✗ Erreur lors du seed:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedQuizzes();
