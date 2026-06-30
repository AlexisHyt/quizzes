"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ApiKeyResponse = {
  hasApiKey: boolean;
  apiKey: string | null;
};

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 12) {
    return "*".repeat(apiKey.length);
  }

  return `${apiKey.slice(0, 6)}${"*".repeat(Math.max(4, apiKey.length - 10))}${apiKey.slice(-4)}`;
}

export function UserApiKeyCard() {
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadApiKey = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/user/api-key", {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Impossible de charger la clé API.");
      }

      const payload = (await response.json()) as ApiKeyResponse;
      setHasApiKey(payload.hasApiKey);
      setApiKey(payload.apiKey);
    } catch {
      setError("Impossible de charger la clé API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApiKey();
  }, [loadApiKey]);

  async function handleRegenerate() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/user/api-key", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Impossible de régénérer la clé API.");
      }

      const payload = (await response.json()) as ApiKeyResponse;
      setHasApiKey(payload.hasApiKey);
      setApiKey(payload.apiKey);
      setShowApiKey(false);
    } catch {
      setError("Impossible de régénérer la clé API.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!apiKey) {
      return;
    }

    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Impossible de copier la clé API.");
    }
  }

  const displayedApiKey = useMemo(() => {
    if (!apiKey) {
      return "Aucune clé générée";
    }

    return showApiKey ? apiKey : maskApiKey(apiKey);
  }, [apiKey, showApiKey]);

  return (
    <div className="rounded-xl border border-[#e4dfda] bg-white p-5">
      <h2 className="text-lg font-semibold text-[#1d3d68]">Clé API</h2>

      <p className="mt-2 text-sm text-[#4b6484]">
        Crée une clé API pour tes integrations. Régénérer remplace l'ancienne
        clé.
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-[#4b6484]">Chargement...</p>
      ) : (
        <>
          <div className="mt-4 rounded-lg border border-[#e4dfda] bg-[#f6f6f6] px-3 py-2">
            <p className="break-all font-mono text-sm text-[#1d3d68]">
              {displayedApiKey}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isSubmitting}
              className="inline-flex h-10 items-center rounded-lg bg-[#ea553a] px-4 text-sm font-semibold text-white disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting
                ? "Traitement..."
                : hasApiKey
                  ? "Re-régénérer"
                  : "Générer"}
            </button>

            <button
              type="button"
              onClick={() => setShowApiKey((current) => !current)}
              disabled={!apiKey}
              className="inline-flex h-10 items-center rounded-lg border border-[#d9d4cf] px-4 text-sm font-semibold text-[#1d3d68] disabled:opacity-50 cursor-pointer"
            >
              {showApiKey ? "Masquer" : "Afficher"}
            </button>

            <button
              type="button"
              onClick={handleCopy}
              disabled={!apiKey}
              className="inline-flex h-10 items-center rounded-lg border border-[#d9d4cf] px-4 text-sm font-semibold text-[#1d3d68] disabled:opacity-50 cursor-pointer"
            >
              {copied ? "Copiée" : "Copier"}
            </button>
          </div>
        </>
      )}

      {error ? <p className="mt-3 text-sm text-[#e5533b]">{error}</p> : null}
    </div>
  );
}
