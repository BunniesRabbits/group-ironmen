import { fetchMapJSON, type MapMetadata } from "../../data/map-data";
import type { Distinct } from "../../util";
import type { CoordinatePair, Context2DScaledWrapper, ExtentPair, CoordinateTriplet } from "./canvas-wrapper";

export interface LabelledCoordinates {
  label: string;
  coords: CoordinateTriplet;
}

export const ICON_IMAGE_PIXEL_SIZE = 15;
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
const REGION_FADE_IN_SECONDS = 1;
const REGION_FADE_IN_ALPHA_PER_MS = 1 / (REGION_FADE_IN_SECONDS * 1000);
interface MapRegion {
  alpha: number;
  // Undefined while loading from file
  image?: ImageBitmap;
  position: CoordinatePair;
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
  image?: ImageBitmap;
}
type MapLabelGrid = Map<MapRegionCoordinate2DHash, MapLabel[]>;
// Returns 0 for empty array
const average = (arr: number[]): number => {
  if (arr.length < 1) return 0;
  return arr.reduce((previous, current) => previous + current, 0) / arr.length;
};
const OURS_TO_WIKI_CONVERSION_FACTOR_X = -128;
const OURS_TO_WIKI_CONVERSION_FACTOR_Y = 63;

export class CanvasMapRenderer {
  private regions: RegionGrid;
  private camera: CanvasMapCamera;
  private cursor: CanvasMapCursor;
  private lastUpdateTime: DOMHighResTimeStamp;
  private iconsAtlas?: ImageBitmap;
  private iconsByRegion?: MapIconGrid;
  private labelsByRegion?: MapLabelGrid;
  private playerPositions = new Map<string, CoordinateTriplet>();

  public forceRenderNextFrame = false;

  /**
   * This stores which plane of the runescape world to render.
   * Only 4 of them (index 0 to 3) have valid images.
   * The region image assets have all 3 planes visibly composited, so we only need to render
   * one image per region.
   */
  private plane: number;

