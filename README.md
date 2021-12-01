# Azure IoT Hub to Digital Twins nodes

This library of Node-RED nodes can be used to simplify the way we connect Azure IoT Hub (using one of its Event Hubs consumer group) to Azure Digital Twins.

For the moment we introduced two modules (more to come)
- IoTHubReceiver: that connect to Azure IoT Hub and send a structure with 2 properties (IoTData, MessageDate, DeviceId)
- ADTTwinCreate: that create a Twin at Azure Digital Twins

## Related GitHub projects
https://github.com/iotblackbelt/node-red-contrib-azure-iot-device
https://github.com/Azure-Samples/web-apps-node-iot-hub-data-visualization![image](https://user-images.githubusercontent.com/64192034/144268615-7939a642-fd01-42de-95c7-7bb02b5d5bd3.png)
https://github.com/Azure/azure-iot-sdk-node

