import { BadRequestException } from '@nestjs/common';
import { selectMongoBackupMembers } from '../fogBackupArchive';

describe('selectMongoBackupMembers', () => {
  it('selects only supported Mongo files from a nested backup', () => {
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
          'backups/tdengine/data.sql',
        ].join('\n'),
      ),
    ).toEqual({
      nvrs: 'backups/mongo/nvrs.json',
      cameras: 'backups/mongo/cameras.json',
      pages: 'backups/mongo/pages.json',
    });
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
});
