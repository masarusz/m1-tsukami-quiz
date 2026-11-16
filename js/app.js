import { buildRound, filterActs, pointsFor, roundLabel } from "./quiz.js?v=1.0.0";

const APP_VERSION = "1.0.0";

const elements = {
  screens: [...document.querySelectorAll(".screen")],
  start: document.querySelector("#start-screen"),
  question: document.querySelector("#question-screen"),
  result: document.querySelector("#result-screen"),
  error: document.querySelector("#error-screen"),
  eraButtons: [...document.querySelectorAll(".era-button")],
  bestScore: document.querySelector("#best-score"),
  startButton: document.querySelector("#start-button"),
  progress: document.querySelector("#progress"),
  runningScore: document.querySelector("#running-score"),
  quoteList: document.querySelector("#quote-list"),
  hintArea: document.querySelector("#hint-area"),
  hintButton: document.querySelector("#hint-button"),
  linesLeft: document.querySelector("#lines-left"),
  currentPoints: document.querySelector("#current-points"),
  choices: document.querySelector("#choices"),
  answerPanel: document.querySelector("#answer-panel"),
  answerHeading: document.querySelector("#answer-heading"),
  answerMeta: document.querySelector("#answer-meta"),
  gainedPoints: document.querySelector("#gained-points"),
  answerLinks: document.querySelector("#answer-links"),
  nextButton: document.querySelector("#next-button"),
  resultScore: document.querySelector("#result-score"),
  resultCorrect: document.querySelector("#result-correct"),
  bestUpdated: document.querySelector("#best-updated"),
  resultList: document.querySelector("#result-list"),
  retryButton: document.querySelector("#retry-button"),
  topButton: document.querySelector("#top-button"),
  errorTopButton: document.querySelector("#error-top-button"),
  errorMessage: document.querySelector("#error-message"),
  version: document.querySelector("#app-version")
};

let allActs = [];
let selectedEra = "all";
let questions = [];
let questionIndex = 0;
let linesShown = 1;
let score = 0;
let correctCount = 0;
let answered = false;

