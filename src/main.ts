/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

import "./style.css";

import { BehaviorSubject, from, fromEvent, interval, merge} from "rxjs";
import { map, filter, scan, switchMap, distinctUntilChanged} from "rxjs/operators";

/** Constants */

const CONSTANTS = {
  addScore: 8
}

const Viewport = {
  CANVAS_WIDTH: 200,
  CANVAS_HEIGHT: 400,
  PREVIEW_WIDTH: 160,
  PREVIEW_HEIGHT: 80,
} as const;

const Constants = {
  TICK_RATE_MS: 500,
  GRID_WIDTH: 10,
  GRID_HEIGHT: 20,
} as const;

const Block = {
  WIDTH: Viewport.CANVAS_WIDTH / Constants.GRID_WIDTH,
  HEIGHT: Viewport.CANVAS_HEIGHT / Constants.GRID_HEIGHT,
};

//--------------- new class --------------------
interface Action { //source: https://stackblitz.com/edit/asteroids2023?file=src%2Fmain.ts,src%2Ftypes.ts
  apply(s: State): State;
}

class Keys {
  constructor(public readonly code: String) {}
}

class Tick {
  constructor(public readonly elapsed: number) {}
}

class Restart{
  constructor(public readonly initialState: State){}

  restartTheGame(): State{
    // Assumes that updateStateFunction is a function that will update your game state.
    return {...this.initialState};
  }
}

interface Point {
  x: number;
  y: number;
}

type Grid = {
  state: number,  // 0 for empty, 1 for filled
  colour: string  // The color of the block
}


// --------------------------------- Generative AI begin here ---------------------------------
enum Tetromino {
  J,
  I,
  L,
  O,
  S,
  T,
  Z
}

const TetrominoShapes: { [key in Tetromino]: number[][] } = {
  [Tetromino.J]: [
    [0, 0, 1],
    [1, 1, 1]
  ],
  [Tetromino.I]: [
    [1, 1, 1, 1]
  ],
  [Tetromino.L]: [
    [1, 0, 0],
    [1, 1, 1]
  ],
  [Tetromino.O]: [
    [1, 1],
    [1, 1]
  ],
  [Tetromino.S]: [
    [0, 1, 1],
    [1, 1, 0]
  ],
  [Tetromino.T]: [
    [0, 1, 0],
    [1, 1, 1]
  ],
  [Tetromino.Z]: [
    [1, 1, 0],
    [0, 1, 1]
  ],
};

const TetrominoColour: { [key in Tetromino]: string } = {
  [Tetromino.I]: "cyan",
  [Tetromino.J]: "blue",
  [Tetromino.L]: "orange",
  [Tetromino.O]: "yellow",
  [Tetromino.S]: "green",
  [Tetromino.T]: "magenta",
  [Tetromino.Z]: "red",
};
// ------------------------------- Generative AI ends here -------------------------------

class RNG { // Source: Tutorial Week 4 Exercise with some changes
  // LCG using GCC's constants
  private static m = 0x80000000; // 2**31
  private static a = 1103515245;
  private static c = 12345;

  constructor(public readonly seed: number) {}
  
  /**
   * Call `hash` repeatedly to generate the sequence of hashes.
   * @returns a hash of the seed and a RNG object with the new seed
   */
  public hash(): [number, RNG] {
    const newSeed = (RNG.a * this.seed + RNG.c) % RNG.m;
    return [newSeed, new RNG(newSeed)];
  }

  /**
   * Call `hash` repeatedly to generate the sequence of hashes.
   * @returns a randomize number as scaled and RNG object from hash.
   */
  public scale(): [number, RNG] {
    const [hash, newRNG] = this.hash();
    const scaled = (2 * hash) / (RNG.m - 1) - 1;
    return [scaled, newRNG];
  }
}
const rng = new RNG(8);
const [randomValue, newRng] = rng.scale();

