import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/drizzle/db";
import { member, questions, quizzes } from "@/drizzle/schema";

type QuizPayload = {
  startDate: string;
  endDate: string;
  questions: Array<{
    questionText: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }>;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDateOnly(dateInput: string): boolean {
  if (!DATE_ONLY_PATTERN.test(dateInput)) {
    return false;
  }

  const [year, month, day] = dateInput
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);

  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === (month ?? 1) - 1 &&
    date.getDate() === day
  );
}

function toUtcRange(dateOnly: string, endOfDay: boolean): Date {
  const timePart = endOfDay ? "23:59:59.999" : "00:00:00.000";
  return new Date(`${dateOnly}T${timePart}Z`);
}

function normalizePayload(body: unknown): QuizPayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Partial<QuizPayload>;
  if (
    typeof candidate.startDate !== "string" ||
    typeof candidate.endDate !== "string" ||
    !Array.isArray(candidate.questions) ||
    candidate.questions.length === 0
  ) {
    return null;
  }

  if (!isDateOnly(candidate.startDate) || !isDateOnly(candidate.endDate)) {
    return null;
  }

  const startAt = toUtcRange(candidate.startDate, false);
  const endAt = toUtcRange(candidate.endDate, true);
  if (startAt.getTime() > endAt.getTime()) {
    return null;
  }

  const normalizedQuestions = candidate.questions.map((question) => {
    if (!question || typeof question !== "object") {
      return null;
    }

    const q = question as QuizPayload["questions"][number];
    if (
      typeof q.questionText !== "string" ||
      typeof q.explanation !== "string" ||
      !Array.isArray(q.options) ||
      q.options.length < 2 ||
      q.options.length > 8 ||
      q.options.some((option) => typeof option !== "string") ||
      typeof q.correctAnswer !== "number" ||
      q.correctAnswer < 0 ||
      q.correctAnswer >= q.options.length
    ) {
      return null;
    }

    return {
      questionText: q.questionText.trim(),
      explanation: q.explanation.trim(),
      options: q.options.map((option) => option.trim()),
      correctAnswer: q.correctAnswer,
    };
  });

  if (
    normalizedQuestions.some((question) => question === null) ||
    normalizedQuestions.some(
      (question) =>
        !question ||
        !question.questionText ||
        !question.explanation ||
        question.options.some((option) => !option),
    )
  ) {
    return null;
  }

  return {
    startDate: candidate.startDate,
    endDate: candidate.endDate,
    questions: normalizedQuestions as QuizPayload["questions"],
  };
}

async function getAdminOrganizationContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const activeOrganizationId = session.session?.activeOrganizationId;
  if (!activeOrganizationId) {
    return {
      error: Response.json(
        { error: "No active organization" },
        { status: 403 },
      ),
    };
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

  if (!activeMembership || activeMembership.role !== "admin") {
    return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return {
    organizationId: activeOrganizationId,
  };
}

async function getQuizIdFromContext(context: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await context.params;
  const parsedQuizId = Number.parseInt(quizId, 10);

  if (Number.isNaN(parsedQuizId)) {
    return null;
  }

  return parsedQuizId;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ quizId: string }> },
) {
  try {
    const quizId = await getQuizIdFromContext(context);
    if (!quizId) {
      return Response.json({ error: "Invalid quiz id" }, { status: 400 });
    }

    const adminContext = await getAdminOrganizationContext();
    if ("error" in adminContext) {
      return adminContext.error;
    }

    const payload = normalizePayload(await request.json());
    if (!payload) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const [existingQuiz] = await db
      .select({ id: quizzes.id })
      .from(quizzes)
      .where(
        and(
          eq(quizzes.id, quizId),
          eq(quizzes.organizationId, adminContext.organizationId),
        ),
      )
      .limit(1);

    if (!existingQuiz) {
      return Response.json({ error: "Quiz not found" }, { status: 404 });
    }

    await db
      .update(quizzes)
      .set({
        startAt: toUtcRange(payload.startDate, false),
        endAt: toUtcRange(payload.endDate, true),
        updatedAt: new Date(),
      })
      .where(eq(quizzes.id, quizId));

    await db.delete(questions).where(eq(questions.quizId, quizId));

    await db.insert(questions).values(
      payload.questions.map((question, index) => ({
        quizId,
        questionText: question.questionText,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        orderIndex: index + 1,
      })),
    );

    return Response.json({ ok: true });
  } catch (error) {

    console.error("Error updating admin quiz:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ quizId: string }> },
) {
  try {
    const quizId = await getQuizIdFromContext(context);
    if (!quizId) {
      return Response.json({ error: "Invalid quiz id" }, { status: 400 });
    }

    const adminContext = await getAdminOrganizationContext();
    if ("error" in adminContext) {
      return adminContext.error;
    }

    const deletedRows = await db
      .delete(quizzes)
      .where(
        and(
          eq(quizzes.id, quizId),
          eq(quizzes.organizationId, adminContext.organizationId),
        ),
      )
      .returning({ id: quizzes.id });

    if (!deletedRows.length) {
      return Response.json({ error: "Quiz not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error deleting admin quiz:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
