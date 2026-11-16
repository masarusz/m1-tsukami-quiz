import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultPath = fileURLToPath(new URL("../data/acts.json", import.meta.url));
const combisPath = fileURLToPath(new URL("../data/combis.json", import.meta.url));
const filePath = resolve(process.argv[2] ?? defaultPath);
const problems = [];

let data;
let combisData;
try {
  [data, combisData] = await Promise.all([
    readFile(filePath, "utf8").then(JSON.parse),
    readFile(combisPath, "utf8").then(JSON.parse)
  ]);
} catch (error) {
  console.error(`data: ${error.message}`);
  process.exit(1);
}

if (!data || typeof data !== "object" || Array.isArray(data)) {
  problems.push("top level must be an object");
}
if (typeof data?.version !== "string") {
  problems.push("version must be a string");
}
if (!Array.isArray(data?.acts)) {
  problems.push("acts must be an array");
}

const acts = Array.isArray(data?.acts) ? data.acts : [];
const readings = combisData?.combis && typeof combisData.combis === "object" && !Array.isArray(combisData.combis)
  ? combisData.combis
  : {};
if (Object.keys(readings).length === 0) {
  problems.push("combis.json must contain a non-empty combis object");
}
if (acts.length === 0) {
  problems.push("acts must contain at least 1 act");
}

const ids = new Set();
const actKeys = new Set();
const youtubeHosts = new Set(["www.youtube.com", "youtu.be"]);

function isHttpsUrl(value, hosts = null) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (!hosts || hosts.has(url.hostname));
  } catch {
    return false;
  }
}

acts.forEach((act, index) => {
  const label = `acts[${index}]`;
  if (!act || typeof act !== "object" || Array.isArray(act)) {
    problems.push(`${label} must be an object`);
    return;
  }
  if (typeof act.id !== "string" || act.id.length === 0) {
    problems.push(`${label}.id must be a non-empty string`);
  } else if (ids.has(act.id)) {
    problems.push(`${label}.id duplicates "${act.id}"`);
  } else {
    ids.add(act.id);
  }
  if (typeof act.combi !== "string" || act.combi.trim().length === 0) {
    problems.push(`${label}.combi must be a non-empty string`);
  }
  if (!Number.isInteger(act.year) || !((act.year >= 2001 && act.year <= 2010) || (act.year >= 2015 && act.year <= 2030))) {
    problems.push(`${label}.year must be an integer in 2001–2010 or 2015–2030`);
  }
  if (act.round !== "first" && act.round !== "final") {
    problems.push(`${label}.round must be "first" or "final"`);
  }
  if (!Array.isArray(act.lines) || act.lines.length < 1 || act.lines.length > 10) {
    problems.push(`${label}.lines must contain 1–10 strings`);
  } else {
    act.lines.forEach((line, lineIndex) => {
      if (typeof line !== "string" || line.trim().length === 0 || [...line].length > 80) {
        problems.push(`${label}.lines[${lineIndex}] must be a non-empty string of at most 80 characters`);
      }
    });
  }
  if (!isHttpsUrl(act.source_url)) {
    problems.push(`${label}.source_url must be an https URL`);
  }
  if (act.video_url !== null && !isHttpsUrl(act.video_url, youtubeHosts)) {
    problems.push(`${label}.video_url must be null or an https YouTube URL`);
  }

  const key = `${act.combi}\u0000${act.year}\u0000${act.round}`;
  if (actKeys.has(key)) {
    problems.push(`${label} duplicates the combi, year, round combination`);
  } else {
    actKeys.add(key);
  }
});

for (const combi of new Set(acts.map((act) => act.combi))) {
  if (!Object.hasOwn(readings, combi)) problems.push(`combis.json has no entry for "${combi}"`);
}

for (const [combi, info] of Object.entries(readings)) {
  const label = `combis[${JSON.stringify(combi)}]`;
  if (!info || typeof info !== "object" || Array.isArray(info)) {
    problems.push(`${label} must be an object`);
    continue;
  }
  if (typeof info.reading !== "string" || !/^[\u3041-\u3096ー]+$/u.test(info.reading)) {
    problems.push(`${label}.reading must contain only hiragana and ー`);
  }
  if (!Array.isArray(info.aliases) || info.aliases.some((alias) => typeof alias !== "string" || alias.trim().length === 0)) {
    problems.push(`${label}.aliases must be an array of non-empty strings`);
  }
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`ERROR: ${problem}`);
  }
  process.exit(1);
}

const combis = new Set(acts.map((act) => act.combi));
console.log(`acts: ${acts.length} acts, combis: ${combis.size} combis`);
console.log(`readings: ${Object.keys(readings).length} combis`);
