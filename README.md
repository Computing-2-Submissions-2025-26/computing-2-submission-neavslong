[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/H6lPFq0J)

# Computing 2 Coursework Submission

**CID**: 02600255

## Project Overview

Dave's Escape is a turn-based, board-based puzzle game inspired by Klotski
movement puzzles and Plants vs. Zombies. The player guides Dave to the exit
while using movable plants to influence zombie paths.

The project has two user-facing modes:

- **Random Challenge**: generates a new playable board each round and tracks a
  win streak.
- **Campaign Mode**: presents five escalating difficulty levels with special
  zombie behaviours.

The assessed game rules and state transitions are implemented in
`web-app/game.js`. The browser interface in `web-app/main.js` renders the game
state, handles user input, and calls the game module API. Visual styling is kept
in `web-app/default.css`.

## Running the Project

Install dependencies:

```bash
npm install
```

Run the unit tests:

```bash
npm test
```

Run JavaScript syntax checks:

```bash
npm run lint
```

Generate the API documentation:

```bash
npm run docs
```

Start a local static server for the web application:

```bash
cd web-app
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/
```

After generating documentation, open:

```text
docs/index.html
```

## Game Module API Specification

The main API is documented with JSDoc in `web-app/game.js`. These are the core
domain functions used by the web application and tests.

| Function | Signature | Purpose |
|---|---|---|
| `createGame` | `createGame() -> GameState` | Creates a fresh random challenge. |
| `generatePlayableLevel` | `generatePlayableLevel(seed?) -> GameState` | Creates a playable level, optionally deterministic for tests. |
| `createCampaignGame` | `createCampaignGame(difficulty, seed?) -> GameState` | Creates a campaign level for difficulties 1-5. |
| `advanceCampaignProgress` | `advanceCampaignProgress(progress, levelMoves) -> CampaignProgress` | Updates campaign progress after a win. |
| `selectUnit` | `selectUnit(state, unitId) -> GameState` | Selects Dave or a movable plant. |
| `moveDave` | `moveDave(state, direction) -> GameState` | Moves Dave if the move is legal. |
| `movePlant` | `movePlant(state, plantId, direction) -> GameState` | Moves a plant if the move is legal. |
| `moveSelectedUnit` | `moveSelectedUnit(state, direction) -> GameState` | Moves the currently selected unit. |
| `moveZombies` | `moveZombies(state) -> GameState` | Advances the zombie turn and resolves collisions. |
| `canMoveDave` | `canMoveDave(state, direction) -> boolean` | Checks whether Dave can move. |
| `canMovePlant` | `canMovePlant(state, plantId, direction) -> boolean` | Checks whether a plant can move. |
| `canMoveSelectedUnit` | `canMoveSelectedUnit(state, direction) -> boolean` | Checks whether the selected unit can move. |
| `isInsideBoard` | `isInsideBoard(state, position) -> boolean` | Checks board bounds. |
| `isCellOccupied` | `isCellOccupied(state, position) -> boolean` | Checks whether a cell is occupied. |
| `isAdjacent` | `isAdjacent(posA, posB) -> boolean` | Checks orthogonal adjacency. |
| `isWon` | `isWon(state) -> boolean` | Checks the win state. |
| `isLost` | `isLost(state) -> boolean` | Checks the loss state. |
| `resetGame` | `resetGame() -> GameState` | Creates a fresh random challenge. |

Getter functions such as `getDave`, `getPlants`, `getZombies`, `getWalls`, and
`getExit` provide read access to the current state. They return copies of
mutable objects so callers cannot accidentally mutate the game state through the
API.

## Game Module Implementation

`web-app/game.js` contains the game state and rules. State-changing functions
return a new state object for valid actions and return the original state for
invalid actions. This keeps the browser interface separate from the core game
logic and allows the game to be simulated directly in code or in tests.

The implementation includes:

- random level generation with path checking
- deterministic seeded generation for tests
- Dave movement and plant movement
- zombie AI movement toward Dave
- win and loss resolution
- campaign progression across five difficulties
- special zombie abilities for crusher, jumper, and giant zombies

The project also includes `npm run lint`, which checks that the JavaScript files
parse correctly in Node's ES module runtime. The available `jslint` npm package
does not support this project's modern `import`/`export` and `const` syntax, so
the syntax check is used as the reliable cross-platform lint command for this
submission.