const getRandomShape = (randomValue: number): Tetromino => { // Source: Generative AI with some minor changes for the scaleIndex
  const values: Tetromino[] = Object.values(Tetromino)
    .filter((value): value is Tetromino => typeof value === "number");
    // value is Tetromino means that if type of value === "number", then the type of value is Tetromino.

  const scaledIndex = Math.floor((randomValue + 1) / 2 * values.length);
  
  return values[scaledIndex];
};

const generateNewBlock = (rng:RNG): [Point[], string, RNG]  => { //generate the new block
  const [randomValue, newRng] = rng.scale()
  const shape = getRandomShape(randomValue); //get random shape of the generated block
  const color = TetrominoColour[shape]; //get the colour of the block
  const shapeGrid = TetrominoShapes[shape]; //2d array


  //for each row and its index y, and for each cell and its index x within that row, a new object is created with the updated x and y coordinates
  //then the value of cell is increment by 4 to center the new tetromino horizontally
  const points = shapeGrid
    .map((row, y) => row.map((cell, x) => ({ x: x + 4, y, cell }))) 
    .flat() //to flatten 2d array to 1d array of object
    .filter(({ cell }) => cell === 1) // filter out , 1 is to represents a filled cell
    .map(({ x, y }) => ({ x, y })); // map the object to only contain x and y which effectively removing the cell property.

    return [points, color, newRng];
};

/** User input */

type Key = "KeyS" | "KeyA" | "KeyD" | "ArrowLeft" | "ArrowRight" | "Space" | "KeyR";

type Event = "keydown" | "keyup" | "keypress";

/** Utility functions */

/** State processing */
const createGrid = () =>{ // to create the grid for the block as 2d array.
  return new Array(Constants.GRID_HEIGHT).fill(0)
  .map(row => new Array(Constants.GRID_WIDTH).fill(0));
}

const calNewTickRate = (level: number): number => {
  // Increase the tick rate every two levels starting from level 5
    // Level < 5: Constants.TICK_RATE_MS
    // Level 5-6: Constants.TICK_RATE_MS - 100
    // Level 7-8: Constants.TICK_RATE_MS - 200
    // Level 9-10: Constants.TICK_RATE_MS - 300
    // ...
    
  if (level < 5) { // level below 2 will have normal tick rate by using Constants.TICK_RATE_MS
    return Constants.TICK_RATE_MS;
  } else {
    return Constants.TICK_RATE_MS - 100 * Math.floor((level - 5) / 2 + 1); // increment the tick rate
  }
};

type State = Readonly<{
  gameEnd: boolean,
  points: Point [],
  nextPoints: Point[]
  grid: Grid [][],
  colour: string,
  nextColour: string,
  shape: Tetromino,
  score: number,
  level: number,
  blockPlaced: boolean,
  lineCleared: number,
  highScore: number,
  rng: RNG,
  ghostPoint: Point[],
  tickRate: number
}>;

const [initPoint, initColour, newRNG] = generateNewBlock(rng);
const [nextPoint, nextColour, nextRng] = generateNewBlock(newRNG);

const initialState: State = {
  gameEnd: false,
  points : initPoint,
  nextPoints: nextPoint,
  grid : createGrid(),
  colour: initColour,
  nextColour: nextColour,
  shape: getRandomShape(randomValue),
  score: 0,
  level: 0,
  blockPlaced: false,
  lineCleared: 0, 
  highScore: 0,
  rng:nextRng,
  ghostPoint: [],
  tickRate: calNewTickRate(0)
} as const;

/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
const tick = (s: State) => s;

/** Rendering (side effects) */

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGGraphicsElement) => {
  elem.setAttribute("visibility", "visible");
  elem.parentNode!.appendChild(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGGraphicsElement) =>
  elem.setAttribute("visibility", "hidden");

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
  namespace: string | null,
  name: string,
  props: Record<string, string> = {}
) => {
  const elem = document.createElementNS(namespace, name) as SVGElement;
  Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
  return elem;
};

