import { useCallback, useEffect, useRef, type ReactElement } from "react";
import "./canvas-map.css";

/*
interface CanvasMapCamera {
  x: Animation;
  y: Animation;
  zoom: Animation;
  maxZoom: number;
  minZoom: number;
  isDragging: boolean;
}
interface CanvasMapCursor {
  // GUESS: current position
  x: number;
  y: number;

  // GUESS: delta position to change by
  dx: number;
  dy: number;

  // GUESS: last update's position
  previousX: number;
  previousY: number;

  // GUESS: position history over multiple onprocessed frames
  frameX: number[];
  frameY: number[];
}
	*/

type Distinct<T, DistinctName> = T & { __TYPE__: DistinctName };

interface MapTile {
  loaded: boolean;
  image: HTMLImageElement;
}

const mapTileIndex = (x: number, y: number): MapTileIndex => (((x + y) * (x + y + 1)) / 2 + y) as MapTileIndex;

type MapTileIndex = Distinct<number, "MapTileIndex">;

type MapTileGrid = Map<MapTileIndex, MapTile>;
const TILE_SIZE = 256;

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

class CanvasMapRenderer {
  private tiles: MapTileGrid;

  constructor() {
    this.tiles = new Map();
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
    const x = 9088;
    const y = -13184;

    // WARNING:
    // Tile coordinates are FLIPPED from Canvas coordinates.
    // Tile 0,0 is the bottom left of the world (south-west in game).
    // Canvas x axis is the same, but y is flipped.
    // So our tiles "exist" only in negative canvas y.

    // The world titles surrounding by the ocean run from
    // (18, 39) to (53, 64)

    const tileYMax = Math.ceil(-y / TILE_SIZE);
    const tileXMin = Math.floor(x / TILE_SIZE);

    const tileYMin = Math.floor(-(y + height) / TILE_SIZE);
    const tileXMax = Math.ceil((x + width) / TILE_SIZE);

    context.setTransform(1, 0, 0, 1, Math.round(-x), Math.round(-y));

    for (let tileX = tileXMin - 1; tileX <= tileXMax; tileX++) {
      for (let tileY = tileYMin - 1; tileY <= tileYMax; tileY++) {
        const gridIndex = mapTileIndex(tileX, tileY);
        const screenX = tileX * TILE_SIZE;
        const screenY = -(tileY * TILE_SIZE);

        if (!this.tiles.has(gridIndex)) {
          const tile: MapTile = {
            loaded: false,
            image: new Image(TILE_SIZE, TILE_SIZE),
          };
          const tileFileBaseName = `${0}_${tileX}_${tileY}`;
          tile.image.src = `/map/${tileFileBaseName}.webp`;
          this.tiles.set(gridIndex, tile);
        }
        const tile = this.tiles.get(gridIndex)!;

        if (!tile.image.complete) continue;

        context.drawImage(tile.image, screenX, screenY);
      }
    }
  }
}

interface CanvasMapProps {
  interactive: boolean;
}
export const CanvasMap = ({ interactive: _interactive }: CanvasMapProps): ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasMapRenderer>(new CanvasMapRenderer());
  const animationFrameHandleRef = useRef<number>(undefined);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (canvas) {
      const devicePixelRatio = window.devicePixelRatio;
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

  return (
    <div className="canvas-map">
      <canvas id="background-worldmap" ref={canvasRef} />
      <div className="canvas-map__coordinates"></div>
    </div>
  );
};