## Unit Test Specification

The tests in `web-app/tests` specify expected behaviour for the game module.
They focus on observable behaviour rather than DOM rendering or implementation
details.

### Board Creation

- A new game creates an 8 by 8 board.
- Dave, the exit, plants, zombies, and walls are placed inside the board.
- Generated levels include a playable route to the exit.
- Plants are placed in useful board positions with neighbouring cells.

### Dave Movement

- Dave can move into empty cells.
- Dave cannot move outside the board.
- Dave cannot move into walls, plants, or zombies.
- A valid move increments the move count.
- An invalid move returns the unchanged state.
- Reaching the exit sets the game status to `won`.

### Plant Selection and Movement

- Dave and all plants are selectable units.
- Unknown units cannot be selected.
- Selection cannot change after the game has ended.
- Plants can move into empty cells.
- Plants cannot move into occupied cells, the exit, or outside the board.
- Moving a plant triggers the zombie turn.

### Zombie Behaviour

- Zombies move toward Dave when a closer legal cell is available.
- Zombies do not move through walls, other zombies, or the exit.
- Normal zombies are destroyed when they move into plants.
- Crusher zombies destroy a plant and stop for that turn.
- Jumper zombies can leap over one plant once.
- Giant zombies occupy a 2 by 2 footprint and destroy plants and walls in their
  destination footprint.

### Win and Loss Conditions

- The game is won when Dave reaches the exit.
- The game is lost when a zombie reaches Dave or becomes orthogonally adjacent
  to him.
- Diagonal adjacency alone does not trigger a loss.
- After a win or loss, further movement calls return the unchanged state.

### Campaign Mode

- Each campaign difficulty creates the expected zombie count and ability.
- Difficulty 1 must be cleared twice before advancing.
- Difficulties 2-5 advance once each.
- Campaign progress records total moves and marks completion after difficulty 5.

### Purity and Invalid Inputs

- Movement functions do not mutate the original state.
- Getter functions return copies rather than mutable internal references.
- Invalid directions and invalid plant ids return the unchanged state.

## Unit Test Implementation

The tests are implemented with Mocha and Node's `assert/strict` module.

```bash
npm test
```

Current coverage includes:

- `web-app/tests/game.test.js`
- `web-app/tests/giant-zombie.test.js`
- `web-app/tests/mode2-visuals.test.js`

## Web Application

The web application is implemented in `web-app`.

- `index.html` contains semantic page structure and game controls.
- `default.css` contains visual styling and layout.
- `main.js` handles DOM rendering, input events, and calls to the game module.
- `mode2-visuals.js` maps campaign difficulty to visual assets.

The interface supports mouse/touch controls and keyboard controls. It uses
semantic buttons, labelled grid cells, `aria-live` status updates, and visible
game-state feedback for playing, won, lost, and campaign-complete states.

## Submission Checklist

### Game Module - API

- [x] The API and JSDoc type definitions are in `web-app/game.js`.
- [x] `jsdoc.json` includes `web-app/game.js`.
- [x] The API documentation can be generated with `npm run docs`.
- [x] Generated documentation is available in `docs`.

### Game Module - Implementation

- [x] The game module is implemented in `web-app/game.js`.
- [x] Game rules can be simulated from code through the exported API.
- [x] State-changing functions return new states for valid actions.
- [x] Invalid actions return the unchanged state.

### Unit Tests - Specification

- [x] Behavioural test specifications are described in this README.
- [x] Test descriptions are written with `describe` and `it` blocks in
  `web-app/tests`.

### Unit Tests - Implementation

- [x] Unit tests are implemented in `web-app/tests`.
- [x] Tests can be run with `npm test`.
- [x] Tests cover movement, selection, zombie AI, win/loss conditions,
  campaign progress, visual configuration, and API purity.

### Web Application

- [x] `web-app/index.html` contains the browser UI structure.
- [x] `web-app/default.css` contains styling.
- [x] `web-app/main.js` contains UI behaviour and DOM rendering.
- [x] The UI references `web-app/game.js` for game rules.
- [x] Assets are included in `web-app/assets`.

### Final Checks

- [x] Dependencies are listed in `package.json`.
- [x] JavaScript syntax checks can be run with `npm run lint`.
- [x] `node_modules` is excluded from submission.
- [x] The project keeps game logic, page structure, styling, and UI behaviour in
  separate files.
