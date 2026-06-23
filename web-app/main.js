import {
    createGame,
    createCampaignGame,
    advanceCampaignProgress,
    getBoardSize,
    getDave,
    getPlants,
    getZombies,
    getWalls,
    getExit,
    getMoveCount,
    getDifficulty,
    getSelectedUnit,
    selectUnit,
    moveSelectedUnit,
    resetGame,
    isWon,
    isLost
} from "./game.js";
import {
    MODE2_DIFFICULTY_CONFIG,
    assignRandomPlantSkins,
    assignZombieSkins,
    getPlantSkin,
    getZombieAsset
} from "./mode2-visuals.js";

const STREAK_KEY = "davesEscapeRandomStreak";
const homeScreenEl = document.getElementById("home-screen");
const campaignScreenEl = document.getElementById("campaign-screen");
const gameScreenEl = document.getElementById("game-screen");
const siteHeaderEl = document.querySelector(".site-header");
const mode2SceneEl = document.getElementById("mode2-scene");
const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const statusIconEl = statusEl.querySelector(".status-icon");
const statusTextEl = document.getElementById("status-text");
const moveCountEl = document.getElementById("move-count");
const homeStreakEl = document.getElementById("home-streak");
const gameStreakEl = document.getElementById("game-streak");
const streakDisplayEl = document.getElementById("streak-display");
const difficultyDisplayEl = document.getElementById("difficulty-display");
const campaignProgressEl = document.getElementById("campaign-progress");
const modeRulesEl = document.getElementById("mode-rules");
const resetEl = document.getElementById("reset");
const resetTextEl = document.getElementById("reset-text");
const campaignTotalMovesEl = document.getElementById("campaign-total-moves");
const winOverlayEl = document.getElementById("win-overlay");
const loseOverlayEl = document.getElementById("lose-overlay");
const winTitleEl = document.getElementById("win-title");
const winSubtitleEl = document.getElementById("win-subtitle");
const winContinueEl = document.getElementById("win-continue");
const loseTitleEl = document.getElementById("lose-title");
const loseSummaryEl = document.getElementById("lose-summary");
const loseRetryEl = document.getElementById("lose-retry");

let state = createGame();
let recordedResult = null;
let currentMode = "random";
let lastRandomStreak = 0;
let campaignDifficulty = 1;
let difficultyOneWins = 0;
let campaignTotalMoves = 0;
let campaignAction = "restart";
let nextCampaignDifficulty = 1;
let campaignComplete = false;
let renderEndOverlay;
let campaignWinMessage;
let nextLevelHint;
let setGameModeDetails;
let renderCampaignProgress;
let startRandomChallenge;
let startCampaign;
let continueCampaign;

function loadStreak() {
    try {
        const stored = Number.parseInt(localStorage.getItem(STREAK_KEY), 10);
        return (
            (Number.isFinite(stored) && stored >= 0)
            ? stored
            : 0
        );
    } catch (ignore) {
        return 0;
    }
}

let winStreak = loadStreak();

function saveStreak() {
    try {
        localStorage.setItem(STREAK_KEY, String(winStreak));
    } catch (ignore) {
        // The game still works when storage is unavailable.
    }
}

function renderStreak() {
    homeStreakEl.textContent = winStreak;
    gameStreakEl.textContent = winStreak;
}

function setScreen(screenName) {
    document.body.classList.toggle("is-playing", screenName !== "home");
    homeScreenEl.hidden = screenName !== "home";
    gameScreenEl.hidden = screenName !== "game";
    campaignScreenEl.hidden = screenName !== "campaign-complete";
}

function recordResult() {
    if (recordedResult !== null) {
        return;
    }
    if (currentMode === "random" && isWon(state)) {
        winStreak += 1;
        lastRandomStreak = winStreak;
        recordedResult = "won";
        saveStreak();
    } else if (currentMode === "random" && isLost(state)) {
        lastRandomStreak = winStreak;
        winStreak = 0;
        recordedResult = "lost";
        saveStreak();
    } else if (currentMode === "campaign" && isWon(state)) {
        const progress = advanceCampaignProgress({
            difficulty: campaignDifficulty,
            difficultyOneWins,
            totalMoves: campaignTotalMoves
        }, getMoveCount(state));
        difficultyOneWins = progress.difficultyOneWins;
        campaignTotalMoves = progress.totalMoves;
        nextCampaignDifficulty = progress.difficulty;
        campaignComplete = progress.complete;
        recordedResult = "won";
        campaignAction = "continue";
    } else if (currentMode === "campaign" && isLost(state)) {
        recordedResult = "lost";
        campaignAction = "retry";
    }
}

