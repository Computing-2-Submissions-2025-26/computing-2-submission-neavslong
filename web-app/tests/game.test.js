import assert from "node:assert/strict";
import {
    createGame,
    generatePlayableLevel,
    createCampaignGame,
    advanceCampaignProgress,
    getBoardSize,
    getDave,
    getPlants,
    getZombies,
    getWalls,
    getExit,
    getStatus,
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
    resetGame
} from "../game.js";

/** Build a minimal state for isolated unit tests. */
const mkState = (overrides = {}) => Object.assign({
    rows: 7,
    cols: 7,
    dave: {row: 3, col: 3},
    exit: {row: 0, col: 3},
    plants: [],
    zombies: [],
    walls: [],
    selectedUnitId: "dave",
    status: "playing",
    turn: "player",
    moveCount: 0
}, overrides);

const clone = (value) => JSON.parse(JSON.stringify(value));

// ─── createGame ──────────────────────────────────────────────────────────────

describe("createGame", function () {
    it("creates an 8×8 board", function () {
        const state = createGame();
        const {rows, cols} = getBoardSize(state);
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
        assert.ok(
            getZombies(state).length >= 1,
            "expected at least one zombie"
        );
        assert.ok(getWalls(state).length >= 1, "expected at least one wall");
    });

    it("starts in playing status with 0 moves", function () {
        const state = createGame();
        assert.equal(getStatus(state), "playing");
        assert.equal(getMoveCount(state), 0);
    });

    it("places plants with useful neighbouring cells", function () {
        const directions = [
            {row: -1, col: 0},
            {row: 1, col: 0},
            {row: 0, col: -1},
            {row: 0, col: 1}
        ];
        Array.from(new Array(20).keys(), function (i) {
            return generatePlayableLevel(i + 1);
        }).forEach(function (state) {
            const dave = getDave(state);
            const exit = getExit(state);
            const wallKeys = new Set(
                getWalls(state).map((wall) => `${wall.row},${wall.col}`)
            );
            getPlants(state).forEach(function (plant) {
                assert.equal(plant.row > 0 && plant.row < 7, true);
                assert.equal(plant.col > 0 && plant.col < 7, true);
                const openNeighbours = directions.filter(function (direction) {
                    const position = {
                        row: plant.row + direction.row,
                        col: plant.col + direction.col
                    };
                    return (
                        isInsideBoard(state, position) &&
                        !wallKeys.has(`${position.row},${position.col}`) &&
                        !(
                            dave.row === position.row &&
                            dave.col === position.col
                        ) &&
                        !(
                            exit.row === position.row &&
                            exit.col === position.col
                        )
                    );
                });
                assert.equal(openNeighbours.length >= 2, true);
            });
        });
    });
});

describe("campaign difficulties", function () {
    it("difficulty 1 and 2 create exactly two and three zombies", function () {
        assert.equal(getZombies(createCampaignGame(1, 11)).length, 2);
        assert.equal(getZombies(createCampaignGame(2, 11)).length, 3);
    });

    it("difficulty 3 creates two crusher zombies", function () {
        const state = createCampaignGame(3, 12);
        assert.equal(getDifficulty(state), 3);
        assert.equal(getZombies(state).length, 2);
        getZombies(state).forEach(function (zombie) {
            assert.equal(zombie.ability, "crusher");
        });
    });

    it("difficulty 4 creates three jumpers with an unused jump", function () {
        const state = createCampaignGame(4, 13);
        assert.equal(getZombies(state).length, 3);
        getZombies(state).forEach(function (zombie) {
            assert.equal(zombie.ability, "jumper");
            assert.equal(zombie.jumpUsed, false);
        });
    });

    it("difficulty 5 creates two 2x2 giant zombies", function () {
        const state = createCampaignGame(5, 14);
        assert.equal(getZombies(state).length, 2);
        getZombies(state).forEach(function (zombie) {
            assert.equal(zombie.ability, "giant");
            assert.equal(zombie.size, 2);
        });
    });

    it("requires two difficulty 1 wins before advancing", function () {
        const first = advanceCampaignProgress({
            difficulty: 1,
            difficultyOneWins: 0,
            totalMoves: 0
        }, 10);
        assert.equal(first.difficulty, 1);
        assert.equal(first.difficultyOneWins, 1);

        const second = advanceCampaignProgress(first, 12);
        assert.equal(second.difficulty, 2);
        assert.equal(second.difficultyOneWins, 2);
        assert.equal(second.totalMoves, 22);
    });

    it("advances through difficulty 5 and records total moves", function () {
        let progress = {
            difficulty: 2,
            difficultyOneWins: 2,
            totalMoves: 22,
            complete: false
        };
        [8, 9, 10, 11].forEach(function (moves) {
            progress = advanceCampaignProgress(progress, moves);
        });
        assert.equal(progress.difficulty, 5);
        assert.equal(progress.complete, true);
        assert.equal(progress.totalMoves, 60);
    });
});

