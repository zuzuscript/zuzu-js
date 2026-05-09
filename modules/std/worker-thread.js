'use strict';

const { parentPort, workerData } = require( 'node:worker_threads' );

const { createNodeRuntime } = require( '../../lib/runtime-entrypoints' );
const { BinaryString } = require( '../../lib/runtime-helpers' );
const marshal = require( './marshal' );
const taskRuntime = require( './task' );

function bytesFromData( value ) {
	if ( value instanceof Uint8Array ) {
		return new BinaryString( value );
	}
	if ( Array.isArray( value ) ) {
		return new BinaryString( Uint8Array.from( value ) );
	}
	return new BinaryString();
}

function errorText( err ) {
	if ( err && typeof err.to_String === 'function' ) {
		return err.to_String();
	}
	if ( err && err.name && err.message ) {
		return `${err.name}: ${err.message}`;
	}
	return err && err.message ? err.message : String( err );
}

function workerDenyCapabilities( policy = {} ) {
	const out = [];
	for ( const capability of [
		'fs',
		'net',
		'perl',
		'js',
		'proc',
		'db',
		'clib',
		'gui',
		'worker',
	] ) {
		if ( policy[`deny_${capability}`] ) {
			out.push( capability );
		}
	}
	return out;
}

async function runWorkerJob() {
	const policy = workerData.policy || {};
	createNodeRuntime( {
		repoRoot: policy.repo_root || undefined,
		includePaths: policy.include_paths || [],
		denyCapabilities: workerDenyCapabilities( policy ),
		denyModules: policy.deny_modules || [],
		debugLevel: policy.debug_level || 0,
		transpiler: policy.transpiler || undefined,
	} );
	marshal.__zuzu_set_runtime_policy( policy );

	const request = marshal.load( bytesFromData( workerData.request_bytes ) );
	if ( !Array.isArray( request ) || request.length !== 2 ) {
		throw new Error( 'Worker.spawn payload did not decode as Array' );
	}
	const [ callable, workerArgs ] = request;
	if ( typeof callable !== 'function' ) {
		throw new Error( 'Worker.spawn payload callable did not decode as Function' );
	}
	if ( !Array.isArray( workerArgs ) ) {
		throw new Error( 'Worker.spawn payload arguments did not decode as Array' );
	}

	let result = callable( ...workerArgs );
	if ( result instanceof taskRuntime.Task ) {
		result = await taskRuntime.awaitValue( result );
	}
	else if ( result && typeof result.then === 'function' ) {
		result = await result;
	}
	const bytes = marshal.dump( result );
	return Array.from( bytes.bytes );
}

class WorkerInbox {
	constructor() {
		this._queue = [];
		this._receivers = [];
		this._closed = false;
	}

	_deliver( message ) {
		const receiver = this._receivers.shift();
		if ( receiver ) {
			receiver._resolve( message );
		}
		else {
			this._queue.push( message );
		}
	}

	_closeRemote() {
		this._closed = true;
		while ( this._receivers.length > 0 ) {
			this._receivers.shift()._reject(
				new taskRuntime.ChannelClosedException( 'worker inbox closed' )
			);
		}
	}

	send( value = null ) {
		let bytes;
		try {
			bytes = marshal.dump( value );
		}
		catch ( err ) {
			return taskRuntime.Task.failed( err );
		}
		parentPort.postMessage( {
			type: 'message',
			bytes: Array.from( bytes.bytes ),
		} );
		return taskRuntime.Task.resolved( value );
	}

	recv() {
		if ( this._queue.length > 0 ) {
			return taskRuntime.Task.resolved( this._queue.shift() );
		}
		if ( this._closed ) {
			return taskRuntime.Task.failed(
				new taskRuntime.ChannelClosedException( 'worker inbox closed' )
			);
		}
		const task = new taskRuntime.Task( null, {
			status: 'waiting',
			name: 'WorkerInbox.recv',
			cancel: () => {
				this._receivers = this._receivers.filter( (item) => item !== task );
			},
		} );
		this._receivers.push( task );
		return task;
	}

	close() {
		parentPort.postMessage( { type: 'close' } );
		return taskRuntime.Task.resolved( null );
	}
}

async function runWorkerHandle() {
	const policy = workerData.policy || {};
	createNodeRuntime( {
		repoRoot: policy.repo_root || undefined,
		includePaths: policy.include_paths || [],
		denyCapabilities: workerDenyCapabilities( policy ),
		denyModules: policy.deny_modules || [],
		debugLevel: policy.debug_level || 0,
		transpiler: policy.transpiler || undefined,
	} );
	marshal.__zuzu_set_runtime_policy( policy );

	const request = marshal.load( bytesFromData( workerData.request_bytes ) );
	if ( !Array.isArray( request ) || request.length !== 2 ) {
		throw new Error( 'Worker.spawn_handle payload did not decode as Array' );
	}
	const [ callable, workerArgs ] = request;
	if ( typeof callable !== 'function' ) {
		throw new Error( 'Worker.spawn_handle payload callable did not decode as Function' );
	}
	if ( !Array.isArray( workerArgs ) ) {
		throw new Error( 'Worker.spawn_handle payload arguments did not decode as Array' );
	}

	const inbox = new WorkerInbox();
	parentPort.on( 'message', (message) => {
		if ( !message || typeof message !== 'object' ) {
			return;
		}
		if ( message.type === 'message' ) {
			try {
				inbox._deliver( marshal.load( bytesFromData( message.bytes ) ) );
			}
			catch ( err ) {
				inbox._closeRemote();
				throw err;
			}
		}
		else if ( message.type === 'close' ) {
			inbox._closeRemote();
		}
		else if ( message.type === 'cancel' ) {
			inbox._closeRemote();
			throw new taskRuntime.CancelledException( message.reason || 'worker cancelled' );
		}
	} );

	let result = callable( inbox, ...workerArgs );
	if ( result instanceof taskRuntime.Task ) {
		result = await taskRuntime.awaitValue( result );
	}
	else if ( result && typeof result.then === 'function' ) {
		result = await result;
	}
	const bytes = marshal.dump( result );
	parentPort.postMessage( {
		type: 'result',
		ok: true,
		bytes: Array.from( bytes.bytes ),
	} );
	parentPort.postMessage( { type: 'close' } );
	parentPort.close();
}

const runner = workerData && workerData.mode === 'handle'
	? runWorkerHandle
	: runWorkerJob;

runner().then(
	(bytes) => {
		if ( workerData && workerData.mode === 'handle' ) {
			return;
		}
		parentPort.postMessage( {
			ok: true,
			bytes,
		} );
	},
	(err) => {
		parentPort.postMessage( workerData && workerData.mode === 'handle'
			? {
				type: 'result',
				ok: false,
				error: errorText( err ),
			}
			: {
				ok: false,
				error: errorText( err ),
			} );
		parentPort.postMessage( { type: 'close' } );
		if ( workerData && workerData.mode === 'handle' ) {
			parentPort.close();
		}
	},
);
