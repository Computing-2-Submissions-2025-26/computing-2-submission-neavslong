import {
    createGame,
    getBoardSize,
    getDave,
    getPlants,
    getZombies,
    getWalls,
    getExit,
    getMoveCount,
    moveDave,
    resetGame,
    isWon,
    isLost
} from "./game.js";

let state = createGame();

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const moveCountEl = document.getElementById("move-count");

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
        } else if (zombies.some((z) => z.row === r && z.col === c)) {
            cell.className = "cell zombie";
            cell.textContent = "Z";
            cell.setAttribute(
                "aria-label",
                `Zombie at row ${r} col ${c}`
            );
        } else {
            cell.className = "cell empty";
            cell.setAttribute("aria-label", "Empty");
        }
        return cell;
    });

    boardEl.replaceChildren(...cells);

    moveCountEl.textContent = getMoveCount(state);

    if (isWon(state)) {
        statusEl.textContent = "You escaped! Dave wins!";
        statusEl.className = "status won";
    } else if (isLost(state)) {
        statusEl.textContent = "The zombies caught Dave! Game over.";
        statusEl.className = "status lost";
    } else {
        statusEl.textContent = "Playing – guide Dave to the exit!";
        statusEl.className = "status playing";
    }
}

function handleDirection(dir) {
    state = moveDave(state, dir);
    render();
}

document.querySelectorAll("[data-dir]").forEach(function (btn) {
    btn.addEventListener("click", function () {
        handleDirection(btn.dataset.dir);
    });
});

document.getElementById("reset").addEventListener("click", function () {
    state = resetGame();
    render();
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

render();
