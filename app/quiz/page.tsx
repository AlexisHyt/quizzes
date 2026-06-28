import { and, asc, desc, eq, gte, lt, lte } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { QuizPlayer } from "@/app/quiz/quiz-player";
import { RecentAttemptsHistory } from "@/app/quiz/recent-attempts-history";
import { auth } from "@/auth";
import { db } from "@/drizzle/db";
import {
  questions,
  quizAttempts,
  quizzes,
  userQuizStats,
} from "@/drizzle/schema";
import {
  getActiveOrganizationForSession,
  getUserOrganizations,
  type OrganizationSession,
} from "@/lib/organizations";

function formatUtcDate(dateInput: Date): string {
  return dateInput.toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatQuizRange(quiz: { startAt: Date; endAt: Date }): string {
  return `${formatUtcDate(quiz.startAt)} - ${formatUtcDate(quiz.endAt)}`;
}

async function getActiveQuizzes(activeOrganizationId: string) {
  const nowUtc = new Date();

  return db
    .select({
      id: quizzes.id,
      startAt: quizzes.startAt,
      endAt: quizzes.endAt,
    })
    .from(quizzes)
    .where(
      and(
        lte(quizzes.startAt, nowUtc),
        gte(quizzes.endAt, nowUtc),
        eq(quizzes.organizationId, activeOrganizationId),
      ),
    )
    .orderBy(asc(quizzes.endAt));
}

async function getSelectedQuizWithQuestions(
  activeOrganizationId: string,
  selectedQuizId: number,
) {
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(
      and(
        eq(quizzes.id, selectedQuizId),
        eq(quizzes.organizationId, activeOrganizationId),
      ),
    )
    .limit(1);

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

async function getPastQuizzes(
  activeOrganizationId: string,
  excludeIds: number[],
) {
  const nowUtc = new Date();

  const allPast = await db
    .select({
      id: quizzes.id,
      startAt: quizzes.startAt,
      endAt: quizzes.endAt,
    })
    .from(quizzes)
    .where(
      and(
        lt(quizzes.endAt, nowUtc),
        eq(quizzes.organizationId, activeOrganizationId),
      ),
    )
    .orderBy(desc(quizzes.endAt));

  return allPast.filter((q) => !excludeIds.includes(q.id));
}

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{
    quizId?: string | string[];
    pastQuizId?: string | string[];
  }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
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

  const organizations = await getUserOrganizations(session.user.id);
  const activeOrganization =
    await getActiveOrganizationForSession(organizationSession);

  if (!organizations.length) {
    redirect("/organizations");
  }

  if (!activeOrganization) {
    redirect("/organizations");
  }

  const activeQuizzes = await getActiveQuizzes(activeOrganization.id);
  const parsedSearchParams = await searchParams;
  const rawQuizId = parsedSearchParams.quizId;
  const rawPastQuizId = parsedSearchParams.pastQuizId;
  const selectedQuizId = Number.parseInt(
    Array.isArray(rawQuizId) ? (rawQuizId[0] ?? "") : (rawQuizId ?? ""),
    10,
  );
  const pastQuizId = Number.parseInt(
    Array.isArray(rawPastQuizId)
      ? (rawPastQuizId[0] ?? "")
      : (rawPastQuizId ?? ""),
    10,
  );

  const completedAttempts = await db
    .select({ quizId: quizAttempts.quizId })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
    .where(
      and(
        eq(quizAttempts.userId, session.user.id),
        eq(quizAttempts.isRevision, 0),
        eq(quizzes.organizationId, activeOrganization.id),
      ),
    );

  const completedQuizIds = new Set(
    completedAttempts.map((attempt) => attempt.quizId),
  );
  const pastQuizzes = await getPastQuizzes(
    activeOrganization.id,
    activeQuizzes.map((quiz) => quiz.id),
  );
  const revisableQuizzes = [
    ...activeQuizzes.filter((quiz) => completedQuizIds.has(quiz.id)),
    ...pastQuizzes,
  ];
  const playableActiveQuizzes = activeQuizzes.filter(
    (quiz) => !completedQuizIds.has(quiz.id),
  );

  if (
    !Number.isNaN(pastQuizId) &&
    revisableQuizzes.some((quiz) => quiz.id === pastQuizId)
  ) {
    redirect(`/quiz/${pastQuizId}`);
  }

  const hasRequestedActiveQuiz =
    !Number.isNaN(selectedQuizId) &&
    activeQuizzes.some((quiz) => quiz.id === selectedQuizId);

  if (hasRequestedActiveQuiz && completedQuizIds.has(selectedQuizId)) {
    redirect(`/quiz/${selectedQuizId}`);
  }

  const availableActiveQuiz = playableActiveQuizzes[0] ?? null;
  const resolvedSelectedQuizId = hasRequestedActiveQuiz
    ? selectedQuizId
    : (availableActiveQuiz?.id ?? null);

  const quizData = resolvedSelectedQuizId
    ? await getSelectedQuizWithQuestions(
        activeOrganization.id,
        resolvedSelectedQuizId,
      )
    : null;
  const [personalStats] = await db
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

  return (
    <div className="grid grid-cols-[2fr_1fr]">
      <div className="flex min-h-screen items-start justify-center bg-[#e7e0d8] px-6 py-10 text-[#1f3e68]">
        <main className="w-full max-w-3xl rounded-2xl border border-[#e4dfda] bg-[#f6f6f6] p-8 shadow-[0_16px_40px_rgba(22,26,29,0.12)] sm:p-10">
          <p className="text-xs font-semibold tracking-[0.22em] text-[#e5533b] uppercase">
            Espace connecte
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#1d3d68]">
            Quiz actifs
          </h1>

          <p className="mt-4 text-lg leading-8 text-[#4b6484]">
            Choisis un quiz en cours ou relance une revision sur un quiz passe.
          </p>

          {activeQuizzes.length === 0 ? (
            <p className="mt-8 rounded-xl border border-[#e4dfda] bg-white p-4 text-sm text-[#4b6484]">
              Aucun quiz disponible pour le moment.
            </p>
          ) : (
            <>
              <section className="mt-8 rounded-xl border border-[#e4dfda] bg-white p-4">
                <h2 className="text-base font-semibold text-[#1d3d68]">
                  Quizzes en cours
                </h2>
                <p className="mt-1 text-sm text-[#4b6484]">
                  Choisis un quiz actif.
                </p>

                {playableActiveQuizzes.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {playableActiveQuizzes.map((quiz) => {
                      const isSelected = quiz.id === quizData?.quiz.id;
                      return (
                        <li key={quiz.id}>
                          <a
                            href={`/quiz?quizId=${quiz.id}`}
                            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                              isSelected
                                ? "border-[#1d3d68] bg-[#f1f5fb] text-[#1d3d68]"
                                : "border-[#e4dfda] bg-white text-[#1d3d68] hover:bg-[#e7e0d8]"
                            }`}
                          >
                            <span>{formatQuizRange(quiz)}</span>
                            <span className="text-xs text-[#4b6484]">
                              {isSelected ? "Selectionne" : "Jouer"}
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-lg border border-[#e4dfda] bg-[#f8f8f8] px-3 py-2 text-sm text-[#4b6484]">
                    Tu as deja complete tous les quizzes en cours.
                  </p>
                )}

                <form
                  method="get"
                  className="mt-4 rounded-xl border border-[#e4dfda] bg-[#f8f8f8] p-3"
                >
                  <label
                    htmlFor="pastQuizId"
                    className="text-xs font-semibold tracking-wide text-[#4b6484] uppercase"
                  >
                    Quiz passes de l'organisation (revision)
                  </label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <select
                      id="pastQuizId"
                      name="pastQuizId"
                      defaultValue=""
                      className="w-full rounded-xl border border-[#d9d4cf] bg-white px-4 py-2 text-sm text-[#1d3d68] outline-none focus:border-[#1d3d68]"
                      disabled={revisableQuizzes.length === 0}
                    >
                      <option value="" disabled>
                        {revisableQuizzes.length > 0
                          ? "Selectionne un quiz passe"
                          : "Aucun quiz passe"}
                      </option>
                      {revisableQuizzes.map((quiz) => (
                        <option key={quiz.id} value={quiz.id}>
                          {`Quiz #${quiz.id} — ${formatQuizRange(quiz)}`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-[#1d3d68] px-4 text-sm font-semibold text-white transition hover:bg-[#1a2d52] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={revisableQuizzes.length === 0}
                    >
                      Ouvrir
                    </button>
                  </div>
                </form>
              </section>

              {quizData && quizData.questions.length > 0 ? (
                <section className="mt-8">
                  <p className="text-sm font-semibold text-[#e5533b]">
                    {formatQuizRange(quizData.quiz)}
                  </p>
                  <QuizPlayer
                    quizId={quizData.quiz.id}
                    questions={quizData.questions}
                  />
                </section>
              ) : (
                <p className="mt-8 rounded-xl border border-[#e4dfda] bg-white p-4 text-sm text-[#4b6484]">
                  Aucune question disponible pour ce quiz.
                </p>
              )}
            </>
          )}
        </main>
      </div>

      <div className="flex items-start justify-center bg-[#e7e0d8] px-6 py-16 text-[#1f3e68]">
        <section className="mt-6 space-y-5">
          <div className="rounded-xl border border-[#e4dfda] bg-white p-5">
            <h2 className="text-lg font-semibold text-[#1d3d68]">Ton profil</h2>
            {personalStats ? (
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-[#e4dfda] bg-[#f6f6f6] p-3">
                  <p className="text-xs font-semibold text-[#4b6484]">
                    POINTS TOTAUX
                  </p>
                  <p className="mt-1 text-xl font-bold text-[#1d3d68]">
                    {personalStats.totalPoints}
                  </p>
                </div>
                <div className="rounded-lg border border-[#e4dfda] bg-[#f6f6f6] p-3">
                  <p className="text-xs font-semibold text-[#4b6484]">
                    MEILLEURE PERFORMANCE
                  </p>
                  <p className="mt-1 text-lg font-bold text-[#1d3d68]">
                    {personalStats.bestScore}/{personalStats.bestTotalQuestions}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#4b6484]">
                Aucune statistique pour le moment. Lance ton premier quiz.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[#e4dfda] bg-white p-5">
            <h2 className="text-lg font-semibold text-[#1d3d68]">
              10 dernières réponses
            </h2>
            <RecentAttemptsHistory />
          </div>
        </section>
      </div>
    </div>
  );
}
