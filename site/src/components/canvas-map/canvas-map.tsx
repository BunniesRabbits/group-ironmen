import { useCallback, useEffect, useRef, type ReactElement } from "react";
import "./canvas-map.css";
import Animation from "./animation";

interface CanvasMapCamera {
  x: Animation;
  y: Animation;
  // zoom: Animation;
  // maxZoom: number;
  // minZoom: number;
  isDragging: boolean;
}
interface CanvasMapCursor {
  // GUESS: current position
  x: number;
  y: number;

  // GUESS: last update's position
  previousX: number;
  previousY: number;

  // GUESS: position history over multiple onprocessed frames
  rateSamplesX: number[];
  rateSamplesY: number[];
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

class CanvasMapRenderer {
  private tiles: MapTileGrid;
  private camera: CanvasMapCamera;
  private cursor: CanvasMapCursor;
  private lastUpdateTime: DOMHighResTimeStamp;
  private pixelRatio: number;

  constructor() {
    const INITIAL_X = 9088;
    const INITIAL_Y = -13184;

    this.tiles = new Map();
    this.camera = {
      x: new Animation({ startPosition: INITIAL_X, endPosition: INITIAL_X, endTime: 1 }).cancelAnimation(),
      y: new Animation({ startPosition: INITIAL_Y, endPosition: INITIAL_Y, endTime: 1 }).cancelAnimation(),
      isDragging: false,
    };
    this.cursor = {
      x: 0,
      y: 0,
      previousX: 0,
      previousY: 0,
      rateSamplesX: [0],
      rateSamplesY: [0],
    };
    this.pixelRatio = 1;
    this.lastUpdateTime = performance.now();
  }

  setPixelRatio(ratio: number): void {
    this.pixelRatio = ratio;
  }

  handlePointerDown(): void {
    this.camera.isDragging = true;
  }
  handlePointerUp(): void {
    if (!this.camera.isDragging) return;

    // If the pointer is EVER released, we want to clear accumulated state.
    // So if the user clicks between animation frames, the map does not keep dragging.

    this.cursor.rateSamplesX = [];
    this.cursor.rateSamplesY = [];

    this.camera.isDragging = false;
  }
  handlePointerMove({ x, y }: { x: number; y: number }): void {
    this.cursor.x = x;
    this.cursor.y = y;
  }
  handlePointerLeave(): void {
    if (!this.camera.isDragging) return;

    // If the pointer is EVER released, we want to clear accumulated state.
    // So if the user clicks between animation frames, the map does not keep dragging.

    this.cursor.rateSamplesX = [];
    this.cursor.rateSamplesY = [];

    this.camera.isDragging = false;
  }

  private updateCursorAndCamera(elapsed: number): void {
    const cursorDeltaX = this.cursor.x - this.cursor.previousX;
    const cursorDeltaY = this.cursor.y - this.cursor.previousY;

    if (this.camera.isDragging) {
      const EVENTS_TO_KEEP = 10;
      this.cursor.rateSamplesX.push(cursorDeltaX / elapsed);
      if (this.cursor.rateSamplesX.length > EVENTS_TO_KEEP) {
        this.cursor.rateSamplesX = this.cursor.rateSamplesX.slice(this.cursor.rateSamplesX.length - EVENTS_TO_KEEP);
      }
      this.cursor.rateSamplesY.push(cursorDeltaY / elapsed);
      if (this.cursor.rateSamplesY.length > EVENTS_TO_KEEP) {
        this.cursor.rateSamplesY = this.cursor.rateSamplesY.slice(this.cursor.rateSamplesY.length - EVENTS_TO_KEEP);
      }
    }

    this.cursor.previousX = this.cursor.x;
    this.cursor.previousY = this.cursor.y;

    if (this.camera.isDragging) {
      this.camera.x.goTo({ endPosition: this.camera.x.end() - cursorDeltaX, endTime: 1 }).cancelAnimation();
      this.camera.y.goTo({ endPosition: this.camera.y.end() - cursorDeltaY, endTime: 1 }).cancelAnimation();
    } else {
      const dx = average(this.cursor.rateSamplesX);
      const dy = average(this.cursor.rateSamplesY);

      // Drag the camera with some inertia.
      // We achieve this by just tweaking the endPosition, so the camera "chases".
      this.camera.x.goTo({ endPosition: this.camera.x.end() - dx, endTime: 1 });
      this.camera.y.goTo({ endPosition: this.camera.y.end() - dy, endTime: 1 });
    }

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

  drawVisibleTiles({
    width,
    height,
    context,
  }: {
    width: number;
    height: number;
    context: CanvasRenderingContext2D;
  }): void {
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
    const tileXMax = Math.ceil((x + width) / PIXELS_PER_TILE);

    const tileYMin = Math.floor(-(y + height) / PIXELS_PER_TILE);
    const tileYMax = Math.ceil(-y / PIXELS_PER_TILE);

    context.setTransform(1, 0, 0, 1, -x, -y);
    context.fillStyle = "green";

    for (let tileX = tileXMin - 1; tileX <= tileXMax; tileX++) {
      for (let tileY = tileYMin - 1; tileY <= tileYMax; tileY++) {
        const gridIndex = mapTileIndex(tileX, tileY);
        const screenX = tileX * PIXELS_PER_TILE;
        const screenY = -(tileY * PIXELS_PER_TILE);

        context.fillRect(x, y, PIXELS_PER_TILE, PIXELS_PER_TILE);

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
          context.fillRect(screenX, screenY, PIXELS_PER_TILE, PIXELS_PER_TILE);
        }

        try {
          context.drawImage(tile.image, screenX, screenY);
        } catch (e) {
          context.fillRect(screenX, screenY, PIXELS_PER_TILE, PIXELS_PER_TILE);
        }
      }
    }
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

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    const context = canvasRef.current.getContext("2d")!;

    rendererRef.current?.setPixelRatio(devicePixelRatio);
    rendererRef.current?.update();
    rendererRef.current?.drawVisibleTiles({ width, height, context });
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

    console.log(animationFrameHandleRef.current);
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
