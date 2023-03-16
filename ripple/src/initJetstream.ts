import { NatsConnection, StringCodec } from 'nats';
import { v4 } from 'uuid';

// create a `rooms.shard.roomId` stream

// create a KV store for room state

// generate 10 roomIds

// publish 100 count messages per room

// create a consumer - for every 10th message, save state to KV store

// consume messages from stream

// publish 2 count messages per room

// start DR process - KV store should have a count of 102 for each room

export const initJetstream = async (nats: NatsConnection, streamName: string, rooms: string[]) => {
	const sc = StringCodec();
	const js = nats.jetstream();
	const subject = `${streamName}.>`;
	// create stream
	const jsm = await nats.jetstreamManager();
	const streams = await jsm.streams.list().next();
	// console.log('streams', streams);
	if (!streams.find((stream) => stream.config.name === streamName)) {
		jsm.streams.add({ name: streamName, subjects: [subject] });
	}

	// create KV store
	const kv = await js.views.kv("kv_rooms");

	console.log('rooms', rooms);

	const event = {
		eventType: 'count',
		roomId: '',
	};

	// publish 100 count messages per room
	for (let i = 0; i < 100; i++) {
		rooms.forEach((room) => {
			event.roomId = room;
			nats.publish(`${streamName}.1.${room}`, sc.encode(JSON.stringify(event)));
		});
	}
}