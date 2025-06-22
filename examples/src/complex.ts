import OmniLogic from "omnilogic-api";

// Connect with credentials
const omniLogic = await OmniLogic.withCredentials("email", "p4ssw0rd");
await omniLogic.connect();

const [ pump ] = await omniLogic.getPumps();

// Use the pump.systemId, token, and userID to connect to the API for later use
const { token, userID } = omniLogic;
const { systemId } = pump;

// later, you can use the token to connect to the API
const omniLogic2 = await OmniLogic.withToken(token, userID);

await omniLogic2.connect();

const speed = await omniLogic2.getPumpSpeed(systemId);

console.log("Pump speed:", speed);

process.exit(0);