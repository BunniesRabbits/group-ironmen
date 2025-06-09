import child_process from "child_process";
import fs from "fs";
import xml2js from "xml2js";
import glob from "glob";
import util from "util";
import path from "path";
import axios from "axios";
import sharp from "sharp";
import unzipper from "unzipper";
import { z } from "zod/v4";

// NOTE: sharp will keep some files open and prevent them from being deleted
sharp.cache(false);

const xmlParser = new xml2js.Parser();
const xmlBuilder = new xml2js.Builder();

const outputDirectoryPath = "./out";

const runelitePath = `${outputDirectoryPath}/runelite`;
const cacheProjectPath = `${runelitePath}/cache`;
const cachePomPath = `${cacheProjectPath}/pom.xml`;
const cacheJarOutputDir = `${cacheProjectPath}/target`;
const osrsCacheDirectory = `${outputDirectoryPath}/cache/cache`;

const sitePublicPath = "../site/public";

const siteItemDataPath = `${sitePublicPath}/data/item_data.json`;
const siteMapIconMetaPath = `${sitePublicPath}/data/map_icons.json`;
const siteMapLabelMetaPath = `${sitePublicPath}/data/map_labels.json`;
const siteItemImagesPath = `${sitePublicPath}/icons/items`;
const siteMapImagesPath = `${sitePublicPath}/map`;
const siteMapLabelsPath = `${sitePublicPath}/map/labels`;
const siteMapIconPath = `${sitePublicPath}/map/icons/map_icons.webp`;

const tileSize = 256;

function exec(command: string, options?: child_process.ExecSyncOptions): void {
  console.log(command);
  options = options ?? {};
  options.stdio = "inherit";
  try {
    child_process.execSync(command, options);
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
}

async function retry(
  fn: (() => Promise<void>) | (() => void),
  skipLast: boolean
): Promise<void> {
  const attempts = 10;
  for (let i = 0; i < attempts; ++i) {
    try {
      await fn();
      return;
    } catch (ex) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (i === attempts - 1 && skipLast) {
        console.error(ex);
      }
    }
  }

  if (!skipLast) {
    await fn();
  }
}

interface MavenPOM {
  project?: {
    build?: {
      plugins?: {
        plugin: (MavenPlugin | undefined)[];
      }[];
    }[];
  };
}

interface MavenPlugin {
  artifactId?: string[];
  configuration?: { archive?: { manifest: { mainClass: string[] }[] }[] }[];
}

async function setMainClassInCachePom(mainClass: string): Promise<void> {
  console.log(`Setting mainClass of ${cachePomPath} to ${mainClass}`);
  xmlParser.reset();
  const cachePomData = fs.readFileSync(cachePomPath, "utf8");
  const cachePom = (await xmlParser.parseStringPromise(
    cachePomData
  )) as MavenPOM;

  const plugins = cachePom?.project?.build?.at(0)?.plugins?.at(0)?.plugin;
  if (plugins === undefined || !Array.isArray(plugins) || plugins.length == 0) {
    throw Error("Invalid pom.xml");
  }

  const configuration = plugins
    .find(
      (plugin) =>
        plugin?.artifactId !== undefined &&
        plugin.artifactId[0] === "maven-assembly-plugin"
    )
    ?.configuration?.at(0);

  if (
    configuration === undefined ||
    configuration === null ||
    typeof configuration !== "object"
  ) {
    throw Error(
      "Unable to find Maven assembly plugin with valid configuration."
    );
  }

  configuration.archive = [{ manifest: [{ mainClass: [mainClass] }] }];

  const cachePomResult = xmlBuilder.buildObject(cachePom);
  fs.writeFileSync(cachePomPath, cachePomResult);
}

function execRuneliteCache(params: string): void {
  const jars = glob.sync(
    `${cacheJarOutputDir}/cache-*-jar-with-dependencies.jar`
  );
  let cacheJar = jars[0];
  let cacheJarmtime = fs.statSync(cacheJar).mtime;
  for (const jar of jars) {
    const mtime = fs.statSync(jar).mtime;
    if (mtime > cacheJarmtime) {
      cacheJarmtime = mtime;
      cacheJar = jar;
    }
  }

  const cmd = `java -Xmx8g -jar ${cacheJar} ${params}`;
  exec(cmd);
}

