require('reflect-metadata');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const Redis = require('ioredis').default;
const mongoose = require('mongoose');

const repoRoot = process.env.QUALIFICATION_REPO_ROOT;
if (!repoRoot) throw new Error('QUALIFICATION_REPO_ROOT is required');

const {
  FogCommunicationManagerController,
} = require('src/modules/fogCommunicationManager/fogCommunicationManager.controller');
const {
  FogCommunicationManagerService,
} = require('src/modules/fogCommunicationManager/fogCommunicationManager.service');
const {
  FogBackupAuthGuard,
} = require('src/modules/fogCommunicationManager/fogBackupAuth.guard');
const {
  VideoDevicesApiForFogCommunicationManagerService,
} = require('src/modules/videoDevices/applicationService/services/apiForAnotherServices/videoDevicesApiForFogCommunicationManager.service');
const {
  CacheService,
} = require('src/extensions/caching/cache.service');

const tenantId = '11111111-1111-4111-8111-111111111111';
const nvrId = '22222222-2222-4222-8222-222222222222';
const cameraId = '33333333-3333-4333-8333-333333333333';
const pageId = '44444444-4444-4444-8444-444444444444';
const foreignCameraId = '55555555-5555-4555-8555-555555555555';
const foreignTenantId = '66666666-6666-4666-8666-666666666666';
const foreignNvrId = '77777777-7777-4777-8777-777777777777';
const serialNumber = 'NVR00001';
const accessToken = '1'.repeat(32);
const mongoUsername = process.env.MONGO_DB_USERNAME || '';
const mongoPassword = process.env.MONGO_DB_PASSWORD || '';
const mongoCredentials =
  mongoUsername && mongoPassword
    ? `${encodeURIComponent(mongoUsername)}:${encodeURIComponent(mongoPassword)}@`
    : '';
const mongoAuthQuery = mongoCredentials
  ? `?authSource=${encodeURIComponent(process.env.MONGO_DB_AUTH_SOURCE || 'admin')}`
  : '';
const mongoUri = `mongodb://${mongoCredentials}${process.env.MONGO_DB_HOST}:${process.env.MONGO_DB_PORT}/${process.env.MONGO_DB_NAME}${mongoAuthQuery}`;

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `${command} failed: ${result.stderr || result.stdout || result.status}`,
    );
  }
}

async function connectToMongo() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const connection = mongoose.createConnection(mongoUri, {
      serverSelectionTimeoutMS: 1000,
    });
    try {
      await connection.asPromise();
      await connection.db.admin().ping();
      return connection;
    } catch {
      await connection.close().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error('Mongo qualification container did not become ready');
}

async function waitForRedis(redis) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      await redis.ping();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error('Redis qualification container did not become ready');
}

async function writeJsonLines(filePath, documents) {
  await fsp.writeFile(
    filePath,
    documents.map((document) => JSON.stringify(document)).join('\n') + '\n',
  );
}

async function createSurveillanceFogArchive(root, cameraDocuments) {
  const producerRoot = path.join(root, 'fog_shared_backups');
  const mongoDirectory = path.join(producerRoot, 'mongo');
  const tdengineDirectory = path.join(producerRoot, 'tdengine');
  await fsp.mkdir(mongoDirectory, { recursive: true });
  await fsp.mkdir(tdengineDirectory, { recursive: true });

  await writeJsonLines(path.join(mongoDirectory, 'nvrs.json'), [
    {
      id: nvrId,
      workstationId: 'legacy-workstation',
      name: 'Restored NVR',
      maxCameras: 16,
      serialNumber,
      accessToken,
      password: 'restored-pass',
      lang: 'en',
      isActive: true,
      liveSignalStatus: 1,
      cloudFailedAt: 123,
      runningConfigs: { legacy: '12' },
    },
  ]);
  await writeJsonLines(path.join(mongoDirectory, 'cameras.json'), cameraDocuments);
  await writeJsonLines(path.join(mongoDirectory, 'pages.json'), [
    {
      id: pageId,
      name: 'Restored Page',
      nvrId,
      type: 'widget',
      pageIndex: 0,
      content: [{ id: cameraId }],
      runningConfigs: { legacy: '13' },
    },
  ]);
  await writeJsonLines(
    path.join(mongoDirectory, 'autoProvisioningOperations.json'),
    [{ tenantId, nvrId, msgId: 'ignored' }],
  );
  await writeJsonLines(
    path.join(mongoDirectory, 'cameraNetworkBindings.json'),
    [{ tenantId, nvrId, macAddress: 'AA:BB:CC:DD:EE:FF' }],
  );
  await fsp.writeFile(path.join(tdengineDirectory, 'dbs.sql'), 'ignored');

  const archive = path.join(root, 'backups.tar.zst');
  run('tar', [
    '-I',
    'zstd -12',
    '-cf',
    archive,
    '-C',
    root,
    'fog_shared_backups/mongo',
    'fog_shared_backups/tdengine',
  ]);
  return archive;
}

