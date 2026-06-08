import assert from "node:assert/strict";
import {
    MODE2_DIFFICULTY_CONFIG,
    assignRandomPlantSkins,
    assignZombieSkins
} from "../mode2-visuals.js";

const zeroRandom = () => 0;
const plants = [
    {id: "p1", row: 1, col: 1},
    {id: "p2", row: 2, col: 2},
    {id: "p3", row: 3, col: 3},
    {id: "p4", row: 4, col: 4}
];
const zombies = [
    {id: "z1", row: 1, col: 1},
    {id: "z2", row: 1, col: 2},
    {id: "z3", row: 1, col: 3}
];

describe("Mode 2 visual configuration", function () {
    it("assigns at least three plant skins when three plants exist", function () {
        const assigned = assignRandomPlantSkins(plants, zeroRandom);
        assert.ok(new Set(assigned.map((plant) => plant.skinId)).size >= 3);
    });

    it("uses basic and cone zombies in difficulties 1 and 2", function () {
        [1, 2].forEach(function (difficulty) {
            const assigned = assignZombieSkins(zombies, difficulty, zeroRandom);
            const skins = new Set(assigned.map((zombie) => zombie.skinId));
            assert.equal(skins.has("basic"), true);
            assert.equal(skins.has("cone"), true);
        });
    });

    it("uses newspaper and football zombies in difficulty 3", function () {
        const assigned = assignZombieSkins(zombies, 3, zeroRandom);
        const skins = new Set(assigned.map((zombie) => zombie.skinId));
        assert.equal(skins.has("newspaper"), true);
        assert.equal(skins.has("football"), true);
    });

    it("uses only pole-vault zombies in difficulty 4", function () {
        const assigned = assignZombieSkins(zombies, 4, zeroRandom);
        assert.ok(assigned.every((zombie) => zombie.skinId === "polevault"));
    });

    it("uses only gargantuar zombies in difficulty 5", function () {
        const assigned = assignZombieSkins(zombies, 5, zeroRandom);
        assert.ok(assigned.every((zombie) => zombie.skinId === "gargantuar"));
    });

    it("provides a unique scene background for each difficulty", function () {
        const backgrounds = Object.values(MODE2_DIFFICULTY_CONFIG).map(
            (config) => config.background
        );
        assert.equal(new Set(backgrounds).size, 5);
    });
});
