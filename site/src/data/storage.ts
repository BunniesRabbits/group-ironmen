class Storage {
  storeGroup(groupName: string, groupToken: string): void {
    localStorage.setItem("groupName", groupName);
    localStorage.setItem("groupToken", groupToken);
  }

  getGroup(): { groupName: string | null; groupToken: string | null } {
    return {
      groupName: localStorage.getItem("groupName"),
      groupToken: localStorage.getItem("groupToken"),
    };
  }

  clearGroup(): void {
    localStorage.removeItem("groupName");
    localStorage.removeItem("groupToken");
  }
}

const storage = new Storage();

export { storage };
