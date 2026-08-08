export class MqttRuleDto {
  action: 'publish' | 'subscribe';
  permission: 'allow' | 'deny';
  topic: string;

  constructor(
    action: 'publish' | 'subscribe',
    permission: 'allow' | 'deny',
    topic: string,
  ) {
    this.action = action;
    this.permission = permission;
    this.topic = topic;
  }
}
