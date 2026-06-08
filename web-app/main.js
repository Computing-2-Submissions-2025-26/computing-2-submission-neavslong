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
import {
    MODE2_DIFFICULTY_CONFIG,
    getPlantSkin,
    getZombieAsset
} from "./mode2-visuals.js";

const STREAK_KEY = "davesEscapeRandomStreak";
const CHEAT_CODE = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a"
];

const homeScreenEl = document.getElementById("home-screen");
const campaignScreenEl = document.getElementById("campaign-screen");
const gameScreenEl = document.getElementById("game-screen");
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
const modeRulesEl = document.getElementById("mode-rules");
const resetEl = document.getElementById("reset");
const resetTextEl = document.getElementById("reset-text");
const campaignTotalMovesEl = document.getElementById("campaign-total-moves");
const winOverlayEl = document.getElementById("win-overlay");
const loseOverlayEl = document.getElementById("lose-overlay");

let state = createGame();
let recordedResult = null;
let currentMode = "random";
let campaignDifficulty = 1;
let difficultyOneWins = 0;
let campaignTotalMoves = 0;
let campaignAction = "restart";
let nextCampaignDifficulty = 1;
let campaignComplete = false;
let cheatCodeIndex = 0;

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

function makePiece(src, className, alt, skinClass = "") {
    const piece = document.createElement("img");
    piece.src = src;
    piece.alt = alt;
    piece.className = `piece ${className} ${skinClass}`.trim();
    return piece;
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

    configureScene();
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
            const cactusWall = isCampaign &&
                getDifficulty(state) === 5 &&
                (r + c) % 2 === 0;
            cell.className = cactusWall ? "cell wall cactus-wall" : "cell wall";
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
            cell.className = "cell plant";
            cell.append(makePiece(
                (
                    isCampaign
                    ? plantSkin.asset
                    : "assets/plant-small.svg"
                ),
                "piece-plant",
                "Friendly plant",
                isCampaign ? `skin-plant-${plantSkin.id}` : ""
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
            const giantAnchor = giant &&
                r === zombie.row &&
                c === zombie.col;
            cell.className = (
                giant
                ? `cell giant-zombie ${
                    giantAnchor ? "giant-anchor" : "giant-body"
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
                    giant ? "Giant zombie" : "Zombie",
                    isCampaign ? `skin-zombie-${zombie.skinId}` : ""
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

        if (isCampaign && getDifficulty(state) === 3 && (r === 3 || r === 4)) {
            cell.classList.add("pool-cell");
            if (cell.classList.contains("dave") ||
                    cell.classList.contains("zombie")) {
                cell.classList.add("swimming-piece");
            }
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
        if (currentMode === "campaign") {
            winOverlayEl.hidden = false;
            loseOverlayEl.hidden = true;
        }
    } else if (isLost(state)) {
        statusTextEl.textContent = (
            currentMode === "campaign"
            ? "Campaign run ended. Restart from difficulty 1."
            : "The zombies caught Dave! Game over."
        );
        statusIconEl.textContent = "🧠";
        statusEl.className = "status lost hud-panel";
        if (currentMode === "campaign") {
            loseOverlayEl.hidden = false;
            winOverlayEl.hidden = true;
        }
    } else {
        statusTextEl.textContent = "Playing - guide Dave to the exit!";
        statusIconEl.textContent = "🍃";
        statusEl.className = "status playing hud-panel";
    }
}

function hideMode2Overlays() {
    winOverlayEl.hidden = true;
    loseOverlayEl.hidden = true;
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

function clearCurrentCampaignLevel() {
    state = Object.assign({}, state, {
        status: "won",
        turn: "player"
    });
    recordedResult = null;
    render();
}

function trackCheatCode(key) {
    const expected = CHEAT_CODE[cheatCodeIndex];
    if (key === expected) {
        cheatCodeIndex += 1;
    } else {
        cheatCodeIndex = key === CHEAT_CODE[0] ? 1 : 0;
    }

    if (cheatCodeIndex === CHEAT_CODE.length) {
        cheatCodeIndex = 0;
        return true;
    }
    return false;
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
    cheatCodeIndex = 0;
    state = resetGame();
    hideMode2Overlays();
    recordedResult = null;
    homeScreenEl.hidden = true;
    campaignScreenEl.hidden = true;
    gameScreenEl.hidden = false;
    setGameModeDetails();
    render();
}

function startCampaign(difficulty) {
    currentMode = "campaign";
    cheatCodeIndex = 0;
    state = createCampaignGame(difficulty);
    hideMode2Overlays();
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
    cheatCodeIndex = 0;
    hideMode2Overlays();
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

document.getElementById("win-continue").addEventListener("click", function () {
    hideMode2Overlays();
    continueCampaign();
});

document.getElementById("lose-retry").addEventListener("click", function () {
    hideMode2Overlays();
    startNewCampaign();
});

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
    const cheatKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (
        currentMode === "campaign" &&
        !gameScreenEl.hidden &&
        !isWon(state) &&
        trackCheatCode(cheatKey)
    ) {
        e.preventDefault();
        clearCurrentCampaignLevel();
        return;
    }

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
