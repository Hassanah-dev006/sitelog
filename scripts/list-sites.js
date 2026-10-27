'use strict';

const { pool, query, describeTarget } = require('../src/db/pool');

/**
 * Prints the site ids, which you need when assigning a supervisor with
 * `npm run create-user -- --site <id>`.
 */
async function main() {
  console.log(`\nDatabase: ${describeTarget()}`);
  const { rows } = await query(
    `SELECT s.id, s.name, p.name AS project_name, p.status,
            (SELECT COUNT(*) FROM site_assignments a WHERE a.site_id = s.id) AS supervisors
     FROM sites s
     JOIN projects p ON p.id = s.project_id
     ORDER BY p.name, s.name`
  );

  if (rows.length === 0) {
    console.log('No sites yet. Run `npm run seed`, or create a project through the API.');
    return;
  }

  console.log('\n  ID   Site                      Project                        Supervisors');
  console.log('  ---  ------------------------  -----------------------------  -----------');

  for (const r of rows) {
    console.log(
      `  ${String(r.id).padEnd(3)}  ${String(r.name).padEnd(24).slice(0, 24)}  ` +
      `${String(r.project_name).padEnd(29).slice(0, 29)}  ${r.supervisors}`
    );
  }

  console.log('');
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
