'use strict';

const { pool, query, describeTarget } = require('../src/db/pool');
const { parseArgs } = require('./lib/prompt');

/**
 * Creates a project and its sites.
 *
 * A fresh deployment has empty tables, and a supervisor cannot file a report
 * until there is a site to file it against. This is the setup step.
 *
 *   npm run create-project -- --code TIH-001 --name "Bompai Road Facility Upgrade" \
 *     --client Internal --site "Main Site" --site "Workshop Yard"
 *
 * Running it again with the same --code adds any new sites without
 * duplicating the project.
 */
async function main() {
  console.log(`\nDatabase: ${describeTarget()}`);

  const args = parseArgs(process.argv.slice(2));
  const missing = ['code', 'name'].filter((k) => !args[k]);

  if (missing.length) {
    console.error(`Missing required option(s): ${missing.map((m) => `--${m}`).join(', ')}\n`);
    console.error('Example:');
    console.error('  npm run create-project -- --code TIH-001 \\');
    console.error('    --name "Bompai Road Facility Upgrade" \\');
    console.error('    --site "Main Site" --site "Workshop Yard"');
    process.exitCode = 1;
    return;
  }

  // --site is repeatable and parseArgs collects repeats into args.site,
  // joining each one's words so quotes are optional.
  const siteNames = (args.site || []).map(String).filter((s) => s.trim() !== '');

  const { rows } = await query(
    `INSERT INTO projects (code, name, client, start_date, status)
     VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), 'active')
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, code, name`,
    [args.code, args.name, args.client ?? null, args.start ?? null]
  );

  const project = rows[0];
  console.log(`\nProject ${project.code}: ${project.name}`);

  if (siteNames.length === 0) {
    console.log('\nNo sites given. Add them with --site "Name" (repeatable).');
    return;
  }

  for (const name of siteNames) {
    const site = await query(
      `INSERT INTO sites (project_id, name, location)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name`,
      [project.id, name, args.location ?? null]
    );
    const s = site.rows[0];
    console.log(`  site ${s.id}: ${s.name}`);
  }

  console.log('\nAssign a supervisor to a site with:');
  console.log('  npm run create-user -- --name "Name" --email them@example.com \\');
  console.log('    --role site_supervisor --site <id>');
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