function makePiece(src, className, alt, skinClass = "") {
    const piece = document.createElement("img");
    const pieceClassName = "piece " + className + " " + skinClass;
    piece.src = src;
    piece.alt = alt;
    piece.className = pieceClassName.trim();
    return piece;
}

function decorateCampaignState(gameState) {
    return Object.assign({}, gameState, {
        plants: assignRandomPlantSkins(getPlants(gameState)),
        zombies: assignZombieSkins(
            getZombies(gameState),
            getDifficulty(gameState)
        )
    });
}

function configureScene() {
    const isCampaign = currentMode === "campaign";
    mode2SceneEl.className = "mode2-scene";
    if (!isCampaign) {
        mode2SceneEl.style.removeProperty("--scene-background");
        return;
    }
    const difficulty = getDifficulty(state);
    const config = MODE2_DIFFICULTY_CONFIG[difficulty];
    mode2SceneEl.classList.add(`difficulty-${difficulty}`);
    mode2SceneEl.style.setProperty(
        "--scene-background",
        `url("${config.background}")`
    );
}

function render() {
    const {rows, cols} = getBoardSize(state);
    const dave = getDave(state);
    const exit = getExit(state);
    const plants = getPlants(state);
    const zombies = getZombies(state);
    const walls = getWalls(state);
    const isCampaign = currentMode === "campaign";
    const selectedUnitId = getSelectedUnit(state);

    configureScene();
    boardEl.style.setProperty("--board-cols", cols);
    boardEl.style.setProperty("--board-rows", rows);

    const cells = Array.from({length: rows * cols}).map(function (ignore, i) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const cell = document.createElement("div");
        cell.setAttribute("role", "gridcell");

        if (r === dave.row && c === dave.col) {
            cell.className = (
                selectedUnitId === "dave"
                ? "cell dave selected"
                : "cell dave"
            );
            cell.dataset.unitId = "dave";
            cell.tabIndex = 0;
            cell.setAttribute("aria-selected", selectedUnitId === "dave");
            cell.append(makePiece(
                (
                    isCampaign
                    ? "assets/characters/dave-pot.svg"
                    : "assets/dave-token.svg"
                ),
                "piece-dave",
                "Dave"
            ));
            cell.setAttribute("aria-label", `Dave at row ${r} col ${c}`);
        } else if (r === exit.row && c === exit.col) {
            cell.className = "cell exit exit-tile";
            cell.setAttribute("aria-label", `Exit at row ${r} col ${c}`);
        } else if (walls.some((w) => w.row === r && w.col === c)) {
            const cactusWall = (
                isCampaign &&
                getDifficulty(state) === 5 &&
                (r + c) % 2 === 0
            );
            cell.className = (
                cactusWall
                ? "cell wall cactus-wall"
                : "cell wall"
            );
            if (cactusWall) {
                cell.append(makePiece(
                    "assets/characters/plants/cactus-wall.svg",
                    "piece-cactus",
                    "Cactus obstacle"
                ));
            }
            cell.setAttribute("aria-label", "Wall");
        } else if (plants.some((p) => p.row === r && p.col === c)) {
            const plant = plants.find((p) => p.row === r && p.col === c);
            const plantSkin = getPlantSkin(plant.skinId);
            cell.className = (
                selectedUnitId === plant.id
                ? "cell plant selected"
                : "cell plant"
            );
            cell.dataset.unitId = plant.id;
            cell.tabIndex = 0;
            cell.setAttribute("aria-selected", selectedUnitId === plant.id);
            cell.append(makePiece(
                (
                    isCampaign
                    ? plantSkin.asset
                    : "assets/plant-small.svg"
                ),
                "piece-plant",
                "Friendly plant",
                (
                    isCampaign
                    ? `skin-plant-${plantSkin.id}`
                    : ""
                )
            ));
            cell.setAttribute("aria-label", `Plant at row ${r} col ${c}`);
        } else if (zombies.some(function (z) {
            const size = z.size || 1;
            return (
                r >= z.row && r < z.row + size &&
                c >= z.col && c < z.col + size
            );
        })) {
            const zombie = zombies.find(function (z) {
                const size = z.size || 1;
                return (
                    r >= z.row && r < z.row + size &&
                    c >= z.col && c < z.col + size
                );
            });
            const giant = (zombie.size || 1) === 2;
            const giantAnchor = (
                giant &&
                r === zombie.row &&
                c === zombie.col
            );
            cell.className = (
                giant
                ? `cell giant-zombie ${
                    (
                        giantAnchor
                        ? "giant-anchor"
                        : "giant-body"
                    )
                }`
                : "cell zombie"
            );
            if (!giant || giantAnchor) {
                cell.append(makePiece(
                    (
                        isCampaign
                        ? getZombieAsset(zombie.skinId)
                        : "assets/zombie-token.svg"
                    ),
                    "piece-zombie",
                    (
                        giant
                        ? "Giant zombie"
                        : "Zombie"
                    ),
                    (
                        isCampaign
                        ? `skin-zombie-${zombie.skinId}`
                        : ""
                    )
                ));
            }
            const zombieLabel = (
                giant
                ? "Giant zombie"
                : "Zombie"
            );
            cell.setAttribute(
                "aria-label",
                `${zombieLabel} at row ${r} col ${c}`
            );
        } else {
            cell.className = "cell empty";
            cell.setAttribute("aria-label", "Empty");
        }

        if (isCampaign && getDifficulty(state) === 3 && (r === 3 || r === 4)) {
            cell.classList.add("pool-cell");
            if (
                cell.classList.contains("dave") ||
                cell.classList.contains("zombie")
            ) {
                cell.classList.add("swimming-piece");
            }
        }
        return cell;
    });

    const boardRows = Array.from(
        new Array(rows).keys()
    ).map(function (rowIndex) {
        const rowEl = document.createElement("div");
        const firstCell = rowIndex * cols;
        rowEl.className = "board-row";
        rowEl.setAttribute("role", "row");
        rowEl.append(...cells.slice(firstCell, firstCell + cols));
        return rowEl;
    });

    boardEl.replaceChildren(...boardRows);

    moveCountEl.textContent = getMoveCount(state);
    recordResult();
    renderStreak();
    setGameModeDetails();
    renderCampaignProgress();
    renderEndOverlay();

    if (isWon(state)) {
        statusTextEl.textContent = (
            currentMode === "random"
            ? (
                `You escaped! Win streak: ${winStreak}. ` +
                "Press Space for the next challenge."
            )
            : `${campaignWinMessage()} ${nextLevelHint()}`
        );
        statusIconEl.textContent = "☀";
        statusEl.className = "status won hud-panel";
    } else if (isLost(state)) {
        statusTextEl.textContent = (
            currentMode === "campaign"
            ? `Difficulty ${campaignDifficulty} failed. Retry this checkpoint.`
            : "The zombies caught Dave! Game over."
        );
        statusIconEl.textContent = "🧠";
        statusEl.className = "status lost hud-panel";
    } else {
        statusTextEl.textContent = "Playing - guide Dave to the exit!";
        statusIconEl.textContent = "🍃";
        statusEl.className = "status playing hud-panel";
    }
}

