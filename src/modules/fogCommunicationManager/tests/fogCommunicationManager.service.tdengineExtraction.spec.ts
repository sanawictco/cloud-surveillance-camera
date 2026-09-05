import { BadRequestException } from '@nestjs/common';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { FogCommunicationManagerService } from '../fogCommunicationManager.service';

// A jest.spyOn(childProcess, 'spawn') runtime patch fails on this Node/Jest
// combination ("Cannot redefine property: spawn" — the built-in module's
// namespace object is non-configurable). Mocking the module itself, wrapping
// the real implementation, avoids that and still lets the "single spawn"
// test observe every call the SOURCE file makes (Jest's module registry is
// shared, so the source's `import { spawn } from 'node:child_process'`
// resolves to this same mock). Every export but spawn passes through
// untouched, including execFileSync, used below to build real fixtures.
jest.mock('node:child_process', () => {
  const actual: typeof import('node:child_process') =
    jest.requireActual('node:child_process');
  return { ...actual, spawn: jest.fn(actual.spawn) };
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { spawn: spawnMock } = require('node:child_process') as {
  spawn: jest.Mock;
};

/**
 * Proves extractTdengineTree's fix-round-1 rework:
 *  - the WHOLE tdengine/ tree is extracted in a single tar spawn regardless
 *    of member count (the fix for the ~150 CPU-hour amplification finding —
 *    the old per-member loop paid a full archive decompression pass per
 *    file);
 *  - the shared byte budget (MAX_EXTRACTED_TDENGINE_TREE_BYTES) is still
 *    enforced as ONE running total for the whole tree, not per file;
 *  - the resolved dump directory returned matches wherever "tdengine/" sits
 *    in the members' shared path (segment-based, matching
 *    selectMongoBackupMembers' own logic).
 *
 * These tests build real tar+zstd archives (the same format the service
 * extracts in production) and drive the private method directly, injecting a
 * small budget so the test stays fast.
 */
describe('FogCommunicationManagerService tdengine tree extraction (single invocation)', () => {
  function buildService(): FogCommunicationManagerService {
    return new FogCommunicationManagerService({} as never, {} as never);
  }

  interface PrivateExtraction {
    extractTdengineTree(
      archive: string,
      members: string[],
      scratchDirectory: string,
      nvrId: string,
      budget?: number,
    ): Promise<string>;
  }

  async function buildArchive(
    files: Record<string, string>,
  ): Promise<{ archivePath: string; members: string[] }> {
    const srcDir = await mkdtemp(join(tmpdir(), 'tdengine-tree-src-'));
    const members = Object.keys(files);
    for (const [relative, content] of Object.entries(files)) {
      const full = join(srcDir, relative);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, content);
    }
    const archiveDir = await mkdtemp(join(tmpdir(), 'tdengine-tree-archive-'));
    const archivePath = join(archiveDir, 'backup.tar.zst');
    execFileSync('tar', [
      '-I',
      'zstd',
      '-cf',
      archivePath,
      '-C',
      srcDir,
      ...members,
    ]);
    return { archivePath, members };
  }

  it('extracts every member and resolves the dump directory to the tdengine root', async () => {
    const service = buildService() as unknown as PrivateExtraction;
    const { archivePath, members } = await buildArchive({
      'backups/tdengine/taosdump.1/dbs.sql': 'DDL',
      'backups/tdengine/taosdump.1/file-b': 'b'.repeat(40),
    });
    const outDir = await mkdtemp(join(tmpdir(), 'tdengine-tree-out-'));

    const dumpDir = await service.extractTdengineTree(
      archivePath,
      members,
      outDir,
      'nvr-1',
      1000,
    );

    expect(dumpDir).toBe(join(outDir, 'backups', 'tdengine'));
    expect(await readFile(join(dumpDir, 'taosdump.1', 'dbs.sql'), 'utf8')).toBe(
      'DDL',
    );
    expect(await readFile(join(dumpDir, 'taosdump.1', 'file-b'), 'utf8')).toBe(
      'b'.repeat(40),
    );
  });

  it('spawns exactly one tar process regardless of member count', async () => {
    const service = buildService() as unknown as PrivateExtraction;
    const files: Record<string, string> = {};
    for (let i = 0; i < 50; i++) {
      files[`tdengine/taosdump.1/file-${i}`] = `content-${i}`;
    }
    const { archivePath, members } = await buildArchive(files);
    const outDir = await mkdtemp(join(tmpdir(), 'tdengine-tree-out-'));
    const spawnCountBefore = spawnMock.mock.calls.length;

    await service.extractTdengineTree(archivePath, members, outDir, 'nvr-1', 10_000);

    const tarCalls = spawnMock.mock.calls
      .slice(spawnCountBefore)
      .filter(([cmd]: [string]) => cmd === 'tar');
    expect(tarCalls).toHaveLength(1);
    // All 50 members were named on that single invocation.
    const args = tarCalls[0]![1] as string[];
    for (const member of members) {
      expect(args).toContain(member);
    }
  });

  it('rejects once the RUNNING TOTAL across members exceeds the shared budget, even though no single member alone would', async () => {
    const service = buildService() as unknown as PrivateExtraction;
    // Each member is 40 bytes -- comfortably under a 100-byte budget by
    // itself -- but three of them total 120 bytes.
    const { archivePath, members } = await buildArchive({
      'tdengine/taosdump.1/file-a': 'a'.repeat(40),
      'tdengine/taosdump.1/file-b': 'b'.repeat(40),
      'tdengine/taosdump.1/file-c': 'c'.repeat(40),
    });
    const outDir = await mkdtemp(join(tmpdir(), 'tdengine-tree-out-'));

    await expect(
      service.extractTdengineTree(archivePath, members, outDir, 'nvr-1', 100),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a single member that alone exceeds the shared budget', async () => {
    const service = buildService() as unknown as PrivateExtraction;
    const { archivePath, members } = await buildArchive({
      'tdengine/taosdump.1/file-huge': 'x'.repeat(200),
    });
    const outDir = await mkdtemp(join(tmpdir(), 'tdengine-tree-out-'));

    await expect(
      service.extractTdengineTree(archivePath, members, outDir, 'nvr-1', 100),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a tree comfortably under the budget', async () => {
    const service = buildService() as unknown as PrivateExtraction;
    const { archivePath, members } = await buildArchive({
      'tdengine/taosdump.1/file-a': 'a'.repeat(40),
      'tdengine/taosdump.1/file-b': 'b'.repeat(40),
    });
    const outDir = await mkdtemp(join(tmpdir(), 'tdengine-tree-out-'));

    await expect(
      service.extractTdengineTree(archivePath, members, outDir, 'nvr-1', 1000),
    ).resolves.toBe(join(outDir, 'tdengine'));
  });

  it('rejects a tree whose members disagree on where the tdengine root sits', async () => {
    const service = buildService() as unknown as PrivateExtraction;
    const { archivePath, members } = await buildArchive({
      'backups/tdengine/taosdump.1/dbs.sql': 'DDL',
      'other/tdengine/taosdump.1/dbs.sql': 'DDL',
    });
    const outDir = await mkdtemp(join(tmpdir(), 'tdengine-tree-out-'));

    await expect(
      service.extractTdengineTree(archivePath, members, outDir, 'nvr-1', 10_000),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
