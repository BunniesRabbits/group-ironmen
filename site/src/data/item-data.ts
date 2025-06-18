import { z } from "zod/v4";
import type { ItemID } from "./api";

const ItemDataEntry = z.object({
  name: z.string(),
  highalch: z.uint32(),
  stacks: z
    .array(z.tuple([z.uint32(), z.uint32()]))
    .min(1)
    .optional(),
});
export type ItemDataEntry = z.infer<typeof ItemDataEntry>;

const ItemData = z
  .record(
    z
      .string()
      .transform((id) => Number.parseInt(id))
      .refine(Number.isInteger)
      .refine((id) => id >= 0),
    ItemDataEntry,
  )
  .transform((itemData) => {
    const result = new Map<ItemID, ItemDataEntry>();
    for (const [itemIDString, itemDataEntry] of Object.entries(itemData)) {
      result.set(parseInt(itemIDString) as ItemID, itemDataEntry);
    }
    return result;
  });
export type ItemData = z.infer<typeof ItemData>;

export const fetchItemDataJSON = (): Promise<ItemData> =>
  import("/src/assets/item_data.json")
    .then((data) => {
      return ItemData.safeParseAsync(data.default);
    })
    .then((parseResult) => {
      if (!parseResult.success) throw new Error("Failed to parse item_data.json", { cause: parseResult.error });

      return parseResult.data;
    });
