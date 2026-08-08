import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { EmployeeRoles } from '../dtos/employees/employeeRoles.enum';
import AppConfig from 'configs/app.config';
import axios from 'axios';
import { SanawApiHeader } from '../dtos/sanawApi.header';
import {
  SanawApiAddEmployeeResponseDto,
  SanawApiFindAllEmployeesResponseDto,
  SanawApiFindOneEmployeeResponseDto,
  SanawApiUpdateRoleEmployeeResponseDto,
} from '../dtos/employees/sanawApiEmployee.response';
@Injectable()
export class SanawApiEmployeeService {
  constructor() {}
  async findAll(
    userIds: string[],
  ): Promise<SanawApiFindAllEmployeesResponseDto> {
    const url = `${AppConfig().sanawApiURL}/employees/findAll`;
    try {
      const res = await axios.post(
        url,
        {
          userIds,
        },
        { headers: SanawApiHeader() },
      );
      return {
        statusCode: 200,
        data: res.data,
      };
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400)
        throw new BadRequestException(err.response.data);
      else {
        console.log('---------ApiWorkspaces is not avaiable---------');
        console.log(err);
        throw new InternalServerErrorException(AppConfig().internalServerError);
      }
    }
  }
  async find(phoneNumber: string): Promise<SanawApiFindOneEmployeeResponseDto> {
    const url = `${AppConfig().sanawApiURL}/employees/find/${phoneNumber}`;
    try {
      const res = await axios.get(url, { headers: SanawApiHeader() });
      return {
        statusCode: 200,
        data: res.data,
      };
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400)
        throw new BadRequestException(err.response.data);
      else
        throw new InternalServerErrorException(AppConfig().internalServerError);
    }
  }
  async updateRoles(
    userId: string,
    roles: EmployeeRoles[],
    operatorUserId: string,
  ): Promise<SanawApiUpdateRoleEmployeeResponseDto> {
    const url = `${AppConfig().sanawApiURL}/employees/updateRoles/${userId}`;
    try {
      const res = await axios.put(
        url,
        {
          operatorUserId,
          newRoles: roles,
        },
        { headers: SanawApiHeader() },
      );
      return {
        statusCode: 200,
        data: res.data,
      };
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400)
        throw new BadRequestException(err.response.data);
      else
        throw new InternalServerErrorException(AppConfig().internalServerError);
    }
  }
  async add(
    phoneNumber: string,
    roles: EmployeeRoles[],
  ): Promise<SanawApiAddEmployeeResponseDto> {
    const url = `${AppConfig().sanawApiURL}/employees/add`;
    try {
      const res = await axios.post(
        url,
        {
          phoneNumber,
          roles,
        },
        { headers: SanawApiHeader() },
      );
      return {
        statusCode: 200,
        data: res.data,
      };
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400)
        throw new BadRequestException(err.response.data);
      else
        throw new InternalServerErrorException(AppConfig().internalServerError);
    }
  }
  async delete(userId: string): Promise<void> {
    const url = `${AppConfig().sanawApiURL}/employees/delete/${userId}`;
    try {
      await axios.delete(url, { headers: SanawApiHeader() });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400)
        throw new BadRequestException(err.response.data);
      else
        throw new InternalServerErrorException(AppConfig().internalServerError);
    }
  }
}
