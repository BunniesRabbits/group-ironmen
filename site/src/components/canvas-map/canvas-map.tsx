import { useCallback, useEffect, useRef, type ReactElement } from "react";
import "./canvas-map.css";
import Animation from "./animation";

interface CanvasMapCamera {
  // Positions of camera with capability for smooth lerping.
  x: Animation;
  y: Animation;
  // zoom: Animation;
  // maxZoom: number;
  // minZoom: number;
}
interface CanvasMapCursor {
  // Current Position.
  x: number;
  y: number;

  // Last update call's positions.
  previousX: number;
  previousY: number;

  // Stores samples of the cursors movement across frames, so the camera coasts with no accidental "flicking".
  rateSamplesX: number[];
  rateSamplesY: number[];

  // When the user lets go of the camera, it coasts for a bit. This tracks the decay of that speed.
  dragDecay: number;
  isDragging: boolean;
}

type Distinct<T, DistinctName> = T & { __TYPE__: DistinctName };

interface MapTile {
  loaded: boolean;
  image: HTMLImageElement;
}

const mapTileIndex = (x: number, y: number): MapTileIndex => (((x + y) * (x + y + 1)) / 2 + y) as MapTileIndex;

type MapTileIndex = Distinct<number, "MapTileIndex">;

type MapTileGrid = Map<MapTileIndex, MapTile>;
const PIXELS_PER_TILE = 256;
// const PIXELS_PER_POSITION = 4;

/*
type MapImageCache = Map<MapTileIndex, HTMLImageElement>;
const PIXELS_PER_GAME_TILE = 4;

const fetchMapJSON = (): Promise<MapMetadata> =>
  import("../../../public/data/map.json").then((data) => MapMetadata.parseAsync(data));

const clearTilesIntersectingView = (view: CanvasMapView, context: CanvasRenderingContext2D) => {
  const imageSize = TILE_SIZE;

  // TODO: investigate if it is worth it to only clear when tile alpha is < 1
  // Could pass in visible tiles, then use their alpha to discriminate

  for (let tileX = view.left; tileX < view.right; ++tileX) {
    for (let tileY = view.top; tileY > view.bottom; --tileY) {
      const tileWorldX = tileX * imageSize;
      const tileWorldY = tileY * imageSize;
      context.clearRect(tileWorldX, -tileWorldY, imageSize, imageSize);
    }
  }
};
*/

// Returns 0 for empty array
const average = (arr: number[]): number => {
  if (arr.length < 1) return 0;
  return arr.reduce((previous, current) => previous + current, 0) / arr.length;
};

// Figuring out when to apply scaling is hard, so this wrapper handles
// that by implementing a subset of Context2D rendering commands.
class Context2DScaledWrapper {
  private pixelRatio: number;
  private context: CanvasRenderingContext2D;

  constructor({ pixelRatio, context }: { pixelRatio: number; context: CanvasRenderingContext2D }) {
    this.pixelRatio = pixelRatio;
    this.context = context;
    context.imageSmoothingEnabled = false;
  }

  width(): number {
    return this.context.canvas.width / this.pixelRatio;
  }
  height(): number {
    return this.context.canvas.height / this.pixelRatio;
  }

  // Sets context for transformation
  setTransform({ offsetX, offsetY }: { offsetX: number; offsetY: number }): void {
    this.context.setTransform(1, 0, 0, 1, this.pixelRatio * offsetX, this.pixelRatio * offsetY);
  }
  // Sets context for further fill commands
  setFillStyle(fillStyle: string | CanvasGradient | CanvasPattern): void {
    this.context.fillStyle = fillStyle;
  }

  // Draws a filled rectangle
  fillRect({ x, y, width, height }: { x: number; y: number; width: number; height: number }): void {
    this.context.fillRect(x * this.pixelRatio, y * this.pixelRatio, width * this.pixelRatio, height * this.pixelRatio);
  }

  // Draws an image
  drawImage({ image, x, y }: { image: HTMLImageElement; x: number; y: number }): void {
    // TODO: is this width/height the actual height on the image? It might be better to use another image type
    this.context.drawImage(
      image,
      0,
      0,
      image.width,
      image.height,
      x * this.pixelRatio,
      y * this.pixelRatio,
      image.width * this.pixelRatio,
      image.height * this.pixelRatio,
    );
  }
}

