import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import AppConfig from 'configs/app.config';
import { AppModule } from './app.module';
import { setupSwaggerRegisteration } from './utilities/swaggerRegisteration';
import { ShutdownOrchestratorService } from './extensions/shutdown/shutdown.service';
import {
  assertNotTestEnvInProd,
  assertMqttProductionSecurity,
  assertRedisNoeviction,
} from './extensions/bootChecks/bootChecks';
import type { Redis } from 'ioredis';
import { CACHE_CLIENT } from './extensions/caching/diTokens/cache.diToken';
import { registerBodyParsers } from './utilities/bodyParserRegistration';

async function bootstrap() {
  assertNotTestEnvInProd();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  setupSwaggerRegisteration(app);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    }),
  );
  const logger = app.get(Logger);
  app.useLogger(logger);

  const isProduction = AppConfig().environment === 'production';
  const mqttConfig = AppConfig().mqtt;
  assertMqttProductionSecurity({
    brokerUrl: mqttConfig.server.host,
    apiUrl: mqttConfig.api.apiUrl,
    username: mqttConfig.server.username,
    password: mqttConfig.server.password,
  });
  try {
    const redis = app.get<Redis>(CACHE_CLIENT);
    await assertRedisNoeviction(redis, logger);
  } catch (e) {
    if (isProduction) throw e;
    logger.warn(
      `[bootChecks] Redis noeviction check skipped: ${(e as Error).message}`,
    );
  }

  registerBodyParsers(app);
  app.use(helmet());
  // In production, only the configured origins may make credentialed requests;
  // reflecting any origin (`origin: true`) with credentials is unsafe. Dev keeps
  // the open origin for local tooling.
  app.enableCors({
    origin: isProduction ? AppConfig().cors.allowedOrigins : true,
    credentials: true,
  });
  app.use(cookieParser());

  const orchestrator = app.get(ShutdownOrchestratorService);

  // Shared flag — prevents normal shutdown and emergency shutdown from racing each other
  let isShuttingDown = false;

  // ─── Graceful shutdown (SIGTERM / SIGINT) ────────────────────────────────
  // 1. Run our sequential orchestrator first (fully awaited, correct order)
  // 2. Let NestJS cleanup run — all onModuleDestroy are no-ops by this point
  //    because every service's _isShutDown flag is already true
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    // Watchdog: guarantee the process exits even if teardown hangs. Without
    // this, a rejecting orchestrator/app.close() would surface as an
    // unhandledRejection that emergencyShutdown swallows (isShuttingDown is
    // already true) — leaving the process hung with no fallback.
    const forceKill = setTimeout(() => {
      console.error('[SHUTDOWN] Force-kill after 30s timeout');
      process.exit(1);
    }, 30_000);
    forceKill.unref();

    let exitCode = 0;
    try {
      await orchestrator.onApplicationShutdown(signal);
      await app.close();
    } catch (err) {
      console.error('[SHUTDOWN] Error during graceful shutdown:', err);
      exitCode = 1;
    } finally {
      // Flush pino's buffer before exit — otherwise final logs are swallowed
      (logger as any).logger?.flush?.();
      await new Promise((resolve) => setTimeout(resolve, 100));
      clearTimeout(forceKill);
      process.exit(exitCode);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await app.listen(AppConfig().port);
  logger.log(`Application listening on port ${AppConfig().port}`);

  // ─── Emergency handlers ───────────────────────────────────────────────────
  // NOT for SIGTERM/SIGINT — those are owned above.
  // These catch truly unexpected crashes only.
  let isEmergencyShuttingDown = false;

  const emergencyShutdown = async (reason: string, err?: unknown) => {
    if (isEmergencyShuttingDown) return;
    isEmergencyShuttingDown = true;

    // If a normal signal shutdown is already running, don't race it
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.error(`\n[EMERGENCY] Unhandled ${reason}:`, err);

    // Force-kill fallback if app.close() hangs
    const forceKillTimeout = setTimeout(() => {
      console.error('[EMERGENCY] Force-kill after 30s timeout');
      process.exit(1);
    }, 30_000);
    forceKillTimeout.unref();

    try {
      // app.close() triggers OnApplicationShutdown → orchestrator runs
      // (orchestrator's _isShuttingDown guard makes it idempotent if already ran)
      await app.close();
    } catch (closeErr) {
      console.error('[EMERGENCY] Error during emergency shutdown:', closeErr);
    } finally {
      clearTimeout(forceKillTimeout);
      process.exit(1);
    }
  };

  process.on('uncaughtException', (err) =>
    emergencyShutdown('uncaughtException', err),
  );

  process.on('unhandledRejection', (reason) =>
    emergencyShutdown('unhandledRejection', reason),
  );
}

bootstrap().catch((err) => {
  console.error('Bootstrap error:', err);
  process.exit(1);
});
