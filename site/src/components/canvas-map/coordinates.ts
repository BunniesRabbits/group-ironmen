import type { Distinct, DistinctPair } from "../../util";

export type Position1D = Distinct<number, "Position1D">;
export type Displacement1D = Distinct<number, "Displacement1D">;
export type Velocity1D = Distinct<number, "Velocity1D">;

export type Width = Distinct<number, "Width">;
export type Height = Distinct<number, "Height">;

type Space = "Wiki" | "World" | "View" | "Cursor" | "Image" | "Region";
type Category = "Position" | "Displacement" | "Velocity";

type Component<C extends Category, S extends Space> = DistinctPair<number, C, S>;

/*
 * The crux of this is that positions and displacements (position - position)
 * are not interchangeable. They operate differently under linear operators,
 * e.g. displacements are not translated and only ever scaled. So only some
 * algebraic operations make sense, and the types in this file restrict that.
 *
 * To avoid accidental assignments and conversions, we leverage Typescript. With
 * these extra discriminators, vectors of different categories cannot be
 * implicitly converted. This makes manually working with them difficult, but we
 * write helper functions that handle all the conversions and math correctly.
 */

interface Vec2D<C extends Category, S extends Space> {
  x: Component<C, S>;
  y: Component<C, S>;
  __DIMENSION__: "2D";
  __CATEGORY__: C;
  __SPACE__: S;
}

interface Vec3D<C extends Category, S extends Space> {
  x: Component<C, S>;
  y: Component<C, S>;
  z: Component<C, S>;
  __DIMENSION__: "3D";
  __CATEGORY__: C;
  __SPACE__: S;
}

type Position2D<S extends Space> = Vec2D<"Position", S>;
type Displacement2D<S extends Space> = Vec2D<"Displacement", S>;
type Velocity2D<S extends Space> = Vec2D<"Velocity", S>;

export interface Transform2D {
  translation: WorldPosition2D;
  scale: number;
}

/*
 * The coordinates utilized by the wiki and the remote backend. This is a
 * distinct coordinate system since there is a shift from the natural coordinate
 * system that I have not yet reconciled. Also, the y axis is flipped.
 */

export type WikiPosition3D = Vec3D<"Position", "Wiki">;
export type WikiPosition2D = Vec2D<"Position", "Wiki">;
export type WikiDisplacement2D = Vec2D<"Displacement", "Wiki">;

/*
 * These coordinates are 1 to 1 with Runescape squares, but translated from the
 * exact coordinates that the wiki/remote backend uses.
 */

export type WorldPosition3D = Vec3D<"Position", "World">;
export type WorldPosition2D = Vec2D<"Position", "World">;
export type WorldDisplacement2D = Vec2D<"Displacement", "World">;

/*
 * Region coordinates are used by the grid of background tiles for the world map.
 */

export type RegionPosition2D = Vec2D<"Position", "Region">;
export type RegionDisplacement2D = Vec2D<"Displacement", "Region">;
export type RegionPosition3D = Vec3D<"Position", "Region">;

/*
 * These coordinates are 1 to 1 with logical/CSS pixels (the specifics are up to
 * the renderer). The origin in this coordinate space is the center of the
 * screen, with the rest of the screen extending in the +/- direction.
 */

export type ViewPosition2D = Vec2D<"Position", "View">;
export type ViewDisplacement2D = Vec2D<"Displacement", "View">;

/*
 * These coordinates are what the pointer events use. They have the same origin
 * and orientation as the canvas pixel coordinates, but use the size of a
 * logical/CSS pixel.
 */

/**
 * (ClientX, ClientY) in pointer events.
 */
export type CursorPosition2D = Vec2D<"Position", "Cursor">;
/**
 * (ClientWidth, ClientHeight) on DOM elements.
 */
export type CursorDisplacement2D = Vec2D<"Displacement", "Cursor">;
export type CursorVelocity2D = Vec2D<"Velocity", "Cursor">;

/*
 * Image coordinates are what are used when referring to an image resource
 * utilized by the canvas 2D API.
 */

export type ImagePosition2D = Vec2D<"Position", "Image">;
export type ImageDisplacement2D = Vec2D<"Displacement", "Image">;

