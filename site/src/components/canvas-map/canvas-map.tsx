import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import "./canvas-map.css";
import { MapMetadata } from "../../data/map-data";

const ICON_IMAGE_PIXEL_SIZE = 15;

const REGION_IMAGE_PIXEL_SIZE = 256;
const RS_SQUARE_PIXEL_SIZE = 4;
const WORLD_UNITS_PER_REGION = REGION_IMAGE_PIXEL_SIZE / RS_SQUARE_PIXEL_SIZE;

interface CanvasMapCamera {
  // Positions of camera with capability for smooth lerping.
  x: number;
  y: number;

  // Zoom of camera with smoothing
  zoom: number;
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

  // Milliseconds of time spent in friction, for computing the deceleration of the camera when let go
  accumulatedFrictionMS: number;

  isDragging: boolean;

  // Multiple scroll events may occur in a frame, so we add them all up.
  accumulatedScroll: number;
}

type Distinct<T, DistinctName> = T & { __TYPE__: DistinctName };

interface MapRegion {
  loaded: boolean;
  image: HTMLImageElement;
}

type MapRegionCoordinate2DHash = Distinct<string, "MapRegionCoordinate2DHash">;
type MapRegionCoordinate3DHash = Distinct<string, "MapRegionCoordinate3DHash">;
type RegionGrid = Map<MapRegionCoordinate3DHash, MapRegion>;
// type MapRegionCoordinate3DHash = Distinct<string, "MapRegionCoordinate3DHash">;

// Fractional coordinates get rounded
const hashMapRegionCoordinate2Ds = ({ x, y }: CoordinatePair): MapRegionCoordinate2DHash => {
  return `${Math.round(x)}_${Math.round(y)}` as MapRegionCoordinate2DHash;
};
const hashMapRegionCoordinate3Ds = ({
  position,
  plane,
}: {
  position: CoordinatePair;
  plane: number;
}): MapRegionCoordinate3DHash => {
  return `${Math.round(plane)}_${Math.round(position.x)}_${Math.round(position.y)}` as MapRegionCoordinate3DHash;
};
// An icon is those round indicators in runescape, e.g. the blue star for quests.

interface MapIcon {
  // Index into the icon atlas
  spriteIndex: number;
  worldPosition: CoordinatePair;
}
type MapIconGrid = Map<MapRegionCoordinate2DHash, MapIcon[]>;

interface MapLabel {
  // labelID.webp is the filename of the label
  labelID: number;
  worldPosition: CoordinatePair;
  plane: number;
  image?: HTMLImageElement;
  loaded: boolean;
}
type MapLabelGrid = Map<MapRegionCoordinate2DHash, MapLabel[]>;

// Returns 0 for empty array
const average = (arr: number[]): number => {
  if (arr.length < 1) return 0;
  return arr.reduce((previous, current) => previous + current, 0) / arr.length;
};

// Figuring out when to apply scaling is hard, so this wrapper handles
// that by implementing a subset of Context2D rendering commands.
class Context2DScaledWrapper {
  // Canvas pixel ratio, shouldn't be changed unless canvas is.
  // This ratio is the number of physical canvas pixels per logical CSS pixel.
  // We care about this because we want higher pixel-density screens to not be unviewable.
  private pixelRatio: number;

  private context: CanvasRenderingContext2D;

  // Transform of the view/camera, in world units
  private translation: CoordinatePair;
  private scale: number;

  constructor({ pixelRatio, context }: { pixelRatio: number; context: CanvasRenderingContext2D }) {
    this.pixelRatio = pixelRatio;
    this.context = context;
    this.translation = { x: 0, y: 0 };
    this.scale = 1;
    context.imageSmoothingEnabled = false;
  }

  private screenPixelsPerWorldUnit(): number {
    return this.pixelRatio / this.scale;
  }

