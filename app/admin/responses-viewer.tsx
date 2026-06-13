"use client";

import { useEffect, useState } from "react";

interface Attempt {
  attemptId: number;
  userId: string;
  userName: string;
  userEmail: string;
  quizId: number;
  score: number;
  totalQuestions: number;
  pointsEarned: number;
  medal: string;
  isRevision: number;
  completedAt: string;
  weekNumber: string;
  date: string;
  label: string;
  responses: Response[];
}

interface Response {
  id: number;
  attemptId: number;
  userId: string;
  userName: string;
  quizId: number;
  questionId: number;
  selectedAnswer: number;
  isCorrect: number;
  createdAt: string;
}

interface QuizQuestion {
  id: number;
  quizId: number;
  questionText: string;
  options: string[];
  correctAnswer: number;
  orderIndex: number;
}

interface WeekData {
  weekNumber: string;
  date: string;
  label: string;
  questions: QuizQuestion[];
  attempts: Attempt[];
  responsesCount: number;
}

interface AdminResponsesData {
  weeks: WeekData[];
}

export function AdminResponsesViewer() {
  const [data, setData] = useState<AdminResponsesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [expandedAttempts, setExpandedAttempts] = useState<
    Record<number, boolean>
  >({});
  const [exportingWeek, setExportingWeek] = useState<string | null>(null);

  const handleExportCsv = async (weekNumber: string, label: string) => {
    setExportingWeek(weekNumber);
    try {
      const response = await fetch(
        `/api/admin/responses/export?weekNumber=${encodeURIComponent(weekNumber)}`,
      );
      if (!response.ok) {
        alert("Erreur lors de l'export CSV.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quiz-${weekNumber}-${label}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Erreur lors de l'export CSV.");
    } finally {
      setExportingWeek(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/admin/responses");
        if (!response.ok) {
          setError(`Error: ${response.status}`);
          return;
        }
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <p className="text-[#4b6484]">Chargement des données...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[#e5533b] bg-[#fff1ef] p-4">
        <p className="text-[#e5533b] font-semibold">Erreur: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-[#e4dfda] bg-white p-4">
        <p className="text-[#4b6484]">Aucune donnée disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {data.weeks.map((week) => (
          <div
            key={week.weekNumber}
            className="rounded-xl border border-[#e4dfda] overflow-hidden"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedWeek(
                  expandedWeek === week.weekNumber ? null : week.weekNumber,
                )
              }
              className="w-full bg-white p-4 text-left hover:bg-[#f6f6f6] transition flex items-center justify-between cursor-pointer"
            >
              <div>
                <p className="font-semibold text-[#1d3d68]">
                  {week.weekNumber} - {week.label}
                </p>
                <p className="text-sm text-[#4b6484]">{week.date}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#1d3d68]">
                    {week.attempts.length} tentatives
                  </p>
                  <p className="text-xs text-[#4b6484]">
                    {week.responsesCount} réponses
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExportCsv(week.weekNumber, week.label);
                  }}
                  disabled={exportingWeek === week.weekNumber}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#1d3d68] bg-white px-3 py-1.5 text-xs font-semibold text-[#1d3d68] transition hover:bg-[#1d3d68] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  title="Exporter les tentatives en CSV"
                >
                  {exportingWeek === week.weekNumber ? (
                    "Export..."
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                      CSV
                    </>
                  )}
                </button>
              </div>
            </button>

            {expandedWeek === week.weekNumber && (
              <div className="border-t border-[#e4dfda] bg-[#f6f6f6] p-4 space-y-4">
                <div className="rounded-lg border border-[#e4dfda] bg-white/70 p-3">
                  <p className="text-xs font-semibold tracking-wide text-[#4b6484] uppercase">
                    Rappel du quiz
                  </p>

                  {week.questions.length === 0 ? (
                    <p className="mt-2 text-sm text-[#4b6484]">
                      Questions indisponibles.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {week.questions.map((question, index) => (
                        <div
                          key={question.id}
                          className="rounded-md border border-[#ece7e2] bg-[#faf9f7] p-3"
                        >
                          <p className="text-sm font-medium text-[#1d3d68]">
                            {index + 1}. {question.questionText}
                          </p>
                          <ul className="mt-2 grid gap-1 text-xs text-[#4b6484] sm:grid-cols-2">
                            {question.options.map((option, optionIndex) => (
                              <li
                                key={`${question.id}-${optionIndex}`}
                                className={`rounded px-2 py-1 ${
                                  optionIndex === question.correctAnswer
                                    ? "bg-[#e9f8f1] font-semibold text-[#1e9f63]"
                                    : ""
                                }`}
                              >
                                {optionIndex + 1}. {option}
                                {optionIndex === question.correctAnswer
                                  ? " ✓"
                                  : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold text-[#1d3d68] mb-2">
                    Tentatives
                  </h4>
                  <div className="space-y-2">
                    {week.attempts.length === 0 ? (
                      <p className="text-sm text-[#4b6484]">Aucune tentative</p>
                    ) : (
                      week.attempts.map((attempt) => (
                        <div
                          key={attempt.attemptId}
                          className="bg-white rounded-lg p-3 text-sm border border-[#e4dfda]"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedAttempts((prev) => ({
                                ...prev,
                                [attempt.attemptId]: !prev[attempt.attemptId],
                              }))
                            }
                            className="flex w-full cursor-pointer items-start justify-between gap-4 text-left"
                          >
                            <div>
                              <p className="font-semibold text-[#1d3d68]">
                                Utilisateur : {attempt.userName}{" "}
                                <span className="italic text-gray-500 text-xs font-normal">
                                  ({attempt.userEmail})
                                </span>
                              </p>
                              <p className="text-[#4b6484]">
                                Score: {attempt.score}/{attempt.totalQuestions}
                              </p>
                              <p className="text-[#4b6484]">
                                Points: {attempt.pointsEarned}
                              </p>
                              <p className="text-xs text-[#4b6484]">
                                Medaille: {attempt.medal}
                              </p>
                              <p className="text-xs text-[#4b6484]">
                                {attempt.responses.length} réponse
                                {attempt.responses.length > 1 ? "s" : ""}
                              </p>
                              <p className="text-xs text-[#4b6484]">
                                Mode:{" "}
                                {attempt.isRevision
                                  ? "Révision"
                                  : "Tentative réelle"}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-xs text-[#4b6484]">
                                {new Date(attempt.completedAt).toLocaleString(
                                  "fr-FR",
                                )}
                              </p>
                              <p className="mt-2 text-xs font-semibold text-[#1d3d68]">
                                {expandedAttempts[attempt.attemptId]
                                  ? "Masquer les réponses"
                                  : "Voir les réponses"}
                              </p>
                            </div>
                          </button>

                          {expandedAttempts[attempt.attemptId] ? (
                            <div className="mt-3 space-y-2 border-t border-[#e4dfda] pt-3">
                              <p className="text-xs font-semibold tracking-wide text-[#4b6484] uppercase">
                                Réponses de cette tentative
                              </p>

                              {attempt.responses.length === 0 ? (
                                <p className="text-sm text-[#4b6484]">
                                  Aucune réponse associée
                                </p>
                              ) : (
                                attempt.responses.map((response) => (
                                  <div
                                    key={response.id}
                                    className={`rounded-lg p-3 text-sm border-l-4 ${
                                      response.isCorrect
                                        ? "border-l-[#1e9f63] bg-[#e9f8f1]"
                                        : "border-l-[#e5533b] bg-[#fff1ef]"
                                    }`}
                                  >
                                    <div className="flex justify-between items-start gap-4">
                                      <div>
                                        <p className="font-semibold text-[#1d3d68]">
                                          Q{response.questionId} -{" "}
                                          {response.userName}
                                        </p>
                                        <p className="text-[#4b6484]">
                                          Réponse: Option{" "}
                                          {response.selectedAnswer + 1}
                                        </p>
                                        <p className="text-xs font-semibold">
                                          {response.isCorrect
                                            ? "✓ Correcte"
                                            : "✗ Incorrecte"}
                                        </p>
                                      </div>
                                      <p className="text-xs text-[#4b6484]">
                                        {new Date(
                                          response.createdAt,
                                        ).toLocaleString("fr-FR")}
                                      </p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
