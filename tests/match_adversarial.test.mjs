// Adversarial cases for hard-mode matching, written separately from the
// implementation's own tests (different author, different blind spots).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { judge, normalize } from "../js/match.js";

const { combis } = JSON.parse(await readFile(new URL("../data/combis.json", import.meta.url), "utf8"));
const names = Object.keys(combis);
const ok = (answer, combi) => judge(answer, combi, combis).correct;

test("comedians who are not in the data never pass for any combi", () => {
  const outsiders = ["かまいたち", "銀シャリ", "令和ロマン", "ニューヨーク", "千鳥", "麒麟", "ブラックマヨネーズ", "パンクブーブー", "ノンスタイル", "M-1", "漫才"];
  let pairs = 0;
  for (const outsider of outsiders) {
    for (const combi of names) {
      pairs += 1;
      assert.equal(ok(outsider, combi), false, `${outsider} passed for ${combi}`);
    }
  }
  assert.equal(pairs, outsiders.length * names.length);
});

test("one substituted character in a reading of 4+ characters still passes", () => {
  let checked = 0;
  for (const [combi, info] of Object.entries(combis)) {
    const reading = [...normalize(info.reading)];
    if (reading.length < 4) continue;
    const middle = Math.floor(reading.length / 2);
    const typo = [...reading.slice(0, middle), "ぬ", ...reading.slice(middle + 1)].join("");
    if (typo === reading.join("")) continue;
    checked += 1;
    assert.equal(ok(typo, combi), true, `${typo} should pass for ${combi}`);
  }
  assert.ok(checked >= 25, `precondition: readings with 4+ characters checked = ${checked}`);
});

test("three-character names allow no typo", () => {
  assert.equal(ok("ナイス", "ナイツ"), false);
  assert.equal(ok("ないつ", "ナイツ"), true);
  assert.equal(ok("めそん", "めぞん"), true); // voicing fold, not a typo
  assert.equal(ok("めろん", "めぞん"), false);
});

test("width, spacing, kana and punctuation variants pass", () => {
  assert.equal(ok(" さ や か ", "さや香"), true);
  assert.equal(ok("サヤカ", "さや香"), true);
  assert.equal(ok("ｻﾔｶ", "さや香"), true);
  assert.equal(ok("dondokodon", "DonDokoDon"), true);
  assert.equal(ok("ドンドコドン", "DonDokoDon"), true);
  assert.equal(ok("とむぶらうん", "トム・ブラウン"), true);
  assert.equal(ok("まじかるらぶりー", "マヂカルラブリー"), true);
  assert.equal(ok("タイムマシーン三号", "タイムマシーン3号"), true);
  assert.equal(ok("てつあんどとも", "テツandトモ"), true);
  assert.equal(ok("テツ&トモ", "テツandトモ"), true);
  assert.equal(ok("テツ＆トモ", "テツandトモ"), true);
});

test("junk, repetition and fragments fail", () => {
  assert.equal(ok("さやかさやか", "さや香"), false);
  assert.equal(ok("ミ", "ミルクボーイ"), false);
  assert.equal(ok("わ", "和牛"), false);
  assert.equal(ok("!!!", "さや香"), false);
  assert.equal(ok("   ", "さや香"), false);
  assert.equal(ok("しもふり みょうじょう だいすき", "霜降り明星"), false);
});

test("an alias only passes for its own combi", () => {
  for (const [combi, info] of Object.entries(combis)) {
    for (const alias of info.aliases) {
      assert.equal(ok(alias, combi), true, `${alias} → ${combi}`);
      for (const other of names) if (other !== combi) assert.equal(ok(alias, other), false, `${alias} passed for ${other}`);
    }
  }
});

test("an answer that is exactly another combi does not pass for a near neighbour", () => {
  // No two real combis are this close today, so this guard is only reachable with synthetic data.
  const near = { "あいうえお": { reading: "あいうえお", aliases: [] }, "あいうえか": { reading: "あいうえか", aliases: [] } };
  assert.equal(judge("あいうえか", "あいうえか", near).correct, true);
  assert.equal(judge("あいうえか", "あいうえお", near).correct, false, "within tolerance of あいうえお but exactly あいうえか");
  assert.equal(judge("あいうえく", "あいうえお", near).correct, true, "a tie is not blocked: only a strictly closer other combi blocks");
});

test("an alias typed as its reading passes (しもふり, しんくう, ほていそん)", () => {
  assert.equal(ok("しもふり", "霜降り明星"), true);
  assert.equal(ok("シモフリ", "霜降り明星"), true);
  assert.equal(ok("しんくう", "真空ジェシカ"), true);
  assert.equal(ok("ほていそん", "東京ホテイソン"), true);
  assert.equal(ok("しもふ", "霜降り明星"), false); // alias readings are exact, not fuzzy
});

test("an alias reading only passes for its own combi", () => {
  let checked = 0;
  for (const [combi, info] of Object.entries(combis)) {
    for (const reading of Object.values(info.alias_readings ?? {})) {
      checked += 1;
      assert.equal(ok(reading, combi), true, `${reading} → ${combi}`);
      for (const other of names) if (other !== combi) assert.equal(ok(reading, other), false, `${reading} passed for ${other}`);
    }
  }
  const aliasCount = Object.values(combis).reduce((n, info) => n + info.aliases.length, 0);
  assert.equal(checked, aliasCount, "every alias has exactly one reading");
});

test("check_data rejects a kanji alias reading that is not a prefix of the combi reading", async () => {
  const { spawnSync } = await import("node:child_process");
  const { mkdtemp, writeFile, rm, readFile: rf } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = fileURLToPath(new URL("..", import.meta.url));
  const dir = await mkdtemp(join(tmpdir(), "m1-alias-"));
  try {
    const bad = JSON.parse(await rf(new URL("../data/combis.json", import.meta.url), "utf8"));
    bad.combis["霜降り明星"].alias_readings["霜降り"] = "しもぶり";
    const badPath = join(dir, "combis.json");
    await writeFile(badPath, JSON.stringify(bad));
    const res = spawnSync(process.execPath, [join(root, "tools/check_data.mjs"), join(root, "data/acts.json"), badPath], { encoding: "utf8" });
    assert.notEqual(res.status, 0, "a wrong alias reading must fail the data check");
    assert.match(res.stderr + res.stdout, /alias_readings/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
