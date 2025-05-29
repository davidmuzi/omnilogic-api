import { StatusResponse } from './Response.js';
import { sendRequest } from './utils/sendRequest.js';
import { parseTelemetryData, parseMSPList, parseCommandData } from './utils/parseResponse.js';
import { OmniLogicAuth, type Token } from './utils/Authentication.js';
import {
  systemTag,
  tokenTag,
  userTag,
  emptyTimerTag,
  poolTag,
  tempTag,
  heaterTag,
  enabledTag,
  equipmentIdTag,
  isOnTag,
} from './utils/XmlTags.js';
import type {
  ColorLogicLightStatus as Light,
  FilterStatus as Pump,
  VirtualHeaterStatus as Heater,
} from './Response.js';
import { jwtDecode } from 'jwt-decode';

interface OmniLogicAPI {
  getPumps(): Promise<Pump[]>;
  getPumpSpeed(pump: Pump): Promise<number>;
  setPumpOn(pump: Pump): Promise<boolean>;
  setPumpSpeed(pump: Pump, speed: number): Promise<boolean>;

  getWaterTemperature(): Promise<WaterTemperature>;

  getHeaters(): Promise<Heater[]>;
  setHeaterTemperature(heater: Heater, targetTemperature: Farhenheit): Promise<boolean>;
  setHeaterState(heater: Heater, on: boolean): Promise<boolean>;

  getLights(): Promise<Light[]>;
  getLightState(light: Light): Promise<boolean>;
  setLightState(light: Light, on: boolean): Promise<boolean>;
}

type Farhenheit = number;

class OmniLogic implements OmniLogicAPI {
  public token: Token;
  public userID: number;

  private auth: OmniLogicAuth;
  private systemID: number | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private equipmentPoolMap: Map<number, number> = new Map();

  private constructor(auth: OmniLogicAuth, token: Token, userID: number) {
    this.auth = auth;
    this.token = token;
    this.userID = userID;
  }

  static async withCredentials(email: string, password: string): Promise<OmniLogic | Error> {
    const auth = new OmniLogicAuth();
    const token = await auth.login(email, password);

    if (token instanceof Error) {
      return token;
    }

    const client = new OmniLogic(auth, token, token.userID);
    client.setupTokenRefresh();

    return client;
  }

  static withToken(token: Token, userID: number): OmniLogic {
    const auth = new OmniLogicAuth();
    const client = new OmniLogic(auth, token, userID);
    client.setupTokenRefresh();

    return client;
  }

  setupTokenRefresh() {
    if (this.token === null) {
      throw new Error('No valid token available');
    }

    this.clearTokenRefresh();
    this.refreshInterval = setInterval(() => this.refreshTokenIfNeeded(), 1000 * 60 * 60); // Check every hour
  }

  clearTokenRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  async refreshTokenIfNeeded() {
    if (this.token === null) {
      throw new Error('No valid token available');
    }

    try {
      const decoded = jwtDecode(this.token.token);
      const exp = (decoded as { exp?: number }).exp;

      if (!exp) {
        throw new Error('Token does not contain expiration');
      }

      const expiresAt = exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      // Refresh if token expires in less than 24 hours
      if (timeUntilExpiry < 1000 * 60 * 60 * 24) {
        console.log('Token close to expiring, refreshing...');
        const newToken = await this.auth.refreshToken(this.token);
        if (newToken instanceof Error) {
          throw new Error('Failed to refresh token');
        }
        this.token = newToken;
        console.log('Token refreshed');
      }
    } catch (error) {
      console.error('Error checking/refreshing token:', error);
      throw error;
    }
  }

  async connect() {
    const mspList = await this.requestMSPList();
    this.systemID = mspList.list[0].mspSystemId;
  }

  // Pumps

  async getPumps(): Promise<Pump[]> {
    const { filters } = await this.requestTelemetryData();
    return filters;
  }

  async getPumpSpeed(pump: Pump): Promise<number> {
    const { filters } = await this.requestTelemetryData();

    if (!filters || filters.length === 0) {
      throw new Error('unable to get pump status');
    }

    const filter = filters.find(f => f.systemId === pump.systemId);

    if (!filter) {
      throw new Error('unable to get pump speed');
    }

    return filter.filterSpeed;
  }

  async setPumpOn(pump: Pump): Promise<boolean> {
    return this.setEquipmentState(pump.systemId, pump.lastSpeed);
  }

  async setPumpSpeed(pump: Pump, speed: number): Promise<boolean> {
    if (speed < 0 || speed > 100) {
      throw new Error('Speed is a percentage, should be between 0 and 100');
    }
    return this.setEquipmentState(pump.systemId, speed);
  }

  // Heaters

  async getHeaters(): Promise<Heater[]> {
    const { virtualHeaters } = await this.requestTelemetryData();
    return virtualHeaters;
  }