function hideEndOverlays() {
    winOverlayEl.hidden = true;
    loseOverlayEl.hidden = true;
    gameScreenEl.inert = false;
    siteHeaderEl.inert = false;
}

function showEndOverlay(overlay, actionButton) {
    const isOpening = overlay.hidden;
    overlay.hidden = false;
    gameScreenEl.inert = true;
    siteHeaderEl.inert = true;
    if (isOpening) {
        actionButton.focus();
    }
}

function focusSelectedUnit() {
    const selectedCell = boardEl.querySelector("[aria-selected=\"true\"]");
    if (selectedCell) {
        selectedCell.focus();
    }
}

renderEndOverlay = function () {
    if (isWon(state)) {
        loseOverlayEl.hidden = true;
        if (currentMode === "random") {
            winTitleEl.textContent = "Challenge Complete!";
            winSubtitleEl.textContent = (
                `Win streak: ${winStreak}. ` +
                "Press Space for the next challenge."
            );
            winContinueEl.textContent = "Next challenge";
        } else {
            winTitleEl.textContent = "Level Complete!";
            winSubtitleEl.textContent = (
                `${campaignWinMessage()} ${nextLevelHint()}`
            );
            winContinueEl.textContent = (
                campaignComplete
                ? "View campaign result"
                : "Continue"
            );
        }
        showEndOverlay(winOverlayEl, winContinueEl);
    } else if (isLost(state)) {
        winOverlayEl.hidden = true;
        if (currentMode === "random") {
            loseTitleEl.innerHTML = "STREAK<br>ENDED!";
            loseSummaryEl.textContent = (
                lastRandomStreak === 0
                ? "The zombies caught Dave before a streak could start."
                : lastRandomStreak === 1
                ? "You escaped once before the zombies caught Dave."
                : (
                    `You escaped ${lastRandomStreak} times before ` +
                    "the zombies caught Dave."
                )
            );
            loseRetryEl.textContent = "New challenge";
        } else {
            loseTitleEl.innerHTML = "COMPUTING 2<br>ATE YOUR TOKENS!";
            loseSummaryEl.textContent = (
                `Retry difficulty ${campaignDifficulty}.`
            );
            loseRetryEl.textContent = "Try Again";
        }
        showEndOverlay(loseOverlayEl, loseRetryEl);
    } else {
        hideEndOverlays();
    }
};

