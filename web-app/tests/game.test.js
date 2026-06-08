import assert from "node:assert/strict";
import {
    createGame,
    getBoardSize,
    getDave,
    getPlants,
    getZombies,
    getWalls,
    getExit,
    getStatus,
    getMoveCount,
    isInsideBoard,
    isCellOccupied,
    canMoveDave,
    moveDave,
    moveZombies,
    isAdjacent,
    isWon,
    isLost,
    resetGame,
} from "../game.js";

/** Build a minimal state for isolated unit tests. */
const mkState = (overrides = {}) => ({
    rows: 7,
    cols: 7,
    dave: { row: 3, col: 3 },
    exit: { row: 0, col: 3 },
    plants: [],
    zombies: [],
    walls: [],
    status: "playing",
    turn: "player",
    moveCount: 0,
    ...overrides,
});

// ─── createGame ──────────────────────────────────────────────────────────────

describe("createGame", function () {
    it("creates an 8×8 board", function () {
        const state = createGame();
        const { rows, cols } = getBoardSize(state);
        assert.equal(rows, 8);
        assert.equal(cols, 8);
    });

    it("places Dave on the board", function () {
        const state = createGame();
        const dave = getDave(state);
        assert.ok(typeof dave.row === "number");
        assert.ok(typeof dave.col === "number");
        assert.equal(isInsideBoard(state, dave), true);
    });

    it("places the exit on the board", function () {
        const state = createGame();
        const exit = getExit(state);
        assert.ok(typeof exit.row === "number");
        assert.ok(typeof exit.col === "number");
        assert.equal(isInsideBoard(state, exit), true);
    });

    it("places at least one plant, one zombie, and one wall", function () {
        const state = createGame();
        assert.ok(getPlants(state).length >= 1, "expected at least one plant");
        assert.ok(getZombies(state).length >= 1, "expected at least one zombie");
        assert.ok(getWalls(state).length >= 1, "expected at least one wall");
    });

    it("starts in playing status with 0 moves", function () {
        const state = createGame();
        assert.equal(getStatus(state), "playing");
        assert.equal(getMoveCount(state), 0);
    });
});

// ─── isInsideBoard ───────────────────────────────────────────────────────────

describe("isInsideBoard", function () {
    const state = createGame();

    it("returns true for corners and centre", function () {
        assert.equal(isInsideBoard(state, { row: 0, col: 0 }), true);
        assert.equal(isInsideBoard(state, { row: 6, col: 6 }), true);
        assert.equal(isInsideBoard(state, { row: 3, col: 3 }), true);
    });

    it("returns false for out-of-bounds positions", function () {
        assert.equal(isInsideBoard(state, { row: -1, col: 0 }), false);
        assert.equal(isInsideBoard(state, { row: 8, col: 0 }), false);
        assert.equal(isInsideBoard(state, { row: 0, col: -1 }), false);
        assert.equal(isInsideBoard(state, { row: 0, col: 8 }), false);
    });
});

// ─── isAdjacent ──────────────────────────────────────────────────────────────

describe("isAdjacent", function () {
    it("returns true for orthogonally adjacent positions", function () {
        assert.equal(isAdjacent({ row: 2, col: 3 }, { row: 3, col: 3 }), true);
        assert.equal(isAdjacent({ row: 3, col: 2 }, { row: 3, col: 3 }), true);
    });

    it("returns false for diagonal or non-adjacent positions", function () {
        assert.equal(isAdjacent({ row: 2, col: 2 }, { row: 3, col: 3 }), false);
        assert.equal(isAdjacent({ row: 1, col: 3 }, { row: 3, col: 3 }), false);
        assert.equal(isAdjacent({ row: 3, col: 3 }, { row: 3, col: 3 }), false);
    });
});

// ─── Dave movement ───────────────────────────────────────────────────────────

