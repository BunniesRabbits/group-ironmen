import z from "zod/v4";
import type { ItemID } from "../items";
import * as CollectionLog from "../collection-log";

export type Response = z.infer<typeof CollectionLogInfoSchema>;
export const fetchCollectionLogInfo = ({ baseURL }: { baseURL: string }): Promise<Response> =>
  fetch(`${baseURL}/collection-log-info`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("collection-log-info HTTP response was not OK");
      }

      return response.json();
    })
    .then((json) => {
      return CollectionLogInfoSchema.safeParseAsync(json);
    })
    .then((parseResult) => {
      if (!parseResult?.success) {
        throw new Error("collection-log-info response payload was malformed.", { cause: parseResult.error });
      }

      return parseResult.data;
    });

const PageSchema = z
  .object({
    name: z.string().transform((pageName) => pageName as CollectionLog.PageName),
    completion_labels: z.string().array(),
    items: z
      .object({ id: z.uint32().transform((id) => id as ItemID), name: z.string() })
      /* Throw away name since we can look that up in the game data */
      .transform((item) => item.id)
      .array(),
  })
  .transform(({ name, completion_labels, items }) => ({ name, completionLabels: completion_labels, items }));

type Page = z.infer<typeof PageSchema>;

/*
 * NOTE: The collection log has duplicate versions of items on different pages with different
 * items ids for some reason. Not sure how this is counted correctly in the game client, but
 * here they are mapped and subtracted from the totals for the player unlocked counts.
 */
const duplicateCollectionLogItems = new Map([
  // Duplicate mining outfit from volcanic mine and motherlode mine pages
  [29472, 12013], // Prospector helmet
  [29474, 12014], // Prospector jacket
  [29476, 12015], // Prospector legs
  [29478, 12016], // Prospector boots
]);

const TabByID = ["Bosses", "Raids", "Clues", "Minigames", "Other"] as const;
const CollectionLogInfoSchema = z
  .object({
    tabId: z.custom<number>((id) => typeof id === "number" && id >= 0 && id <= TabByID.length),
    pages: PageSchema.array(),
  })
  .array()
  .transform((tabsFlat) => {
    let seenItemIDs = new Set<ItemID>();
    const tabs = tabsFlat.reduce<Map<CollectionLog.TabName, Page[]>>((tabsMap, { tabId, pages }) => {
      tabsMap.set(TabByID[tabId], pages);
      seenItemIDs = seenItemIDs.union(new Set(pages.flatMap((page) => page.items)));
      return tabsMap;
    }, new Map());
    return { uniqueSlots: [...seenItemIDs].filter((itemID) => !duplicateCollectionLogItems.has(itemID)).length, tabs };
  });