  /**
   * The cursor's position is in canvas/screen space, which is physical pixels.
   * Thus the world position the cursor points to is relative to the canvas and view parameters, and this method handles the conversion.
   */
  screenPositionToWorldPosition(cursorPosition: CoordinatePair): CoordinatePair {
    // screen space -> view space -> world space

    const viewPosition: CoordinatePair = {
      x: cursorPosition.x - (0.5 * this.context.canvas.width) / this.pixelRatio,
      y: cursorPosition.y - (0.5 * this.context.canvas.height) / this.pixelRatio,
    };
    const worldPosition: CoordinatePair = {
      x: this.scale * viewPosition.x + this.translation.x,
      y: this.scale * viewPosition.y + this.translation.y,
    };

    return worldPosition;
  }

  // Returns the width/height of the camera, in world coordinates (NOT view coordinates. Mind the scaling.)
  viewPlaneWorldExtent(): ExtentPair {
    return {
      width: this.context.canvas.width / this.screenPixelsPerWorldUnit(),
      height: this.context.canvas.height / this.screenPixelsPerWorldUnit(),
    };
  }
  viewPlaneWorldOffset(): CoordinatePair {
    return {
      x: this.translation.x,
      y: this.translation.y,
    };
  }

  // Sets context for transformation.
  // The parameters should match your camera, do not pass inverted parameters.
  setTransform({
    translation,
    scale,
    pixelPerfectDenominator,
  }: {
    translation: CoordinatePair;
    scale: number;
    pixelPerfectDenominator: number;
  }): void {
    // Ratio of world units to physical pixels
    this.translation = translation;
    this.scale =
      Math.floor(pixelPerfectDenominator * scale * this.pixelRatio) / (pixelPerfectDenominator * this.pixelRatio);
    // The rectangular canvas is the view plane of the camera.
    // So view space (0,0) is visible at the center of the canvas.
    // Thus, we offset by half the canvas pixels since (0,0) is in the corner of the canvas.
    this.context.setTransform(
      this.pixelRatio,
      0,
      0,
      this.pixelRatio,
      this.context.canvas.width / 2,
      this.context.canvas.height / 2,
    );
  }

  getScale(): number {
    return this.scale;
  }

  // Sets context for further fill commands
  setFillStyle(fillStyle: string | CanvasGradient | CanvasPattern): void {
    this.context.fillStyle = fillStyle;
  }

  private convertWorldPositionToView(position: CoordinatePair): CoordinatePair {
    return {
      x: (position.x - this.translation.x) / this.scale,
      y: (position.y - this.translation.y) / this.scale,
    };
  }
  private convertWorldExtentToView(extent: ExtentPair): ExtentPair {
    return {
      width: extent.width / this.scale,
      height: extent.height / this.scale,
    };
  }

  /**
   * Draws a filled rectangle
   */
  fillRect({ worldPosition, worldExtent }: { worldPosition: CoordinatePair; worldExtent: ExtentPair }): void {
    const position = this.convertWorldPositionToView(worldPosition);
    const extent = this.convertWorldExtentToView(worldExtent);
    this.context.fillRect(position.x, position.y, extent.width, extent.height);
  }

  fillLine({
    worldStartPosition,
    worldEndPosition,
  }: {
    worldStartPosition: CoordinatePair;
    worldEndPosition: CoordinatePair;
  }): void {
    const start = this.convertWorldPositionToView(worldStartPosition);
    const end = this.convertWorldPositionToView(worldEndPosition);

    this.context.beginPath();
    this.context.moveTo(start.x, start.y);
    this.context.lineTo(end.x, end.y);
    this.context.stroke();
  }

