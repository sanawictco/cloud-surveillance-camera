import { BadRequestException } from '@nestjs/common';

export interface MongoBackupMembers {
  nvrs?: string;
  cameras?: string;
  pages?: string;
}

const ALLOWED_MONGO_FILES: Record<string, keyof MongoBackupMembers> = {
  'nvrs.json': 'nvrs',
  'gateways.json': 'nvrs',
  'cameras.json': 'cameras',
  'pages.json': 'pages',
};
const IGNORED_LOCAL_MONGO_FILES = new Set([
  'autoProvisioningOperations.json',
  'cameraNetworkBindings.json',
]);

export function selectMongoBackupMembers(listing: string): MongoBackupMembers {
  const selected: MongoBackupMembers = {};

  for (const rawName of listing.split('\n')) {
    const name = rawName.trim();
    if (!name) continue;
    if (name.startsWith('/') || name.includes('\\')) {
      throw new BadRequestException('Fog backup contains an unsafe path');
    }
    const segments = name.split('/').filter(Boolean);
    if (segments.includes('..')) {
      throw new BadRequestException('Fog backup contains an unsafe path');
    }
    if (name.endsWith('/')) continue;

    const mongoIndex = segments.indexOf('mongo');
    if (mongoIndex >= 0) {
      if (segments.length !== mongoIndex + 2) {
        throw new BadRequestException('Fog backup Mongo layout is invalid');
      }
      const fileName = segments[mongoIndex + 1]!;
      if (IGNORED_LOCAL_MONGO_FILES.has(fileName)) continue;
      const key = ALLOWED_MONGO_FILES[fileName];
      if (!key) {
        throw new BadRequestException(
          `Fog backup collection is not allowed: ${fileName}`,
        );
      }
      if (selected[key]) {
        throw new BadRequestException(
          `Fog backup contains duplicate ${key} data`,
        );
      }
      selected[key] = name;
      continue;
    }

    if (segments.includes('tdengine')) continue;
    throw new BadRequestException(`Fog backup entry is not allowed: ${name}`);
  }

  if (!selected.nvrs && !selected.cameras && !selected.pages) {
    throw new BadRequestException(
      'Fog backup contains no restorable Mongo data',
    );
  }
  return selected;
}
