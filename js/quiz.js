function shuffled(items, rng) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(rng() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function eraBucket(year) {
  return year <= 2010 ? "early" : "modern";
}

export function filterActs(acts, era) {
  if (era === "early") {
    return acts.filter((act) => act.year >= 2001 && act.year <= 2010);
  }
  if (era === "modern") {
    return acts.filter((act) => act.year >= 2015);
  }
  return [...acts];
}

export function buildRound(acts, rng = Math.random, size = 10) {
  const combis = [...new Set(acts.map((act) => act.combi))];
  if (combis.length < 4) {
    return [];
  }

  return shuffled(acts, rng).slice(0, Math.max(0, size)).map((act) => {
    const preferred = combis.filter((combi) =>
      combi !== act.combi && acts.some((candidate) =>
        candidate.combi === combi && eraBucket(candidate.year) === eraBucket(act.year)
      )
    );
    const fallback = combis.filter((combi) =>
      combi !== act.combi && !preferred.includes(combi)
    );
    const distractors = [
      ...shuffled(preferred, rng),
      ...shuffled(fallback, rng)
    ].slice(0, 3);

    return {
      act,
      choices: shuffled([act.combi, ...distractors], rng)
    };
  });
}

export const MAX_LINES = 10;
export const MAX_POINTS = MAX_LINES;

// 1 line shown = MAX_POINTS, each extra line costs 1, all 10 lines = 1 point.
export function pointsFor(linesShown, correct) {
  return correct ? Math.max(1, MAX_POINTS + 1 - linesShown) : 0;
}

// Display only: a line that already opens with its own 「 (reported speech, e.g.
// 「彼氏いる」って言っちゃった) is shown as-is, otherwise wrapping it gives 「「…」.
// The stored line is never changed, so the verbatim source check still holds.
export function quoteLine(line) {
  return line.startsWith("「") ? line : `「${line}」`;
}

export function roundLabel(round) {
  return round === "first" ? "1stラウンド" : "最終決戦";
}
