function katakanaToHiragana(value) {
  return [...value].map((character) => {
    const codePoint = character.codePointAt(0);
    if ((codePoint >= 0x30a1 && codePoint <= 0x30f6) ||
        (codePoint >= 0x30fd && codePoint <= 0x30fe)) {
      return String.fromCodePoint(codePoint - 0x60);
    }
    return character;
  }).join("");
}

export function normalize(value) {
  if (typeof value !== "string") return "";
  return katakanaToHiragana(value.normalize("NFKC").toLowerCase())
    .replace(/[\s\p{P}\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e・ー☆★♪〜]/gu, "");
}

const SMALL_KANA = new Map([
  ["ぁ", "あ"], ["ぃ", "い"], ["ぅ", "う"], ["ぇ", "え"], ["ぉ", "お"],
  ["っ", "つ"], ["ゃ", "や"], ["ゅ", "ゆ"], ["ょ", "よ"], ["ゎ", "わ"],
  ["ゕ", "か"], ["ゖ", "け"]
]);

export function fold(value) {
  const expanded = [...value].map((character) => SMALL_KANA.get(character) ?? character).join("");
  return expanded.normalize("NFD").replace(/[\u3099\u309a]/gu, "").normalize("NFC");
}

export function editDistance(left, right) {
  const a = [...left];
  const b = [...right];
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
}

export function tolerance(length) {
  if (length <= 3) return 0;
  if (length <= 6) return 1;
  if (length <= 10) return 2;
  return 3;
}

function normalizedCandidates(combi, info) {
  return [normalize(combi), normalize(info?.reading)].filter(Boolean);
}

// Aliases match exactly (never fuzzily), by their written form or by their reading,
// so しもふり finds the alias 霜降り. Readings live in combis.json alias_readings.
function aliasForms(info) {
  const aliases = Array.isArray(info?.aliases) ? info.aliases : [];
  const readings = info?.alias_readings && typeof info.alias_readings === "object" ? Object.values(info.alias_readings) : [];
  return [...aliases, ...readings].map(normalize).filter(Boolean);
}

function isExactIdentity(answer, combi, info) {
  const normalizedAnswer = normalize(answer);
  if (!normalizedAnswer) return false;
  return normalizedCandidates(combi, info).includes(normalizedAnswer) ||
    aliasForms(info).includes(normalizedAnswer);
}

function bestDistance(answer, combi, info) {
  if (isExactIdentity(answer, combi, info)) return 0;
  const foldedAnswer = fold(normalize(answer));
  const distances = normalizedCandidates(combi, info)
    .map((candidate) => editDistance(foldedAnswer, fold(candidate)));
  return distances.length > 0 ? Math.min(...distances) : Number.POSITIVE_INFINITY;
}

export function isMatch(answer, combi, info) {
  const normalizedAnswer = normalize(answer);
  if (!normalizedAnswer || !info) return false;
  if (aliasForms(info).includes(normalizedAnswer)) {
    return true;
  }
  const foldedAnswer = fold(normalizedAnswer);
  return normalizedCandidates(combi, info).some((candidate) =>
    editDistance(foldedAnswer, fold(candidate)) <= tolerance([...candidate].length)
  );
}

export function judge(answer, correctCombi, combisMap) {
  if (!normalize(answer) || !combisMap || !combisMap[correctCombi]) {
    return { correct: false, closest: null };
  }

  let closest = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const [combi, info] of Object.entries(combisMap)) {
    const distance = bestDistance(answer, combi, info);
    if (distance < closestDistance) {
      closest = combi;
      closestDistance = distance;
    }
  }

  if (!isMatch(answer, correctCombi, combisMap[correctCombi])) {
    return { correct: false, closest };
  }

  const correctDistance = bestDistance(answer, correctCombi, combisMap[correctCombi]);
  const blocked = Object.entries(combisMap).some(([combi, info]) =>
    combi !== correctCombi &&
    (isExactIdentity(answer, combi, info) || bestDistance(answer, combi, info) < correctDistance)
  );
  return { correct: !blocked, closest };
}
