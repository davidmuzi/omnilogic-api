# OmniLogic API
[![CI](https://github.com/davidmuzi/omnilogic-api/actions/workflows/node.js.yml/badge.svg)](https://github.com/davidmuzi/omnilogic-api/actions/workflows/node.js.yml)


JS Library to control Hayward OmniLogic pool controllers

## Using the API

```ts
const omniLogic = await OmniLogic.withCredentials("email@login.com", "p4ssw0rd");

await omniLogic.connect();

// Get the pump speed, in % of max rpm
const pumps = await omniLogic.getPumps();
const pumpSpeed = await omniLogic.getPumpSpeed(pumps[0]);
console.log(pumpSpeed);

// Get water temperature
onst { current, target, heaterOn } = await omniLogic.getWaterTemperature();
console.log(`Current temp: ${current} °F, Target: ${target} °F, Heater is ${ heaterOn ? 'on' : 'off'}`);

// Turn lights on
const lights = await omniLogic.getLights()
const result = await omniLogic.setLightState(lights[0], true);
console.log("Light turned on: ", result ? "success" : "failed")
```
