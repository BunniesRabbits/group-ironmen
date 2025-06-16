import { defineConfig, type PluginOption } from "vite";
import fs from "fs";
import path from "path";
import react from "@vitejs/plugin-react";
import { MapMetadata } from "./src/data/map-data";

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

    const map = MapMetadata.safeParse({
      icons: JSON.parse(fs.readFileSync("public/data/map_icons.json", "utf8")),
      labels: JSON.parse(fs.readFileSync("public/data/map_labels.json", "utf8")),
      tiles: tiles,
    });

    if (!map.success) {
      console.error("Failed to generate 'maps.json'.");
      console.error(map.error);
      return;
    }

    fs.writeFileSync("public/data/map.json", JSON.stringify(map.data));
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [mapJsonPlugin(), react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000", // Backend when using default configuration of docker
        changeOrigin: true,
      },
    },
  },
});