class CanvasMapRenderer {
  private tiles: MapTileGrid;
  private camera: CanvasMapCamera;
  private cursor: CanvasMapCursor;
  private lastUpdateTime: DOMHighResTimeStamp;

  constructor() {
    const INITIAL_X = 9088;
    const INITIAL_Y = -13184;

    this.tiles = new Map();
    this.camera = {
      x: new Animation({ startPosition: INITIAL_X, endPosition: INITIAL_X, endTime: 1 }).cancelAnimation(),
      y: new Animation({ startPosition: INITIAL_Y, endPosition: INITIAL_Y, endTime: 1 }).cancelAnimation(),
    };
    this.cursor = {
      x: 0,
      y: 0,
      previousX: 0,
      previousY: 0,
      rateSamplesX: [0],
      rateSamplesY: [0],
      dragDecay: 1,
      isDragging: false,
    };
    this.lastUpdateTime = performance.now();
  }

  handlePointerDown(): void {
    if (this.cursor.isDragging) return;

    // We reset the samples here, since if the cursor is down, the map should
    // snap to the cursor. When it snaps, the momentum needs to be cancelled.

    this.cursor.rateSamplesX = [];
    this.cursor.rateSamplesY = [];

    this.cursor.isDragging = true;
  }
  handlePointerUp(): void {
    if (!this.cursor.isDragging) return;

    this.cursor.isDragging = false;
  }
  handlePointerMove({ x, y }: { x: number; y: number }): void {
    this.cursor.x = x;
    this.cursor.y = y;
  }
  handlePointerLeave(): void {
    this.cursor.isDragging = false;
  }

  private updateCursorAndCamera(elapsed: number): void {
    const cursorDeltaX = this.cursor.x - this.cursor.previousX;
    const cursorDeltaY = this.cursor.y - this.cursor.previousY;

    if (this.cursor.isDragging) {
      const EVENTS_TO_KEEP = 10;
      this.cursor.rateSamplesX.push(cursorDeltaX / elapsed);
      if (this.cursor.rateSamplesX.length > EVENTS_TO_KEEP) {
        this.cursor.rateSamplesX = this.cursor.rateSamplesX.slice(this.cursor.rateSamplesX.length - EVENTS_TO_KEEP);
      }
      this.cursor.rateSamplesY.push(cursorDeltaY / elapsed);
      if (this.cursor.rateSamplesY.length > EVENTS_TO_KEEP) {
        this.cursor.rateSamplesY = this.cursor.rateSamplesY.slice(this.cursor.rateSamplesY.length - EVENTS_TO_KEEP);
      }

      this.cursor.dragDecay = 1;

      this.camera.x.goTo({ endPosition: this.camera.x.end() - cursorDeltaX, endTime: 1 }).cancelAnimation();
      this.camera.y.goTo({ endPosition: this.camera.y.end() - cursorDeltaY, endTime: 1 }).cancelAnimation();
    } else {
      this.cursor.dragDecay *= elapsed * 0.002 + 1;

      const SPEED_THRESHOLD = 0.05;
      const dx = average(this.cursor.rateSamplesX) / this.cursor.dragDecay;
      const dy = average(this.cursor.rateSamplesY) / this.cursor.dragDecay;
      const speedSquared = dx * dx + dy * dy;
      if (speedSquared > SPEED_THRESHOLD) {
        // Drag the camera with some inertia.
        // We achieve this by just tweaking the endPosition, so the camera "chases".
        this.camera.x.goTo({ endPosition: this.camera.x.end() - dx, endTime: 1 });
        this.camera.y.goTo({ endPosition: this.camera.y.end() - dy, endTime: 1 });
      }
    }

    this.cursor.previousX = this.cursor.x;
    this.cursor.previousY = this.cursor.y;

    this.camera.x.animate(elapsed);
    this.camera.y.animate(elapsed);
  }

  update(): void {
    const currentUpdateTime = performance.now();
    const elapsed = currentUpdateTime - this.lastUpdateTime;

    if (elapsed < 0.001) return;

    this.updateCursorAndCamera(elapsed);

    this.lastUpdateTime = currentUpdateTime;
  }

