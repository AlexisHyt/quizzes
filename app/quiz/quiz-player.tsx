"use client";

import { useMemo, useState } from "react";
import type { Question } from "@/drizzle/schema";

type QuizPlayerProps = {
  quizId: number;
  questions: Question[];
  isRevision?: boolean;
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

      setSubmitted(true);
    } catch {
      setError("Une erreur réseau est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-6">
      {questions.map((question, index) => (
        <fieldset
          key={question.id}
          className="rounded-xl border border-[#e4dfda] bg-white p-5"
          disabled={submitted}
        >
          <legend className="mb-3 text-base font-semibold text-[#1d3d68]">
            {index + 1}. {question.questionText}
          </legend>

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
        </fieldset>
      ))}

      <button
        type="submit"
        disabled={submitted || !allAnswered || submitting}
        className="inline-flex h-12 items-center justify-center rounded-xl bg-[#ea553a] px-7 text-base font-semibold text-white transition hover:bg-[#d84b31] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Envoi en cours…" : "Valider mes reponses"}
      </button>

      {error ? (
        <p className="rounded-xl border border-[#e5533b] bg-[#fff1ef] p-4 text-sm text-[#e5533b]">
          {error}
        </p>
      ) : null}

      {submitted ? (
        <p className="rounded-xl border border-[#e4dfda] bg-white p-4 text-base font-semibold text-[#1d3d68]">
          Score: {score} / {questions.length}
        </p>
      ) : null}
    </form>
  );
}
