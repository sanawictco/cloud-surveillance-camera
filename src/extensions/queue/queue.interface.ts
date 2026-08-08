import { Job, RepeatOptions } from 'bullmq';

export type QueueMsg = Job & {
  opts: Job['opts'] & { repeat?: RepeatOptions };
};
export class RepeatQueueMsgOptions {
  retryCount: number;
  retryPeriodInSecond: number;

  constructor(retryCount: number, retryPeriodInSecond: number) {
    this.retryCount = retryCount;
    this.retryPeriodInSecond = retryPeriodInSecond;
  }
}
export class QueueMsgOptions {
  repeat?: RepeatQueueMsgOptions;
  cron?: string;
  delayInSecond?: number;
  msgId: string;

  constructor(
    msgId: string,
    repeat?: RepeatQueueMsgOptions,
    cron?: string,
    delayInSecond?: number,
  ) {
    this.msgId = msgId;
    this.repeat = repeat;
    this.cron = cron;
    this.delayInSecond = delayInSecond;
  }
}

export interface IQueue<T> {
  createQueue(
    queueName: string,
    workerMsgHandler: (msg: QueueMsg) => Promise<void>,
    expiredMsgHandler?: (msg: QueueMsg) => Promise<void>,
    failureMsgHandler?: (msg: QueueMsg) => Promise<void>,
  ): IQueue<T>;
  addMsg(msg: T, opts: QueueMsgOptions): Promise<void>;
  getMsg(msgId: string): Promise<T | undefined>;
  getAndDeleteMsg(msgId: string): Promise<T | undefined>;
  addEventListener(
    queueName: string,
    eventHandler: (msg: QueueMsg) => Promise<void>,
    eventId: string,
  ): Promise<void>;
  removeEventListener(queueName: string, eventId: string): void;
}
