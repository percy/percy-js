module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: "module"
  },
  env: {
    es6: true,
    node: true,
    mocha: true
  },
  plugins: ["prettier"],
  extends: ["eslint:recommended", "prettier"],
  rules: {
    "prettier/prettier": [
      "error",
      {
        singleQuote: true,
        trailingComma: "all",
        bracketSpacing: false,
        printWidth: 100
      }
    ]
  }
};
