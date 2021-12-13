/*
 * Microsoft Sample Code - Copyright (c) 2020 - Licensed MIT
 */

const { EventHubProducerClient, EventHubConsumerClient } = require('@azure/event-hubs');
const { convertIotHubToEventHubsConnectionString } = require('./iot-hub-connection-string.js');

class EventHubReader {
  constructor(iotHubConnectionString, eventHubName, consumerGroup) {
    this.iotHubConnectionString = iotHubConnectionString;
	this.eventHubName = eventHubName;
    this.consumerGroup = consumerGroup;
  }

  async startReadMessage(node, startReadMessageCallback) {
    try {
      const eventHubConnectionString = await convertIotHubToEventHubsConnectionString(this.iotHubConnectionString);
      const consumerClient = new EventHubConsumerClient(this.consumerGroup, eventHubConnectionString);
      console.log('Successfully created the EventHubConsumerClient from IoT Hub event hub-compatible connection string.');

      const partitionIds = await consumerClient.getPartitionIds();
      console.log('The partition ids are: ', partitionIds);

	  node.status({ fill: "green", shape:"dot", text: "Connected" });
      consumerClient.subscribe({
        
		processEvents: (events, context) => {
          for (let i = 0; i < events.length; ++i) {
            startReadMessageCallback(
              events[i].body,
              events[i].enqueuedTimeUtc,
              events[i].systemProperties["iothub-connection-device-id"]);
          }
        },
        processError: (err, context) => {
			console.error(err.message || err);
			node.status({ fill: "grey", shape:"dot", text: "Error" });
        }
      });
    } catch (ex) {
      console.error(ex.message || ex);
    }
  }

  async stopReadMessage() {
    const disposeHandlers = [];
    this.receiveHandlers.forEach((receiveHandler) => {
      disposeHandlers.push(receiveHandler.stop());
    });
    await Promise.all(disposeHandlers);

    this.consumerClient.close();
  }
  
  async startReceiceTwinUpdates(node, startReceiceTwinUpdatesCallback) {
    try {
		const consumerClient = new EventHubConsumerClient(this.consumerGroup, this.iotHubConnectionString, this.eventHubName);
		console.log('Successfully created the EventHubConsumerClient from Event Hub connection string.');

		const partitionIds = await consumerClient.getPartitionIds();
		console.log('The partition ids are: ', partitionIds);

		node.status({ fill: "green", shape:"dot", text: "Connected" });
		consumerClient.subscribe({
			processEvents: (events, context) => {
				for (let i = 0; i < events.length; ++i) {
					startReceiceTwinUpdatesCallback(
					  events[i].body,
					  events[i].properties.hubName,
					  events[i].properties.deviceId);
				}
			},
			processError: (err, context) => {
				console.error(err.message || err);
				node.status({ fill: "grey", shape:"dot", text: "Error" });
			}
		});
	} catch (ex) {
		console.error(ex.message || ex);
	}
  }
}

module.exports = EventHubReader;
