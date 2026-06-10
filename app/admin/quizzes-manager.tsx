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
  weekNumber: string;
  date: string;
  label: string;
  questions: ManagedQuestion[];
};

type QuizzesResponse = {
  quizzes: ManagedQuiz[];
};

const WEEK_NUMBER_PATTERN = /^S\d{2}$/;

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
    weekNumber: "",
    date: "",
    label: "",
    questions: [createEmptyQuestion()],
  };
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
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
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
      weekNumber: quiz.weekNumber,
      date: quiz.date,
      label: quiz.label,
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
    const [year, month, day] = quiz.date
      .split("-")
      .map((part) => Number.parseInt(part, 10));
    const sourceDate = new Date(year, (month ?? 1) - 1, day ?? 1);
    sourceDate.setDate(sourceDate.getDate() + 7);

    const nextDate = `${sourceDate.getFullYear()}-${String(sourceDate.getMonth() + 1).padStart(2, "0")}-${String(sourceDate.getDate()).padStart(2, "0")}`;
    const currentWeekNumber = Number.parseInt(
      quiz.weekNumber.replace(/^S/, ""),
      10,
    );
    const nextWeekNumber = Number.isNaN(currentWeekNumber)
      ? ""
      : `S${String(currentWeekNumber + 1).padStart(2, "0")}`;

    setEditingQuizId(null);
    setError(null);
    setForm({
      weekNumber: nextWeekNumber,
      date: nextDate,
      label: `${quiz.label} (copie)`,
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

    if (!WEEK_NUMBER_PATTERN.test(form.weekNumber.trim())) {
      setSaving(false);
      setError("Le numero de semaine doit etre au format S01, S02, etc.");
      return;
    }

    const [year, month, day] = form.date
      .split("-")
      .map((part) => Number.parseInt(part, 10));
    const mondayCheck = new Date(year, (month ?? 1) - 1, day ?? 1);
    if (mondayCheck.getDay() !== 1) {
      setSaving(false);
      setError("La date du quiz doit correspondre a un lundi.");
      return;
    }

    const payload = {
      weekNumber: form.weekNumber.trim(),
      date: form.date,
      label: form.label.trim(),
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
              Semaine
              <input
                required
                value={form.weekNumber}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    weekNumber: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-[#d9d4cf] px-3 py-2 text-sm"
                placeholder="S14"
                pattern="S[0-9]{2}"
              />
            </label>

            <label className="text-sm font-medium text-[#1d3d68]">
              Date (lundi)
              <input
                required
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, date: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[#d9d4cf] px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm font-medium text-[#1d3d68]">
              Libellé
              <input
                required
                value={form.label}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, label: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[#d9d4cf] px-3 py-2 text-sm"
                placeholder="07 avril 2026"
              />
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
                      className="rounded border border-[#d9d4cf] px-2 py-1 text-xs"
                      onClick={() => moveQuestion(index, -1)}
                      disabled={index === 0}
                    >
                      Monter
                    </button>
                    <button
                      type="button"
                      className="rounded border border-[#d9d4cf] px-2 py-1 text-xs"
                      onClick={() => moveQuestion(index, 1)}
                      disabled={index === form.questions.length - 1}
                    >
                      Descendre
                    </button>
                    <button
                      type="button"
                      className="rounded border border-[#e5533b] px-2 py-1 text-xs text-[#e5533b]"
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
                className="inline-flex h-10 items-center rounded-lg border border-[#d9d4cf] px-4 text-sm font-semibold text-[#1d3d68]"
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
                    {quiz.weekNumber} - {quiz.label}
                  </p>
                  <p className="text-xs text-[#4b6484]">
                    {quiz.date} - {quiz.questions.length} question
                    {quiz.questions.length > 1 ? "s" : ""}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-[#d9d4cf] px-3 py-1.5 text-xs font-semibold text-[#1d3d68]"
                    onClick={() => startDuplicate(quiz)}
                  >
                    Dupliquer
                  </button>

                  <button
                    type="button"
                    className="rounded-lg border border-[#1d3d68] px-3 py-1.5 text-xs font-semibold text-[#1d3d68]"
                    onClick={() => startEdit(quiz)}
                  >
                    Modifier
                  </button>

                  <button
                    type="button"
                    className="rounded-lg border border-[#e5533b] px-3 py-1.5 text-xs font-semibold text-[#e5533b] disabled:opacity-50"
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
