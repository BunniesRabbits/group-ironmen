import { z } from "zod/v4";
import { Skills } from "./skill";

export const DiaryTier = ["Easy", "Medium", "Hard", "Elite"] as const;
export type DiaryTier = (typeof DiaryTier)[number];

export const DiaryRegion = [
  "Ardougne",
  "Desert",
  "Falador",
  "Fremennik",
  "Kandarin",
  "Karamja",
  "Kourend & Kebos",
  "Lumbridge & Draynor",
  "Morytania",
  "Varrock",
  "Western Provinces",
  "Wilderness",
] as const;
export type DiaryRegion = (typeof DiaryRegion)[number];

const DiaryEntry = z.object({
  task: z.string(),
  requirements: z
    .object({
      quests: z.string().array().optional(),
      skills: z.partialRecord(z.enum(Skills), z.uint32()).optional(),
    })
    .optional(),
});
export type DiaryEntry = z.infer<typeof DiaryEntry>;

const DiaryTasksByTier = z
  .record(z.enum(DiaryTier), DiaryEntry.array())
  .transform((record) =>
    Object.entries(record).map(([tier, tasks]) => [tier as DiaryTier, tasks] as [DiaryTier, DiaryEntry[]]),
  )
  .transform((entries) => new Map(entries));
type DiaryTasksByTier = z.infer<typeof DiaryTasksByTier>;

const DiaryData = z
  .record(z.enum(DiaryRegion), DiaryTasksByTier)
  .transform((record) =>
    Object.entries(record).map(
      ([region, tasksByTier]) => [region as DiaryRegion, tasksByTier] satisfies [DiaryRegion, DiaryTasksByTier],
    ),
  )
  .transform((entries) => new Map(entries));
export type DiaryData = z.infer<typeof DiaryData>;

export const fetchDiaryDataJSON = (): Promise<DiaryData> =>
  import("/src/assets/diary_data.json")
    .then((data) => {
      return DiaryData.safeParseAsync(data.default);
    })
    .then((parseResult) => {
      if (!parseResult.success) throw new Error("Failed to parse diary_data.json", { cause: parseResult.error });

      return parseResult.data;
    });
