// Proves the SHIPPED fog-dump / cloud-restore taosdump argv shapes work end
// to end against a REAL TDengine — complementing taosdump-mechanics.js
// (which proves the raw dump/import mechanics, not the application's exact
// argv). Run:
//   node test/qualification/fog-cloud-roundtrip.js
// Requires taosdump on PATH. Creates and drops only claude_rt_* databases.
//
// Environment quirks specific to THIS host-side test (neither is true of the
// real deployment — see the comments below, so nobody "fixes" this back to
// something that doesn't work on a bare host):
//
//  - The only host-reachable TDengine is the tdengine-fog container (REST on
//    60410, native on 60300); tdengine-cloud has no host port mappings at
//    all and cannot be reached from here. So this script uses tdengine-fog
//    as "a real TDengine" for BOTH sides of the round trip — a fog-side
//    database and a cloud-side database, both living on the one server. That
//    is a test-harness convenience, not a claim about topology.
//  - taosdump's native protocol does not work through host port-mapping (the
//    server advertises its own in-cluster FQDN, and the client then fails to
//    reach it), so this script forces `-Z WebSocket` against the REST port.
//    In the real deployment fog and cloud each talk to TDengine natively
//    *inside* the docker network, which works fine there. `-Z WebSocket`
//    here is a host-testing accommodation only — it is not part of the argv
//    the application itself builds, and is kept separate from the argv
//    blocks below that ARE lifted verbatim from application code.
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REST = process.env.TDENGINE_REST || 'http://localhost:60410';
const USER = process.env.TDENGINE_USER || 'root';
const PASSWORD = process.env.TDENGINE_PASSWORD || 'taosdata';
const AUTH = 'Basic ' + Buffer.from(`${USER}:${PASSWORD}`).toString('base64');
const HOST = process.env.TDENGINE_HOST || 'localhost';
const PORT = process.env.TDENGINE_PORT || '60410';
const DRIVER = process.env.TDENGINE_DRIVER || 'WebSocket';

const FOG_DB = 'claude_rt_fog';
const CLOUD_DB = 'claude_rt_cloud';
const TENANT = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '55555555-5555-4555-8555-555555555555';
const suffix = (id) => id.replaceAll('-', '').toLowerCase();

// Real naming scheme (actorLogSuperTableName / systemLogSuperTableName):
// fog and cloud each derive these names independently from the same tenant
// id, so they always agree — which is the whole reason `-W <fogDb>=<cloudDb>`
// alone is enough to land rows in the right table without any renaming of
// the stables themselves.
const ACTOR_STABLE = `actor_log_t_${suffix(TENANT)}`;
const SYSTEM_STABLE = `system_log_t_${suffix(TENANT)}`;
const ACTOR_CHILD = `${ACTOR_STABLE}_${suffix(ACTOR_ID)}`;
const SYSTEM_CHILD = `${SYSTEM_STABLE}_error`;

// One row before the -S cutoff, two after — proves both that the round trip
// carries values intact AND that -S actually excludes what it should.
const CUTOFF = 1735689600000;
const OLD_TS = 1735689000000;
const NEW_TS = 1735689601000;
const SYSTEM_TS_1 = 1735689601000;
const SYSTEM_TS_2 = 1735689602000;

async function sql(statement) {
  const res = await fetch(`${REST}/rest/sql`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'text/plain' },
    body: statement,
  });
  const body = await res.json();
  if (body.code !== 0) {
    throw new Error(`SQL failed (${body.code}): ${body.desc} :: ${statement}`);
  }
  return body.data || [];
}

function taosdump(args) {
  const result = spawnSync('taosdump', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    const detail = [result.error && result.error.message, result.stderr, result.stdout]
      .filter(Boolean)
      .join(' | ');
    throw new Error(`taosdump failed: ${detail}`);
  }
  return result.stdout + result.stderr;
}

