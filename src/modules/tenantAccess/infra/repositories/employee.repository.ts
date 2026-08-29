import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { EmployeeModel } from '../schemas/employee.schema';

@Injectable()
export class EmployeeRepository {
  constructor(
    @InjectModel(EmployeeModel.name)
    private readonly employeeModel: Model<EmployeeModel>,
  ) {}

  async findActive(
    tenantId: string,
    userId: string,
  ): Promise<EmployeeModel | undefined> {
    const employee = await this.employeeModel
      .findOne({ tenantId, userId, isDeleted: false })
      .lean<EmployeeModel>()
      .exec();
    return employee ?? undefined;
  }

  async findByIdForTenant(
    tenantId: string,
    employeeId: string,
  ): Promise<EmployeeModel | undefined> {
    const employee = await this.employeeModel
      .findOne({ tenantId, id: employeeId })
      .lean<EmployeeModel>()
      .exec();
    return employee ?? undefined;
  }

  async findByUserForTenant(
    tenantId: string,
    userId: string,
  ): Promise<EmployeeModel | undefined> {
    const employee = await this.employeeModel
      .findOne({ tenantId, userId })
      .lean<EmployeeModel>()
      .exec();
    return employee ?? undefined;
  }

  async findForUser(userId: string): Promise<EmployeeModel[]> {
    return this.employeeModel
      .find({ userId, isDeleted: false })
      .sort({ createdAt: 1 })
      .lean<EmployeeModel[]>()
      .exec();
  }

  async findForTenant(
    tenantId: string,
    includeDeleted = false,
  ): Promise<EmployeeModel[]> {
    const filter = includeDeleted
      ? { tenantId }
      : { tenantId, isDeleted: false };
    return this.employeeModel
      .find(filter)
      .sort({ createdAt: 1 })
      .lean<EmployeeModel[]>()
      .exec();
  }

  async save(
    tenantId: string,
    userId: string,
    roles: EmployeeRoles[],
    isDeleted = false,
  ): Promise<EmployeeModel> {
    const now = new Date();
    const employee = await this.employeeModel
      .findOneAndUpdate(
        { tenantId, userId },
        {
          $set: {
            roles: [...new Set(roles)],
            isDeleted,
            updatedAt: now,
          },
          $setOnInsert: {
            id: randomUUID(),
            tenantId,
            userId,
            createdAt: now,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean<EmployeeModel>()
      .exec();
    if (!employee) throw new Error('employee could not be saved');
    return employee;
  }

  async updateRoles(
    tenantId: string,
    employeeId: string,
    roles: EmployeeRoles[],
  ): Promise<EmployeeModel | undefined> {
    const employee = await this.employeeModel
      .findOneAndUpdate(
        { tenantId, id: employeeId, isDeleted: false },
        { $set: { roles: [...new Set(roles)], updatedAt: new Date() } },
        { new: true },
      )
      .lean<EmployeeModel>()
      .exec();
    return employee ?? undefined;
  }

  async setDeleted(
    tenantId: string,
    employeeId: string,
    isDeleted: boolean,
  ): Promise<EmployeeModel | undefined> {
    const employee = await this.employeeModel
      .findOneAndUpdate(
        { tenantId, id: employeeId },
        { $set: { isDeleted, updatedAt: new Date() } },
        { new: true },
      )
      .lean<EmployeeModel>()
      .exec();
    return employee ?? undefined;
  }

  async delete(tenantId: string, employeeId: string): Promise<boolean> {
    const result = await this.employeeModel.deleteOne({
      tenantId,
      id: employeeId,
    });
    return result.deletedCount === 1;
  }
}
