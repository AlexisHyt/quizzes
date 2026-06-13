import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/drizzle/db";
import {
  questions,
  quizAttempts,
  quizzes,
  userQuizStats,
  userResponses,
} from "@/drizzle/schema";
import {
  computeMedal,
  computePoints,
  isBetterPerformance,
} from "@/lib/gamification";
import {
  getActiveOrganizationForSession,
  type OrganizationSession,
} from "@/lib/organizations";

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

    const organizationSession: OrganizationSession = {
      session: {
        activeOrganizationId: session.session?.activeOrganizationId ?? null,
      },
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      },
    };

    const activeOrganization =
      await getActiveOrganizationForSession(organizationSession);
    if (!activeOrganization) {
      return Response.json({ error: "Organization required" }, { status: 403 });
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

    const [quiz] = await db
      .select({ organizationId: quizzes.organizationId })
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .limit(1);

    if (!quiz || quiz.organizationId !== activeOrganization.id) {
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

    const totalQuestions = quizQuestions.length;
    const pointsEarned = computePoints(score, totalQuestions);
    const medal = computeMedal(score, totalQuestions);
    const isRealAttempt = !isRevision;

    const [attempt] = await db
      .insert(quizAttempts)
      .values({
        userId: session.user.id,
        quizId,
        score,
        totalQuestions,
        pointsEarned,
        medal,
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

    const [existingStats] = await db
      .select()
      .from(userQuizStats)
      .where(
        and(
          eq(userQuizStats.userId, session.user.id),
          eq(userQuizStats.organizationId, activeOrganization.id),
        ),
      )
      .limit(1);

    const now = new Date();

    const hasBetterPerformance = isBetterPerformance(
      score,
      totalQuestions,
      existingStats?.bestScore ?? 0,
      existingStats?.bestTotalQuestions ?? 0,
    );

    if (!existingStats) {
      await db.insert(userQuizStats).values({
        userId: session.user.id,
        organizationId: activeOrganization.id,
        totalPoints: pointsEarned,
        bestScore: score,
        bestTotalQuestions: totalQuestions,
        realAttemptsCount: isRealAttempt ? 1 : 0,
        revisionAttemptsCount: isRealAttempt ? 0 : 1,
        lastRealAttemptAt: isRealAttempt ? now : null,
        updatedAt: now,
      });
    } else {
      await db
        .update(userQuizStats)
        .set({
          totalPoints: existingStats.totalPoints + pointsEarned,
          bestScore: hasBetterPerformance ? score : existingStats.bestScore,
          bestTotalQuestions: hasBetterPerformance
            ? totalQuestions
            : existingStats.bestTotalQuestions,
          realAttemptsCount:
            existingStats.realAttemptsCount + (isRealAttempt ? 1 : 0),
          revisionAttemptsCount:
            existingStats.revisionAttemptsCount + (isRealAttempt ? 0 : 1),
          lastRealAttemptAt: isRealAttempt
            ? now
            : existingStats.lastRealAttemptAt,
          updatedAt: now,
        })
        .where(eq(userQuizStats.id, existingStats.id));
    }

    const [updatedStats] = await db
      .select({
        totalPoints: userQuizStats.totalPoints,
        bestScore: userQuizStats.bestScore,
        bestTotalQuestions: userQuizStats.bestTotalQuestions,
        realAttemptsCount: userQuizStats.realAttemptsCount,
        revisionAttemptsCount: userQuizStats.revisionAttemptsCount,
      })
      .from(userQuizStats)
      .where(
        and(
          eq(userQuizStats.userId, session.user.id),
          eq(userQuizStats.organizationId, activeOrganization.id),
        ),
      )
      .limit(1);

    return Response.json({
      score,
      total: totalQuestions,
      pointsEarned,
      medal,
      profile: updatedStats ?? null,
    });
  } catch (error) {
    console.error("Error submitting quiz:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
