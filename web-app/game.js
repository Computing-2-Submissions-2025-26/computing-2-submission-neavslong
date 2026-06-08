/**
 * @module game
 * Dave's Escape – a turn-based rescue puzzle.
 * An 8×8 board is randomly generated each game.
 * Dave (D) must reach the Exit (X) before Zombies (Z) become adjacent.
 * Plants (P) destroy zombies that move into them.
 * Walls (█) are permanent obstacles.
 */

/** Direction vectors in AI priority order: up, right, down, left. */
const DIRS = [
    {name: "up",    dr: -1, dc:  0},
    {name: "right", dr:  0, dc:  1},
    {name: "down",  dr:  1, dc:  0},
    {name: "left",  dr:  0, dc: -1}
];

const posEq = (a, b) => a.row === b.row && a.col === b.col;
const manhattan = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

/**
 * Creates a seeded linear-congruential pseudo-random number generator.
 * If no seed is supplied a random seed is chosen via Math.random().
 * @param {number} [seed]
 * @returns {function(): number} Returns floats in [0, 1).
 */
const makePrng = function (seed) {
    const M = 4294967296;
    let s = (
        seed === undefined
        ? Math.floor(Math.random() * M)
        : Math.floor(Math.abs(seed))
    ) % M;
    return function () {
        s = (s * 1664525 + 1013904223) % M;
        return s / M;
    };
};

/**
 * Checks whether Dave can reach the exit via BFS.
 * Only walls are permanent obstacles; plants and zombies are treated as
 * passable (plants can be moved; zombies move on their own).
 * @param {object} state
 * @returns {boolean}
 */
const hasPathToExit = function (state) {
    const {rows, cols, dave, exit, walls} = state;
    const wallKeys = new Set(walls.map((w) => `${w.row},${w.col}`));
    const visited = new Set();
    visited.add(`${dave.row},${dave.col}`);

    // Recursive BFS – avoids functions-inside-loops (JSLint rule).
    const step = function (queue) {
        if (queue.length === 0) { return false; }
        const pos = queue[0];
        const rest = queue.slice(1);
        if (pos.row === exit.row && pos.col === exit.col) { return true; }
        const neighbours = DIRS.reduce(function (acc, dir) {
            const n = {row: pos.row + dir.dr, col: pos.col + dir.dc};
            if (n.row < 0 || n.row >= rows) { return acc; }
            if (n.col < 0 || n.col >= cols) { return acc; }
            const key = `${n.row},${n.col}`;
            if (visited.has(key) || wallKeys.has(key)) { return acc; }
            visited.add(key);
            return acc.concat([n]);
        }, []);
        return step(rest.concat(neighbours));
    };

    return step([{row: dave.row, col: dave.col}]);
};

/**
 * Generates a random playable 8×8 level.
 *
 * Algorithm:
 *   1. Place Dave in rows 5–7, exit on row 0, different columns.
 *   2. Reserve an L-shaped corridor (Dave's column up, then row 0 across)
 *      so at least one route always exists after wall placement.
 *   3. Scatter walls, plants, and zombies only on non-reserved cells.
 *   4. Verify reachability with BFS; retry up to 20 times if blocked.
 *   5. Fall back to a fixed level if no attempt succeeds.
 *
 * @param {number} [seed] - Optional seed for reproducible levels.
 * @returns {object} A valid initial game state.
 */
