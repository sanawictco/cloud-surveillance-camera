import AppConfig from 'configs/app.config';

export function SanawApiHeader() {
  return { api_key: `Workspace-${AppConfig().sanawApiKey}` };
}
