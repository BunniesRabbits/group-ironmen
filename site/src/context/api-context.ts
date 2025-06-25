import { createContext } from "react";

export const APIContext = createContext<{ close?: () => void }>({});
