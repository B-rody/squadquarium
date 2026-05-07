import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.js",
      "**/*.mjs",
      "bin/**",
      "skins/**",
      "**/skins/**",
      "**/web-dist/**",
      "**/web-legacy/**",
    ],
  },
  tseslint.configs.recommended,
  eslintConfigPrettier,
);
