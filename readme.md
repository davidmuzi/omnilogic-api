# OmniLogic API

JS Library to control Hayward OmniLogic pool controllers

## Using the api

```ts
const omniLogic = await OmniLogic.withCredentials("email@login.com", "p4ssw0rd");

await omniLogic.connect();

const pumpSpeed = await omniLogic.getPumpSpeed();
console.log(pumpSpeed);

const temperature = await omniLogic.getWaterTemperature();
console.log(JSON.stringify(temperature, null, 2));

```