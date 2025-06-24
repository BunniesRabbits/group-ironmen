export interface CoordinatePair {
  x: number;
  y: number;
}
export interface ExtentPair {
  width: number;
  height: number;
}
export interface CoordinateTriplet {
  x: number;
  y: number;
  plane: number;
}

// Figuring out when to apply scaling is hard, so this wrapper handles
// that by implementing a subset of Context2D rendering commands.
export class Context2DScaledWrapper {
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
    alpha,
  }: {
    image: ImageBitmap;
    imageOffsetInPixels: CoordinatePair;
    imageExtentInPixels: ExtentPair;
    worldPosition: CoordinatePair;
    worldExtent: ExtentPair;
    pixelPerfect?: boolean;
    alpha: number;
  }): void {
    const position = this.convertWorldPositionToView(worldPosition);
    const extent = this.convertWorldExtentToView(worldExtent);

    pixelPerfect = pixelPerfect ?? false;

    const previousAlpha = this.context.globalAlpha;
    this.context.globalAlpha = alpha;
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
    this.context.globalAlpha = previousAlpha;
  }

  drawText({ worldPosition, label }: { worldPosition: CoordinatePair; label: string }): void {
    const position = this.convertWorldPositionToView(worldPosition);

    this.context.fillStyle = "yellow";
    this.context.font = `40px rssmall`;
    this.context.textAlign = "center";
    this.context.lineWidth = 1;

    this.context.fillText(label, position.x, position.y);
  }
}
