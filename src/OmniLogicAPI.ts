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
} from './utils/xmlTags.js';
import type {
  ColorLogicLightStatus as Light,
  FilterStatus as Pump,
  VirtualHeaterStatus as Heater,
} from './Response.js';
import { jwtDecode } from 'jwt-decode';
import {
  ConnectionError,
  EquipmentError,
  ValidationError,
  AuthenticationError,
} from './utils/errors.js';
import { Farhenheit, OmniLogicAPI, Percentage, WaterTemperature } from './OmniLogicInterface.js';

class OmniLogic implements OmniLogicAPI {
  public token: Token;
  public userID: number;

  private auth: OmniLogicAuth;
  private systemID: number | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private equipmentPoolMap: Map<number, number> = new Map();

  // Cache related properties
  private telemetryCache: StatusResponse | null = null;
  private lastTelemetryFetch: number = 0;
  private readonly cacheValiditySeconds: number;

  private constructor(auth: OmniLogicAuth, token: Token, userID: number) {
    this.auth = auth;
    this.token = token;
    this.userID = userID;

    // Get cache validity from environment variable or use default
    const envCacheValidity = process.env.OMNILOGIC_CACHE_SECONDS;
    this.cacheValiditySeconds = envCacheValidity ? parseInt(envCacheValidity) : 30;
  }

