export type Medal = "none" | "bronze" | "silver" | "gold";

export function computePoints(score: number, total: number): number {
  if (total <= 0 || score <= 0) {
    return 0;
  }

  return Math.round((score / total) * 100) * total;
}

export function getBronzeThreshold(total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.max(1, Math.floor(total / 2));
}

export function getSilverThreshold(total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.ceil((2 * total) / 3);
}

export function computeMedal(score: number, total: number): Medal {
  if (total <= 0 || score <= 0) {
    return "none";
  }

  if (score === total) {
    return "gold";
  }

  if (score >= getSilverThreshold(total)) {
    return "silver";
  }

  if (score >= getBronzeThreshold(total)) {
    return "bronze";
  }

  return "none";
}

export function isBetterPerformance(
  score: number,
  total: number,
  bestScore: number,
  bestTotal: number,
): boolean {
  if (total <= 0) {
    return false;
  }

  if (bestTotal <= 0) {
    return true;
  }

  const currentRatioLeft = score * bestTotal;
  const bestRatioRight = bestScore * total;

  if (currentRatioLeft > bestRatioRight) {
    return true;
  }

  if (currentRatioLeft < bestRatioRight) {
    return false;
  }

  return score > bestScore;
}

export function getMedalLabel(medal: Medal): string {
  if (medal === "gold") {
    return "Or";
  }

  if (medal === "silver") {
    return "Argent";
  }

  if (medal === "bronze") {
    return "Bronze";
  }

  return "Sans medaille";
}
