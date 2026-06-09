import { asc, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/drizzle/db";
import {
  questions,
  quizAttempts,
  quizzes,
  user,
  userResponses,
} from "@/drizzle/schema";

export async function GET() {
  try {
    // Vérifier que l'utilisateur est connecté et est admin
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Vérifier le rôle admin
    if (session.user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Récupérer toutes les tentatives de quiz avec les utilisateurs
    const allAttempts = await db
      .select({
        attemptId: quizAttempts.id,
        userId: quizAttempts.userId,
        userName: user.name,
        quizId: quizAttempts.quizId,
        score: quizAttempts.score,
        isRevision: quizAttempts.isRevision,
        completedAt: quizAttempts.completedAt,
        weekNumber: quizzes.weekNumber,
        date: quizzes.date,
        label: quizzes.label,
      })
      .from(quizAttempts)
      .innerJoin(user, eq(quizAttempts.userId, user.id))
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .orderBy(desc(quizzes.date));

    // Récupérer toutes les réponses utilisateur
    const allResponses = await db
      .select({
        id: userResponses.id,
        attemptId: userResponses.attemptId,
        userId: userResponses.userId,
        userName: user.name,
        quizId: userResponses.quizId,
        questionId: userResponses.questionId,
        selectedAnswer: userResponses.selectedAnswer,
        isCorrect: userResponses.isCorrect,
        createdAt: userResponses.createdAt,
        weekNumber: quizzes.weekNumber,
        date: quizzes.date,
        label: quizzes.label,
      })
      .from(userResponses)
      .innerJoin(user, eq(userResponses.userId, user.id))
      .innerJoin(quizzes, eq(userResponses.quizId, quizzes.id))
      .orderBy(desc(userResponses.createdAt));

    const allQuestions = await db
      .select({
        id: questions.id,
        quizId: questions.quizId,
        questionText: questions.questionText,
        options: questions.options,
        correctAnswer: questions.correctAnswer,
        orderIndex: questions.orderIndex,
        weekNumber: quizzes.weekNumber,
      })
      .from(questions)
      .innerJoin(quizzes, eq(questions.quizId, quizzes.id))
      .orderBy(asc(questions.orderIndex));

    type AttemptWithResponses = (typeof allAttempts)[number] & {
      responses: Array<
        Omit<(typeof allResponses)[number], "weekNumber" | "date" | "label">
      >;
    };

    // Grouper par semaine
    const groupedByWeek: Record<
      string,
      {
        weekNumber: string;
        date: string;
        label: string;
        questions: Array<{
          id: number;
          quizId: number;
          questionText: string;
          options: string[];
          correctAnswer: number;
          orderIndex: number;
        }>;
        attempts: AttemptWithResponses[];
        responsesCount: number;
      }
    > = {};

    const responsesByAttemptId = new Map<
      number,
      Array<
        Omit<(typeof allResponses)[number], "weekNumber" | "date" | "label">
      >
    >();

    for (const response of allResponses) {
      const {
        weekNumber: _weekNumber,
        date: _date,
        label: _label,
        ...responseData
      } = response;
      const attemptResponses =
        responsesByAttemptId.get(response.attemptId) ?? [];
      attemptResponses.push(responseData);
      responsesByAttemptId.set(response.attemptId, attemptResponses);
    }

    for (const attempt of allAttempts) {
      if (!groupedByWeek[attempt.weekNumber]) {
        groupedByWeek[attempt.weekNumber] = {
          weekNumber: attempt.weekNumber,
          date: attempt.date,
          label: attempt.label,
          questions: [],
          attempts: [],
          responsesCount: 0,
        };
      }

      const attemptResponses =
        responsesByAttemptId.get(attempt.attemptId) ?? [];

      groupedByWeek[attempt.weekNumber].attempts.push({
        ...attempt,
        responses: attemptResponses,
      });
      groupedByWeek[attempt.weekNumber].responsesCount +=
        attemptResponses.length;
    }

    for (const question of allQuestions) {
      if (!groupedByWeek[question.weekNumber]) {
        continue;
      }

      const { weekNumber: _weekNumber, ...questionData } = question;
      groupedByWeek[question.weekNumber].questions.push(questionData);
    }

    // Convertir en tableau et trier par date décroissante
    const weeks = Object.values(groupedByWeek).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return Response.json({ weeks });
  } catch (error) {
    console.error("Error fetching admin responses:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