const ItemData = z
  .strictObject({
    id: z.int(),
    name: z.string(),
    examine: z.string().optional(),
    resizeX: z.int(),
    resizeY: z.int(),
    resizeZ: z.int(),
    xan2d: z.int(),
    yan2d: z.int(),
    zan2d: z.int(),
    cost: z.int(),
    isTradeable: z.boolean(),
    stackable: z.int(),
    inventoryModel: z.int(),
    wearPos1: z.int(),
    wearPos2: z.int(),
    wearPos3: z.int(),
    members: z.boolean(),
    zoom2d: z.int(),
    xOffset2d: z.int(),
    yOffset2d: z.int(),
    ambient: z.int(),
    contrast: z.int(),
    options: z.array(z.string().nullable()).length(5),
    interfaceOptions: z.array(z.string().nullable()).length(5),
    maleModel0: z.int(),
    maleModel1: z.int(),
    maleModel2: z.int(),
    maleOffset: z.int(),
    maleHeadModel: z.int(),
    maleHeadModel2: z.int(),
    femaleModel0: z.int(),
    femaleModel1: z.int(),
    femaleModel2: z.int(),
    femaleOffset: z.int(),
    femaleHeadModel: z.int(),
    femaleHeadModel2: z.int(),
    category: z.int(),
    notedID: z.int(),
    notedTemplate: z.int(),
    team: z.int(),
    weight: z.int(),
    shiftClickDropIndex: z.int(),
    boughtId: z.int(),
    boughtTemplateId: z.int(),
    placeholderId: z.int(),
    placeholderTemplateId: z.int(),
    params: z.record(z.string(), z.int().or(z.string())).optional(),
    subops: z
      .array(z.array(z.string().nullable()).length(20).nullable())
      .length(5)
      .optional(),
    colorFind: z.array(z.int()).nonempty().optional(),
    colorReplace: z.array(z.int()).nonempty().optional(),
    textureFind: z.array(z.int()).nonempty().optional(),
    textureReplace: z.array(z.int()).nonempty().optional(),
    countCo: z.array(z.int()).nonempty().optional(),
    countObj: z.array(z.int()).nonempty().optional(),
  })
  .refine(
    ({ colorFind, colorReplace }) => colorFind?.length === colorReplace?.length
  )
  .refine(
    ({ textureFind, textureReplace }) =>
      textureFind?.length === textureReplace?.length
  )
  .refine(({ countCo, countObj }) => countCo?.length === countObj?.length);
type ItemData = z.infer<typeof ItemData>;

async function readAllItemFiles(): Promise<Record<number, ItemData>> {
  console.log("\nReading all items from item-data...");
  const itemFiles = glob.sync(`${outputDirectoryPath}/item-data/*.json`);
  const result: Record<number, ItemData> = {};

  const MAX_CONCURRENT_OPEN_FILES = 50;
  const errors: z.ZodSafeParseError<ItemData>[] = [];
  const items: ItemData[] = [];
  for (let i = 0; i < itemFiles.length; i += MAX_CONCURRENT_OPEN_FILES) {
    await Promise.all(
      itemFiles.slice(i, i + 50).map((fileName) =>
        util
          .promisify(fs.readFile)(fileName, "utf8")
          .then((fileContents: string) => {
            return ItemData.safeParseAsync(JSON.parse(fileContents));
          })
          .then((parseResult: z.ZodSafeParseResult<ItemData>) => {
            if (!parseResult.success) {
              errors.push(parseResult);
              return undefined;
            }
            return parseResult.data;
          })
      )
    )
      .then((parsedItems) => {
        items.push(
          ...parsedItems.filter((itemMaybe) => itemMaybe !== undefined)
        );
      })
      .catch((reason) => {
        console.error(
          `Failed to process chunk ${i / MAX_CONCURRENT_OPEN_FILES}:`
        );
        console.error(reason);
      });
  }

  if (errors.length > 0) {
    console.error(`Found invalid items while parsing all item-data/*.json:`);
    console.error(errors);
  }

  items.forEach((item) => {
    if (isNaN(item.id)) {
      console.error("Found item with NaN item ID:");
      console.error(item);
    }
    result[item.id] = item;
  });

  return result;
}