/**
 * For whatever reason, regions are identified by a position far offset from
 * their actual coordinate position.
 *
 * E.g., the Lumbridge tile is named "0_52_50.webp". It runs from (3200,3200) to
 * (3264,3264) in in-game coordinates.
 *
 * However, (52,50) * 64 = (3328,3200) = (3200,3200) + (128,0), so we offset by
 * that amount. Using the minimum corner (3200,3200) makes the most sense from a
 * rendering perspective.
 */
const WORLD_TO_REGION_CONVERSION = {
  x: -128,
  y: 0,
};

const REGION_IMAGE_PIXEL_SIZE = 256;

const RS_SQUARE_PIXEL_SIZE = 4;
const WORLD_UNITS_PER_REGION = REGION_IMAGE_PIXEL_SIZE / RS_SQUARE_PIXEL_SIZE;

export const REGION_IMAGE_PIXEL_EXTENT = Object.freeze({
  x: REGION_IMAGE_PIXEL_SIZE,
  y: REGION_IMAGE_PIXEL_SIZE,
} as ImageDisplacement2D);

export const REGION_WORLD_EXTENT = Object.freeze({
  x: WORLD_UNITS_PER_REGION,
  y: WORLD_UNITS_PER_REGION,
} as WorldDisplacement2D);

export const ICON_IMAGE_PIXEL_EXTENT = Object.freeze({
  x: 15,
  y: 15,
} as ImageDisplacement2D);

export const convertPos3DWorldToWiki = ({ x, y, z }: WorldPosition3D): WikiPosition3D => {
  return {
    x: x as number,
    y: -(y as number),
    z: z as number,
  } as WikiPosition3D;
};

export const convertPos3DWikiToWorld = ({ x, y, z }: WikiPosition3D): WorldPosition3D => {
  return {
    x: x as number,
    y: -(y as number),
    z: z as number,
  } as WorldPosition3D;
};

export const convertPos2DWorldToWiki = ({ x, y }: WorldPosition2D): WikiPosition2D => {
  return {
    x: x as number,
    y: -(y as number),
  } as WikiPosition2D;
};

export const convertPos2DCursorToView = ({
  cursor,
  canvasExtent,
}: {
  cursor: CursorPosition2D;
  canvasExtent: CursorDisplacement2D;
}): ViewPosition2D => {
  return {
    x: cursor.x - 0.5 * canvasExtent.x,
    y: cursor.y - 0.5 * canvasExtent.y,
  } as ViewPosition2D;
};

export const convertDisplacement2DCursorToWorld = ({
  cursor,
  camera,
}: {
  cursor: CursorDisplacement2D;
  camera: { scale: number };
}): WorldDisplacement2D => {
  return {
    x: camera.scale * cursor.x,
    y: camera.scale * cursor.y,
  } as WorldDisplacement2D;
};

export const convertPos2DViewToWorld = ({
  view: { x, y },
  camera: { scale, translation },
}: {
  view: ViewPosition2D;
  camera: { scale: number; translation: WorldPosition2D };
}): WorldPosition2D => {
  return {
    x: scale * x + translation.x,
    y: scale * y + translation.y,
  } as WorldPosition2D;
};
export const convertPos2DWorldToView = ({
  world: { x, y },
  camera: { scale, translation },
}: {
  world: WorldPosition2D;
  camera: { scale: number; translation: WorldPosition2D };
}): ViewPosition2D => {
  return {
    x: (x - translation.x) / scale,
    y: (y - translation.y) / scale,
  } as ViewPosition2D;
};

export const Pos2D = {
  cursorToWorld({
    cursor,
    camera,
    canvasExtent,
  }: {
    cursor: CursorPosition2D;
    camera: Transform2D;
    canvasExtent: CursorDisplacement2D;
  }): WorldPosition2D {
    const view = convertPos2DCursorToView({ cursor, canvasExtent });
    const world = convertPos2DViewToWorld({ view, camera });
    return world;
  },

  wikiToWorld({ x, y }: WikiPosition2D): WorldPosition2D {
    return {
      x: x as number,
      y: -(y as number),
    } as WorldPosition2D;
  },

  regionToWorld2D({ x, y }: RegionPosition2D): WorldPosition2D {
    return {
      x: x * WORLD_UNITS_PER_REGION + WORLD_TO_REGION_CONVERSION.x,
      y: -(y * WORLD_UNITS_PER_REGION + WORLD_TO_REGION_CONVERSION.y),
    } as WorldPosition2D;
  },

  worldToRegion2D({ x, y }: WorldPosition2D): RegionPosition2D {
    return {
      x: (x - WORLD_TO_REGION_CONVERSION.x) / WORLD_UNITS_PER_REGION,
      y: -(y + WORLD_TO_REGION_CONVERSION.y) / WORLD_UNITS_PER_REGION,
    } as RegionPosition2D;
  },
};

