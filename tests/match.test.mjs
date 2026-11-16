import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { editDistance, fold, isMatch, judge, normalize, tolerance } from "../js/match.js";

const data = JSON.parse(await readFile(new URL("../data/combis.json", import.meta.url), "utf8"));
const combisMap = data.combis;

test("normalize and fold unify supported Japanese spelling variants", () => {
  assert.equal(normalize(" ﾄﾞﾝ・ﾃﾞｺﾙﾃ！ "), "どんでこるて");
  assert.equal(fold(normalize("ギャップ")), fold(normalize("きやつふ")));
});

test("documented hard-mode answers match", () => {
  const positives = [
    ["さやか", "さや香"],
    ["どんでこるて", "ドンデコルテ"],
    ["ドンデコルテ", "ドンデコルテ"],
    ["ﾄﾞﾝﾃﾞｺﾙﾃ", "ドンデコルテ"],
    ["しもふりみょうじよう", "霜降り明星"],
    ["サンドイッチマン", "サンドウィッチマン"],
    ["サンド", "サンドウィッチマン"]
  ];
  for (const [answer, correctCombi] of positives) {
    assert.equal(judge(answer, correctCombi, combisMap).correct, true, `${answer} should match ${correctCombi}`);
  }
});

test("partial and extended names do not match", () => {
  const negatives = [
    ["笑い", "笑い飯"],
    ["笑い飯哲夫", "笑い飯"],
    ["ミルク", "ミルクボーイ"],
    ["ボーイ", "ミルクボーイ"],
    ["さや", "さや香"]
  ];
  for (const [answer, correctCombi] of negatives) {
    assert.equal(judge(answer, correctCombi, combisMap).correct, false, `${answer} should not match ${correctCombi}`);
  }
  for (const combi of Object.keys(combisMap)) {
    assert.equal(judge("", combi, combisMap).correct, false, `empty answer should not match ${combi}`);
  }
});

test("every own name and reading matches only its combi", () => {
  const combis = Object.keys(combisMap);
  assert.ok(combis.length >= 30);
  for (const combi of combis) {
    assert.equal(judge(combi, combi, combisMap).correct, true, `own name: ${combi}`);
    assert.equal(judge(combisMap[combi].reading, combi, combisMap).correct, true, `own reading: ${combi}`);
  }

  let checked = 0;
  for (const answerCombi of combis) {
    for (const correctCombi of combis) {
      if (answerCombi === correctCombi) continue;
      assert.equal(judge(answerCombi, correctCombi, combisMap).correct, false, `${answerCombi} must not answer ${correctCombi}`);
      assert.equal(judge(combisMap[answerCombi].reading, correctCombi, combisMap).correct, false, `${combisMap[answerCombi].reading} must not answer ${correctCombi}`);
      checked += 2;
    }
  }
  assert.equal(checked, combis.length * (combis.length - 1) * 2);
});

test("every alias matches only its registered combi", () => {
  const entries = Object.entries(combisMap);
  const aliasCount = entries.reduce((count, [, info]) => count + info.aliases.length, 0);
  let wrongPairsChecked = 0;
  for (const [owner, info] of entries) {
    for (const alias of info.aliases) {
      assert.equal(isMatch(alias, owner, info), true, `${alias} should directly match ${owner}`);
      assert.equal(judge(alias, owner, combisMap).correct, true, `${alias} should judge as ${owner}`);
      for (const [other] of entries) {
        if (other === owner) continue;
        assert.equal(judge(alias, other, combisMap).correct, false, `${alias} must not answer ${other}`);
        wrongPairsChecked += 1;
      }
    }
  }
  assert.equal(wrongPairsChecked, aliasCount * (entries.length - 1));
});

test("tolerance follows candidate length boundaries", () => {
  assert.deepEqual(
    [0, 1, 3, 4, 6, 7, 10, 11, 20].map(tolerance),
    [0, 0, 0, 1, 1, 2, 2, 3, 3]
  );
});

test("editDistance computes Levenshtein distance over code points", () => {
  assert.equal(editDistance("", ""), 0);
  assert.equal(editDistance("abc", ""), 3);
  assert.equal(editDistance("kitten", "sitting"), 3);
  assert.equal(editDistance("さやか", "さや香"), 1);
  assert.equal(editDistance("😀", "😃"), 1);
});
