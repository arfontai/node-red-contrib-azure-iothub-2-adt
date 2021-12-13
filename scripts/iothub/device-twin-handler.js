/*
 * Microsoft Sample Code - Copyright (c) 2020 - Licensed MIT
 */

var Client = require('azure-iot-device').Client;
var Protocol = require('azure-iot-device-mqtt').Mqtt;
var Registry = require('azure-iothub').Registry;

class DeviceTwinHandler {
  constructor(connectionString, deviceConnectionString) {
	this.connectionString = connectionString;
	this.deviceConnectionString = deviceConnectionString;
  }

  async sendDeviceTwinUpdate(node, deviceId, tagsanddesired, reportedProperties) {
  	var log = function (node, message) {
		console.log(message);
		
		var msg = {};
		msg.payload = message;
		node.send(msg);
    };

    try {
		var client = Client.fromConnectionString(this.deviceConnectionString, Protocol);
		client.open(function(err) {
			if (err) {
				log(node, 'could not open IotHub client');
			}  
			else {
				client.getTwin(function(err, twin) {
					if (err) {
						log(node, 'could not get twin');
						node.status({ fill: "grey", shape:"dot", text: "Error" });
					} else {
						if (reportedProperties!=null) {
							twin.properties.reported.update(reportedProperties, function(err) {
								if (err) {
									log(node, 'could not update twin');
									node.status({ fill: "grey", shape:"dot", text: "Error" });
								} else {
									log(node, 'tags and desired properties updated');
									node.status({ fill: "green", shape:"dot", text: "Sent" });
								}
							});
						}
					}
				});
			}
		});
		
		var registry = Registry.fromConnectionString(this.connectionString);

		registry.getTwin(deviceId, function(err, twin){
			if (err) {
				log(node, 'could not get Twin ' + err.constructor.name + ': ' + err.message);
			} else {
				if (tagsanddesired!=null) {
					
					twin.update(tagsanddesired, function(err) {
						if (err) {
							log(node, 'could not update twin');
							node.status({ fill: "grey", shape:"dot", text: "Error" });
						} else {
							log(node, 'reported properties updated');
							node.status({ fill: "green", shape:"dot", text: "Sent" });
						}
					});
				}
			}
		});
    } catch (ex) {
      console.error(ex.message || ex);
    }
  }
}

module.exports = DeviceTwinHandler;
