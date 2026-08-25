import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PageMqttRequestDto } from 'src/modules/dashboard/contracts/page.mqttRequest.dto';
import { FogVideoDeviceConfigRequestDto } from '../../contracts/nvr/http/request/fogConfig.request.dto';
import { NvrLifecycleMqttResponseDto } from '../../contracts/nvr/mqtt/videoDeviceConfigResponse.dto';

describe('Device msgId DTOs', () => {
  function errorsFor<T extends object>(type: new () => T, value: object) {
    return validateSync(plainToInstance(type, value));
  }

  it.each(['1', '101', '4294967295'])(
    'accepts canonical uint32 string %s',
    (msgId) => {
      expect(
        errorsFor(FogVideoDeviceConfigRequestDto, {
          serialNumber: 'NVR00001',
          accessToken: '1'.repeat(32),
          msgId,
          configType: 'videoDevice',
        }),
      ).toHaveLength(0);
      expect(errorsFor(NvrLifecycleMqttResponseDto, { msgId })).toHaveLength(0);
      expect(errorsFor(PageMqttRequestDto, { msgId })).toHaveLength(0);
    },
  );

  it.each([101, '0', '01', '-1', '1.5', '4294967296', ' 1', ''])(
    'rejects noncanonical msgId %s',
    (msgId) => {
      expect(
        errorsFor(NvrLifecycleMqttResponseDto, { msgId }),
      ).not.toHaveLength(0);
      expect(errorsFor(PageMqttRequestDto, { msgId })).not.toHaveLength(0);
    },
  );
});
