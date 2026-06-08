import assert from "node:assert/strict";
import {canMoveDave} from "../game.js";

describe("giant zombie collision", function () {
    it("prevents Dave entering any cell in a giant zombie's 2x2 footprint", function () {
        const state = {
            rows: 8,
            cols: 8,
            dave: {row: 4, col: 2},
            exit: {row: 0, col: 7},
            plants: [],
            walls: [],
            zombies: [{
                id: "z1",
                row: 2,
                col: 2,
                size: 2,
                ability: "giant"
            }],
            status: "playing",
            turn: "player",
            moveCount: 0
        };

        assert.equal(canMoveDave(state, "up"), false);
    });
});
