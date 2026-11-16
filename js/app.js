import { judge } from "./match.js?v=1.1.0";
import { buildRound, filterActs, MAX_POINTS, pointsFor, quoteLine, roundLabel } from "./quiz.js?v=1.1.0";

const APP_VERSION = "1.1.0";

const elements = {
  screens: [...document.querySelectorAll(".screen")],
  start: document.querySelector("#start-screen"),
  question: document.querySelector("#question-screen"),
  result: document.querySelector("#result-screen"),
  error: document.querySelector("#error-screen"),
  eraButtons: [...document.querySelectorAll(".era-button")],
  modeButtons: [...document.querySelectorAll(".mode-button")],
  bestScore: document.querySelector("#best-score"), startButton: document.querySelector("#start-button"),
  progress: document.querySelector("#progress"), runningScore: document.querySelector("#running-score"),
  quoteList: document.querySelector("#quote-list"), hintArea: document.querySelector("#hint-area"),
  hintButton: document.querySelector("#hint-button"), linesLeft: document.querySelector("#lines-left"),
  currentPoints: document.querySelector("#current-points"), choices: document.querySelector("#choices"),
  hardForm: document.querySelector("#hard-answer-form"), hardInput: document.querySelector("#hard-answer-input"),
  hardSubmit: document.querySelector("#hard-submit-button"), giveUpButton: document.querySelector("#give-up-button"),
  answerPanel: document.querySelector("#answer-panel"), answerHeading: document.querySelector("#answer-heading"),
  answerMeta: document.querySelector("#answer-meta"), gainedPoints: document.querySelector("#gained-points"),
  answerLinks: document.querySelector("#answer-links"), feedbackBar: document.querySelector("#feedback-bar"),
  feedbackStatus: document.querySelector("#feedback-status"), feedbackAnswer: document.querySelector("#feedback-answer"),
  feedbackYours: document.querySelector("#feedback-yours"), feedbackPoints: document.querySelector("#feedback-points"),
  nextButton: document.querySelector("#next-button"), resultScore: document.querySelector("#result-score"),
  resultCorrect: document.querySelector("#result-correct"), bestUpdated: document.querySelector("#best-updated"),
  resultList: document.querySelector("#result-list"), retryButton: document.querySelector("#retry-button"),
  topButton: document.querySelector("#top-button"), errorTopButton: document.querySelector("#error-top-button"),
  errorMessage: document.querySelector("#error-message"), version: document.querySelector("#app-version")
};

let allActs = [];
let combisMap = {};
let selectedEra = "all";
let selectedMode = "normal";
let questions = [];
let questionIndex = 0;
let linesShown = 1;
let score = 0;
let correctCount = 0;
let answered = false;
let hardComposing = false;
let suppressHardSubmit = false;
let compositionGuardTimer = null;

function hideFeedback() {
  elements.feedbackBar.hidden = true;
  document.body.classList.remove("has-feedback");
}

function showScreen(screen) {
  if (screen !== elements.question) hideFeedback();
  for (const candidate of elements.screens) candidate.hidden = candidate !== screen;
  window.scrollTo({ top: 0, behavior: "auto" });
}

function bestStorageKey() {
  return `m1tsukami.best.${selectedMode}.${selectedEra}`;
}

