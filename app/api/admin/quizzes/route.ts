import { and, asc, desc, eq } from "drizzle-orm";
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

export async function GET() {
  try {
    const adminContext = await getAdminOrganizationContext();
    if ("error" in adminContext) {
      return adminContext.error;
    }

    const existingQuizzes = await db
      .select({
        id: quizzes.id,
        startAt: quizzes.startAt,
        endAt: quizzes.endAt,
      })
      .from(quizzes)
      .where(eq(quizzes.organizationId, adminContext.organizationId))
      .orderBy(desc(quizzes.endAt), desc(quizzes.startAt));

    const existingQuestions = await db
      .select({
        id: questions.id,
        quizId: questions.quizId,
        questionText: questions.questionText,
        options: questions.options,
        correctAnswer: questions.correctAnswer,
        explanation: questions.explanation,
        orderIndex: questions.orderIndex,
      })
      .from(questions)
      .innerJoin(quizzes, eq(questions.quizId, quizzes.id))
      .where(eq(quizzes.organizationId, adminContext.organizationId))
      .orderBy(asc(questions.orderIndex));

    const questionsByQuiz = new Map<number, typeof existingQuestions>();
    for (const question of existingQuestions) {
      const bucket = questionsByQuiz.get(question.quizId) ?? [];
      bucket.push(question);
      questionsByQuiz.set(question.quizId, bucket);
    }

    return Response.json({
      quizzes: existingQuizzes.map((quiz) => ({
        id: quiz.id,
        startAt: quiz.startAt.toISOString(),
        endAt: quiz.endAt.toISOString(),
        questions: (questionsByQuiz.get(quiz.id) ?? []).map((question) => ({
          id: question.id,
          questionText: question.questionText,
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          orderIndex: question.orderIndex,
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching admin quizzes:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminContext = await getAdminOrganizationContext();
    if ("error" in adminContext) {
      return adminContext.error;
    }

    const body = await request.json();
    const payload = normalizePayload(body);
    if (!payload) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const [createdQuiz] = await db
      .insert(quizzes)
      .values({
        startAt: toUtcRange(payload.startDate, false),
        endAt: toUtcRange(payload.endDate, true),
        organizationId: adminContext.organizationId,
      })
      .returning({ id: quizzes.id });

    if (!createdQuiz) {
      return Response.json({ error: "Unable to create quiz" }, { status: 500 });
    }

    await db.insert(questions).values(
      payload.questions.map((question, index) => ({
        quizId: createdQuiz.id,
        questionText: question.questionText,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        orderIndex: index + 1,
      })),
    );

    return Response.json({ ok: true, quizId: createdQuiz.id }, { status: 201 });
  } catch (error) {

    console.error("Error creating admin quiz:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