// ─── isInsideBoard ───────────────────────────────────────────────────────────

describe("isInsideBoard", function () {
    const state = createGame();

    it("returns true for corners and centre", function () {
        assert.equal(isInsideBoard(state, {row: 0, col: 0}), true);
        assert.equal(isInsideBoard(state, {row: 6, col: 6}), true);
        assert.equal(isInsideBoard(state, {row: 3, col: 3}), true);
    });

    it("returns false for out-of-bounds positions", function () {
        assert.equal(isInsideBoard(state, {row: -1, col: 0}), false);
        assert.equal(isInsideBoard(state, {row: 8, col: 0}), false);
        assert.equal(isInsideBoard(state, {row: 0, col: -1}), false);
        assert.equal(isInsideBoard(state, {row: 0, col: 8}), false);
    });
});

// ─── isAdjacent ──────────────────────────────────────────────────────────────

describe("isAdjacent", function () {
    it("returns true for orthogonally adjacent positions", function () {
        assert.equal(isAdjacent({row: 2, col: 3}, {row: 3, col: 3}), true);
        assert.equal(isAdjacent({row: 3, col: 2}, {row: 3, col: 3}), true);
    });

    it("returns false for diagonal or non-adjacent positions", function () {
        assert.equal(isAdjacent({row: 2, col: 2}, {row: 3, col: 3}), false);
        assert.equal(isAdjacent({row: 1, col: 3}, {row: 3, col: 3}), false);
        assert.equal(isAdjacent({row: 3, col: 3}, {row: 3, col: 3}), false);
    });
});

// ─── Dave movement ───────────────────────────────────────────────────────────

describe("canMoveDave / moveDave", function () {
    it("Dave cannot move outside the board", function () {
        const state = mkState({dave: {row: 0, col: 3}});
        assert.equal(canMoveDave(state, "up"), false);

        const state2 = mkState({dave: {row: 0, col: 0}});
        assert.equal(canMoveDave(state2, "left"), false);
    });

    it("Dave cannot move into a wall", function () {
        const state = mkState({
            dave: {row: 3, col: 3},
            walls: [{row: 2, col: 3}]
        });
        assert.equal(canMoveDave(state, "up"), false);
    });

    it("Dave cannot move into a zombie", function () {
        const state = mkState({
            dave: {row: 3, col: 3},
            zombies: [{id: "z1", row: 2, col: 3}]
        });
        assert.equal(canMoveDave(state, "up"), false);
    });

    it("Dave cannot move into a plant", function () {
        const state = mkState({
            dave: {row: 3, col: 3},
            plants: [{id: "p1", row: 2, col: 3}]
        });
        assert.equal(canMoveDave(state, "up"), false);
    });

    it("Dave can move into an empty cell", function () {
        const state = mkState({dave: {row: 3, col: 3}});
        assert.equal(canMoveDave(state, "up"), true);
        assert.equal(canMoveDave(state, "down"), true);
        assert.equal(canMoveDave(state, "left"), true);
        assert.equal(canMoveDave(state, "right"), true);
    });

    it("a valid move increments moveCount", function () {
        const state = mkState({dave: {row: 3, col: 3}});
        const next = moveDave(state, "up");
        assert.equal(getMoveCount(next), 1);
    });

    it("an invalid move does not increment moveCount", function () {
        const state = mkState({
            dave: {row: 0, col: 3},
            walls: [{row: 1, col: 3}]
        });
        const next = moveDave(state, "up"); // outside board
        assert.equal(getMoveCount(next), 0);
    });

    it("Dave moves to the expected cell after a valid move", function () {
        const state = mkState({dave: {row: 3, col: 3}});
        const next = moveDave(state, "up");
        const dave = getDave(next);
        assert.equal(dave.row, 2);
        assert.equal(dave.col, 3);
    });
});

// ─── Plant selection and movement ───────────────────────────────────────────