function buildCacheProject(): void {
  exec(`mvn install -Dmaven.test.skip=true -f pom.xml`, {
    cwd: cacheProjectPath,
  });
}

function setupRunelite(): void {
  console.log("\nSetting up runelite...");
  if (!fs.existsSync(runelitePath)) {
    exec(`git clone "https://github.com/runelite/runelite.git"`, {
      cwd: outputDirectoryPath,
    });
  }
  exec(`git fetch origin master`, { cwd: runelitePath });
  exec(`git reset --hard origin/master`, { cwd: runelitePath });
}

async function dumpItemData(): Promise<void> {
  console.log("\nStep: Unpacking item data from cache...");
  await setMainClassInCachePom("net.runelite.cache.Cache");
  buildCacheProject();
  execRuneliteCache(
    `-c ${osrsCacheDirectory} -items ${outputDirectoryPath}/item-data`
  );
}

const GetNonAlchableItemNamesResponse = z.object({
  continue: z
    .object({
      cmcontinue: z.string(),
      continue: z.string(),
    })
    .optional(),
  query: z.object({
    categorymembers: z
      .array(z.object({ pageid: z.int(), ns: z.int(), title: z.string() }))
      .nonempty(),
  }),
});
type GetNonAlchableItemNamesResponse = z.infer<
  typeof GetNonAlchableItemNamesResponse
>;

async function getNonAlchableItemNames(): Promise<Set<string>> {
  console.log("\nFetching non-alchable items from wiki...");
  const nonAlchableItemNames = new Set<string>();
  let cmcontinue: string | undefined = "";
  do {
    // Break inferred type cycle (url -> cmcontinue -> parsed -> url)
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    const url: string = `https://oldschool.runescape.wiki/api.php?cmtitle=Category:Items_that_cannot_be_alchemised&action=query&list=categorymembers&format=json&cmlimit=500&cmcontinue=${cmcontinue}`;
    const parsed = await axios
      .get<unknown>(url, {
        headers: {
          Accept: "application/json",
        },
      })
      .then((response) => {
        return z.safeParse(GetNonAlchableItemNamesResponse, response.data);
      });
    if (!parsed.success) {
      throw Error("Unable to parse non-alchable items from RSWiki", {
        cause: parsed.error,
      });
    }

    parsed.data.query.categorymembers
      .map((member) => member.title)
      .filter(
        (title) => !title.startsWith("File:") && !title.startsWith("Category:")
      )
      .forEach((name) => nonAlchableItemNames.add(name));

    cmcontinue = parsed.data.continue?.cmcontinue ?? undefined;
  } while (cmcontinue !== undefined);

  return nonAlchableItemNames;
}

