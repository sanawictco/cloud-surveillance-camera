import { NvrEntity } from '../../../domain/nvr/nvr.entity';

describe('NVR domain events', () => {
  it('omits credentials from creation and update events', () => {
    const entity = NvrEntity.create({
      tenantId: '11111111-1111-4111-8111-111111111111',
      name: 'NVR',
      productModel: 'NVR-16',
      serialNumber: 'NVR00001',
      accessToken: '11111111111111111111111111111111',
      maxCameras: 16,
      password: 'original-password',
    });
    entity.update({ password: 'updated-password', name: 'Updated NVR' });

    expect(entity.getProps().accessToken).toBe(
      '11111111111111111111111111111111',
    );
    expect(entity.getProps().password).toBe('updated-password');
    expect(JSON.stringify(entity.domainEvents)).not.toMatch(
      /11111111111111111111111111111111|original-password|updated-password|accessToken|password/,
    );
  });
});