const generatePlayableLevel = function (seed) {
    const ROWS = 8;
    const COLS = 8;
    const rng = makePrng(seed);
    const ri = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

    // Fisher-Yates shuffle via reduce – no for loops
    const shuffle = function (arr) {
        return arr.reduce(function (acc, ignored, i) {
            const j = Math.floor(rng() * (i + 1));
            const copy = acc.slice();
            const tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
            return copy;
        }, arr.slice());
    };

    // All board cell positions as a flat array (built once)
    const allCells = Array.from(
        {length: ROWS * COLS},
        function (ignored, i) {
            return {row: Math.floor(i / COLS), col: i % COLS};
        }
    );

    const FALLBACK = {
        rows: 8,
        cols: 8,
        dave: {row: 7, col: 2},
        exit: {row: 0, col: 5},
        plants: [
            {id: "p1", row: 3, col: 1},
            {id: "p2", row: 3, col: 6},
            {id: "p3", row: 5, col: 4}
        ],
        zombies: [
            {id: "z1", row: 1, col: 1},
            {id: "z2", row: 1, col: 6}
        ],
        walls: [
            {row: 0, col: 0}, {row: 0, col: 7},
            {row: 2, col: 3}, {row: 2, col: 4},
            {row: 4, col: 2}, {row: 4, col: 5},
            {row: 6, col: 0}, {row: 6, col: 7},
            {row: 7, col: 0}, {row: 7, col: 7}
        ],
        selectedUnitId: "dave",
        status: "playing",
        turn: "player",
        moveCount: 0
    };

    // Recursive attempt loop – avoids for loops entirely
    const tryBuild = function (attemptsLeft) {
        if (attemptsLeft === 0) { return FALLBACK; }

        const daveRow = ri(5, 7);
        const daveCol = ri(1, 6);
        let exitCol = ri(0, COLS - 1);
        if (exitCol === daveCol) {
            exitCol = (exitCol + 1 + Math.floor(rng() * (COLS - 1))) % COLS;
        }

        const dave = {row: daveRow, col: daveCol};
        const exit = {row: 0, col: exitCol};

        // L-shaped reserved path: up Dave's column then across row 0
        const colKeys = Array.from(
            {length: daveRow + 1},
            function (ignored, r) { return `${r},${daveCol}`; }
        );
        const minC = Math.min(daveCol, exitCol);
        const rowKeys = Array.from(
            {length: Math.abs(daveCol - exitCol) + 1},
            function (ignored, i) { return `0,${minC + i}`; }
        );
        const reserved = new Set(colKeys.concat(rowKeys));

        const daveKey = `${daveRow},${daveCol}`;
        const exitKey = `0,${exitCol}`;

        // Shuffle all cells not on the reserved path or taken by Dave/exit
        const free = allCells.filter(function (c) {
            const key = `${c.row},${c.col}`;
            return key !== daveKey && key !== exitKey && !reserved.has(key);
        });
        const shuffled = shuffle(free);

        const nWalls = ri(8, 12);
        const nPlants = ri(3, 5);
        const nZombies = ri(2, 3);

        const walls = shuffled.slice(0, nWalls);
        const afterWalls = shuffled.slice(nWalls);

        const plants = afterWalls.slice(0, nPlants).map(function (c, i) {
            return {id: `p${i + 1}`, row: c.row, col: c.col};
        });

        const topHalf = afterWalls.slice(nPlants).filter(function (c) {
            return c.row < Math.floor(ROWS / 2);
        });
        const zombies = topHalf.slice(0, nZombies).map(function (c, i) {
            return {id: `z${i + 1}`, row: c.row, col: c.col};
        });

        const candidate = {
            rows: ROWS,
            cols: COLS,
            dave,
            exit,
            plants,
            zombies,
            walls,
            selectedUnitId: "dave",
            status: "playing",
            turn: "player",
            moveCount: 0
        };

        if (hasPathToExit(candidate)) { return candidate; }
        return tryBuild(attemptsLeft - 1);
    };

    return tryBuild(20);
};

/**
 * Creates a new game state with a freshly generated level.
 * @returns {object} Initial game state.
 */
const createGame = () => generatePlayableLevel();

/**
 * Returns the board dimensions.
 * @param {object} state
 * @returns {{ rows: number, cols: number }}
 */
const getBoardSize = (state) => ({rows: state.rows, cols: state.cols});

/**
 * Returns Dave's current position.
 * @param {object} state
 * @returns {{ row: number, col: number }}
 */
const getDave = (state) => state.dave;

/**
 * Returns all plant positions.
 * @param {object} state
 * @returns {Array<{ id: string, row: number, col: number }>}
 */
const getPlants = (state) => state.plants;

/**
 * Returns all zombie positions.
 * @param {object} state
 * @returns {Array<{ id: string, row: number, col: number }>}
 */
const getZombies = (state) => state.zombies;

/**
 * Returns all wall positions.
 * @param {object} state
 * @returns {Array<{ row: number, col: number }>}
 */
const getWalls = (state) => state.walls;

/**
 * Returns the exit position.
 * @param {object} state
 * @returns {{ row: number, col: number }}
 */
const getExit = (state) => state.exit;

/**
 * Returns the current game status.
 * @param {object} state
 * @returns {"playing" | "won" | "lost"}
 */
const getStatus = (state) => state.status;

/**
 * Returns whose turn it is.
 * @param {object} state
 * @returns {"player" | "zombie"}
 */
const getTurn = (state) => state.turn;

/**
 * Returns the number of player moves made.
 * @param {object} state
 * @returns {number}
 */
const getMoveCount = (state) => state.moveCount;

/**
 * Returns the id of the currently selected unit ("dave" or a plant id).
 * @param {object} state
 * @returns {string}
 */
const getSelectedUnit = (state) => state.selectedUnitId;

/**
 * Returns all units the player may select: Dave and every plant.
 * @param {object} state
 * @returns {Array<{ id: string, row: number, col: number }>}
 */
const getSelectableUnits = function (state) {
    const daveUnit = {id: "dave", row: state.dave.row, col: state.dave.col};
    return [daveUnit].concat(state.plants);
};