async function buildItemDataJson(): Promise<Set<number>> {
  console.log("\nBuilding item_data.json...");
  const items = await readAllItemFiles();
  interface IncludedItem {
    name: string;
    highalch: number;
    stacks?: number[][];
  }
  const includedItems: Record<string, IncludedItem> = {};
  const allIncludedItemIds = new Set<number>();

  for (const [itemId, item] of Object.entries(items)) {
    if (item.name && item.name.trim().toLowerCase() !== "null") {
      const includedItem: IncludedItem = {
        name: item.name,
        highalch: Math.floor(item.cost * 0.6),
      };
      const stackedList: number[][] = [];
      if (
        item.countCo &&
        item.countObj &&
        item.countCo.length > 0 &&
        item.countObj.length > 0
      ) {
        for (let i = 0; i < item.countCo.length; ++i) {
          const stackBreakPoint = item.countCo[i];
          const stackedItemId = item.countObj[i];

          if (stackBreakPoint > 0 && stackedItemId === 0) {
            console.log(
              `${itemId}: Item has a stack breakpoint without an associated item id for that stack.`
            );
          } else if (stackBreakPoint > 0 && stackedItemId > 0) {
            allIncludedItemIds.add(stackedItemId);
            stackedList.push([stackBreakPoint, stackedItemId]);
          }
        }

        if (stackedList.length > 0) {
          includedItem.stacks = stackedList;
        }
      }
      allIncludedItemIds.add(item.id);
      includedItems[itemId] = includedItem;
    }
  }

  const nonAlchableItemNames = await getNonAlchableItemNames();

  let itemsMadeNonAlchable = 0;
  for (const item of Object.values(includedItems)) {
    const itemName = item.name;
    if (nonAlchableItemNames.has(itemName)) {
      // NOTE: High alch value = 0 just means unalchable in the context of this program
      item.highalch = 0;
      itemsMadeNonAlchable++;
    }

    // NOTE: The wiki data does not list every variant of an item such as 'Abyssal lantern (yew logs)'
    // which is also not alchable. So this step is to handle that case by searching for the non variant item.
    if (itemName.trim().endsWith(")") && itemName.includes("(")) {
      const nonVariantItemName = itemName
        .substring(0, itemName.indexOf("("))
        .trim();
      if (nonAlchableItemNames.has(nonVariantItemName)) {
        item.highalch = 0;
        itemsMadeNonAlchable++;
      }
    }
  }
  console.log(`${itemsMadeNonAlchable} items were updated to be non-alchable`);
  fs.writeFileSync(
    `${outputDirectoryPath}/item_data.json`,
    JSON.stringify(includedItems),
    "utf8"
  );

  return allIncludedItemIds;
}

async function dumpItemImages(allIncludedItemIds: Set<number>): Promise<void> {
  console.log("\nExtracting item model images...");

  console.log(`Generating images for ${allIncludedItemIds.size} items`);
  fs.writeFileSync(
    `${outputDirectoryPath}/items_need_images.csv`,
    Array.from(allIncludedItemIds.values()).join(",")
  );
  const imageDumperDriver = fs.readFileSync("./Cache.java", "utf8");
  fs.writeFileSync(
    `${cacheProjectPath}/src/main/java/net/runelite/cache/Cache.java`,
    imageDumperDriver
  );
  const itemSpriteFactory = fs.readFileSync("./ItemSpriteFactory.java", "utf8");
  fs.writeFileSync(
    `${cacheProjectPath}/src/main/java/net/runelite/cache/item/ItemSpriteFactory.java`,
    itemSpriteFactory
  );
  buildCacheProject();
  execRuneliteCache(
    `-c ${osrsCacheDirectory} -ids ${outputDirectoryPath}/items_need_images.csv -output ${outputDirectoryPath}/item-images`
  );

  const itemImages = glob.sync(`${outputDirectoryPath}/item-images/*.png`);

  await Promise.all(
    itemImages.map(async (itemImage) => {
      // These variable names are guesses as to what this is doing
      const presharpen = sharp(itemImage).webp({ lossless: true }).toBuffer();
      const unlink = presharpen.then(() =>
        util.promisify(fs.unlink)(itemImage)
      );
      return Promise.all([presharpen, unlink]).then(([itemImageBuffer, _]) =>
        sharp(itemImageBuffer)
          .webp({ lossless: true, effort: 6 })
          .toFile(itemImage.replace(".png", ".webp"))
      );
    })
  );
}

const XTEASRegion = z.object({
  archive: z.int(),
  group: z.int(),
  name_hash: z.int(),
  name: z.string(),
  mapsquare: z.int(),
  key: z.array(z.int()).length(4),
});
type XTEASRegion = z.infer<typeof XTEASRegion>;

const XTEAS = z.array(XTEASRegion);
type XTEAS = z.infer<typeof XTEAS>;

