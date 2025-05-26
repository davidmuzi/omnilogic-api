import { StatusResponse } from './TelemetryResponse.js';
import { sendRequest } from './sendRequest.js';
import { parseTelemetryData } from './parseTelemetryData.js';
import { OmniLogicAuth, type Token } from './Authentication.js';
import dotenv from 'dotenv';

dotenv.config();

class OmniLogic {
  private auth: OmniLogicAuth;
  private token: Token | null = null;

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
  
    return client;
  }

  static withToken(token: Token): OmniLogic {
    const auth = new OmniLogicAuth();
    const client = new OmniLogic(auth);
    client.token = token;

    // check if token is valid
    // setup token refresh

    return client;
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

  async getWaterTemperature(): Promise<number> {
    const { bodiesOfWater } = await this.requestTelemetryData();

    if (!bodiesOfWater || bodiesOfWater.length === 0) {
      throw new Error('unable to get water temperature');
    }

    for (const body of bodiesOfWater) {
      if (body.waterTemp > 0) {
        return body.waterTemp;
      }
    }

    throw new Error('unable to get water temperature');
  }

  async getLightState(): Promise<boolean> {
    const { colorLogicLights } = await this.requestTelemetryData();
    // 0: off, 4: powering on, 6: on 7: powering off,
    return colorLogicLights.some(light => light.lightState === 6);
  }

  async setLightState(on: boolean): Promise<boolean> {
    const isOn = on === true ? 1 : 0;

    const payload = {
      Request: {
        Name: 'SetUIEquipmentCmd',
        Parameters: {
          Parameter: [
            this.tokenTag(),
            this.systemTag(),
            this.tag('PoolID', process.env.POOL_ID),
            this.tag('EquipmentId', process.env.LIGHT_ID),
            this.tag('IsOn', isOn),
            ...this.emptyTimerTag(),
          ],
        },
      },
    };
    const data = await sendRequest(payload);

    // TODO: create a response object for this
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

  protected systemTag() {
    return this.tag('MspSystemID', process.env.MSP_SYSTEM_ID); // TODO: get these from telemetry api
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
      throw new Error(`Unsupported data type: ${typeof value}`, );
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

export default OmniLogic;
