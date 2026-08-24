import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { basename, extname } from 'node:path';

export const storage = diskStorage({
  destination: '/cloud_shared_backups',
  filename: (_req, file, cb) => {
    // Strip any directory components from the client-supplied name so a
    // crafted originalname (e.g. "../../foo.zst") cannot write outside the
    // destination dir. basename() is a no-op for the legitimate
    // "backups.tar.zst" upload, so the restore path is unaffected.
    cb(null, basename(file.originalname));
  },
});

export const fileFilter = (_req: any, file: any, cb: any) => {
  const isValidFileType = extname(file.originalname).toLowerCase() === '.zst';
  const isValidMimeType = file.mimetype === 'application/octet-stream';
  if (!isValidFileType || !isValidMimeType)
    return cb(new BadRequestException('invalid file '), false);
  return cb(null, true);
};
