"use client";

import { useEffect, useState } from "react";

type AttemptRecord = {
  attemptId: number;
  weekNumber: string;
  label: string;
  date: string;
  score: number;
  totalQuestions: number;
  pointsEarned: number;
  medal: string;
  completedAt: string;
};

export const getMedalEmoji = (medal: string): string => {
  if (medal === "gold") return "🥇";
  if (medal === "silver") return "🥈";
  if (medal === "bronze") return "🥉";
  return "❌";
};

export function RecentAttemptsHistory() {
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const res = await fetch("/api/user/attempt-history");
        if (!res.ok) {
          setError("Impossible de charger l'historique.");
          return;
        }

        const data = (await res.json()) as { attempts: AttemptRecord[] };
        setAttempts(data.attempts);
      } catch {
        setError("Erreur réseau lors du chargement de l'historique.");
      } finally {
        setLoading(false);
      }
    };

    fetchAttempts();
  }, []);

  if (loading) {
    return (
      <p className="text-sm text-[#4b6484]">Chargement de l'historique...</p>
    );
  }

  if (error) {
    return <p className="text-sm text-[#e5533b]">{error}</p>;
  }

  if (attempts.length === 0) {
    return (
      <p className="text-sm text-[#4b6484]">
        Aucune tentative réelle pour le moment. Lance ton premier quiz !
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {attempts.map((attempt) => (
        <div
          key={attempt.attemptId}
          className="flex items-center justify-between rounded-lg border border-[#e4dfda] bg-white px-3 py-2 text-sm"
        >
          <div className="flex-1">
            <p className="font-semibold text-[#1d3d68]">
              {attempt.weekNumber} — {attempt.label}
            </p>
            <p className="text-xs text-[#4b6484]">
              {new Date(attempt.completedAt).toLocaleDateString("fr-FR")}
            </p>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div>
              <p className="font-semibold text-[#1d3d68]">
                {attempt.score}/{attempt.totalQuestions}
              </p>
              <p className="text-xs text-[#4b6484]">
                +{attempt.pointsEarned} pts
              </p>
            </div>
            <span className="text-2xl">{getMedalEmoji(attempt.medal)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