async function main() {
  const dumpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'fog-cloud-roundtrip-'));
  const dumpResultFile = path.join(dumpDir, 'dump_result.txt');
  const restoreResultFile = path.join(dumpDir, 'dump_result.txt');

  // Test-only connection scaffolding. NOT part of either application's argv
  // — see the file-header comment on -Z/WebSocket.
  const connArgs = ['-h', HOST, '-P', PORT, '-u', USER, `-p${PASSWORD}`, '-Z', DRIVER];

  try {
    for (const db of [FOG_DB, CLOUD_DB]) {
      await sql(`DROP DATABASE IF EXISTS \`${db}\`;`);
    }
    await sql(`CREATE DATABASE \`${FOG_DB}\`;`);
    await sql(
      `CREATE STABLE \`${FOG_DB}\`.${ACTOR_STABLE} (createdAt TIMESTAMP, ` +
        `actorLogType VARCHAR(20), messageKey VARCHAR(200), messageParams VARCHAR(500)) ` +
        `TAGS (tenantId VARCHAR(36), actorId NCHAR(36));`,
    );
    await sql(
      `CREATE STABLE \`${FOG_DB}\`.${SYSTEM_STABLE} (createdAt TIMESTAMP, ` +
        `messageKey VARCHAR(200), messageParams VARCHAR(500), section VARCHAR(50), ` +
        `entityId VARCHAR(50)) TAGS (tenantId VARCHAR(36), groupId VARCHAR(15));`,
    );

    await sql(
      `INSERT INTO \`${FOG_DB}\`.\`${ACTOR_CHILD}\` USING \`${FOG_DB}\`.${ACTOR_STABLE} ` +
        `(tenantId, actorId) TAGS ('${TENANT}','${ACTOR_ID}') ` +
        `(createdAt, actorLogType, messageKey, messageParams) VALUES ` +
        `(${OLD_TS}, 'EMPLOYEE', 'old.actor.key', 'old-param') ` +
        `(${NEW_TS}, 'EMPLOYEE', 'new.actor.key', 'new-param');`,
    );
    await sql(
      `INSERT INTO \`${FOG_DB}\`.\`${SYSTEM_CHILD}\` USING \`${FOG_DB}\`.${SYSTEM_STABLE} ` +
        `(tenantId, groupId) TAGS ('${TENANT}','error') ` +
        `(createdAt, messageKey, messageParams, section, entityId) VALUES ` +
        `(${SYSTEM_TS_1}, 'system.key.one', 'sp1', 'SYSTEM_LOG_SECTION_PAGE', 'entity-1') ` +
        `(${SYSTEM_TS_2}, 'system.key.two', 'sp2', 'SYSTEM_LOG_SECTION_PAGE', 'entity-2');`,
    );

    // --- from here down: the EXACT argv createTimeSeriesBackup builds in
    // fog-surveillance-camera's cloudRecovery.service.ts ---
    taosdump([
      ...connArgs,
      '-e',
      FOG_DB,
      ACTOR_STABLE,
      SYSTEM_STABLE,
      '-S', String(CUTOFF),
      '-o', dumpDir,
      '-r', dumpResultFile,
    ]);

    const inner = (await fsp.readdir(dumpDir)).find((n) => n.startsWith('taosdump.'));
    assert.ok(inner, 'dump should contain a taosdump.<n> directory');
    const ddl = await fsp.readFile(path.join(dumpDir, inner, 'dbs.sql'), 'utf8');
    assert.ok(
      /CREATE DATABASE IF NOT EXISTS\s+`?claude_rt_fog`?/i.test(ddl),
      'inner dbs.sql should declare the fog database',
    );

    // --- from here down: the EXACT argv restoreTimeSeriesDump builds in
    // cloud-surveillance-camera's fogCommunicationManager.service.ts (the
    // fog db name is normally read out of dbs.sql by readDumpSourceDatabase;
    // we already know it here since we created it, above) ---
    taosdump([
      ...connArgs,
      '-e',
      '-i', dumpDir,
      '-W', `${FOG_DB}=${CLOUD_DB}`,
      '-r', restoreResultFile,
    ]);

    const actorRows = await sql(
      `SELECT createdAt, actorLogType, messageKey, messageParams, actorId ` +
        `FROM \`${CLOUD_DB}\`.${ACTOR_STABLE};`,
    );
    assert.equal(
      actorRows.length,
      1,
      '-S should have excluded the pre-cutoff actor-log row from the dump',
    );
    assert.equal(actorRows[0][2], 'new.actor.key');
    assert.equal(actorRows[0][3], 'new-param');
    assert.equal(actorRows[0][4], ACTOR_ID, 'actorId tag must survive the round trip');

    const systemRows = await sql(
      `SELECT createdAt, messageKey, messageParams, section, entityId, groupId ` +
        `FROM \`${CLOUD_DB}\`.${SYSTEM_STABLE};`,
    );
    assert.equal(systemRows.length, 2, 'both post-cutoff system-log rows should arrive');
    assert.deepEqual(
      systemRows.map((r) => r[1]).sort(),
      ['system.key.one', 'system.key.two'],
    );
    assert.deepEqual(systemRows.map((r) => r[2]).sort(), ['sp1', 'sp2']);
    assert.deepEqual(
      systemRows.map((r) => r[4]).sort(),
      ['entity-1', 'entity-2'],
    );
    for (const row of systemRows) {
      assert.equal(row[5], 'error', 'groupId tag must survive the round trip');
    }

    console.log('fog-cloud roundtrip: OK');
  } finally {
    for (const db of [FOG_DB, CLOUD_DB]) {
      await sql(`DROP DATABASE IF EXISTS \`${db}\`;`).catch(() => {});
    }
    await fsp.rm(dumpDir, { recursive: true, force: true }).catch(() => {});
    // The DROPs above swallow their own errors, so verify cleanup actually
    // happened rather than trusting a silently-failed DROP to exit 0.
    const leftover = await sql(
      `SELECT name FROM information_schema.ins_databases WHERE name LIKE 'claude_rt_%';`,
    );
    assert.equal(
      leftover.length,
      0,
      `cleanup failed to remove: ${leftover.map((r) => r[0]).join(', ')}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
