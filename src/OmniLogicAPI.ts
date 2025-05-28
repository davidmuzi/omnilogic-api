import { StatusResponse } from './Response.js';
import { sendRequest } from './sendRequest.js';
import { parseTelemetryData, parseMSPList } from './parseResponse.js';
import { OmniLogicAuth, type Token } from './Authentication.js';
import type { ColorLogicLightStatus as Light, FilterStatus as Pump, VirtualHeaterStatus as Heater } from './Response.js';
import { jwtDecode } from 'jwt-decode';

interface OmniLogicAPI {
  getPumps(): Promise<Pump[]>;
  setPumpSpeed(pump: Pump, speed: number): Promise<boolean>;
  
  getWaterTemperature(): Promise<WaterTemperature>;

  getHeaters(): Promise<Heater[]>;
  setHeaterTemperature(heater: Heater, targetTemperature: Farhenheit): Promise<boolean>;
  setHeaterState(heater: Heater, on: boolean): Promise<boolean>;
  
  getLights(): Promise<Light[]>
  getLightState(light: Light): Promise<boolean>;
  setLightState(light: Light, on: boolean): Promise<boolean>;
}

type Farhenheit = number;

class OmniLogic implements OmniLogicAPI {
  private auth: OmniLogicAuth;
  private token: Token | null = null;
  private userID: number | null = null;
  private systemID: number | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;

  private constructor(auth: OmniLogicAuth) {
    this.auth = auth;
  }

  static async withCredentials(email: string, password: string): Promise<OmniLogic | Error> {
    const auth = new OmniLogicAuth();
    const result = await auth.login(email, password);

    if (result instanceof Error) {
      return result;
    }

    const client = new OmniLogic(auth);
    client.token = result;
    client.userID = result.userID;
    client.setupTokenRefresh()

    return client;
  }

  static withToken(token: Token, userID: number): OmniLogic {
    const auth = new OmniLogicAuth();
    const client = new OmniLogic(auth);
    client.token = token;
    client.userID = userID;

    client.setupTokenRefresh()

    return client;
  }

