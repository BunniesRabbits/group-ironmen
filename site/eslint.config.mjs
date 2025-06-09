import { defineConfig } from "eslint/config";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  {
    extends: compat.extends("eslint:recommended"),

    languageOptions: {
      globals: {
        ...globals.browser,
      },

      ecmaVersion: 2020,
      sourceType: "module",

      parserOptions: {
        ecmaFeatures: {},
      },
    },

    rules: {
      "padding-line-between-statements": [
        "error",
        {
          blankLine: "always",
          prev: "function",
          next: "function",
        },
        {
          blankLine: "always",
          prev: "*",
          next: "class",
        },
        {
          blankLine: "always",
          prev: "*",
          next: "export",
        },
        {
          blankLine: "always",
          prev: "import",
          next: "function",
        },
        {
          blankLine: "always",
          prev: "import",
          next: "const",
        },
        {
          blankLine: "always",
          prev: "import",
          next: "let",
        },
      ],

      "lines-between-class-members": ["error", "always"],
      "no-unused-vars": "error",

      "no-console": [
        "error",
        {
          allow: ["warn", "error"],
        },
      ],

      "no-empty": "off",
    },
  },
]);
