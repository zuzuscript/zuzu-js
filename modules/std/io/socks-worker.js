'use strict';

const fs = require( 'node:fs' );
const net = require( 'node:net' );
const dgram = require( 'node:dgram' );
const { parentPort } = require( 'node:worker_threads' );

let nextId = 1;
const tcpServers = new Map();
const tcpSockets = new Map();
const udpSockets = new Map();
const unixServers = new Map();
const unixSockets = new Map();

function allocId() {
	return nextId++;
}

function reply( header, data, value ) {
	const json = JSON.stringify( value ?? null );
	const bytes = Buffer.from( json, 'utf8' );
	new Uint8Array( data ).fill( 0 );
	new Uint8Array( data ).set( bytes.subarray( 0, data.byteLength ) );
	const meta = new Int32Array( header );
	Atomics.store( meta, 0, 0 );
	Atomics.store( meta, 1, bytes.length );
	Atomics.store( meta, 2, 1 );
	Atomics.notify( meta, 2 );
}

function replyError( header, data, err ) {
	reply( header, data, {
		error: err && err.message ? err.message : String( err ),
	} );
}

function waitFor( predicate, attach ) {
	return new Promise( (resolve, reject) => {
		const existing = predicate();
		if ( existing !== undefined ) {
			resolve( existing );
			return;
		}
		attach( resolve, reject );
	} );
}

function makeTcpSocket( socket ) {
	const id = allocId();
	const state = {
		socket,
		buffer: '',
		closed: false,
		lineWaiters: [],
	};
	socket.on( 'data', (chunk) => {
		state.buffer += chunk.toString( 'utf8' );
		while ( state.lineWaiters.length > 0 ) {
			const idx = state.buffer.indexOf( '\n' );
			if ( idx < 0 ) {
				break;
			}
			const line = state.buffer.slice( 0, idx + 1 );
			state.buffer = state.buffer.slice( idx + 1 );
			state.lineWaiters.shift()( line );
		}
	} );
	socket.on( 'close', () => {
		state.closed = true;
		while ( state.lineWaiters.length > 0 ) {
			state.lineWaiters.shift()( null );
		}
	} );
	tcpSockets.set( id, state );
	return id;
}