/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main() {
  // Canvas elements
  const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
    HTMLElement;
  const preview = document.querySelector("#svgPreview") as SVGGraphicsElement &
    HTMLElement;
  const gameover = document.querySelector("#gameOver") as SVGGraphicsElement &
    HTMLElement;
  // const container = document.querySelector("#main") as HTMLElement;

  svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
  svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);
  preview.setAttribute("height", `${Viewport.PREVIEW_HEIGHT}`);
  preview.setAttribute("width", `${Viewport.PREVIEW_WIDTH}`);

  // Text fields
  const levelText = document.querySelector("#levelText") as HTMLElement;
  const scoreText = document.querySelector("#scoreText") as HTMLElement;
  const highScoreText = document.querySelector("#highScoreText") as HTMLElement;

  /** User input */
  
  const key$ = fromEvent<KeyboardEvent>(document, "keydown").pipe( // when the keyboard is pressed down
    map(event => new Keys(event.code))
  );

  const fromKey = (keyCode: Key) =>
    key$.pipe(filter(({ code }) => code === keyCode));

  const left$ = fromKey("KeyA");
  const right$ = fromKey("KeyD");
  const down$ = fromKey("KeyS");
  const space$ = fromKey("Space");
  const rotateLeft$ = fromKey("ArrowLeft");
  const rotateRight$ = fromKey("ArrowRight");
  const restart$ = fromKey("KeyR")
  
  const restartGame = new Restart({...initialState, highScore: getHighScore()}); // use this to restart the game.
  

  /** Observables */

  /** Determines the rate of time steps */

  //BehaviourSubject: is a type of observable that has an initial value and emits its current value whenever it subscribed to.  
  const tickRateSubject$ = new BehaviorSubject<number>(initialState.tickRate); //reactive way to manage the tick speed of the game (to update).
  const tick$ = tickRateSubject$.pipe(
    distinctUntilChanged(), // only update if the tick rate actually changes
    switchMap(tickRate => interval(tickRate)), // switches to a new Observable whenever the source Observable (tickRateSubject$) emits a value.
    map(elapsed => new Tick(elapsed))
  );
  
  /**
   * Calculate the game score for each line that has cleared.
   * @param rowCompleted Number of rows completed
   */
  const calcScore = (rowCompleted: number): number => rowCompleted * 100;

  
  //===================================== handle collision here ===============================================

const checkCollision = (points: Point[], grid: Grid[][]): boolean => { //Pure Function
  // Citation: Generative AI, here with some changes for the checking point.
  return points.some(point => {
    if (point.x >= Constants.GRID_WIDTH || point.y >= Constants.GRID_HEIGHT || point.x < 0 || point.y < 0){
      return true;
    }
    return grid[point.y]?.[point.x]?.state === 1 // if the grid is 1, then the grid is filled with other block return true. 0 return false.
  });
};

