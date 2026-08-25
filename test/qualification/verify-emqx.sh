#!/bin/bash
set -euo pipefail

container="${EMQX_CONTAINER_NAME:-emqx}"
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"

authorization="$(docker exec "$container" /opt/emqx/bin/emqx ctl conf show authorization)"
authentication="$(docker exec "$container" /opt/emqx/bin/emqx ctl conf show authentication)"
listeners="$(docker exec "$container" /opt/emqx/bin/emqx ctl conf show listeners)"

grep -q 'no_match = deny' <<<"$authorization"
grep -q 'type = built_in_database' <<<"$authorization"
grep -q 'enable = true' <<<"$authorization"
grep -q 'mechanism = password_based' <<<"$authentication"
grep -q 'backend = built_in_database' <<<"$authentication"

node - "$repo_root" <<'NODE'
const net = require('node:net');
const tls = require('node:tls');

// MQTT 3.1.1 CONNECT with clean-session and an empty client ID, no credentials.
const anonymousConnect = Buffer.from([
  0x10, 0x0c, 0x00, 0x04, 0x4d, 0x51, 0x54, 0x54,
  0x04, 0x02, 0x00, 0x0a, 0x00, 0x00,
]);

function expectAnonymousRejected(port, secure) {
  return new Promise((resolve, reject) => {
    let connected = false;
    let response = Buffer.alloc(0);
    const socket = secure
      ? tls.connect({ host: '127.0.0.1', port, rejectUnauthorized: false })
      : net.connect({ host: '127.0.0.1', port });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`anonymous MQTT check timed out on ${port}`));
    }, 8000);
    const onConnected = () => {
      connected = true;
      socket.write(anonymousConnect);
    };
    socket.once(secure ? 'secureConnect' : 'connect', onConnected);
    socket.on('data', (chunk) => {
      response = Buffer.concat([response, chunk]);
      if (response.length < 4) return;
      clearTimeout(timeout);
      socket.destroy();
      if (response[0] !== 0x20 || response[1] !== 0x02) {
        reject(new Error(`invalid CONNACK on ${port}`));
        return;
      }
      if (response[3] === 0) {
        reject(new Error(`anonymous connection was accepted on ${port}`));
        return;
      }
      resolve();
    });
    socket.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    socket.on('close', () => {
      if (response.length >= 4 || !connected) return;
      clearTimeout(timeout);
      resolve();
    });
  });
}

Promise.all([
  expectAnonymousRejected(1883, false),
  expectAnonymousRejected(8883, true),
]).then(() => {
  process.stdout.write('anonymous-rejection-qualified\n');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
NODE

node - "$listeners" <<'NODE'
const listeners = process.argv[2];
function block(name) {
  const start = listeners.indexOf(`  ${name} {`);
  if (start < 0) return '';
  let depth = 0;
  let opened = false;
  for (let index = start; index < listeners.length; index++) {
    if (listeners[index] === '{') {
      depth += 1;
      opened = true;
    } else if (listeners[index] === '}') {
      depth -= 1;
      if (opened && depth === 0) return listeners.slice(start, index + 1);
    }
  }
  return '';
}
const tcp = block('tcp');
const ssl = block('ssl');
const ws = block('ws');
const wss = block('wss');
if (!tcp.includes('enable_authn = true')) throw new Error('TCP authn is disabled');
if (!ssl.includes('enable_authn = true')) throw new Error('SSL authn is disabled');
if (!ssl.includes('tlsv1.3') || !ssl.includes('tlsv1.2')) {
  throw new Error('TLS 1.2/1.3 are not configured');
}
if (!ws.includes('enable = false')) throw new Error('WS listener is enabled');
if (!wss.includes('enable = false')) throw new Error('WSS listener is enabled');
NODE

printf '%s\n' '{"qualified":true,"denyByDefault":true,"authentication":true,"anonymousRejected":true,"tls":true,"wsDisabled":true}'