  private drawVisibleTiles(context: Context2DScaledWrapper): void {
    // WARNING:
    // Tile coordinates are FLIPPED from Canvas coordinates.
    // Tile 0,0 is the bottom left of the world (south-west in game).
    // Canvas x axis is the same, but y is flipped.
    // So our tiles "exist" only in negative canvas y.

    // The world titles surrounding by the ocean run from
    // (18, 39) to (53, 64)

    const x = this.camera.x.current();
    const y = this.camera.y.current();

    const tileXMin = Math.floor(x / PIXELS_PER_TILE);
    const tileXMax = Math.ceil((x + context.width()) / PIXELS_PER_TILE);

    const tileYMin = Math.floor(-(y + context.height()) / PIXELS_PER_TILE);
    const tileYMax = Math.ceil(-y / PIXELS_PER_TILE);

    context.setFillStyle("black");

    for (let tileX = tileXMin - 1; tileX <= tileXMax; tileX++) {
      for (let tileY = tileYMin - 1; tileY <= tileYMax; tileY++) {
        const gridIndex = mapTileIndex(tileX, tileY);
        const pixelX = tileX * PIXELS_PER_TILE;
        const pixelY = -tileY * PIXELS_PER_TILE;

        if (!this.tiles.has(gridIndex)) {
          const tile: MapTile = {
            loaded: false,
            image: new Image(PIXELS_PER_TILE, PIXELS_PER_TILE),
          };
          const tileFileBaseName = `${0}_${tileX}_${tileY}`;
          tile.image.src = `/map/${tileFileBaseName}.webp`;
          this.tiles.set(gridIndex, tile);
        }
        const tile = this.tiles.get(gridIndex)!;

        if (!tile.image.complete) {
          context.fillRect({ x: pixelX, y: pixelY, width: PIXELS_PER_TILE, height: PIXELS_PER_TILE });
          continue;
        }

        try {
          context.drawImage({ image: tile.image, x: pixelX, y: pixelY });
        } catch {
          context.fillRect({ x: pixelX, y: pixelY, width: PIXELS_PER_TILE, height: PIXELS_PER_TILE });
        }
      }
    }
  }

  drawAll(context: Context2DScaledWrapper): void {
    context.setTransform({ offsetX: -this.camera.x.current(), offsetY: -this.camera.y.current() });

    this.drawVisibleTiles(context);
  }
}

interface CanvasMapProps {
  interactive: boolean;
}
export const CanvasMap = ({ interactive: _interactive }: CanvasMapProps): ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelRatioRef = useRef<number>(1);
  const rendererRef = useRef<CanvasMapRenderer>(new CanvasMapRenderer());
  const animationFrameHandleRef = useRef<number>(undefined);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (canvas) {
      const devicePixelRatio = window.devicePixelRatio;
      pixelRatioRef.current = devicePixelRatio;
      canvas.width = Math.max(canvas.offsetWidth * devicePixelRatio, 1);
      canvas.height = Math.max(canvas.offsetHeight * devicePixelRatio, 1);
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return (): void => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [resizeCanvas]);

  const render = useCallback((): void => {
    if (canvasRef.current === null) {
      console.error("No canvas.");
      return;
    }

    const context = new Context2DScaledWrapper({
      pixelRatio: pixelRatioRef.current,
      context: canvasRef.current.getContext("2d")!,
    });

    rendererRef.current?.update();
    rendererRef.current?.drawAll(context);
    animationFrameHandleRef.current = window.requestAnimationFrame(() => {
      render();
    });
  }, [animationFrameHandleRef, canvasRef]);

  useEffect(() => {
    console.log("Rebuilding renderer.");
    rendererRef.current = new CanvasMapRenderer();
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    if (animationFrameHandleRef.current) {
      window.cancelAnimationFrame(animationFrameHandleRef.current);
    }
    console.log("Kicking off new render.");

    render();
  }, [render]);

  const handlePointerMove = useCallback(
    ({ clientX, clientY }: { clientX: number; clientY: number }) => {
      rendererRef.current?.handlePointerMove({ x: clientX, y: clientY });
    },
    [rendererRef],
  );
  const handlePointerUp = useCallback(() => {
    rendererRef.current?.handlePointerUp();
  }, [rendererRef]);
  const handlePointerDown = useCallback(() => {
    rendererRef.current?.handlePointerDown();
  }, [rendererRef]);
  const handlePointerLeave = useCallback(() => {
    rendererRef.current?.handlePointerLeave();
  }, [rendererRef]);

  return (
    <div className="canvas-map">
      <canvas
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        id="background-worldmap"
        ref={canvasRef}
      />
      <div className="canvas-map__coordinates"></div>
    </div>
  );
};
