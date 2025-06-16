export interface ApiCredentials {
  groupName: string;
  groupToken: string;
}

export const loadValidatedCredentials = (): ApiCredentials | undefined => {
  const name = localStorage.getItem("groupName");
  const token = localStorage.getItem("groupToken");

  if (!name || name === "") return undefined;
  if (!token || token === "") return undefined;

  return { groupName: name, groupToken: token };
};

interface ApiURLArguments {
  baseURL: string;
  groupName: string;
}

function makeAmILoggedInURL(args: ApiURLArguments): string {
  return `${args.baseURL}/group/${args.groupName}/am-i-logged-in`;
}

export default class Api {
  // This is overwritten in docker-entrypoint.sh.
  // The "/api" string is substituted with HOST_PROTOCOL + HOST_URL to construct the deployed URL
  private baseURL = "/api";
  private credentials: ApiCredentials;

  constructor(credentials: ApiCredentials) {
    this.credentials = credentials;
  }

  async fetchAmILoggedIn(): Promise<Response> {
    if (this.credentials === undefined) return Promise.reject(new Error("No active API connection."));

    return fetch(makeAmILoggedInURL({ baseURL: this.baseURL, groupName: this.credentials.groupName }), {
      headers: { Authorization: this.credentials.groupToken },
    });
  }
}
