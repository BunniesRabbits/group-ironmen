import express from "express";
import ViteExpress from "vite-express";
import winston from "winston";
import expressWinston from "express-winston";
import pc from "picocolors";

const app = express();

app.use(
  expressWinston.logger({
    transports: [new winston.transports.Console()],
    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    meta: false,
    msg: "HTTP {{req.method}} {{req.url}} {{res.statusCode}}",
    expressFormat: false,
    colorize: true,
    metaField: null,
  }),
);

const productionMode = process.argv.some((arg) => arg === "--prod");
const mode: "production" | "development" = productionMode ? "production" : "development";

const port = 4000;

const timestamp = new Date().toLocaleString("en-US").split(",")[1].trim();
console.log(
  `${pc.dim(timestamp)} ${pc.bold(pc.blue("[server.ts]"))} Attempting to run vite-express on port ${port}...`,
);

ViteExpress.config({ mode });
ViteExpress.listen(app, port)
  .on("error", (err: { code: string }) => {
    const msg = `Failed to listen: ${err.code ?? "Unknown Reason"}`;
    const timestamp = new Date().toLocaleString("en-US").split(",")[1].trim();
    console.log(`${pc.dim(timestamp)} ${pc.bold(pc.blue("[server.ts]"))} ${pc.red(msg)}`);
  })
  .on("listening", () => {
    const timestamp = new Date().toLocaleString("en-US").split(",")[1].trim();
    console.log(`${pc.dim(timestamp)} ${pc.bold(pc.blue("[server.ts]"))} Success! Listening on port ${port}...`);
  });
