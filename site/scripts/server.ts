import express from "express";
import ViteExpress from "vite-express";
import winston from "winston";
import expressWinston from "express-winston";

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

ViteExpress.config({ mode });
ViteExpress.listen(app, port, () => {
  console.log(`Server is listening on '${port}'...`);
});
