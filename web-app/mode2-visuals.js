const PLANT_SKINS = [
    {id: "pea", asset: "assets/characters/plants/plant-pea.svg"},
    {id: "ice", asset: "assets/characters/plants/plant-ice.svg"},
    {id: "repeater", asset: "assets/characters/plants/plant-repeater.svg"},
    {id: "corn", asset: "assets/characters/plants/plant-corn.svg"},
    {id: "sunflower", asset: "assets/characters/plants/plant-sunflower.svg"}
];

const ZOMBIE_SKINS = {
    basic: "assets/characters/zombies/zombie-basic.svg",
    cone: "assets/characters/zombies/zombie-cone.svg",
    newspaper: "assets/characters/zombies/zombie-newspaper.svg",
    football: "assets/characters/zombies/zombie-football.svg",
    polevault: "assets/characters/zombies/zombie-polevault.svg",
    gargantuar: "assets/characters/zombies/zombie-gargantuar.svg"
};

const MODE2_DIFFICULTY_CONFIG = {
    "1": {
        background: "assets/backgrounds/bg-day-house.svg",
        zombieSkins: ["basic", "cone"],
        requireAllZombieSkins: true
    },
    "2": {
        background: "assets/backgrounds/bg-night-house.svg",
        zombieSkins: ["basic", "cone"],
        requireAllZombieSkins: true
    },
    "3": {
        background: "assets/backgrounds/bg-pool-day.svg",
        zombieSkins: ["newspaper", "football"],
        requireAllZombieSkins: true
    },
    "4": {
        background: "assets/backgrounds/bg-roof-day.svg",
        zombieSkins: ["polevault"],
        requireAllZombieSkins: false
    },
    "5": {
        background: "assets/backgrounds/bg-egypt-day.svg",
        zombieSkins: ["gargantuar"],
        requireAllZombieSkins: false
    }
};

const shuffled = function (items, random) {
    return items.reduce(function (result, item, index) {
        const copy = result.slice();
        const target = Math.floor(random() * (index + 1));
        copy.splice(target, 0, item);
        return copy;
    }, []);
};

const assignRandomPlantSkins = function (plants, random = Math.random) {
    if (plants.length === 0) {
        return [];
    }
    const variety = Math.min(plants.length, 3, PLANT_SKINS.length);
    const guaranteed = shuffled(PLANT_SKINS, random).slice(0, variety);
    return plants.map(function (plant, index) {
        const skin = (
            index < guaranteed.length
            ? guaranteed[index]
            : PLANT_SKINS[Math.floor(random() * PLANT_SKINS.length)]
        );
        return Object.assign({}, plant, {skinId: skin.id});
    });
};

const assignZombieSkins = function (
    zombies,
    difficulty,
    random = Math.random
) {
    const config = (
        MODE2_DIFFICULTY_CONFIG[difficulty] ||
        MODE2_DIFFICULTY_CONFIG[1]
    );
    const required = (
        config.requireAllZombieSkins
        ? shuffled(config.zombieSkins, random)
        : []
    );
    return zombies.map(function (zombie, index) {
        const skinId = (
            index < required.length
            ? required[index]
            : config.zombieSkins[
                Math.floor(random() * config.zombieSkins.length)
            ]
        );
        return Object.assign({}, zombie, {skinId});
    });
};

const getPlantSkin = function (skinId) {
    return PLANT_SKINS.find((skin) => skin.id === skinId) || PLANT_SKINS[0];
};

const getZombieAsset = (skinId) => (
    ZOMBIE_SKINS[skinId] || ZOMBIE_SKINS.basic
);

export {
    PLANT_SKINS,
    ZOMBIE_SKINS,
    MODE2_DIFFICULTY_CONFIG,
    assignRandomPlantSkins,
    assignZombieSkins,
    getPlantSkin,
    getZombieAsset
};
