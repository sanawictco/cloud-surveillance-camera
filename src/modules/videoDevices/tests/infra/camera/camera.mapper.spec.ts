import { CameraMapper } from '../../../infra/camera/camera.mapper';
import { CameraEntity } from '../../../domain/camera/camera.entity';

describe('CameraMapper', () => {
  it('keeps private connection data in persistence but omits it from public responses', () => {
    const entity = CameraEntity.create({
      id: '22222222-2222-4222-8222-222222222222',
      tenantId: '11111111-1111-4111-8111-111111111111',
      nvrId: '33333333-3333-4333-8333-333333333333',
      name: 'Camera',
      productModel: 'CAM-1',
      serialNumber: 'CAM00001',
      username: 'private-user',
      password: 'private-password',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      port: 554,
      streams: {
        recordStream: {
          token: 'record-token',
          path: '/record',
          resolutions: [],
        },
        liveStream: { token: 'live-token', path: '/live', resolutions: [] },
      },
      hasPtz: true,
      hasAudio: false,
    });
    const mapper = new CameraMapper();

    const persistence = mapper.toPersistence(entity);
    const response = mapper.toResponse(entity);

    expect(persistence.username).toBe('private-user');
    expect(persistence.password).toBe('private-password');
    expect(persistence.streams.recordStream.token).toBe('record-token');
    expect(JSON.stringify(response)).not.toMatch(
      /private-user|private-password|AA:BB:CC:DD:EE:FF|record-token|live-token|macAddress|streams|port/,
    );
  });
});
