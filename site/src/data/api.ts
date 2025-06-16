import { z } from "zod/v4";

export interface ApiCredentials {
  groupName: string;
  groupToken: string;
}

const LOCAL_STORAGE_KEY_GROUP_NAME = "groupName";
const LOCAL_STORAGE_KEY_GROUP_TOKEN = "groupToken";

export const loadValidatedCredentials = (): ApiCredentials | undefined => {
  const name = localStorage.getItem(LOCAL_STORAGE_KEY_GROUP_NAME);
  const token = localStorage.getItem(LOCAL_STORAGE_KEY_GROUP_TOKEN);

  if (!name || name === "") return undefined;
  if (!token || token === "") return undefined;

  return { groupName: name, groupToken: token };
};
export const wipeCredentials = (): void => {
  localStorage.removeItem(LOCAL_STORAGE_KEY_GROUP_NAME);
  localStorage.removeItem(LOCAL_STORAGE_KEY_GROUP_TOKEN);
};

interface ApiURLArguments {
  baseURL: string;
  groupName: string;
}

function makeAmILoggedInURL(args: ApiURLArguments): string {
  return `${args.baseURL}/group/${args.groupName}/am-i-logged-in`;
}
function makeGetGroupDataURL(args: ApiURLArguments, fromTime: Date): string {
  return `${args.baseURL}/group/${args.groupName}/get-group-data?from_time=${fromTime.toISOString()}`;
}

const GetGroupDataResponseJSON = z.array(z.object({ name: z.string(), last_updated: z.iso.datetime() }));
type GetGroupDataResponseJSON = z.infer<typeof GetGroupDataResponseJSON>;

export default class Api {
  // This is overwritten in docker-entrypoint.sh.
  // The "/api" string is substituted with HOST_PROTOCOL + HOST_URL to construct the deployed URL
  private baseURL = "/api";
  private credentials: ApiCredentials;
  private getGroupDataLastCheck?: Date;
  private getGroupDataPromise?: Promise<void>;
  private closed;

  queueGetGroupData(): void {
    if (this.getGroupDataPromise !== undefined) return;

    this.getGroupDataPromise = fetch(
      makeGetGroupDataURL(
        { baseURL: this.baseURL, groupName: this.credentials.groupName },
        this.getGroupDataLastCheck ?? new Date(0),
      ),
      {
        headers: { Authorization: this.credentials.groupToken },
      },
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error("GetGroupData response was not OK");
        }

        return response.json();
      })
      .then((json) => {
        return GetGroupDataResponseJSON.safeParseAsync(json);
      })
      .then((parseResult) => {
        if (!parseResult?.success) {
          throw new Error("GetGroupData response was malformed.", { cause: parseResult.error });
        }
      })
      .then(() => {
        if (this.closed) return;

        window.setTimeout(() => {
          this.getGroupDataPromise = undefined;
          this.queueGetGroupData();
        }, 1000);
      });
  }

  close(): void {
    this.closed = true;
  }
  constructor(credentials: ApiCredentials) {
    this.credentials = credentials;
    this.closed = false;
  }

  async fetchAmILoggedIn(): Promise<Response> {
    if (this.credentials === undefined) return Promise.reject(new Error("No active API connection."));

    return fetch(makeAmILoggedInURL({ baseURL: this.baseURL, groupName: this.credentials.groupName }), {
      headers: { Authorization: this.credentials.groupToken },
    });
  }
}