export const Disp2D = {
  worldToView({ world, camera: { scale } }: { world: WorldDisplacement2D; camera: Transform2D }): ViewDisplacement2D {
    return {
      x: world.x / scale,
      y: world.y / scale,
    } as ViewDisplacement2D;
  },

  viewToWorld({ view, camera: { scale } }: { view: ViewDisplacement2D; camera: Transform2D }): WorldDisplacement2D {
    return {
      x: scale * view.x,
      y: scale * view.y,
    } as WorldDisplacement2D;
  },

  cursorToWorld({
    cursor,
    camera,
  }: {
    cursor: CursorDisplacement2D;
    camera: Transform2D;
    canvasExtent: CursorDisplacement2D;
  }): WorldDisplacement2D {
    const view = createVec2D<ViewDisplacement2D>(cursor);
    const world = this.viewToWorld({ view, camera });
    return world;
  },
};

export const convertPos2DCursorToWiki = ({
  cursor,
  canvasExtent,
  camera,
}: {
  cursor: CursorPosition2D;
  canvasExtent: CursorDisplacement2D;
  camera: Transform2D;
}): WikiPosition2D => {
  const view = convertPos2DCursorToView({ cursor, canvasExtent });
  const world = convertPos2DViewToWorld({ view, camera });
  const wiki = convertPos2DWorldToWiki(world);
  return wiki;
};

/*
 * Helper type that help match types across operands.
 */

type SpaceOf<P extends { __SPACE__: Space }> = P["__SPACE__"];
type CategoryOf<P extends { __CATEGORY__: Category }> = P["__CATEGORY__"];

// prettier-ignore

/**
 * Returns p + d. Both arguments must be in the space coordinate space, with the
 * left hand side being a position and the right hand side being a displacement.
 */
export const addVec2D = <
  Position extends Position2D<Space>,
  Displacement extends Displacement2D<SpaceOf<Position>>,
>(
  position: Position,
  displacement: Displacement,
): Position => {
  return {
    x: position.x + displacement.x,
    y: position.y + displacement.y,
  } as Position;
};

// prettier-ignore

/**
 * Returns lhs - rhs. Both arguments must be positions and must be the same
 * coordinate space.
 */
export const subVec2D = <
  Position extends Position2D<Space>, 
  Displacement extends Displacement2D<SpaceOf<Position>>
>(lhs: Position, rhs: Position): Displacement => {
  return {
    x: lhs.x - rhs.x,
    y: lhs.y - rhs.y,
  } as Displacement;
}

/**
 * Returns multiplier * vector for dimensionless scalar. Works with any
 * category, and returns a vector in the space coordinate space.
 */
export const mulVec2D = <Vec extends Vec2D<Category, Space>>(multiplier: number, vector: Vec): Vec => {
  return {
    x: multiplier * vector.x,
    y: multiplier * vector.y,
  } as Vec;
};

// prettier-ignore

/**
 * Returns displacement / timePeriod, converting a displacement into a velocity.
 *
 * Inverse of convert2DVelocityToDisplacement.
 */
export const divDisplacement2D = <
  Displacement extends Displacement2D<Space>,
  Velocity extends Velocity2D<SpaceOf<Displacement>>,
>(
  timePeriod: number,
  displacement: Displacement,
): Velocity => {
  return {
    x: displacement.x / timePeriod,
    y: displacement.y / timePeriod,
  } as Velocity;
}

/**
 * Returns `timePeriod * velocity`, converting a velocity into a displacement.
 */
export const mulVelocity2D = <
  Velocity extends Velocity2D<Space>,
  Displacement extends Displacement2D<SpaceOf<Velocity>>,
>(
  timePeriod: number,
  velocity: Velocity,
): Displacement => {
  return {
    x: timePeriod * velocity.x,
    y: timePeriod * velocity.y,
  } as Displacement;
};

export const createVec2D = <Vec extends Vec2D<Category, Space>>({ x, y }: { x: number; y: number }): Vec => {
  return { x, y } as Vec;
};
export const createVec3D = <Vec extends Vec3D<Category, Space>>({
  x,
  y,
  z,
}: {
  x: number;
  y: number;
  z: number;
}): Vec => {
  return { x, y, z } as Vec;
};

