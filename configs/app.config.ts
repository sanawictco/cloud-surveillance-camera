import * as env from 'env-var';
import { v4 as uuidv4 } from 'uuid';

// MQTT client id: unique per process (`sanaw-<uuid>`). Stable across mqtt.js
// reconnects (it reuses the initial connect options) and regenerated only on
// process restart — safe with clean:true (no persistent broker session).
const mqttClientId = `sanaw-${uuidv4()}`;

const AppConfig = () => {
  // Helper functions
  const getEnvString = (key: string) => env.get(key).required().asString();
  const getEnvPort = (key: string) => env.get(key).required().asPortNumber();
  const getEnvUrl = (key: string) => env.get(key).required().asUrlString();
  const getEnvFloat = (key: string) =>
    env.get(key).required().asFloatPositive();

  // Resolved early because it gates how strictly DB/cache auth is enforced:
  // production fails fast on missing credentials, non-production allows no-auth.
  const environment = getEnvString('NODE_ENV');
  const isProduction = environment === 'production';

  // MongoDB configuration
  const mongoHost = getEnvString('MONGO_DB_HOST');
  const mongoPort = getEnvPort('MONGO_DB_PORT');
  const mongoDbName = getEnvString('MONGO_DB_NAME');
  // Auth is required in production: credentials are URL-encoded and the root user
  // lives in the `admin` DB (created by Mongo's MONGO_INITDB_ROOT_* on a fresh
  // volume). Outside production it is optional — when username/password are absent
  // the URL omits credentials entirely so the driver skips SCRAM, matching a
  // no-auth local mongod (which rejects supplied-but-unknown credentials).
  const mongoUser = isProduction
    ? getEnvString('MONGO_DB_USERNAME')
    : env.get('MONGO_DB_USERNAME').asString();
  const mongoPassword = isProduction
    ? getEnvString('MONGO_DB_PASSWORD')
    : env.get('MONGO_DB_PASSWORD').asString();
  const mongoAuthSource = env
    .get('MONGO_DB_AUTH_SOURCE')
    .default('admin')
    .asString();
  const mongoUserInfo =
    mongoUser && mongoPassword
      ? `${encodeURIComponent(mongoUser)}:${encodeURIComponent(mongoPassword)}@`
      : '';
  const mongoAuthQuery =
    mongoUser && mongoPassword ? `?authSource=${mongoAuthSource}` : '';
  const mongoUrl = `mongodb://${mongoUserInfo}${mongoHost}:${mongoPort}/${mongoDbName}${mongoAuthQuery}`;

  // Time Series DB configuration
  const tsdbHost = getEnvString('TIME_SERIES_DB_HOST');
  const tsdbRestPort = getEnvPort('TIME_SERIES_DB_REST_PORT');
  const tsdbUser = getEnvString('TIME_SERIES_DB_USER');
  const tsdbPassword = getEnvString('TIME_SERIES_DB_PASSWORD');
  const tsdbName = getEnvString('TIME_SERIES_DB_NAME');
  const tsdbWsUrl = `ws://${tsdbHost}:${tsdbRestPort}`;
  const tsdbRestUrl = `http://${tsdbHost}:${tsdbRestPort}/rest/sql/${tsdbName}`;

  const tsdbCredentials = `${tsdbUser}:${tsdbPassword}`;
  const tsdbEncodedCredentials =
    Buffer.from(tsdbCredentials).toString('base64');
  const tsdbToken = `Basic ${tsdbEncodedCredentials}`;

  const workspaceUrl = getEnvUrl('WORKSPACE_URL').replace(/\/+$/, '');
  const corsAllowedOrigins =
    environment === 'production'
      ? env.get('CORS_ORIGINS').required().asArray(',')
      : env.get('CORS_ORIGINS').asArray(',');
  const configuredApiNodeAllowedHosts = env
    .get('API_NODE_ALLOWED_HOSTS')
    .default('*')
    .asString()
    .split(',')
    .map((host) => host.trim().toLowerCase().replace(/\.$/, ''))
    .filter(Boolean);

  return {
    environment,
    port: getEnvPort('NODE_PORT'),
    workspaceUrl,
    networkDelayInSecond: getEnvFloat('NETWORK_DELAY_IN_SECOND'),
    sanawApiKey: getEnvString('SANAW_API_KEY'),
    sanawApiURL: getEnvString('SANAW_API_URL'),
    internalServerError: getEnvString('INTERNAL_SERVER_ERROR_MESSAGE'),

    apiNodeProxy: {
      allowedHosts:
        configuredApiNodeAllowedHosts.length > 0
          ? configuredApiNodeAllowedHosts
          : ['*'],
    },

    cors: {
      allowedOrigins: corsAllowedOrigins,
    },

    keycloak: {
      clientId: getEnvString('KEYCLOAK_CLIENT_ID'),
      authClientId: getEnvString('KEYCLOAK_AUTH_CLIENT_ID'),
      authClientSecret: getEnvString('KEYCLOAK_AUTH_CLIENT_SECRET'),
      realm: getEnvString('KEYCLOAK_REALM'),
      authServer: getEnvString('KEYCLOAK_AUTH_SERVER'),
    },

    mongodb: {
      url: mongoUrl,
    },

    timeseriesDb: {
      wsUrl: tsdbWsUrl,
      user: tsdbUser,
      password: tsdbPassword,
      dbName: tsdbName,
      restUrl: tsdbRestUrl,
      token: tsdbToken,
    },

    redis: {
      host: env.get('REDIS_HOST').required().asString(),
      port: env.get('REDIS_PORT').required().asPortNumber(),
      db: env.get('REDIS_DB').default('1').asIntPositive(),
      // Required in production; optional otherwise. undefined == no AUTH (ioredis
      // skips it), matching a no-auth local Redis (`default` user, no requirepass).
      password: isProduction
        ? getEnvString('REDIS_PASSWORD')
        : env.get('REDIS_PASSWORD').asString() || undefined,
    },

    mqtt: {
      server: {
        host: getEnvString('MQTT_HOST'),
        port: getEnvPort('MQTT_PORT'),
        username: getEnvString('MQTT_USERNAME'),
        password: getEnvString('MQTT_PASSWORD'),
        clientId: mqttClientId,
        clean: true,
        keepalive: 20,
      },
      api: {
        apiUrl: getEnvUrl('MQTT_REST_API_URL'),
        apiKey: getEnvString('MQTT_REST_API_KEY'),
        apiSecret: getEnvString('MQTT_REST_API_SECRET'),
      },
    },
    swagger: {
      title: env
        .get('SWAGGER_TITLE')
        .default('sanaw cloud surveillance camera backend API')
        .asString(),
      version: env.get('SWAGGER_VERSION').default('1.0.0').asString(),
      basePath: env.get('SWAGGER_BASE_PATH').default('api').asString(),
      description: env
        .get('SWAGGER_DESCRIPTION')
        .default(
          'API documentation for sanaw cloud surveillance camera backend',
        )
        .asString(),
      tag: env
        .get('SWAGGER_TAG')
        .default('cloud-surveillance-camera')
        .asString(),
    },
  };
};

export default AppConfig;