  /**
   * Draws an image.
   * Be careful of the image offset/extent, you need to have knowledge of the underlying image.
   *
   * PixelPerfect: round width/height to nearest pixel. Can mess up aspect ratio if you are non-uniformly scaling.
   */
  drawImage({
    image,
    imageOffsetInPixels,
    imageExtentInPixels,
    worldPosition,
    worldExtent,
    pixelPerfect,
  }: {
    image: HTMLImageElement;
    imageOffsetInPixels: CoordinatePair;
    imageExtentInPixels: ExtentPair;
    worldPosition: CoordinatePair;
    worldExtent: ExtentPair;
    pixelPerfect?: boolean;
  }): void {
    const position = this.convertWorldPositionToView(worldPosition);
    const extent = this.convertWorldExtentToView(worldExtent);

    pixelPerfect = pixelPerfect ?? false;

    if (pixelPerfect) {
      this.context.setTransform(1, 0, 0, 1, 0, 0);

      this.context.drawImage(
        image,
        imageOffsetInPixels.x,
        imageOffsetInPixels.y,
        imageExtentInPixels.width,
        imageExtentInPixels.height,
        Math.round(this.pixelRatio * position.x + this.context.canvas.width / 2),
        Math.round(this.pixelRatio * position.y + this.context.canvas.height / 2),
        Math.round((this.pixelRatio * extent.width) / imageExtentInPixels.width) * imageExtentInPixels.width,
        Math.round((this.pixelRatio * extent.height) / imageExtentInPixels.height) * imageExtentInPixels.height,
      );

      this.context.setTransform(
        this.pixelRatio,
        0,
        0,
        this.pixelRatio,
        this.context.canvas.width / 2,
        this.context.canvas.height / 2,
      );
    } else {
      this.context.drawImage(
        image,
        imageOffsetInPixels.x,
        imageOffsetInPixels.y,
        imageExtentInPixels.width,
        imageExtentInPixels.height,
        position.x,
        position.y,
        extent.width,
        extent.height,
      );
    }
  }
}

interface CoordinatePair {
  x: number;
  y: number;
}
interface ExtentPair {
  width: number;
  height: number;
}

const OURS_TO_WIKI_CONVERSION_FACTOR_X = -128;
const OURS_TO_WIKI_CONVERSION_FACTOR_Y = 63;

const fetchMapJSON = (): Promise<MapMetadata> =>
  import("/src/assets/map.json").then((data) => {
    return MapMetadata.parseAsync(data);
  });

class CanvasMapRenderer {
  private regions: RegionGrid;
  private camera: CanvasMapCamera;
  private cursor: CanvasMapCursor;
  private lastUpdateTime: DOMHighResTimeStamp;
  private iconsAtlas: HTMLImageElement;
  private iconsByRegion: MapIconGrid;
  private labelsByRegion: MapLabelGrid;

  /**
   * This stores which plane of the runescape world to render.
   * Only 4 of them (index 0 to 3) have valid images.
   * The region image assets have all 3 planes visibly composited, so we only need to render
   * one image per region.
   */
  private plane: number;

