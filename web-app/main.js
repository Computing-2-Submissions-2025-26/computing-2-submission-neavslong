import {
    createGame,
    createCampaignGame,
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
const moveCountEl = document.getElementById("move-count");
const homeStreakEl = document.getElementById("home-streak");
const gameStreakEl = document.getElementById("game-streak");
const streakDisplayEl = document.getElementById("streak-display");
const difficultyDisplayEl = document.getElementById("difficulty-display");
const modeRulesEl = document.getElementById("mode-rules");
const resetEl = document.getElementById("reset");

let state = createGame();
let recordedResult = null;
let currentMode = "random";

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
    if (currentMode !== "random") { return; }
    if (isWon(state) && recordedResult !== "won") {
        winStreak += 1;
        recordedResult = "won";
        saveStreak();
    } else if (isLost(state) && recordedResult !== "lost") {
        winStreak = 0;
        recordedResult = "lost";
        saveStreak();
    }
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
            cell.className = "cell dave";
            cell.textContent = "D";
            cell.setAttribute("aria-label", `Dave at row ${r} col ${c}`);
        } else if (r === exit.row && c === exit.col) {
            cell.className = "cell exit";
            cell.textContent = "X";
            cell.setAttribute("aria-label", `Exit at row ${r} col ${c}`);
        } else if (walls.some((w) => w.row === r && w.col === c)) {
            cell.className = "cell wall";
            cell.textContent = "█";
            cell.setAttribute("aria-label", "Wall");
        } else if (plants.some((p) => p.row === r && p.col === c)) {
            cell.className = "cell plant";
            cell.textContent = "P";
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
            cell.textContent = giant ? "G" : "Z";
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

    if (isWon(state)) {
        statusEl.textContent = (
            currentMode === "random"
            ? `You escaped! Win streak: ${winStreak}.`
            : `Difficulty ${getDifficulty(state)} cleared!`
        );
        statusEl.className = "status won";
    } else if (isLost(state)) {
        statusEl.textContent = "The zombies caught Dave! Game over.";
        statusEl.className = "status lost";
    } else {
        statusEl.textContent = "Playing – guide Dave to the exit!";
        statusEl.className = "status playing";
    }
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
        isCampaign ? `Campaign difficulty ${difficulty}` : ""
    );
    modeRulesEl.textContent = (
        isCampaign
        ? campaignRules[difficulty]
        : "Zombies die when they move into plants. Walls block movement."
    );
    resetEl.textContent = (
        isCampaign ? "Restart difficulty" : "New challenge"
    );
}

function handleDirection(dir) {
    if (gameScreenEl.hidden) { return; }
    state = moveDave(state, dir);
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
    recordedResult = null;
    homeScreenEl.hidden = true;
    campaignScreenEl.hidden = true;
    gameScreenEl.hidden = false;
    setGameModeDetails();
    render();
}

function showCampaignMenu() {
    homeScreenEl.hidden = true;
    campaignScreenEl.hidden = false;
    gameScreenEl.hidden = true;
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
    showCampaignMenu
);

document.getElementById("campaign-back").addEventListener(
    "click",
    showMainMenu
);

document.querySelectorAll("[data-difficulty]").forEach(function (button) {
    button.addEventListener("click", function () {
        startCampaign(Number(button.dataset.difficulty));
    });
});

document.getElementById("back-home").addEventListener("click", showMainMenu);

document.querySelectorAll("[data-dir]").forEach(function (btn) {
    btn.addEventListener("click", function () {
        handleDirection(btn.dataset.dir);
    });
});

resetEl.addEventListener("click", function () {
    if (currentMode === "campaign") {
        startCampaign(getDifficulty(state));
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
    const dir = KEY_MAP[e.key];
    if (dir) {
        e.preventDefault();
        handleDirection(dir);
    }
});

renderStreak();