campaignWinMessage = function () {
    if (campaignDifficulty === 1 && difficultyOneWins < 2) {
        return "Difficulty 1 cleared once. Clear it one more time.";
    }
    if (campaignDifficulty === 5) {
        return "Difficulty 5 cleared. Campaign complete!";
    }
    return `Difficulty ${campaignDifficulty} cleared!`;
};

nextLevelHint = function () {
    return (
        campaignComplete
        ? "Press Space to view your campaign result."
        : "Press Space for the next level."
    );
};

setGameModeDetails = function () {
    const difficulty = getDifficulty(state);
    const turnRule = "Every valid Dave or plant move gives zombies a turn.";
    const campaignRules = {
        "1": (
            `${turnRule} Two normal zombies. ` +
            "Plants destroy zombies that enter them."
        ),
        "2": (
            `${turnRule} Three normal zombies. ` +
            "Plants destroy zombies that enter them."
        ),
        "3": (
            `${turnRule} Two crushers. ` +
            "A plant is destroyed and stops the zombie for one turn."
        ),
        "4": (
            `${turnRule} Three jumpers. ` +
            "Each zombie can leap over one plant once."
        ),
        "5": (
            `${turnRule} Two giant 2×2 zombies. ` +
            "They destroy plants and walls in their path."
        )
    };
    const isCampaign = currentMode === "campaign";
    streakDisplayEl.hidden = isCampaign;
    difficultyDisplayEl.hidden = !isCampaign;
    campaignProgressEl.hidden = !isCampaign;
    difficultyDisplayEl.textContent = (
        isCampaign
        ? (
            difficulty === 1
            ? `Difficulty 1 · ${difficultyOneWins}/2 clears`
            : `Campaign difficulty ${difficulty}`
        )
        : ""
    );
    modeRulesEl.textContent = (
        isCampaign
        ? campaignRules[difficulty]
        : (
            `${turnRule} Put plants into zombie paths. ` +
            "Walls block movement. Dave loses when a zombie reaches " +
            "an adjacent space."
        )
    );
    if (!isCampaign) {
        resetTextEl.textContent = "New challenge";
    } else if (isWon(state)) {
        resetTextEl.textContent = (
            difficulty === 5
            ? "View campaign result"
            : "Continue campaign"
        );
    } else if (isLost(state)) {
        resetTextEl.textContent = `Retry difficulty ${campaignDifficulty}`;
    } else {
        resetTextEl.textContent = `Retry difficulty ${campaignDifficulty}`;
    }
};

renderCampaignProgress = function () {
    const isCampaign = currentMode === "campaign";
    if (!isCampaign) {
        return;
    }
    campaignProgressEl.querySelectorAll("li").forEach(function (step) {
        const level = Number(step.dataset.step);
        step.className = "";
        step.removeAttribute("aria-current");
        if (level < campaignDifficulty) {
            step.classList.add("complete");
        } else if (level === campaignDifficulty) {
            step.classList.add("current");
            step.setAttribute("aria-current", "step");
        } else {
            step.classList.add("locked");
        }
        if (
            level === 1 &&
            difficultyOneWins === 1 &&
            campaignDifficulty === 1
        ) {
            step.textContent = "D1 1/2";
        } else {
            step.textContent = `D${level}`;
        }
    });
};

function animateBoard(className) {
    boardEl.classList.remove("invalid-move", "successful-move");
    boardEl.getBoundingClientRect();
    boardEl.classList.add(className);
}