  constructor(mapData: MapMetadata, iconsAtlas: HTMLImageElement) {
    const INITIAL_X = 3360;
    const INITIAL_Y = -3150;
    const INITIAL_ZOOM = 1 / 4;
    const INITIAL_PLANE = 0;

    this.iconsAtlas = iconsAtlas;
    this.regions = new Map();
    this.camera = {
      x: INITIAL_X,
      y: INITIAL_Y,
      zoom: INITIAL_ZOOM,
      minZoom: 1 / 32,
      maxZoom: 2,
    };
    this.cursor = {
      x: 0,
      y: 0,
      previousX: 0,
      previousY: 0,
      rateSamplesX: [0],
      rateSamplesY: [0],
      accumulatedFrictionMS: 0,
      isDragging: false,
      accumulatedScroll: 0,
    };
    this.lastUpdateTime = performance.now();
    this.plane = INITIAL_PLANE;

    this.iconsByRegion = new Map();
    for (const regionXString of Object.keys(mapData.icons)) {
      const x = parseInt(regionXString);
      for (const regionYString of Object.keys(mapData.icons[regionXString])) {
        const y = parseInt(regionYString);

        const icons: MapIcon[] = Object.entries(mapData.icons[regionXString][regionYString])
          .map(([spriteIndex, coordinatesFlat]) => {
            return coordinatesFlat
              .reduce<[number, number][]>((pairs, _, index, coordinates) => {
                if (index % 2 === 0) {
                  pairs.push([coordinates[index], coordinates[index + 1]]);
                }
                return pairs;
              }, [])
              .map((worldPosition) => ({
                spriteIndex: parseInt(spriteIndex),
                worldPosition: { x: worldPosition[0], y: worldPosition[1] },
              }));
          })
          .flat();

        this.iconsByRegion.set(hashMapRegionCoordinate2Ds({ x, y }), icons);
      }
    }

    this.labelsByRegion = new Map();
    for (const regionXString of Object.keys(mapData.labels)) {
      const x = parseInt(regionXString);
      for (const regionYString of Object.keys(mapData.labels[regionXString])) {
        const y = parseInt(regionYString);

        const labels: MapLabel[] = Object.entries(mapData.labels[regionXString][regionYString])
          .map(([planeString, XYLabelIDFlat]) => {
            const plane = parseInt(planeString);

            return XYLabelIDFlat.reduce<MapLabel[]>((labels, _, index, labelFlat) => {
              if (index % 3 === 0) {
                labels.push({
                  labelID: labelFlat[index + 2],
                  plane,
                  worldPosition: { x: labelFlat[index], y: labelFlat[index + 1] },
                  loaded: false,
                });
              }
              return labels;
            }, []);
          })
          .flat();

        this.labelsByRegion.set(hashMapRegionCoordinate2Ds({ x, y }), labels);
      }
    }
  }

  handlePointerDown(): void {
    if (this.cursor.isDragging) return;

    // We reset the samples here, since if the cursor is down, the map should
    // snap to the cursor. When it snaps, the momentum needs to be cancelled.

    this.cursor.rateSamplesX = [];
    this.cursor.rateSamplesY = [];

    this.cursor.isDragging = true;
    this.onDraggingUpdate?.(this.cursor.isDragging);
  }
  handlePointerUp(): void {
    if (!this.cursor.isDragging) return;

    this.cursor.isDragging = false;
    this.onDraggingUpdate?.(this.cursor.isDragging);
  }
  handlePointerMove({ x, y }: { x: number; y: number }): void {
    this.cursor.x = x;
    this.cursor.y = y;
  }
  handlePointerLeave(): void {
    this.cursor.isDragging = false;
    this.onDraggingUpdate?.(this.cursor.isDragging);
  }
  handleScroll(amount: number): void {
    this.cursor.accumulatedScroll += amount;
  }
  handlePlaneSelect(plane: number): void {
    if (plane !== 0 && plane !== 1 && plane !== 2 && plane !== 3) return;

    this.plane = plane;
  }

  /**
   * Converts the cursor coords (which are relative to the window) to the OSRS Wiki's coordinates.
   * Do NOT use this as world coordinates e.g. for the rendering context, this is for display purposes.
   */
  private cursorCoordsAsWikiWorldCoordinates(context: Context2DScaledWrapper): CoordinatePair {
    const cursorCoordinates = context.screenPositionToWorldPosition({ x: this.cursor.x, y: this.cursor.y });

    // This conversion factor is a little weird, but for whatever reason the coordinates the wiki uses are shifted from what we end up with.
    // I have not investigated, and I assume it is due to how the region images are saved and everything.
    return {
      x: Math.floor(cursorCoordinates.x) + OURS_TO_WIKI_CONVERSION_FACTOR_X,
      y: -Math.floor(cursorCoordinates.y) + OURS_TO_WIKI_CONVERSION_FACTOR_Y,
    };
  }

  public onCursorCoordinatesUpdate?: (coords: CoordinatePair) => void;
  public onDraggingUpdate?: (dragging: boolean) => void;

