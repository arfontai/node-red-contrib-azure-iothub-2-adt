# Azure IoT Hub to Digital Twins nodes

This library of Node-RED nodes can be used to simplify the way we connect Azure IoT Hub to Azure Digital Twins. The two scenarios we focus on for the moment are the synchronization of Device Twin updates from IoT Hub with Device updates at ADT, as well as D2C messages sent as telemetry attached to the Twin.

For the moment we introduced 4 modules + 1 for testing purpose
- **AzureIoTHubReceiver**: that connect to the Event-Hub built-in endpoint of Azure IoT Hub (through a configurable consumer group) and relies the D2C messages using 3 properties (d2cMessage, date, deviceId)
- **AzureEventHubReceiver**: that connect to an Event-Hub that receive Device Twin updates sent by Azure IoT Hub thanks to its routing capabilities. This module sends a message using 3 properties (update, hubName, deviceId)
- **ADTTwinLifecycle**: we use to create, update, delete, find or send telemetry to a Twin at ADT. We can configure this generic module to apply one single operation. Advanced parameters on this module can help define the mapping rules between IoT Hub properties/tags and ADT attributes and relationships.
- **ADTModelLifecycle**: we use to create, find or delete a model in ADT. We can configure this generic module to apply one single operation.

[![Example of flow](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/flow1.png "Example of flow")](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/flow1.png "Example of flow")

## Prerequisites
### Setup an Azure AD Service Principal
Our ADT Node-red modules authenticate to your ADT instance through and Azure AD Service Principal. If you didn't already created this Service Principal we will explain you how to do it and grant him the ADT Data Owner role to your ADT instance. More details on this page: https://docs.microsoft.com/en-us/azure/digital-twins/concepts-security

Here are the very few step you would have to do to setup your environment

1 - Create your Azure AD Service Principal

```shell
az ad sp create-for-rbac -n "yourApp"
```
Save the **appId** we will reuse as the clientId to authenticate against ADT :

{ <br />
     "appId": "xxxxxxxx-xxxx-xxxx-xxxxxxxxxxxx", <br />
     "displayName": "yourApp", <br />
  "name": "-----", <br />
  "password": "-----", <br />
  "tenant": "------" <br />
} <br />

2 -  Add a secret key to your Service Principal

```shell
az ad sp credential reset --name "yourApp" --end-date YYYY-MM-DD --credential-description "Node"
```
Save the **password** we will reuse as the clientSecret to authenticate against ADT :

{ <br />
  "appId": "xxxxxxxx-xxxx-xxxx-xxxxxxxxxxxx", <br />
  "name": "yourApp", <br />
  "password": "xxxxxxxx-xxxx-xxxx-xxxxxxxxxxxx", <br />
  "tenant": "------" <br />
} <br />

3 -  Grant ADT permissions to your Service Principal 

```shell
az dt role-assignment create --dt-name YourADTInstanceName --assignee "your_appId" --role "Azure Digital Twins Data Owner"
```
this output confirms all worked well : 

{ <br />
  "canDelegate": null, <br />
  "condition": null, <br />
  "conditionVersion": null, <br />
  "description": null, <br />
  "id": "....", <br />
  "name": "....", <br />
  "principalId": ".....", <br />
  "principalType": "ServicePrincipal", <br />
  "resourceGroup": ".....", <br />
  "roleDefinitionId": ".....", <br />
  "scope": ".....", <br />
  "type": "Microsoft.Authorization/roleAssignments" <br />
} <br />

### Prepare your test environment

1 - How to easily send Device Twin updates

To simplify your tests, we have created a node we called **Device Twin Sender**, you can use to send a Device Twin update to Azure IoT Hub. It will be shortly helpful when you will want to test cascadind of Digital Twin updates. You will see below a simple flow where we use this node.<br />
[![UpdateDeviceTwin](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario0sendDeviceTwin.png "update device Twin to IoT Hub")](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario0sendDeviceTwin.png "update device Twin to IoT Hub")

The JSON for this flow

