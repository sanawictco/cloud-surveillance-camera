import { NvrMapper } from '../../../infra/nvr/nvr.mapper';
import { NvrEntity } from '../../../domain/nvr/nvr.entity';

describe('NvrMapper', () => {
  it('returns the login password but never exposes the access token', () => {
    const entity = NvrEntity.create({
      tenantId: '11111111-1111-4111-8111-111111111111',
      name: 'NVR',
      productModel: 'NVR-16',
      serialNumber: 'NVR00001',
      accessToken: '11111111111111111111111111111111',
      maxCameras: 16,
      password: 'nvr-password',
    });
    const mapper = new NvrMapper();

    const persistence = mapper.toPersistence(entity);
    const response = mapper.toResponse(entity);

    expect(persistence.accessToken).toBe('11111111111111111111111111111111');
    expect(persistence.password).toBe('nvr-password');
    expect(response.password).toBe('nvr-password');
    expect(JSON.stringify(response)).not.toMatch(
      /11111111111111111111111111111111|accessToken/,
    );
  });
});
