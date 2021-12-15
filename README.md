# Azure IoT Hub to Digital Twins nodes

This library of Node-RED nodes can be used to simplify the way we connect Azure IoT Hub to Azure Digital Twins. The two scenarios we focus on for the moment are the synchronization of Device Twin updates from IoT Hub with Device updates at ADT, as well as D2C messages sent as telemetry attached to the Twin.

For the moment we introduced 4 modules + 1 for testing purpose
- **AzureIoTHubReceiver**: that connect to the Event-Hub built-in endpoint of Azure IoT Hub (through a configurable consumer group) and relies the D2C messages using 3 properties (d2cMessage, date, deviceId)
- **AzureEventHubReceiver**: that connect to an Event-Hub that receive Device Twin updates sent by Azure IoT Hub thanks to its routing capabilities. This module sends a message using 3 properties (update, hubName, deviceId)
- **ADTTwinLifecycle**: we use to create, update, delete, find or send telemetry to a Twin at ADT. We can configure this generic module to apply one single operation. Advanced parameters on this module can help define the mapping rules between IoT Hub properties/tags and ADT attributes and relationships.
- **ADTModelLifecycle**: we use to create, find or delete a model in ADT. We can configure this generic module to apply one single operation.

[![Example of flow](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/flow1.png "Example of flow")](https://github.com/arfontai/node-red-contrib-azure-iothub-2-adt/blob/main/images/flow1.png "Example of flow")

## Prerequisites

To connect our ADT modules to your ADT instance, you will need to set up an Azure AD Service Principal and grant him the ADT Data Owner role at your ADT instance. More details on this page: https://docs.microsoft.com/en-us/azure/digital-twins/concepts-security

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


## Related GitHub projects
Great Node project to simulate an Azure IoT Device: https://github.com/iotblackbelt/node-red-contrib-azure-iot-device<p>
Sample Node app to ingest data from IoT Hub: https://github.com/Azure-Samples/web-apps-node-iot-hub-data-visualization<p>
Azure IoT Hub SDK for Node: https://github.com/Azure/azure-iot-sdk-node<p>
