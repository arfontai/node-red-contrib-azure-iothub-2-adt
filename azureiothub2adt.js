module.exports = function(RED) 
{
	'use strict'
	const { ClientSecretCredential } = require("@azure/identity");
	const { DigitalTwinsClient } = require("@azure/digital-twins-core");
	const { inspect } = require("util");
	const { v4 } = require("uuid");
	const buildingTwin = require("./dtdl/digitalTwins/buildingTwin.json");
	const building = require("./dtdl/models/building.json");

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
	
	const statusEnum = {
        connected: { fill: "green", shape:"dot", text: "Connected" },
        connecting: { fill: "blue", shape:"dot", text: "Connecting" },
        provisioning: { fill: "blue", shape:"dot", text: "Provisioning" },
        disconnected: { fill: "red", shape:"dot", text: "Disconnected" },
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
	
    RED.nodes.registerType("twin-create",TwinCreate, {
        defaults: {
			DigitalTwinsUrl: {value:"", required:true},
			TenantId: {value:"", required:true},
			ClientId: {value:"", required:true},
			ClientSecret: {value:"", required:true}
        }
	});
}