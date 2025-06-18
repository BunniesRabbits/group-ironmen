import { z } from "zod/v4";

const QuestDifficulty = ["Novice", "Intermediate", "Experienced", "Master", "Grandmaster", "Special"] as const;
export type QuestDifficulty = (typeof QuestDifficulty)[number];

const QuestDataEntry = z.object({
  name: z.string(),
  difficulty: z.enum(QuestDifficulty),
  points: z
    .string()
    .or(z.uint32())
    .transform((id) => {
      if (typeof id === "number") return id;
      return Number.parseInt(id);
    })
    .refine(Number.isInteger)
    .refine((id) => id >= 0),
  member: z.boolean(),
  miniquest: z.boolean().optional(),
});
export type QuestEntry = z.infer<typeof QuestDataEntry>;

/**
 * Import for this: the quest IDs are not in order in quest_data.json.
 * But when sent over the network they seem to be in order, so we have to sort them.
 * TODO: sort quest_data.json in cache scripts?
 */
const QuestData = z
  .record(
    z
      .string()
      .transform((id) => Number.parseInt(id))
      .refine(Number.isInteger)
      .refine((id) => id >= 0),
    QuestDataEntry,
  )
  .transform((record) =>
    Object.entries(record).map(([id, quest]) => [Number.parseInt(id), quest] satisfies [number, QuestEntry]),
  )
  .transform((entries) => entries.sort(([idA], [idB]) => idA - idB))
  .transform((entriesWithNumberAsKey) => new Map(entriesWithNumberAsKey));
export type QuestData = z.infer<typeof QuestData>;

export const fetchQuestDataJSON = (): Promise<QuestData> =>
  import("/src/assets/quest_data.json")
    .then((data) => {
      return QuestData.safeParseAsync(data.default);
    })
    .then((parseResult) => {
      if (!parseResult.success) throw new Error("Failed to parse quest_data.json", { cause: parseResult.error });

      return parseResult.data;
    });
