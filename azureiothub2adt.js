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
	const DeviceTwinHandler = require('./scripts/iothub/device-twin-handler.js');

	function ModelLifecycle(config) {
        RED.nodes.createNode(this, config);
		const node = this;
	
		node.ADTConnection = RED.nodes.getNode(config.ADTConnection);
		node.operationtype = config.operationtype;
		setStatus(node, statusEnum.disconnected);
		
		node.on('input', async function(msg) 
		{
			setStatus(node, statusEnum.connecting);
			
			const credential = new ClientSecretCredential(node.ADTConnection.TenantId, node.ADTConnection.ClientId, node.ADTConnection.ClientSecret);
			const serviceClient = new DigitalTwinsClient(node.ADTConnection.DigitalTwinsUrl, credential);
			
			setStatus(node, statusEnum.connected);
			const digitalTwinId = msg.twinId;
			var output;

			switch (node.operationtype) {
				case "create":
					try {
						// const newModels = [building];
						// const model = await serviceClient.createModels(newModels);

						const newModels = [msg.models];
						const result = await serviceClient.createModels(newModels);
						
						msg.models = result.body;
						msg.status = 'Models created';
						msg.trace = msg.trace + ' ,' + msg.status + ' with definition: ' + msg.models;
						node.send(msg);
						console.log(msg.status + ' : ' + inspect(result.body));
					} catch (err) {
						output = `Model Already present`;
						error(node, err, output);
						setStatus(node, statusEnum.error);
					}
					break;
				case "get":
					try {
						const modelId = msg.modelId;
						const model = await serviceClient.getModel(modelId);
	
						msg.model = model;
						msg.status = 'Model found';
						msg.trace = msg.trace + ' ,' + msg.status + ' with definition: ' + inspect(model);
						node.send(msg);
						console.log(msg.status + ' : ' + inspect(model));
					} catch (err) {
						msg.status = 'Model not found';
						msg.trace = msg.trace + ' ,' + msg.status;
						node.send(msg);
						console.log(msg.status + ' : ' + digitalTwinId);
					}
					break;				
				case "delete":
					try {
						const modelId = msg.modelId;
						const result = await serviceClient.deleteModel(modelId);
						
						msg.status = 'Model deleted';
						msg.trace = msg.trace + ' ,' + msg.status + ' : ' + result;
						node.send(msg);
						console.log(msg.status + ' : ' + inspect(result));
					} catch (err) {
						output = 'Error while trying to delete the Model at ADT. Does the model exist?';
						error(node, err, output);
						setStatus(node, statusEnum.error);
					}
			}
        });
	}

    function TwinLifecycle(config) {
        RED.nodes.createNode(this, config);
		const node = this;
	
		node.ADTConnection = RED.nodes.getNode(config.ADTConnection);
		node.operationtype = config.operationtype;
		node.model = config.model;
		node.deleterelationships = config.deleterelationships;
		node.propmappings = config.propmappings;
		node.tagmappings = config.tagmappings;
		setStatus(node, statusEnum.disconnected);

		node.on('input', async function(msg) 
		{
			setStatus(node, statusEnum.connecting);
			
			const credential = new ClientSecretCredential(node.ADTConnection.TenantId, node.ADTConnection.ClientId, node.ADTConnection.ClientSecret);
			const serviceClient = new DigitalTwinsClient(node.ADTConnection.DigitalTwinsUrl, credential);
			
			// Create digital twin based on the created model
			setStatus(node, statusEnum.connected);
			const digitalTwinId = msg.twinId;
			var output;

			switch (node.operationtype) {
				case "create":
					try {
						var model = (msg.model==null) ? node.model : msg.model;
						let json = {
							'$metadata': {
								'$model': model
							}
						};
						
						var result = await serviceClient.upsertDigitalTwin(digitalTwinId, JSON.stringify(json));

						msg.twin = result.body;
						msg.status = 'Twin created';
						msg.trace = msg.trace + ' ,' + msg.status + ' with definition: ' + msg.twin;
						node.send(msg);
						console.log(msg.status + ' : ' + inspect(result.body));
					} catch (err) {
						output = 'Error while trying to create the Twin at ADT.';
						error(node, err, output);
						setStatus(node, statusEnum.error);
					}
					break;

				case "get":
					try {
						var result  = await serviceClient.getDigitalTwin(digitalTwinId);

						msg.twin = result.body;
						msg.twinId = result.body.$dtId;
						msg.status = 'Twin found';
						msg.trace = msg.trace + ' ,' + msg.status + ' with definition: ' + inspect(msg.twin);
						node.send(msg);
						console.log(msg.status + ' : ' + inspect(result.body));
					} catch (err) {
						msg.status = 'Twin not found';
						msg.trace = msg.trace + ' ,' + msg.status;
						node.send(msg);
						console.log(msg.status + ' : ' + digitalTwinId);

						// output = 'Error while trying to find the Twin at ADT. Does the twin exist?';
						// payload = null;
						
						// for the moment we don't raise an exception when we don't find the Twin at ADT
						// error(node, err, output);
						// setStatus(node, statusEnum.error);
					}
					break;

				case "update":
					try {				
						//we synchronize reported properties from Device Twin at IoT Hub with Twin attributes at ADT
						if (msg.reportedProperties!=null) {
							let updates = [];
							msg.reportedProperties.forEach(prop => {
								
								console.log('property :' + prop);
								
								const adtAttribute = node.propmappings.find(mapping => mapping.iotHubName==prop.property);
								var updateAttributePath;
								if(adtAttribute!=null) {
									updateAttributePath = "/" + adtAttribute.adtName;
									console.log("Property " + prop.property + " from IoT Hub, with value: " + prop.value + " synchronized with the attribute " + updateAttributePath + " at ADT"); 
								}
								else{
									updateAttributePath = "/" + prop.property;
									console.log("IoT Hub Property to synchronize with ADT: " + prop.property + ", with value: " + prop.value); 
								}
								updates.push({
									op: "add", // for the moment we prefer 'add' and not 'replace' because of the exception raised by ADT when the attribute is not yet defined at ADT
									path: updateAttributePath,
									value: prop.value
								});
							});
							console.log('patches sending to ADT :' + inspect(updates));
							var result = await serviceClient.updateDigitalTwin(digitalTwinId, updates);
							
							msg.status = 'Twin updated';
							msg.trace = msg.trace + ' ,' + msg.status + ' : ' + result;
							node.send(msg);
							console.log(msg.status + ' : ' + inspect(result));
						}

						//we synchronize tags from Device Twin at IoT Hub with Twin attributes at ADT
						if (msg.tags!=null) {
							msg.tags.forEach(t => {
								const tagmap = node.tagmappings.find(mapping => mapping.iotHubName==t.tag);
								if(tagmap!=null) {
									let relationship =   {
										"$relationshipId":  v4(),
										"$sourceId": msg.twinId,
										"$relationshipName": tagmap.adtName,
										"$targetId": t.value
									};

									(async () => {
										var result = await serviceClient.upsertRelationship(
											relationship["$sourceId"],
											relationship["$relationshipId"],
											relationship
										);

										msg.status = 'Relationship created';
										msg.trace = msg.trace + ' ,' + msg.status + ' : ' + result.body;
										node.send(msg);
										console.log(msg.status + ' : ' + inspect(result.body));
									})().catch();
								}
							});	
						}
					} catch (err) {
						output = 'Error while trying to patch the Twin at ADT. Does the Twin or Property exist?';
						error(node, err, output);
						setStatus(node, statusEnum.error);
					}
					break;
				
				case "delete":
					try {						
						if(node.deleterelationships){
							var relationships = await serviceClient.listRelationships(digitalTwinId);
							for await (const relationship of relationships) {
								await serviceClient.deleteRelationship(
									relationship["$sourceId"],
									relationship["$relationshipId"]
								  );
								console.log('relationship ' + relationship["$relationshipId"] + ' has been deleted.');
							  }
						}
						
						var result = await serviceClient.deleteDigitalTwin(digitalTwinId);
						
						msg.status = 'Twin deleted';
						msg.trace = msg.trace + ' ,' + msg.status + ' : ' + result;
						node.send(msg);
						console.log(msg.status + ' : ' + inspect(result));
					} catch (err) {
						output = 'Error while trying to delete the Twin at ADT. Does the twin exist?';
						error(node, err, output);
						setStatus(node, statusEnum.error);
					}
					break;
				
				case "publish":
					try {		
						console.log('publish to twin : ' + digitalTwinId);
						// const telemetryPayload = '{"Telemetry1": 5}';
						// var result = await serviceClient.publishTelemetry(digitalTwinId, telemetryPayload, v4());
						var result = await serviceClient.publishTelemetry(digitalTwinId, JSON.stringify(msg.d2cMessage), v4());
						
						msg.status = 'Telemetry sent';
						msg.trace = msg.trace + ' ,' + msg.status + ' : ' + result;
						node.send(msg);
						console.log(msg.status);
					} catch (err) {
						output = 'Error while trying to push telemetry to the Twin at ADT. Does the twin exist?';
						error(node, err, output);
						setStatus(node, statusEnum.error);
					}
			}
			setStatus(node, statusEnum.disconnected);
        });
	}
	
	function AzureIoTHubReceiver(config) {
        // Create the Node-RED node
        RED.nodes.createNode(this, config);
		const node = this;

		node.IOTHUBConnection = RED.nodes.getNode(config.IOTHUBConnection);

        this.client = null;
        this.reconnectTimer = null;

        setStatus(node, statusEnum.disconnected);

		try {
			const eventHubReader = new EventHubReader(node.IOTHUBConnection.ConnectionString, null, node.IOTHUBConnection.ConsumerGroup);
			
			(async () => {
				await eventHubReader.startReadMessage(node, (message, date, deviceId) => {
					try {
						setStatus(node, statusEnum.received);
						
						console.log('d2cMessage: ' + JSON.stringify(message));
						console.log('date: ' + date);
						console.log('deviceId: ' + deviceId);
						
						const payload = {
							d2cMessage: message,
							reportedProperties: [],
							messageDate: date || Date.now().toISOString(),
							deviceId: deviceId,
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

	function AzureEventHubReceiver(config) {
        // Create the Node-RED node
        RED.nodes.createNode(this, config);
		const node = this;

		node.ConnectionString = config.ConnectionString;
		node.HubName = config.HubName;
		node.ConsumerGroup = config.ConsumerGroup;

		try {
			const eventHubReader = new EventHubReader(node.ConnectionString, node.HubName, node.ConsumerGroup);
			(async () => {
				await eventHubReader.startReceiceTwinUpdates(node, (update, hubName, deviceId) => {
					try {
						setStatus(node, statusEnum.received);
						
						let properties = [];
						let tags = [];

						if (update.properties!=null && update.properties.reported!=null) {
							for (let prop in update.properties.reported) {
								if(!prop.startsWith("$")){							  
									properties.push( { property:prop, value:update.properties.reported[prop] });
								}
							}
							console.log('reported properties to synchronize with ADT :' + inspect(properties));
						}

						//we synchronize tags from Device Twin at IoT Hub with Twin attributes at ADT
						if (update.tags!=null) {
							for (let t in update.tags) {
								tags.push( { tag:t, value:update.tags[t] });
							}
							console.log('tags to synchronize with ADT :' + inspect(tags));
						}
						
						const payload = {
							payload : update,
							deviceTwinUpdate: update,
							reportedProperties: properties,
							tags: tags,
							hubName: hubName,
							deviceId: deviceId
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

	function AzureIoTHubDeviceTwinSender(config) {
        RED.nodes.createNode(this, config);
		const node = this;

		node.IOTHUBConnection = RED.nodes.getNode(config.IOTHUBConnection);
		node.TagsAndDesired = config.TagsAndDesired;
		node.ReportedProperties = config.ReportedProperties;

        const deviceTwinHandler = new DeviceTwinHandler(node.IOTHUBConnection.ConnectionString, node.IOTHUBConnection.DeviceConnectionString);
        setStatus(node, statusEnum.disconnected);
		
		node.on('input', async function(msg) 
		{
			console.log('Tags and Desired Properties' + node.TagsAndDesired);
			console.log('Reported Properties ' + node.ReportedProperties);

			(async () => {
				await deviceTwinHandler.sendDeviceTwinUpdate(
					node, 
					node.DeviceId, 
					JSON.parse(node.TagsAndDesired), 
					JSON.parse(node.ReportedProperties)
				);
			})().catch();
        });
    }
	
	function ADTConfigNode(n) {
        RED.nodes.createNode(this,n);
        this.DigitalTwinsUrl = n.DigitalTwinsUrl;
        this.TenantId = n.TenantId;
		this.ClientId = n.ClientId;
		this.ClientSecret = n.ClientSecret;
    }
	
	function IOTHUBConfigNode(n) {
        RED.nodes.createNode(this,n);
        this.ConnectionString = n.ConnectionString;
        this.ConsumerGroup = n.ConsumerGroup;
		this.DeviceConnectionString = n.DeviceConnectionString;
    }
	
	///////////////////////////
	// Registration of Nodes //
	///////////////////////////
	
    RED.nodes.registerType("adtmodellifecycle",ModelLifecycle, {
        defaults: {
			Name: {value:"", required:false},
			ADTConnection: {value:"", required:true},
			operationtype: {value: "", required:true}
        }
	});

    RED.nodes.registerType("adttwinlifecycle",TwinLifecycle, {
        defaults: {
			Name: {value:"", required:false},
			ADTConnection: {value:"", required:true},
			operationtype: {value: "", required:true},
            model: {value: "", required:false},
			deleterelationships: {value: false, required:false},
			propmappings: {value: []},
            tagmappings: {value: []}
        }
	});
	
	RED.nodes.registerType("azureiothubreceiver", AzureIoTHubReceiver, {
        defaults: {
            Name: {value:"", required:false},
			IOTHUBConnection: {value:"", required:true}
        }
    });

	RED.nodes.registerType("azureeventhubreceiver", AzureEventHubReceiver, {
        defaults: {
            Name: {value:"", required:false},
			ConnectionString: {value:"", required:true},
			HubName: {value:"", required:true},
			ConsumerGroup: {value:"", required:true}
        }
    });

	RED.nodes.registerType("azureiothubdevicetwinsender", AzureIoTHubDeviceTwinSender, {
        defaults: {
			Name: {value:"", required:false},
			IOTHUBConnection: {value:"", required:true},
			TagsAndDesired: {value:"", required:false},
			ReportedProperties: {value:"", required:false}
        }
    });

    RED.nodes.registerType("adt-connection",ADTConfigNode);
	
	RED.nodes.registerType("iothub-connection",IOTHUBConfigNode);
	
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