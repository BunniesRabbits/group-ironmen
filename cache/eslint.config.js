import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config({
  name: "Typescript",
  extends: [
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
  ],
  files: ["update.ts"],
  languageOptions: {
    ecmaVersion: 2022,
    globals: globals.node,
    parserOptions: {
      project: ["./tsconfig.json"],
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    // Not ready yet, too much to fix first
    // "no-magic-numbers": ["warn", { ignore: [0, 1, -1] }],
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        // Ignore just one underscore
        // https://stackoverflow.com/a/78734642
        argsIgnorePattern: "^_[^_].*$|^_$",
        varsIgnorePattern: "^_[^_].*$|^_$",
        caughtErrorsIgnorePattern: "^_[^_].*$|^_$",
      },
    ],
  },
});