  private updateCursorVelocity(elapsed: number): void {
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

      this.cursor.accumulatedFrictionMS = 0;
    } else {
      this.cursor.accumulatedFrictionMS += elapsed;
    }
  }

  private updateCameraPositionFromCursorVelocity(): void {
    const cursorDeltaX = this.cursor.x - this.cursor.previousX;
    const cursorDeltaY = this.cursor.y - this.cursor.previousY;

    // When calculating camera delta from cursor delta, we negate,
    // since dragging is opposite the intended direction of movement.

    const worldUnitsPerCursorUnit = this.camera.zoom;
    if (this.cursor.isDragging) {
      this.camera.x += -worldUnitsPerCursorUnit * cursorDeltaX;
      this.camera.y += -worldUnitsPerCursorUnit * cursorDeltaY;
    } else {
      // The camera continues to move with linear deceleration due to friction

      const SPEED_THRESHOLD = 0.05;
      const FRICTION_PER_MS = 0.004;

      const velocityAverageX = average(this.cursor.rateSamplesX);
      const velocityAverageY = average(this.cursor.rateSamplesY);

      const speed = Math.sqrt(velocityAverageX * velocityAverageX + velocityAverageY * velocityAverageY);
      const speedAfterFriction = speed - FRICTION_PER_MS * this.cursor.accumulatedFrictionMS;
      if (speedAfterFriction > SPEED_THRESHOLD) {
        const directionX = velocityAverageX / speed;
        const directionY = velocityAverageY / speed;

        this.camera.x += -worldUnitsPerCursorUnit * speedAfterFriction * directionX;
        this.camera.y += -worldUnitsPerCursorUnit * speedAfterFriction * directionY;
      }
    }
  }

  private updateCameraZoomFromCursorScroll(): void {
    const ZOOM_SENSITIVITY = 1 / 3000;
    if (this.cursor.accumulatedScroll !== 0) {
      this.camera.zoom += ZOOM_SENSITIVITY * this.cursor.accumulatedScroll;
    }
    this.cursor.accumulatedScroll = 0;
    this.camera.zoom = Math.max(Math.min(this.camera.zoom, this.camera.maxZoom), this.camera.minZoom);
  }

  update(context: Context2DScaledWrapper): void {
    const currentUpdateTime = performance.now();
    const elapsed = currentUpdateTime - this.lastUpdateTime;

    if (elapsed < 0.001) return;

    this.updateCursorVelocity(elapsed);

    const previousZoom = this.camera.zoom;
    context.setTransform({
      translation: { x: this.camera.x, y: this.camera.y },
      scale: previousZoom,
      pixelPerfectDenominator: REGION_IMAGE_PIXEL_SIZE,
    });
    this.updateCameraZoomFromCursorScroll();
    const zoom = this.camera.zoom;

    if (zoom !== previousZoom) {
      const cursorWorldPosition = context.screenPositionToWorldPosition({ x: this.cursor.x, y: this.cursor.y });
      // Zoom requires special handling since we want to zoom in on the cursor.
      // This requires translating the camera towards the cursor some amount
      const cameraToCursorWorldDelta: CoordinatePair = {
        x: this.camera.x - cursorWorldPosition.x,
        y: this.camera.y - cursorWorldPosition.y,
      };
      const zoomRatio = zoom / previousZoom;
      this.camera.x = cursorWorldPosition.x + zoomRatio * cameraToCursorWorldDelta.x;
      this.camera.y = cursorWorldPosition.y + zoomRatio * cameraToCursorWorldDelta.y;
    }
    this.updateCameraPositionFromCursorVelocity();

    const cameraWorldPosition = {
      x: this.camera.x,
      y: this.camera.y,
    };
    context.setTransform({
      translation: cameraWorldPosition,
      scale: zoom,
      pixelPerfectDenominator: REGION_IMAGE_PIXEL_SIZE,
    });

    this.drawAll(context);

    const cursorHasMoved = this.cursor.x !== this.cursor.previousX || this.cursor.y !== this.cursor.previousY;
    if (cursorHasMoved) {
      const displayCoords = this.cursorCoordsAsWikiWorldCoordinates(context);
      this.onCursorCoordinatesUpdate?.(displayCoords);
    }

    this.cursor.previousX = this.cursor.x;
    this.cursor.previousY = this.cursor.y;
    this.lastUpdateTime = currentUpdateTime;
  }

  private drawVisibleIcons(context: Context2DScaledWrapper): void {
    // When zooming out, we want icons to get bigger since they would become unreadable otherwise.
    const iconScale = 16 * Math.max(context.getScale(), 1 / 8);

    const viewPlaneWorldOffset = context.viewPlaneWorldOffset();
    const viewPlaneWorldExtent = context.viewPlaneWorldExtent();

    const regionXMin = Math.floor((viewPlaneWorldOffset.x - 0.5 * viewPlaneWorldExtent.width) / WORLD_UNITS_PER_REGION);
    const regionXMax = Math.ceil((viewPlaneWorldOffset.x + 0.5 * viewPlaneWorldExtent.width) / WORLD_UNITS_PER_REGION);

    const regionYMin = -Math.ceil(
      (viewPlaneWorldOffset.y + 0.5 * viewPlaneWorldExtent.height) / WORLD_UNITS_PER_REGION,
    );
    const regionYMax = -Math.floor(
      (viewPlaneWorldOffset.y - 0.5 * viewPlaneWorldExtent.height) / WORLD_UNITS_PER_REGION,
    );

    for (let regionX = regionXMin - 1; regionX <= regionXMax; regionX++) {
      for (let regionY = regionYMin - 1; regionY <= regionYMax; regionY++) {
        const mapIcons = this.iconsByRegion.get(hashMapRegionCoordinate2Ds({ x: regionX, y: regionY }));
        if (mapIcons === undefined) continue;

        // The 1 centers the icons, the 64 is to get it to be visually correct.
        // I'm not too sure where the 64 comes from, but it exists since our regions/images/coordinates are not quite synced up.

        const offsetX = -iconScale / 2;
        const offsetY = -iconScale / 2 + 64;

        mapIcons.forEach(({ spriteIndex, worldPosition }) => {
          context.drawImage({
            image: this.iconsAtlas,
            imageOffsetInPixels: { x: spriteIndex * ICON_IMAGE_PIXEL_SIZE, y: 0 },
            imageExtentInPixels: { width: ICON_IMAGE_PIXEL_SIZE, height: ICON_IMAGE_PIXEL_SIZE },
            worldPosition: { x: worldPosition.x + offsetX, y: -worldPosition.y + offsetY },
            worldExtent: { width: iconScale, height: iconScale },
            pixelPerfect: true,
          });
        });
      }
    }
  }

  private drawVisibleRegions(context: Context2DScaledWrapper): void {
    /*
     * WARNING:
     * Region coordinates are FLIPPED from Canvas coordinates.
     * Region 0,0 is the bottom left of the world (south-west in game).
     * Canvas x axis is the same, but y is flipped.
     * So our regions "exist" only in negative canvas y.
     * This requires some annoying sign flips for the y coordinates below.
     * We only do this when converting between world and RS coordinates,
     * since the canvas2D API is really hard to work with flips.
     *
     * For reference, the world regions surrounded by the ocean run from
     * (18, 39) to (53, 64)
     */

    const viewPlaneWorldOffset = context.viewPlaneWorldOffset();
    const viewPlaneWorldExtent = context.viewPlaneWorldExtent();

    const regionXMin = Math.floor((viewPlaneWorldOffset.x - 0.5 * viewPlaneWorldExtent.width) / WORLD_UNITS_PER_REGION);
    const regionXMax = Math.ceil((viewPlaneWorldOffset.x + 0.5 * viewPlaneWorldExtent.width) / WORLD_UNITS_PER_REGION);

    const regionYMin = -Math.ceil(
      (viewPlaneWorldOffset.y + 0.5 * viewPlaneWorldExtent.height) / WORLD_UNITS_PER_REGION,
    );
    const regionYMax = -Math.floor(
      (viewPlaneWorldOffset.y - 0.5 * viewPlaneWorldExtent.height) / WORLD_UNITS_PER_REGION,
    );

    context.setFillStyle("black");

    for (let regionX = regionXMin - 1; regionX <= regionXMax; regionX++) {
      for (let regionY = regionYMin - 1; regionY <= regionYMax; regionY++) {
        const coordinateHash = hashMapRegionCoordinate3Ds({ position: { x: regionX, y: regionY }, plane: this.plane });

        const worldPosition: CoordinatePair = {
          x: regionX * WORLD_UNITS_PER_REGION,
          y: -regionY * WORLD_UNITS_PER_REGION,
        };
        const worldExtent: ExtentPair = {
          width: WORLD_UNITS_PER_REGION,
          height: WORLD_UNITS_PER_REGION,
        };

        if (!this.regions.has(coordinateHash)) {
          const region: MapRegion = {
            loaded: false,
            image: new Image(REGION_IMAGE_PIXEL_SIZE, REGION_IMAGE_PIXEL_SIZE),
          };
          const regionFileBaseName = `${this.plane}_${regionX}_${regionY}`;
          region.image.src = `/map/${regionFileBaseName}.webp`;
          region.image.onload = (): void => {
            region.loaded = true;
          };
          this.regions.set(coordinateHash, region);
        }
        const region = this.regions.get(coordinateHash)!;

        if (!region.loaded) {
          context.fillRect({
            worldPosition,
            worldExtent,
          });
          continue;
        }

        context.drawImage({
          image: region.image,
          imageOffsetInPixels: { x: 0, y: 0 },
          imageExtentInPixels: { width: region.image.width, height: region.image.height },
          worldPosition,
          worldExtent,
        });
      }
    }
  }

  /**
   * A map label is pre-rendered text labelling areas such as "Karamja" and "Mudskipper Point".
   */
  private drawVisibleAreaLabels(context: Context2DScaledWrapper): void {
    const labelScale = 1 * Math.max(context.getScale(), 1 / 12);

    const viewPlaneWorldOffset = context.viewPlaneWorldOffset();
    const viewPlaneWorldExtent = context.viewPlaneWorldExtent();

    const regionXMin = Math.floor((viewPlaneWorldOffset.x - 0.5 * viewPlaneWorldExtent.width) / WORLD_UNITS_PER_REGION);
    const regionXMax = Math.ceil((viewPlaneWorldOffset.x + 0.5 * viewPlaneWorldExtent.width) / WORLD_UNITS_PER_REGION);

    const regionYMin = -Math.ceil(
      (viewPlaneWorldOffset.y + 0.5 * viewPlaneWorldExtent.height) / WORLD_UNITS_PER_REGION,
    );
    const regionYMax = -Math.floor(
      (viewPlaneWorldOffset.y - 0.5 * viewPlaneWorldExtent.height) / WORLD_UNITS_PER_REGION,
    );

    for (let regionX = regionXMin - 1; regionX <= regionXMax; regionX++) {
      for (let regionY = regionYMin - 1; regionY <= regionYMax; regionY++) {
        const labels = this.labelsByRegion.get(hashMapRegionCoordinate2Ds({ x: regionX, y: regionY }));
        if (labels === undefined) continue;

        labels.forEach((label) => {
          const { labelID, worldPosition, plane } = label;
          if (plane !== this.plane) return;

          if (label.image === undefined) {
            label.image = new Image();
            label.image.src = `/map/labels/${labelID}.webp`;
            label.image.onload = (): void => {
              label.loaded = true;
            };
          }
          const image = label.image;

          if (!label.loaded) return;

          if (plane !== 0) return;

          const offsetX = 0;
          const offsetY = 64;

          context.drawImage({
            image,
            imageOffsetInPixels: { x: 0, y: 0 },
            imageExtentInPixels: { width: image.width, height: image.height },
            worldPosition: { x: worldPosition.x + offsetX, y: -worldPosition.y + offsetY },
            worldExtent: { width: labelScale * image.width, height: labelScale * image.height },
            pixelPerfect: true,
          });
        });
      }
    }
  }

  private drawAll(context: Context2DScaledWrapper): void {
    this.drawVisibleRegions(context);
    this.drawVisibleIcons(context);
    this.drawVisibleAreaLabels(context);
  }
}

