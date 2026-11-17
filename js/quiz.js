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

export const AIZUCHI_WORDS = [
  "はい", "うん", "ええ", "ああ", "おう", "へえ", "ほう", "そう", "せや",
  "なるほど", "おお", "え", "あ", "いや", "あら", "ね"
];

const AIZUCHI_PATTERN = new RegExp(
  `^(?:${[...AIZUCHI_WORDS].sort((a, b) => b.length - a.length).join("|")})+$`
);

export function isAizuchi(line) {
  const normalized = line
    .normalize("NFKC")
    .replace(/[\u30a1-\u30f6]/g, (character) =>
      String.fromCodePoint(character.codePointAt(0) - 0x60)
    )
    .replace(/[\s\p{P}「」『』ー〜～~ぁぃぅぇぉっ]/gu, "");
  return normalized.length > 0 && AIZUCHI_PATTERN.test(normalized);
}

export function revealCount(lines, shown) {
  let count = Math.min(shown + 1, lines.length);
  while (count < lines.length && isAizuchi(lines[count - 1])) count += 1;
  return count;
}

// A correct answer starts at MAX_POINTS and each hint press costs 1 point.
export function pointsFor(hintsUsed, correct) {
  return correct ? Math.max(1, MAX_POINTS - hintsUsed) : 0;
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
