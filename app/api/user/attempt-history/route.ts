import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/drizzle/db";
import { quizAttempts, quizzes } from "@/drizzle/schema";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeOrganizationId = session.session?.activeOrganizationId;
    if (!activeOrganizationId) {
      return Response.json(
        { error: "No active organization" },
        { status: 403 },
      );
    }

    const recentAttempts = await db
      .select({
        attemptId: quizAttempts.id,
        weekNumber: quizzes.weekNumber,
        label: quizzes.label,
        date: quizzes.date,
        score: quizAttempts.score,
        totalQuestions: quizAttempts.totalQuestions,
        pointsEarned: quizAttempts.pointsEarned,
        medal: quizAttempts.medal,
        completedAt: quizAttempts.completedAt,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .where(
        and(
          eq(quizAttempts.userId, session.user.id),
          eq(quizzes.organizationId, activeOrganizationId),
          eq(quizAttempts.isRevision, 0),
        ),
      )
      .orderBy(desc(quizAttempts.completedAt), desc(quizAttempts.id))
      .limit(10);

    return Response.json({ attempts: recentAttempts });
  } catch (error) {
    console.error("Error fetching user attempt history:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
