import { BadRequestException } from '@nestjs/common';
import { FogCommunicationManagerService } from '../fogCommunicationManager.service';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

jest.mock('configs/app.config', () => ({
  __esModule: true,
  default: () => ({ timeseriesDb: { dbName: 'surveillance' } }),
}));

describe('FogCommunicationManagerService.restoreTimeSeriesDump', () => {
  const nvrId = '22222222-2222-4222-8222-222222222222';

  function buildService() {
    const service = new FogCommunicationManagerService({} as never, {} as never);
    const runCommand = jest
      .spyOn(service as never, 'runCommand')
      .mockResolvedValue('' as never);
    return { service, runCommand };
  }

  /**
   * A single `taosdump.<n>/` directory containing dbs.sql, matching taosdump's
   * real output shape (proven in test/qualification/taosdump-mechanics.js).
   */
  async function writeDump(sourceDb: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'tdengine-dump-'));
    const inner = join(dir, 'taosdump.123');
    await mkdir(inner, { recursive: true });
    await writeFile(
      join(inner, 'dbs.sql'),
      `#!server_ver: 3.3.6.3\n` +
        `CREATE DATABASE IF NOT EXISTS \`${sourceDb}\` REPLICA 1;\n\n` +
        `CREATE TABLE IF NOT EXISTS \`${sourceDb}\`.\`actor_log_t_test\` (createdat TIMESTAMP) TAGS (tenantid VARCHAR(36))\n`,
    );
    return dir;
  }

  it('imports fog\'s database into cloud\'s via taosdump -W, with -e and -r set', async () => {
    const { service, runCommand } = buildService();
    const dumpDir = await writeDump('surveillance-fog');

    await service.restoreTimeSeriesDump(dumpDir, nvrId);

    expect(runCommand).toHaveBeenCalledTimes(1);
    const [command, args] = runCommand.mock.calls[0]!;
    expect(command).toBe('taosdump');
    expect(args).toContain('-e');
    expect(args[args.indexOf('-i') + 1]).toBe(dumpDir);
    // -W renames fog's own database onto cloud's configured database; the
    // table names underneath already match, so nothing else needs mapping.
    expect(args[args.indexOf('-W') + 1]).toBe('surveillance-fog=surveillance');
    // taosdump writes dump_result.txt into its cwd unless redirected; in
    // production that's /app, which the unprivileged node user can't write
    // to. -r must point inside the (writable) dump directory instead.
    const resultFile = args[args.indexOf('-r') + 1] as string;
    expect(resultFile.startsWith(dumpDir)).toBe(true);
  });

  it('rejects a dump with no taosdump.<n> directory at all', async () => {
    const { service, runCommand } = buildService();
    const dumpDir = await mkdtemp(join(tmpdir(), 'tdengine-dump-'));

    await expect(
      service.restoreTimeSeriesDump(dumpDir, nvrId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('rejects a dbs.sql with no CREATE DATABASE statement', async () => {
    const { service, runCommand } = buildService();
    const dir = await mkdtemp(join(tmpdir(), 'tdengine-dump-'));
    const inner = join(dir, 'taosdump.123');
    await mkdir(inner, { recursive: true });
    await writeFile(join(inner, 'dbs.sql'), '#!server_ver: 3.3.6.3\n');

    await expect(
      service.restoreTimeSeriesDump(dir, nvrId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('rejects a source database name that is not a plain identifier', async () => {
    const { service, runCommand } = buildService();
    // Leading char must be alphanumeric (SAFE_DB_NAME) so a name can never
    // look like a flag once interpolated into the `-W` argv.
    const dumpDir = await writeDump('_not-a-safe-name');

    await expect(
      service.restoreTimeSeriesDump(dumpDir, nvrId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('propagates a taosdump failure', async () => {
    const { service, runCommand } = buildService();
    runCommand.mockRejectedValue(new Error('taosdump exited with code 1') as never);
    const dumpDir = await writeDump('surveillance-fog');

    await expect(
      service.restoreTimeSeriesDump(dumpDir, nvrId),
    ).rejects.toThrow('taosdump exited with code 1');
  });
});