async function handle( message ) {
	const { header, data, command, args } = message;
	try {
		switch ( command ) {
			case 'listen_tcp': {
				const server = net.createServer();
				const id = allocId();
				const state = {
					server,
					pending: [],
					acceptWaiters: [],
				};
				server.on( 'connection', (socket) => {
					const socketId = makeTcpSocket( socket );
					if ( state.acceptWaiters.length > 0 ) {
						state.acceptWaiters.shift()( socketId );
					}
					else {
						state.pending.push( socketId );
					}
				} );
				await new Promise( (resolve, reject) => {
					server.once( 'error', reject );
					server.listen( Number( args.port ), String( args.host ), resolve );
				} );
				tcpServers.set( id, state );
				reply( header, data, { id } );
				return;
			}
			case 'tcp_server_port': {
				const state = tcpServers.get( args.id );
				const addr = state.server.address();
				reply( header, data, addr && addr.port ? addr.port : 0 );
				return;
			}
			case 'connect_tcp': {
				const socket = net.connect( Number( args.port ), String( args.host ) );
				await new Promise( (resolve, reject) => {
					socket.once( 'error', reject );
					socket.once( 'connect', resolve );
				} );
				reply( header, data, { id: makeTcpSocket( socket ) } );
				return;
			}
			case 'tcp_accept': {
				const state = tcpServers.get( args.id );
				const socketId = await waitFor(
					() => state.pending.length > 0 ? state.pending.shift() : undefined,
					(resolve) => state.acceptWaiters.push( resolve )
				);
				reply( header, data, socketId == null ? null : { id: socketId } );
				return;
			}
			case 'tcp_say': {
				const state = tcpSockets.get( args.id );
				await new Promise( (resolve, reject) => {
					state.socket.write( `${args.text}\n`, (err) => err ? reject( err ) : resolve() );
				} );
				reply( header, data, true );
				return;
			}
			case 'tcp_next_line': {
				const state = tcpSockets.get( args.id );
				const line = await waitFor(
					() => {
						const idx = state.buffer.indexOf( '\n' );
						if ( idx < 0 ) {
							return state.closed ? null : undefined;
						}
						const value = state.buffer.slice( 0, idx + 1 );
						state.buffer = state.buffer.slice( idx + 1 );
						return value;
					},
					(resolve) => state.lineWaiters.push( resolve )
				);
				reply( header, data, line );
				return;
			}
			case 'tcp_close': {
				const state = tcpSockets.get( args.id );
				if ( state ) {
					state.socket.destroy();
					tcpSockets.delete( args.id );
				}
				reply( header, data, true );
				return;
			}
			case 'tcp_server_close': {
				const state = tcpServers.get( args.id );
				if ( state ) {
					state.server.close();
					tcpServers.delete( args.id );
				}
				reply( header, data, true );
				return;
			}
			case 'bind_udp': {
				const sock = dgram.createSocket( 'udp4' );
				const id = allocId();
				const state = {
					sock,
					messages: [],
					waiters: [],
				};
				sock.on( 'message', (msg) => {
					const text = msg.toString( 'utf8' );
					if ( state.waiters.length > 0 ) {
						state.waiters.shift()( text );
					}
					else {
						state.messages.push( text );
					}
				} );
				await new Promise( (resolve, reject) => {
					sock.once( 'error', reject );
					sock.bind( Number( args.port ), String( args.host ), resolve );
				} );
				udpSockets.set( id, state );
				reply( header, data, { id } );
				return;
			}
			case 'connect_udp': {
				const sock = dgram.createSocket( 'udp4' );
				const id = allocId();
				const state = {
					sock,
					messages: [],
					waiters: [],
				};
				sock.on( 'message', (msg) => {
					const text = msg.toString( 'utf8' );
					if ( state.waiters.length > 0 ) {
						state.waiters.shift()( text );
					}
					else {
						state.messages.push( text );
					}
				} );
				await new Promise( (resolve, reject) => {
					sock.once( 'error', reject );
					sock.connect( Number( args.port ), String( args.host ), resolve );
				} );
				udpSockets.set( id, state );
				reply( header, data, { id } );
				return;
			}
			case 'udp_port': {
				const state = udpSockets.get( args.id );
				reply( header, data, state.sock.address().port );
				return;
			}
			case 'udp_send': {
				const state = udpSockets.get( args.id );
				await new Promise( (resolve, reject) => {
					state.sock.send( Buffer.from( String( args.text ) ), (err) => err ? reject( err ) : resolve() );
				} );
				reply( header, data, true );
				return;
			}
			case 'udp_recv': {
				const state = udpSockets.get( args.id );
				const messageText = await waitFor(
					() => state.messages.length > 0 ? state.messages.shift() : undefined,
					(resolve) => state.waiters.push( resolve )
				);
				reply( header, data, messageText );
				return;
			}
			case 'udp_close': {
				const state = udpSockets.get( args.id );
				if ( state ) {
					state.sock.close();
					udpSockets.delete( args.id );
				}
				reply( header, data, true );
				return;
			}
			case 'listen_unix': {
				const server = net.createServer();
				const id = allocId();
				try {
					if ( fs.existsSync( String( args.path ) ) ) {
						fs.rmSync( String( args.path ), { force: true } );
					}
				}
				catch ( _err ) {
				}
				await new Promise( (resolve, reject) => {
					server.once( 'error', reject );
					server.listen( String( args.path ), resolve );
				} );
				unixServers.set( id, { server, path: String( args.path ) } );
				reply( header, data, { id } );
				return;
			}
			case 'connect_unix': {
				const socket = net.connect( String( args.path ) );
				await new Promise( (resolve, reject) => {
					socket.once( 'error', reject );
					socket.once( 'connect', resolve );
				} );
				const id = allocId();
				unixSockets.set( id, socket );
				reply( header, data, { id } );
				return;
			}
			case 'unix_close': {
				const socket = unixSockets.get( args.id );
				if ( socket ) {
					socket.destroy();
					unixSockets.delete( args.id );
				}
				reply( header, data, true );
				return;
			}
			case 'unix_server_close': {
				const state = unixServers.get( args.id );
				if ( state ) {
					state.server.close();
					try {
						if ( fs.existsSync( state.path ) ) {
							fs.rmSync( state.path, { force: true } );
						}
					}
					catch ( _err ) {
					}
					unixServers.delete( args.id );
				}
				reply( header, data, true );
				return;
			}
			default:
				throw new Error( `Unknown socks worker command: ${command}` );
		}
	}
	catch ( err ) {
		replyError( header, data, err );
	}
}

parentPort.on( 'message', handle );
