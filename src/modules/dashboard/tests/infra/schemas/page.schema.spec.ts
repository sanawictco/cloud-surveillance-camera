import { PageSchema } from '../../../infra/schemas/page.schema';

describe('PageSchema', () => {
  it('indexes pages by tenant for id lookups', () => {
    const index = PageSchema.indexes().find(
      ([fields]) => fields.tenantId === 1 && fields.id === 1,
    );

    expect(index).toBeDefined();
  });

  it('indexes ordered pages within a tenant and NVR', () => {
    const index = PageSchema.indexes().find(
      ([fields]) =>
        fields.tenantId === 1 &&
        fields.nvrId === 1 &&
        fields.type === 1 &&
        fields.pageIndex === 1,
    );

    expect(index).toBeDefined();
  });

  it('indexes page name uniqueness scope within a tenant and NVR', () => {
    const index = PageSchema.indexes().find(
      ([fields]) =>
        fields.tenantId === 1 && fields.nvrId === 1 && fields.name === 1,
    );

    expect(index).toBeDefined();
  });
});
