const { PrismaClient } = require("@prisma/client"); const p = new PrismaClient();
(async () => {
  const cols = await p.$queryRawUnsafe(`select table_name, column_name from information_schema.columns where table_schema='public' and data_type in ('text','character varying','jsonb','json','ARRAY')`);
  for (const c of cols) {
    const r = await p.$queryRawUnsafe(`select count(*)::int n, min(left("${c.column_name}"::text, 0)) x from "${c.table_name}" where "${c.column_name}"::text like '%blob.vercel-storage.com%'`);
    const l = await p.$queryRawUnsafe(`select count(*)::int n from "${c.table_name}" where "${c.column_name}"::text ~ '(^|/)uploads/|^[0-9a-f-]{36}\.(png|jpe?g|webp|pdf)$'`);
    if (r[0].n || l[0].n) console.log(`${c.table_name}.${c.column_name}: blob=${r[0].n} local=${l[0].n}`);
  }
  await p.$disconnect();
})();