function readBest() {
  try {
    let value = localStorage.getItem(bestStorageKey());
    if (value === null && selectedMode === "normal") value = localStorage.getItem(`m1tsukami.best.${selectedEra}`);
    if (value === null) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeBest(value) {
  try {
    localStorage.setItem(bestStorageKey(), String(value));
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
}

function readMode() {
  try {
    return localStorage.getItem("m1tsukami.mode") === "hard" ? "hard" : "normal";
  } catch {
    return "normal";
  }
}

function writeMode() {
  try {
    localStorage.setItem("m1tsukami.mode", selectedMode);
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
}

function updateBestDisplay() {
  const best = readBest();
  elements.bestScore.textContent = best === null ? "ベスト: —" : `ベスト: ${best}点`;
}

function selectSegment(buttons, selectedButton) {
  for (const candidate of buttons) {
    const selected = candidate === selectedButton;
    candidate.classList.toggle("is-selected", selected);
    candidate.setAttribute("aria-pressed", String(selected));
  }
}

function renderLines(count) {
  elements.quoteList.replaceChildren();
  const { lines } = questions[questionIndex].act;
  for (const line of lines.slice(0, count)) {
    const item = document.createElement("li");
    item.className = "quote-card";
    item.textContent = quoteLine(line);
    elements.quoteList.append(item);
  }
}

function keepChoicesInView() {
  const choices = elements.choices.querySelectorAll("button");
  const last = choices[choices.length - 1];
  if (!last || last.getBoundingClientRect().bottom <= window.innerHeight) return;
  last.scrollIntoView({ block: "end", behavior: "auto" });
}

function updateHintStatus() {
  const lineCount = questions[questionIndex].act.lines.length;
  const remaining = Math.max(0, lineCount - linesShown);
  elements.hintButton.disabled = remaining === 0;
  elements.linesLeft.textContent = `あと ${remaining} 行`;
  elements.currentPoints.textContent = `正解で +${pointsFor(linesShown, true)} 点`;
}

function resetHardControls() {
  elements.hardInput.value = "";
  elements.hardInput.disabled = false;
  elements.hardSubmit.disabled = false;
  elements.giveUpButton.disabled = false;
}

function renderQuestion() {
  hideFeedback();
  answered = false;
  linesShown = 1;
  const question = questions[questionIndex];
  elements.progress.textContent = `${questionIndex + 1} / ${questions.length}`;
  elements.runningScore.textContent = `${score}点`;
  renderLines(linesShown);
  updateHintStatus();
  elements.hintArea.hidden = false;
  elements.answerPanel.hidden = true;
  elements.choices.replaceChildren();
  resetHardControls();

  const hardMode = selectedMode === "hard";
  elements.choices.hidden = hardMode;
  elements.hardForm.hidden = !hardMode;
  if (!hardMode) {
    for (const choice of question.choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-button";
      button.textContent = choice;
      button.addEventListener("click", () => answerNormalQuestion(choice, button));
      elements.choices.append(button);
    }
  }

  showScreen(elements.question);
  const focusTarget = hardMode ? elements.hardInput : elements.choices.querySelector("button");
  if (focusTarget) focusTarget.focus();
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

function showFeedback(kind, act, typedAnswer, gained) {
  elements.feedbackStatus.textContent = kind === "giveup" ? "— わからない" : kind === "correct" ? "○ 正解！" : "× 不正解";
  elements.feedbackAnswer.textContent = `正解：${act.combi}`;
  const showTyped = selectedMode === "hard" && typedAnswer.length > 0;
  elements.feedbackYours.hidden = !showTyped;
  elements.feedbackYours.textContent = showTyped ? `あなたの答え：${typedAnswer}` : "";
  elements.feedbackPoints.textContent = `+${gained}点`;
  elements.nextButton.textContent = questionIndex === questions.length - 1 ? "結果を見る" : "次へ";
  elements.feedbackBar.hidden = false;
  document.body.classList.add("has-feedback");
  elements.nextButton.focus();
}

function finishAnswer({ correct, kind, typedAnswer = "", chosenButton = null }) {
  if (answered) return;
  answered = true;
  const { act } = questions[questionIndex];
  const gained = pointsFor(linesShown, correct);
  score += gained;
  if (correct) correctCount += 1;

  if (selectedMode === "normal") {
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
  } else {
    elements.hardInput.disabled = true;
    elements.hardSubmit.disabled = true;
    elements.giveUpButton.disabled = true;
  }

  renderLines(act.lines.length);
  elements.hintArea.hidden = true;
  elements.runningScore.textContent = `${score}点`;
  elements.answerHeading.textContent = correct ? `正解：${act.combi}` : `正解は ${act.combi}`;
  elements.answerMeta.textContent = `${act.year}年 ${roundLabel(act.round)}`;
  elements.gainedPoints.textContent = `獲得：+${gained}点`;
  elements.answerLinks.replaceChildren(makeLink("出典", act.source_url, true));
  if (act.video_url !== null) elements.answerLinks.append(makeLink("公式動画を見る", act.video_url, true));
  elements.answerPanel.hidden = false;
  showFeedback(kind, act, typedAnswer, gained);
}

function answerNormalQuestion(choice, chosenButton) {
  const correct = choice === questions[questionIndex].act.combi;
  finishAnswer({ correct, kind: correct ? "correct" : "incorrect", chosenButton });
}

function answerHardQuestion() {
  const typedAnswer = elements.hardInput.value.trim();
  if (typedAnswer.length === 0) {
    elements.hardInput.focus();
    return;
  }
  const { act } = questions[questionIndex];
  const { correct } = judge(typedAnswer, act.combi, combisMap);
  finishAnswer({ correct, kind: correct ? "correct" : "incorrect", typedAnswer });
}

function startGame() {
  questions = buildRound(filterActs(allActs, selectedEra), Math.random, 10);
  if (questions.length === 0) {
    elements.errorMessage.textContent = "この年代は問題が足りません。別の年代をお試しください。";
    showScreen(elements.error);
    return;
  }
  questionIndex = 0;
  score = 0;
  correctCount = 0;
  renderQuestion();
}

function showResults() {
  hideFeedback();
  const previousBest = readBest();
  const isNewBest = previousBest === null || score > previousBest;
  if (isNewBest) writeBest(score);
  elements.resultScore.textContent = `${score} / ${questions.length * MAX_POINTS}点`;
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

function guardCompositionEnter() {
  suppressHardSubmit = true;
  if (compositionGuardTimer !== null) clearTimeout(compositionGuardTimer);
  compositionGuardTimer = setTimeout(() => {
    suppressHardSubmit = false;
    compositionGuardTimer = null;
  }, 0);
}

elements.eraButtons.forEach((button) => button.addEventListener("click", () => {
  selectedEra = button.dataset.era;
  selectSegment(elements.eraButtons, button);
  updateBestDisplay();
}));

elements.modeButtons.forEach((button) => button.addEventListener("click", () => {
  selectedMode = button.dataset.mode;
  selectSegment(elements.modeButtons, button);
  writeMode();
  updateBestDisplay();
}));

elements.startButton.addEventListener("click", startGame);
elements.hintButton.addEventListener("click", () => {
  const lineCount = questions[questionIndex].act.lines.length;
  if (!answered && linesShown < lineCount) {
    linesShown += 1;
    renderLines(linesShown);
    updateHintStatus();
    if (selectedMode === "hard") elements.hardInput.focus();
    else keepChoicesInView();
  }
});
elements.hardInput.addEventListener("compositionstart", () => { hardComposing = true; });
elements.hardInput.addEventListener("compositionend", () => {
  hardComposing = false;
  guardCompositionEnter();
});
elements.hardInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.isComposing || event.keyCode === 229 || hardComposing || suppressHardSubmit)) {
    event.preventDefault();
    guardCompositionEnter();
  }
});
elements.hardForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (hardComposing || suppressHardSubmit) {
    elements.hardInput.focus();
    return;
  }
  answerHardQuestion();
});
elements.giveUpButton.addEventListener("click", () => {
  finishAnswer({ correct: false, kind: "giveup", typedAnswer: elements.hardInput.value.trim() });
});
elements.nextButton.addEventListener("click", () => {
  hideFeedback();
  if (questionIndex === questions.length - 1) showResults();
  else {
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
    const [actsResponse, combisResponse] = await Promise.all([
      fetch(`data/acts.json?v=${APP_VERSION}`),
      fetch(`data/combis.json?v=${APP_VERSION}`)
    ]);
    if (!actsResponse.ok || !combisResponse.ok) throw new Error(`HTTP ${actsResponse.status}/${combisResponse.status}`);
    const [actsData, combisData] = await Promise.all([actsResponse.json(), combisResponse.json()]);
    if (!Array.isArray(actsData.acts) || !combisData.combis || typeof combisData.combis !== "object") throw new Error("invalid data");
    allActs = actsData.acts;
    combisMap = combisData.combis;
    selectedMode = readMode();
    const selectedModeButton = elements.modeButtons.find((button) => button.dataset.mode === selectedMode);
    if (selectedModeButton) selectSegment(elements.modeButtons, selectedModeButton);
    elements.version.textContent = `v${typeof actsData.version === "string" ? actsData.version : APP_VERSION}`;
    updateBestDisplay();
  } catch {
    elements.errorMessage.textContent = "問題データを読み込めませんでした。ローカルサーバーから開いて、もう一度お試しください。";
    showScreen(elements.error);
  }
}

initialize();