function convertXteasToRuneliteFormat(): string {
  console.log("\nConverting xteas.json to Runelite json format...");
  const xteas = XTEAS.safeParse(
    JSON.parse(fs.readFileSync(`${osrsCacheDirectory}/../xteas.json`, "utf8"))
  );
  if (!xteas.success) {
    throw new Error("Failed to parse xteas.json");
  }

  const location = `${osrsCacheDirectory}/../xteas-runelite.json`;
  const result = xteas.data.map((region: XTEASRegion) => ({
    region: region.mapsquare,
    keys: region.key,
  }));

  fs.writeFileSync(location, JSON.stringify(result));

  return location;
}

async function dumpMapData(xteasLocation: string): Promise<void> {
  console.log("\nDumping map data...");
  const mapImageDumper = fs.readFileSync("./MapImageDumper.java", "utf8");
  fs.writeFileSync(
    `${cacheProjectPath}/src/main/java/net/runelite/cache/MapImageDumper.java`,
    mapImageDumper
  );
  await setMainClassInCachePom("net.runelite.cache.MapImageDumper");
  buildCacheProject();
  execRuneliteCache(
    `--cachedir ${osrsCacheDirectory} --xteapath ${xteasLocation} --outputdir ${outputDirectoryPath}/map-data`
  );
}

async function dumpMapLabels(): Promise<void> {
  console.log("\nDumping map labels...");
  const mapLabelDumper = fs.readFileSync("./MapLabelDumper.java", "utf8");
  fs.writeFileSync(
    `${cacheProjectPath}/src/main/java/net/runelite/cache/MapLabelDumper.java`,
    mapLabelDumper
  );
  await setMainClassInCachePom("net.runelite.cache.MapLabelDumper");
  buildCacheProject();
  execRuneliteCache(
    `--cachedir ${osrsCacheDirectory} --outputdir ${outputDirectoryPath}/map-data/labels`
  );

  const mapLabels = glob.sync(`${outputDirectoryPath}/map-data/labels/*.png`);

  await Promise.all(
    mapLabels.map(async (mapLabel) => {
      // These variable names are guesses as to what this is doing
      const presharpen = sharp(mapLabel).webp({ lossless: true }).toBuffer();
      const unlink = presharpen.then(() => util.promisify(fs.unlink)(mapLabel));
      return Promise.all([presharpen, unlink]).then(
        ([mapLabelImageBuffer, _]) =>
          sharp(mapLabelImageBuffer)
            .webp({ lossless: true, effort: 6 })
            .toFile(mapLabel.replace(".png", ".webp"))
      );
    })
  );
}

async function dumpCollectionLog(): Promise<void> {
  console.log("\nDumping collection log...");
  const collectionLogDumper = fs.readFileSync(
    "./CollectionLogDumper.java",
    "utf8"
  );
  fs.writeFileSync(
    `${cacheProjectPath}/src/main/java/net/runelite/cache/CollectionLogDumper.java`,
    collectionLogDumper
  );
  await setMainClassInCachePom("net.runelite.cache.CollectionLogDumper");
  buildCacheProject();
  execRuneliteCache(`--cachedir ${osrsCacheDirectory} --outputdir ../server`);
}

async function tilePlane(plane: number): Promise<void> {
  await retry(
    () =>
      fs.rmSync(`${outputDirectoryPath}/output_files`, {
        recursive: true,
        force: true,
      }),
    false
  );
  const planeImage = sharp(`${outputDirectoryPath}/map-data/img-${plane}.png`, {
    limitInputPixels: false,
  }).flip();
  await planeImage
    .webp({ lossless: true })
    .tile({
      size: tileSize,
      depth: "one",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      skipBlanks: 0,
    })
    .toFile(`${outputDirectoryPath}/output.dz`);
}

function outputTileImage(
  sharpInstance: sharp.Sharp,
  plane: number,
  x: string,
  y: string
): Promise<sharp.OutputInfo> {
  return sharpInstance
    .flatten({ background: "#000000" })
    .webp({ lossless: true, alphaQuality: 0, effort: 6 })
    .toFile(`${outputDirectoryPath}/map-data/tiles/${plane}_${x}_${y}.webp`);
}

