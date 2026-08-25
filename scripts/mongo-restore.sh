#!/bin/bash

set -euo pipefail

required_vars=(
  MONGO_RESTORE_DB
  MONGO_RESTORE_URI
  MONGO_RESTORE_DIR
  MONGO_RESTORE_TENANT_ID
  MONGO_RESTORE_NVR_ID
  MONGO_RESTORE_SERIAL_NUMBER
  MONGO_RESTORE_RESULT_FILE
)

for name in "${required_vars[@]}"; do
  if [ -z "${!name:-}" ]; then
    echo "ERROR: $name is required" >&2
    exit 1
  fi
done

IMPORT_SCRIPT="$(mktemp /tmp/scoped-fog-restore.XXXXXX.js)"

cleanup() {
  rm -f "$IMPORT_SCRIPT"
}
trap cleanup EXIT

cat > "$IMPORT_SCRIPT" <<'EOF'
const fs = require('fs');
const path = require('path');

const backupDir = fs.realpathSync(process.env.MONGO_RESTORE_DIR);
const tenantId = process.env.MONGO_RESTORE_TENANT_ID;
const nvrId = process.env.MONGO_RESTORE_NVR_ID;
const serialNumber = process.env.MONGO_RESTORE_SERIAL_NUMBER;
const resultFile = process.env.MONGO_RESTORE_RESULT_FILE;
const maxDocuments = Number(process.env.MONGO_RESTORE_MAX_DOCUMENTS || '10000');
const allowedFiles = new Set([
  'nvrs.json',
  'gateways.json',
  'cameras.json',
  'pages.json',
]);

function fail(message) {
  throw new Error(message);
}

function isUuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function requiredString(doc, key) {
  if (typeof doc[key] !== 'string' || doc[key].length === 0) {
    fail(`${key} must be a non-empty string`);
  }
  return doc[key];
}

function boundedString(doc, key, minLength, maxLength) {
  const value = requiredString(doc, key);
  if (value.length < minLength || value.length > maxLength) {
    fail(`${key} must be ${minLength}-${maxLength} characters`);
  }
  return value;
}

function optionalBoolean(doc, key, fallback) {
  if (doc[key] === undefined) return fallback;
  if (typeof doc[key] !== 'boolean') fail(`${key} must be boolean`);
  return doc[key];
}

function readDocuments(fileName) {
  const filePath = path.join(backupDir, fileName);
  if (!fs.existsSync(filePath)) return [];
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail(`${fileName} must be a regular file`);
  }
  const realPath = fs.realpathSync(filePath);
  if (!realPath.startsWith(`${backupDir}${path.sep}`)) {
    fail(`${fileName} resolves outside the backup directory`);
  }

  const content = fs.readFileSync(realPath, 'utf8').trim();
  if (!content) return [];
  let documents;
  try {
    documents = content.startsWith('[')
      ? JSON.parse(content)
      : content.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    fail(`${fileName} contains invalid JSON`);
  }
  if (!Array.isArray(documents)) fail(`${fileName} must contain documents`);
  if (documents.length > maxDocuments) {
    fail(`${fileName} exceeds the document limit`);
  }
  for (const document of documents) {
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      fail(`${fileName} contains an invalid document`);
    }
  }
  return documents;
}

for (const entry of fs.readdirSync(backupDir, { withFileTypes: true })) {
  if (entry.isSymbolicLink()) fail('backup directory cannot contain symlinks');
  if (entry.isFile() && !allowedFiles.has(entry.name)) {
    fail(`unsupported backup file: ${entry.name}`);
  }
  if (!entry.isFile()) fail(`unsupported backup entry: ${entry.name}`);
}

if (fs.existsSync(path.join(backupDir, 'nvrs.json')) && fs.existsSync(path.join(backupDir, 'gateways.json'))) {
  fail('backup cannot contain both nvrs.json and gateways.json');
}

const nvrDocuments = readDocuments(
  fs.existsSync(path.join(backupDir, 'nvrs.json')) ? 'nvrs.json' : 'gateways.json',
);
const cameraDocuments = readDocuments('cameras.json');
const pageDocuments = readDocuments('pages.json');
const cameraIds = new Set();
const cameraSerialNumbers = new Set();
const cameraMacAddresses = new Set();
const pageIds = new Set();

