import { useCallback, useEffect, useRef, type ReactElement } from "react";
import "./canvas-map.css";
import Animation from "./animation";

interface CanvasMapCamera {
  // Positions of camera with capability for smooth lerping.
  x: Animation;
  y: Animation;

  // Zoom of camera with smoothing
  zoom: Animation;
  minZoom: number;
  maxZoom: number;
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

  zoomDeltaSinceLastUpdate: number;
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
  // Canvas pixel ratio, shouldn't be changed unless canvas is.
  // Higher means more pixels per input unit, so rendered objects get smaller.
  private pixelRatio: number;

  private context: CanvasRenderingContext2D;
  private scale: number;

  constructor({ pixelRatio, context }: { pixelRatio: number; context: CanvasRenderingContext2D }) {
    this.pixelRatio = pixelRatio;
    this.context = context;
    this.scale = 1;
    context.imageSmoothingEnabled = false;
  }

  private screenPixelsPerWorldUnit(): number {
    return this.pixelRatio / this.scale;
  }

  width(): number {
    return this.context.canvas.width / this.screenPixelsPerWorldUnit();
  }
  height(): number {
    return this.context.canvas.height / this.screenPixelsPerWorldUnit();
  }

  // Sets context for transformation. The parameters should match your camera.
  setTransform({ x, y, scale }: { x: number; y: number; scale: number }): void {
    // Ratio of world units to physical pixels
    this.scale = scale;
    const ratio = this.screenPixelsPerWorldUnit();
    // This is two transformation matrices multiplied together
    // World -- Translate + Scale -> View -- Translate -> Screen
    this.context.setTransform(
      ratio,
      0,
      0,
      ratio,
      -ratio * x + this.context.canvas.width / 2,
      -ratio * y + this.context.canvas.height / 2,
    );
  }

  // Sets context for further fill commands
  setFillStyle(fillStyle: string | CanvasGradient | CanvasPattern): void {
    this.context.fillStyle = fillStyle;
  }

  // Draws a filled rectangle
  fillRect({
    worldPosX,
    worldPosY,
    width,
    height,
  }: {
    worldPosX: number;
    worldPosY: number;
    width: number;
    height: number;
  }): void {
    this.context.fillRect(worldPosX, worldPosY, width, height);
  }

  // Draws an image
  drawImage({ image, x, y }: { image: HTMLImageElement; x: number; y: number; worldUnitsPerImagePixel: number }): void {
    this.context.drawImage(image, 0, 0, image.width, image.height, x, y, image.width, image.height);
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
    const INITIAL_ZOOM = 1;

    this.tiles = new Map();
    this.camera = {
      x: Animation.makeInactive({ position: INITIAL_X }),
      y: Animation.makeInactive({ position: INITIAL_Y }),
      zoom: Animation.makeInactive({ position: INITIAL_ZOOM }),
      minZoom: 1 / 10,
      maxZoom: 2,
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
      zoomDeltaSinceLastUpdate: 0,
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
  handleScroll(amount: number): void {
    this.cursor.zoomDeltaSinceLastUpdate += amount;
  }

  private updateCursorAndCamera(elapsed: number): void {
    const cursorDeltaX = this.cursor.x - this.cursor.previousX;
    const cursorDeltaY = this.cursor.y - this.cursor.previousY;

    const worldUnitsPerCursorUnit = this.camera.zoom.current();
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

      this.camera.x
        .jumpTo({ endPosition: this.camera.x.end() - worldUnitsPerCursorUnit * cursorDeltaX, endTime: 1 })
        .cancelAnimation();
      this.camera.y
        .jumpTo({ endPosition: this.camera.y.end() - worldUnitsPerCursorUnit * cursorDeltaY, endTime: 1 })
        .cancelAnimation();
    } else {
      this.cursor.dragDecay *= elapsed * 0.001 + 1;

      const SPEED_THRESHOLD = 0.05;
      const dx = average(this.cursor.rateSamplesX) / this.cursor.dragDecay;
      const dy = average(this.cursor.rateSamplesY) / this.cursor.dragDecay;
      const speedSquared = dx * dx + dy * dy;
      if (speedSquared > SPEED_THRESHOLD) {
        // Drag the camera with some inertia.
        // We achieve this by just tweaking the endPosition, so the camera "chases".
        this.camera.x.jumpTo({ endPosition: this.camera.x.end() - worldUnitsPerCursorUnit * dx, endTime: 1 });
        this.camera.y.jumpTo({ endPosition: this.camera.y.end() - worldUnitsPerCursorUnit * dy, endTime: 1 });
      }
    }

    const ZOOM_SENSITIVITY = 1 / 1000;
    if (this.cursor.zoomDeltaSinceLastUpdate !== 0) {
      this.camera.zoom.adjustEnd({
        endPosition: this.camera.zoom.end() + ZOOM_SENSITIVITY * this.cursor.zoomDeltaSinceLastUpdate,
        endTime: 1.5,
      });
    }

    this.cursor.zoomDeltaSinceLastUpdate = 0;

    this.cursor.previousX = this.cursor.x;
    this.cursor.previousY = this.cursor.y;

    this.camera.x.animate(elapsed);
    this.camera.y.animate(elapsed);
    this.camera.zoom.animate(elapsed);
    if (this.camera.zoom.current() > this.camera.maxZoom) {
      this.camera.zoom.jumpTo({ endPosition: this.camera.maxZoom, endTime: 1 }).cancelAnimation();
    } else if (this.camera.zoom.current() < this.camera.minZoom) {
      this.camera.zoom.jumpTo({ endPosition: this.camera.minZoom, endTime: 1 }).cancelAnimation();
    }
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

    const tileXMin = Math.floor((x - 0.5 * context.width()) / PIXELS_PER_TILE);
    const tileXMax = Math.ceil((x + 0.5 * context.width()) / PIXELS_PER_TILE);

    const tileYMin = Math.floor(-(y + 0.5 * context.height()) / PIXELS_PER_TILE);
    const tileYMax = Math.ceil(-(y - 0.5 * context.height()) / PIXELS_PER_TILE);

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
          context.fillRect({ worldPosX: pixelX, worldPosY: pixelY, width: PIXELS_PER_TILE, height: PIXELS_PER_TILE });
          continue;
        }

        try {
          context.drawImage({ image: tile.image, x: pixelX, y: pixelY, worldUnitsPerImagePixel: 1 / PIXELS_PER_TILE });
        } catch {
          context.fillRect({ worldPosX: pixelX, worldPosY: pixelY, width: PIXELS_PER_TILE, height: PIXELS_PER_TILE });
        }
      }
    }
  }

  drawAll(context: Context2DScaledWrapper): void {
    const zoom = Math.max(Math.min(this.camera.zoom.current(), this.camera.maxZoom), this.camera.minZoom);
    context.setTransform({
      x: this.camera.x.current(),
      y: this.camera.y.current(),
      scale: zoom,
    });

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
    console.info("Rebuilding renderer.");
    rendererRef.current = new CanvasMapRenderer();
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    if (animationFrameHandleRef.current) {
      window.cancelAnimationFrame(animationFrameHandleRef.current);
    }
    console.info("Kicking off new render.");

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
  const handleScroll = useCallback(
    ({ deltaY }: { deltaY: number }) => {
      rendererRef.current?.handleScroll(deltaY);
    },
    [rendererRef],
  );

  return (
    <div className="canvas-map">
      <canvas
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleScroll}
        id="background-worldmap"
        ref={canvasRef}
      />
      <div className="canvas-map__coordinates"></div>
    </div>
  );
};
