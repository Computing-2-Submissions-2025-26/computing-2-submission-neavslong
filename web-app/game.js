/**
 * Dave's Escape - a turn-based rescue puzzle.
 *
 * An 8x8 board is randomly generated each game.
 * Dave must reach the exit before zombies become adjacent.
 * Plants destroy zombies that move into them.
 * Walls are permanent obstacles.
 *
 * @module game
 */

/**
 * A row and column on the game board.
 * @typedef {object} Position
 * @property {number} row - Zero-based row index.
 * @property {number} col - Zero-based column index.
 */

/**
 * A direction in which a unit can move.
 * @typedef {"up"|"right"|"down"|"left"} Direction
 */

/**
 * A movable plant.
 * @typedef {Position} Plant
 * @property {string} id - Unique plant identifier.
 * @property {string} [skinId] - Optional visual skin identifier.
 */

/**
 * Dave or a plant as presented by the unit-selection API.
 * @typedef {Position} SelectableUnit
 * @property {string} id - `"dave"` or a plant id.
 */

/**
 * A zombie controlled by the game AI.
 * @typedef {Position} Zombie
 * @property {string} id - Unique zombie identifier.
 * @property {number} [size=1] - Width and height in board cells.
 * @property {"normal"|"crusher"|"jumper"|"giant"} [ability="normal"]
 *   Special campaign ability.
 * @property {boolean} [jumpUsed=false] - Whether a jumper has used its jump.
 * @property {string} [skinId] - Optional visual skin identifier.
 */

/**
 * Complete immutable-style game state passed to and returned by the API.
 * State-changing functions return a new object after a valid action.
 * @typedef {object} GameState
 * @property {number} rows - Board height.
 * @property {number} cols - Board width.
 * @property {Position} dave - Dave's current position.
 * @property {Position} exit - Exit position.
 * @property {Plant[]} plants - Movable plants.
 * @property {Zombie[]} zombies - AI-controlled zombies.
 * @property {Position[]} walls - Permanent walls, except against giants.
 * @property {string} selectedUnitId - `"dave"` or a plant id.
 * @property {"playing"|"won"|"lost"} status - Current result.
 * @property {"player"|"zombie"} turn - Current phase.
 * @property {number} moveCount - Number of valid player moves.
 * @property {"campaign"} [mode] - Present for campaign games.
 * @property {number} [difficulty] - Campaign difficulty from 1 to 5.
 */

/**
 * Progress carried between campaign levels.
 * @typedef {object} CampaignProgress
 * @property {number} difficulty - Current or next difficulty.
 * @property {number} difficultyOneWins - Wins recorded at difficulty 1.
 * @property {number} totalMoves - Moves used across completed levels.
 * @property {boolean} [complete=false] - Whether the campaign is complete.
 */

/** Direction vectors in AI priority order: up, right, down, left.
 * @private
 */
const DIRS = [
    {name: "up", dr: -1, dc: 0},
    {name: "right", dr: 0, dc: 1},
    {name: "down", dr: 1, dc: 0},
    {name: "left", dr: 0, dc: -1}
];

const posEq = (a, b) => a.row === b.row && a.col === b.col;
const manhattan = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
const zombieSize = (zombie) => zombie.size || 1;

const zombieCells = function (zombie) {
    const size = zombieSize(zombie);
    return Array.from(new Array(size * size).keys(), function (i) {
        return {
            row: zombie.row + Math.floor(i / size),
            col: zombie.col + (i % size)
        };
    });
};

const zombieCovers = (zombie, position) => (
    zombieCells(zombie).some((cell) => posEq(cell, position))
);

const zombiesOverlap = (a, b) => (
    zombieCells(a).some((cell) => zombieCovers(b, cell))
);

const zombieDistance = (zombie, position) => (
    Math.min(...zombieCells(zombie).map((cell) => manhattan(cell, position)))
);

const zombieThreatens = (zombie, position) => (
    zombieCells(zombie).some(
        (cell) => posEq(cell, position) || isAdjacent(cell, position)
    )
);

const copyPosition = (position) => ({
    row: position.row,
    col: position.col
});

