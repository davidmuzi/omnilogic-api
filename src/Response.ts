export interface StatusResponse {
  version: string;
  backyard: BackyardStatus;
  bodiesOfWater: BodyOfWater[];
  filters: FilterStatus[];
  virtualHeaters: VirtualHeaterStatus[];
  heaters: HeaterStatus[];
  chlorinators: ChlorinatorStatus[];
  colorLogicLights: ColorLogicLightStatus[];
  csads: CSADStatus[];
  groups: GroupStatus[];
}

export interface BackyardStatus {
  systemId: number;
  statusVersion: number;
  airTemp: number;
  status: number;
  state: number;
  mspVersion: string;
  configUpdatedTime: string;
  datetime: string;
  messageVersion: string;
}

export interface BodyOfWater {
  systemId: number;
  flow: number;
  waterTemp: number;
}

export interface FilterStatus {
  systemId: number;
  valvePosition: number;
  filterSpeed: number;
  filterState: number;
  whyFilterIsOn: number;
  fpOverride: number;
  lastSpeed: number;
}

export interface VirtualHeaterStatus {
  systemId: number;
  currentSetPoint: number;
  enable: boolean;
  solarSetPoint: number;
  mode: number;
}

export interface HeaterStatus {
  systemId: number;
  heaterState: number;
  temp: number;
  enable: boolean;
  priority: number;
  maintainFor: number;
}

export interface ChlorinatorStatus {
  systemId: number;
  operatingMode: number;
  timedPercent: number;
  operatingState: number;
  scMode: number;
  chlrError: number;
  chlrAlert: number;
  avgSaltLevel: number;
  instantSaltLevel: number;
  status: number;
  enable: boolean;
}

export interface ColorLogicLightStatus {
  systemId: number;
  lightState: number;
  currentShow: number;
  speed: number;
  brightness: number;
  specialEffect: number;
}

export interface CSADStatus {
  systemId: number;
  ph: string | null;
  orp: string | null;
  status: string | null;
  mode: string | null;
}

export interface GroupStatus {
  systemId: number;
  groupState: number;
}

export interface MSPListResponse {
  status: number;
  statusMessage: string;
  list: MSPItem[];
}

export interface MSPItem {
  mspSystemId: number;
  backyardName: string;
  address: string;
  messageVersion: string;
  needShowPopupMessage: boolean;
}

export interface CommandResponse {
  name: string;
  status: number;
  statusMessage: string;
}