const handleCollision = (state: State): State => { //Pure function
  const newState = { ...state}; //initial state
  const newGridPlace = placeBlock(state.grid, state.points, state.colour); // to place the current block into grid

  newState.grid = newGridPlace; //update the grid of the placed block
  newState.blockPlaced = true; // indicate that the block has been placed

  if (newState.blockPlaced === true) { // check if the block is placed
    const [newBlock, newColor, newRng] = generateNewBlock(state.rng); // if yes, then generate the next block
    newState.rng = newRng;

    if (checkCollision(newBlock, newState.grid)) {
      //check whether the new block collides with other blocks that exist on the grid
      return { ...newState, gameEnd: true }; // game ends if a new block collides
    }
    newState.score += CONSTANTS.addScore; // add the score to the current score.
  }
  
  return newState;
};
  //============================================== Rotate Class ============================================================
  class Rotate implements Action {
    constructor(public readonly direction: number) {}
  
    public apply(state: State): State {
      // middle point is the pivot
      const pivot = state.points[Math.floor(state.points.length/2)]; //choose the pivot in the m didle

      const newPoints = state.points.map(point => {

        // Translate points so that pivot is at origin
        const pointX = point.x - pivot.x;
        const pointY = point.y - pivot.y;
    
        // Perform the rotation
        const rotatedX = this.direction === -1 ? pointY : -pointY;
        const rotatedY = this.direction === -1 ? -pointX : pointX;
    
        // Translate points back by sum the rotation point and the pivot
        const finalX = rotatedX + pivot.x;
        const finalY = rotatedY + pivot.y;
        
        return { x: finalX, y: finalY };
      });
      
      // Wall Kick
      if (checkCollision(newPoints, state.grid) || !checkRotation(newPoints)) { //Generative AI begin here
        //If the rotation results in a collision or an invalid rotation, 
        //it attempts to "kick" the block one space to the right and then one space to the left to see if that resolves the issue. 
        //If either "kick" results in a valid rotation without a collision, that new position is returned as the new state

        // Try moving one step to the right
        const moveRight = newPoints.map(point => ({ x: point.x + 1, y: point.y }));
        if (!checkCollision(moveRight, state.grid) && checkRotation(moveRight)) {
          return { ...state, points: moveRight };
        }
        
        // Try moving one step to the left
        const moveLeft = newPoints.map(point => ({ x: point.x - 1, y: point.y }));
        if (!checkCollision(moveLeft, state.grid) && checkRotation(moveLeft)) {
          return { ...state, points: moveLeft };
        }
        return state
      } // Generative AI ends here
    
      return { ...state, points: newPoints };
    }
  }
  //==================================================================================================================

  function checkPlaceblock(state: State): boolean { // checks if there is any filled cell in the first row of the grid within the game state.
    //used to check if any blocks have reached the top row of the grid (game over).
    return state.grid[0].some(cell => cell?.state === 1);
  }

  const updateGhostPlace = (state:State) =>{ // to update the state including the ghost piece points.
    const ghostPoints = calculateGhostPiece(state.points, state.grid);
    return {...state, ghostPoint: ghostPoints};
  }

  const handleLineClearing = (state: State): State => {
    const [newGrid, linesClearedTotal] = clearLines(state.grid); // to get a new grid with full lines removed.
    const newScore = state.score + calcScore(linesClearedTotal); // update the score based on the number of total lines cleared
    
    const totalLinesCleared = state.lineCleared + linesClearedTotal; //sum the total lines cleared so far
    const newLevel = totalLinesCleared >=5? Math.floor(totalLinesCleared / 5) : 0;  // Increase level every 5 lines cleared
    const newTickRate = calNewTickRate(newLevel); //calculate the new tick rate based on the current level

    const [newPoints, newColour] = generateNewBlock(state.rng); //generate new points and color for the next block which will appear on the screen.
    
    // updates the various properties of the game state 
    return updateGhostPlace({
      ...state,
      grid: newGrid, 
      score: newScore,
      level: newLevel, 
      blockPlaced: false,
      points: state.nextPoints, //take the initialState's next point as the current point.
      nextPoints: newPoints,  // Update nextPoints
      colour: state.nextColour, // Update current color to next color
      nextColour: newColour,
      lineCleared: totalLinesCleared, //update the total lines has been cleared
      tickRate: newTickRate
    });
  };

  const reduceKey = (state:State, event: Keys): State =>{// to handle all the user input
    //if game is over and user press "r" which indicates to restart the game
    if (state.gameEnd === true && event.code === "KeyR") {
      return {...initialState} }
    
    if (state.gameEnd) {return state;}

    else { 
      // When the user press "r" on their keyboard, it will restart the game by returning the initalState.
      if (event.code == "KeyR"){ return {...initialState}; }

      // When the user perform a rotation anti-clockwise or clockwise.
      if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
        const direction = event.code === "ArrowLeft" ? -1 : 1; //-1 for anti-clockwise, 1 for clockwise
        const newState = new Rotate(direction).apply(state);
        return updateGhostPlace(newState) //return a state calculated with the ghost piece position.
      }

      // When the user wants to drop the block by pressing space
      else if (event.code === "Space"){
        const newPoint = dropTheBlock(state.points, state.grid);
        const newState = {...state, points: newPoint}
        return handleLineClearing(handleCollision(newState)); //check whether it's full line and collision detected
      }
      
      // Movement by user keyboard press and it will update the position of the active block.
      const pointDetect = 
        event.code === "KeyA" ? updatePosition(state.points, "left") :
        event.code === "KeyD" ? updatePosition(state.points, "right") :
        event.code === "KeyS" ? updatePosition(state.points, "down") :
        null;

      // place the block inside the grid
      const newGridPlace = placeBlock(state.grid, state.points, state.colour);

      //if pointDetect is not null and not collision detected with any other blocks.
      if (pointDetect && !checkCollision(pointDetect, state.grid)){
        return updateGhostPlace({ ...state, points: pointDetect})
      }
      // if pointDetect is not null and collision detected
      else if (pointDetect && checkCollision(pointDetect, state.grid)) {
        const newState = handleCollision(state) //handle the collision
        return handleLineClearing(updateGhostPlace(newState)); //return the newState by checkin the line with handleLineClearing
      }

      // place the block
      const newState = { ...state, grid: newGridPlace, blockPlaced: true}; 
      return handleLineClearing(newState);
    }
  }


  const reduceTick = (state: State): State => { // handle the tick
    // if the game is over
    if (state.gameEnd) {
      return state;
    }
    // Handle tick events (block falling down)
    const newPoint = updatePosition(state.points, "down")

    if (!state.points.length) {
      // Initialize the first and next blocks if game just started
      const [newPoints, newColour] = generateNewBlock(state.rng);

      return updateGhostPlace({ 
        ...state,
        points: state.nextPoints,
        colour: state.nextColour,
        nextPoints: newPoints,
        nextColour: newColour,
      });
    }
    
    // each tick the block falls down
    // if no collision detected
    if(!checkCollision(newPoint, state.grid)){ return updateGhostPlace({ ...state, points: newPoint });} //the first ghost piece to show during tick
    
    else{
      const newState = handleCollision(state); //handle the collision
      
      if (checkPlaceblock(newState)) {return { ...newState, gameEnd: true };}
      
      return handleLineClearing(newState);
    }
      
  }

  //==================================== Reduce State ======================================================

  const reduceState = (state: State, event: Keys| Tick| Rotate): State => { //Pure function
    if (event instanceof Keys) { // check if event is instance of Keys
      return reduceKey(state, event);
    } 
    else if (event instanceof Tick) { // check if event is instance of Tick
      return reduceTick(state);
    }
    return state
  }

  //========================================= End ==========================================================

  const dropTheBlock = (points:Point[], grid: Grid[][]): Point[] =>{ // recursive
    const newPoint = updatePosition(points,"down"); // to update the position one step downwards
    if(checkCollision(newPoint, grid)){ // to check whether the current point is collide with any existing blocks in the grid or exceed the grid
      return points
    }
    return dropTheBlock(newPoint, grid); // recurse to find the lowest place it can land
  }

  const clearLines = (grid: Grid[][]): [Grid[][], number] => {
    // Filter out rows that are full
    const clearedGrid = grid.filter(row => !row.every(cell => cell?.state === 1));
    
    // count the number of lines cleared
    const linesCleared = grid.length - clearedGrid.length;
    
    // Add new empty rows at the top
    const newRows = Array.from({ length: linesCleared }, () => new Array(Constants.GRID_WIDTH).fill(0));

    // Concatenate the new empty rows with the cleared grid
    const newGrid = [...newRows, ...clearedGrid];
    
    return [newGrid, linesCleared];
  };


  const placeBlock = (grid: Grid[][], points: Point[], colour:string): Grid[][] =>{ // Pure function
    //The function returns a new 2D array which is a modified version of the original grid. 
    //In this modified grid, each cell that matches the x and y coordinates of any point in the points array is set to 1. 
    //All other cells retain their original values.

    return grid.map((row, indexr) => { // the row index stored in indexr
      return row.map((acc, indexc) => {
        if (points.some(point => point.y === indexr && point.x === indexc)){ 
          //checks whether any of the points match the current cell's row and column using some
          // some: tests whether at least one element in the array meets the condition defined in callback function and return true.
          return {state: 1, colour: colour}
        }
        return acc
    })});
  }

  const updatePosition = (points: Point[], direction: "left" | "right" | "down"): Point[] => {
    if (direction !== "down" && !checkWithinGrid(points, direction)) { //to check left and right boundaries.
      // if the block would go out of bounds, don't move it
      return points;
    }
    return points.map(update => {
      if (direction === "left") { //decrement the x by 1 (horizontal)
          return { ...update, x: update.x-1}; 
      } 
      else if (direction === "right") { //increment the x by 1 (horizontal)
          return { ...update, x: update.x+1}; 
      } 
      else if (direction === "down") { // increment the y by 1 (vertical)
        return { ...update, y: update.y + 1 };
      }
      return update;
    });
  }; 

  //------------------------------------------ Observable Streams ------------------------------------------------

  const events$ = merge(left$, right$, down$, space$, rotateLeft$, rotateRight$, restart$); //merge all the observables
  const mergedActions$ = merge(tick$, events$); 

  const action$ = mergedActions$.pipe(
    scan((state, action) => {
      const newState = reduceState(state, action);
      const newTickRate = calNewTickRate(newState.level);
      tickRateSubject$.next(newTickRate);  // Update the tick rate subject
      return { ...newState, tickRate: newTickRate };
    }, {...initialState, highScore: getHighScore()})
  );
  
  // --------------------------------- IMPURE CODE (INSIDE main()) BELOW ---------------------------------------------


  const calculateGhostPiece = (points: Point[], grid: Grid[][]): Point[] => {
    /**
     * 
     * @param point array of Point object which represent coordinates of the current active block
     * @param grid 2d array wich represent the game grid which contains the information of which cells are empty or filled.
     * @returns 
     */

    //a new array where the y coordinate of each point is incremented by 1
    const moveDown = (point: Point[]): Point[] => point.map(p => ({ ...p, y: p.y + 1 }));  
    
    const newPoints = moveDown(points);
    if (checkCollision(newPoints, grid)) { //check for collision with other blocks or grid
      return points; //return the final point
    }
    return calculateGhostPiece(newPoints, grid);
  };

  /**
   * Renders the current state to the canvas.
   *
   * In MVC terms, this updates the View using the Model.
   *
   * @param s Current state
   */

  const render = (s: State) => { //IMPURE FUNCTION
  // Clear the SVG canvas
    svg.innerHTML = "";

    // Render the current block (the one the player is controlling)
    const currentBlocks = s.points.map((currentPoint: Point) =>
      createSvgElement(svg.namespaceURI, "rect", {
        height: `${Block.HEIGHT}`,
        width: `${Block.WIDTH}`,
        x: `${Block.WIDTH * currentPoint.x}`,
        y: `${Block.HEIGHT * currentPoint.y}`,
        style: `fill: ${s.colour}`,
      })
    );
  
  // Render the placed blocks (the ones already placed inside grid)
    const placedBlocks = s.grid.flatMap((row, indexr) => //Source: Generative AI 
    //flatMap is used to do both transform and flatten the array in a single operation
      row.map((cell, indexc) =>
        cell?.state === 1
          ? createSvgElement(svg.namespaceURI, "rect", {
              height: `${Block.HEIGHT}`,
              width: `${Block.WIDTH}`,
              x: `${Block.WIDTH * indexc}`,
              y: `${Block.HEIGHT * indexr}`,
              style: `fill: ${cell.colour}`,
            })
          : null
      )
    ).filter(Boolean); // to remove any null values from the array which generated for cells whose state is not 1.
    // Generative AI ends here
    
  // To render the ghost piece
  const ghostBlocks = s.ghostPoint.map((currentPoint: Point) =>
    createSvgElement(svg.namespaceURI, "rect", {
      height: `${Block.HEIGHT}`,
      width: `${Block.WIDTH}`,
      x: `${Block.WIDTH * currentPoint.x}`,
      y: `${Block.HEIGHT * currentPoint.y}`,
      style: `fill: white; opacity: 0.3`, // adjust the opacity
    })
  );

  return [...currentBlocks, ...placedBlocks, ...ghostBlocks];
  };
  
  const source$ = () => { // IMPURE FUNCTION
    const subscription = action$.subscribe((s: State) => {
      const blocks = render(s);
      appendBlocksToSvg(blocks, svg); //append the block to the SVG canvas based on the current state
      
      preview.innerHTML =  '' //clear the preview place for the next block

      s.nextPoints.reduce((acc, point) => { // show the preview to the canvas
        const rect = createSvgElement(svg.namespaceURI, "rect" , {
          x: String(point.x * Block.WIDTH - (Viewport.PREVIEW_WIDTH - (Block.WIDTH)) / 4),
          y: String(point.y * Block.HEIGHT + (Viewport.PREVIEW_HEIGHT - Block.HEIGHT) / 2), // Assume 10 is the scaling factor for the preview
          width: String(Block.WIDTH),
          height: String(Block.HEIGHT),
          fill: `${s.nextColour}`, // Or whatever color you want for the preview
        });
        preview.appendChild(rect);
        return acc
      }, null);

      if (s.score > getHighScore()) { // set the high score
        setHighScore(s.score);
      }

      levelText.textContent = String(s.level);
      scoreText.textContent = String(s.score);
      highScoreText.textContent = String(getHighScore());
    
      if (s.gameEnd) {
        svg.appendChild(gameover)
        show(gameover);
      } else {
        hide(gameover);
      }
    });

    const restartSub = restart$.subscribe(() => { // restart$ subscription to restart the game when triggered.
      restartGame.restartTheGame()
    })
  }
  //-------------------------------------------------- End -----------------------------------------------------
  source$();
}