describe("plant selection and movement", function () {
    it("lists Dave and plants as selectable units", function () {
        const state = mkState({
            plants: [
                {id: "p1", row: 2, col: 2},
                {id: "p2", row: 4, col: 4}
            ]
        });
        assert.deepEqual(getSelectableUnits(state), [
            {id: "dave", row: 3, col: 3},
            {id: "p1", row: 2, col: 2},
            {id: "p2", row: 4, col: 4}
        ]);
    });

    it("selects known units but ignores unknown ids", function () {
        const state = mkState({
            plants: [{id: "p1", row: 2, col: 2}]
        });
        const selectedPlant = selectUnit(state, "p1");
        assert.equal(getSelectedUnit(selectedPlant), "p1");

        const selectedDave = selectUnit(selectedPlant, "dave");
        assert.equal(getSelectedUnit(selectedDave), "dave");

        assert.equal(selectUnit(selectedDave, "missing"), selectedDave);
    });

    it("does not change selection after the game is over", function () {
        const state = mkState({
            status: "won",
            plants: [{id: "p1", row: 2, col: 2}]
        });
        assert.equal(selectUnit(state, "p1"), state);
    });

    it("allows a plant to move into an empty board cell", function () {
        const state = mkState({
            plants: [{id: "p1", row: 2, col: 2}]
        });
        assert.equal(canMovePlant(state, "p1", "left"), true);

        const next = movePlant(state, "p1", "left");
        assert.deepEqual(getPlants(next), [{id: "p1", row: 2, col: 1}]);
        assert.equal(getMoveCount(next), 1);
    });

    it("blocks plant movement into invalid cells", function () {
        const blockedCases = [
            {
                label: "outside board",
                direction: "up",
                plant: {row: 0, col: 2}
            },
            {label: "wall", direction: "up", wall: {row: 1, col: 2}},
            {label: "zombie", direction: "up", zombie: {row: 1, col: 2}},
            {label: "Dave", direction: "down", dave: {row: 3, col: 2}},
            {label: "exit", direction: "up", exit: {row: 1, col: 2}},
            {
                label: "plant",
                direction: "right",
                otherPlant: {row: 2, col: 3}
            }
        ];

        blockedCases.forEach(function (testCase) {
            const state = mkState({
                dave: testCase.dave || {row: 5, col: 5},
                exit: testCase.exit || {row: 0, col: 6},
                plants: [
                    Object.assign({id: "p1"}, testCase.plant || {
                        row: 2,
                        col: 2
                    }),
                    (
                        testCase.otherPlant
                        ? Object.assign({id: "p2"}, testCase.otherPlant)
                        : {id: "p2", row: 6, col: 6}
                    )
                ],
                walls: (
                    testCase.wall
                    ? [testCase.wall]
                    : []
                ),
                zombies: (
                    testCase.zombie
                    ? [Object.assign({id: "z1"}, testCase.zombie)]
                    : []
                )
            });
            assert.equal(
                canMovePlant(state, "p1", testCase.direction),
                false,
                testCase.label
            );
            assert.equal(movePlant(state, "p1", testCase.direction), state);
        });
    });

    it("moves the currently selected plant", function () {
        const state = mkState({
            selectedUnitId: "p1",
            plants: [{id: "p1", row: 2, col: 2}]
        });
        assert.equal(canMoveSelectedUnit(state, "right"), true);

        const next = moveSelectedUnit(state, "right");
        assert.deepEqual(getPlants(next), [{id: "p1", row: 2, col: 3}]);
    });

    it("moving the selected plant triggers the zombie turn", function () {
        const state = mkState({
            rows: 8,
            cols: 8,
            dave: {row: 6, col: 6},
            exit: {row: 0, col: 6},
            selectedUnitId: "p1",
            plants: [{id: "p1", row: 2, col: 2}],
            zombies: [{id: "z1", row: 0, col: 0}]
        });
        const next = moveSelectedUnit(state, "right");
        const zombie = getZombies(next)[0];
        assert.deepEqual(getPlants(next), [{id: "p1", row: 2, col: 3}]);
        assert.deepEqual({row: zombie.row, col: zombie.col}, {
            row: 0,
            col: 1
        });
    });

    it("selected Dave still moves through the selected-unit API", function () {
        const state = mkState({selectedUnitId: "dave"});
        const next = moveSelectedUnit(state, "up");
        assert.deepEqual(getDave(next), {row: 2, col: 3});
    });

    it("moving a plant triggers the zombie turn", function () {
        const state = mkState({
            rows: 8,
            cols: 8,
            dave: {row: 6, col: 6},
            exit: {row: 0, col: 6},
            plants: [{id: "p1", row: 2, col: 2}],
            zombies: [{id: "z1", row: 0, col: 0}]
        });
        const next = movePlant(state, "p1", "right");
        const zombie = getZombies(next)[0];
        assert.deepEqual(getPlants(next), [{id: "p1", row: 2, col: 3}]);
        assert.deepEqual({row: zombie.row, col: zombie.col}, {
            row: 0,
            col: 1
        });
    });

    it("falls back to Dave when the selected plant is destroyed", function () {
        const state = mkState({
            dave: {row: 6, col: 3},
            selectedUnitId: "p1",
            plants: [{id: "p1", row: 4, col: 3}],
            zombies: [{
                id: "z1",
                row: 3,
                col: 3,
                ability: "crusher",
                size: 1
            }]
        });
        const next = moveZombies(state);
        assert.equal(getPlants(next).length, 0);
        assert.equal(getSelectedUnit(next), "dave");
    });
});

