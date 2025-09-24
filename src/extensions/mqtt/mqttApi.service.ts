import { Injectable } from '@nestjs/common';
import axios from 'axios';
import AppConfig from 'configs/app.config';
import { generateRandomId } from 'src/dddLib/utils/randomIdGenerator';
import { MqttRuleDto } from './dtos/mqttRule.dto';

@Injectable()
export class MqttApiService {
  private basicAuth: object = {
    auth: {
      username: AppConfig().mqtt.api.apiKey,
      password: AppConfig().mqtt.api.apiSecret,
    },
  };

  async createGatewayTopics(
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
      const gatewayAclRules = this.createAclRules(topics);
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
            rules: gatewayAclRules,
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

  async unSubscribeClientIdsFromPrevTopics(username: string, topicList) {
    const clients = await this.getAllConnectedClientIds(username);
    const topics = topicList.map((topic) => ({ topic }));
    for (const client of clients) {
      const { clientid } = client;
      const unSubscribeClientIdUrl = `${
        AppConfig().mqtt.api.apiUrl
      }/clients/${clientid}/unsubscribe/bulk`;
      try {
        const response = await axios.post(
          unSubscribeClientIdUrl,
          topics,
          this.basicAuth,
        );

        return { statusCode: 200, data: response.data };
      } catch (err) {
        throw err;
      }
    }
  }

  async subscribeClientIdsOnNewTopics(username: string, topicList) {
    const clients = await this.getAllConnectedClientIds(username);
    const topics = topicList.map((topic) => ({ topic }));
    for (const client of clients) {
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
  }

  async getAllConnectedClientIds(username) {
    const url = `${AppConfig().mqtt.api.apiUrl}/clients`;
    try {
      const response = await axios.get(url, this.basicAuth);
      const clients = response.data.data
        .filter((client) => client.username === username)
        .map(({ clientid }) => ({ clientid }));
      return clients;
    } catch (err) {
      throw err;
    }
  }

  async updateExternalUserApiAclRules(username: string, topicList: string[]) {
    const updateExternalUserAclRulesUrl = `${AppConfig().mqtt.api.apiUrl}/authorization/sources/built_in_database/rules/users/${username}`;
    try {
      const topics = { pubs: {}, subs: {} };
      for (const item of topicList) {
        topics.pubs[generateRandomId(6)] = item;
      }
      const externalUserAclRules = this.createAclRules(topics);

      const response = await axios.put(
        updateExternalUserAclRulesUrl,
        {
          rules: externalUserAclRules,
          username: username,
        },
        this.basicAuth,
      );
      return { statusCode: 200, data: response.data };
    } catch (err) {
      throw err;
    }
  }

  async disconnectClients(username) {
    const clients = await this.getAllConnectedClientIds(username);
    for (const client of clients) {
      const { clientid } = client;
      const disconnectClientIdUrl = `${AppConfig().mqtt.api.apiUrl}/clients/${clientid}`;
      try {
        await axios.delete(disconnectClientIdUrl, this.basicAuth);
      } catch (err) {
        throw err;
      }
    }
  }

  async createExternalUserTopics(
    username: string,
    password: string,
    topicList: string[],
  ) {
    const topics = { pubs: {}, subs: {} };
    for (const item of topicList) {
      topics.pubs[generateRandomId(6)] = item;
    }
    // as createGatewayTopics create user & its topics, i reuse this function
    return this.createGatewayTopics(username, password, topics);
  }

  async deleteGatewayTopics(serialNumber: string, gatewayId: string) {
    const deleteUserUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authentication/password_based:built_in_database/users/${serialNumber}`;
    const deleteAclRulesUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authorization/sources/built_in_database/rules/users/${serialNumber}`;
    try {
      await axios.delete(deleteUserUrl, this.basicAuth);
      const response = await axios.delete(deleteAclRulesUrl, this.basicAuth);
      await this.deleteAutoSubscribeTopics(gatewayId);

      return { statusCode: 200, data: response.data };
    } catch (err) {
      throw err;
    }
  }

  async createAccessPointTopics(
    gatewaySerialNumber: string,
    topics: { pubs: object; subs: object },
  ) {
    const getAllUserAclRulesUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authorization/sources/built_in_database/rules/users/${gatewaySerialNumber}`;

    const updateUserAclRulesUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authorization/sources/built_in_database/rules/users/${gatewaySerialNumber}`;

    const accessPointAclRules = this.createAclRules(topics);

    try {
      const res1 = await axios.get(getAllUserAclRulesUrl, this.basicAuth);
      const res2 = await axios.put(
        updateUserAclRulesUrl,
        {
          rules: [...res1.data.rules, ...accessPointAclRules],
          username: gatewaySerialNumber,
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

  async deleteAccessPointTopics(
    gatewaySerialNumber: string,
    gatewayId: string,
    accessPointId: string,
  ) {
    const getAllUserAclRulesUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authorization/sources/built_in_database/rules/users/${gatewaySerialNumber}`;

    const updateUserAclRulesUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authorization/sources/built_in_database/rules/users/${gatewaySerialNumber}`;

    try {
      const res1 = await axios.get(getAllUserAclRulesUrl, this.basicAuth);
      const updatedRules = this.deleteRulesIfMatch(
        res1.data.rules,
        `${gatewayId}/${accessPointId}`,
      );
      const res2 = await axios.put(
        updateUserAclRulesUrl,
        {
          rules: updatedRules,
          username: gatewaySerialNumber,
        },
        this.basicAuth,
      );
      await this.deleteAutoSubscribeTopics(`${gatewayId}/${accessPointId}`);
      return {
        statusCode: 200,
        data: res2.data,
      };
    } catch (err) {
      throw err;
    }
  }

  async createEndDeviceTopics(
    gatewaySerialNumber: string,
    topics: { pubs: object; subs: object },
  ) {
    const getAllUserAclRulesUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authorization/sources/built_in_database/rules/users/${gatewaySerialNumber}`;

    const updateUserAclRulesUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authorization/sources/built_in_database/rules/users/${gatewaySerialNumber}`;

    const endDeviceAclRules = this.createAclRules(topics);

    try {
      const res1 = await axios.get(getAllUserAclRulesUrl, this.basicAuth);
      const res2 = await axios.put(
        updateUserAclRulesUrl,
        {
          rules: [...res1.data.rules, ...endDeviceAclRules],
          username: gatewaySerialNumber,
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

  async deleteEndDeviceTopics(
    gatewaySerialNumber: string,
    gatewayId: string,
    accessPointId: string,
    endDeviceId: string,
  ) {
    const getAllUserAclRulesUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authorization/sources/built_in_database/rules/users/${gatewaySerialNumber}`;

    const updateUserAclRulesUrl = `${
      AppConfig().mqtt.api.apiUrl
    }/authorization/sources/built_in_database/rules/users/${gatewaySerialNumber}`;

    try {
      const res1 = await axios.get(getAllUserAclRulesUrl, this.basicAuth);
      const updatedRules = this.deleteRulesIfMatch(
        res1.data.rules,
        `${gatewayId}/${accessPointId}/${endDeviceId}`,
      );
      const res2 = await axios.put(
        updateUserAclRulesUrl,
        {
          rules: updatedRules,
          username: gatewaySerialNumber,
        },
        this.basicAuth,
      );

      await this.deleteAutoSubscribeTopics(
        `${gatewayId}/${accessPointId}/${endDeviceId}`,
      );
      return {
        statusCode: 200,
        data: res2.data,
      };
    } catch (err) {
      throw err;
    }
  }

  private createAclRules(topics: { pubs: object; subs: object }) {
    // create topics from point of view of gateway
    const subscribeTopics = [...Object.values(topics.pubs)];
    const publishTopics = [...Object.values(topics.subs)];

    const publishRules = this.createPublishTopicRules(publishTopics);
    const subscribeRules = this.createSubscribeTopicRules(subscribeTopics);
    return [...publishRules, ...subscribeRules];
  }

  private createPublishTopicRules(topics) {
    const publishTopicRules: MqttRuleDto[] = [];
    for (const topic of topics)
      publishTopicRules.push({
        action: 'publish',
        permission: 'allow',
        topic,
      });
    return publishTopicRules;
  }

  private createSubscribeTopicRules(topics) {
    const subscribeTopicRules: MqttRuleDto[] = [];
    for (const topic of topics)
      subscribeTopicRules.push({
        action: 'subscribe',
        permission: 'allow',
        topic,
      });
    return subscribeTopicRules;
  }

  private deleteRulesIfMatch(rules, topicPattern) {
    for (let i = rules.length - 1; i >= 0; i--) {
      if (rules[i].topic.includes(topicPattern)) {
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
