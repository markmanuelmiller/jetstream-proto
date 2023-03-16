import { connect, JetStreamManager, StringCodec } from 'nats';
import express from 'express';

const app = express();
const port = 3000;

let nc = null;

const run = async () => {
	nc = await connect({ servers: 'nats:4222' });
	const sc = StringCodec();
	const sub = nc.subscribe('foo');

	(async () => {
		for await (const m of sub) {
			console.log('Received a message:', sc.decode(m.data));
		}
	})();

	nc.publish('foo', sc.encode('Hello World'));
};


app.get('/', (req, res) => {
	res.send('Hello World!')
})

app.listen(port, () => {
	console.log(`snapshot app listening on port ${port}`)
})

run();
