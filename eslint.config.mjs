import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // ──────────────────────────────────────────────────────────────────────────
  // Plugin module boundary
  //
  // Code under src/plugins/** is plugin code. It must reach PPMS Core only
  // through the Plugin Gateway, which performs session, permission, plugin
  // enabled, license and tenant checks before any data is returned.
  //
  // Direct Prisma access, direct auth/rbac/audit access, and deep imports into
  // framework internals all bypass those checks and are therefore forbidden.
  // ──────────────────────────────────────────────────────────────────────────
  {
    files: ["src/plugins/**/*.ts", "src/plugins/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message:
                "Plugins must not access the database directly. Use @/plugin-framework/gateway instead.",
            },
            {
              name: "@prisma/client",
              message:
                "Plugins must not import Prisma. Use @/plugin-framework/gateway instead.",
            },
            {
              name: "@/auth",
              message:
                "Plugins must not read the session directly. Use authorizeGatewayRequest() from @/plugin-framework/gateway.",
            },
            {
              name: "@/lib/rbac",
              message:
                "Plugins must not perform their own RBAC. Use @/plugin-framework/gateway, which reuses PPMS RBAC.",
            },
            {
              name: "@/lib/audit",
              message:
                "Plugins must not write audit rows directly. Use writePluginAudit() from @/plugin-framework/gateway.",
            },
            {
              name: "@/lib/license-guard",
              message:
                "Plugins must not read the PPMS core license. Use checkPluginLicense() from @/plugin-framework/gateway.",
            },
            {
              name: "@/plugin-framework/manager",
              message:
                "Deep framework imports bypass the gateway. Import from @/plugin-framework/gateway instead.",
            },
            {
              name: "@/plugin-framework/config",
              message:
                "Deep framework imports bypass the gateway. Import from @/plugin-framework/gateway instead.",
            },
            {
              name: "@/plugin-framework/license",
              message:
                "Deep framework imports bypass the gateway. Import from @/plugin-framework/gateway instead.",
            },
            {
              name: "@/plugin-framework/permissions",
              message:
                "Deep framework imports bypass the gateway. Import from @/plugin-framework/gateway instead.",
            },
          ],
          patterns: [
            {
              group: [
                "**/lib/prisma",
                "**/lib/audit",
                "**/lib/rbac",
                "**/lib/license-guard",
                "**/../auth",
              ],
              message:
                "Plugins must not reach PPMS Core internals by relative path. Use @/plugin-framework/gateway.",
            },
            {
              group: ["@/plugin-framework/gateway/*"],
              message:
                "Import the gateway barrel (@/plugin-framework/gateway), not its internal modules.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