async function finalizePlaneTiles(
  plane: number,
  previousTiles: Set<string>
): Promise<void> {
  const tileImages = glob.sync(`${outputDirectoryPath}/output_files/0/*.webp`);

  for (const tileImage of tileImages) {
    const filename = path.basename(tileImage, ".webp");
    const [x, y] = filename.split("_").map((coord) => parseInt(coord, 10));

    // TODO: figure out what these are
    const MAGIC_X = 4608;
    const MAGIC_Y = 4864;
    const finalX = x + MAGIC_X / tileSize;
    const finalY = y + MAGIC_Y / tileSize;

    let s;
    if (plane > 0) {
      const backgroundPath = `${outputDirectoryPath}/map-data/tiles/${
        plane - 1
      }_${finalX}_${finalY}.webp`;
      const backgroundExists = fs.existsSync(backgroundPath);

      const DARKEN_FACTOR = 0.5;

      if (backgroundExists) {
        const tile = await sharp(tileImage)
          .flip()
          .webp({ lossless: true })
          .toBuffer();
        const background = await sharp(backgroundPath)
          .linear(DARKEN_FACTOR)
          .webp({ lossless: true })
          .toBuffer();
        s = sharp(background).composite([{ input: tile }]);
      }
    }

    s ??= sharp(tileImage).flip();

    previousTiles.add(`${plane}_${finalX}_${finalY}`);
    await outputTileImage(s, plane, finalX.toString(), finalY.toString());
  }

  // NOTE: This is just so the plane will have a darker version of the tile below it
  // even if the plane does not have its own image for a tile.
  if (plane > 0) {
    const belowTiles = [...previousTiles].filter((tile) =>
      tile.startsWith(`${plane - 1}_`)
    );
    for (const belowTile of belowTiles) {
      const [_belowPlane, x, y] = belowTile.split("_");
      const lookup = `${plane}_${x}_${y}`;
      if (!previousTiles.has(lookup)) {
        const outputPath = `${outputDirectoryPath}/map-data/tiles/${plane}_${x}_${y}.webp`;
        if (fs.existsSync(outputPath) === true) {
          throw new Error(`Filling tile ${outputPath} but it already exists!`);
        }

        const s = sharp(
          `${outputDirectoryPath}/map-data/tiles/${belowTile}.webp`
        ).linear(0.5);
        previousTiles.add(lookup);
        await outputTileImage(s, plane, x, y);
      }
    }
  }
}

async function generateMapTiles(): Promise<void> {
  console.log("\nGenerating map tiles...");
  fs.rmSync(`${outputDirectoryPath}/map-data/tiles`, {
    recursive: true,
    force: true,
  });
  fs.mkdirSync(`${outputDirectoryPath}/map-data/tiles`);

  const previousTiles = new Set<string>();
  const planes = 4;
  for (let i = 0; i < planes; ++i) {
    console.log(`Tiling map plane ${i + 1}/${planes}`);
    await tilePlane(i);
    console.log(`Finalizing map plane ${i + 1}/${planes}`);
    await finalizePlaneTiles(i, previousTiles);
  }
}

async function moveFiles(
  globSource: string,
  destination: string
): Promise<void> {
  return Promise.all(
    glob
      .sync(globSource)
      .map((file) => {
        try {
          const parsed = path.parse(file);
          return parsed;
        } catch {
          return undefined;
        }
      })
      .filter((parsed) => parsed != undefined)
      .map((parsed) =>
        retry(
          () =>
            fs.renameSync(path.format(parsed), `${destination}/${parsed.base}`),
          true
        )
      )
  ).then();
}

const MapIconsMetadata = z.record(z.string(), z.array(z.int()));
type MapIconsMetadata = z.infer<typeof MapIconsMetadata>;
const MapLabelsMetadata = z.array(z.array(z.int()).length(3));
type MapLabelsMetadata = z.infer<typeof MapLabelsMetadata>;

