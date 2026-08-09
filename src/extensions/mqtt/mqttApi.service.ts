import { Injectable } from '@nestjs/common';
import axios from 'axios';
import AppConfig from 'configs/app.config';
import { CacheService } from '../caching/cache.service';
import { ServiceProvider } from '../serviceProvider/serviceProvider.service';
import { MqttRuleDto } from './dtos/mqttRule.dto';

@Injectable()
export class MqttApiService {
  constructor(
    private readonly cacheService: CacheService<unknown>,
    private readonly serviceProvider: ServiceProvider,
  ) {}

  private readonly basicAuth: object = {
    auth: {
      username: AppConfig().mqtt.api.apiKey,
      password: AppConfig().mqtt.api.apiSecret,
    },
  };

  async createNvrTopics(
    serialNumber: string,
    accessToken: string,
    topics: { pubs: object; subs: object },
  ) {
    const createUserUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authentication/password_based:built_in_database/users`;
    const createAclRulesUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authorization/sources/built_in_database/rules/users`;
    const nvrAclRules = this.createAclRules(topics);
    await axios.post(
      createUserUrl,
      {
        password: accessToken,
        user_id: serialNumber,
      },
      this.basicAuth,
    );

    try {
      const response = await axios.post(
        createAclRulesUrl,
        [
          {
            username: serialNumber,
            rules: nvrAclRules,
          },
        ],
        this.basicAuth,
      );
      // await this.addAutoSubscribeTopics(topics);
      return { statusCode: 200, data: response.data };
    } catch (err) {
      await this.bestEffortDeleteUser(serialNumber);
      throw err;
    }
  }

  private async bestEffortDeleteUser(serialNumber: string): Promise<void> {
    const deleteUserUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authentication/password_based:built_in_database/users/${serialNumber}`;
    try {
      await axios.delete(deleteUserUrl, this.basicAuth);
    } catch (deleteErr) {
      this.serviceProvider.logger.error(
        `Failed to roll back orphaned MQTT user ${serialNumber}`,
        deleteErr,
      );
    }
  }

  async updateExternalUserApiPassword(username: string, newPassword: string) {
    const updateExternalUserInfoUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authentication/password_based:built_in_database/users/${username}`;
    try {
      const response = await axios.put(
        updateExternalUserInfoUrl,
        {
          password: newPassword,
        },
        this.basicAuth,
      );
      return { statusCode: 200, data: response.data };
    } catch (err) {
      throw err;
    }
  }

  async subscribeClientIdsOnNewTopics(username: string, topicList: string[]) {
    const clients = await this.getAllConnectedClientIds(username);
    const topics = topicList.map((topic: string) => ({ topic }));
    const responses: Array<{ statusCode: number; data: unknown }> = [];
    for (const client of clients as { clientid: string }[]) {
      const { clientid } = client;
      const subscribeClientIdUrl = `${
        AppConfig().mqtt.api.apiUrl
      }/clients/${clientid}/subscribe/bulk`;
      try {
        const response = await axios.post(
          subscribeClientIdUrl,
          topics,
          this.basicAuth,
        );

        responses.push({ statusCode: 200, data: response.data });
      } catch (err) {
        throw err;
      }
    }
    return responses;
  }

  async getAllConnectedClientIds(
    username: string,
  ): Promise<{ clientid: string }[]> {
    const url = `${AppConfig().mqtt.api.apiUrl}/clients`;
    try {
      const response = await axios.get(url, this.basicAuth);
      const clients = response.data.data
        .filter((client: { username: string }) => client.username === username)
        .map(({ clientid }: { clientid: string }) => ({ clientid }));
      return clients;
    } catch (err) {
      throw err;
    }
  }

  async deleteNvrTopics(serialNumber: string, nvrId: string) {
    const deleteUserUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authentication/password_based:built_in_database/users/${serialNumber}`;
    const deleteAclRulesUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authorization/sources/built_in_database/rules/users/${serialNumber}`;
    try {
      await axios.delete(deleteUserUrl, this.basicAuth);
      const response = await axios.delete(deleteAclRulesUrl, this.basicAuth);
      await this.deleteAutoSubscribeTopics(nvrId);

      return { statusCode: 200, data: response.data };
    } catch (err) {
      throw err;
    }
  }

  async createCameraTopics(
    nvrSerialNumber: string,
    topics: { pubs: object; subs: object },
  ) {
    const getAllUserAclRulesUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authorization/sources/built_in_database/rules/users/${nvrSerialNumber}`;

    const updateUserAclRulesUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authorization/sources/built_in_database/rules/users/${nvrSerialNumber}`;

    const cameraAclRules = this.createAclRules(topics);

    return this.withNvrAclLock(nvrSerialNumber, async () => {
      try {
        const res1 = await axios.get(getAllUserAclRulesUrl, this.basicAuth);
        const res2 = await axios.put(
          updateUserAclRulesUrl,
          {
            rules: [...res1.data.rules, ...cameraAclRules],
            username: nvrSerialNumber,
          },
          this.basicAuth,
        );
        // await this.addAutoSubscribeTopics(topics);
        return {
          statusCode: 200,
          data: res2.data,
        };
      } catch (err) {
        throw err;
      }
    });
  }

