import { asc, desc, eq, lt, lte } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { QuizPlayer } from "@/app/quiz/quiz-player";
import { SignOutButton } from "@/app/quiz/sign-out-button";
import { auth } from "@/auth";
import { db } from "@/drizzle/db";
import { questions, quizzes } from "@/drizzle/schema";

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentWeekMonday(): string {
  const now = new Date();
  const monday = new Date(now);
  const dayOffset = (now.getDay() + 6) % 7;
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - dayOffset);
  return formatDateKey(monday);
}

async function getCurrentQuizWithQuestions() {
  const currentWeekMonday = getCurrentWeekMonday();
  const today = formatDateKey(new Date());

  let [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.date, currentWeekMonday))
    .limit(1);

  if (!quiz) {
    [quiz] = await db
      .select()
      .from(quizzes)
      .where(lte(quizzes.date, today))
      .orderBy(desc(quizzes.date))
      .limit(1);
  }

  if (!quiz) {
    [quiz] = await db
      .select()
      .from(quizzes)
      .orderBy(asc(quizzes.date))
      .limit(1);
  }

  if (!quiz) {
    return null;
  }

  const quizQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quiz.id))
    .orderBy(asc(questions.orderIndex));

  return {
    quiz,
    questions: quizQuestions,
  };
}

async function getPastQuizzes(excludeId: number | null) {
  const currentWeekMonday = getCurrentWeekMonday();

  const allPast = await db
    .select({
      id: quizzes.id,
      weekNumber: quizzes.weekNumber,
      label: quizzes.label,
      date: quizzes.date,
    })
    .from(quizzes)
    .where(lt(quizzes.date, currentWeekMonday))
    .orderBy(desc(quizzes.date));

  return allPast.filter((q) => q.id !== excludeId);
}

export default async function QuizPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  const quizData = await getCurrentQuizWithQuestions();
  const pastQuizzes = await getPastQuizzes(quizData?.quiz.id ?? null);

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#e7e0d8] px-6 py-16 text-[#1f3e68]">
      <main className="w-full max-w-3xl rounded-2xl border border-[#e4dfda] bg-[#f6f6f6] p-8 shadow-[0_16px_40px_rgba(22,26,29,0.12)] sm:p-10">
        <p className="text-xs font-semibold tracking-[0.22em] text-[#e5533b] uppercase">
          Espace connecte
        </p>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#1d3d68]">
          Bonjour {session.user.name}
        </h1>

        <p className="mt-4 text-lg leading-8 text-[#4b6484]">
          Tu es bien connecte avec Google ({session.user.email}).
        </p>

        {!quizData || quizData.questions.length === 0 ? (
          <p className="mt-8 rounded-xl border border-[#e4dfda] bg-white p-4 text-sm text-[#4b6484]">
            Aucun quiz disponible pour le moment.
          </p>
        ) : (
          <section className="mt-8">
            <p className="text-sm font-semibold text-[#e5533b]">
              {quizData.quiz.weekNumber} - {quizData.quiz.label}
            </p>
            <QuizPlayer
              quizId={quizData.quiz.id}
              questions={quizData.questions}
            />
          </section>
        )}

        <div className="mt-8 flex items-center gap-3">
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

        {pastQuizzes.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-[#1d3d68]">
              Anciens quiz
            </h2>
            <p className="mt-1 text-sm text-[#4b6484]">
              Rejoue un quiz passé en mode révision.
            </p>
            <ul className="mt-4 space-y-2">
              {pastQuizzes.map((q) => (
                <li key={q.id}>
                  <a
                    href={`/quiz/${q.id}`}
                    className="flex items-center justify-between rounded-xl border border-[#e4dfda] bg-white px-5 py-3 text-sm font-medium text-[#1d3d68] transition hover:bg-[#e7e0d8]"
                  >
                    <span>
                      <span className="font-semibold text-[#e5533b]">
                        {q.weekNumber}
                      </span>
                      {" — "}
                      {q.label}
                    </span>
                    <span className="text-xs text-[#4b6484]">Rejouer →</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
