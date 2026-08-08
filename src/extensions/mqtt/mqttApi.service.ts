import { Injectable } from '@nestjs/common';
import axios from 'axios';
import AppConfig from 'configs/app.config';
import { MqttRuleDto } from './dtos/mqttRule.dto';

@Injectable()
export class MqttApiService {
  private basicAuth: object = {
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
    try {
      const nvrAclRules = this.createAclRules(topics);
      await axios.post(
        createUserUrl,
        {
          password: accessToken,
          user_id: serialNumber,
        },
        this.basicAuth,
      );

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
      throw err;
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

        return { statusCode: 200, data: response.data };
      } catch (err) {
        throw err;
      }
    }
    return;
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
      if (rules[i]?.topic.includes(topicPattern)) {
        rules.splice(i, 1);
      }
    }
    return rules;
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