  async deleteCameraTopics(
    nvrSerialNumber: string,
    nvrId: string,
    cameraId: string,
  ) {
    const getAllUserAclRulesUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authorization/sources/built_in_database/rules/users/${nvrSerialNumber}`;

    const updateUserAclRulesUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authorization/sources/built_in_database/rules/users/${nvrSerialNumber}`;

    return this.withNvrAclLock(nvrSerialNumber, async () => {
      try {
        const res1 = await axios.get(getAllUserAclRulesUrl, this.basicAuth);
        const updatedRules = this.deleteRulesIfMatch(
          res1.data.rules,
          `${nvrId}/${cameraId}`,
        );
        const res2 = await axios.put(
          updateUserAclRulesUrl,
          {
            rules: updatedRules,
            username: nvrSerialNumber,
          },
          this.basicAuth,
        );
        await this.deleteAutoSubscribeTopics(`${nvrId}/${cameraId}`);
        return {
          statusCode: 200,
          data: res2.data,
        };
      } catch (err) {
        throw err;
      }
    });
  }

  private async withNvrAclLock<R>(
    nvrSerialNumber: string,
    operation: () => Promise<R>,
  ): Promise<R> {
    const lockKey = `mqtt-acl:${nvrSerialNumber}`;
    const deadline = Date.now() + 5_000;
    let token: string | null = null;

    while (!token && Date.now() < deadline) {
      token = await this.cacheService.acquireLock(lockKey, 15);
      if (!token) await new Promise((resolve) => setTimeout(resolve, 150));
    }

    if (!token) {
      this.serviceProvider.logger.warn(
        `MQTT ACL lock for NVR ${nvrSerialNumber} was not acquired; proceeding without it`,
      );
    }

    try {
      return await operation();
    } finally {
      if (token) await this.cacheService.releaseLock(lockKey, token);
    }
  }

  private createAclRules(topics: { pubs: object; subs: object }) {
    // create topics from point of view of nvr
    const subscribeTopics = [...Object.values(topics.pubs)];
    const publishTopics = [...Object.values(topics.subs)];

    const publishRules = this.createPublishTopicRules(publishTopics);
    const subscribeRules = this.createSubscribeTopicRules(subscribeTopics);
    return [...publishRules, ...subscribeRules];
  }

  private createPublishTopicRules(topics: string[]) {
    const publishTopicRules: MqttRuleDto[] = [];
    for (const topic of topics)
      publishTopicRules.push({
        action: 'publish',
        permission: 'allow',
        topic,
      });
    return publishTopicRules;
  }

  private createSubscribeTopicRules(topics: string[]) {
    const subscribeTopicRules: MqttRuleDto[] = [];
    for (const topic of topics)
      subscribeTopicRules.push({
        action: 'subscribe',
        permission: 'allow',
        topic,
      });
    return subscribeTopicRules;
  }

  private deleteRulesIfMatch(rules: { topic: string }[], topicPattern: string) {
    for (let i = rules.length - 1; i >= 0; i--) {
      const rule = rules[i];
      if (rule && this.topicMatchesSegmentPattern(rule.topic, topicPattern)) {
        rules.splice(i, 1);
      }
    }
    return rules;
  }

  private topicMatchesSegmentPattern(
    topic: string,
    topicPattern: string,
  ): boolean {
    const topicSegments = topic.split('/');
    const patternSegments = topicPattern.split('/');
    for (
      let start = 0;
      start + patternSegments.length <= topicSegments.length;
      start++
    ) {
      if (
        patternSegments.every(
          (segment, index) => topicSegments[start + index] === segment,
        )
      ) {
        return true;
      }
    }
    return false;
  }

  private async deleteAutoSubscribeTopics(topicPattern: string) {
    const getAutoSubscribeTopicsUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/mqtt/auto_subscribe`;
    const res1 = await axios.get(getAutoSubscribeTopicsUrl, this.basicAuth);
    let autoSusbscribeTopicsRules = res1.data;
    autoSusbscribeTopicsRules = this.deleteRulesIfMatch(
      autoSusbscribeTopicsRules,
      topicPattern,
    );
    const updateAutoSubscribeTopicsUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/mqtt/auto_subscribe`;
    await axios.put(
      updateAutoSubscribeTopicsUrl,
      autoSusbscribeTopicsRules,
      this.basicAuth,
    );
  }
}