const connection = new Mongo(process.env.MONGO_RESTORE_URI);
db = connection.getDB(process.env.MONGO_RESTORE_DB);
const persistedNvr = db.nvrs.findOne({ id: nvrId, tenantId, serialNumber });
if (!persistedNvr) fail('authenticated NVR scope does not exist');

if (nvrDocuments.length > 1) fail('backup contains more than one NVR');
const nvrDocument = nvrDocuments[0];
if (nvrDocument) {
  if (nvrDocument.id !== undefined && nvrDocument.id !== nvrId) {
    fail('backup NVR id does not match authenticated NVR');
  }
  if (
    nvrDocument.tenantId !== undefined &&
    nvrDocument.tenantId !== tenantId
  ) {
    fail('backup NVR tenant does not match authenticated tenant');
  }
  if (
    nvrDocument.serialNumber !== undefined &&
    nvrDocument.serialNumber !== serialNumber
  ) {
    fail('backup serial number does not match authenticated NVR');
  }
  if (nvrDocument.name !== undefined) boundedString(nvrDocument, 'name', 1, 60);
  if (nvrDocument.password !== undefined) boundedString(nvrDocument, 'password', 12, 30);
  if (
    nvrDocument.lang !== undefined &&
    !['en', 'fa', 'ar', 'ku'].includes(nvrDocument.lang)
  ) {
    fail('backup NVR language is invalid');
  }
}

const cameraWrites = cameraDocuments.map((document) => {
  if (!isUuid(document.id)) fail('camera id must be a UUID v4');
  if (cameraIds.has(document.id)) fail(`duplicate camera id ${document.id}`);
  cameraIds.add(document.id);
  if (document.tenantId !== undefined && document.tenantId !== tenantId) {
    fail(`camera ${document.id} belongs to another tenant`);
  }
  const backupNvrId = document.nvrId ?? document.gatewayId;
  if (backupNvrId !== undefined && backupNvrId !== nvrId) {
    fail(`camera ${document.id} belongs to another NVR`);
  }
  const existing = db.cameras.findOne({ id: document.id });
  if (
    existing &&
    (existing.tenantId !== tenantId || existing.nvrId !== nvrId)
  ) {
    fail(`camera ${document.id} collides with another scope`);
  }

  const name = boundedString(document, 'name', 1, 60);
  const productModel = boundedString(document, 'productModel', 1, 100);
  const cameraSerialNumber = boundedString(document, 'serialNumber', 8, 8);
  if (cameraSerialNumber !== cameraSerialNumber.toUpperCase()) {
    fail(`camera ${document.id} serial number must be uppercase`);
  }
  const username = boundedString(document, 'username', 4, 32);
  const password = boundedString(document, 'password', 12, 30);
  const macAddress = requiredString(document, 'macAddress');
  if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(macAddress)) {
    fail(`camera ${document.id} has an invalid MAC address`);
  }
  if (cameraSerialNumbers.has(cameraSerialNumber)) {
    fail(`duplicate camera serial number ${cameraSerialNumber}`);
  }
  cameraSerialNumbers.add(cameraSerialNumber);
  const normalizedMacAddress = macAddress.toUpperCase();
  if (cameraMacAddresses.has(normalizedMacAddress)) {
    fail(`duplicate camera MAC address ${macAddress}`);
  }
  cameraMacAddresses.add(normalizedMacAddress);
  if (!Number.isInteger(document.port) || document.port < 1 || document.port > 65535) {
    fail(`camera ${document.id} has an invalid port`);
  }
  if (!document.streams || typeof document.streams !== 'object') {
    fail(`camera ${document.id} has invalid streams`);
  }
  if (typeof document.hasPtz !== 'boolean' || typeof document.hasAudio !== 'boolean') {
    fail(`camera ${document.id} has invalid capabilities`);
  }

  const serialCollision = db.cameras.findOne({
    nvrId,
    serialNumber: cameraSerialNumber,
    id: { $ne: document.id },
  });
  if (serialCollision) fail(`camera serial number collision for ${document.id}`);
  const macCollision = db.cameras.findOne({
    nvrId,
    macAddress,
    id: { $ne: document.id },
  });
  if (macCollision) fail(`camera MAC address collision for ${document.id}`);

  return {
    updateOne: {
      filter: { id: document.id, tenantId, nvrId },
      update: {
        $set: {
          tenantId,
          nvrId,
          name,
          productModel,
          serialNumber: cameraSerialNumber,
          username,
          password,
          macAddress,
          port: document.port,
          streams: document.streams,
          hasPtz: document.hasPtz,
          hasAudio: document.hasAudio,
          isActive: optionalBoolean(document, 'isActive', false),
          isDeleted: optionalBoolean(document, 'isDeleted', false),
          liveSignalStatus: 2,
          runningConfigs: { init: '-1' },
          updatedAt: new Date(),
        },
        $setOnInsert: { id: document.id, createdAt: new Date() },
      },
      upsert: true,
    },
  };
});

