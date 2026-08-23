import { CameraEntity } from '../../../domain/camera/camera.entity';
import { StreamsProps } from '../../../domain/camera/valueObjects/streams.vo';
import { NvrEntity } from '../../../domain/nvr/nvr.entity';
import { LanguageCode } from 'src/extensions/translation/languageCode.enum';
import { BusinessId } from 'src/dddLib/core/businessId.vo';
import { Name } from 'src/modules/shared/valueObjects/name.vo';
import { RunningConfigs } from 'src/modules/shared/valueObjects/runningConfigs.vo';
import { AccessToken } from '../../../domain/nvr/valueObjects/accessToken.vo';
import { CloudIsRecovering } from '../../../domain/nvr/valueObjects/cloudIsRecovering.vo';
import { NvrLanguage } from '../../../domain/nvr/valueObjects/NvrLanguage.vo';
import { NvrPassword } from '../../../domain/nvr/valueObjects/nvrPassword.vo';
import { MaxCameras } from '../../../domain/nvr/valueObjects/maxCameras.vo';
import { IsActive } from '../../../shared/valueObjects/isActive.vo';
import { LiveSignalStatus } from '../../../shared/valueObjects/liveSignalStatus.vo';
import { SerialNumber } from '../../../shared/valueObjects/serialNumber.vo';

const cameraTenantId = 'de10d17b-2ee1-4ac0-868d-e76b2f3ad3c7';
const nvrId = 'ac8f1783-b9c1-45a6-b321-f17a98554736';

function createCamera(): CameraEntity {
  return CameraEntity.create({
    id: '33d23fa6-59b6-476d-a45a-4fdf2bbc1d81',
    tenantId: cameraTenantId,
    nvrId,
    name: 'Lobby camera',
    productModel: 'Model 1',
    serialNumber: 'CAMERA01',
    username: 'admin',
    password: 'valid-password',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    port: 554,
    streams: {
      recordStream: { token: 'record', path: '/record', resolutions: [] },
      liveStream: { token: 'live', path: '/live', resolutions: [] },
    } as StreamsProps,
    hasPtz: true,
    hasAudio: true,
  });
}

function createNvr(tenantId: string): NvrEntity {
  return new NvrEntity({
    id: nvrId,
    props: {
      tenantId: new BusinessId(tenantId),
      name: new Name('Main NVR'),
      serialNumber: new SerialNumber('NVRTEST1'),
      accessToken: new AccessToken('a'.repeat(32)),
      password: new NvrPassword('valid-password'),
      maxCameras: new MaxCameras(16),
      lang: new NvrLanguage(LanguageCode.FA),
      isActive: IsActive.init(),
      liveSignalStatus: LiveSignalStatus.init(),
      cloudIsRecovering: CloudIsRecovering.init(),
      runningConfigs: RunningConfigs.init(),
    },
  });
}

describe('CameraEntity tenant ownership', () => {
  it('starts as not deleted', () => {
    const camera = createCamera();

    expect(camera.getProps().isDeleted).toBe(false);
  });

  it('marks the camera deleted and resets its operational state', () => {
    const camera = createCamera();
    camera.active();
    camera.update({ runningConfigs: { update: 'update-msg' } });

    camera.softDelete();

    expect(camera.getProps()).toEqual(
      expect.objectContaining({
        isDeleted: true,
        isActive: false,
        runningConfigs: { init: '-1' },
      }),
    );
  });

  it('can restore a soft-deleted camera for auto-registration', () => {
    const camera = createCamera();
    camera.softDelete();

    camera.update({
      tenantId: '11705ad5-9e70-4930-8680-7cc593687049',
      nvrId: '22222222-2222-4222-8222-222222222222',
      isDeleted: false,
    });

    expect(camera.getProps()).toEqual(
      expect.objectContaining({
        tenantId: '11705ad5-9e70-4930-8680-7cc593687049',
        nvrId: '22222222-2222-4222-8222-222222222222',
        isDeleted: false,
      }),
    );
  });

  it('accepts an NVR from the same tenant', () => {
    const camera = createCamera();
    const nvr = createNvr(cameraTenantId);

    expect(() => camera.assertTenantMatches(nvr)).not.toThrow();
  });

  it('rejects an NVR from a different tenant', () => {
    const camera = createCamera();
    const nvr = createNvr('11705ad5-9e70-4930-8680-7cc593687049');

    expect(() => camera.assertTenantMatches(nvr)).toThrow(
      'Camera and NVR must belong to the same tenant',
    );
  });

  it('omits credentials and connection secrets from creation events', () => {
    const camera = createCamera();

    expect(camera.getProps().username).toBe('admin');
    expect(camera.getProps().password).toBe('valid-password');
    expect(JSON.stringify(camera.domainEvents)).not.toMatch(
      /admin|valid-password|AA:BB:CC:DD:EE:FF|record|live|username|password|macAddress|streams|port/,
    );
  });
});
