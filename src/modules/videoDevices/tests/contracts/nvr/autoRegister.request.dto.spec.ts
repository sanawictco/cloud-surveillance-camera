import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AutoRegisterRequestDto } from '../../../contracts/nvr/http/request/autoRegister.request.dto';

describe('AutoRegisterRequestDto', () => {
  it('accepts uppercase camera serial numbers', () => {
    const dto = plainToInstance(AutoRegisterRequestDto, {
      nvrId: '11111111-1111-4111-8111-111111111111',
      addedCameras: ['AB12CD34'],
      deletedCameras: [],
    });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects MAC addresses and duplicate serials', () => {
    const dto = plainToInstance(AutoRegisterRequestDto, {
      nvrId: '11111111-1111-4111-8111-111111111111',
      addedCameras: ['AA:BB:CC:DD:EE:FF', 'AA:BB:CC:DD:EE:FF'],
      deletedCameras: [],
    });
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });
});
