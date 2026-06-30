import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { member, questions, quizzes } from "@/drizzle/schema";
import { verifyIncomingApiKey } from "@/lib/api-keys";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PUBLIC_API_ROLES = ["admin", "developer"] as const;

const createQuizSchema = z.object({
  organizationId: z.string().trim().min(1),
  startDate: z.string().regex(DATE_ONLY_PATTERN),
  endDate: z.string().regex(DATE_ONLY_PATTERN),
  questions: z
    .array(
      z
        .object({
          questionText: z.string().trim().min(1),
          options: z
            .array(z.string().trim().min(1))
            .min(2, "Each question must have at least 2 options")
            .max(8, "Each question must have at most 8 options"),
          correctAnswer: z.number().int().min(0),
          explanation: z.string().trim().min(1),
        })
        .refine(
          (question) => question.correctAnswer < question.options.length,
          {
            message: "correctAnswer must be a valid option index",
            path: ["correctAnswer"],
          },
        ),
    )
    .min(1),
});

function parseDateOnly(dateInput: string): Date | null {
  if (!DATE_ONLY_PATTERN.test(dateInput)) {
    return null;
  }

  const [year, month, day] = dateInput
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== (month ?? 1) - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function toUtcRange(dateOnly: string, endOfDay: boolean): Date {
  const timePart = endOfDay ? "23:59:59.999" : "00:00:00.000";
  return new Date(`${dateOnly}T${timePart}Z`);
}

async function getApiKeyUserIdFromRequest(request: Request): Promise<string | null> {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return null;
  }

  const verification = await verifyIncomingApiKey(apiKey);
  if (!verification.valid || !verification.referenceId) {
    return null;
  }

  return verification.referenceId;
}

export async function POST(request: Request) {
  try {
    const userId = await getApiKeyUserIdFromRequest(request);
    if (!userId) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }

    const jsonBody = await request.json();
    const payloadResult = createQuizSchema.safeParse(jsonBody);

    if (!payloadResult.success) {
      return Response.json(
        {
          error: "Invalid payload",
          details: payloadResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const payload = payloadResult.data;

    const startDate = parseDateOnly(payload.startDate);
    const endDate = parseDateOnly(payload.endDate);
    if (!startDate || !endDate || startDate.getTime() > endDate.getTime()) {
      return Response.json(
        { error: "startDate must be less than or equal to endDate" },
        { status: 400 },
      );
    }

    const [membership] = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.userId, userId),
          eq(member.organizationId, payload.organizationId),
        ),
      )
      .limit(1);

    if (!membership || !PUBLIC_API_ROLES.includes(membership.role as never)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const [createdQuiz] = await db
      .insert(quizzes)
      .values({
        startAt: toUtcRange(payload.startDate, false),
        endAt: toUtcRange(payload.endDate, true),
        organizationId: payload.organizationId,
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
    console.error("Error creating public API quiz:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}