```shell
[{"id":"b6d93c59d193d2c9","type":"inject","z":"96bd88c9e5850c22","name":"","props":[{"p":"payload"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":"","topic":"","payloadType":"date","x":160,"y":600,"wires":[["a5a72aec3b9860a2"]]},{"id":"8e510bdb2e89a68a","type":"debug","z":"96bd88c9e5850c22","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","targetType":"msg","statusVal":"","statusType":"auto","x":650,"y":600,"wires":[]},{"id":"a5a72aec3b9860a2","type":"azureiothubdevicetwinsender","z":"96bd88c9e5850c22","Name":"Twin sender","IOTHUBConnection":"","DeviceId":"TempSensor","TagsAndDesired":"{\n\t\"tags\": {\n\t\t\"floor\": \"Oxygene7\",\n\t\t\"vendor\": \"Schneider\"\n\t},\n\t\"properties\": {\n\t\t\"desired\": {\n    \t\t\"temperature\": 20\n\t\t}\n\t}\n}","ReportedProperties":"{\n  \"Temperature\": 75\n}","x":390,"y":600,"wires":[["8e510bdb2e89a68a"]]},{"id":"a43998d5bdce655a","type":"comment","z":"96bd88c9e5850c22","name":"Sending Device Twin Update","info":"","x":200,"y":540,"wires":[]}]
```

2 - How to easily send Device to Cloud messages

To simulate Device to Cloud messages sent to Azure IoT Hub, we recommand to use Visual Studio Code and its Azure IoT Tools extension. You need first to create your testing device at your Azure IoT Hub, then come back to Visual Studio Code, configure your connection to your Azure IoT Hub and select the **Send D2C Message to IoT Hub** from your device entry. Visual Studio Code proposes simple ways to edit the D2C message template (in how examples we add parameters we will map to Degital Twin attributes) and send a series of messages.<br />

[![Scenario0](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario0.png "Visual Studio Code")](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario0.png "Visual Studio Code")

# Getting Started

## Scenario 1 - Publish IoT Hub D2C messages as Telemetry

Let's start with a simple flow where we receive Device to Cloud messages from our Azure IoT Hub we publish as telemetry to the according Twin at Azure Digital Twins. In this example we pick three nodes. The IoT Hub Receiver, the change node we use to set the **TwinId** value to the **DeviceId** observed on IoT Hub, and the ADTTwinLifecycle node we configure to push telemetry. You will find the flow bellow, enriched with log modules.<br />

[![Scenario1](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario1.png "publish IoT Hub D2C messages as Telemetry")](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario1.png "publish IoT Hub D2C messages as Telemetry")

The JSON for this flow

```shell
[{"id":"46d3a66181399937","type":"azureiothubreceiver","z":"96bd88c9e5850c22","Name":"","IOTHUBConnection":"","x":180,"y":1160,"wires":[["a6a0671d79e880f3","b16c3eedbd1331e9"]]},{"id":"a6a0671d79e880f3","type":"debug","z":"96bd88c9e5850c22","name":"log IoTHub D2C messages","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","statusVal":"","statusType":"auto","x":620,"y":1100,"wires":[]},{"id":"2b9ee9dd59e9376b","type":"adttwinlifecycle","z":"96bd88c9e5850c22","Name":"Publish Telemetry","ADTConnection":"","operationtype":"publish","model":"","deleterelationships":false,"propmappings":[],"tagmappings":[],"x":810,"y":1220,"wires":[["0c402604842122d2"]]},{"id":"0c402604842122d2","type":"debug","z":"96bd88c9e5850c22","name":"output Publish Telemetry","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","statusVal":"","statusType":"auto","x":1090,"y":1220,"wires":[]},{"id":"3163681b651e32c0","type":"comment","z":"96bd88c9e5850c22","name":"Receiving D2C messages","info":"","x":190,"y":1100,"wires":[]},{"id":"b16c3eedbd1331e9","type":"change","z":"96bd88c9e5850c22","name":"","rules":[{"t":"set","p":"twinId","pt":"msg","to":"deviceId","tot":"msg"}],"action":"","property":"","from":"","to":"","reg":false,"x":520,"y":1220,"wires":[["2b9ee9dd59e9376b"]]}]
```

## Related GitHub projects
Great Node project to simulate an Azure IoT Device: https://github.com/iotblackbelt/node-red-contrib-azure-iot-device<p>
Sample Node app to ingest data from IoT Hub: https://github.com/Azure-Samples/web-apps-node-iot-hub-data-visualization<p>
Azure IoT Hub SDK for Node: https://github.com/Azure/azure-iot-sdk-node<p>
