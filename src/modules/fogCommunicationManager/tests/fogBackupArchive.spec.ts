import { BadRequestException } from '@nestjs/common';
import { selectMongoBackupMembers } from '../fogBackupArchive';

describe('selectMongoBackupMembers', () => {
  it('selects supported Mongo files and the TDengine backup from a nested backup', () => {
    expect(
      selectMongoBackupMembers(
        [
          'backups/',
          'backups/mongo/',
          'backups/mongo/nvrs.json',
          'backups/mongo/cameras.json',
          'backups/mongo/pages.json',
          'backups/mongo/autoProvisioningOperations.json',
          'backups/mongo/cameraNetworkBindings.json',
          'backups/tdengine/',
          'backups/tdengine/dbs.sql',
        ].join('\n'),
      ),
    ).toEqual({
      nvrs: 'backups/mongo/nvrs.json',
      cameras: 'backups/mongo/cameras.json',
      pages: 'backups/mongo/pages.json',
      tdengine: ['backups/tdengine/dbs.sql'],
    });
  });

  it('omits tdengine from the result when the archive has no TDengine backup', () => {
    expect(
      selectMongoBackupMembers('backups/mongo/nvrs.json'),
    ).toEqual({ nvrs: 'backups/mongo/nvrs.json' });
  });

  it.each([
    '../mongo/cameras.json',
    '/mongo/cameras.json',
    'backups/mongo/../../cameras.json',
    'backups/mongo/employees.json',
    'backups/other.json',
  ])('rejects unsafe or unsupported entry %s', (entry) => {
    expect(() => selectMongoBackupMembers(entry)).toThrow(BadRequestException);
  });

  it('rejects duplicate aliases for the NVR collection', () => {
    expect(() =>
      selectMongoBackupMembers(
        'backups/mongo/nvrs.json\nbackups/mongo/gateways.json',
      ),
    ).toThrow('duplicate nvrs data');
  });

  it('collects TDengine entries under any root prefix into the tree', () => {
    // A taosdump tree is many files, so multiple `tdengine/` entries (even
    // under different parent prefixes) are collected rather than rejected —
    // duplicate-collection detection no longer applies here.
    expect(
      selectMongoBackupMembers(
        'backups/mongo/nvrs.json\n' +
          'backups/tdengine/dbs.sql\n' +
          'other/tdengine/dbs.sql',
      ).tdengine,
    ).toEqual(['backups/tdengine/dbs.sql', 'other/tdengine/dbs.sql']);
  });
});

describe('selectMongoBackupMembers tdengine tree', () => {
  const mongo = 'mongo/nvrs.json';

  it('collects every file under tdengine/ as a tree', () => {
    const listing = [
      mongo,
      'tdengine/dbs.sql',
      'tdengine/taosdump.123/dbs.sql',
      'tdengine/taosdump.123/data0-ABC/stbname',
      'tdengine/taosdump.123/data0-ABC/db.1.0.avro',
    ].join('\n');

    const members = selectMongoBackupMembers(listing);

    expect(members.tdengine).toEqual([
      'tdengine/dbs.sql',
      'tdengine/taosdump.123/dbs.sql',
      'tdengine/taosdump.123/data0-ABC/stbname',
      'tdengine/taosdump.123/data0-ABC/db.1.0.avro',
    ]);
  });

  it('still rejects traversal inside the tdengine tree', () => {
    const listing = [mongo, 'tdengine/../../etc/passwd'].join('\n');
    expect(() => selectMongoBackupMembers(listing)).toThrow(BadRequestException);
  });

  it('leaves tdengine undefined when the archive has none', () => {
    expect(selectMongoBackupMembers(mongo).tdengine).toBeUndefined();
  });
});
