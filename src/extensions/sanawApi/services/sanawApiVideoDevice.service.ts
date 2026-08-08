import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import AppConfig from 'configs/app.config';
import { AllDevicesAutoScanInformationReqDto } from '../dtos/devices/request/allDevicesAutoScanInformationReq.dto';
import { AutoScanAllCamerasInformationResDto } from '../dtos/devices/response/allDevicesAutoScanInformation.response.dto';
import { SanawApiHeader } from '../dtos/sanawApi.header';
import { NvrAutoScanInformationResponseDto } from '../dtos/devices/response/nvrAutoScanInformation.response.dto';

@Injectable()
export class SanawApiVideoDeviceService {
  async getAutoScanInformationOfNvr(
    serialNumber: string,
  ): Promise<NvrAutoScanInformationResponseDto> {
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

  async getAutoRegisterInformationOfNvr(
    serialNumber: string,
    _communicationStructureId: number,
  ): Promise<NvrAutoScanInformationResponseDto> {
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
    workstationId: string,
  ): Promise<void> {
    const url = `${AppConfig().sanawApiURL}/video-devices/manufactured-nvrs/use`;
    try {
      await axios.post(
        url,
        {
          serialNumber,
          workstationId,
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

  async getAutoScanInformationOfAllCameras(
    reqData: AllDevicesAutoScanInformationReqDto,
  ): Promise<AutoScanAllCamerasInformationResDto> {
    const url = `${
      AppConfig().sanawApiURL
    }/video-devices/manufactured-nvrs/get-auto-scan-all-cameras-information`;

    try {
      const res = await axios.post(
        url,
        {
          autoScanReqObjects: reqData.autoScanReqObjects,
        },
        { headers: SanawApiHeader() },
      );
      return {
        statusCode: 200,
        data: res.data,
      };
    } catch (err) {
      console.log(err);
      throw new BadRequestException(
        axios.isAxiosError(err) && err.response?.data
          ? err.response.data
          : AppConfig().internalServerError,
      );
    }
  }
}
