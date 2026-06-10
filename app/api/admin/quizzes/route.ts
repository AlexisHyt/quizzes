import { and, asc, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/drizzle/db";
import { member, questions, quizzes } from "@/drizzle/schema";

type QuizPayload = {
  weekNumber: string;
  date: string;
  label: string;
  questions: Array<{
    questionText: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }>;
};

const WEEK_NUMBER_PATTERN = /^S\d{2}$/;

function isMondayDate(dateInput: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
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
    date.getDate() === day &&
    date.getDay() === 1
  );
}

function normalizePayload(body: unknown): QuizPayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Partial<QuizPayload>;
  if (
    typeof candidate.weekNumber !== "string" ||
    typeof candidate.date !== "string" ||
    typeof candidate.label !== "string" ||
    !Array.isArray(candidate.questions) ||
    candidate.questions.length === 0
  ) {
    return null;
  }

  if (
    !WEEK_NUMBER_PATTERN.test(candidate.weekNumber.trim()) ||
    !isMondayDate(candidate.date)
  ) {
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
      q.options.length !== 4 ||
      q.options.some((option) => typeof option !== "string") ||
      typeof q.correctAnswer !== "number" ||
      q.correctAnswer < 0 ||
      q.correctAnswer > 3
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
    weekNumber: candidate.weekNumber.trim(),
    date: candidate.date,
    label: candidate.label.trim(),
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

  if (
    !activeMembership ||
    !["owner", "admin"].includes(activeMembership.role)
  ) {
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
        weekNumber: quizzes.weekNumber,
        date: quizzes.date,
        label: quizzes.label,
      })
      .from(quizzes)
      .where(eq(quizzes.organizationId, adminContext.organizationId))
      .orderBy(desc(quizzes.date));

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
        ...quiz,
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
        weekNumber: payload.weekNumber,
        date: payload.date,
        label: payload.label,
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
    if (
      error instanceof Error &&
      /quizzes_organization_week_unique/.test(error.message)
    ) {
      return Response.json(
        {
          error:
            "Un quiz existe déjà pour cette semaine dans cette organisation.",
        },
        { status: 409 },
      );
    }

    console.error("Error creating admin quiz:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
