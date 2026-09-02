import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { mkdir } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { BACKUP_ROOT } from './fogBackupRoot';

export const fogBackupStorage = diskStorage({
  destination: (_request, _file, callback) => {
    mkdir(BACKUP_ROOT, { recursive: true }, (error) => {
      callback(error, BACKUP_ROOT);
    });
  },
  filename: (_request, _file, callback) => {
    callback(null, `${randomUUID()}.tar.zst`);
  },
});

export const fogBackupFileFilter = (
  _request: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
): void => {
  const validName = file.originalname.toLowerCase().endsWith('.tar.zst');
  const validMimeType = file.mimetype === 'application/octet-stream';
  if (!validName || !validMimeType) {
    callback(new BadRequestException('invalid Fog backup file'), false);
    return;
  }
  callback(null, true);
};