describe("canMoveDave / moveDave", function () {
    it("Dave cannot move outside the board", function () {
        const state = mkState({ dave: { row: 0, col: 3 } });
        assert.equal(canMoveDave(state, "up"), false);

        const state2 = mkState({ dave: { row: 0, col: 0 } });
        assert.equal(canMoveDave(state2, "left"), false);
    });

    it("Dave cannot move into a wall", function () {
        const state = mkState({
            dave: { row: 3, col: 3 },
            walls: [{ row: 2, col: 3 }],
        });
        assert.equal(canMoveDave(state, "up"), false);
    });

    it("Dave cannot move into a zombie", function () {
        const state = mkState({
            dave: { row: 3, col: 3 },
            zombies: [{ id: "z1", row: 2, col: 3 }],
        });
        assert.equal(canMoveDave(state, "up"), false);
    });

    it("Dave cannot move into a plant", function () {
        const state = mkState({
            dave: { row: 3, col: 3 },
            plants: [{ id: "p1", row: 2, col: 3 }],
        });
        assert.equal(canMoveDave(state, "up"), false);
    });

    it("Dave can move into an empty cell", function () {
        const state = mkState({ dave: { row: 3, col: 3 } });
        assert.equal(canMoveDave(state, "up"), true);
        assert.equal(canMoveDave(state, "down"), true);
        assert.equal(canMoveDave(state, "left"), true);
        assert.equal(canMoveDave(state, "right"), true);
    });

    it("a valid move increments moveCount", function () {
        const state = mkState({ dave: { row: 3, col: 3 } });
        const next = moveDave(state, "up");
        assert.equal(getMoveCount(next), 1);
    });

    it("an invalid move does not increment moveCount", function () {
        const state = mkState({
            dave: { row: 0, col: 3 },
            walls: [{ row: 1, col: 3 }],
        });
        const next = moveDave(state, "up"); // outside board
        assert.equal(getMoveCount(next), 0);
    });

    it("Dave moves to the expected cell after a valid move", function () {
        const state = mkState({ dave: { row: 3, col: 3 } });
        const next = moveDave(state, "up");
        const dave = getDave(next);
        assert.equal(dave.row, 2);
        assert.equal(dave.col, 3);
    });
});

// ─── Win condition ───────────────────────────────────────────────────────────

describe("winning", function () {
    it("reaching the exit sets status to 'won'", function () {
        const state = mkState({
            dave: { row: 1, col: 3 },
            exit: { row: 0, col: 3 },
        });
        const next = moveDave(state, "up");
        assert.equal(getStatus(next), "won");
        assert.equal(isWon(next), true);
    });

    it("once won, further moveDave calls return unchanged state", function () {
        const state = mkState({
            dave: { row: 1, col: 3 },
            exit: { row: 0, col: 3 },
        });
        const won = moveDave(state, "up");
        const after = moveDave(won, "down");
        assert.equal(getStatus(after), "won");
        assert.equal(getDave(after).row, getDave(won).row);
        assert.equal(getMoveCount(after), getMoveCount(won));
    });
});

// ─── Loss condition ──────────────────────────────────────────────────────────

describe("losing", function () {
    it("zombie becoming adjacent to Dave sets status to 'lost'", function () {
        // Zombie at (3,1), Dave at (3,3). Zombie moves right to (3,2) → adjacent.
        const state = mkState({
            dave: { row: 3, col: 3 },
            zombies: [{ id: "z1", row: 3, col: 1 }],
        });
        const next = moveZombies(state);
        assert.equal(getStatus(next), "lost");
        assert.equal(isLost(next), true);
    });

    it("zombie reaching Dave's cell sets status to 'lost'", function () {
        // Zombie at (3,2), Dave at (3,3). Zombie can step directly onto Dave.
        const state = mkState({
            dave: { row: 3, col: 3 },
            zombies: [{ id: "z1", row: 3, col: 2 }],
        });
        const next = moveZombies(state);
        assert.equal(getStatus(next), "lost");
    });

    it("a diagonally adjacent zombie does not make Dave lose", function () {
        const state = mkState({
            dave: { row: 3, col: 3 },
            zombies: [{ id: "z1", row: 2, col: 2 }],
            walls: [
                { row: 1, col: 2 },
                { row: 2, col: 1 },
                { row: 2, col: 3 },
                { row: 3, col: 2 },
            ],
        });
        const next = moveZombies(state);
        assert.equal(getStatus(next), "playing");
    });

    it("once lost, further moveDave calls return unchanged state", function () {
        const state = mkState({ status: "lost" });
        const after = moveDave(state, "up");
        assert.equal(getStatus(after), "lost");
    });
});

// ─── Zombie AI ───────────────────────────────────────────────────────────────