const checkX = (x: number): boolean =>  //pure
  //to check whether x is within the grid 
    x >= 0 && x < Constants.GRID_WIDTH

const checkY = (y: number): boolean =>  //pure
//to check whether y is within the grid 
  y >= 0 && y < Constants.GRID_HEIGHT

const checkWithinGrid = (points: Point[], direction: "left" | "right"): boolean => { //pure
  // to check whether the point of x exceed the grid
  return points.every(point => {
    if (direction === "left") {
      return checkX(point.x - 1);
    }
    if (direction === "right") {
      return checkX(point.x + 1);
    }
    return checkX(point.x);
  });
};

const checkRotation = (points:Point[]): boolean =>{ //pure
  // check every point on the array of points using 'every' if all points satisfy a certain condition.
  return points.every(point => checkX(point.x) && checkY(point.y));
}

// //------------------------------------------------ Impure Code Below ----------------------------------------------------------

// Usage: this part remains impure because it deals with side-effects
const appendBlocksToSvg = (blocks: SVGRectElement[], svg: SVGSVGElement): void => {
  // Append all blocks to the SVG canvas
  svg.append(...blocks);
};

function setHighScore (highScore: number){ //set the high score to localStorage
  localStorage.setItem('highScore', highScore.toString());
}
function getHighScore(): number { //get the high score from localStorage
  return parseInt(localStorage.getItem('highScore') || '0', 10);
}

//------------------------------------------------------------ End ---------------------------------------------------------------

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
