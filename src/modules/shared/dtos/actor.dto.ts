export enum ActorLogTypes {
  EMPLOYEE = 'EMPLOYEE',
  RULE_CHAIN = 'RULE_CHAIN',
}

export class ActorDto {
  actorId?: string;
  actorType?: 'EMPLOYEE' | 'RULE_CHAIN';
}