describe("zombie AI", function () {
    it("zombie moves toward Dave when a closer cell is available", function () {
        // Zombie directly above Dave in same column – moves down.
        const state = mkState({
            dave: { row: 5, col: 3 },
            zombies: [{ id: "z1", row: 2, col: 3 }],
        });
        const next = moveZombies(state);
        const z = getZombies(next)[0];
        assert.equal(z.row, 3); // moved down toward Dave
        assert.equal(z.col, 3);
    });

    it("zombie stays when all moves are blocked or do not reduce distance", function () {
        // Wall at (3,3) blocks the direct downward path; other directions are farther.
        const state = mkState({
            dave: { row: 5, col: 3 },
            zombies: [{ id: "z1", row: 2, col: 3 }],
            walls: [
                { row: 2, col: 2 }, { row: 2, col: 4 },
                { row: 1, col: 3 }, { row: 3, col: 3 },
            ],
        });
        const next = moveZombies(state);
        const z = getZombies(next)[0];
        assert.equal(z.row, 2);
        assert.equal(z.col, 3);
    });

    it("zombie dies when it moves into a plant", function () {
        // The plant is directly between the zombie and Dave.
        const state = mkState({
            dave: { row: 6, col: 3 },
            zombies: [{ id: "z1", row: 3, col: 3 }],
            plants: [{ id: "p1", row: 4, col: 3 }],
        });
        const next = moveZombies(state);
        assert.equal(getZombies(next).length, 0);
        assert.deepEqual(getPlants(next), [{ id: "p1", row: 4, col: 3 }]);
        assert.equal(getStatus(next), "playing");
    });

    it("zombie cannot move through walls", function () {
        const state = mkState({
            dave: { row: 6, col: 3 },
            zombies: [{ id: "z1", row: 3, col: 3 }],
            walls: [
                { row: 4, col: 3 }, // blocks downward
                { row: 3, col: 2 }, { row: 3, col: 4 }, // blocks sideways
                { row: 2, col: 3 }, // blocks upward
            ],
        });
        const next = moveZombies(state);
        const z = getZombies(next)[0];
        assert.equal(z.row, 3);
        assert.equal(z.col, 3);
    });

    it("zombie cannot move onto or through the exit", function () {
        const state = mkState({
            dave: { row: 5, col: 3 },
            exit: { row: 3, col: 3 },
            zombies: [{ id: "z1", row: 2, col: 3 }],
            walls: [
                { row: 1, col: 3 },
                { row: 2, col: 2 },
                { row: 2, col: 4 },
            ],
        });
        const next = moveZombies(state);
        const z = getZombies(next)[0];
        assert.equal(z.row, 2);
        assert.equal(z.col, 3);
        assert.equal(getStatus(next), "playing");
    });

    it("two zombies do not occupy the same cell", function () {
        // Both zombies want to move right into the same cell.
        const state = mkState({
            dave: { row: 3, col: 6 },
            zombies: [
                { id: "z1", row: 3, col: 3 },
                { id: "z2", row: 3, col: 4 },
            ],
        });
        const next = moveZombies(state);
        const [z1, z2] = getZombies(next);
        assert.notDeepEqual(
            { row: z1.row, col: z1.col },
            { row: z2.row, col: z2.col },
        );
    });

    it("deterministic direction order: up preferred over right when equal", function () {
        // Zombie at (3,1), Dave at (2,2). Up→(2,1) dist=0+1=1. Right→(3,2) dist=1+0=1.
        // Both equally good; up comes first.
        const state = mkState({
            dave: { row: 2, col: 2 },
            zombies: [{ id: "z1", row: 3, col: 1 }],
        });
        const next = moveZombies(state);
        const z = getZombies(next)[0];
        assert.equal(z.row, 2);
        assert.equal(z.col, 1);
    });
});

// ─── isCellOccupied ──────────────────────────────────────────────────────────

describe("isCellOccupied", function () {
    it("returns true for Dave's cell", function () {
        const state = mkState({ dave: { row: 3, col: 3 } });
        assert.equal(isCellOccupied(state, { row: 3, col: 3 }), true);
    });

    it("returns true for a wall cell", function () {
        const state = mkState({ walls: [{ row: 1, col: 1 }] });
        assert.equal(isCellOccupied(state, { row: 1, col: 1 }), true);
    });

    it("returns true for a plant cell", function () {
        const state = mkState({ plants: [{ id: "p1", row: 2, col: 2 }] });
        assert.equal(isCellOccupied(state, { row: 2, col: 2 }), true);
    });

    it("returns true for a zombie cell", function () {
        const state = mkState({ zombies: [{ id: "z1", row: 4, col: 4 }] });
        assert.equal(isCellOccupied(state, { row: 4, col: 4 }), true);
    });

    it("returns false for an empty cell", function () {
        const state = mkState({ dave: { row: 3, col: 3 } });
        assert.equal(isCellOccupied(state, { row: 0, col: 0 }), false);
    });
});

// ─── resetGame ───────────────────────────────────────────────────────────────

describe("resetGame", function () {
    it("returns a fresh state identical in structure to createGame", function () {
        const initial = createGame();
        // Play a few moves
        let state = moveDave(initial, "up");
        state = moveDave(state, "up");
        // Reset
        const reset = resetGame();
        assert.equal(isInsideBoard(reset, getDave(reset)), true);
        assert.deepEqual(getBoardSize(reset), getBoardSize(initial));
        assert.equal(getMoveCount(reset), 0);
        assert.equal(getStatus(reset), "playing");
    });
});
