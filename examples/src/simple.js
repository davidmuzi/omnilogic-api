import OmniLogic from "omnilogic-api";

// Create a new OmniLogic instance with login credentials
const omniLogic = await OmniLogic.withCredentials("email", "p4ssw0rd");

// Must call connect to get access to the API
await omniLogic.connect();

// Get the first pump
const [ pump ] = await omniLogic.getPumps();

console.log(pump.filterSpeed);

process.exit(0);