export const averageVec2D = <Vec extends Vec2D<Category, Space>>(arr: Vec[]): Vec => {
  const result = { x: 0, y: 0 };
  if (arr.length < 1) return result as Vec;

  for (const { x, y } of arr) {
    result.x += x;
    result.y += y;
  }

  result.x /= arr.length;
  result.y /= arr.length;

  return result as Vec;
};

export const interpolatePos2D = <C extends Category, S extends Space, V extends Vec2D<C, S>>({
  t,
  from,
  to,
}: {
  t: number;
  from: V;
  to: V;
}): V => {
  return {
    x: (1 - t) * from.x + t * to.x,
    y: (1 - t) * from.y + t * to.y,
  } as V;
};

export const sqrLengthVec2D = <C extends Category, S extends Space, V extends Vec2D<C, S>>({ x, y }: V): number => {
  return x * x + y * y;
};

export const Rect2D = {
  worldToRegion({ min, max }: { min: WorldPosition2D; max: WorldPosition2D }): {
    min: RegionPosition2D;
    max: RegionPosition2D;
  } {
    const first = Pos2D.worldToRegion2D(min);
    const second = Pos2D.worldToRegion2D(max);

    return {
      min: Vec2D.floor(createVec2D({ x: Math.min(first.x, second.x), y: Math.min(first.y, second.y) })),
      max: Vec2D.ceil(createVec2D({ x: Math.max(first.x, second.x), y: Math.max(first.y, second.y) })),
    };
  },

  regionToWorld({ min, max }: { min: RegionPosition2D; max: RegionPosition2D }): {
    min: WorldPosition2D;
    max: WorldPosition2D;
  } {
    const first = Pos2D.regionToWorld2D(min);
    const second = Pos2D.regionToWorld2D(max);

    return {
      min: Vec2D.floor(createVec2D({ x: Math.min(first.x, second.x), y: Math.min(first.y, second.y) })),
      max: Vec2D.ceil(createVec2D({ x: Math.max(first.x, second.x), y: Math.max(first.y, second.y) })),
    };
  },

  worldToView({ min, max, camera }: { min: WorldPosition2D; max: WorldPosition2D; camera: Transform2D }): {
    min: ViewPosition2D;
    max: ViewPosition2D;
  } {
    const first = convertPos2DWorldToView({ world: min, camera });
    const second = convertPos2DWorldToView({ world: max, camera });

    return {
      min: Vec2D.floor(createVec2D({ x: Math.min(first.x, second.x), y: Math.min(first.y, second.y) })),
      max: Vec2D.ceil(createVec2D({ x: Math.max(first.x, second.x), y: Math.max(first.y, second.y) })),
    };
  },
};

export const Vec2D = {
  /**
   * Returns component-wise lhs === rhs.
   */
  equals<LHS extends Vec2D<Category, Space>, RHS extends Vec2D<CategoryOf<LHS>, SpaceOf<LHS>>>(
    lhs: LHS,
    rhs: RHS,
  ): boolean {
    return lhs.x === rhs.x && lhs.y === rhs.y;
  },

  /**
   * Returns component-wise lhs >= rhs.
   */
  greaterOrEqualThan<LHS extends Vec2D<Category, Space>, RHS extends Vec2D<CategoryOf<LHS>, SpaceOf<LHS>>>(
    lhs: LHS,
    rhs: RHS,
  ): boolean {
    return lhs.x >= rhs.x && lhs.y >= rhs.y;
  },

  /**
   * Returns component-wise lhs <= rhs.
   */
  lessOrEqualThan<LHS extends Vec2D<Category, Space>, RHS extends Vec2D<CategoryOf<LHS>, SpaceOf<LHS>>>(
    lhs: LHS,
    rhs: RHS,
  ): boolean {
    return lhs.x <= rhs.x && lhs.y <= rhs.y;
  },

  floor<Vector extends Vec2D<Category, Space>>({ x, y }: Vector): Vector {
    return {
      x: Math.floor(x),
      y: Math.floor(y),
    } as Vector;
  },

  ceil<Vector extends Vec2D<Category, Space>>({ x, y }: Vector): Vector {
    return {
      x: Math.ceil(x),
      y: Math.ceil(y),
    } as Vector;
  },
};