const copyUnit = (unit) => Object.assign({}, unit);

/**
 * Creates a seeded linear-congruential pseudo-random number generator.
 * If no seed is supplied a random seed is chosen via Math.random().
 * @param {number} [seed]
 * @returns {function(): number} Returns floats in [0, 1).
 * @private
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
 * @param {GameState} state - State to inspect.
 * @returns {boolean}
 */
const hasPathToExit = function (state) {
    const {rows, cols, dave, exit, walls} = state;
    const wallKeys = new Set(walls.map((w) => `${w.row},${w.col}`));
    const visited = new Set();
    visited.add(`${dave.row},${dave.col}`);

    // Recursive BFS – avoids functions-inside-loops (JSLint rule).
    const step = function (queue) {
        if (queue.length === 0) {
            return false;
        }
        const pos = queue[0];
        const rest = queue.slice(1);
        if (pos.row === exit.row && pos.col === exit.col) {
            return true;
        }
        const neighbours = DIRS.reduce(function (acc, dir) {
            const n = {row: pos.row + dir.dr, col: pos.col + dir.dc};
            if (n.row < 0 || n.row >= rows) {
                return acc;
            }
            if (n.col < 0 || n.col >= cols) {
                return acc;
            }
            const key = `${n.row},${n.col}`;
            if (visited.has(key) || wallKeys.has(key)) {
                return acc;
            }
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
 * @returns {GameState} A valid initial game state.
 */
const generatePlayableLevel = function (seed) {
    const ROWS = 8;
    const COLS = 8;
    const rng = makePrng(seed);
    const ri = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

    // Fisher-Yates shuffle via reduce – no for loops
    const shuffle = function (arr) {
        return Array.from(arr.keys()).reduce(function (acc, i) {
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
        new Array(ROWS * COLS).keys(),
        function (i) {
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
        if (attemptsLeft === 0) {
            return FALLBACK;
        }

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
            new Array(daveRow + 1).keys(),
            function (r) {
                return `${r},${daveCol}`;
            }
        );
        const minC = Math.min(daveCol, exitCol);
        const rowKeys = Array.from(
            new Array(Math.abs(daveCol - exitCol) + 1).keys(),
            function (i) {
                return `0,${minC + i}`;
            }
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
        const wallKeys = new Set(walls.map((w) => `${w.row},${w.col}`));
        const isReservedCell = (position) => (
            reserved.has(`${position.row},${position.col}`)
        );
        const isOpenForPlantInfluence = function (position) {
            if (position.row < 0 || position.row >= ROWS) {
                return false;
            }
            if (position.col < 0 || position.col >= COLS) {
                return false;
            }
            if (wallKeys.has(`${position.row},${position.col}`)) {
                return false;
            }
            if (posEq(position, dave) || posEq(position, exit)) {
                return false;
            }
            return true;
        };
        const openNeighbourCount = function (position) {
            return DIRS.filter(function (dir) {
                return isOpenForPlantInfluence({
                    row: position.row + dir.dr,
                    col: position.col + dir.dc
                });
            }).length;
        };
        const centralPlantCells = afterWalls.filter(function (c) {
            return (
                c.row > 0 &&
                c.row < ROWS - 1 &&
                c.col > 0 &&
                c.col < COLS - 1 &&
                !isReservedCell(c) &&
                openNeighbourCount(c) >= 2
            );
        });
        const plantCells = centralPlantCells.concat(
            afterWalls.filter(
                (c) => !centralPlantCells.some((p) => posEq(p, c))
            )
        );

        const plants = plantCells.slice(0, nPlants).map(function (c, i) {
            return {id: `p${i + 1}`, row: c.row, col: c.col};
        });

        const plantKeys = new Set(plants.map((p) => `${p.row},${p.col}`));
        const topHalf = afterWalls.filter(function (c) {
            return (
                c.row < Math.floor(ROWS / 2) &&
                !plantKeys.has(`${c.row},${c.col}`)
            );
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

        if (hasPathToExit(candidate)) {
            return candidate;
        }
        return tryBuild(attemptsLeft - 1);
    };

    return tryBuild(20);
};

/**
 * Creates a new game state with a freshly generated level.
 * @returns {GameState} Initial game state.
 */
const createGame = () => generatePlayableLevel();

/** Campaign rules indexed by difficulty.
 * @private
 */
const CAMPAIGN_RULES = {
    "1": {count: 2, ability: "normal", size: 1},
    "2": {count: 3, ability: "normal", size: 1},
    "3": {count: 2, ability: "crusher", size: 1},
    "4": {count: 3, ability: "jumper", size: 1},
    "5": {count: 2, ability: "giant", size: 2}
};

/**
 * Creates a random campaign level using the selected difficulty rules.
 * @param {number} difficulty - Integer from 1 to 5.
 * @param {number} [seed] - Optional seed for reproducible levels.
 * @returns {GameState} Campaign game state.
 */
const createCampaignGame = function (difficulty, seed) {
    const level = Number(difficulty);
    const rule = CAMPAIGN_RULES[level] || CAMPAIGN_RULES[1];
    const base = generatePlayableLevel(seed);
    const rng = makePrng(seed);
    const shuffled = function (arr) {
        return arr.reduce(function (acc, item, i) {
            const copy = acc.slice();
            const j = Math.floor(rng() * (i + 1));
            copy.splice(j, 0, item);
            return copy;
        }, []);
    };
    const occupied = function (position) {
        return (
            posEq(position, base.dave) ||
            posEq(position, base.exit) ||
            base.walls.some((wall) => posEq(wall, position)) ||
            base.plants.some((plant) => posEq(plant, position))
        );
    };

    let plants = base.plants;
    let walls = base.walls;
    let spawnPositions;

    if (rule.size === 2) {
        spawnPositions = [
            {row: 1, col: 0},
            {row: 1, col: base.cols - 2}
        ];
        const spawnCells = spawnPositions.flatMap(function (position) {
            return zombieCells({
                row: position.row,
                col: position.col,
                size: 2
            });
        });
        plants = plants.filter(
            (plant) => !spawnCells.some((cell) => posEq(cell, plant))
        );
        walls = walls.filter(
            (wall) => !spawnCells.some((cell) => posEq(cell, wall))
        );
    } else {
        const candidates = Array.from(
            new Array(Math.floor(base.rows / 2) * base.cols).keys(),
            function (i) {
                return {
                    row: Math.floor(i / base.cols),
                    col: i % base.cols
                };
            }
        ).filter((position) => !occupied(position));
        spawnPositions = shuffled(candidates).slice(0, rule.count);
    }

    const zombies = spawnPositions.map(function (position, i) {
        return {
            id: `z${i + 1}`,
            row: position.row,
            col: position.col,
            size: rule.size,
            ability: rule.ability,
            jumpUsed: false
        };
    });

    return Object.assign({}, base, {
        mode: "campaign",
        difficulty: level,
        plants,
        walls,
        zombies
    });
};

/**
 * Advances a successful campaign run to its next required level.
 * Difficulty 1 must be cleared twice; difficulties 2-5 once each.
 * @param {CampaignProgress} progress - Progress before the level was won.
 * @param {number} levelMoves - Number of moves used to win the level.
 * @returns {CampaignProgress} Updated campaign progress.
 */
const advanceCampaignProgress = function (progress, levelMoves) {
    const difficulty = progress.difficulty;
    const difficultyOneWins = (
        difficulty === 1
        ? progress.difficultyOneWins + 1
        : progress.difficultyOneWins
    );
    const totalMoves = progress.totalMoves + levelMoves;

    if (difficulty === 1 && difficultyOneWins < 2) {
        return {
            difficulty: 1,
            difficultyOneWins,
            totalMoves,
            complete: false
        };
    }
    if (difficulty === 5) {
        return {
            difficulty: 5,
            difficultyOneWins,
            totalMoves,
            complete: true
        };
    }
    return {
        difficulty: difficulty + 1,
        difficultyOneWins,
        totalMoves,
        complete: false
    };
};

/**
 * Returns the board dimensions.
 * @param {GameState} state - State to inspect.
 * @returns {{rows: number, cols: number}} Board dimensions.
 */
const getBoardSize = (state) => ({rows: state.rows, cols: state.cols});

/**
 * Returns Dave's current position.
 * @param {GameState} state - State to inspect.
 * @returns {Position} Dave's position.
 */
const getDave = (state) => copyPosition(state.dave);

/**
 * Returns all plant positions.
 * @param {GameState} state - State to inspect.
 * @returns {Plant[]} Plants in the current state.
 */
const getPlants = (state) => state.plants.map(copyUnit);

/**
 * Returns all zombie positions.
 * @param {GameState} state - State to inspect.
 * @returns {Zombie[]} Zombies in the current state.
 */
const getZombies = (state) => state.zombies.map(copyUnit);

/**
 * Returns all wall positions.
 * @param {GameState} state - State to inspect.
 * @returns {Position[]} Walls in the current state.
 */
const getWalls = (state) => state.walls.map(copyPosition);

/**
 * Returns the exit position.
 * @param {GameState} state - State to inspect.
 * @returns {Position} Exit position.
 */
const getExit = (state) => copyPosition(state.exit);

/**
 * Returns the current game status.
 * @param {GameState} state - State to inspect.
 * @returns {"playing"|"won"|"lost"} Current status.
 */
const getStatus = (state) => state.status;

/**
 * Returns whose turn it is.
 * @param {GameState} state - State to inspect.
 * @returns {"player"|"zombie"} Current turn.
 */
const getTurn = (state) => state.turn;

/**
 * Returns the number of player moves made.
 * @param {GameState} state - State to inspect.
 * @returns {number} Valid moves made by the player.
 */
const getMoveCount = (state) => state.moveCount;

/**
 * Returns the campaign difficulty, or null in random challenge mode.
 * @param {GameState} state - State to inspect.
 * @returns {number|null} Difficulty from 1 to 5, or `null`.
 */
const getDifficulty = (state) => state.difficulty || null;

/**
 * Returns the id of the currently selected unit ("dave" or a plant id).
 * @param {GameState} state - State to inspect.
 * @returns {string} Selected unit id.
 */
const getSelectedUnit = (state) => state.selectedUnitId;

/**
 * Returns all units the player may select: Dave and every plant.
 * @param {GameState} state - State to inspect.
 * @returns {SelectableUnit[]} Selectable units.
 */
const getSelectableUnits = function (state) {
    const daveUnit = {id: "dave", row: state.dave.row, col: state.dave.col};
    return [daveUnit].concat(state.plants.map(copyUnit));
};

/**
 * Returns a new state with the selected unit changed.
 * Only "dave" or an existing plant id are valid selections.
 * Returns the unchanged state if the id is unknown or the game is over.
 * @param {GameState} state - Current state.
 * @param {string} unitId - `"dave"` or an existing plant id.
 * @returns {GameState} Updated state, or the original state if invalid.
 */
const selectUnit = function (state, unitId) {
    if (state.status !== "playing") {
        return state;
    }
    const valid = (
        unitId === "dave" ||
        state.plants.some((p) => p.id === unitId)
    );
    if (!valid) {
        return state;
    }
    return Object.assign({}, state, {selectedUnitId: unitId});
};

/**
 * Returns true if the position is inside the board.
 * @param {GameState} state - State defining the board dimensions.
 * @param {Position} position - Position to test.
 * @returns {boolean}
 */
const isInsideBoard = (state, position) => (
    position.row >= 0 &&
    position.row < state.rows &&
    position.col >= 0 &&
    position.col < state.cols
);

/**
 * Returns true if the cell is occupied by Dave, a plant, a zombie, or a wall.
 * The exit cell is not considered occupied.
 * @param {GameState} state - State to inspect.
 * @param {Position} position - Position to test.
 * @returns {boolean}
 */
const isCellOccupied = (state, position) => (
    posEq(state.dave, position) ||
    state.walls.some((w) => posEq(w, position)) ||
    state.plants.some((p) => posEq(p, position)) ||
    state.zombies.some((z) => zombieCovers(z, position))
);

/**
 * Returns true if two positions are orthogonally adjacent
 * (Manhattan distance 1).
 * @param {Position} posA - First position.
 * @param {Position} posB - Second position.
 * @returns {boolean}
 */
const isAdjacent = (posA, posB) => manhattan(posA, posB) === 1;

/**
 * Returns true if the game is won.
 * @param {GameState} state - State to inspect.
 * @returns {boolean}
 */
const isWon = (state) => state.status === "won";

/**
 * Returns true if the game is lost.
 * @param {GameState} state - State to inspect.
 * @returns {boolean}
 */
const isLost = (state) => state.status === "lost";

/**
 * Returns true if Dave can legally move in the given direction.
 * Dave may enter empty cells and the exit, but not walls, zombies, or plants.
 * @param {GameState} state - Current state.
 * @param {Direction} direction - Direction to test.
 * @returns {boolean}
 */
const canMoveDave = function (state, direction) {
    if (state.status !== "playing") {
        return false;
    }
    const dir = DIRS.find((d) => d.name === direction);
    if (!dir) {
        return false;
    }
    const next = {row: state.dave.row + dir.dr, col: state.dave.col + dir.dc};
    if (!isInsideBoard(state, next)) {
        return false;
    }
    if (state.walls.some((w) => posEq(w, next))) {
        return false;
    }
    if (state.zombies.some((z) => zombieCovers(z, next))) {
        return false;
    }
    if (state.plants.some((p) => posEq(p, next))) {
        return false;
    }
    return true;
};

/**
 * Returns true if the named plant can legally move in the given direction.
 * Plants may not enter walls, zombies, Dave's cell, the exit, other plants,
 * or move outside the board.
 * @param {GameState} state - Current state.
 * @param {string} plantId - Plant to test.
 * @param {Direction} direction - Direction to test.
 * @returns {boolean}
 */
const canMovePlant = function (state, plantId, direction) {
    if (state.status !== "playing") {
        return false;
    }
    const plant = state.plants.find((p) => p.id === plantId);
    if (!plant) {
        return false;
    }
    const dir = DIRS.find((d) => d.name === direction);
    if (!dir) {
        return false;
    }
    const next = {row: plant.row + dir.dr, col: plant.col + dir.dc};
    if (!isInsideBoard(state, next)) {
        return false;
    }
    if (state.walls.some((w) => posEq(w, next))) {
        return false;
    }
    if (state.zombies.some((z) => zombieCovers(z, next))) {
        return false;
    }
    if (posEq(state.dave, next)) {
        return false;
    }
    if (posEq(state.exit, next)) {
        return false;
    }
    const overlap = state.plants.some(
        (p) => p.id !== plantId && posEq(p, next)
    );
    if (overlap) {
        return false;
    }
    return true;
};

/**
 * Returns true if the currently selected unit can move in the given direction.
 * @param {GameState} state - Current state.
 * @param {Direction} direction - Direction to test.
 * @returns {boolean}
 */
const canMoveSelectedUnit = function (state, direction) {
    if (state.selectedUnitId === "dave") {
        return canMoveDave(state, direction);
    }
    return canMovePlant(state, state.selectedUnitId, direction);
};

/**
 * Returns whether a proposed zombie destination obeys board and collision
 * rules. The turn state reflects changes made by earlier zombies.
 * @param {GameState} state - Original turn state.
 * @param {object} turnState - Accumulated zombie-turn state.
 * @param {Zombie} current - Zombie being moved.
 * @param {Zombie} moved - Zombie at the proposed destination.
 * @param {boolean} jumped - Whether the move jumps over a plant.
 * @returns {boolean}
 * @private
 */
const isLegalZombieDestination = function (
    state,
    turnState,
    current,
    moved,
    jumped
) {
    const cells = zombieCells(moved);
    const insideBoard = cells.every((cell) => isInsideBoard(state, cell));
    const coversExit = cells.some((cell) => posEq(state.exit, cell));
    const coversWall = cells.some(
        (cell) => turnState.walls.some((wall) => posEq(wall, cell))
    );
    const landsOnPlant = cells.some(
        (cell) => turnState.plants.some((plant) => posEq(plant, cell))
    );
    const overlapsZombie = turnState.zombies.some(
        (zombie) => (
            zombie.id !== current.id && zombiesOverlap(zombie, moved)
        )
    );
    return (
        insideBoard &&
        !coversExit &&
        (current.ability === "giant" || !coversWall) &&
        (!jumped || !landsOnPlant) &&
        !overlapsZombie
    );
};

/**
 * Builds one possible zombie move in a direction.
 * @param {GameState} state - Original turn state.
 * @param {object} turnState - Accumulated zombie-turn state.
 * @param {Zombie} current - Zombie being moved.
 * @param {object} direction - Direction vector.
 * @returns {object|null} Candidate move, or null when illegal.
 * @private
 */
const zombieMoveCandidate = function (state, turnState, current, direction) {
    const firstStep = {
        row: current.row + direction.dr,
        col: current.col + direction.dc
    };
    const jumped = (
        current.ability === "jumper" &&
        !current.jumpUsed &&
        turnState.plants.some((plant) => posEq(plant, firstStep))
    );
    const stepSize = (
        jumped
        ? 2
        : 1
    );
    const moved = Object.assign({}, current, {
        row: current.row + direction.dr * stepSize,
        col: current.col + direction.dc * stepSize
    });
    if (!isLegalZombieDestination(
        state,
        turnState,
        current,
        moved,
        jumped
    )) {
        return null;
    }
    return {
        moved,
        distance: zombieDistance(moved, state.dave),
        jumped
    };
};

/**
 * Chooses the legal move that most reduces distance to Dave.
 * @param {GameState} state - Original turn state.
 * @param {object} turnState - Accumulated zombie-turn state.
 * @param {Zombie} current - Zombie being moved.
 * @returns {object} Chosen movement result.
 * @private
 */
const chooseZombieMove = function (state, turnState, current) {
    const startingChoice = {
        moved: current,
        distance: zombieDistance(current, state.dave),
        jumped: false
    };
    return DIRS.reduce(function (best, direction) {
        const candidate = zombieMoveCandidate(
            state,
            turnState,
            current,
            direction
        );
        if (candidate !== null && candidate.distance < best.distance) {
            return candidate;
        }
        return best;
    }, startingChoice);
};

const replaceZombie = (zombies, replacement) => zombies.map(
    (zombie) => (
        zombie.id === replacement.id
        ? replacement
        : zombie
    )
);

const removeCoveredObstacles = (obstacles, zombie) => obstacles.filter(
    (obstacle) => !zombieCovers(zombie, obstacle)
);

/**
 * Applies movement, ability, collision, and loss effects for one zombie.
 * @param {GameState} state - Original turn state.
 * @param {object} turnState - Accumulated zombie-turn state.
 * @param {Zombie} current - Zombie being moved.
 * @returns {object} Updated accumulated zombie-turn state.
 * @private
 */
const resolveZombieMove = function (state, turnState, current) {
    const choice = chooseZombieMove(state, turnState, current);
    const movedZombie = Object.assign({}, choice.moved, {
        jumpUsed: current.jumpUsed || choice.jumped
    });
    const hitPlant = turnState.plants.some(
        (plant) => zombieCovers(movedZombie, plant)
    );
    const crushesPlant = current.ability === "crusher" && hitPlant;
    const destroysObstacles = current.ability === "giant";
    const finalZombie = (
        crushesPlant
        ? current
        : movedZombie
    );
    const zombieDies = (
        hitPlant &&
        !choice.jumped &&
        !crushesPlant &&
        !destroysObstacles
    );
    const replacedZombies = replaceZombie(turnState.zombies, finalZombie);
    const zombies = (
        zombieDies
        ? replacedZombies.filter((zombie) => zombie.id !== current.id)
        : replacedZombies
    );
    const plants = (
        (crushesPlant || destroysObstacles)
        ? removeCoveredObstacles(turnState.plants, movedZombie)
        : turnState.plants
    );
    const walls = (
        destroysObstacles
        ? removeCoveredObstacles(turnState.walls, movedZombie)
        : turnState.walls
    );
    const isThreatened = (
        !zombieDies && zombieThreatens(finalZombie, state.dave)
    );
    const lost = turnState.status === "lost" || isThreatened;
    return {
        zombies,
        plants,
        walls,
        status: (
            lost
            ? "lost"
            : "playing"
        )
    };
};

/**
 * Moves all zombies one step using a greedy AI; returns a new state.
 * Each zombie picks the legal move that most reduces Manhattan distance
 * to Dave.
 * Tie-breaking order: up, right, down, left.
 * Campaign abilities may change how plants and walls are handled.
 * The exit always blocks zombies.
 * Status becomes "lost" if any zombie occupies or becomes adjacent to Dave.
 * @param {GameState} state - Current state.
 * @returns {GameState} New state after all zombies have moved.
 */
const moveZombies = function (state) {
    if (state.status !== "playing") {
        return state;
    }

    const result = state.zombies.reduce(function (turnState, zombie) {
        const current = turnState.zombies.find(
            (candidate) => candidate.id === zombie.id
        );
        return resolveZombieMove(state, turnState, current);
    }, {
        zombies: state.zombies,
        plants: state.plants,
        walls: state.walls,
        status: "playing"
    });

    const selectedUnitId = (
        (
            state.selectedUnitId === "dave" ||
            result.plants.some(
                (plant) => plant.id === state.selectedUnitId
            )
        )
        ? state.selectedUnitId
        : "dave"
    );

    return Object.assign({}, state, {
        zombies: result.zombies,
        plants: result.plants,
        walls: result.walls,
        status: result.status,
        selectedUnitId,
        turn: "player"
    });
};

/**
 * Moves Dave in the given direction and returns a new state.
 * Returns the unchanged state if the move is invalid or the game is over.
 * After a valid move, zombie AI runs (unless Dave just won).
 * Status becomes "won" when Dave reaches the exit.
 * @param {GameState} state - Current state.
 * @param {Direction} direction - Direction to move.
 * @returns {GameState} New state, or the original state if invalid.
 */
const moveDave = function (state, direction) {
    if (state.status !== "playing") {
        return state;
    }
    if (!canMoveDave(state, direction)) {
        return state;
    }
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
            reachedExit
            ? "won"
            : "playing"
        ),
        turn: (
            reachedExit
            ? "player"
            : "zombie"
        )
    });
    if (reachedExit) {
        return afterDave;
    }
    return moveZombies(afterDave);
};

/**
 * Moves the named plant in the given direction and returns a new state.
 * Returns the unchanged state if the move is invalid or the game is over.
 * After a valid move, zombie AI runs automatically.
 * @param {GameState} state - Current state.
 * @param {string} plantId - Plant to move.
 * @param {Direction} direction - Direction to move.
 * @returns {GameState} New state, or the original state if invalid.
 */
const movePlant = function (state, plantId, direction) {
    if (!canMovePlant(state, plantId, direction)) {
        return state;
    }
    const dir = DIRS.find((d) => d.name === direction);
    const newPlants = state.plants.map(function (p) {
        if (p.id !== plantId) {
            return p;
        }
        return Object.assign({}, p, {
            row: p.row + dir.dr,
            col: p.col + dir.dc
        });
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
 * @param {GameState} state - Current state.
 * @param {Direction} direction - Direction to move.
 * @returns {GameState} New state, or the original state if invalid.
 */
const moveSelectedUnit = function (state, direction) {
    if (state.status !== "playing") {
        return state;
    }
    if (state.selectedUnitId === "dave") {
        return moveDave(state, direction);
    }
    return movePlant(state, state.selectedUnitId, direction);
};

/**
 * Returns a fresh game state with a newly generated random level.
 * @returns {GameState} Fresh random challenge state.
 */
const resetGame = () => generatePlayableLevel();

export {
    createGame,
    createCampaignGame,
    advanceCampaignProgress,
    getBoardSize,
    getDave,
    getPlants,
    getZombies,
    getWalls,
    getExit,
    getStatus,
    getTurn,
    getMoveCount,
    getDifficulty,
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
