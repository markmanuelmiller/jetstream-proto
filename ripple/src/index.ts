import { connect, JetStreamManager, NatsConnection, consumerOpts, createInbox, StringCodec, JetStreamSubscription, JetStreamClient } from 'nats';
import express from 'express';
import { v4 } from 'uuid';

const app = express();
const port = 3000;

let nc: NatsConnection | null = null;
let jsm: JetStreamManager | null = null;
let js: JetStreamClient | null = null;
let sc = StringCodec();
const streamName = 'rooms';
const subject = `${streamName}.1.>`;
const rooms: string[] = [];
let sub: JetStreamSubscription | null = null;
let drSub: JetStreamSubscription | null = null;
const roomState = new Map<string, number>();
const drRoomState = new Map<string, number>();

const run = async () => {
	nc = await connect({ servers: 'nats:4222' });
	jsm = await nc.jetstreamManager();
	js = nc.jetstream();
	// create rooms
	for (let i = 0; i < 10; i++) {
		rooms.push(v4());
	}
};

// create a `rooms.shard.roomId` stream
// generate 10 roomIds
// publish 100 count messages per room
// create a KV store for room state
// create a consumer - for every 10th message, save state to KV store and purge stream with filter

const initJetstream = async (nats: NatsConnection, streamName: string, rooms: string[]) => {
	const streams = await jsm?.streams.list().next();
	if (!streams?.find((stream) => stream.config.name === streamName)) {
		jsm?.streams.add({ name: streamName, subjects: [subject] });
	}

	// create KV store
	// const kv = await js?.views.kv("kv_rooms");

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


app.get('/', (req, res) => {
	res.send('Hello World!')
})

app.get('/list', async (req, res) => {
	// jetstream
	const streams = await jsm?.streams.list().next();
	streams?.forEach((stream) => {
		console.log(stream);
	});
	return res.sendStatus(204);
})

app.get('/init', async (req, res) => {
	if (!nc) {
		return res.sendStatus(500);
	}

	initJetstream(nc, streamName, rooms);
	return res.sendStatus(204);
});

app.get('/sub', async (req, res) => {
	if (!nc) {
		return res.sendStatus(500);
	}

	const js = nc.jetstream();
	const opts = consumerOpts();
	opts.durable("ripple");
	opts.manualAck();
	opts.ackExplicit();
	opts.deliverTo(createInbox());

	const kv = await js.views.kv("kv_rooms");
	let sub = await js.subscribe("rooms.>", opts);
	const done = (async () => {
		for await (const m of sub) {
			const str = new TextDecoder().decode(m.data);
			console.log("Received a message:", m.subject, str, m.seq);
			try {
				const event = JSON.parse(str);
				if (event.eventType === 'count') {
					let count = roomState.get(event.roomId) || 0;
					count += 1;
					roomState.set(event.roomId, count);

					// save to KV store and purge
					if (count % 10 === 0) {
						const encode = sc.encode(JSON.stringify({ count }));
						await kv.put(event.roomId, encode);
					}
				}
			} catch (e) {
				console.log('error parsing event', e);
			}
			m.ack();
		}
		// sub.drain();
		// console.log("Subscription drained");
	})();

	return res.sendStatus(204);
});

app.get('/sub-purge', async (req, res) => {
	if (!nc) {
		return res.sendStatus(500);
	}

	const js = nc.jetstream();
	const opts = consumerOpts();
	opts.durable("ripple");
	opts.manualAck();
	opts.ackExplicit();
	opts.deliverTo(createInbox());

	const kv = await js.views.kv("kv_rooms");
	let sub = await js.subscribe("rooms.>", opts);
	const done = (async () => {
		for await (const m of sub) {
			const str = new TextDecoder().decode(m.data);
			console.log("Received a message:", m.subject, str, m.seq);
			try {
				const event = JSON.parse(str);
				if (event.eventType === 'count') {
					let count = roomState.get(event.roomId) || 0;
					count += 1;
					roomState.set(event.roomId, count);

					// save to KV store and purge
					if (count % 10 === 0) {
						const encode = sc.encode(JSON.stringify({ count }));
						await kv.put(event.roomId, encode);
						// purge all messages for this room
						await jsm?.streams.purge(streamName, { filter: `${streamName}.1.${event.roomId}` });
					}
				}
			} catch (e) {
				console.log('error parsing event', e);
			}
			m.ack();
		}
		// sub.drain();
		// console.log("Subscription drained");
	})();

	return res.sendStatus(204);
});

app.get('/kv', async (req, res) => {
	if (!nc) {
		return res.sendStatus(500);
	}


	const js = nc.jetstream();
	const kv = await js.views.kv("kv_rooms");
	const keys = await kv.keys();
	console.log('keys', keys);
	await (async () => {
		for await (const key of keys) {
			const value = await kv.get(key);
			console.log('key', key, 'value', value);
		}
	})();

	return res.sendStatus(204);
});

app.get('/log', async (req, res) => {
	console.log('roomState', roomState);
	console.log('drRoomState', drRoomState);
	return res.sendStatus(204);
});

app.get('/dr', async (req, res) => {
	if (!nc) {
		return res.sendStatus(500);
	}

	const js = nc.jetstream();
	const opts = consumerOpts();
	opts.manualAck();
	opts.ackExplicit();
	opts.deliverTo(createInbox());
	opts.replayInstantly();
	opts.deliverAll();

	drSub = await js.subscribe("rooms.>", opts);
	const done = (async () => {
		for await (const m of drSub) {
			const str = new TextDecoder().decode(m.data);
			try {
				const event = JSON.parse(str);
				if (event.eventType === 'count') {
					const count = drRoomState.get(event.roomId) || 0;
					drRoomState.set(event.roomId, count + 1);
				}
			} catch (e) {
				console.log('error parsing event', e);
			}
			m.ack();
		}
	})();

	return res.sendStatus(204);
});

app.get('/drunsub', async (req, res) => {
	if (!nc) {
		return res.sendStatus(500);
	}

	if (drSub) {
		console.log('unsubscribing drSub');
		drSub.unsubscribe();
	}

	return res.sendStatus(204);
});

app.get('/replay', async (req, res) => {
	if (!nc) {
		return res.sendStatus(500);
	}

	if (sub) {
		// sub.unsubscribe();
		await sub.drain();
		// await sub.destroy();
		// sub = null;
		sub = null;
	}

	const js = nc.jetstream();
	const opts = consumerOpts();
	// opts.durable("replay_consumer");
	opts.manualAck();
	opts.ackExplicit();
	opts.deliverTo(createInbox());
	opts.replayInstantly();
	// opts.deliverAll();
	opts.deliverLast();

	sub = await js.subscribe("rooms.>", opts);
	const done = (async () => {
		for await (const m of sub) {
			const str = new TextDecoder().decode(m.data);
			console.log("Received a message:", m.subject, str, m.seq);
			m.ack();
		}
		console.log("runs when .unsubscribe() or .destroy() is called");
	})();

	return res.sendStatus(204);
});

app.get('/unsub', async (req, res) => {
	if (!nc) {
		return res.sendStatus(500);
	}

	if (sub) {
		console.log('unsubscribing sub');
		sub.unsubscribe();
		console.log('sub', sub);
	}

	return res.sendStatus(204);
});
app.get('/destroy', async (req, res) => {
	if (!nc) {
		return res.sendStatus(500);
	}

	if (sub) {
		console.log('destroying sub');
		await sub.destroy();
		sub = null;
	}

	return res.sendStatus(204);
});

app.get('/pub', async (req, res) => {
	if (!nc) {
		return res.sendStatus(500);
	}

	const event = {
		eventType: 'count',
		roomId: '',
	};

	rooms.forEach((room) => {
		event.roomId = room;
		nc?.publish(`${streamName}.1.${room}`, sc.encode(JSON.stringify(event)));
	});

	return res.sendStatus(204);
});

app.listen(port, () => {
	console.log(`ripple app listening on port ${port}`)
})

run();