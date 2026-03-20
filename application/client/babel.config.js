module.exports = {
  presets: [
    ["@babel/preset-typescript"],
    [
      "@babel/preset-env",
      {
        targets: "last 1 Chrome version",
        useBuiltIns: false,
      },
    ],
    [
      "@babel/preset-react",
      {
        development: true,
        runtime: "automatic",
      },
    ],
  ],
};
