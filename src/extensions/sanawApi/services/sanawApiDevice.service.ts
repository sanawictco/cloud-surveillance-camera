import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import AppConfig from 'configs/app.config';
import { AllDevicesAutoScanInformationReqDto } from '../dtos/devices/request/allDevicesAutoScanInformationReq.dto';
import { AutoScanAllDevicesInformationResDto } from '../dtos/devices/response/allDevicesAutoScanInformation.response.dto';
import { SanawApiHeader } from '../dtos/sanawApi.header';
import { GatewayAutoRegisterInformationResponseDto } from '../dtos/devices/response/gatewayAutoRegisterInformation.response.dto';
import { GatewayAutoScanInformationResponseDto } from '../dtos/devices/response/gatewayAutoScanInformation.response.dto';
@Injectable()
export class SanawApiDeviceService {
  async getAutoScanInformationOfGateway(
    serialNumber: string,
  ): Promise<GatewayAutoScanInformationResponseDto> {
    const url = `${
      AppConfig().sanawApiURL
    }/devices/manufacturedGateways/getAutoScanInformation`;

    try {
      const res = await axios.post(
        url,
        {
          serialNumber,
        },
        { headers: SanawApiHeader() },
      );
      // remove commands from communicationStructures
      for (const communicationStructure of res.data.communicationStructures) {
        delete communicationStructure.commands;
      }
      return {
        statusCode: 200,
        data: res.data,
      };
    } catch (err) {
      throw new BadRequestException(
        err.response?.data || AppConfig().internalServerError,
      );
    }
  }

  async getAutoRegisterInformationOfGateway(
    serialNumber: string,
    communicationStructureId: number,
  ): Promise<GatewayAutoRegisterInformationResponseDto> {
    const url = `${
      AppConfig().sanawApiURL
    }/devices/manufacturedGateways/getAutoRegisterInformation`;
    try {
      const res = await axios.post(
        url,
        {
          serialNumber,
          communicationStructureId,
        },
        { headers: SanawApiHeader() },
      );

      return {
        statusCode: 200,
        data: res.data,
      };
    } catch (err) {
      throw new BadRequestException(
        err.response?.data || AppConfig().internalServerError,
      );
    }
  }
  async useGateway(
    manufacturedGatewayId: number,
    gatewayId: string,
  ): Promise<void> {
    const url = `${AppConfig().sanawApiURL}/devices/manufacturedGateways/use`;
    try {
      await axios.post(
        url,
        {
          manufacturedGatewayId,
          workspaceUrl: AppConfig().workspaceUrl,
          gatewayIdInWorkspace: gatewayId,
        },
        { headers: SanawApiHeader() },
      );
    } catch (err) {
      throw new BadRequestException(
        err.response?.data || AppConfig().internalServerError,
      );
    }
  }

  async unUseGateway(manufacturedGatewayId: number): Promise<void> {
    const url = `${AppConfig().sanawApiURL}/devices/manufacturedGateways/unUse`;
    try {
      await axios.post(
        url,
        {
          manufacturedGatewayId,
        },
        { headers: SanawApiHeader() },
      );
    } catch (err) {
      throw new BadRequestException(
        err.response?.data || AppConfig().internalServerError,
      );
    }
  }

  async getAutoScanInformationOfAllDevices(
    reqData: AllDevicesAutoScanInformationReqDto,
  ): Promise<AutoScanAllDevicesInformationResDto> {
    const url = `${
      AppConfig().sanawApiURL
    }/devices/manufacturedGateways/getAutoScanAllDevicesInformation`;

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
        err.response?.data || AppConfig().internalServerError,
      );
    }
  }
}
