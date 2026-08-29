import { CreatePageCommand } from '../../../applicationService/commands/createPage.command';
import { UpdatePageCommand } from '../../../applicationService/commands/updatePage.command';
import { DeletePageCommand } from '../../../applicationService/commands/deletePage.command';
import { PageTypes } from '../../../domain/valueObjects/pageType.vo';

describe('Page tenant commands', () => {
  it('CreatePageCommand fails closed without a tenant', () => {
    expect(
      () =>
        new CreatePageCommand({
          name: 'Home',
          nvrId: 'nvr-1',
          type: PageTypes.WIDGET,
        } as never),
    ).toThrow('tenantId is required');
  });

  it('UpdatePageCommand fails closed without a tenant', () => {
    expect(
      () => new UpdatePageCommand({ id: 'page-1', name: 'Home' } as never),
    ).toThrow('tenantId is required');
  });

  it('DeletePageCommand fails closed without a tenant', () => {
    expect(() => new DeletePageCommand({ id: 'page-1' } as never)).toThrow(
      'tenantId is required',
    );
  });

  it('carries the tenant when provided', () => {
    const command = new CreatePageCommand({
      tenantId: 'tenant-a',
      name: 'Home',
      nvrId: 'nvr-1',
      type: PageTypes.WIDGET,
    });

    expect(command.tenantId).toBe('tenant-a');
  });
});
