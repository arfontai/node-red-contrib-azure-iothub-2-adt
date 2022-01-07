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

## Sample 1 - Publish IoT Hub D2C messages as Telemetry

Let's start with a simple flow where we receive Device to Cloud messages from our Azure IoT Hub we publish as telemetry to the according Twin at Azure Digital Twins. In this example we pick three nodes. The IoT Hub Receiver, the change node we use to set the **TwinId** value to the **DeviceId** observed on IoT Hub, and the ADTTwinLifecycle node we configure to with the 'Push telemetry' operation. You will find the flow below, enriched with log modules.<br />

[![Scenario1](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario1.png "Publish IoT Hub D2C messages as Telemetry")](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario1.png "Publish IoT Hub D2C messages as Telemetry")

The JSON for this flow

```shell
[{"id":"46d3a66181399937","type":"azureiothubreceiver","z":"96bd88c9e5850c22","Name":"","IOTHUBConnection":"","x":180,"y":1160,"wires":[["a6a0671d79e880f3","b16c3eedbd1331e9"]]},{"id":"a6a0671d79e880f3","type":"debug","z":"96bd88c9e5850c22","name":"log IoTHub D2C messages","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","statusVal":"","statusType":"auto","x":620,"y":1100,"wires":[]},{"id":"2b9ee9dd59e9376b","type":"adttwinlifecycle","z":"96bd88c9e5850c22","Name":"Publish Telemetry","ADTConnection":"","operationtype":"publish","model":"","deleterelationships":false,"propmappings":[],"tagmappings":[],"x":810,"y":1220,"wires":[["0c402604842122d2"]]},{"id":"0c402604842122d2","type":"debug","z":"96bd88c9e5850c22","name":"output Publish Telemetry","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","statusVal":"","statusType":"auto","x":1090,"y":1220,"wires":[]},{"id":"3163681b651e32c0","type":"comment","z":"96bd88c9e5850c22","name":"Receiving D2C messages","info":"","x":190,"y":1100,"wires":[]},{"id":"b16c3eedbd1331e9","type":"change","z":"96bd88c9e5850c22","name":"","rules":[{"t":"set","p":"twinId","pt":"msg","to":"deviceId","tot":"msg"}],"action":"","property":"","from":"","to":"","reg":false,"x":520,"y":1220,"wires":[["2b9ee9dd59e9376b"]]}]
```

## Sample 2 - Patch a Twin from a D2C message

We now extend the flow we created through the Sample 1, with nodes used to patch Digital Twin parameters from values read into the D2C message. The first step is to add a new change property in the existing Change node. In our example (refer to **2 - How to easily send Device to Cloud messages** in the Prerequisites section to play with the D2C message structure) we extract the Temperature value from the D2C payload, we associate to the property 'TargetTemperature'. Because the ADTTwinLifecycle uses the reportedProperties array as an input to patch the Digital Twin at ADT, we simply add our Property/Value element to the array with the following expression.<br />

[![Scenario2changeNode](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario2changeNode.png "Change Node configuration")](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario2changeNode.png "Change Node configuration")

The second step is to add a new ADTTwinLifecycle module to our flow. The existing one will still push the D2C message as telemetry to the Twin. This new instance will have the responsability to patch the Twin itself. Notice we could either operate these two instances in parallel or in sequence, what we are going to do there. To finish the configuration we set the operation to 'Update Twin' on the newly added ADTTwinLifecycle module.<br />

[![Scenario2](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario2.png "Patch a Twin from a D2C message")](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario2.png "Patch a Twin from a D2C message")

The JSON for this flow

