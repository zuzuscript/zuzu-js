'use strict';

const { createBrowserRuntime } = require( './browser-runtime' );
const { BinaryString } = require( './runtime-helpers' );
const taskRuntime = require( '../modules/std/task' );

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

async function runWorkerJob( payload, defaultOptions = {} ) {
	const policy = payload.policy || {};
	const browser = createBrowserRuntime( {
		...defaultOptions,
		repoRoot: policy.repo_root || defaultOptions.repoRoot || '/',
		includePaths: policy.include_paths || defaultOptions.includePaths || [],
		denyCapabilities: workerDenyCapabilities( policy ),
		denyModules: policy.deny_modules || defaultOptions.denyModules || [],
		debugLevel: policy.debug_level || 0,
		transpiler: policy.transpiler || defaultOptions.transpiler,
	} );
	const marshal = browser.runtime.loadModule(
		'std/marshal',
		'/<browser-worker>.zzs'
	);
	if (
		marshal
		&& typeof marshal.__zuzu_set_runtime_policy === 'function'
	) {
		marshal.__zuzu_set_runtime_policy( {
			...policy,
			host_name: 'browser',
		} );
	}

	const request = marshal.load( bytesFromData( payload.request_bytes ) );
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

class BrowserWorkerInbox {
	constructor( marshal, post ) {
		this._marshal = marshal;
		this._post = post;
		this._queue = [];
		this._receivers = [];
		this._closed = false;
	}

	_postLater( message ) {
		Promise.resolve().then( () => this._post( message ) );
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
			bytes = this._marshal.dump( value );
		}
		catch ( err ) {
			return taskRuntime.Task.failed( err );
		}
		this._post( {
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
		this._postLater( { type: 'close' } );
		return taskRuntime.Task.resolved( null );
	}
}

async function runWorkerHandle(
	payload,
	defaultOptions = {},
	post,
	registerControl = null,
) {
	let nextOutgoingSeq = 1;
	const postFrame = (message) => {
		post( {
			...message,
			seq: nextOutgoingSeq++,
		} );
	};
	const policy = payload.policy || {};
	const browser = createBrowserRuntime( {
		...defaultOptions,
		repoRoot: policy.repo_root || defaultOptions.repoRoot || '/',
		includePaths: policy.include_paths || defaultOptions.includePaths || [],
		denyCapabilities: workerDenyCapabilities( policy ),
		denyModules: policy.deny_modules || defaultOptions.denyModules || [],
		debugLevel: policy.debug_level || 0,
		transpiler: policy.transpiler || defaultOptions.transpiler,
	} );
	const marshal = browser.runtime.loadModule(
		'std/marshal',
		'/<browser-worker>.zzs'
	);
	if (
		marshal
		&& typeof marshal.__zuzu_set_runtime_policy === 'function'
	) {
		marshal.__zuzu_set_runtime_policy( {
			...policy,
			host_name: 'browser',
		} );
	}

	const request = marshal.load( bytesFromData( payload.request_bytes ) );
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

	const inbox = new BrowserWorkerInbox( marshal, postFrame );
	const handleControl = (message) => {
		if ( !message || typeof message !== 'object' ) {
			return;
		}
		if ( message.type === 'message' ) {
			inbox._deliver( marshal.load( bytesFromData( message.bytes ) ) );
		}
		else if ( message.type === 'close' ) {
			inbox._closeRemote();
		}
		else if ( message.type === 'cancel' ) {
			inbox._closeRemote();
			throw new taskRuntime.CancelledException(
				message.reason || 'worker cancelled'
			);
		}
	};
	if ( typeof registerControl === 'function' ) {
		registerControl( handleControl );
	}

	let result = callable( inbox, ...workerArgs );
	if ( result instanceof taskRuntime.Task ) {
		result = await taskRuntime.awaitValue( result );
	}
	else if ( result && typeof result.then === 'function' ) {
		result = await result;
	}
	const bytes = marshal.dump( result );
	postFrame( {
		type: 'result',
		ok: true,
		bytes: Array.from( bytes.bytes ),
	} );
	Promise.resolve().then( () => postFrame( { type: 'close' } ) );
}

function installBrowserWorker( defaultOptions = {}, root = globalThis ) {
	if ( !root || typeof root !== 'object' ) {
		return null;
	}
	const post = (message) => {
		if ( typeof root.postMessage === 'function' ) {
			root.postMessage( message );
		}
	};
	let activeHandleControl = null;
	let nextControlSeq = 1;
	const pendingControlFrames = new Map();
	const pendingUnsequencedControl = [];
	const deliverHandleControl = (payload) => {
		try {
			activeHandleControl( payload );
		}
		catch ( err ) {
			activeHandleControl = null;
			nextControlSeq = 1;
			pendingControlFrames.clear();
			pendingUnsequencedControl.length = 0;
			post( {
				type: 'result',
				ok: false,
				error: errorText( err ),
			} );
			post( { type: 'close' } );
		}
	};
	const drainHandleControl = () => {
		if ( !activeHandleControl ) {
			return;
		}
		while ( pendingUnsequencedControl.length > 0 && activeHandleControl ) {
			deliverHandleControl( pendingUnsequencedControl.shift() );
		}
		while (
			activeHandleControl
			&& pendingControlFrames.has( nextControlSeq )
		) {
			const payload = pendingControlFrames.get( nextControlSeq );
			pendingControlFrames.delete( nextControlSeq );
			nextControlSeq++;
			deliverHandleControl( payload );
		}
	};
	const dispatchHandleControl = (payload) => {
		if ( Number.isInteger( payload.seq ) ) {
			pendingControlFrames.set( payload.seq, payload );
		}
		else {
			pendingUnsequencedControl.push( payload );
		}
		drainHandleControl();
	};
	const handleMessage = (event) => {
		const payload = event && Object.prototype.hasOwnProperty.call( event, 'data' )
			? event.data
			: event;
		if (
			payload
			&& (
				payload.type === 'message'
				|| payload.type === 'close'
				|| payload.type === 'cancel'
			)
		) {
			dispatchHandleControl( payload );
			return;
		}
		if ( payload && payload.type === 'start_handle' ) {
			const controlPost = (message) => post( message );
			runWorkerHandle(
				payload,
				defaultOptions,
				controlPost,
				(handler) => {
					activeHandleControl = handler;
					drainHandleControl();
				},
			).then(
				() => {
					activeHandleControl = null;
					nextControlSeq = 1;
					pendingControlFrames.clear();
					pendingUnsequencedControl.length = 0;
				},
				(err) => {
					activeHandleControl = null;
					nextControlSeq = 1;
					pendingControlFrames.clear();
					pendingUnsequencedControl.length = 0;
					post( {
						type: 'result',
						ok: false,
						error: errorText( err ),
					} );
					post( { type: 'close' } );
				},
			);
			return;
		}
		runWorkerJob( payload || {}, defaultOptions ).then(
			(bytes) => post( {
				ok: true,
				bytes,
			} ),
			(err) => post( {
				ok: false,
				error: errorText( err ),
			} ),
		);
	};
	if ( typeof root.addEventListener === 'function' ) {
		root.addEventListener( 'message', handleMessage );
		root.addEventListener( 'error', (event) => {
			post( {
				ok: false,
				error: errorText(
					event && ( event.error || event.message )
						? event.error || event.message
						: 'worker failed'
				),
			} );
		} );
		root.addEventListener( 'unhandledrejection', (event) => {
			post( {
				ok: false,
				error: errorText(
					event && event.reason ? event.reason : 'worker failed'
				),
			} );
		} );
	}
	else {
		root.onmessage = handleMessage;
		root.onerror = (message, _source, _line, _column, error) => {
			post( {
				ok: false,
				error: errorText( error || message || 'worker failed' ),
			} );
		};
		root.onunhandledrejection = (event) => {
			post( {
				ok: false,
				error: errorText(
					event && event.reason ? event.reason : 'worker failed'
				),
			} );
		};
	}
	return root;
}

module.exports = {
	installBrowserWorker,
	runWorkerJob,
};
