# Azure IoT Hub to Digital Twins nodes

This library of Node-RED nodes can be used to simplify the way we connect Azure IoT Hub (using one of its Event Hubs consumer group) to Azure Digital Twins.

For the moment we introduced two modules (more to come)
- IoTHubReceiver: that connect to Azure IoT Hub and send a structure with 2 properties (IoTData, MessageDate, DeviceId)
- ADTTwinCreate: that create a Twin at Azure Digital Twins

## Related GitHub projects
Great Node project to simulate an Azure IoT Device: https://github.com/iotblackbelt/node-red-contrib-azure-iot-device<p>
Sample Node app to ingest data from IoT Hub: https://github.com/Azure-Samples/web-apps-node-iot-hub-data-visualization<p>
Azure IoT Hub SDK for Node: https://github.com/Azure/azure-iot-sdk-node<p>
