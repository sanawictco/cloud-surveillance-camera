import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import AppConfig from 'configs/app.config';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ShutdownOrchestratorService } from './extensions/shutdown/shutdown.service';
import { setupSwaggerRegisteration } from './utilities/swaggerRegisteration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  if (AppConfig().environment !== 'production') {
    setupSwaggerRegisteration(app);
  }
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
  app.use(bodyParser.json({ limit: '5000mb' }));
  app.use(bodyParser.urlencoded({ limit: '5000mb', extended: true }));
  app.use(helmet());
  app.enableCors({ origin: true, credentials: true });
  app.use(cookieParser());

  const orchestrator = app.get(ShutdownOrchestratorService);
  let isShuttingDown = false;

  const closeApplication = async (reason: string, exitCode: number) => {
    const forceKill = setTimeout(() => {
      console.error(`[SHUTDOWN] Force-kill after 30s (${reason})`);
      process.exit(1);
    }, 30_000);
    forceKill.unref();

    try {
      await orchestrator.onApplicationShutdown(reason);
      await app.close();
    } catch (err) {
      console.error(`[SHUTDOWN] Error while handling ${reason}:`, err);
      exitCode = 1;
    } finally {
      (logger as any).logger?.flush?.();
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      clearTimeout(forceKill);
      process.exit(exitCode);
    }
  };

  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    await closeApplication(signal, 0);
  };

  const emergencyShutdown = async (reason: string, err: unknown) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.error(`\n[EMERGENCY] Unhandled ${reason}:`, err);
    await closeApplication(reason, 1);
  };

  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
  process.on(
    'uncaughtException',
    (err) => void emergencyShutdown('uncaughtException', err),
  );
  process.on(
    'unhandledRejection',
    (reason) => void emergencyShutdown('unhandledRejection', reason),
  );

  await app.listen(AppConfig().port);
  logger.log(`Application listening on port ${AppConfig().port}`);
}

bootstrap().catch((err) => {
  console.error('Bootstrap error:', err);
  process.exit(1);
});