function showScreen(screen) {
  for (const candidate of elements.screens) {
    candidate.hidden = candidate !== screen;
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

function storageKey() {
  return `m1tsukami.best.${selectedEra}`;
}

function readBest() {
  try {
    const value = localStorage.getItem(storageKey());
    if (value === null) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeBest(value) {
  try {
    localStorage.setItem(storageKey(), String(value));
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
}

function updateBestDisplay() {
  const best = readBest();
  elements.bestScore.textContent = best === null ? "ベスト: —" : `ベスト: ${best}点`;
}

function renderLines(count) {
  elements.quoteList.replaceChildren();
  const { lines } = questions[questionIndex].act;
  for (const line of lines.slice(0, count)) {
    const item = document.createElement("li");
    item.className = "quote-card";
    item.textContent = `「${line}」`;
    elements.quoteList.append(item);
  }
}

function updateHintStatus() {
  const lineCount = questions[questionIndex].act.lines.length;
  const remaining = Math.max(0, lineCount - linesShown);
  elements.hintButton.disabled = remaining === 0;
  elements.linesLeft.textContent = `あと ${remaining} 行`;
  elements.currentPoints.textContent = `正解で +${pointsFor(linesShown, true)} 点`;
}

function renderQuestion() {
  answered = false;
  linesShown = 1;
  const question = questions[questionIndex];
  elements.progress.textContent = `${questionIndex + 1} / ${questions.length}`;
  elements.runningScore.textContent = `${score}点`;
  renderLines(linesShown);
  updateHintStatus();
  elements.hintArea.hidden = false;
  elements.answerPanel.hidden = true;
  elements.nextButton.hidden = true;
  elements.choices.replaceChildren();

  for (const choice of question.choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = choice;
    button.addEventListener("click", () => answerQuestion(choice, button));
    elements.choices.append(button);
  }

  showScreen(elements.question);
  const firstChoice = elements.choices.querySelector("button");
  if (firstChoice) firstChoice.focus();
}

function makeLink(label, url, newTab = false) {
  const link = document.createElement("a");
  link.href = url;
  link.textContent = label;
  if (newTab) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  return link;
}

function answerQuestion(choice, chosenButton) {
  if (answered) return;
  answered = true;
  const { act } = questions[questionIndex];
  const correct = choice === act.combi;
  const gained = pointsFor(linesShown, correct);
  score += gained;
  if (correct) correctCount += 1;

  for (const button of elements.choices.querySelectorAll("button")) {
    button.disabled = true;
    const buttonChoice = button.textContent;
    if (buttonChoice === act.combi) {
      button.classList.add("is-correct");
      button.textContent = `○ ${buttonChoice}（正解）`;
    } else if (button === chosenButton) {
      button.classList.add("is-incorrect");
      button.textContent = `× ${buttonChoice}（不正解）`;
    }
  }

  renderLines(act.lines.length);
  elements.hintArea.hidden = true;
  elements.runningScore.textContent = `${score}点`;
  elements.answerHeading.textContent = correct ? `正解：${act.combi}` : `正解は ${act.combi}`;
  elements.answerMeta.textContent = `${act.year}年 ${roundLabel(act.round)}`;
  elements.gainedPoints.textContent = `獲得：+${gained}点`;
  elements.answerLinks.replaceChildren(makeLink("出典", act.source_url, true));
  if (act.video_url !== null) {
    elements.answerLinks.append(makeLink("公式動画を見る", act.video_url, true));
  }
  elements.answerPanel.hidden = false;
  elements.nextButton.textContent = questionIndex === questions.length - 1 ? "結果を見る" : "次へ";
  elements.nextButton.hidden = false;
  elements.nextButton.focus();
}

function startGame() {
  const filtered = filterActs(allActs, selectedEra);
  questions = buildRound(filtered, Math.random, 10);
  if (questions.length === 0) {
    elements.errorMessage.textContent = "この年代は問題または選択肢が足りません。別の年代をお試しください。";
    showScreen(elements.error);
    return;
  }
  questionIndex = 0;
  score = 0;
  correctCount = 0;
  renderQuestion();
}

function showResults() {
  const previousBest = readBest();
  const isNewBest = previousBest === null || score > previousBest;
  if (isNewBest) writeBest(score);

  elements.resultScore.textContent = `${score} / ${questions.length * 4}点`;
  elements.resultCorrect.textContent = `${questions.length}問中 ${correctCount}問正解`;
  elements.bestUpdated.hidden = !isNewBest;
  elements.resultList.replaceChildren();

  for (const { act } of questions) {
    const item = document.createElement("li");
    const description = document.createElement("span");
    description.textContent = `${act.combi} — ${act.year}年 ${roundLabel(act.round)}`;
    item.append(description, makeLink("出典", act.source_url, true));
    elements.resultList.append(item);
  }
  showScreen(elements.result);
  elements.retryButton.focus();
}

elements.eraButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedEra = button.dataset.era;
    for (const candidate of elements.eraButtons) {
      const selected = candidate === button;
      candidate.classList.toggle("is-selected", selected);
      candidate.setAttribute("aria-pressed", String(selected));
    }
    updateBestDisplay();
  });
});

elements.startButton.addEventListener("click", startGame);
elements.hintButton.addEventListener("click", () => {
  const lineCount = questions[questionIndex].act.lines.length;
  if (!answered && linesShown < lineCount) {
    linesShown += 1;
    renderLines(linesShown);
    updateHintStatus();
  }
});
elements.nextButton.addEventListener("click", () => {
  if (questionIndex === questions.length - 1) {
    showResults();
  } else {
    questionIndex += 1;
    renderQuestion();
  }
});
elements.retryButton.addEventListener("click", startGame);
elements.topButton.addEventListener("click", () => {
  updateBestDisplay();
  showScreen(elements.start);
  elements.startButton.focus();
});
elements.errorTopButton.addEventListener("click", () => {
  showScreen(elements.start);
  elements.startButton.focus();
});

async function initialize() {
  try {
    const response = await fetch("data/acts.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.acts)) throw new Error("invalid data");
    allActs = data.acts;
    elements.version.textContent = `v${typeof data.version === "string" ? data.version : APP_VERSION}`;
    updateBestDisplay();
  } catch {
    elements.errorMessage.textContent = "問題データを読み込めませんでした。ローカルサーバーから開いて、もう一度お試しください。";
    showScreen(elements.error);
  }
}

initialize();
