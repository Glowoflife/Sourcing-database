import nextConfig from "eslint-config-next";

export default [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "storage/**",
      "test-fixtures/**",
      "**/*.config.{js,mjs,ts}",
      "next-env.d.ts",
    ],
  },
  ...nextConfig,
];
