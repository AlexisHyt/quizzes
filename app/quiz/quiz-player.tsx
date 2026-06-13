"use client";

import { useMemo, useState } from "react";
import { getMedalEmoji } from "@/app/quiz/recent-attempts-history";
import type { Question } from "@/drizzle/schema";
import type { Medal } from "@/lib/gamification";

type QuizPlayerProps = {
  quizId: number;
  questions: Question[];
  isRevision?: boolean;
};

type SubmissionResult = {
  score: number;
  total: number;
  pointsEarned: number;
  medal: Medal;
  profile: {
    totalPoints: number;
    bestScore: number;
    bestTotalQuestions: number;
    realAttemptsCount: number;
    revisionAttemptsCount: number;
  } | null;
};

export function QuizPlayer({
  quizId,
  questions,
  isRevision = false,
}: QuizPlayerProps) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] =
    useState<SubmissionResult | null>(null);

  const score = useMemo(() => {
    if (!submitted) {
      return 0;
    }

    return questions.reduce((total, question) => {
      return total + (answers[question.id] === question.correctAnswer ? 1 : 0);
    }, 0);
  }, [answers, questions, submitted]);

  const allAnswered = questions.every(
    (question) => answers[question.id] !== undefined,
  );
  const answeredCount = questions.filter(
    (question) => answers[question.id] !== undefined,
  ).length;
  const progressWidth =
    questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!allAnswered || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, answers, isRevision }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Une erreur est survenue.");
        return;
      }

      const data = (await res.json()) as SubmissionResult;
      setSubmissionResult(data);
      setSubmitted(true);
    } catch {
      setError("Une erreur réseau est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-6">
      <div className="rounded-xl border border-[#e4dfda] bg-white p-4">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#4b6484]">
          <span>Progression</span>
          <span>
            {answeredCount}/{questions.length} reponses
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#ece7e2]">
          <div
            className="h-full rounded-full bg-[#1d3d68] transition-all duration-500"
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>

      {questions.map((question, index) => (
        <div
          key={question.id}
          className="rounded-xl border border-[#e4dfda] bg-white p-5"
        >
          <p className="mb-3 text-base font-semibold text-[#1d3d68]">
            {index + 1}. {question.questionText}
          </p>

          <div className="space-y-2">
            {question.options.map((option, optionIndex) => {
              const isSelected = answers[question.id] === optionIndex;
              const isCorrect = question.correctAnswer === optionIndex;
              const showRightColor = submitted && isCorrect;
              const showWrongColor = submitted && isSelected && !isCorrect;

              return (
                <label
                  key={`${question.id}-${optionIndex}`}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
                    showRightColor
                      ? "border-[#1e9f63] bg-[#e9f8f1]"
                      : showWrongColor
                        ? "border-[#e5533b] bg-[#fff1ef]"
                        : "border-[#e4dfda]"
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={optionIndex}
                    checked={isSelected}
                    onChange={() => {
                      setAnswers((prev) => ({
                        ...prev,
                        [question.id]: optionIndex,
                      }));
                    }}
                    className="mt-1"
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>

          {submitted ? (
            <p className="mt-3 text-sm text-[#4b6484]">
              {question.explanation}
            </p>
          ) : null}
        </div>
      ))}

      <button
        type="submit"
        disabled={submitted || !allAnswered || submitting}
        className="inline-flex h-12 items-center justify-center rounded-xl bg-[#ea553a] px-7 text-base font-semibold text-white transition hover:bg-[#d84b31] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
      >
        {submitting ? "Envoi en cours…" : "Valider mes reponses"}
      </button>

      {error ? (
        <p className="rounded-xl border border-[#e5533b] bg-[#fff1ef] p-4 text-sm text-[#e5533b]">
          {error}
        </p>
      ) : null}

      {submitted ? (
        <div className="animate-in fade-in-0 zoom-in-95 rounded-xl border border-[#e4dfda] bg-white p-4 text-[#1d3d68] duration-300">
          <p className="text-base font-semibold">
            Score: {submissionResult?.score ?? score} /{" "}
            {submissionResult?.total ?? questions.length}
          </p>
          <p className="mt-1 text-sm text-[#4b6484]">
            Points gagnes: {submissionResult?.pointsEarned ?? 0}
          </p>
          <p className="mt-1 text-sm text-[#4b6484]">
            Medaille: {getMedalEmoji(submissionResult?.medal ?? "none")}
          </p>

          {submissionResult?.profile ? (
            <div className="mt-3 grid gap-2 text-sm text-[#1d3d68] sm:grid-cols-2">
              <p className="rounded-lg bg-[#f6f6f6] px-3 py-2">
                Points totaux: {submissionResult.profile.totalPoints}
              </p>
              <p className="rounded-lg bg-[#f6f6f6] px-3 py-2">
                Meilleure perf: {submissionResult.profile.bestScore}/
                {submissionResult.profile.bestTotalQuestions}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
