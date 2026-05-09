'use strict';

const path = require( 'node:path' );

let runtimePolicy = {
	deny_worker: false,
};
let worker = null;

function assertWorkerCapability() {
	if ( runtimePolicy.deny_worker ) {
		throw new Error( 'std/io/socks worker backend is denied by runtime policy' );
	}
}

function getWorker() {
	assertWorkerCapability();
	if ( worker ) {
		return worker;
	}
	const { Worker } = require( 'node:worker_threads' );
	worker = new Worker( path.join( __dirname, 'socks-worker.js' ) );
	worker.unref();
	return worker;
}

function callWorker( command, args = {}, timeoutMs = 5000 ) {
	const header = new SharedArrayBuffer( Int32Array.BYTES_PER_ELEMENT * 3 );
	const data = new SharedArrayBuffer( 64 * 1024 );
	getWorker().postMessage( { command, args, header, data } );
	const meta = new Int32Array( header );
	const status = Atomics.wait( meta, 2, 0, timeoutMs );
	if ( status === 'timed-out' ) {
		throw new Error( `socks worker timed out during ${command}` );
	}
	const length = Atomics.load( meta, 1 );
	const bytes = Buffer.from( new Uint8Array( data, 0, length ) );
	const payload = JSON.parse( bytes.toString( 'utf8' ) || 'null' );
	if ( payload && payload.error ) {
		throw new Error( payload.error );
	}
	return payload;
}

class TCPSocket {
	constructor( id ) {
		this.id = id;
	}

	say( text ) {
		callWorker( 'tcp_say', { id: this.id, text: String( text ?? '' ) } );
		return this;
	}

	next_line() {
		return callWorker( 'tcp_next_line', { id: this.id } );
	}

	close() {
		callWorker( 'tcp_close', { id: this.id } );
	}
}

class TCPServer {
	constructor( id ) {
		this.id = id;
	}

	port() {
		return callWorker( 'tcp_server_port', { id: this.id } );
	}

	accept() {
		const result = callWorker( 'tcp_accept', { id: this.id } );
		return result == null ? null : new TCPSocket( result.id );
	}

	close() {
		callWorker( 'tcp_server_close', { id: this.id } );
	}
}

class UDPSocket {
	constructor( id ) {
		this.id = id;
	}

	port() {
		return callWorker( 'udp_port', { id: this.id } );
	}

	send( text ) {
		callWorker( 'udp_send', { id: this.id, text: String( text ?? '' ) } );
		return this;
	}

	recv( _length = 0 ) {
		return callWorker( 'udp_recv', { id: this.id } );
	}

	close() {
		callWorker( 'udp_close', { id: this.id } );
	}
}

class UnixServer {
	constructor( id ) {
		this.id = id;
	}

	close() {
		callWorker( 'unix_server_close', { id: this.id } );
	}
}

class UnixSocket {
	constructor( id ) {
		this.id = id;
	}

	close() {
		callWorker( 'unix_close', { id: this.id } );
	}
}

function listen_tcp( host, port ) {
	const result = callWorker( 'listen_tcp', {
		host: String( host ),
		port: Number( port ),
	} );
	return new TCPServer( result.id );
}

function connect_tcp( host, port ) {
	const result = callWorker( 'connect_tcp', {
		host: String( host ),
		port: Number( port ),
	} );
	return new TCPSocket( result.id );
}

function bind_udp( host, port ) {
	const result = callWorker( 'bind_udp', {
		host: String( host ),
		port: Number( port ),
	} );
	return new UDPSocket( result.id );
}

function connect_udp( host, port ) {
	const result = callWorker( 'connect_udp', {
		host: String( host ),
		port: Number( port ),
	} );
	return new UDPSocket( result.id );
}

function listen_unix(sockPath) {
	const result = callWorker( 'listen_unix', { path: String( sockPath ) } );
	return new UnixServer( result.id );
}

function connect_unix(sockPath) {
	const result = callWorker( 'connect_unix', { path: String( sockPath ) } );
	return new UnixSocket( result.id );
}

module.exports = {
	TCPServer,
	TCPSocket,
	UDPSocket,
	UnixServer,
	UnixSocket,
	bind_udp,
	connect_tcp,
	connect_udp,
	connect_unix,
	listen_tcp,
	listen_unix,
	__zuzu_set_runtime_policy( policy = {} ) {
		runtimePolicy = {
			...runtimePolicy,
			...( policy && typeof policy === 'object' ? policy : {} ),
		};
	},
};
