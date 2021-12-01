module.exports = function(RED) 
{
	'use strict'
	const { ClientSecretCredential } = require("@azure/identity");
	const { DigitalTwinsClient } = require("@azure/digital-twins-core");
	const { inspect } = require("util");
	const { v4 } = require("uuid");
	const buildingTwin = require("./dtdl/digitalTwins/buildingTwin.json");
	const building = require("./dtdl/models/building.json");

	const EventHubReader = require('./scripts/iothub/event-hub-reader.js');

    function TwinCreate(config) {
        // Create the Node-RED node
        RED.nodes.createNode(this, config);
		const node = this;
		
		node.on('input', async function(msg) 
		{
			node.DigitalTwinsUrl = config.DigitalTwinsUrl;
			node.TenantId = config.TenantId;
			node.ClientId = config.ClientId;
			node.ClientSecret = config.ClientSecret;
			
			setStatus(node, statusEnum.disconnected);
			
			const credential = new ClientSecretCredential(node.TenantId, node.ClientId, node.ClientSecret);
			const serviceClient = new DigitalTwinsClient(node.DigitalTwinsUrl, credential);
			
			// Create model first
			try {
				const newModels = [building];
				const model = await serviceClient.createModels(newModels);
				
				setStatus(node, statusEnum.connected);
				
				console.log(`Model created.`);
				console.log(inspect(model));
			} catch (err) {
				console.log(`Model Already present`);
			}
			
			// Create digital twin based on the created model
			try {
				const digitalTwinId = `digitalTwin-${v4()}`;
				const newTwin = JSON.stringify(buildingTwin);
				const createdTwin = await serviceClient.upsertDigitalTwin(digitalTwinId, newTwin);
				
				console.log(`Twin created`);
				//TODO explore error below 
				console.log(inspect(createdTwin));

				//node.send(inspect(createdTwin));
			} catch (err) {
				error(node, err, 'Error while trying to create the Twin at ADT.');
                setStatus(node, statusEnum.error);
			}
        });
	}
	
	function AzureIoTHubReceiver(config) {
        // Create the Node-RED node
        RED.nodes.createNode(this, config);
		const node = this;

		node.ConnectionString = config.ConnectionString;
		node.ConsumerGroup = config.ConsumerGroup;

        this.client = null;
        this.reconnectTimer = null;

        setStatus(node, statusEnum.disconnected);

		try {
			const eventHubReader = new EventHubReader(node.ConnectionString, node.ConsumerGroup);
			
			(async () => {
				await eventHubReader.startReadMessage(node, (message, date, deviceId) => {
					try {
						setStatus(node, statusEnum.received);
						
						console.log('message: ' + JSON.stringify(message));
						console.log('date: ' + date);
						console.log('deviceId: ' + deviceId);
						
						const payload = {
							IoTData: message,
							MessageDate: date || Date.now().toISOString(),
							DeviceId: deviceId,
						};

						node.send(payload);
					} catch (err) {
						error(node, err, 'Error while trying to get a message from IoT Hub.');
						setStatus(node, statusEnum.error);
					}
				});
			})().catch();
		} catch (exception) {
			node.log(exception);
			console.log(exception);
			error(node, exception, 'Error while trying to connect to Event Hubs.');
            setStatus(node, statusEnum.error);
		}
    }
	
	///////////////////////////
	// Registration of Nodes //
	///////////////////////////
	
    RED.nodes.registerType("adttwincreate",TwinCreate, {
        defaults: {
			DigitalTwinsUrl: {value:"", required:true},
			TenantId: {value:"", required:true},
			ClientId: {value:"", required:true},
			ClientSecret: {value:"", required:true}
        }
	});
	
	RED.nodes.registerType("azureiothubreceiver", AzureIoTHubReceiver, {
        defaults: {
            Name: {value:"", required:false},
			ConnectionString: { value:"", required:true},
			ConsumerGroup: { value: "", required:true}
        }
    });
	
	///////////////////
	// Utils methods //
	///////////////////
	
	const statusEnum = {
        connected: { fill: "green", shape:"dot", text: "Connected" },
        connecting: { fill: "blue", shape:"dot", text: "Connecting" },
        provisioning: { fill: "blue", shape:"dot", text: "Provisioning" },
        disconnected: { fill: "red", shape:"dot", text: "Disconnected" },
		sent: { fill: "blue", shape:"dot", text: "Message Sent" },
        received: { fill: "yellow", shape:"dot", text: "Message Received" },
        error: { fill: "grey", shape:"dot", text: "Error" }
    };
	
	// Set status of node on node-red
    var setStatus = function (node, status) {
        node.status({ fill: status.fill, shape: status.shape, text: status.text });
    };
	
	// Send catchable error to node-red
    var error = function (node, payload, message) {
        var msg = {};
        msg.topic = 'error';
        msg.message = message;
        msg.payload = payload;
        node.error(msg);
    }
	
	function printResultFor(node, op) {
        return function printResult(err, res) {
            if (err) node.error(op + ' error: ' + err.toString());
            if (res) node.log(op + ' status: ' + res.constructor.name);
        };
    }
}