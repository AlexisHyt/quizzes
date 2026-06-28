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

function getQuizUtcRange(dateOnly) {
  const startAt = new Date(`${dateOnly}T00:00:00.000Z`);
  const endAt = new Date(startAt);
  endAt.setUTCDate(endAt.getUTCDate() + 6);
  endAt.setUTCHours(23, 59, 59, 999);

  return {
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
  };
}

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

    // Garantir une organisation par défaut pour respecter la contrainte NOT NULL
    await client.query(
      "INSERT INTO organization (id, name, slug, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (slug) DO NOTHING",
      ["org_default", "Organisation par defaut", "default"],
    );

    // Insérer les quiz et les questions
    for (const quiz of quizzesData) {
      const { startAt, endAt } = getQuizUtcRange(quiz.date);

      // Insérer le quiz
      const quizResult = await client.query(
        'INSERT INTO quizzes ("startAt", "endAt", "organization_id") VALUES ($1, $2, $3) RETURNING id',
        [startAt, endAt, "org_default"],
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
        `✓ ${startAt} - ${endAt} insere avec ${quiz.questions.length} questions`,
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
