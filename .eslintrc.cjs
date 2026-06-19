module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: ["@herowcode/eslint-config/react", "eslint:recommended"],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  parser: "@typescript-eslint/parser",
  plugins: ["react-refresh"],
  rules: {
    // Disable prettier conflicts
    "prettier/prettier": "off",

    // React refresh warnings only
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],

    // Allow any type (common in this codebase)
    "@typescript-eslint/no-explicit-any": "off",

    // Allow unused variables starting with _
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
    ],

    // Disable strict import rules that cause issues
    "import/no-duplicates": "off",
    "import/first": "off",
    "import-helpers/order-imports": "off",

    // Allow missing dependencies in useEffect (common pattern)
    "react-hooks/exhaustive-deps": "warn",

    // Allow case declarations
    "no-case-declarations": "off",

    // Allow unescaped entities in JSX
    "react/no-unescaped-entities": "off",

    // Allow undefined React (auto-imported)
    "no-undef": "off",

    // Allow unreachable code (sometimes intentional)
    "no-unreachable": "warn",

    // Allow constant conditions (sometimes intentional)
    "no-constant-condition": "warn",
  },
};
