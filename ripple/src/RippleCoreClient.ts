// client perspective
interface RippleCoreClient {
	// publish message to `rooms` stream
	publish: (subject: string, data: Uint8Array) => void;
	// subscribe to mailbox
	subscribe: (subject: string, callback: (data: Uint8Array) => void) => void;

}

// snapshot perspective
interface RippleCoreSnapshot {
	// subscribe to `rooms` stream
	subscribe: (subject: string, callback: (data: Uint8Array) => void) => void;

	// publish message to mailbox
	publish: (subject: string, data: Uint8Array) => void;

	// save snapshot to KV store
	save: (key: string, data: Uint8Array) => void;

	// get snapshot from KV store
	get: (key: string) => Promise<Uint8Array | undefined>;


}