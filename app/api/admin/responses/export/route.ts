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

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  try {
    // Vérifier que l'utilisateur est connecté et est admin
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

    const { searchParams } = new URL(request.url);
    const weekNumber = searchParams.get("weekNumber");

    if (!weekNumber) {
      return Response.json(
        { error: "weekNumber query param is required" },
        { status: 400 },
      );
    }

    // Récupérer le quiz correspondant à cette semaine
    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(
        and(
          eq(quizzes.weekNumber, weekNumber),
          eq(quizzes.organizationId, activeOrganizationId),
        ),
      );

    if (!quiz) {
      return Response.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Récupérer les questions du quiz
    const quizQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.quizId, quiz.id))
      .orderBy(asc(questions.orderIndex));

    // Récupérer les tentatives avec les utilisateurs
    const attempts = await db
      .select({
        attemptId: quizAttempts.id,
        userId: quizAttempts.userId,
        userName: user.name,
        userEmail: user.email,
        score: quizAttempts.score,
        pointsEarned: quizAttempts.pointsEarned,
        medal: quizAttempts.medal,
        isRevision: quizAttempts.isRevision,
        completedAt: quizAttempts.completedAt,
      })
      .from(quizAttempts)
      .innerJoin(user, eq(quizAttempts.userId, user.id))
      .where(eq(quizAttempts.quizId, quiz.id))
      .orderBy(desc(quizAttempts.completedAt));

    // Récupérer toutes les réponses pour ce quiz
    const responses = await db
      .select({
        attemptId: userResponses.attemptId,
        questionId: userResponses.questionId,
        selectedAnswer: userResponses.selectedAnswer,
        isCorrect: userResponses.isCorrect,
        createdAt: userResponses.createdAt,
      })
      .from(userResponses)
      .where(eq(userResponses.quizId, quiz.id));

    // Indexer les réponses par attemptId et questionId
    const responseIndex = new Map<
      string,
      { selectedAnswer: number; isCorrect: number; createdAt: Date }
    >();
    for (const r of responses) {
      responseIndex.set(`${r.attemptId}-${r.questionId}`, {
        selectedAnswer: r.selectedAnswer,
        isCorrect: r.isCorrect,
        createdAt: r.createdAt,
      });
    }

    // Construire les en-têtes CSV
    const questionHeaders: string[] = [];
    for (const q of quizQuestions) {
      const shortText =
        q.questionText.length > 50
          ? `${q.questionText.substring(0, 47)}...`
          : q.questionText;
      questionHeaders.push(`Q${q.orderIndex} - ${shortText}`);
      questionHeaders.push(`Réponse Q${q.orderIndex}`);
      questionHeaders.push(`Correcte Q${q.orderIndex}`);
    }

    const csvHeaders = [
      "Utilisateur",
      "Email",
      "Score",
      "Total questions",
      "Points",
      "Médaille",
      "Mode",
      "Date de complétion",
      ...questionHeaders,
    ];

    const csvRows: string[][] = [csvHeaders];

    for (const attempt of attempts) {
      const row: string[] = [
        attempt.userName,
        attempt.userEmail,
        String(attempt.score),
        String(quizQuestions.length),
        String(attempt.pointsEarned),
        String(attempt.medal),
        attempt.isRevision ? "Révision" : "Tentative réelle",
        new Date(attempt.completedAt).toLocaleString("fr-FR", {
          timeZone: "Europe/Paris",
        }),
      ];

      for (const q of quizQuestions) {
        const resp = responseIndex.get(`${attempt.attemptId}-${q.id}`);
        if (resp) {
          const selectedOption =
            q.options[resp.selectedAnswer] ??
            `Option ${resp.selectedAnswer + 1}`;
          row.push(selectedOption);
          row.push(`Option ${resp.selectedAnswer + 1}`);
          row.push(resp.isCorrect ? "Oui" : "Non");
        } else {
          row.push("N/A");
          row.push("N/A");
          row.push("N/A");
        }
      }

      csvRows.push(row);
    }

    const csvContent = csvRows
      .map((row) => row.map(escapeCsvField).join(","))
      .join("\n");

    const bom = "\uFEFF"; // BOM UTF-8 pour Excel
    const filename = `quiz-${weekNumber}-${quiz.label.replace(/\s+/g, "-")}.csv`;

    return new Response(bom + csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting CSV:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
