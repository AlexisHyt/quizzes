"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ManagedQuestion = {
  id?: number;
  questionText: string;
  options: [string, string, string, string];
  correctAnswer: number;
  explanation: string;
};

type ManagedQuiz = {
  id: number;
  startAt: string;
  endAt: string;
  questions: ManagedQuestion[];
};

type QuizzesResponse = {
  quizzes: ManagedQuiz[];
};

type DurationPreset = "custom" | "week" | "month";

function createEmptyQuestion(): ManagedQuestion {
  return {
    questionText: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
    explanation: "",
  };
}

function createEmptyForm() {
  return {
    startDate: "",
    endDate: "",
    durationPreset: "week" as DurationPreset,
    questions: [createEmptyQuestion()],
  };
}

function shiftUtcDays(dateInput: string, days: number): string {
  const base = new Date(`${dateInput}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function getPresetEndDate(
  startDate: string,
  durationPreset: DurationPreset,
): string {
  if (!startDate) {
    return "";
  }

  if (durationPreset === "week") {
    return shiftUtcDays(startDate, 6);
  }

  if (durationPreset === "month") {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(end.getUTCDate() - 1);
    return end.toISOString().slice(0, 10);
  }

  return "";
}

function formatDateUtc(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function toDateInputValue(isoDate: string): string {
  return new Date(isoDate).toISOString().slice(0, 10);
}

function formatQuizLabel(quiz: Pick<ManagedQuiz, "startAt">): string {
  return formatDateUtc(quiz.startAt);
}

function formatQuizRange(quiz: Pick<ManagedQuiz, "startAt" | "endAt">): string {
  return `${formatDateUtc(quiz.startAt)} - ${formatDateUtc(quiz.endAt)}`;
}

export function AdminQuizzesManager() {
  const [quizzes, setQuizzes] = useState<ManagedQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingQuizId, setEditingQuizId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingQuizId, setDeletingQuizId] = useState<number | null>(null);
  const [form, setForm] = useState(createEmptyForm);

  const isEditing = editingQuizId !== null;

  const sortedQuizzes = useMemo(
    () =>
      [...quizzes].sort(
        (a, b) =>
          new Date(a.endAt).getTime() - new Date(b.endAt).getTime() ||
          new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
      ),
    [quizzes],
  );

  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/quizzes");
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Impossible de charger les quizzes.");
      }

      const data = (await response.json()) as QuizzesResponse;
      setQuizzes(data.quizzes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  function resetForm() {
    setEditingQuizId(null);
    setForm(createEmptyForm());
  }

  function startEdit(quiz: ManagedQuiz) {
    setEditingQuizId(quiz.id);
    setForm({
      startDate: toDateInputValue(quiz.startAt),
      endDate: toDateInputValue(quiz.endAt),
      durationPreset: "custom",
      questions: quiz.questions.map((question) => ({
        id: question.id,
        questionText: question.questionText,
        options: [...question.options] as [string, string, string, string],
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      })),
    });
  }

  function startDuplicate(quiz: ManagedQuiz) {
    const sourceStart = new Date(quiz.startAt);
    const sourceEnd = new Date(quiz.endAt);
    const duration = sourceEnd.getTime() - sourceStart.getTime();

    const duplicatedStart = new Date(sourceStart);
    duplicatedStart.setUTCDate(duplicatedStart.getUTCDate() + 7);

    const duplicatedEnd = new Date(duplicatedStart.getTime() + duration);

    setEditingQuizId(null);
    setError(null);
    setForm({
      startDate: duplicatedStart.toISOString().slice(0, 10),
      endDate: duplicatedEnd.toISOString().slice(0, 10),
      durationPreset: "custom",
      questions: quiz.questions.map((question) => ({
        questionText: question.questionText,
        options: [...question.options] as [string, string, string, string],
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      })),
    });
  }

  function updateQuestion(index: number, patch: Partial<ManagedQuestion>) {
    setForm((prev) => {
      const questions = [...prev.questions];
      questions[index] = { ...questions[index], ...patch };
      return { ...prev, questions };
    });
  }

  function updateOption(
    questionIndex: number,
    optionIndex: number,
    value: string,
  ) {
    setForm((prev) => {
      const questions = [...prev.questions];
      const nextOptions = [...questions[questionIndex].options] as [
        string,
        string,
        string,
        string,
      ];
      nextOptions[optionIndex] = value;
      questions[questionIndex] = {
        ...questions[questionIndex],
        options: nextOptions,
      };
      return { ...prev, questions };
    });
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    setForm((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.questions.length) {
        return prev;
      }

      const questions = [...prev.questions];
      const [moved] = questions.splice(index, 1);
      questions.splice(nextIndex, 0, moved);
      return { ...prev, questions };
    });
  }

  function addQuestion() {
    setForm((prev) => ({
      ...prev,
      questions: [...prev.questions, createEmptyQuestion()],
    }));
  }

  function removeQuestion(index: number) {
    setForm((prev) => {
      if (prev.questions.length <= 1) {
        return prev;
      }

      const questions = prev.questions.filter(
        (_, questionIndex) => questionIndex !== index,
      );
      return { ...prev, questions };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);

    if (!form.startDate || !form.endDate) {
      setSaving(false);
      setError("Les dates de debut et de fin sont obligatoires.");
      return;
    }

    const startAt = new Date(`${form.startDate}T00:00:00.000Z`);
    const endAt = new Date(`${form.endDate}T23:59:59.999Z`);
    if (startAt.getTime() > endAt.getTime()) {
      setSaving(false);
      setError("La date de fin doit etre egale ou posterieure a la date de debut.");
      return;
    }

    const payload = {
      startDate: form.startDate,
      endDate: form.endDate,
      questions: form.questions.map((question) => ({
        questionText: question.questionText.trim(),
        options: question.options.map((option) => option.trim()),
        correctAnswer: question.correctAnswer,
        explanation: question.explanation.trim(),
      })),
    };

    try {
      const url = isEditing
        ? `/api/admin/quizzes/${editingQuizId}`
        : "/api/admin/quizzes";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Impossible d'enregistrer ce quiz.");
      }

      await loadQuizzes();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuiz(quizId: number) {
    if (
      !window.confirm("Supprimer ce quiz et toutes ses réponses utilisateur ?")
    ) {
      return;
    }

    setDeletingQuizId(quizId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/quizzes/${quizId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Impossible de supprimer ce quiz.");
      }

      await loadQuizzes();

      if (editingQuizId === quizId) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setDeletingQuizId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[#e4dfda] bg-white p-5">
        <h2 className="text-xl font-semibold text-[#1d3d68]">
          {isEditing ? "Modifier un quiz" : "Créer un quiz"}
        </h2>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-[#1d3d68]">
              Debut (UTC)
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm((prev) => {
                    const nextStartDate = event.target.value;
                    if (prev.durationPreset === "custom") {
                      return { ...prev, startDate: nextStartDate };
                    }

                    return {
                      ...prev,
                      startDate: nextStartDate,
                      endDate: getPresetEndDate(nextStartDate, prev.durationPreset),
                    };
                  })
                }
                className="mt-1 w-full rounded-lg border border-[#d9d4cf] px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm font-medium text-[#1d3d68]">
              Fin (UTC)
              <input
                required
                type="date"
                value={form.endDate}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    endDate: event.target.value,
                    durationPreset: "custom",
                  }))
                }
                className="mt-1 w-full rounded-lg border border-[#d9d4cf] px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm font-medium text-[#1d3d68]">
              Duree par defaut
              <select
                value={form.durationPreset}
                onChange={(event) =>
                  setForm((prev) => {
                    const nextPreset = event.target.value as DurationPreset;
                    if (nextPreset === "custom") {
                      return { ...prev, durationPreset: nextPreset };
                    }

                    return {
                      ...prev,
                      durationPreset: nextPreset,
                      endDate: getPresetEndDate(prev.startDate, nextPreset),
                    };
                  })
                }
                className="mt-1 w-full rounded-lg border border-[#d9d4cf] px-3 py-2 text-sm"
              >
                <option value="week">1 semaine</option>
                <option value="month">1 mois</option>
                <option value="custom">Personnalise</option>
              </select>
            </label>
          </div>

          <div className="space-y-3">
            {form.questions.map((question, index) => (
              <div
                key={question.id ?? `new-${index}`}
                className="rounded-lg border border-[#e4dfda] bg-[#f9f8f6] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#1d3d68]">
                    Question {index + 1}
                  </p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded border border-[#d9d4cf] px-2 py-1 text-xs cursor-pointer"
                      onClick={() => moveQuestion(index, -1)}
                      disabled={index === 0}
                    >
                      Monter
                    </button>
                    <button
                      type="button"
                      className="rounded border border-[#d9d4cf] px-2 py-1 text-xs cursor-pointer"
                      onClick={() => moveQuestion(index, 1)}
                      disabled={index === form.questions.length - 1}
                    >
                      Descendre
                    </button>
                    <button
                      type="button"
                      className="rounded border border-[#e5533b] px-2 py-1 text-xs text-[#e5533b] cursor-pointer"
                      onClick={() => removeQuestion(index)}
                      disabled={form.questions.length <= 1}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>

                <label className="mt-3 block text-sm font-medium text-[#1d3d68]">
                  Intitulé
                  <textarea
                    required
                    value={question.questionText}
                    onChange={(event) =>
                      updateQuestion(index, {
                        questionText: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-[#d9d4cf] px-3 py-2 text-sm"
                    rows={2}
                  />
                </label>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => (
                    <label
                      key={`${question.id ?? index}-opt-${optionIndex}`}
                      className="text-sm font-medium text-[#1d3d68]"
                    >
                      Option {optionIndex + 1}
                      <input
                        required
                        value={option}
                        onChange={(event) =>
                          updateOption(index, optionIndex, event.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-[#d9d4cf] px-3 py-2 text-sm"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-sm font-medium text-[#1d3d68]">
                    Bonne réponse
                    <select
                      value={String(question.correctAnswer)}
                      onChange={(event) =>
                        updateQuestion(index, {
                          correctAnswer: Number(event.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-[#d9d4cf] px-3 py-2 text-sm"
                    >
                      <option value="0">Option 1</option>
                      <option value="1">Option 2</option>
                      <option value="2">Option 3</option>
                      <option value="3">Option 4</option>
                    </select>
                  </label>

                  <label className="text-sm font-medium text-[#1d3d68]">
                    Explication
                    <input
                      required
                      value={question.explanation}
                      onChange={(event) =>
                        updateQuestion(index, {
                          explanation: event.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-[#d9d4cf] px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addQuestion}
              className="inline-flex h-10 items-center rounded-lg border border-[#1d3d68] px-4 text-sm font-semibold text-[#1d3d68] cursor-pointer"
            >
              Ajouter une question
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center rounded-lg bg-[#ea553a] px-4 text-sm font-semibold text-white disabled:opacity-60 cursor-pointer"
            >
              {saving
                ? "Enregistrement..."
                : isEditing
                  ? "Mettre à jour"
                  : "Créer le quiz"}
            </button>

            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex h-10 items-center rounded-lg border border-[#d9d4cf] px-4 text-sm font-semibold text-[#1d3d68] cursor-pointer"
              >
                Annuler
              </button>
            )}
          </div>
        </form>
      </section>

      {error ? (
        <p className="rounded-lg border border-[#e5533b] bg-[#fff1ef] p-3 text-sm font-semibold text-[#e5533b]">
          {error}
        </p>
      ) : null}

      <section className="rounded-xl border border-[#e4dfda] bg-white p-5">
        <h3 className="text-lg font-semibold text-[#1d3d68]">
          Quizzes existants
        </h3>

        {loading ? (
          <p className="mt-3 text-sm text-[#4b6484]">Chargement...</p>
        ) : sortedQuizzes.length === 0 ? (
          <p className="mt-3 text-sm text-[#4b6484]">Aucun quiz disponible.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {sortedQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#ece7e2] bg-[#faf9f7] p-3"
              >
                <div>
                  <p className="font-semibold text-[#1d3d68]">
                    {formatQuizLabel(quiz)}
                  </p>
                  <p className="text-xs text-[#4b6484]">
                    {formatQuizRange(quiz)} - {quiz.questions.length} question
                    {quiz.questions.length > 1 ? "s" : ""}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-[#d9d4cf] px-3 py-1.5 text-xs font-semibold text-[#1d3d68] cursor-pointer"
                    onClick={() => startDuplicate(quiz)}
                  >
                    Dupliquer
                  </button>

                  <button
                    type="button"
                    className="rounded-lg border border-[#1d3d68] px-3 py-1.5 text-xs font-semibold text-[#1d3d68] cursor-pointer"
                    onClick={() => startEdit(quiz)}
                  >
                    Modifier
                  </button>

                  <button
                    type="button"
                    className="rounded-lg border border-[#e5533b] px-3 py-1.5 text-xs font-semibold text-[#e5533b] disabled:opacity-50 cursor-pointer"
                    onClick={() => deleteQuiz(quiz.id)}
                    disabled={deletingQuizId === quiz.id}
                  >
                    {deletingQuizId === quiz.id
                      ? "Suppression..."
                      : "Supprimer"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