  static async withCredentials(email: string, password: string): Promise<OmniLogic> {
    const auth = new OmniLogicAuth();
    const token = await auth.login(email, password);

    if (token instanceof Error) {
      throw new AuthenticationError(token.message);
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
      throw new AuthenticationError('No valid token available');
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
      throw new AuthenticationError('No valid token available');
    }

    try {
      const decoded = jwtDecode(this.token.token);
      const exp = (decoded as { exp?: number }).exp;

      if (!exp) {
        throw new AuthenticationError('Token does not contain expiration');
      }

      const expiresAt = exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      // Refresh if token expires in less than 24 hours
      if (timeUntilExpiry < 1000 * 60 * 60 * 24) {
        console.log('Token close to expiring, refreshing...');
        const newToken = await this.auth.refreshToken(this.token);
        if (newToken instanceof Error) {
          throw new AuthenticationError('Failed to refresh token');
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
    if (mspList.list.length === 0) {
      throw new ConnectionError('No MSPs found');
    }
    this.systemID = mspList.list[0].mspSystemId;
  }

  // Pumps

  async getPumps(): Promise<Pump[]> {
    const { filters } = await this.requestTelemetryData();
    return filters;
  }

  async getPumpSpeed(pump: Pump): Promise<Percentage>
  async getPumpSpeed(systemId: number): Promise<Percentage>
  async getPumpSpeed(pumpOrId: Pump | number): Promise<Percentage> 
  {
    const systemId = typeof pumpOrId === 'number' ? pumpOrId : pumpOrId.systemId;

    const { filters } = await this.requestTelemetryData();

    if (!filters || filters.length === 0) {
      throw new EquipmentError('no pumps found');
    }

    const filter = filters.find(f => f.systemId === systemId);

    if (!filter) {
      throw new EquipmentError('unable to get pump speed');
    }

    return filter.filterSpeed;
  }

  async setPumpOn(pump: Pump): Promise<boolean> {
    return this.setEquipmentState(pump.systemId, pump.lastSpeed);
  }

  async setPumpSpeed(systemId: number, speed: number): Promise<boolean>
  async setPumpSpeed(pump: Pump, speed: Percentage): Promise<boolean>
  async setPumpSpeed(pumpOrId: Pump | number, speed: number): Promise<boolean> {
    const systemId = typeof pumpOrId === 'number' ? pumpOrId : pumpOrId.systemId;
    if (speed < 0 || speed > 100) {
      throw new ValidationError('Speed is a percentage, should be between 0 and 100');
    }
    return this.setEquipmentState(systemId, speed);
  }

  // Heaters

  async getHeaters(): Promise<Heater[]> {
    const { virtualHeaters } = await this.requestTelemetryData();
    return virtualHeaters;
  }

  async setHeaterTemperature(heater: Heater, targetTemperature: Farhenheit): Promise<boolean>;
  async setHeaterTemperature(systemId: number, targetTemperature: Farhenheit): Promise<boolean>;
  async setHeaterTemperature(heaterOrId: Heater | number, targetTemperature: Farhenheit): Promise<boolean> {
    const systemId = typeof heaterOrId === 'number' ? heaterOrId : heaterOrId.systemId;

    if (targetTemperature < 50 || targetTemperature > 105) {
      throw new ValidationError('Target temperature must be between 40 and 105 degrees Fahrenheit');
    }

    if (!this.equipmentPoolMap.has(systemId)) {
      await this.updateEquipmentBodyMap();
    }

    if (!this.systemID) {
      throw new ConnectionError('System ID not set, did you call `connect()`?');
    }

    const poolId = this.equipmentPoolMap.get(systemId);
    if (!poolId) {
      throw new EquipmentError(`Could not find equipment ${systemId}`);
    }

    const payload = {
      Request: {
        Name: 'SetUIHeaterCmd',
        Parameters: {
          Parameter: [
            tokenTag(this.token.token),
            systemTag(this.systemID!),
            poolTag(poolId),
            heaterTag(systemId),
            tempTag(targetTemperature),
          ],
        },
      },
    };
    const data = await sendRequest(payload);
    const { status } = parseCommandData(data);

    if (status == 0) {
      this.clearTelemetryCache();
    }

    return status == 0;
  }

  async setHeaterState(heater: Heater, on: boolean): Promise<boolean>;
  async setHeaterState(systemId: number, on: boolean): Promise<boolean>;
  async setHeaterState(heaterOrId: Heater | number, on: boolean): Promise<boolean> {
    const systemId = typeof heaterOrId === 'number' ? heaterOrId : heaterOrId.systemId;
    const isOn = on === true ? 'true' : 'false';

    if (!this.equipmentPoolMap.has(systemId)) {
      await this.updateEquipmentBodyMap();
    }

    if (!this.systemID) {
      throw new ConnectionError('System ID not set, did you call `connect()`?');
    }

    const poolId = this.equipmentPoolMap.get(systemId);
    if (!poolId) {
      throw new EquipmentError(`Could not find equipment ${systemId}`);
    }

    const payload = {
      Request: {
        Name: 'SetHeaterEnable',
        Parameters: {
          Parameter: [
            tokenTag(this.token.token),
            systemTag(this.systemID!),
            poolTag(poolId),
            heaterTag(systemId),
            enabledTag(isOn),
          ],
        },
      },
    };
    const data = await sendRequest(payload);
    const { status } = parseCommandData(data);

    if (status == 0) {
      this.clearTelemetryCache();
    }

    return status == 0;
  }

  async getWaterTemperature(): Promise<WaterTemperature> {
    const { bodiesOfWater, virtualHeaters, heaters, filters } = await this.requestTelemetryData();

    if (!bodiesOfWater || bodiesOfWater.length === 0) {
      throw new Error('unable to get bodies of water'); // TODO: this should be a connection error
    }

    const index = filters.findIndex(f => f.filterSpeed > 0);
    if (index === -1) {
      throw new Error('no pump running'); // TODO: this should be a connection error
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

  async getLightState(light: Light): Promise<boolean>;
  async getLightState(systemId: number): Promise<boolean>;
  async getLightState(lightOrId: Light | number): Promise<boolean> {
    const { colorLogicLights } = await this.requestTelemetryData();
    const systemId = typeof lightOrId === 'number' ? lightOrId : lightOrId.systemId;
    // 0: off, 4: powering on, 6: on 7: powering off,
    return colorLogicLights.filter(l => l.systemId == systemId)[0]?.lightState == 6;
  }

  async setLightState(light: Light, on: boolean): Promise<boolean>
  async setLightState(systemId: number, on: boolean): Promise<boolean>
  async setLightState(lightOrId: Light | number, on: boolean): Promise<boolean> {
    const systemId = typeof lightOrId === 'number' ? lightOrId : lightOrId.systemId;
    return await this.setEquipmentState(systemId, on ? 1 : 0);
  }

  protected async setEquipmentState(equipmentId: number, value: number): Promise<boolean> {
    // If we don't have the mapping yet, update it
    if (!this.equipmentPoolMap.has(equipmentId)) {
      await this.updateEquipmentBodyMap();
    }

    if (!this.systemID) {
      throw new ConnectionError('System ID not set, did you call `connect()`?');
    }

    const poolId = this.equipmentPoolMap.get(equipmentId);
    if (!poolId) {
      throw new EquipmentError(`Could not find equipment ${equipmentId}`);
    }

    const payload = {
      Request: {
        Name: 'SetUIEquipmentCmd',
        Parameters: {
          Parameter: [
            tokenTag(this.token.token),
            systemTag(this.systemID),
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
    const success = status == 0;
    if (success) {
      this.clearTelemetryCache();
    }
    return success;
  }

  protected async requestTelemetryData(): Promise<StatusResponse> {
    if (!this.systemID) {
      throw new ConnectionError('System ID not set, did you call `connect()`?');
    }

    const now = Date.now();
    const cacheAge = (now - this.lastTelemetryFetch) / 1000; // Convert to seconds

    // Return cached data if it's still valid
    if (this.telemetryCache && cacheAge < this.cacheValiditySeconds) {
      return this.telemetryCache;
    }

    const payload = {
      Request: {
        Name: `RequestTelemetryData`,
        Parameters: {
          Parameter: [tokenTag(this.token.token), systemTag(this.systemID)],
        },
      },
    };

    const data = await sendRequest(payload);
    const response = parseTelemetryData(data);

    // Update cache
    this.telemetryCache = response;
    this.lastTelemetryFetch = now;

    return response;
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

  // Add method to clear cache
  public clearTelemetryCache(): void {
    this.telemetryCache = null;
    this.lastTelemetryFetch = 0;
  }

  // Add method to force refresh telemetry
  public async refreshTelemetry(): Promise<StatusResponse> {
    this.clearTelemetryCache();
    return this.requestTelemetryData();
  }
}

export default OmniLogic;