function handleWinContinue() {
    hideEndOverlays();
    if (currentMode === "campaign") {
        continueCampaign();
    } else {
        startRandomChallenge();
    }
}

function handleLoseRetry() {
    hideEndOverlays();
    if (currentMode === "campaign") {
        startCampaign(campaignDifficulty);
    } else {
        startRandomChallenge();
    }
}

function handleDirection(dir) {
    if (gameScreenEl.hidden) {
        return;
    }
    const nextState = moveSelectedUnit(state, dir);
    const animationClass = (
        nextState === state
        ? "invalid-move"
        : "successful-move"
    );
    animateBoard(animationClass);
    state = nextState;
    render();
}

function handleSelectUnit(unitId) {
    const nextState = selectUnit(state, unitId);
    if (nextState === state) {
        return;
    }
    state = nextState;
    render();
}

startRandomChallenge = function () {
    currentMode = "random";
    state = resetGame();
    hideEndOverlays();
    recordedResult = null;
    setScreen("game");
    setGameModeDetails();
    render();
    focusSelectedUnit();
};

startCampaign = function (difficulty) {
    currentMode = "campaign";
    state = decorateCampaignState(createCampaignGame(difficulty));
    hideEndOverlays();
    campaignDifficulty = difficulty;
    recordedResult = null;
    campaignAction = "restart";
    setScreen("game");
    setGameModeDetails();
    render();
    focusSelectedUnit();
};

function startNewCampaign() {
    campaignDifficulty = 1;
    difficultyOneWins = 0;
    campaignTotalMoves = 0;
    nextCampaignDifficulty = 1;
    campaignComplete = false;
    startCampaign(1);
}

continueCampaign = function () {
    if (campaignComplete) {
        campaignTotalMovesEl.textContent = campaignTotalMoves;
        setScreen("campaign-complete");
        document.getElementById("campaign-restart").focus();
        return;
    }
    startCampaign(nextCampaignDifficulty);
};

function showMainMenu() {
    hideEndOverlays();
    setScreen("home");
    renderStreak();
    document.getElementById("random-mode").focus();
}

document.getElementById("random-mode").addEventListener(
    "click",
    startRandomChallenge
);

document.getElementById("campaign-mode").addEventListener(
    "click",
    startNewCampaign
);

document.getElementById("campaign-back").addEventListener(
    "click",
    showMainMenu
);

document.getElementById("campaign-restart").addEventListener(
    "click",
    startNewCampaign
);

document.getElementById("win-continue").addEventListener("click", function () {
    handleWinContinue();
});

loseRetryEl.addEventListener("click", handleLoseRetry);

document.getElementById("home-title").addEventListener("click", showMainMenu);

document.getElementById("back-home").addEventListener("click", showMainMenu);

document.querySelectorAll("[data-dir]").forEach(function (btn) {
    btn.addEventListener("click", function () {
        handleDirection(btn.dataset.dir);
    });
});

boardEl.addEventListener("click", function (event) {
    const cell = event.target.closest("[data-unit-id]");
    if (!cell || !boardEl.contains(cell)) {
        return;
    }
    handleSelectUnit(cell.dataset.unitId);
});

boardEl.addEventListener("keydown", function (event) {
    const cell = event.target.closest("[data-unit-id]");
    if (!cell || !boardEl.contains(cell)) {
        return;
    }
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleSelectUnit(cell.dataset.unitId);
    }
});

resetEl.addEventListener("click", function () {
    if (currentMode === "campaign") {
        if (campaignAction === "continue") {
            continueCampaign();
        } else {
            startCampaign(campaignDifficulty);
        }
    } else {
        startRandomChallenge();
    }
});

const KEY_MAP = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right"
};

document.addEventListener("keydown", function (e) {
    if (!winOverlayEl.hidden || !loseOverlayEl.hidden) {
        return;
    }
    if (e.code === "Space" && !e.repeat && homeScreenEl.hidden) {
        e.preventDefault();
        if (currentMode === "campaign") {
            if (campaignAction === "continue") {
                continueCampaign();
            } else {
                startCampaign(campaignDifficulty);
            }
        } else {
            startRandomChallenge();
        }
        return;
    }

    const dir = KEY_MAP[e.key];
    if (dir) {
        e.preventDefault();
        handleDirection(dir);
    }
});

renderStreak();
