import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { FogCommunicationHttpController } from 'src/modules/videoDevices/controllers/fogCommunication.http.controller';
import { FogCommunicationManagerController } from '../fogCommunicationManager.controller';

describe('Fog communication routes', () => {
  function getPostRoutes(controller: object): string[] {
    const prototype = Object.getPrototypeOf(controller) as object;
    return Object.getOwnPropertyNames(prototype).flatMap((methodName) => {
      if (methodName === 'constructor') return [];
      const handler = (prototype as Record<string, unknown>)[methodName];
      if (
        typeof handler !== 'function' ||
        Reflect.getMetadata(METHOD_METADATA, handler) !== RequestMethod.POST
      ) {
        return [];
      }
      return [Reflect.getMetadata(PATH_METADATA, handler) as string];
    });
  }

  it('registers one config route and one scoped restore route', () => {
    const routes = [
      ...getPostRoutes(new FogCommunicationManagerController({} as never)),
      ...getPostRoutes(new FogCommunicationHttpController({} as never)),
    ];

    expect(routes.filter((route) => route === '/configs')).toHaveLength(1);
    expect(
      routes.filter((route) => route === '/restore-fog-backup-to-cloud'),
    ).toHaveLength(1);
  });
});
