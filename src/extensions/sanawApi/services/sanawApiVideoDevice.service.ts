import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import AppConfig from 'configs/app.config';
import { AutoScanAllCamerasInformationResDto } from '../dtos/devices/response/allDevicesAutoScanInformation.response.dto';
import { SanawApiHeader } from '../dtos/sanawApi.header';
import { NvrScanInfoResponseDto } from '../dtos/devices/response/nvrScanInfo.response.dto';
import { NvrRegisterInfoResponseDto } from '../dtos/devices/response/nvrRegisterInfo.response.dto';

@Injectable()
export class SanawApiVideoDeviceService {
  async scan(serialNumber: string): Promise<NvrScanInfoResponseDto> {
    const url = `${
      AppConfig().sanawApiURL
    }/video-devices/manufactured-nvrs/get-auto-scan-information`;

    try {
      const res = await axios.post(
        url,
        {
          serialNumber,
        },
        { headers: SanawApiHeader() },
      );
      return {
        statusCode: 200,
        data: res.data,
      };
    } catch (err) {
      throw new BadRequestException(
        axios.isAxiosError(err) && err.response?.data
          ? err.response.data
          : AppConfig().internalServerError,
      );
    }
  }

  async registerNvr(serialNumber: string): Promise<NvrRegisterInfoResponseDto> {
    const url = `${
      AppConfig().sanawApiURL
    }/video-devices/manufactured-nvrs/get-auto-register-information`;
    try {
      const res = await axios.post(
        url,
        {
          serialNumber,
        },
        { headers: SanawApiHeader() },
      );

      return {
        statusCode: 200,
        data: res.data,
      };
    } catch (err) {
      throw new BadRequestException(
        axios.isAxiosError(err) && err.response?.data
          ? err.response.data
          : AppConfig().internalServerError,
      );
    }
  }
  async useNvr(
    serialNumber: string,
    nvrId: string,
    tenantId: string,
  ): Promise<void> {
    const url = `${AppConfig().sanawApiURL}/video-devices/manufactured-nvrs/use`;
    try {
      await axios.post(
        url,
        {
          serialNumber,
          workstationId: tenantId,
          nvrIdInWorkstation: nvrId,
        },
        { headers: SanawApiHeader() },
      );
    } catch (err) {
      throw new BadRequestException(
        axios.isAxiosError(err) && err.response?.data
          ? err.response.data
          : AppConfig().internalServerError,
      );
    }
  }

  async unUseNvr(serialNumber: string): Promise<void> {
    const url = `${AppConfig().sanawApiURL}/video-devices/manufactured-nvrs/un-use`;
    try {
      await axios.post(
        url,
        {
          serialNumber,
        },
        { headers: SanawApiHeader() },
      );
    } catch (err) {
      throw new BadRequestException(
        axios.isAxiosError(err) && err.response?.data
          ? err.response.data
          : AppConfig().internalServerError,
      );
    }
  }

  async getNvrCameraSearchInfo(
    nvrId: string,
    macAddresses: string[],
  ): Promise<AutoScanAllCamerasInformationResDto> {
    const url = `${AppConfig().sanawApiURL}/video-devices/manufactured-nvrs/search`;

    try {
      const res = await axios.post(
        url,
        { nvrId, macAddresses },
        { headers: SanawApiHeader() },
      );
      return {
        statusCode: 200,
        data: res.data,
      };
    } catch (err) {
      throw new BadRequestException(
        axios.isAxiosError(err) && err.response?.data
          ? err.response.data
          : AppConfig().internalServerError,
      );
    }
  }
}
