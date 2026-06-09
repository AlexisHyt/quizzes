import { asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { QuizPlayer } from "@/app/quiz/quiz-player";
import { SignOutButton } from "@/app/quiz/sign-out-button";
import { auth } from "@/auth";
import { db } from "@/drizzle/db";
import { questions, quizzes } from "@/drizzle/schema";

export default async function OldQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  const { id } = await params;
  const quizId = Number(id);

  if (Number.isNaN(quizId)) {
    notFound();
  }

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);

  if (!quiz) {
    notFound();
  }

  const quizQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quiz.id))
    .orderBy(asc(questions.orderIndex));

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#e7e0d8] px-6 py-16 text-[#1f3e68]">
      <main className="w-full max-w-3xl rounded-2xl border border-[#e4dfda] bg-[#f6f6f6] p-8 shadow-[0_16px_40px_rgba(22,26,29,0.12)] sm:p-10">
        <p className="text-xs font-semibold tracking-[0.22em] text-[#e5533b] uppercase">
          Revision
        </p>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#1d3d68]">
          Rejouer un ancien quiz
        </h1>

        <p className="mt-2 text-sm font-semibold text-[#e5533b]">
          {quiz.weekNumber} — {quiz.label}
        </p>

        <p className="mt-3 text-sm text-[#4b6484]">
          Ce quiz est en mode révision. Tes réponses seront enregistrées comme
          une révision.
        </p>

        {quizQuestions.length === 0 ? (
          <p className="mt-8 rounded-xl border border-[#e4dfda] bg-white p-4 text-sm text-[#4b6484]">
            Aucune question disponible pour ce quiz.
          </p>
        ) : (
          <section className="mt-8">
            <QuizPlayer
              quizId={quiz.id}
              questions={quizQuestions}
              isRevision={true}
            />
          </section>
        )}

        <div className="mt-8 flex items-center gap-3">
          <a
            href="/quiz"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-[#e4dfda] bg-white px-7 text-base font-semibold text-[#1d3d68] transition hover:bg-[#e7e0d8]"
          >
            ← Retour aux quiz
          </a>
          {session.user.role === "admin" && (
            <a
              href="/admin"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[#1d3d68] px-7 text-base font-semibold text-white transition hover:bg-[#1a2d52]"
            >
              Tableau de bord admin
            </a>
          )}
          <SignOutButton />
        </div>
      </main>
    </div>
  );
}