  async setHeaterTemperature(heater: Heater, targetTemperature: Farhenheit): Promise<boolean> {
    if (targetTemperature < 50 || targetTemperature > 105) {
      throw new Error('Target temperature must be between 40 and 105 degrees Fahrenheit');
    }

    if (!this.equipmentPoolMap.has(heater.systemId)) {
      await this.updateEquipmentBodyMap();
    }

    const poolId = this.equipmentPoolMap.get(heater.systemId);
    if (!poolId) {
      throw new Error(`Could not find body of water for equipment ${heater.systemId}`);
    }

    const payload = {
      Request: {
        Name: 'SetUIHeaterCmd',
        Parameters: {
          Parameter: [
            tokenTag(this.token.token),
            systemTag(this.systemID!),
            poolTag(poolId),
            heaterTag(heater.systemId),
            tempTag(targetTemperature),
          ],
        },
      },
    };
    const data = await sendRequest(payload);
    const { status } = parseCommandData(data);
    return status == 0;
  }

  async setHeaterState(heater: Heater, on: boolean): Promise<boolean> {
    const isOn = on === true ? 'true' : 'false';

    if (!this.equipmentPoolMap.has(heater.systemId)) {
      await this.updateEquipmentBodyMap();
    }

    const poolId = this.equipmentPoolMap.get(heater.systemId);
    if (!poolId) {
      throw new Error(`Could not find body of water for equipment ${heater.systemId}`);
    }

    const payload = {
      Request: {
        Name: 'SetHeaterEnable',
        Parameters: {
          Parameter: [
            tokenTag(this.token.token),
            systemTag(this.systemID!),
            poolTag(poolId),
            heaterTag(heater.systemId),
            enabledTag(isOn),
          ],
        },
      },
    };
    const data = await sendRequest(payload);
    const { status } = parseCommandData(data);
    return status == 0;
  }

  async getWaterTemperature(): Promise<WaterTemperature> {
    const { bodiesOfWater, virtualHeaters, heaters, filters } = await this.requestTelemetryData();

    if (!bodiesOfWater || bodiesOfWater.length === 0) {
      throw new Error('unable to get bodies of water');
    }

    const index = filters.findIndex(f => f.filterSpeed > 0);
    if (index === -1) {
      throw new Error('no pump running');
    }

    return {
      current: bodiesOfWater[index].waterTemp,
      target: virtualHeaters[index].currentSetPoint,
      heaterOn: heaters[index].heaterState === 1,
    };
  }

  // Lights

  async getLights(): Promise<Light[]> {
    const { colorLogicLights } = await this.requestTelemetryData();
    return colorLogicLights;
  }

  async getLightState(light: Light): Promise<boolean> {
    const { colorLogicLights } = await this.requestTelemetryData();
    // 0: off, 4: powering on, 6: on 7: powering off,
    return colorLogicLights.filter(l => l.systemId == light.systemId)[0]?.lightState == 6;
  }

  async setLightState(light: Light, on: boolean): Promise<boolean> {
    return this.setEquipmentState(light.systemId, on ? 1 : 0);
  }

  protected async setEquipmentState(equipmentId: number, value: number): Promise<boolean> {
    // If we don't have the mapping yet, update it
    if (!this.equipmentPoolMap.has(equipmentId)) {
      await this.updateEquipmentBodyMap();
    }

    const poolId = this.equipmentPoolMap.get(equipmentId);
    if (!poolId) {
      throw new Error(`Could not find body of water for equipment ${equipmentId}`);
    }

    const payload = {
      Request: {
        Name: 'SetUIEquipmentCmd',
        Parameters: {
          Parameter: [
            tokenTag(this.token.token),
            systemTag(this.systemID!),
            poolTag(poolId),
            equipmentIdTag(equipmentId),
            isOnTag(value),
            ...emptyTimerTag(),
          ],
        },
      },
    };
    const data = await sendRequest(payload);
    const { status } = parseCommandData(data);
    return status == 0;
  }

  protected async requestTelemetryData(): Promise<StatusResponse> {
    const payload = {
      Request: {
        Name: `RequestTelemetryData`,
        Parameters: {
          Parameter: [tokenTag(this.token.token), systemTag(this.systemID!)],
        },
      },
    };
    const data = await sendRequest(payload);
    return parseTelemetryData(data);
  }

  protected async requestMSPList() {
    const payload = {
      Request: {
        Name: `GetMspList`,
        Parameters: {
          Parameter: [tokenTag(this.token.token), userTag(this.userID)],
        },
      },
    };
    const data = await sendRequest(payload);
    return parseMSPList(data);
  }

  protected async updateEquipmentBodyMap() {
    const { bodiesOfWater, filters, virtualHeaters, heaters, colorLogicLights } =
      await this.requestTelemetryData();

    // Reset the map
    this.equipmentPoolMap.clear();

    // Map each piece of equipment to its body of water
    for (let i = 0; i < bodiesOfWater.length; i++) {
      const bodyId = bodiesOfWater[i].systemId;

      if (filters[i]) this.equipmentPoolMap.set(filters[i].systemId, bodyId);
      if (virtualHeaters[i]) this.equipmentPoolMap.set(virtualHeaters[i].systemId, bodyId);
      if (heaters[i]) this.equipmentPoolMap.set(heaters[i].systemId, bodyId);
      if (colorLogicLights[i]) this.equipmentPoolMap.set(colorLogicLights[i].systemId, bodyId);
    }
  }
}

type WaterTemperature = {
  current: Farhenheit;
  target: Farhenheit;
  heaterOn: boolean;
};

interface Equipment {
  systemId: number;
  poolId: number;
}

export default OmniLogic;