/**
 * Returns a new state with the selected unit changed.
 * Only "dave" or an existing plant id are valid selections.
 * Returns the unchanged state if the id is unknown or the game is over.
 * @param {object} state
 * @param {string} unitId
 * @returns {object}
 */
const selectUnit = function (state, unitId) {
    if (state.status !== "playing") { return state; }
    const valid = unitId === "dave" ||
        state.plants.some((p) => p.id === unitId);
    if (!valid) { return state; }
    return Object.assign({}, state, {selectedUnitId: unitId});
};

/**
 * Returns true if the position is inside the board.
 * @param {object} state
 * @param {{ row: number, col: number }} position
 * @returns {boolean}
 */
const isInsideBoard = (state, position) =>
    position.row >= 0 &&
    position.row < state.rows &&
    position.col >= 0 &&
    position.col < state.cols;

/**
 * Returns true if the cell is occupied by Dave, a plant, a zombie, or a wall.
 * The exit cell is not considered occupied.
 * @param {object} state
 * @param {{ row: number, col: number }} position
 * @returns {boolean}
 */
const isCellOccupied = (state, position) =>
    posEq(state.dave, position) ||
    state.walls.some((w) => posEq(w, position)) ||
    state.plants.some((p) => posEq(p, position)) ||
    state.zombies.some((z) => posEq(z, position));

/**
 * Returns true if two positions are orthogonally adjacent (Manhattan distance 1).
 * @param {{ row: number, col: number }} posA
 * @param {{ row: number, col: number }} posB
 * @returns {boolean}
 */
const isAdjacent = (posA, posB) => manhattan(posA, posB) === 1;

/**
 * Returns true if the game is won.
 * @param {object} state
 * @returns {boolean}
 */
const isWon = (state) => state.status === "won";

/**
 * Returns true if the game is lost.
 * @param {object} state
 * @returns {boolean}
 */
const isLost = (state) => state.status === "lost";

/**
 * Returns true if Dave can legally move in the given direction.
 * Dave may enter empty cells and the exit, but not walls, zombies, or plants.
 * @param {object} state
 * @param {"up" | "down" | "left" | "right"} direction
 * @returns {boolean}
 */
const canMoveDave = function (state, direction) {
    if (state.status !== "playing") { return false; }
    const dir = DIRS.find((d) => d.name === direction);
    if (!dir) { return false; }
    const next = {row: state.dave.row + dir.dr, col: state.dave.col + dir.dc};
    if (!isInsideBoard(state, next)) { return false; }
    if (state.walls.some((w) => posEq(w, next))) { return false; }
    if (state.zombies.some((z) => posEq(z, next))) { return false; }
    if (state.plants.some((p) => posEq(p, next))) { return false; }
    return true;
};

/**
 * Returns true if the named plant can legally move in the given direction.
 * Plants may not enter walls, zombies, Dave's cell, the exit, other plants,
 * or move outside the board.
 * @param {object} state
 * @param {string} plantId
 * @param {"up" | "down" | "left" | "right"} direction
 * @returns {boolean}
 */
const canMovePlant = function (state, plantId, direction) {
    if (state.status !== "playing") { return false; }
    const plant = state.plants.find((p) => p.id === plantId);
    if (!plant) { return false; }
    const dir = DIRS.find((d) => d.name === direction);
    if (!dir) { return false; }
    const next = {row: plant.row + dir.dr, col: plant.col + dir.dc};
    if (!isInsideBoard(state, next)) { return false; }
    if (state.walls.some((w) => posEq(w, next))) { return false; }
    if (state.zombies.some((z) => posEq(z, next))) { return false; }
    if (posEq(state.dave, next)) { return false; }
    if (posEq(state.exit, next)) { return false; }
    const overlap = state.plants.some(
        (p) => p.id !== plantId && posEq(p, next)
    );
    if (overlap) { return false; }
    return true;
};

/**
 * Returns true if the currently selected unit can move in the given direction.
 * @param {object} state
 * @param {"up" | "down" | "left" | "right"} direction
 * @returns {boolean}
 */
const canMoveSelectedUnit = function (state, direction) {
    if (state.selectedUnitId === "dave") {
        return canMoveDave(state, direction);
    }
    return canMovePlant(state, state.selectedUnitId, direction);
};

/**
 * Moves all zombies one step using a greedy AI; returns a new state.
 * Each zombie picks the legal move that most reduces Manhattan distance to Dave.
 * Tie-breaking order: up, right, down, left.
 * Zombies cannot move through walls, other zombies, or outside the board.
 * A zombie is removed when it moves into a plant.
 * Status becomes "lost" if any zombie occupies or becomes adjacent to Dave.
 * @param {object} state
 * @returns {object} New state after all zombies have moved.
 */
