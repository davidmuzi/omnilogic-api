import type {
  ColorLogicLightStatus as Light,
  FilterStatus as Pump,
  VirtualHeaterStatus as Heater,
} from './Response.js';

export interface OmniLogicAPI {
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

export type Farhenheit = number;
export type Percentage = number;

export type WaterTemperature = {
  current: Farhenheit;
  target: Farhenheit;
  heaterOn: boolean;
};
