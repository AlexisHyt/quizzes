import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/drizzle/db";
import { questions, quizAttempts, userResponses } from "@/drizzle/schema";

type SubmitBody = {
  quizId: number;
  answers: Record<number, number>; // questionId -> selectedAnswer index
  isRevision?: boolean;
};

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: SubmitBody = await request.json();
    const { quizId, answers, isRevision } = body;

    if (!quizId || !answers || typeof answers !== "object") {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Récupérer les questions du quiz pour calculer le score
    const quizQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.quizId, quizId));

    if (quizQuestions.length === 0) {
      return Response.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Calculer le score et préparer les réponses
    const evaluatedResponses = quizQuestions.map((question) => {
      const selectedAnswer = answers[question.id];
      const isCorrect = selectedAnswer === question.correctAnswer ? 1 : 0;

      return {
        questionId: question.id,
        selectedAnswer: selectedAnswer ?? -1,
        isCorrect,
      };
    });

    const score = evaluatedResponses.reduce(
      (total, response) => total + response.isCorrect,
      0,
    );

    const [attempt] = await db
      .insert(quizAttempts)
      .values({
        userId: session.user.id,
        quizId,
        score,
        isRevision: isRevision ? 1 : 0,
      })
      .returning({ id: quizAttempts.id });

    if (!attempt) {
      return Response.json(
        { error: "Unable to create quiz attempt" },
        { status: 500 },
      );
    }

    await db.insert(userResponses).values(
      evaluatedResponses.map((response) => ({
        userId: session.user.id,
        attemptId: attempt.id,
        quizId,
        questionId: response.questionId,
        selectedAnswer: response.selectedAnswer,
        isCorrect: response.isCorrect,
      })),
    );

    return Response.json({ score, total: quizQuestions.length });
  } catch (error) {
    console.error("Error submitting quiz:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
