import AppConfig from 'configs/app.config';

export function SanawApiHeader() {
  return { api_key: `Workspace-${AppConfig().sanawApiKey}` };
}

// Gateway-scoped routes on workspacesAndGatewaysAdminApi (e.g. manufactured-nvrs/scan)
// authenticate with a `Gateway-<key>` prefixed key instead of `Workspace-<key>`.
export function SanawGatewayApiHeader() {
  return { api_key: `Gateway-${AppConfig().sanawApiKey}` };
}