```shell
[{"id":"46d3a66181399937","type":"azureiothubreceiver","z":"96bd88c9e5850c22","Name":"","IOTHUBConnection":"","x":180,"y":1160,"wires":[["a6a0671d79e880f3","b16c3eedbd1331e9"]]},{"id":"a6a0671d79e880f3","type":"debug","z":"96bd88c9e5850c22","name":"log IoTHub D2C messages","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","statusVal":"","statusType":"auto","x":620,"y":1100,"wires":[]},{"id":"2b9ee9dd59e9376b","type":"adttwinlifecycle","z":"96bd88c9e5850c22","Name":"Update TWIN","ADTConnection":"","operationtype":"update","model":"","deleterelationships":false,"propmappings":[],"tagmappings":[],"x":800,"y":1220,"wires":[["0c402604842122d2","4b42695859f0f280"]]},{"id":"0c402604842122d2","type":"debug","z":"96bd88c9e5850c22","name":"output Update Twin","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","statusVal":"","statusType":"auto","x":1090,"y":1100,"wires":[]},{"id":"3163681b651e32c0","type":"comment","z":"96bd88c9e5850c22","name":"Receiving D2C messages","info":"","x":190,"y":1100,"wires":[]},{"id":"b16c3eedbd1331e9","type":"change","z":"96bd88c9e5850c22","name":"","rules":[{"t":"set","p":"twinId","pt":"msg","to":"deviceId","tot":"msg"},{"t":"set","p":"reportedProperties","pt":"msg","to":"$append(\t   reportedProperties,\t   {\t       \"property\":\"TargetTemperature\",\t       \"value\": d2cMessage.temperatureSensor[1].data[0].temperature\t   }\t)","tot":"jsonata"}],"action":"","property":"","from":"","to":"","reg":false,"x":520,"y":1220,"wires":[["2b9ee9dd59e9376b"]]},{"id":"4b42695859f0f280","type":"adttwinlifecycle","z":"96bd88c9e5850c22","Name":"publish Telemetry","ADTConnection":"","operationtype":"publish","model":"","deleterelationships":false,"propmappings":[],"tagmappings":[],"x":1110,"y":1220,"wires":[["83168856cbc115e7"]]},{"id":"83168856cbc115e7","type":"debug","z":"96bd88c9e5850c22","name":"output Publish Telemetry","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","statusVal":"","statusType":"auto","x":1410,"y":1100,"wires":[]}]
```

## Sample 3 - Patch Twins and Create Relationships from Device twin updates

In this sample we are going to reuse the Twin update capabiities of our ADTTwinLifecycle module when we trigger this time a Device Twin update at Azure IoT Hub. By update we either consider a change on a reported property or a tag. **We decided to associate Reported properties with Twin properties, and Tags with relationships between Twins.** 
(refer to **1 - How to easily send Device Twin updates** in the Prerequisites section to understand the Device twin structure we use for this sample).

Before configuring your nodes, you may have to apply some change to your IoT Hub, so that you route your Device Twin updates to an Event Hub. We will indeed use an Event Hub receiver node, to play with the Device twin updates. THis note will help you to configure your IoT Hub: https://docs.microsoft.com/en-us/azure/iot-hub/iot-hub-devguide-messages-d2c#non-telemetry-events.

This initial step being done, we will start our flow by picking one Event Huve Receiver node. After extratcting the Device Id, we will use our ADTTwinLifecycle module to check if a Twin based on the Device Id exists at ADT. If not we create a new Twin and then apply the updates from the Reported properties and Tags received. Because properties names may differ from Azure IoT Hub to Azure Digital Twins, we added a mapping tab on our ADTTwinLifecycle module.

In this tab we specify that a property 'Temperature' on the Device Twin from IoT Hub should be mapped to a property 'TargetTemperature' at ADT.<br />

[![Scenario3propMapping](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario3propMapping.png "Properties mapping")](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario3propMapping.png "Properties mapping")

In this tab we specify that a tag 'floor' on the Device Twin from IoT Hub should be mapped to a relationship 'controlsTemperature' at ADT. The target of the relationship (a Digital Twin Id) being the value associated with tag.<br />

[![Scenario3tagMapping](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario3tagMapping.png "Tag mapping")](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario3tagMapping.png "Tag mapping")

Here is the full flow enriched with switch and debug nodes.<br />

[![Scenario3](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario3.png "Patch Twins and Create Relationships from Device twin updates")](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario3.png "Patch Twins and Create Relationships from Device twin updates")

The JSON for this flow