  setupTokenRefresh() {
    if (this.token === null) {
      throw new Error('No valid token available');
    }

    // Clear any existing interval
    this.clearTokenRefresh();

    // Set new interval
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

  async getPumpSpeed(): Promise<number> {
    const { filters } = await this.requestTelemetryData();

    if (!filters || filters.length === 0) {
      throw new Error('unable to get pump status');
    }

    for (const filter of filters) {
      if (filter.filterSpeed > 0) {
        return filter.filterSpeed;
      }
    }

    throw new Error('unable to get pump speed');
  }

  async setPumpSpeed(pump: Pump, speed: number): Promise<boolean> {
    if (speed < 0 || speed > 100) {
      throw new Error("Speed is a percentage, should be between 0 and 100");
    }

    const payload = {
      Request: {
        Name: "SetUIEquipmentCmd",
        Parameters: {
          Parameter: [
            this.tokenTag(),
            this.systemTag(),
            this.poolIdTag(),
            this.tag("EquipmentId", pump.systemId),
            this.tag("IsOn", speed),
            ...this.emptyTimerTag(),
          ],
        },
      },
    };

    const data = await sendRequest(payload);
    // TODO: create a response object for this
    return data?.Response?.Parameters?.Parameter[1]?.['#text'] === 'Successful';
  }

  // Heaters

  async getHeaters(): Promise<Heater[]> {
    const { virtualHeaters } = await this.requestTelemetryData();
    return virtualHeaters;
  }

  async setHeaterTemperature(heater: Heater, targetTemperature: Farhenheit): Promise<boolean> {
    if (targetTemperature < 50 || targetTemperature > 105) {
      throw new Error("Target temperature must be between 40 and 105 degrees Fahrenheit");
    }

    const payload = {
      Request: {
        Name: "SetUIHeaterCmd",
        Parameters: {
          Parameter: [
            this.tokenTag(),
            this.systemTag(),
            this.poolIdTag(),
            this.tag("HeaterID", heater.systemId),
            this.tag("Temp", targetTemperature),
          ],
        },
      },
    };
    const data = await sendRequest(payload);
    return data?.Response?.Parameters?.Parameter[1]?.['#text'] === 'Successful';
  }

  async setHeaterState(heater: Heater, on: boolean): Promise<boolean> {
    const isOn = on === true ? "true" : "false";

    const payload = {
      Request: {
        Name: 'SetHeaterEnable',
        Parameters: {
          Parameter: [
            this.tokenTag(),
            this.systemTag(),
            this.poolIdTag(),
            this.tag('HeaterID', heater.systemId),
            this.tag('Enabled', isOn),
            ...this.emptyTimerTag(),
          ],
        },
      },
    };
    const data = await sendRequest(payload);
    return data?.Response?.Parameters?.Parameter[1]?.['#text'] === 'Successful';
  }


  async getWaterTemperature(): Promise<WaterTemperature> {
    const { bodiesOfWater, virtualHeaters, heaters } = await this.requestTelemetryData();

    if (!bodiesOfWater || bodiesOfWater.length === 0) {
      throw new Error('unable to get water temperature');
    }

    for (let i = 0; i < bodiesOfWater.length; i++) {
      if (bodiesOfWater[i].waterTemp > 0) {
        return {
          current: bodiesOfWater[i].waterTemp,
          target: virtualHeaters[i].currentSetPoint,
          heaterOn: heaters[i].heaterState === 1
        }
      }
    }

    throw new Error('unable to get water temperature');
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
    const isOn = on === true ? 1 : 0;

    const payload = {
      Request: {
        Name: 'SetUIEquipmentCmd',
        Parameters: {
          Parameter: [
            this.tokenTag(),
            this.systemTag(),
            this.poolIdTag(),
            this.tag('EquipmentId', light.systemId),
            this.tag('IsOn', isOn),
            ...this.emptyTimerTag(),
          ],
        },
      },
    };
    const data = await sendRequest(payload);
    return data?.Response?.Parameters?.Parameter[1]?.['#text'] === 'Successful';
  }

  protected async requestTelemetryData(): Promise<StatusResponse> {
    const payload = {
      Request: {
        Name: `RequestTelemetryData`,
        Parameters: {
          Parameter: [this.tokenTag(), this.systemTag()],
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
          Parameter: [this.tokenTag(), this.userTag()],
        },
      },
    };
    const data = await sendRequest(payload);
    return parseMSPList(data);
  }

  protected systemTag() {
    if (!this.systemID) {
      throw new Error('No telemetry data available');
    }

    return this.tag('MspSystemID', this.systemID);
  }

  protected poolIdTag() {
    return this.tag('PoolID', 1 /* 2 for spa?*/);
  }

  protected userTag() {
    if (!this.userID) {
      throw new Error('No user ID available');
    }
    return this.tag('OwnerID', this.userID);
  }

  protected tokenTag() {
    if (!this.token) {
      throw new Error('No valid token available');
    }
    return this.tag('token', this.token.token);
  }

  protected tag<T>(name: string, value: T) {
    let _dataType: string;

    if (typeof value === 'number') {
      _dataType = Number.isInteger(value as number) ? 'int' : 'float';
    } else if (typeof value === 'string') {
      _dataType = 'string';
    } else if (typeof value === 'boolean') {
      _dataType = 'bool';
    } else {
      throw new Error(`Unsupported data type: ${typeof value}`);
    }

    return { '@_name': name, '@_dataType': _dataType, '#text': value };
  }

  protected emptyTimerTag() {
    return [
      this.tag('IsCountDownTimer', false),
      this.tag('StartTimeHours', 0),
      this.tag('StartTimeMinutes', 0),
      this.tag('EndTimeHours', 0),
      this.tag('EndTimeMinutes', 0),
      this.tag('DaysActive', 0),
      this.tag('Recurring', false),
    ];
  }
}

type WaterTemperature = {
  current: Farhenheit;
  target: Farhenheit;
  heaterOn: boolean;
}

export default OmniLogic;
