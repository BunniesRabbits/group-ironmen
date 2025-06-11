import { defineConfig, type PluginOption } from "vite";
import fs from "fs";
import path from "path";
import react from "@vitejs/plugin-react";
import { z } from "zod/v4";

const MapIconsMetadata = z.record(
  z.string(),
  z.record(
    z.string(),
    z.record(
      z.string(),
      z.array(z.int()).refine((coords) => coords.length % 2 === 0),
    ),
  ),
);
type MapIconsMetadata = z.infer<typeof MapIconsMetadata>;
const MapLabelsMetadata = z.record(
  z.string(),
  z.record(
    z.string(),
    z.record(
      z.string(),
      z.array(z.int()).refine((coords) => coords.length % 3 === 0),
    ),
  ),
);
type MapLabelsMetadata = z.infer<typeof MapLabelsMetadata>;

const mapJsonPlugin = (): PluginOption => ({
  name: "mapTilesJson",
  buildStart(): void {
    const mapImageFiles = fs
      .readdirSync("public/map")
      .filter((file) => file.endsWith(".webp"))
      .map((file) => path.basename(file, ".webp"));

    const tiles: number[][] = [[], [], [], []];
    for (const mapImageFile of mapImageFiles) {
      const [plane, x, y] = mapImageFile.split("_").map((x) => parseInt(x, 10));
      tiles[plane].push(((x + y) * (x + y + 1)) / 2 + y);
    }

    const icons = MapIconsMetadata.safeParse(JSON.parse(fs.readFileSync("public/data/map_icons.json", "utf8")));
    const labels = MapLabelsMetadata.safeParse(JSON.parse(fs.readFileSync("public/data/map_labels.json", "utf8")));

    if (!icons.success || !labels.success) {
      console.error("Failed to generate 'maps.json'.");
      console.error(icons.error ?? "Icons good.");
      console.error(labels.error ?? "Labels good.");
      return;
    }

    const result = {
      tiles,
      icons: icons.data,
      labels: labels.data,
    };

    fs.writeFileSync("public/data/map.json", JSON.stringify(result));
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [mapJsonPlugin(), react()],
});
