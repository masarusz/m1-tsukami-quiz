import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildRound, filterActs, MAX_POINTS, pointsFor, quoteLine, roundLabel } from "../js/quiz.js";

const combis = ["A", "B", "C", "D", "E", "F", "G", "H"];
const acts = Array.from({ length: 12 }, (_, index) => ({
  id: `act-${index}`,
  combi: combis[index % combis.length],
  year: index < 6 ? 2001 + index : 2015 + index,
  round: index % 2 === 0 ? "first" : "final",
  lines: ["line"]
}));

function seededRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test("buildRound returns 10 questions sampled without replacement", () => {
  const round = buildRound(acts, seededRng(1));
  assert.equal(round.length, 10);
  assert.equal(new Set(round.map(({ act }) => act.id)).size, 10);
});

test("every question has four distinct choices including one answer", () => {
  const round = buildRound(acts, seededRng(2));
  for (const question of round) {
    assert.equal(question.choices.length, 4);
    assert.equal(new Set(question.choices).size, 4);
    assert.equal(question.choices.filter((choice) => choice === question.act.combi).length, 1);
  }
});

test("duplicate combi acts never duplicate the answer among distractors", () => {
  const repeated = [
    { id: "a1", combi: "A", year: 2001 },
    { id: "a2", combi: "A", year: 2002 },
    { id: "b", combi: "B", year: 2003 },
    { id: "c", combi: "C", year: 2004 },
    { id: "d", combi: "D", year: 2005 }
  ];
  for (const question of buildRound(repeated, seededRng(3))) {
    assert.equal(new Set(question.choices).size, 4);
    assert.equal(question.choices.filter((choice) => choice === question.act.combi).length, 1);
  }
});

test("fewer acts produce a shorter round when four combis remain available", () => {
  const poolWithFourCombis = [
    { id: "a", combi: "A", year: 2001 },
    { id: "b", combi: "B", year: 2002 },
    { id: "c", combi: "C", year: 2003 },
    { id: "d", combi: "D", year: 2004 }
  ];
  const round = buildRound(poolWithFourCombis, seededRng(4), 3);
  assert.equal(round.length, 3);
  assert.equal(buildRound(poolWithFourCombis.slice(0, 3), seededRng(4)).length, 0);
});

test("filterActs applies era boundaries", () => {
  const boundaryActs = [
    { id: "2009", year: 2009 },
    { id: "2010", year: 2010 },
    { id: "2012", year: 2012 },
    { id: "2015", year: 2015 },
    { id: "2016", year: 2016 }
  ];
  assert.deepEqual(filterActs(boundaryActs, "early").map((act) => act.id), ["2009", "2010"]);
  assert.deepEqual(filterActs(boundaryActs, "modern").map((act) => act.id), ["2015", "2016"]);
  assert.deepEqual(filterActs(boundaryActs, "all"), boundaryActs);
  assert.notEqual(filterActs(boundaryActs, "all"), boundaryActs);
});

test("pointsFor follows the scoring table", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lines) => pointsFor(lines, true)), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.equal(pointsFor(1, false), 0);
  assert.equal(pointsFor(4, false), 0);
  assert.equal(pointsFor(10, false), 0);
  assert.equal(MAX_POINTS, 10);
});

test("roundLabel renders Japanese labels", () => {
  assert.equal(roundLabel("first"), "1stラウンド");
  assert.equal(roundLabel("final"), "最終決戦");
});

test("buildRound is deterministic with the same seeded rng", () => {
  const first = buildRound(acts, seededRng(99));
  const second = buildRound(acts, seededRng(99));
  assert.deepEqual(first, second);
});

test("data validator passes the shipped data and rejects required invalid cases", async (t) => {
  const scriptPath = fileURLToPath(new URL("../tools/check_data.mjs", import.meta.url));
  const samplePath = new URL("../data/acts.json", import.meta.url);
  const sample = JSON.parse(await readFile(samplePath, "utf8"));
  const valid = spawnSync(process.execPath, [scriptPath], { encoding: "utf8" });
  assert.equal(valid.status, 0, valid.stderr);
  assert.match(valid.stdout, /acts: [1-9][0-9]* acts, combis: ([4-9]|[1-9][0-9]+) combis/);

  const directory = await mkdtemp(join(tmpdir(), "m1-tsukami-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const cases = [
    ["duplicate-id", (data) => { data.acts[1].id = data.acts[0].id; }],
    ["invalid-round", (data) => { data.acts[0].round = "semi"; }],
    ["eleven-lines", (data) => { data.acts[0].lines = Array.from({ length: 11 }, (_, i) => String(i + 1)); }],
    ["http-source", (data) => { data.acts[0].source_url = "http://example.com/source"; }],
    ["year-2012", (data) => { data.acts[0].year = 2012; }]
  ];

  const tenLines = structuredClone(sample);
  tenLines.acts[0].lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);
  const tenPath = join(directory, "ten-lines.json");
  await writeFile(tenPath, JSON.stringify(tenLines), "utf8");
  const tenResult = spawnSync(process.execPath, [scriptPath, tenPath], { encoding: "utf8" });
  assert.equal(tenResult.status, 0, `10 lines should pass: ${tenResult.stderr}`);

  for (const [name, mutate] of cases) {
    const data = structuredClone(sample);
    mutate(data);
    const path = join(directory, `${name}.json`);
    await writeFile(path, JSON.stringify(data), "utf8");
    const result = spawnSync(process.execPath, [scriptPath, path], { encoding: "utf8" });
    assert.notEqual(result.status, 0, `${name} unexpectedly passed`);
    assert.match(result.stderr, /ERROR:/);
  }
});

test("quoteLine wraps plain lines and leaves lines that open with their own 「 alone", async () => {
  assert.equal(quoteLine("あのさ"), "「あのさ」");
  assert.equal(quoteLine("「彼氏いる」って言っちゃったらしくて、"), "「彼氏いる」って言っちゃったらしくて、");
  assert.equal(quoteLine("「もし15年後の今日、"), "「もし15年後の今日、");
  assert.equal(quoteLine("（歩きながら）国際交流"), "「（歩きながら）国際交流」");
  assert.equal(quoteLine("『どこでしたっけ』あれへんがな"), "「『どこでしたっけ』あれへんがな」");
  // Shipped data: no rendered line ever starts with a doubled 「「.
  const data = JSON.parse(await readFile(new URL("../data/acts.json", import.meta.url), "utf8"));
  const rendered = data.acts.flatMap((act) => act.lines.map(quoteLine));
  const openers = data.acts.flatMap((act) => act.lines).filter((line) => line.startsWith("「")).length;
  assert.ok(openers > 0, `precondition: some shipped lines open with 「 (found ${openers} lines)`);
  assert.equal(rendered.filter((line) => line.startsWith("「「")).length, 0);
});
