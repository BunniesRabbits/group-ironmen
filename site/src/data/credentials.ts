export interface GroupCredentials {
  name: string;
  token: string;
}

const LOCAL_STORAGE_KEY_GROUP_NAME = "groupName";
const LOCAL_STORAGE_KEY_GROUP_TOKEN = "groupToken";

/**
 * Load the group credentials saved in local storage.
 * @returns The credentials, or undefined if they are nonexistent/invalid.
 */
export const loadValidatedCredentials = (): GroupCredentials | undefined => {
  const name = localStorage.getItem(LOCAL_STORAGE_KEY_GROUP_NAME);
  const token = localStorage.getItem(LOCAL_STORAGE_KEY_GROUP_TOKEN);

  if (!name || name === "") return undefined;
  if (!token || token === "") return undefined;

  return { name, token };
};

/**
 * Delete the group credentials from local storage.
 */
export const wipeCredentials = (): void => {
  localStorage.removeItem(LOCAL_STORAGE_KEY_GROUP_NAME);
  localStorage.removeItem(LOCAL_STORAGE_KEY_GROUP_TOKEN);
};
