import { createContext } from "react";
import * as RequestSkillData from "../api/requests/skill-data";

interface APIContext {
  /**
   * Forcefully close the API, ending intervals and clearing member data. Does
   * not void any tokens and credentials, nor interact with cookies and local storage.
   */
  close?: () => void;

  /**
   * For a given aggregate period, fetch the skill data for the group whose
   * credentials are loaded by the API.
   */
  fetchSkillData?: (period: RequestSkillData.AggregatePeriod) => Promise<RequestSkillData.Response>;
}
export const APIContext = createContext<APIContext>({});