interface CanvasMapProps {
  interactive: boolean;
}
export const CanvasMap = ({ interactive }: CanvasMapProps): ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelRatioRef = useRef<number>(1);
  const [renderer, setRenderer] = useState<CanvasMapRenderer>();
  const [dragging, setDragging] = useState<boolean>();
  const [coordinates, setCoordinates] = useState<CoordinatePair>();
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

    if (renderer === undefined) return;

    const context = new Context2DScaledWrapper({
      pixelRatio: pixelRatioRef.current,
      context: canvasRef.current.getContext("2d")!,
    });

    renderer.update(context);
    animationFrameHandleRef.current = window.requestAnimationFrame(() => {
      render();
    });
  }, [renderer]);

  useEffect(() => {
    console.info("Rebuilding renderer.");

    fetchMapJSON()
      .then((mapData) => {
        const ICONS_IN_ATLAS = 123;
        const iconAtlas = new Image(ICONS_IN_ATLAS * ICON_IMAGE_PIXEL_SIZE, ICON_IMAGE_PIXEL_SIZE);
        iconAtlas.src = "/map/icons/map_icons.webp";
        setRenderer(new CanvasMapRenderer(mapData, iconAtlas));
      })
      .catch((reason) => {
        console.error("Failed to build renderer:", reason);
      });
  }, [setRenderer]);

  useEffect(() => {
    if (renderer === undefined) return;

    renderer.onCursorCoordinatesUpdate = setCoordinates;

    return (): void => {
      renderer.onCursorCoordinatesUpdate = undefined;
    };
  }, [setCoordinates, renderer]);
  useEffect(() => {
    if (renderer === undefined) return;

    renderer.onDraggingUpdate = setDragging;

    return (): void => {
      renderer.onDraggingUpdate = undefined;
    };
  }, [setDragging, renderer]);

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
      renderer?.handlePointerMove({ x: clientX, y: clientY });
    },
    [renderer],
  );
  const handlePointerUp = useCallback(() => {
    renderer?.handlePointerUp();
  }, [renderer]);
  const handlePointerDown = useCallback(() => {
    renderer?.handlePointerDown();
  }, [renderer]);
  const handlePointerLeave = useCallback(() => {
    renderer?.handlePointerLeave();
  }, [renderer]);
  const handleScroll = useCallback(
    ({ deltaY }: { deltaY: number }) => {
      renderer?.handleScroll(deltaY);
    },
    [renderer],
  );
  const handleSelectPlane = useCallback(
    (plane: number) => {
      renderer?.handlePlaneSelect(plane);
    },
    [renderer],
  );

  const coordinatesView = coordinates ? `X: ${coordinates.x}, Y: ${coordinates.y}` : undefined;
  const draggingClass = dragging ? "dragging" : undefined;
  const interactiveClass = interactive ? "interactive" : undefined;

  return (
    <div className="canvas-map">
      <canvas
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleScroll}
        id="background-worldmap"
        className={`${draggingClass} ${interactiveClass}`}
        ref={canvasRef}
      />
      <div className="canvas-map-plane-select-container rsborder-tiny rsbackground">
        <select
          className="canvas-map-plane-select"
          onChange={(e) => {
            handleSelectPlane(e.target.selectedIndex);
          }}
        >
          <option value="1">Plane: 1</option>
          <option value="2">Plane: 2</option>
          <option value="3">Plane: 3</option>
          <option value="4">Plane: 4</option>
        </select>
      </div>
      <div className="canvas-map__coordinates">{coordinatesView}</div>
    </div>
  );
};