```shell
[{"id":"fdf15d3254342901","type":"azureeventhubreceiver","z":"96bd88c9e5850c22","Name":"Device Twin update receiver","ConnectionString":"","HubName":"devicetwinevents","ConsumerGroup":"node","x":180,"y":820,"wires":[["35511f8a763cd5d7","fd1fdaced0088d7a"]]},{"id":"35511f8a763cd5d7","type":"debug","z":"96bd88c9e5850c22","name":"EventHub receiver","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","statusVal":"","statusType":"auto","x":470,"y":740,"wires":[]},{"id":"d1786885ee71a83a","type":"adttwinlifecycle","z":"96bd88c9e5850c22","Name":"Update Twin","ADTConnection":"","operationtype":"update","model":"","deleterelationships":false,"propmappings":[{"iotHubName":"Temperature","adtName":"TargetTemperature"}],"tagmappings":[{"iotHubName":"floor","adtName":"controlsTemperature"}],"x":1070,"y":920,"wires":[["2d37efc607af560b"]]},{"id":"2d37efc607af560b","type":"debug","z":"96bd88c9e5850c22","name":"output UpdateTwin","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","statusVal":"","statusType":"auto","x":1350,"y":920,"wires":[]},{"id":"a88bf71e844b6e5e","type":"adttwinlifecycle","z":"96bd88c9e5850c22","Name":"Get Twin","ADTConnection":"","operationtype":"get","model":"","deleterelationships":false,"propmappings":[],"tagmappings":[],"x":620,"y":860,"wires":[["2f99b3edb0a5899b","c1e5370713afca8a"]]},{"id":"2f99b3edb0a5899b","type":"debug","z":"96bd88c9e5850c22","name":"output GetTwin","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","statusVal":"","statusType":"auto","x":820,"y":820,"wires":[]},{"id":"c1e5370713afca8a","type":"switch","z":"96bd88c9e5850c22","name":"","property":"status","propertyType":"msg","rules":[{"t":"cont","v":"Twin found","vt":"str"},{"t":"else"}],"checkall":"true","repair":false,"outputs":2,"x":630,"y":1000,"wires":[["d1786885ee71a83a"],["f24e39135ac587d2"]]},{"id":"71feac4d7cf3df66","type":"debug","z":"96bd88c9e5850c22","name":"output CreateTwin","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","statusVal":"","statusType":"auto","x":1350,"y":1040,"wires":[]},{"id":"bdc5aee359824371","type":"adttwinlifecycle","z":"96bd88c9e5850c22","Name":"Create Twin","ADTConnection":"","operationtype":"create","model":"dtmi:samples:Building;1","deleterelationships":false,"propmappings":[],"tagmappings":[],"x":1070,"y":1040,"wires":[["71feac4d7cf3df66","d1786885ee71a83a"]]},{"id":"4751588c024d8063","type":"comment","z":"96bd88c9e5850c22","name":"Receiving Device Twin updates through IoT Hub routing.","info":"","x":260,"y":700,"wires":[]},{"id":"fd1fdaced0088d7a","type":"change","z":"96bd88c9e5850c22","name":"","rules":[{"t":"set","p":"twinId","pt":"msg","to":"deviceId","tot":"msg"}],"action":"","property":"","from":"","to":"","reg":false,"x":440,"y":860,"wires":[["a88bf71e844b6e5e"]]},{"id":"f24e39135ac587d2","type":"change","z":"96bd88c9e5850c22","name":"","rules":[{"t":"set","p":"model","pt":"msg","to":"dtmi:samples:HVAC;1","tot":"str"}],"action":"","property":"","from":"","to":"","reg":false,"x":860,"y":1040,"wires":[["bdc5aee359824371"]]}]
```

## Scenario 4 - Get ADT Model definition

In this last sample we demonstrate the usage of the model API from ADT. As a first step we use a change node to set the model we will look for. THe second step is to add our ADTModelLifecycle module with the operation set to 'Find Model'. Here is the full flow.<br />

[![Scenario4](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario4.png "Get ADT Model definition")](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/Scenario4.png "Get ADT Model definition")

The JSON for this flow

```shell
[{"id":"542c60bd1e7c992b","type":"inject","z":"96bd88c9e5850c22","name":"","props":[{"p":"payload"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":"","topic":"","payloadType":"date","x":1080,"y":240,"wires":[["708105848a2493a7"]]},{"id":"406e2cc514ee05c8","type":"debug","z":"96bd88c9e5850c22","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","statusVal":"","statusType":"auto","x":1730,"y":240,"wires":[]},{"id":"f2d263cb9de048ec","type":"adtmodellifecycle","z":"96bd88c9e5850c22","Name":"Get model","ADTConnection":"","operationtype":"get","x":1530,"y":240,"wires":[["406e2cc514ee05c8"]]},{"id":"beb7be3478ed4464","type":"comment","z":"96bd88c9e5850c22","name":"Get ADT Model","info":"","x":1080,"y":180,"wires":[]},{"id":"708105848a2493a7","type":"change","z":"96bd88c9e5850c22","name":"","rules":[{"t":"set","p":"model","pt":"msg","to":"\"dtmi:samples:Building;1\"","tot":"str"}],"action":"","property":"","from":"","to":"","reg":false,"x":1300,"y":240,"wires":[["f2d263cb9de048ec"]]}]
```

# Related GitHub projects
Great Node project to simulate an Azure IoT Device: https://github.com/iotblackbelt/node-red-contrib-azure-iot-device<p>
Sample Node app to ingest data from IoT Hub: https://github.com/Azure-Samples/web-apps-node-iot-hub-data-visualization<p>
Azure IoT Hub SDK for Node: https://github.com/Azure/azure-iot-sdk-node<p>