  private processMapData(mapData: MapMetadata): void {
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

  private constructor() {
    const INITIAL_X = 3360;
    const INITIAL_Y = -3150;
    const INITIAL_ZOOM = 1 / 4;
    const INITIAL_PLANE = 0;

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
  }

  public static async load(): Promise<CanvasMapRenderer> {
    const renderer = new CanvasMapRenderer();

    // Promisify the image loading
    const iconAtlasPromise = new Promise<ImageBitmap>((resolve) => {
      const ICONS_IN_ATLAS = 123;
      const iconAtlas = new Image(ICONS_IN_ATLAS * ICON_IMAGE_PIXEL_SIZE, ICON_IMAGE_PIXEL_SIZE);
      iconAtlas.src = "/map/icons/map_icons.webp";
      iconAtlas.onload = (): void => {
        resolve(createImageBitmap(iconAtlas));
      };
    });

    const [mapData, iconAtlas_1] = await Promise.all([fetchMapJSON(), iconAtlasPromise]);
    renderer.processMapData(mapData);
    renderer.iconsAtlas = iconAtlas_1;
    return renderer;
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

  public jumpToWorldPosition({ coords }: { coords: CoordinateTriplet }): void {
    this.camera.x = coords.x - OURS_TO_WIKI_CONVERSION_FACTOR_X;
    this.camera.y = -coords.y + OURS_TO_WIKI_CONVERSION_FACTOR_Y;
    this.plane = coords.plane;

    this.cursor.accumulatedScroll = 0;
    this.cursor.rateSamplesX = [];
    this.cursor.rateSamplesY = [];
    this.cursor.isDragging = false;
  }

  public updatePlayerPositionsFromOSRSCoordinates(positions: LabelledCoordinates[]): void {
    this.playerPositions.clear();
    for (const { label, coords } of positions) {
      const { x, y, plane } = coords;
      this.playerPositions.set(label, { x, y: -y, plane });
    }
    this.forceRenderNextFrame = true;
  }

  private updateCursorVelocity(elapsed: number): void {
    if (elapsed < 0.001) return;

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

  /**
   * @param elapsed Milliseconds elapsed since last update.
   * @returns Whether or not any VISIBLE tiles updated their alpha.
   */
  private updateRegionsAlpha(context: Context2DScaledWrapper, elapsed: number): boolean {
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

    let anyVisibleTileUpdatedAlpha = false;

    this.regions.forEach((region) => {
      if (region.image === undefined) {
        region.alpha = 0;
        return;
      }

      const previousAlpha = region.alpha;
      region.alpha = Math.min(1, region.alpha + elapsed * REGION_FADE_IN_ALPHA_PER_MS);

      const alphaChanged = previousAlpha !== region.alpha;
      const regionIsProbablyVisible =
        (region.position.x >= regionXMin && region.position.x <= regionXMax) ||
        (region.position.y >= regionYMin && region.position.y <= regionYMax);

      anyVisibleTileUpdatedAlpha ||= alphaChanged && regionIsProbablyVisible;
    });

    return anyVisibleTileUpdatedAlpha;
  }

  update(context: Context2DScaledWrapper): void {
    const previousTransform = {
      translation: { x: this.camera.x, y: this.camera.y },
      scale: this.camera.zoom,
    };

    const currentUpdateTime = performance.now();
    const elapsed = currentUpdateTime - this.lastUpdateTime;

    if (!this.forceRenderNextFrame && elapsed < 0.001) return;

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

    const currentTransform = {
      translation: { x: this.camera.x, y: this.camera.y },
      scale: this.camera.zoom,
    };

    context.setTransform({
      translation: currentTransform.translation,
      scale: currentTransform.scale,
      pixelPerfectDenominator: REGION_IMAGE_PIXEL_SIZE,
    });

    const transformHasChanged =
      currentTransform.scale !== previousTransform.scale ||
      currentTransform.translation.x !== previousTransform.translation.x ||
      currentTransform.translation.y !== previousTransform.translation.y;
    const anyVisibleRegionUpdatedAlpha = this.updateRegionsAlpha(context, elapsed);

    this.loadVisibleAll(context);
    if (anyVisibleRegionUpdatedAlpha || transformHasChanged || this.forceRenderNextFrame) {
      this.forceRenderNextFrame = false;
      this.drawAll(context);
    }

    const cursorHasMoved = this.cursor.x !== this.cursor.previousX || this.cursor.y !== this.cursor.previousY;
    if (cursorHasMoved) {
      const displayCoords = this.cursorCoordsAsWikiWorldCoordinates(context);
      this.onCursorCoordinatesUpdate?.(displayCoords);
    }

    this.cursor.previousX = this.cursor.x;
    this.cursor.previousY = this.cursor.y;
    this.lastUpdateTime = currentUpdateTime;
  }

  private loadVisibleAll(context: Context2DScaledWrapper): void {
    // Load regions and labels, which use individual images.
    // Icons are in an atlas and are already loaded.
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
        const hash3D = hashMapRegionCoordinate3Ds({ position: { x: regionX, y: regionY }, plane: this.plane });
        const hash2D = hashMapRegionCoordinate2Ds({ x: regionX, y: regionY });

        if (!this.regions.has(hash3D)) {
          const image = new Image(REGION_IMAGE_PIXEL_SIZE, REGION_IMAGE_PIXEL_SIZE);
          const regionFileBaseName = `${this.plane}_${regionX}_${regionY}`;

          const region: MapRegion = {
            alpha: 0,
            position: { x: regionX, y: regionY },
          };
          image.src = `/map/${regionFileBaseName}.webp`;
          image.onload = (): void => {
            createImageBitmap(image)
              .then((bitmap) => {
                region.image = bitmap;
              })
              .catch((reason) => {
                console.error("Failed to load image bitmap for:", image.src, reason);
              });
          };

          this.regions.set(hash3D, region);
        }

        const labels = this.labelsByRegion?.get(hash2D);
        if (labels === undefined) continue;

        labels.forEach((label) => {
          const { labelID, plane } = label;
          if (plane !== this.plane) return;

          if (label.image === undefined) {
            const image = new Image();
            image.src = `/map/labels/${labelID}.webp`;
            image.onload = (): void => {
              createImageBitmap(image)
                .then((bitmap) => (label.image = bitmap))
                .catch((reason) => console.error("Failed to load image bitmap for", image.src, reason));
            };
          }
        });
      }
    }
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
        const mapIcons = this.iconsByRegion?.get(hashMapRegionCoordinate2Ds({ x: regionX, y: regionY }));
        if (!mapIcons || !this.iconsAtlas) continue;

        // The 1 centers the icons, the 64 is to get it to be visually correct.
        // I'm not too sure where the 64 comes from, but it exists since our regions/images/coordinates are not quite synced up.
        const offsetX = -iconScale / 2;
        const offsetY = -iconScale / 2 + 64;

        mapIcons.forEach(({ spriteIndex, worldPosition }) => {
          context.drawImage({
            image: this.iconsAtlas!,
            imageOffsetInPixels: { x: spriteIndex * ICON_IMAGE_PIXEL_SIZE, y: 0 },
            imageExtentInPixels: { width: ICON_IMAGE_PIXEL_SIZE, height: ICON_IMAGE_PIXEL_SIZE },
            worldPosition: { x: worldPosition.x + offsetX, y: -worldPosition.y + offsetY },
            worldExtent: { width: iconScale, height: iconScale },
            pixelPerfect: true,
            alpha: 1,
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

        const region = this.regions.get(coordinateHash);
        if (region === undefined) continue;

        if (region.image === undefined) {
          context.fillRect({
            worldPosition,
            worldExtent,
          });
          continue;
        }

        if (region.alpha < 1) {
          context.fillRect({
            worldPosition,
            worldExtent,
          });
        }
        context.drawImage({
          image: region.image,
          imageOffsetInPixels: { x: 0, y: 0 },
          imageExtentInPixels: { width: region.image.width, height: region.image.height },
          worldPosition,
          worldExtent,
          alpha: region.alpha,
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
        const labels = this.labelsByRegion?.get(hashMapRegionCoordinate2Ds({ x: regionX, y: regionY }));
        if (labels === undefined) continue;

        labels.forEach((label) => {
          const { worldPosition, plane } = label;

          const image = label.image;
          if (plane !== this.plane || image === undefined) return;

          const offsetX = 0;
          const offsetY = 64;

          context.drawImage({
            image,
            imageOffsetInPixels: { x: 0, y: 0 },
            imageExtentInPixels: { width: image.width, height: image.height },
            worldPosition: { x: worldPosition.x + offsetX, y: -worldPosition.y + offsetY },
            worldExtent: { width: labelScale * image.width, height: labelScale * image.height },
            pixelPerfect: true,
            alpha: 1,
          });
        });
      }
    }
  }

  private drawAll(context: Context2DScaledWrapper): void {
    this.drawVisibleRegions(context);
    this.drawVisibleIcons(context);
    this.drawVisibleAreaLabels(context);

    for (const [player, { x, y }] of this.playerPositions) {
      context.setFillStyle("blue");
      context.fillRect({
        worldPosition: { x: x - OURS_TO_WIKI_CONVERSION_FACTOR_X, y: y + OURS_TO_WIKI_CONVERSION_FACTOR_Y },
        worldExtent: { height: 1, width: 1 },
      });
      context.drawText({
        label: player,
        worldPosition: { x: x - OURS_TO_WIKI_CONVERSION_FACTOR_X, y: y + OURS_TO_WIKI_CONVERSION_FACTOR_Y },
      });
    }
  }
}
