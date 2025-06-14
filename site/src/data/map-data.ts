import { z } from "zod/v4";

export const MapIconsMetadata = z.record(
  z.string(),
  z.record(
    z.string(),
    z.record(
      z.string(),
      z.array(z.int()).refine((coords) => coords.length % 2 === 0),
    ),
  ),
);
export type MapIconsMetadata = z.infer<typeof MapIconsMetadata>;

export const MapLabelsMetadata = z.record(
  z.string(),
  z.record(
    z.string(),
    z.record(
      z.string(),
      z.array(z.int()).refine((coords) => coords.length % 3 === 0),
    ),
  ),
);
export type MapLabelsMetadata = z.infer<typeof MapLabelsMetadata>;

export const MapTilesMetadata = z.array(z.array(z.int())).length(4);
export type MapTilesMetadata = z.infer<typeof MapTilesMetadata>;

export const MapMetadata = z.object({
  icons: MapIconsMetadata,
  labels: MapLabelsMetadata,
  tiles: MapTilesMetadata,
});
export type MapMetadata = z.infer<typeof MapMetadata>;
