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
    moveDave,
    resetGame,
    isWon,
    isLost
} from "./game.js";

const STREAK_KEY = "davesEscapeRandomStreak";

const homeScreenEl = document.getElementById("home-screen");
const campaignScreenEl = document.getElementById("campaign-screen");
const gameScreenEl = document.getElementById("game-screen");
const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const statusIconEl = statusEl.querySelector(".status-icon");
const statusTextEl = document.getElementById("status-text");
const moveCountEl = document.getElementById("move-count");
const homeStreakEl = document.getElementById("home-streak");
const gameStreakEl = document.getElementById("game-streak");
const streakDisplayEl = document.getElementById("streak-display");
const difficultyDisplayEl = document.getElementById("difficulty-display");
const modeRulesEl = document.getElementById("mode-rules");
const resetEl = document.getElementById("reset");
const resetTextEl = document.getElementById("reset-text");
const campaignTotalMovesEl = document.getElementById("campaign-total-moves");

let state = createGame();
let recordedResult = null;
let currentMode = "random";
let campaignDifficulty = 1;
let difficultyOneWins = 0;
let campaignTotalMoves = 0;
let campaignAction = "restart";
let nextCampaignDifficulty = 1;
let campaignComplete = false;

function loadStreak() {
    try {
        const stored = Number.parseInt(localStorage.getItem(STREAK_KEY), 10);
        return Number.isFinite(stored) && stored >= 0 ? stored : 0;
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

function recordResult() {
    if (recordedResult !== null) { return; }
    if (currentMode === "random" && isWon(state)) {
        winStreak += 1;
        recordedResult = "won";
        saveStreak();
    } else if (currentMode === "random" && isLost(state)) {
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
        campaignAction = "restart";
    }
}

function makePiece(src, className, alt) {
    const piece = document.createElement("img");
    piece.src = src;
    piece.alt = alt;
    piece.className = `piece ${className}`;
    return piece;
}

function render() {
    const {rows, cols} = getBoardSize(state);
    const dave = getDave(state);
    const exit = getExit(state);
    const plants = getPlants(state);
    const zombies = getZombies(state);
    const walls = getWalls(state);

    boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    boardEl.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    const cells = Array.from({length: rows * cols}).map(function (ignore, i) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const cell = document.createElement("div");
        cell.setAttribute("role", "gridcell");

        if (r === dave.row && c === dave.col) {
            cell.className = "cell dave selected";
            cell.append(makePiece(
                "assets/dave-token.svg",
                "piece-dave",
                "Dave"
            ));
            cell.setAttribute("aria-label", `Dave at row ${r} col ${c}`);
        } else if (r === exit.row && c === exit.col) {
            cell.className = "cell exit exit-tile";
            cell.setAttribute("aria-label", `Exit at row ${r} col ${c}`);
        } else if (walls.some((w) => w.row === r && w.col === c)) {
            cell.className = "cell wall";
            cell.setAttribute("aria-label", "Wall");
        } else if (plants.some((p) => p.row === r && p.col === c)) {
            cell.className = "cell plant";
            cell.append(makePiece(
                "assets/plant-small.svg",
                "piece-plant",
                "Friendly plant"
            ));
            cell.setAttribute("aria-label", `Plant at row ${r} col ${c}`);
        } else if (zombies.some(function (z) {
            const size = z.size || 1;
            return r >= z.row && r < z.row + size &&
                c >= z.col && c < z.col + size;
        })) {
            const zombie = zombies.find(function (z) {
                const size = z.size || 1;
                return r >= z.row && r < z.row + size &&
                    c >= z.col && c < z.col + size;
            });
            const giant = (zombie.size || 1) === 2;
            cell.className = giant ? "cell giant-zombie" : "cell zombie";
            if (!giant || (r === zombie.row && c === zombie.col)) {
                cell.append(makePiece(
                    "assets/zombie-token.svg",
                    "piece-zombie",
                    giant ? "Giant zombie" : "Zombie"
                ));
            }
            cell.setAttribute(
                "aria-label",
                `${giant ? "Giant zombie" : "Zombie"} at row ${r} col ${c}`
            );
        } else {
            cell.className = "cell empty";
            cell.setAttribute("aria-label", "Empty");
        }
        return cell;
    });

    boardEl.replaceChildren(...cells);

    moveCountEl.textContent = getMoveCount(state);
    recordResult();
    renderStreak();
    setGameModeDetails();

    if (isWon(state)) {
        statusTextEl.textContent = (
            currentMode === "random"
            ? `You escaped! Win streak: ${winStreak}.`
            : campaignWinMessage()
        );
        statusIconEl.textContent = "☀";
        statusEl.className = "status won hud-panel";
    } else if (isLost(state)) {
        statusTextEl.textContent = (
            currentMode === "campaign"
            ? "Campaign run ended. Restart from difficulty 1."
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

function campaignWinMessage() {
    if (campaignDifficulty === 1 && difficultyOneWins < 2) {
        return "Difficulty 1 cleared once. Clear it one more time.";
    }
    if (campaignDifficulty === 5) {
        return "Difficulty 5 cleared. Campaign complete!";
    }
    return `Difficulty ${campaignDifficulty} cleared!`;
}

function setGameModeDetails() {
    const difficulty = getDifficulty(state);
    const campaignRules = {
        1: "Two normal zombies. Plants destroy zombies that enter them.",
        2: "Three normal zombies. Plants destroy zombies that enter them.",
        3: "Two crushers. A plant is destroyed and stops the zombie for one turn.",
        4: "Three jumpers. Each zombie can leap over one plant once.",
        5: "Two giant 2×2 zombies. They destroy plants and walls in their path."
    };
    const isCampaign = currentMode === "campaign";
    streakDisplayEl.hidden = isCampaign;
    difficultyDisplayEl.hidden = !isCampaign;
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
        : "Zombies die when they move into plants. Walls block movement."
    );
    if (!isCampaign) {
        resetTextEl.textContent = "New challenge";
    } else if (isWon(state)) {
        resetTextEl.textContent = (
            difficulty === 5 ? "View campaign result" : "Continue campaign"
        );
    } else if (isLost(state)) {
        resetTextEl.textContent = "Restart campaign";
    } else {
        resetTextEl.textContent = "Restart campaign";
    }
}

function animateBoard(className) {
    boardEl.classList.remove("invalid-move", "successful-move");
    void boardEl.offsetWidth;
    boardEl.classList.add(className);
}

function handleDirection(dir) {
    if (gameScreenEl.hidden) { return; }
    const nextState = moveDave(state, dir);
    animateBoard(nextState === state ? "invalid-move" : "successful-move");
    state = nextState;
    render();
}

function startRandomChallenge() {
    currentMode = "random";
    state = resetGame();
    recordedResult = null;
    homeScreenEl.hidden = true;
    campaignScreenEl.hidden = true;
    gameScreenEl.hidden = false;
    setGameModeDetails();
    render();
}

function startCampaign(difficulty) {
    currentMode = "campaign";
    state = createCampaignGame(difficulty);
    campaignDifficulty = difficulty;
    recordedResult = null;
    campaignAction = "restart";
    homeScreenEl.hidden = true;
    campaignScreenEl.hidden = true;
    gameScreenEl.hidden = false;
    setGameModeDetails();
    render();
}

function startNewCampaign() {
    campaignDifficulty = 1;
    difficultyOneWins = 0;
    campaignTotalMoves = 0;
    nextCampaignDifficulty = 1;
    campaignComplete = false;
    startCampaign(1);
}

function continueCampaign() {
    if (campaignComplete) {
        campaignTotalMovesEl.textContent = campaignTotalMoves;
        gameScreenEl.hidden = true;
        campaignScreenEl.hidden = false;
        return;
    }
    startCampaign(nextCampaignDifficulty);
}

function showMainMenu() {
    gameScreenEl.hidden = true;
    campaignScreenEl.hidden = true;
    homeScreenEl.hidden = false;
    renderStreak();
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

document.getElementById("home-title").addEventListener("click", showMainMenu);

document.getElementById("back-home").addEventListener("click", showMainMenu);

document.querySelectorAll("[data-dir]").forEach(function (btn) {
    btn.addEventListener("click", function () {
        handleDirection(btn.dataset.dir);
    });
});

resetEl.addEventListener("click", function () {
    if (currentMode === "campaign") {
        if (campaignAction === "continue") {
            continueCampaign();
        } else {
            startNewCampaign();
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
    if (e.code === "Space" && !e.repeat && homeScreenEl.hidden) {
        e.preventDefault();
        if (currentMode === "campaign") {
            if (campaignAction === "continue") {
                continueCampaign();
            } else {
                startNewCampaign();
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
