import * as env from 'env-var';
const AppConfig = () => ({
  environment: env.get('NODE_ENV').required().asString(),
  port: env.get('NODE_PORT').required().asPortNumber(),
  workspaceUrl: env.get('WORKSPACE_URL').required().asUrlString(),
  sanawApiKey: env.get('SANAW_API_KEY').required().asString(),
  sanawApiURL: env.get('SANAW_API_URL').required().asString(),
  internalServerError: env
    .get('INTERNAL_SERVER_ERROR_MESSAGE')
    .required()
    .asString(),
  keycloak: {
    clientId: env.get('KEYCLOAK_CLIENT_ID').required().asString(),
    authClientId: env.get('KEYCLOAK_AUTH_CLIENT_ID').required().asString(),
    authClientSecret: env
      .get('KEYCLOAK_AUTH_CLIENT_SECRET')
      .required()
      .asString(),
    realm: env.get('KEYCLOAK_REALM').required().asString(),
    authServer: env.get('KEYCLOAK_AUTH_SERVER').required().asString(),
  },
  mongodb: {
    url: `mongodb://${env.get('MONGO_DB_HOST').required().asString()}:${env.get('MONGO_DB_PORT').required().asPortNumber()}/${env.get('MONGO_DB_NAME').asString()}`,
  },
  timeseriesDb: {
    wsUrl: `ws://${env.get('TIME_SERIES_DB_HOST').required().asString()}:${env.get('TIME_SERIES_DB_REST_PORT').required().asPortNumber()}`,
    user: env.get('TIME_SERIES_DB_USER').required().asString(),
    password: env.get('TIME_SERIES_DB_PASSWORD').required().asString(),
    dbName: env.get('TIME_SERIES_DB_NAME').required().asString(),
    restUrl: `http://${env.get('TIME_SERIES_DB_HOST').required().asString()}:${env.get('TIME_SERIES_DB_REST_PORT').required().asPortNumber()}/rest/sql/${env.get('TIME_SERIES_DB_NAME').required().asString()}`,
    token: `Basic ${Buffer.from(`${env.get('TIME_SERIES_DB_USER').required().asString()}:${env.get('TIME_SERIES_DB_PASSWORD').required().asString()}`).toString('base64')}`,
  },
  redis: {
    host: env.get('REDIS_HOST').required().asString(),
    port: env.get('REDIS_PORT').required().asPortNumber(),
  },
  mqtt: {
    server: {
      host: env.get('MQTT_HOST').required().asString(),
      port: env.get('MQTT_PORT').required().asPortNumber(),
      username: env.get('MQTT_USERNAME').required().asString(),
      password: env.get('MQTT_PASSWORD').required().asString(),
      clientId: env.get('WORKSPACE_URL').required().asUrlString(),
      clean: true,
      keepalive: 20,
    },
    api: {
      apiUrl: env.get('MQTT_REST_API_URL').required().asUrlString(),
      apiKey: env.get('MQTT_REST_API_KEY').required().asString(),
      apiSecret: env.get('MQTT_REST_API_SECRET').required().asString(),
    },
  },
  swagger: {
    title: env.get('SWAGGER_TITLE').required().asString(),
    version: env.get('SWAGGER_VERSION').required().asString(),
    basePath: env.get('SWAGGER_BASE_PATH').required().asString(),
    description: env.get('SWAGGER_DESCRIPTION').required().asString(),
    tag: env.get('SWAGGER_TAG').required().asString(),
  },
});
export default AppConfig;
