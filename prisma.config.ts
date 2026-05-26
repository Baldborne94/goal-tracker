import "dotenv/config";
import { defineConfig } from "prisma/config";

// DIRECT_URL = direct Supabase connection (port 5432) — required for schema operations
// DATABASE_URL = PgBouncer pooled connection (port 6543) — used at runtime in db.ts
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
