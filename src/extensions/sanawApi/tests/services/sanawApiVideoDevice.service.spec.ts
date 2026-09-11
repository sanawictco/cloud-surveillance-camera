import axios from 'axios';
import { SanawApiVideoDeviceService } from '../../services/sanawApiVideoDevice.service';

jest.mock('axios');
jest.mock('configs/app.config', () => ({
  __esModule: true,
  default: () => ({
    sanawApiURL: 'https://management.example.test',
    sanawApiKey: 'workspace-api-key',
    internalServerError: 'internal error',
  }),
}));

describe('SanawApiVideoDeviceService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts NVR search criteria in the request body', async () => {
    const service = new SanawApiVideoDeviceService();
    const nvrId = '11111111-1111-4111-8111-111111111111';
    const macAddresses = ['AA:BB:CC:DD:EE:FF'];
    jest.mocked(axios.post).mockResolvedValue({ data: { cameras: [] } });

    await service.getNvrCameraSearchInfo(nvrId, macAddresses);

    expect(axios.post).toHaveBeenCalledWith(
      'https://management.example.test/video-devices/manufactured-nvrs/search',
      { nvrId, macAddresses },
      { headers: { api_key: 'Workspace-workspace-api-key' } },
    );
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('gets NVR scan info with the serial number as a query param, using the gateway key', async () => {
    const service = new SanawApiVideoDeviceService();
    jest
      .mocked(axios.get)
      .mockResolvedValue({ data: { productModel: 'X', serialNumber: 'EC95U8LO' } });

    await service.scan('EC95U8LO');

    expect(axios.get).toHaveBeenCalledWith(
      'https://management.example.test/video-devices/manufactured-nvrs/scan',
      {
        params: { serialNumber: 'EC95U8LO' },
        headers: { api_key: 'Gateway-workspace-api-key' },
      },
    );
    expect(axios.post).not.toHaveBeenCalled();
  });
});