async function moveResults(): Promise<void> {
  console.log("\nMoving results to site...");
  await retry(
    () =>
      fs.copyFileSync(
        `${outputDirectoryPath}/item_data.json`,
        siteItemDataPath
      ),
    true
  );

  await moveFiles(
    `${outputDirectoryPath}/item-images/*.webp`,
    siteItemImagesPath
  );
  await moveFiles(
    `${outputDirectoryPath}/map-data/tiles/*.webp`,
    siteMapImagesPath
  );
  await moveFiles(
    `${outputDirectoryPath}/map-data/labels/*.webp`,
    siteMapLabelsPath
  );

  // Create a tile sheet of the map icons
  const mapIcons = glob.sync(`${outputDirectoryPath}/map-data/icons/*.png`);
  const mapIconsCompositeOpts = [];
  const iconIdToSpriteMapIndex: Record<string, number> = {};
  for (let i = 0; i < mapIcons.length; ++i) {
    mapIconsCompositeOpts.push({
      input: mapIcons[i],
      left: 15 * i,
      top: 0,
    });

    iconIdToSpriteMapIndex[path.basename(mapIcons[i], ".png")] = i;
  }
  await sharp({
    create: {
      width: 15 * mapIcons.length,
      height: 15,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(mapIconsCompositeOpts)
    .webp({ lossless: true, effort: 6 })
    .toFile(siteMapIconPath);

  // Convert the output of the map-icons locations to be keyed by the X an Y of the regions
  // that they are in. This is done so that the canvas map component can quickly lookup
  // all of the icons in each of the regions that are being shown.
  const mapIconsMeta = MapIconsMetadata.safeParse(
    JSON.parse(
      fs.readFileSync(
        `${outputDirectoryPath}/map-data/icons/map-icons.json`,
        "utf8"
      )
    )
  );
  if (!mapIconsMeta.success) {
    throw new Error("Failed to parse map-icons.json", {
      cause: mapIconsMeta.error,
    });
  }

  const locationByRegion: Record<
    number,
    Record<number, Record<number, number[] | undefined> | undefined> | undefined
  > = {};

  Object.entries(mapIconsMeta.data).forEach(([iconId, coordinatePairs]) => {
    for (let i = 0; i < coordinatePairs.length; i += 2) {
      const x = coordinatePairs[i] + 128;
      const y = coordinatePairs[i + 1] + 1;

      const regionX = Math.floor(x / 64);
      const regionY = Math.floor(y / 64);

      const spriteMapIndex = iconIdToSpriteMapIndex[iconId];
      if (spriteMapIndex === undefined) {
        throw new Error(
          "Could not find sprite map index for map icon: " + iconId
        );
      }

      locationByRegion[regionX] = locationByRegion[regionX] ?? {};
      locationByRegion[regionX][regionY] =
        locationByRegion[regionX][regionY] ?? {};
      locationByRegion[regionX][regionY][spriteMapIndex] =
        locationByRegion[regionX][regionY][spriteMapIndex] ?? [];

      locationByRegion[regionX][regionY][spriteMapIndex].push(x, y);
    }
  });

  fs.writeFileSync(siteMapIconMetaPath, JSON.stringify(locationByRegion));

  // Do the same for map labels
  const mapLabelsMeta = MapLabelsMetadata.safeParse(
    JSON.parse(
      fs.readFileSync(
        `${outputDirectoryPath}/map-data/labels/map-labels.json`,
        "utf8"
      )
    )
  );
  if (!mapLabelsMeta.success) {
    throw new Error("Failed to parse map-labels.json", {
      cause: mapLabelsMeta.error,
    });
  }

  const labelByRegion: Record<
    number,
    Record<number, Record<number, number[]> | undefined> | undefined
  > = {};

  mapLabelsMeta.data.forEach((xyz, index) => {
    const x = xyz[0] + 128;
    const y = xyz[1] + 1;
    const z = xyz[2];

    const regionX = Math.floor(x / 64);
    const regionY = Math.floor(y / 64);

    labelByRegion[regionX] = labelByRegion[regionX] ?? {};
    labelByRegion[regionX][regionY] = labelByRegion[regionX][regionY] ?? {};
    labelByRegion[regionX][regionY][z] =
      labelByRegion[regionX][regionY][z] ?? [];

    labelByRegion[regionX][regionY][z].push(x, y, index);
  });

  fs.writeFileSync(siteMapLabelMetaPath, JSON.stringify(labelByRegion));
}

// https://archive.openrs2.org/api
// Subset of fields we use.
// Timestamp is theoretically null
const OSRSCache = z.object({
  id: z.number(),
  scope: z.string(),
  game: z.string(),
  environment: z.enum(["live", "beta"]),
  timestamp: z.iso.datetime(),
});

type OSRSCache = z.infer<typeof OSRSCache>;

async function getLatestGameCache(): Promise<void> {
  if (!fs.existsSync(`${outputDirectoryPath}/cache`)) {
    fs.mkdirSync(`${outputDirectoryPath}/cache`, { recursive: true });
  }

  console.log("\nDownloading caches from openrs2...\n");
  const caches = (
    await axios.get<unknown[]>("https://archive.openrs2.org/caches.json")
  ).data;
  if (!Array.isArray(caches) || caches.length == 0) {
    throw new Error("Got bad response from openrs2");
  }

  console.log("\nDownloaded caches. Finding most recent one...");
  const latestOSRSCache = caches
    .reduce<OSRSCache[]>(
      (previousValue: OSRSCache[], currentValue: unknown) => {
        const parsed = z.safeParse(OSRSCache, currentValue);
        if (parsed.success) {
          previousValue.push(parsed.data);
        }
        return previousValue;
      },
      []
    )
    .filter((cache: OSRSCache) => {
      return (
        cache.scope === "runescape" &&
        cache.game === "oldschool" &&
        cache.environment === "live"
      );
    })
    .sort((a: OSRSCache, b: OSRSCache) => {
      const second = new Date(b.timestamp);
      const first = new Date(a.timestamp);
      return second > first ? 1 : -1;
    })
    .at(0);

  if (latestOSRSCache === undefined) {
    throw new Error("No suitable cache exists.");
  }

  console.log("Downloading this cache:");
  console.log(latestOSRSCache);

  console.log("Getting disk.zip...");
  const cacheFilesResponse = await axios.get<Buffer>(
    `https://archive.openrs2.org/caches/${latestOSRSCache.scope}/${latestOSRSCache.id}/disk.zip`,
    {
      responseType: "arraybuffer",
    }
  );
  const cacheFiles = await unzipper.Open.buffer(cacheFilesResponse.data);
  await cacheFiles.extract({ path: `${outputDirectoryPath}/cache` });

  console.log("Getting keys.json...");
  const xteas = (
    await axios.get<unknown>(
      `https://archive.openrs2.org/caches/${latestOSRSCache.scope}/${latestOSRSCache.id}/keys.json`
    )
  ).data;
  fs.writeFileSync(
    `${outputDirectoryPath}/cache/xteas.json`,
    JSON.stringify(xteas)
  );
  console.log("Done downloading caches.");
}

((): void => {
  Promise.resolve()
    .then(() => {
      console.log(`Delete out directory '${outputDirectoryPath}'...`);
      fs.rmSync(outputDirectoryPath, {
        recursive: true,
        force: true,
      });
      console.log(`Deleted.`);
    })
    .then(() => getLatestGameCache())
    .then(() => setupRunelite())
    .then(() => dumpItemData())
    .then(() => buildItemDataJson())
    .then((allIncludedItemIds) => dumpItemImages(allIncludedItemIds))
    .then(() => convertXteasToRuneliteFormat())
    .then((xteasLocation) => dumpMapData(xteasLocation))
    .then(() => generateMapTiles())
    .then(() => dumpMapLabels())
    .then(() => dumpCollectionLog())
    .then(() => moveResults())
    .catch((reason) => {
      throw reason;
    });
})();