const pageWrites = pageDocuments.map((document) => {
  if (!isUuid(document.id)) fail('page id must be a UUID v4');
  if (pageIds.has(document.id)) fail(`duplicate page id ${document.id}`);
  pageIds.add(document.id);
  const backupNvrId = document.nvrId ?? document.gatewayId;
  if (backupNvrId !== undefined && backupNvrId !== nvrId) {
    fail(`page ${document.id} belongs to another NVR`);
  }
  const existing = db.pages.findOne({ id: document.id });
  if (existing && existing.nvrId !== nvrId) {
    fail(`page ${document.id} collides with another NVR`);
  }
  const name = boundedString(document, 'name', 1, 60);
  if (document.type !== 'widget') fail(`page ${document.id} has invalid type`);
  if (!Number.isInteger(document.pageIndex) || document.pageIndex < 0) {
    fail(`page ${document.id} has invalid pageIndex`);
  }
  if (!Array.isArray(document.content)) {
    fail(`page ${document.id} has invalid content`);
  }
  for (const widget of document.content) {
    if (!widget || typeof widget !== 'object' || !isUuid(widget.id)) {
      fail(`page ${document.id} has invalid widget content`);
    }
    if (
      !cameraIds.has(widget.id) &&
      !db.cameras.findOne({ id: widget.id, tenantId, nvrId })
    ) {
      fail(`page ${document.id} references a camera outside this NVR`);
    }
  }

  return {
    updateOne: {
      filter: { id: document.id, nvrId },
      update: {
        $set: {
          nvrId,
          name,
          type: document.type,
          pageIndex: document.pageIndex,
          content: document.content,
          runningConfigs: { init: '-1' },
          updatedAt: new Date(),
        },
        $setOnInsert: { id: document.id, createdAt: new Date() },
      },
      upsert: true,
    },
  };
});

const result = {
  completed: false,
  nvrIds: [nvrId],
  cameraIds: cameraDocuments.map((document) => document.id),
  pageIds: pageDocuments.map((document) => document.id),
};
fs.writeFileSync(resultFile, JSON.stringify(result));

if (nvrDocument) {
  const update = { updatedAt: new Date() };
  if (nvrDocument.name !== undefined) update.name = nvrDocument.name;
  if (nvrDocument.password !== undefined) update.password = nvrDocument.password;
  if (nvrDocument.lang !== undefined) update.lang = nvrDocument.lang;
  const nvrResult = db.nvrs.updateOne(
    { id: nvrId, tenantId, serialNumber },
    { $set: update },
  );
  if (nvrResult.matchedCount !== 1) fail('authenticated NVR changed during restore');
}
if (cameraWrites.length) db.cameras.bulkWrite(cameraWrites, { ordered: true });
if (pageWrites.length) db.pages.bulkWrite(pageWrites, { ordered: true });

result.completed = true;
fs.writeFileSync(resultFile, JSON.stringify(result));
print(`Scoped Fog restore completed: ${cameraWrites.length} cameras, ${pageWrites.length} pages`);
EOF

if ! command -v mongosh >/dev/null 2>&1; then
  echo "ERROR: mongosh is required for scoped Fog restore" >&2
  exit 1
fi

mongosh --nodb --quiet --file "$IMPORT_SCRIPT"
