import { EmployeeRepository } from 'src/modules/tenantAccess/infra/repositories/employee.repository';

describe('EmployeeRepository', () => {
  it('deletes an employee only inside the requested tenant', async () => {
    const deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
    const repository = new EmployeeRepository({ deleteOne } as never);

    await expect(repository.delete('tenant-a', 'employee-a')).resolves.toBe(
      true,
    );
    expect(deleteOne).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      id: 'employee-a',
    });
  });

  it('finds active access by tenant and user together', async () => {
    const exec = jest.fn().mockResolvedValue(undefined);
    const findOne = jest.fn().mockReturnValue({
      lean: () => ({ exec }),
    });
    const repository = new EmployeeRepository({ findOne } as never);

    await repository.findActive('tenant-a', 'shared-user');

    expect(findOne).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      userId: 'shared-user',
      isDeleted: false,
    });
  });
});
