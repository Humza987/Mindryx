import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Allow 'any' for now
      "@typescript-eslint/no-explicit-any": "off",

      // Warn instead of error for unused variables
      "@typescript-eslint/no-unused-vars": "warn",

      // Allow unescaped apostrophes in JSX
      "react/no-unescaped-entities": "off",

      // Prefer const but don’t break build
      "prefer-const": "warn",
    },
  },
];

export default eslintConfig;
