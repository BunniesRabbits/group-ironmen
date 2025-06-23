import z from "zod/v4";
import type { ItemID } from "../items";
import type { GroupCredentials } from "../credentials";
import * as Member from "../member";
import * as CollectionLog from "../collection-log";

export type Response = z.infer<typeof CollectionLogSchema>;
export const fetchGroupCollectionLogs = ({
  baseURL,
  credentials,
}: {
  baseURL: string;
  credentials: GroupCredentials;
}): Promise<Response> =>
  fetch(`${baseURL}/group/${credentials.name}/collection-log`, {
    headers: { Authorization: credentials.token },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("collection-log HTTP response was not OK");
      }

      return response.json();
    })
    .then((json) => {
      return CollectionLogSchema.safeParseAsync(json);
    })
    .then((parseResult) => {
      if (!parseResult?.success) {
        throw new Error("collection-log response payload was malformed.", { cause: parseResult.error });
      }

      return parseResult.data;
    });

const CollectionLogSchema = z.record(
  z.string().transform((name) => name as Member.Name),
  z
    .object({
      page_name: z.string().transform((page) => page as CollectionLog.PageName),
      completion_counts: z.uint32().array(),
      items: z
        .uint32()
        .array()
        .refine((arg) => arg.length % 2 === 0)
        .transform((arg: number[]) =>
          arg.reduce<Map<ItemID, number>>((items, _, index, flatItems) => {
            if (index % 2 !== 0 || index + 1 >= flatItems.length) return items;

            const itemID = flatItems[index] as ItemID;
            const itemQuantity = flatItems[index + 1];

            items.set(itemID, itemQuantity + (items.get(itemID) ?? 0));

            return items;
          }, new Map<ItemID, number>()),
        ),
      new_items: z
        .uint32()
        .array()
        .transform((items) => items as ItemID[]),
    })
    .array()
    .transform((pagesFlat) =>
      pagesFlat.reduce<Map<CollectionLog.PageName, { items: Map<ItemID, number>; completions: number[] }>>(
        (pages, page) => {
          page.new_items.forEach((itemID) => page.items.set(itemID, 1));
          pages.set(page.page_name, { completions: page.completion_counts, items: page.items });
          return pages;
        },
        new Map(),
      ),
    ),
);
