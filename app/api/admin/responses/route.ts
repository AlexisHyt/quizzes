import { and, asc, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/drizzle/db";
import {
  member,
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
    const activeOrganizationId = session.session?.activeOrganizationId;
    if (!activeOrganizationId) {
      return Response.json(
        { error: "No active organization" },
        { status: 403 },
      );
    }

    const [activeMembership] = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.userId, session.user.id),
          eq(member.organizationId, activeOrganizationId),
        ),
      )
      .limit(1);

    if (
      !activeMembership ||
      !["owner", "admin"].includes(activeMembership.role)
    ) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Récupérer toutes les tentatives de quiz avec les utilisateurs
    const allAttempts = await db
      .select({
        attemptId: quizAttempts.id,
        userId: quizAttempts.userId,
        userName: user.name,
        userEmail: user.email,
        quizId: quizAttempts.quizId,
        score: quizAttempts.score,
        totalQuestions: quizAttempts.totalQuestions,
        pointsEarned: quizAttempts.pointsEarned,
        medal: quizAttempts.medal,
        isRevision: quizAttempts.isRevision,
        completedAt: quizAttempts.completedAt,
        startAt: quizzes.startAt,
        endAt: quizzes.endAt,
      })
      .from(quizAttempts)
      .innerJoin(user, eq(quizAttempts.userId, user.id))
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .where(eq(quizzes.organizationId, activeOrganizationId))
      .orderBy(desc(quizzes.endAt), desc(quizAttempts.completedAt));

    // Récupérer toutes les réponses utilisateur
    const allResponses = await db
      .select({
        id: userResponses.id,
        attemptId: userResponses.attemptId,
        userId: userResponses.userId,
        userName: user.name,
        userEmail: user.email,
        quizId: userResponses.quizId,
        questionId: userResponses.questionId,
        selectedAnswer: userResponses.selectedAnswer,
        isCorrect: userResponses.isCorrect,
        createdAt: userResponses.createdAt,
      })
      .from(userResponses)
      .innerJoin(user, eq(userResponses.userId, user.id))
      .innerJoin(quizzes, eq(userResponses.quizId, quizzes.id))
      .where(eq(quizzes.organizationId, activeOrganizationId))
      .orderBy(desc(userResponses.createdAt));

    const allQuestions = await db
      .select({
        id: questions.id,
        quizId: questions.quizId,
        questionText: questions.questionText,
        options: questions.options,
        correctAnswer: questions.correctAnswer,
        orderIndex: questions.orderIndex,
      })
      .from(questions)
      .innerJoin(quizzes, eq(questions.quizId, quizzes.id))
      .where(eq(quizzes.organizationId, activeOrganizationId))
      .orderBy(asc(questions.orderIndex));

    type AttemptWithResponses = (typeof allAttempts)[number] & {
      responses: Array<(typeof allResponses)[number]>;
    };

    const groupedByQuizId: Record<
      number,
      {
        quizId: number;
        startAt: Date;
        endAt: Date;
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
      Array<(typeof allResponses)[number]>
    >();

    for (const response of allResponses) {
      const attemptResponses =
        responsesByAttemptId.get(response.attemptId) ?? [];
      attemptResponses.push(response);
      responsesByAttemptId.set(response.attemptId, attemptResponses);
    }

    for (const attempt of allAttempts) {
      if (!groupedByQuizId[attempt.quizId]) {
        groupedByQuizId[attempt.quizId] = {
          quizId: attempt.quizId,
          startAt: attempt.startAt,
          endAt: attempt.endAt,
          questions: [],
          attempts: [],
          responsesCount: 0,
        };
      }

      const attemptResponses =
        responsesByAttemptId.get(attempt.attemptId) ?? [];

      groupedByQuizId[attempt.quizId].attempts.push({
        ...attempt,
        responses: attemptResponses,
      });
      groupedByQuizId[attempt.quizId].responsesCount +=
        attemptResponses.length;
    }

    for (const question of allQuestions) {
      if (!groupedByQuizId[question.quizId]) {
        continue;
      }

      groupedByQuizId[question.quizId].questions.push(question);
    }

    const quizzesData = Object.values(groupedByQuizId).sort(
      (a, b) => b.endAt.getTime() - a.endAt.getTime(),
    );

    return Response.json({
      quizzes: quizzesData.map((quizData) => ({
        ...quizData,
        startAt: quizData.startAt.toISOString(),
        endAt: quizData.endAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching admin responses:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
