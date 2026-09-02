import {
  UnsetCameraRunningConfigCommand,
  UnsetCameraRunningConfigCommandHandler,
} from '../../../../applicationService/commands/camera/unsetCameraRunningConfig.command';

describe('UnsetCameraRunningConfigCommandHandler', () => {
  it('delegates conditional camera unlock to the repository', async () => {
    const repository = {
      unsetRunningConfigIfMatches: jest.fn().mockResolvedValue(true),
    };
    const handler = new UnsetCameraRunningConfigCommandHandler(
      repository as never,
    );

    await expect(
      handler.execute(
        new UnsetCameraRunningConfigCommand(
          'camera-id',
          'update',
          'update-msg',
          'tenant-a',
        ),
      ),
    ).resolves.toBe(true);

    expect(repository.unsetRunningConfigIfMatches).toHaveBeenCalledWith(
      'camera-id',
      'update',
      'update-msg',
      'tenant-a',
    );
  });
});