// ─── Win condition ───────────────────────────────────────────────────────────

describe("winning", function () {
    it("reaching the exit sets status to 'won'", function () {
        const state = mkState({
            dave: {row: 1, col: 3},
            exit: {row: 0, col: 3}
        });
        const next = moveDave(state, "up");
        assert.equal(getStatus(next), "won");
        assert.equal(isWon(next), true);
    });

    it("once won, further moveDave calls return unchanged state", function () {
        const state = mkState({
            dave: {row: 1, col: 3},
            exit: {row: 0, col: 3}
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
        // Zombie moves from (3,1) to (3,2), adjacent to Dave at (3,3).
        const state = mkState({
            dave: {row: 3, col: 3},
            zombies: [{id: "z1", row: 3, col: 1}]
        });
        const next = moveZombies(state);
        assert.equal(getStatus(next), "lost");
        assert.equal(isLost(next), true);
    });

    it("zombie reaching Dave's cell sets status to 'lost'", function () {
        // Zombie at (3,2), Dave at (3,3). Zombie can step directly onto Dave.
        const state = mkState({
            dave: {row: 3, col: 3},
            zombies: [{id: "z1", row: 3, col: 2}]
        });
        const next = moveZombies(state);
        assert.equal(getStatus(next), "lost");
    });

    it("a diagonally adjacent zombie does not make Dave lose", function () {
        const state = mkState({
            dave: {row: 3, col: 3},
            zombies: [{id: "z1", row: 2, col: 2}],
            walls: [
                {row: 1, col: 2},
                {row: 2, col: 1},
                {row: 2, col: 3},
                {row: 3, col: 2}
            ]
        });
        const next = moveZombies(state);
        assert.equal(getStatus(next), "playing");
    });

    it("once lost, further moveDave calls return unchanged state", function () {
        const state = mkState({status: "lost"});
        const after = moveDave(state, "up");
        assert.equal(getStatus(after), "lost");
    });
});

// ─── Zombie AI ───────────────────────────────────────────────────────────────

describe("zombie AI", function () {
    it("zombie moves toward Dave when a closer cell is available", function () {
        // Zombie directly above Dave in same column – moves down.
        const state = mkState({
            dave: {row: 5, col: 3},
            zombies: [{id: "z1", row: 2, col: 3}]
        });
        const next = moveZombies(state);
        const z = getZombies(next)[0];
        assert.equal(z.row, 3); // moved down toward Dave
        assert.equal(z.col, 3);
    });

    it("zombie stays when no legal move reduces distance", function () {
        // The direct path is blocked and every other direction is farther.
        const state = mkState({
            dave: {row: 5, col: 3},
            zombies: [{id: "z1", row: 2, col: 3}],
            walls: [
                {row: 2, col: 2}, {row: 2, col: 4},
                {row: 1, col: 3}, {row: 3, col: 3}
            ]
        });
        const next = moveZombies(state);
        const z = getZombies(next)[0];
        assert.equal(z.row, 2);
        assert.equal(z.col, 3);
    });

    it("zombie dies when it moves into a plant", function () {
        // The plant is directly between the zombie and Dave.
        const state = mkState({
            dave: {row: 6, col: 3},
            zombies: [{id: "z1", row: 3, col: 3}],
            plants: [{id: "p1", row: 4, col: 3}]
        });
        const next = moveZombies(state);
        assert.equal(getZombies(next).length, 0);
        assert.deepEqual(getPlants(next), [{id: "p1", row: 4, col: 3}]);
        assert.equal(getStatus(next), "playing");
    });

    it("zombie cannot move through walls", function () {
        const state = mkState({
            dave: {row: 6, col: 3},
            zombies: [{id: "z1", row: 3, col: 3}],
            walls: [
                {row: 4, col: 3}, // blocks downward
                {row: 3, col: 2}, {row: 3, col: 4}, // blocks sideways
                {row: 2, col: 3} // blocks upward
            ]
        });
        const next = moveZombies(state);
        const z = getZombies(next)[0];
        assert.equal(z.row, 3);
        assert.equal(z.col, 3);
    });

    it("zombie cannot move onto or through the exit", function () {
        const state = mkState({
            dave: {row: 5, col: 3},
            exit: {row: 3, col: 3},
            zombies: [{id: "z1", row: 2, col: 3}],
            walls: [
                {row: 1, col: 3},
                {row: 2, col: 2},
                {row: 2, col: 4}
            ]
        });
        const next = moveZombies(state);
        const z = getZombies(next)[0];
        assert.equal(z.row, 2);
        assert.equal(z.col, 3);
        assert.equal(getStatus(next), "playing");
    });

    it("a crusher destroys a plant and stops for that turn", function () {
        const state = mkState({
            dave: {row: 6, col: 3},
            zombies: [{
                id: "z1",
                row: 3,
                col: 3,
                ability: "crusher",
                size: 1
            }],
            plants: [{id: "p1", row: 4, col: 3}]
        });
        const next = moveZombies(state);
        const z = getZombies(next)[0];
        assert.deepEqual({row: z.row, col: z.col}, {row: 3, col: 3});
        assert.equal(getPlants(next).length, 0);
    });

    it("a jumper leaps over one plant and marks its jump as used", function () {
        const state = mkState({
            dave: {row: 6, col: 3},
            zombies: [{
                id: "z1",
                row: 2,
                col: 3,
                ability: "jumper",
                size: 1,
                jumpUsed: false
            }],
            plants: [{id: "p1", row: 3, col: 3}]
        });
        const next = moveZombies(state);
        const z = getZombies(next)[0];
        assert.deepEqual({row: z.row, col: z.col}, {row: 4, col: 3});
        assert.equal(z.jumpUsed, true);
        assert.equal(getPlants(next).length, 1);
    });

    it("a jumper cannot jump over a second plant", function () {
        const state = mkState({
            dave: {row: 6, col: 3},
            zombies: [{
                id: "z1",
                row: 2,
                col: 3,
                ability: "jumper",
                size: 1,
                jumpUsed: true
            }],
            plants: [{id: "p1", row: 3, col: 3}]
        });
        const next = moveZombies(state);
        assert.equal(getZombies(next).length, 0);
        assert.equal(getPlants(next).length, 1);
    });

    it("a giant destroys obstacles in its destination footprint", function () {
        const state = mkState({
            rows: 8,
            cols: 8,
            dave: {row: 6, col: 3},
            exit: {row: 0, col: 7},
            zombies: [{
                id: "z1",
                row: 2,
                col: 3,
                ability: "giant",
                size: 2
            }],
            plants: [{id: "p1", row: 4, col: 3}],
            walls: [{row: 4, col: 4}]
        });
        const next = moveZombies(state);
        const z = getZombies(next)[0];
        assert.deepEqual({row: z.row, col: z.col}, {row: 3, col: 3});
        assert.equal(getPlants(next).length, 0);
        assert.equal(getWalls(next).length, 0);
        assert.equal(isCellOccupied(next, {row: 4, col: 4}), true);
    });

    it("two zombies do not occupy the same cell", function () {
        // Both zombies want to move right into the same cell.
        const state = mkState({
            dave: {row: 3, col: 6},
            zombies: [
                {id: "z1", row: 3, col: 3},
                {id: "z2", row: 3, col: 4}
            ]
        });
        const next = moveZombies(state);
        const [z1, z2] = getZombies(next);
        assert.notDeepEqual(
            {row: z1.row, col: z1.col},
            {row: z2.row, col: z2.col}
        );
    });

    it("prefers up over right when distances are equal", function () {
        // From (3,1), up and right are equally close to Dave at (2,2).
        // Both equally good; up comes first.
        const state = mkState({
            dave: {row: 2, col: 2},
            zombies: [{id: "z1", row: 3, col: 1}]
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
        const state = mkState({dave: {row: 3, col: 3}});
        assert.equal(isCellOccupied(state, {row: 3, col: 3}), true);
    });

    it("returns true for a wall cell", function () {
        const state = mkState({walls: [{row: 1, col: 1}]});
        assert.equal(isCellOccupied(state, {row: 1, col: 1}), true);
    });

    it("returns true for a plant cell", function () {
        const state = mkState({plants: [{id: "p1", row: 2, col: 2}]});
        assert.equal(isCellOccupied(state, {row: 2, col: 2}), true);
    });

    it("returns true for a zombie cell", function () {
        const state = mkState({zombies: [{id: "z1", row: 4, col: 4}]});
        assert.equal(isCellOccupied(state, {row: 4, col: 4}), true);
    });

    it("returns false for an empty cell", function () {
        const state = mkState({dave: {row: 3, col: 3}});
        assert.equal(isCellOccupied(state, {row: 0, col: 0}), false);
    });
});

// ─── API purity and invalid inputs ──────────────────────────────────────────

describe("API purity and invalid inputs", function () {
    it("moveDave does not mutate the original state", function () {
        const state = mkState({
            dave: {row: 3, col: 3},
            zombies: []
        });
        const original = clone(state);

        const next = moveDave(state, "up");

        assert.deepEqual(state, original);
        assert.notEqual(next, state);
        assert.deepEqual(getDave(next), {row: 2, col: 3});
    });

    it("movePlant does not mutate the original state", function () {
        const state = mkState({
            plants: [{id: "p1", row: 2, col: 2}],
            zombies: []
        });
        const original = clone(state);

        const next = movePlant(state, "p1", "right");

        assert.deepEqual(state, original);
        assert.notEqual(next, state);
        assert.deepEqual(getPlants(next), [{id: "p1", row: 2, col: 3}]);
    });

    it("moveZombies does not mutate the original state", function () {
        const state = mkState({
            dave: {row: 5, col: 3},
            zombies: [{id: "z1", row: 2, col: 3}]
        });
        const original = clone(state);

        const next = moveZombies(state);

        assert.deepEqual(state, original);
        assert.notEqual(next, state);
        assert.deepEqual(getZombies(next), [{
            id: "z1",
            row: 3,
            col: 3,
            jumpUsed: false
        }]);
    });

    it("getter results cannot mutate the game state", function () {
        const state = mkState({
            dave: {row: 3, col: 3},
            exit: {row: 0, col: 3},
            plants: [{id: "p1", row: 2, col: 2}],
            zombies: [{id: "z1", row: 1, col: 1}],
            walls: [{row: 4, col: 4}]
        });

        const dave = getDave(state);
        const exit = getExit(state);
        const plants = getPlants(state);
        const zombies = getZombies(state);
        const walls = getWalls(state);
        const selectable = getSelectableUnits(state);

        dave.row = 99;
        exit.col = 99;
        plants[0].row = 99;
        zombies[0].col = 99;
        walls[0].row = 99;
        selectable[1].row = 99;

        assert.deepEqual(state.dave, {row: 3, col: 3});
        assert.deepEqual(state.exit, {row: 0, col: 3});
        assert.deepEqual(state.plants, [{id: "p1", row: 2, col: 2}]);
        assert.deepEqual(state.zombies, [{id: "z1", row: 1, col: 1}]);
        assert.deepEqual(state.walls, [{row: 4, col: 4}]);
    });

    it("invalid movement inputs return unchanged state", function () {
        const state = mkState({
            selectedUnitId: "missing",
            plants: [{id: "p1", row: 2, col: 2}]
        });

        assert.equal(canMoveDave(state, "north"), false);
        assert.equal(moveDave(state, "north"), state);
        assert.equal(canMovePlant(state, "missing", "up"), false);
        assert.equal(movePlant(state, "missing", "up"), state);
        assert.equal(canMoveSelectedUnit(state, "up"), false);
        assert.equal(moveSelectedUnit(state, "up"), state);
    });
});

// ─── resetGame ───────────────────────────────────────────────────────────────

describe("resetGame", function () {
    it("returns a fresh state with the expected structure", function () {
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
