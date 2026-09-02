import { BadRequestException, Injectable } from '@nestjs/common';
import { SanawApiEmployeeDto } from 'src/extensions/sanawApi/dtos/employees/sanawApiEmployee.response';
import { SanawApiEmployeeService } from 'src/extensions/sanawApi/services/sanawApiEmployee.service';
import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';
import { AddEmployeeRequestDto } from 'src/modules/tenantAccess/contracts/employee/addEmployee.request.dto';
import { EmployeeResponseDto } from 'src/modules/tenantAccess/contracts/employee/employee.response.dto';
import { FindEmployeeRequestDto } from 'src/modules/tenantAccess/contracts/employee/findEmployee.request.dto';
import { UpdateEmployeeRolesRequestDto } from 'src/modules/tenantAccess/contracts/employee/updateEmployeeRoles.request.dto';
import { EmployeeModel } from 'src/modules/tenantAccess/infra/schemas/employee.schema';
import { TenantAccessService } from './tenantAccess.service';

@Injectable()
export class EmployeeAccessHttpService {
  constructor(
    private readonly tenantAccessService: TenantAccessService,
    private readonly sanawApiEmployeeService: SanawApiEmployeeService,
  ) {}

  async findAll(): Promise<EmployeeResponseDto[]> {
    const tenantId = UserInfoService.requireTenantId();
    const employees =
      await this.tenantAccessService.findEmployeesForTenant(tenantId);
    return this.toResponses(tenantId, employees);
  }

  async getSoftDeletedEmployees(): Promise<EmployeeResponseDto[]> {
    const tenantId = UserInfoService.requireTenantId();
    const employees = await this.tenantAccessService.findEmployeesForTenant(
      tenantId,
      true,
    );
    return this.toResponses(
      tenantId,
      employees.filter((employee) => employee.isDeleted),
    );
  }

  async findByPhoneNumber(
    param: FindEmployeeRequestDto,
  ): Promise<SanawApiEmployeeDto> {
    const tenantId = UserInfoService.requireTenantId();
    const result = await this.sanawApiEmployeeService.find(param.phoneNumber);
    const employee = await this.tenantAccessService.findEmployeeForUser(
      tenantId,
      result.data.userId,
    );
    if (employee && !employee.isDeleted) {
      throw new BadRequestException('user is already an employee');
    }
    if (employee?.isDeleted) {
      throw new BadRequestException('removed employee must be recovered');
    }
    return result.data;
  }

  async add(
    body: AddEmployeeRequestDto,
  ): Promise<{ data: EmployeeResponseDto; message: string }> {
    const tenantId = UserInfoService.requireTenantId();
    const identity = await this.findOrCreateIdentity(body.phoneNumber);
    const existing = await this.tenantAccessService.findEmployeeForUser(
      tenantId,
      identity.userId,
    );
    if (existing && !existing.isDeleted) {
      throw new BadRequestException('user is already an employee');
    }
    if (existing?.isDeleted) {
      throw new BadRequestException('removed employee must be recovered');
    }
    const employee = await this.tenantAccessService.createEmployee(
      tenantId,
      identity.userId,
      body.roles,
    );
    return {
      data: await this.toResponse(tenantId, employee, identity),
      message: 'employee added',
    };
  }

  async updateRoles(
    employeeId: string,
    body: UpdateEmployeeRolesRequestDto,
  ): Promise<{ data: EmployeeResponseDto; message: string }> {
    const tenantId = UserInfoService.requireTenantId();
    const employee = await this.tenantAccessService.updateEmployeeRoles(
      tenantId,
      employeeId,
      body.roles,
    );
    const identity = await this.findIdentity(employee.userId);
    return {
      data: await this.toResponse(tenantId, employee, identity),
      message: 'employee roles updated',
    };
  }

  async softDelete(
    employeeId: string,
  ): Promise<{ data: { id: string }; message: string }> {
    const tenantId = UserInfoService.requireTenantId();
    await this.tenantAccessService.softDeleteEmployee(tenantId, employeeId);
    return { data: { id: employeeId }, message: 'employee removed' };
  }

  async hardDelete(
    employeeId: string,
  ): Promise<{ data: { id: string }; message: string }> {
    const tenantId = UserInfoService.requireTenantId();
    await this.tenantAccessService.hardDeleteEmployee(tenantId, employeeId);
    return {
      data: { id: employeeId },
      message: 'employee permanently removed',
    };
  }

  async recovery(
    employeeId: string,
  ): Promise<{ data: EmployeeResponseDto; message: string }> {
    const tenantId = UserInfoService.requireTenantId();
    const employee = await this.tenantAccessService.recoverEmployee(
      tenantId,
      employeeId,
    );
    const identity = await this.findIdentity(employee.userId);
    return {
      data: await this.toResponse(tenantId, employee, identity),
      message: 'employee recovered',
    };
  }

  private async toResponses(
    tenantId: string,
    employees: EmployeeModel[],
  ): Promise<EmployeeResponseDto[]> {
    if (employees.length === 0) return [];
    const userIds = [...new Set(employees.map((employee) => employee.userId))];
    // Ownership is a property of the tenant, so read it once for the whole
    // page rather than re-reading the tenant for every employee row.
    const [result, ownerId] = await Promise.all([
      this.sanawApiEmployeeService.findAll(userIds),
      this.tenantAccessService.findTenantOwnerId(tenantId),
    ]);
    const identities = new Map(result.data.map((user) => [user.userId, user]));
    const response: EmployeeResponseDto[] = [];
    for (const employee of employees) {
      const identity = identities.get(employee.userId);
      if (!identity) continue;
      response.push(
        this.buildResponse(employee, identity, employee.userId === ownerId),
      );
    }
    return response;
  }

  private async toResponse(
    tenantId: string,
    employee: EmployeeModel,
    identity: SanawApiEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    const isOwner = await this.tenantAccessService.isTenantOwner(
      tenantId,
      employee.userId,
    );
    return this.buildResponse(employee, identity, isOwner);
  }

  private buildResponse(
    employee: EmployeeModel,
    identity: SanawApiEmployeeDto,
    isOwner: boolean,
  ): EmployeeResponseDto {
    return new EmployeeResponseDto(
      employee.id,
      employee.tenantId,
      employee.userId,
      employee.roles,
      identity.firstName,
      identity.lastName,
      identity.phoneNumber,
      employee.isDeleted,
      isOwner,
      identity.lang,
      employee.createdAt,
      employee.updatedAt,
    );
  }

  private async findIdentity(userId: string): Promise<SanawApiEmployeeDto> {
    const result = await this.sanawApiEmployeeService.findAll([userId]);
    const identity = result.data.find((item) => item.userId === userId);
    if (!identity)
      throw new BadRequestException('user identity does not exist');
    return identity;
  }

  private async findOrCreateIdentity(
    phoneNumber: string,
  ): Promise<SanawApiEmployeeDto> {
    try {
      const result = await this.sanawApiEmployeeService.find(phoneNumber);
      return result.data;
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
      const result = await this.sanawApiEmployeeService.add(phoneNumber, []);
      return result.data;
    }
  }
}