const moveZombies = function (state) {
    if (state.status !== "playing") { return state; }

    const result = state.zombies.reduce(function (acc, zombie) {
        const current = acc.zombies.find(
            function (z) { return z.id === zombie.id; }
        );
        const currentDist = manhattan(current, state.dave);
        const best = DIRS.reduce(function (b, dir) {
            const next = {
                row: current.row + dir.dr,
                col: current.col + dir.dc
            };
            if (!isInsideBoard(state, next)) { return b; }
            if (state.walls.some((w) => posEq(w, next))) { return b; }
            const blocked = acc.zombies.some(
                (z) => z.id !== current.id && posEq(z, next)
            );
            if (blocked) { return b; }
            const d = manhattan(next, state.dave);
            if (d < b.dist) { return {pos: next, dist: d}; }
            return b;
        }, {pos: null, dist: currentDist});
        const newPos = (best.pos !== null) ? best.pos : current;
        const hitPlant = state.plants.some((p) => posEq(p, newPos));
        const movedZombies = acc.zombies.map(function (z) {
            if (z.id !== current.id) { return z; }
            return {id: z.id, row: newPos.row, col: newPos.col};
        });
        const newZombies = (
            hitPlant
            ? movedZombies.filter((z) => z.id !== current.id)
            : movedZombies
        );
        const lost = acc.status === "lost" ||
            (!hitPlant && (
                posEq(newPos, state.dave) ||
                isAdjacent(newPos, state.dave)
            ));
        return {
            zombies: newZombies,
            status: (
                lost ? "lost" : "playing"
            )
        };
    }, {zombies: state.zombies, status: "playing"});

    return Object.assign({}, state, {
        zombies: result.zombies,
        status: result.status,
        turn: "player"
    });
};

/**
 * Moves Dave in the given direction and returns a new state.
 * Returns the unchanged state if the move is invalid or the game is over.
 * After a valid move, zombie AI runs (unless Dave just won).
 * Status becomes "won" when Dave reaches the exit.
 * @param {object} state
 * @param {"up" | "down" | "left" | "right"} direction
 * @returns {object} New state.
 */
const moveDave = function (state, direction) {
    if (state.status !== "playing") { return state; }
    if (!canMoveDave(state, direction)) { return state; }
    const dir = DIRS.find((d) => d.name === direction);
    const newDave = {
        row: state.dave.row + dir.dr,
        col: state.dave.col + dir.dc
    };
    const reachedExit = posEq(newDave, state.exit);
    const afterDave = Object.assign({}, state, {
        dave: newDave,
        moveCount: state.moveCount + 1,
        status: (
            reachedExit ? "won" : "playing"
        ),
        turn: (
            reachedExit ? "player" : "zombie"
        )
    });
    if (reachedExit) { return afterDave; }
    return moveZombies(afterDave);
};

/**
 * Moves the named plant in the given direction and returns a new state.
 * Returns the unchanged state if the move is invalid or the game is over.
 * After a valid move, zombie AI runs automatically.
 * @param {object} state
 * @param {string} plantId
 * @param {"up" | "down" | "left" | "right"} direction
 * @returns {object} New state.
 */
const movePlant = function (state, plantId, direction) {
    if (!canMovePlant(state, plantId, direction)) { return state; }
    const dir = DIRS.find((d) => d.name === direction);
    const newPlants = state.plants.map(function (p) {
        if (p.id !== plantId) { return p; }
        return {id: p.id, row: p.row + dir.dr, col: p.col + dir.dc};
    });
    const afterMove = Object.assign({}, state, {
        plants: newPlants,
        moveCount: state.moveCount + 1,
        turn: "zombie"
    });
    return moveZombies(afterMove);
};

/**
 * Moves the currently selected unit in the given direction.
 * Delegates to moveDave when Dave is selected, or movePlant otherwise.
 * @param {object} state
 * @param {"up" | "down" | "left" | "right"} direction
 * @returns {object} New state.
 */
const moveSelectedUnit = function (state, direction) {
    if (state.status !== "playing") { return state; }
    if (state.selectedUnitId === "dave") { return moveDave(state, direction); }
    return movePlant(state, state.selectedUnitId, direction);
};

/**
 * Returns a fresh game state with a newly generated random level.
 * @returns {object}
 */
const resetGame = () => generatePlayableLevel();

export {
    createGame,
    getBoardSize,
    getDave,
    getPlants,
    getZombies,
    getWalls,
    getExit,
    getStatus,
    getTurn,
    getMoveCount,
    getSelectedUnit,
    getSelectableUnits,
    selectUnit,
    isInsideBoard,
    isCellOccupied,
    canMoveDave,
    canMovePlant,
    canMoveSelectedUnit,
    moveDave,
    movePlant,
    moveSelectedUnit,
    moveZombies,
    isAdjacent,
    isWon,
    isLost,
    hasPathToExit,
    generatePlayableLevel,
    resetGame
};