async function postArchive(baseUrl, archive, headers) {
  const form = new FormData();
  form.append(
    'file',
    new Blob([await fsp.readFile(archive)], {
      type: 'application/octet-stream',
    }),
    'backups.tar.zst',
  );
  return fetch(`${baseUrl}/fog-communication-manager/restore-fog-backup-to-cloud`, {
    method: 'POST',
    headers,
    body: form,
  });
}

async function main() {
  const fixtureRoot = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'fog-restore-http-fixture-'),
  );
  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    maxRetriesPerRequest: 1,
  });
  let connection;
  let app;

  try {
    [connection] = await Promise.all([connectToMongo(), waitForRedis(redis)]);
    const db = connection.db;
    await db.dropDatabase();
    await Promise.all([
      db.collection('nvrs').createIndex({ id: 1 }, { unique: true }),
      db.collection('cameras').createIndex({ id: 1 }, { unique: true }),
      db.collection('cameras').createIndex(
        { nvrId: 1, serialNumber: 1 },
        { unique: true },
      ),
      db.collection('cameras').createIndex(
        { nvrId: 1, macAddress: 1 },
        { unique: true },
      ),
      db.collection('pages').createIndex({ id: 1 }, { unique: true }),
    ]);
    await db.collection('nvrs').insertOne({
      id: nvrId,
      tenantId,
      serialNumber,
      accessToken,
      name: 'Original NVR',
      password: 'original-pass',
      maxCameras: 16,
      productModel: 'NVR-16',
      lang: 'fa',
      isActive: true,
      liveSignalStatus: 1,
      cloudIsRecovering: false,
      runningConfigs: { init: '-1' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.collection('cameras').insertOne({
      id: foreignCameraId,
      tenantId: foreignTenantId,
      nvrId: foreignNvrId,
      name: 'Foreign Camera',
      serialNumber: 'CAM99999',
      macAddress: 'AA:BB:CC:DD:EE:99',
    });

    const recoveryCalls = { start: 0, complete: 0, reset: 0 };
    const fogApi = {
      findFogNvrBySerialNumber: async (requestedSerialNumber) =>
        requestedSerialNumber === serialNumber
          ? {
              id: nvrId,
              tenantId,
              serialNumber,
              accessToken,
              cloudIsRecovering: false,
            }
          : undefined,
      sendCloudIsAvailableSignalToFog: async () => undefined,
      startFogCloudRecovery: async () => {
        recoveryCalls.start += 1;
      },
      completeFogCloudRecovery: async () => {
        recoveryCalls.complete += 1;
      },
      resetFogCloudRecovery: async () => {
        recoveryCalls.reset += 1;
      },
    };
    const cache = {
      acquireLock: async (key, ttl) => {
        const token = `${Date.now()}-${Math.random()}`;
        const result = await redis.set(`cache:lock:${key}`, token, 'EX', ttl, 'NX');
        return result === 'OK' ? token : null;
      },
      releaseLock: async (key, token) => {
        await redis.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          `cache:lock:${key}`,
          token,
        );
      },
      delete: async (key) => redis.del(`cache:${key}`),
    };

    class QualificationModule {}
    Module({
      controllers: [FogCommunicationManagerController],
      providers: [
        FogCommunicationManagerService,
        FogBackupAuthGuard,
        {
          provide: VideoDevicesApiForFogCommunicationManagerService,
          useValue: fogApi,
        },
        { provide: CacheService, useValue: cache },
      ],
    })(QualificationModule);

    app = await NestFactory.create(QualificationModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    const port = app.getHttpServer().address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    const validHeaders = {
      'X-Tenant-Id': tenantId,
      'X-Nvr-Serial-Number': serialNumber,
      'X-Nvr-Access-Token': accessToken,
    };

    const camera = {
      id: cameraId,
      name: 'Restored Camera',
      productModel: 'CAM-1',
      serialNumber: 'CAM00001',
      username: 'admin',
      password: 'camera-password',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      port: 554,
      streams: {
        recordStream: { token: 'record', path: '/record', resolutions: [] },
        liveStream: { token: 'live', path: '/live', resolutions: [] },
      },
      hasPtz: true,
      hasAudio: false,
      nvrId,
      isActive: true,
      liveSignalStatus: 1,
      runningConfigs: { legacy: '11' },
    };
    const successArchive = process.env.QUALIFICATION_SUCCESS_ARCHIVE
      ? path.resolve(process.env.QUALIFICATION_SUCCESS_ARCHIVE)
      : await createSurveillanceFogArchive(
          path.join(fixtureRoot, 'success'),
          [camera],
        );
    await fsp.access(successArchive, fs.constants.R_OK);

    const unauthorized = await postArchive(baseUrl, successArchive, {
      ...validHeaders,
      'X-Tenant-Id': foreignTenantId,
    });
    assert.equal(unauthorized.status, 400);
    assert.deepEqual(await fsp.readdir(process.env.FOG_BACKUP_ROOT), []);

    const success = await postArchive(baseUrl, successArchive, validHeaders);
    assert.ok(success.status >= 200 && success.status < 300, await success.text());

    const restoredNvr = await db.collection('nvrs').findOne({ id: nvrId });
    const restoredCamera = await db.collection('cameras').findOne({ id: cameraId });
    const restoredPage = await db.collection('pages').findOne({ id: pageId });
    assert.equal(restoredNvr.name, 'Restored NVR');
    assert.equal(restoredNvr.tenantId, tenantId);
    assert.equal(restoredCamera.tenantId, tenantId);
    assert.equal(restoredCamera.nvrId, nvrId);
    assert.equal(restoredCamera.liveSignalStatus, 2);
    assert.deepEqual(restoredCamera.runningConfigs, { init: '-1' });
    assert.equal(restoredPage.nvrId, nvrId);
    assert.deepEqual(restoredPage.runningConfigs, { init: '-1' });
    assert.equal(recoveryCalls.start, 1);
    assert.equal(recoveryCalls.complete, 1);
    assert.equal(recoveryCalls.reset, 0);
    assert.deepEqual(await fsp.readdir(process.env.FOG_BACKUP_ROOT), []);
    assert.deepEqual(await redis.keys('cache:lock:fog-restore:*'), []);

    const collisionArchive = await createSurveillanceFogArchive(
      path.join(fixtureRoot, 'collision'),
      [{ ...camera, id: foreignCameraId, serialNumber: 'CAM00002', macAddress: 'AA:BB:CC:DD:EE:02' }],
    );
    const collision = await postArchive(baseUrl, collisionArchive, validHeaders);
    assert.equal(collision.status, 500);
    const foreignCamera = await db
      .collection('cameras')
      .findOne({ id: foreignCameraId });
    assert.equal(foreignCamera.name, 'Foreign Camera');
    assert.equal(foreignCamera.tenantId, foreignTenantId);
    assert.equal(recoveryCalls.reset, 1);
    assert.deepEqual(await fsp.readdir(process.env.FOG_BACKUP_ROOT), []);
    assert.deepEqual(await redis.keys('cache:lock:fog-restore:*'), []);

    console.log(
      JSON.stringify({
        qualified: true,
        httpUpload: true,
        archiveLayout: 'fog-surveillance-camera',
        producerArchive: Boolean(process.env.QUALIFICATION_SUCCESS_ARCHIVE),
        mongo: true,
        mongoAuth: Boolean(mongoCredentials),
        redisLock: true,
        cleanup: true,
        foreignScopeRejected: true,
      }),
    );
  } finally {
    if (app) await app.close();
    await Promise.allSettled([
      connection?.dropDatabase(),
      connection?.close(),
      redis.quit(),
      fsp.rm(fixtureRoot, { recursive: true, force: true }),
    ]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
