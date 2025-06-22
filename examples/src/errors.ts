import OmniLogic, { AuthenticationError, ValidationError, ConnectionError, EquipmentError } from "omnilogic-api";

try {
    // Bad credentials will throw an AuthenticationError
    const omniLogic = await OmniLogic.withCredentials("email@example.com", "badpassword");

    // Not calling connect will throw a ConnectionError
    await omniLogic.connect();
    const [ pump ]= await omniLogic.getPumps();

    // Calling this will throw a ValidationError
    await omniLogic.setPumpSpeed(pump, 101)

    // Calling this with a bad pump id will throw a EquipmentError
    await omniLogic.setPumpSpeed(99, 50)

    process.exit(0);
} catch (error) {
    if (error instanceof AuthenticationError) {
        console.error('Authentication failed:', error.message);
    } else if (error instanceof ValidationError) {
        console.error('Validation error:', error.message);
    } else if (error instanceof ConnectionError) {
        console.error('Connection error:', error.message);
    } else if (error instanceof EquipmentError) {
        console.error('Equipment error:', error.message);
    } else {
        console.error('Unexpected error:', error);
    }

    process.exit(1);
}