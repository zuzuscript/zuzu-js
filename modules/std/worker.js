'use strict';

const { BinaryString, PairList } = require( '../../lib/runtime-helpers' );
const taskRuntime = require( './task' );
const { CancelledException, ChannelClosedException, Task } = taskRuntime;
const marshal = require( './marshal' );

const DENIAL_CAPABILITIES = [
	'fs',
	'net',
	'perl',
	'js',
	'proc',
	'db',
	'clib',
	'gui',
	'worker',
];

let runtimePolicy = {
	host_name: 'node',
	repo_root: null,
	include_paths: [],
	deny_modules: [],
	debug_level: 0,
	transpiler: null,
	browser_worker_source: null,
	browser_worker_url: null,
	browser_worker_factory: null,
};

function setRuntimePolicy( policy = {} ) {
	runtimePolicy = {
		...runtimePolicy,
		...policy,
		include_paths: Array.isArray( policy.include_paths )
			? policy.include_paths.slice()
			: runtimePolicy.include_paths,
		deny_modules: Array.isArray( policy.deny_modules )
			? policy.deny_modules.slice()
			: runtimePolicy.deny_modules,
	};
	marshal.__zuzu_set_runtime_policy( runtimePolicy );
}

function loadWorkerThreads() {
	if ( runtimePolicy.host_name === 'browser' ) {
		return null;
	}
	try {
		return require( 'node:worker_threads' );
	}
	catch ( _err ) {
		return null;
	}
}

function loadNodePath() {
	try {
		return require( 'node:path' );
	}
	catch ( _err ) {
		return null;
	}
}

function browserRoot() {
	return typeof globalThis !== 'undefined' ? globalThis : null;
}

function browserWorkerSource() {
	const root = browserRoot();
	return runtimePolicy.browser_worker_source
		|| root && root.__ZUZU_BROWSER_WORKER_SOURCE__
		|| null;
}

function browserWorkerUrl() {
	const root = browserRoot();
	return runtimePolicy.browser_worker_url
		|| root && root.__ZUZU_BROWSER_WORKER_URL__
		|| null;
}

function loadBrowserWorkerFactory() {
	if ( runtimePolicy.host_name !== 'browser' ) {
		return null;
	}
	if ( typeof runtimePolicy.browser_worker_factory === 'function' ) {
		return runtimePolicy.browser_worker_factory;
	}
	const root = browserRoot();
	if ( root && typeof root.__ZUZU_BROWSER_WORKER_FACTORY__ === 'function' ) {
		return root.__ZUZU_BROWSER_WORKER_FACTORY__;
	}
	return null;
}

function assertWorkerCapability( label ) {
	if ( runtimePolicy.deny_worker ) {
		throw new Error( `${label} is denied by runtime policy` );
	}
}

function createBrowserWorker() {
	const factory = loadBrowserWorkerFactory();
	const source = browserWorkerSource();
	const url = browserWorkerUrl();
	if ( factory ) {
		return factory( {
			source,
			url,
			name: 'zuzu-browser-worker',
		} );
	}
	const root = browserRoot();
	if ( !root || typeof root.Worker !== 'function' ) {
		return null;
	}
	if ( url ) {
		return new root.Worker( url );
	}
	if (
		source
		&& typeof root.Blob === 'function'
		&& root.URL
		&& typeof root.URL.createObjectURL === 'function'
	) {
		const blob = new root.Blob( [ source ], { type: 'text/javascript' } );
		const objectUrl = root.URL.createObjectURL( blob );
		return new root.Worker( objectUrl );
	}
	return null;
}

function isPairList( value ) {
	return value instanceof PairList
		|| (
			value
			&& typeof value === 'object'
			&& Array.isArray( value.list )
			&& typeof value.has === 'function'
			&& typeof value.get === 'function'
		);
}

function typeName( value ) {
	if ( value == null ) {
		return 'Null';
	}
	if ( isPairList( value ) ) {
		return 'PairList';
	}
	if ( Array.isArray( value ) ) {
		return 'Array';
	}
	if ( typeof value === 'function' ) {
		return 'Function';
	}
	if ( typeof value === 'boolean' ) {
		return 'Boolean';
	}
	if ( typeof value === 'number' ) {
		return 'Number';
	}
	if ( typeof value === 'string' ) {
		return 'String';
	}
	if ( value && value.__zuzu_type_name ) {
		return String( value.__zuzu_type_name );
	}
	if ( value && value.constructor && value.constructor.name ) {
		return value.constructor.name;
	}
	return 'Object';
}

function namedOptionMap( namedArgs ) {
	const out = Object.create( null );
	if ( !namedArgs ) {
		return out;
	}
	for ( const pair of namedArgs.list || [] ) {
		if ( Array.isArray( pair ) && pair.length >= 2 ) {
			out[String( pair[0] )] = pair[1];
		}
	}
	return out;
}

function parseWorkerOptions( namedArgs ) {
	const named = namedOptionMap( namedArgs );
	const extraDenials = [];
	const refusedRelaxations = [];
	for ( const key of Object.keys( named ).sort() ) {
		if ( !key.startsWith( 'deny_' ) ) {
			throw new Error( `Unknown named argument '${key}' for Worker.spawn` );
		}
		const capability = key.slice( 'deny_'.length );
		if ( !DENIAL_CAPABILITIES.includes( capability ) ) {
			throw new Error( `Unknown named argument '${key}' for Worker.spawn` );
		}
		if ( typeof named[key] !== 'boolean' ) {
			throw new Error(
				`TypeException: Worker.spawn named argument '${key}' expects Boolean, got ${typeName( named[key] )}`
			);
		}
		if ( named[key] ) {
			extraDenials.push( capability );
		}
		else if ( runtimePolicy[key] ) {
			refusedRelaxations.push( capability );
		}
	}
	return { extraDenials, refusedRelaxations };
}

function effectivePolicy( extraDenials ) {
	const policy = {
		host_name: runtimePolicy.host_name,
		repo_root: runtimePolicy.repo_root,
		include_paths: ( runtimePolicy.include_paths || [] ).slice(),
		deny_modules: ( runtimePolicy.deny_modules || [] ).slice(),
		debug_level: runtimePolicy.debug_level,
		transpiler: runtimePolicy.transpiler,
	};
	for ( const capability of DENIAL_CAPABILITIES ) {
		policy[`deny_${capability}`] =
			Boolean( runtimePolicy[`deny_${capability}`] )
			|| extraDenials.includes( capability );
	}
	return policy;
}

function taskException( message ) {
	const err = new Error( String( message || 'worker failed' ) );
	err.name = 'Exception';
	err.to_String = function toString() {
		return `Exception: ${this.message}`;
	};
	return err;
}

class Worker {
	static spawn( ...rawArgs ) {
		assertWorkerCapability( 'Worker.spawn' );
		let namedArgs = null;
		if ( rawArgs.length > 0 && isPairList( rawArgs[rawArgs.length - 1] ) ) {
			namedArgs = rawArgs.pop();
		}
		if ( rawArgs.length < 1 || rawArgs.length > 2 ) {
			throw new Error( 'Worker.spawn expects Callable and optional Array arguments' );
		}
		const callable = rawArgs[0];
		if ( typeof callable !== 'function' ) {
			throw new Error(
				`TypeException: Worker.spawn expects Function, got ${typeName( callable )}`
			);
		}
		const workerArgs = rawArgs.length > 1 ? rawArgs[1] : [];
		if ( !Array.isArray( workerArgs ) ) {
			throw new Error(
				`TypeException: Worker.spawn expects Array arguments, got ${typeName( workerArgs )}`
			);
		}

		const threads = loadWorkerThreads();
		const browserMode = runtimePolicy.host_name === 'browser';
		if ( !threads && !browserMode ) {
			throw new Error( 'std/worker transport is unavailable' );
		}
		const { extraDenials, refusedRelaxations } = parseWorkerOptions( namedArgs );
		if ( refusedRelaxations.length > 0 ) {
			return Task.failed( taskException(
				`Denied capability '${refusedRelaxations[0]}' cannot be relaxed for worker`
			) );
		}
		let requestBytes;
		try {
			requestBytes = marshal.dump( [ callable, workerArgs ] );
		}
		catch ( err ) {
			throw err;
		}

		if ( browserMode ) {
			return spawnBrowserWorker( requestBytes, extraDenials );
		}

		return spawnNodeWorker( threads, requestBytes, extraDenials );
	}

	static spawn_handle( ...rawArgs ) {
		assertWorkerCapability( 'Worker.spawn_handle' );
		let namedArgs = null;
		if ( rawArgs.length > 0 && isPairList( rawArgs[rawArgs.length - 1] ) ) {
			namedArgs = rawArgs.pop();
		}
		if ( rawArgs.length < 1 || rawArgs.length > 2 ) {
			throw new Error(
				'Worker.spawn_handle expects Callable and optional Array arguments'
			);
		}
		const callable = rawArgs[0];
		if ( typeof callable !== 'function' ) {
			throw new Error(
				`TypeException: Worker.spawn_handle expects Function, got ${typeName( callable )}`
			);
		}
		const workerArgs = rawArgs.length > 1 ? rawArgs[1] : [];
		if ( !Array.isArray( workerArgs ) ) {
			throw new Error(
				`TypeException: Worker.spawn_handle expects Array arguments, got ${typeName( workerArgs )}`
			);
		}

		const threads = loadWorkerThreads();
		const browserMode = runtimePolicy.host_name === 'browser';
		if ( !threads && !browserMode ) {
			throw new Error( 'std/worker transport is unavailable' );
		}
		const { extraDenials, refusedRelaxations } = parseWorkerOptions( namedArgs );
		if ( refusedRelaxations.length > 0 ) {
			const task = Task.failed( taskException(
				`Denied capability '${refusedRelaxations[0]}' cannot be relaxed for worker`
			) );
			return new WorkerHandle( null, {
				resultTask: task,
				remoteClosed: true,
			} );
		}
		const requestBytes = marshal.dump( [ callable, workerArgs ] );
		if ( browserMode ) {
			return spawnBrowserWorkerHandle( requestBytes, extraDenials );
		}
		return spawnNodeWorkerHandle( threads, requestBytes, extraDenials );
	}
}

class WorkerHandle {
	constructor( transport, options = {} ) {
		this._transport = transport;
		this._queue = [];
		this._receivers = [];
		this._localClosed = false;
		this._remoteClosed = Boolean( options.remoteClosed );
		this._cancelled = false;
		this._remoteError = null;
		this._nextOutgoingSeq = 1;
		this._nextIncomingSeq = 1;
		this._incomingFrames = new Map();
		this._resultTask = options.resultTask || new Task( null, {
			status: 'running',
			name: 'WorkerHandle.result',
			cancel: (reason) => this.cancel( reason ),
		} );
	}

	send( value = null ) {
		if ( this._localClosed || this._remoteClosed || this._cancelled ) {
			return Task.failed(
				new ChannelClosedException( 'send on closed worker handle' )
			);
		}
		let bytes;
		try {
			bytes = marshal.dump( value );
		}
		catch ( err ) {
			return Task.failed( err );
		}
		try {
			this._post( {
				type: 'message',
				bytes: Array.from( bytes.bytes ),
			} );
		}
		catch ( err ) {
			this._closeRemote( err );
			return Task.failed( err );
		}
		return Task.resolved( value );
	}

	recv() {
		if ( this._queue.length > 0 ) {
			return Task.resolved( this._queue.shift() );
		}
		if ( this._cancelled ) {
			return Task.failed( new CancelledException( 'worker cancelled' ) );
		}
		if ( this._remoteClosed ) {
			return Task.failed(
				new ChannelClosedException( 'worker handle closed' )
			);
		}
		const task = new Task( null, {
			status: 'waiting',
			name: 'WorkerHandle.recv',
			cancel: () => {
				this._receivers = this._receivers.filter( (item) => item !== task );
			},
		} );
		this._receivers.push( task );
		return task;
	}

	close() {
		if ( this._localClosed ) {
			return Task.resolved( null );
		}
		this._localClosed = true;
		try {
			this._post( { type: 'close' } );
		}
		catch ( _err ) {
		}
		return Task.resolved( null );
	}

	cancel( reason = null ) {
		if ( this._cancelled ) {
			return this;
		}
		this._cancelled = true;
		this._localClosed = true;
		this._remoteClosed = true;
		const err = reason instanceof Error
			? reason
			: new CancelledException( reason == null ? 'worker cancelled' : reason );
		this._rejectReceivers( err, true );
		try {
			this._post( {
				type: 'cancel',
				reason: err.message || String( err ),
			} );
		}
		catch ( _err ) {
		}
		if (
			this._transport
			&& typeof this._transport.terminate === 'function'
		) {
			this._transport.terminate();
		}
		if ( !this._resultTask.done() ) {
			this._resultTask.cancel( err );
		}
		return this;
	}

	result() {
		return this._resultTask;
	}

	status() {
		return this._resultTask.status();
	}

	done() {
		return this._resultTask.done();
	}

	_post( message ) {
		if ( !this._transport || typeof this._transport.postMessage !== 'function' ) {
			throw taskException( 'worker transport is closed' );
		}
		const payload = { ...message };
		if (
			[ 'message', 'close', 'cancel' ].includes( payload.type )
			&& !Number.isInteger( payload.seq )
		) {
			payload.seq = this._nextOutgoingSeq++;
		}
		this._transport.postMessage( payload );
	}

	_deliverBytes( bytes ) {
		let value;
		try {
			value = marshal.load( new BinaryString( bytes || [] ) );
		}
		catch ( err ) {
			this._closeRemote( err );
			return;
		}
		const receiver = this._receivers.shift();
		if ( receiver ) {
			receiver._resolve( value );
		}
		else {
			this._queue.push( value );
		}
	}

	_resolveResultBytes( bytes ) {
		try {
			this._resultTask._resolve(
				marshal.load( new BinaryString( bytes || [] ) )
			);
		}
		catch ( err ) {
			this._resultTask._reject( err );
		}
	}

	_rejectResult( err ) {
		if ( !this._resultTask.done() ) {
			this._resultTask._reject( err );
		}
	}

	_closeRemote( err = null ) {
		this._remoteClosed = true;
		if ( err ) {
			this._remoteError = err;
		}
		this._rejectReceivers(
			err
				|| this._remoteError
				|| new ChannelClosedException( 'worker handle closed' ),
			false,
		);
	}

	_rejectReceivers( err, forceCancel = false ) {
		while ( this._receivers.length > 0 ) {
			this._receivers.shift()._reject(
				err,
				forceCancel ? 'cancelled' : null,
			);
		}
	}

	_receiveFrame( message ) {
		if ( Number.isInteger( message.seq ) ) {
			this._incomingFrames.set( message.seq, message );
			while ( this._incomingFrames.has( this._nextIncomingSeq ) ) {
				const next = this._incomingFrames.get( this._nextIncomingSeq );
				this._incomingFrames.delete( this._nextIncomingSeq );
				this._nextIncomingSeq++;
				processWorkerHandleMessage( this, next );
			}
			return;
		}
		processWorkerHandleMessage( this, message );
	}
}

Object.defineProperty( WorkerHandle.prototype, '__zuzu_type_name', {
	value: 'WorkerHandle',
	enumerable: false,
	configurable: true,
	writable: true,
} );

function spawnNodeWorker( threads, requestBytes, extraDenials ) {
	const nodePath = loadNodePath();
	if ( !threads || !nodePath ) {
		throw new Error( 'std/worker transport is unavailable' );
	}

	const task = new Task( null, {
		status: 'running',
		name: 'Worker.spawn',
	} );
	const nodeWorker = new threads.Worker(
		nodePath.join( __dirname, 'worker-thread.js' ),
		{
			workerData: {
				request_bytes: Array.from( requestBytes.bytes ),
				policy: effectivePolicy( extraDenials ),
			},
		}
	);
	task._cancelHook = function cancelWorker() {
		nodeWorker.terminate().catch( () => {} );
	};
	let settled = false;
	nodeWorker.once( 'message', (message) => {
		settled = true;
		handleWorkerMessage( task, message );
	} );
	nodeWorker.once( 'error', (err) => {
		settled = true;
		if ( !task.done() ) {
			task._reject( taskException( err && err.message ? err.message : err ) );
		}
	} );
	nodeWorker.once( 'exit', (code) => {
		if ( !settled && !task.done() && code !== 0 ) {
			task._reject( taskException( `Worker exited with code ${code}` ) );
		}
	} );
	return task;
}

function spawnBrowserWorker( requestBytes, extraDenials ) {
	const browserWorker = createBrowserWorker();
	if ( !browserWorker ) {
		throw new Error( 'std/worker transport is unavailable' );
	}
	const task = new Task( null, {
		status: 'running',
		name: 'Worker.spawn',
	} );
	task._cancelHook = function cancelWorker() {
		if ( browserWorker && typeof browserWorker.terminate === 'function' ) {
			browserWorker.terminate();
		}
	};
	const onMessage = (event) => handleWorkerMessage(
		task,
		event && Object.prototype.hasOwnProperty.call( event, 'data' )
			? event.data
			: event
	);
	const onError = (err) => {
		const root = browserRoot();
		const reject = () => {
			if ( !task.done() ) {
				task._reject( taskException( err && err.message ? err.message : err ) );
			}
		};
		if ( root && typeof root.setTimeout === 'function' ) {
			root.setTimeout( reject, 25 );
			return;
		}
		reject();
	};
	if ( typeof browserWorker.addEventListener === 'function' ) {
		browserWorker.addEventListener( 'message', onMessage );
		browserWorker.addEventListener( 'error', onError );
	}
	else {
		browserWorker.onmessage = onMessage;
		browserWorker.onerror = onError;
	}
	browserWorker.postMessage( {
		request_bytes: Array.from( requestBytes.bytes ),
		policy: effectivePolicy( extraDenials ),
	} );
	return task;
}

function spawnNodeWorkerHandle( threads, requestBytes, extraDenials ) {
	const nodePath = loadNodePath();
	if ( !threads || !nodePath ) {
		throw new Error( 'std/worker transport is unavailable' );
	}

	const nodeWorker = new threads.Worker(
		nodePath.join( __dirname, 'worker-thread.js' ),
		{
			workerData: {
				mode: 'handle',
				request_bytes: Array.from( requestBytes.bytes ),
				policy: effectivePolicy( extraDenials ),
			},
		}
	);
	const handle = new WorkerHandle( {
		postMessage: (message) => nodeWorker.postMessage( message ),
		terminate: () => nodeWorker.terminate().catch( () => {} ),
	} );
	let settled = false;
	nodeWorker.on( 'message', (message) => handleWorkerHandleMessage( handle, message ) );
	nodeWorker.once( 'error', (err) => {
		settled = true;
		const wrapped = taskException( err && err.message ? err.message : err );
		handle._closeRemote( wrapped );
		handle._rejectResult( wrapped );
	} );
	nodeWorker.once( 'exit', (code) => {
		if ( settled ) {
			return;
		}
		if ( code !== 0 && !handle._cancelled ) {
			const err = taskException( `Worker exited with code ${code}` );
			handle._closeRemote( err );
			handle._rejectResult( err );
			return;
		}
		handle._closeRemote();
		if ( !handle._resultTask.done() && !handle._cancelled ) {
			handle._rejectResult( taskException( 'Worker exited without result' ) );
		}
	} );
	return handle;
}

function spawnBrowserWorkerHandle( requestBytes, extraDenials ) {
	const browserWorker = createBrowserWorker();
	if ( !browserWorker ) {
		throw new Error( 'std/worker transport is unavailable' );
	}
	const handle = new WorkerHandle( {
		postMessage: (message) => browserWorker.postMessage( message ),
		terminate: () => {
			if ( typeof browserWorker.terminate === 'function' ) {
				browserWorker.terminate();
			}
		},
	} );
	const onMessage = (event) => handleWorkerHandleMessage(
		handle,
		event && Object.prototype.hasOwnProperty.call( event, 'data' )
			? event.data
			: event
	);
	const onError = (err) => {
		const wrapped = taskException( err && err.message ? err.message : err );
		handle._closeRemote( wrapped );
		handle._rejectResult( wrapped );
	};
	if ( typeof browserWorker.addEventListener === 'function' ) {
		browserWorker.addEventListener( 'message', onMessage );
		browserWorker.addEventListener( 'error', onError );
	}
	else {
		browserWorker.onmessage = onMessage;
		browserWorker.onerror = onError;
	}
	browserWorker.postMessage( {
		type: 'start_handle',
		request_bytes: Array.from( requestBytes.bytes ),
		policy: effectivePolicy( extraDenials ),
	} );
	return handle;
}

function handleWorkerMessage( task, message ) {
	if ( task.done() ) {
		return;
	}
	if ( !message || typeof message !== 'object' ) {
		task._reject( taskException( 'Worker returned invalid reply' ) );
		return;
	}
	if ( !message.ok ) {
		task._reject( taskException( message.error || 'worker failed' ) );
		return;
	}
	try {
		task._resolve( marshal.load( new BinaryString( message.bytes || [] ) ) );
	}
	catch ( err ) {
		task._reject( err );
	}
}

function handleWorkerHandleMessage( handle, message ) {
	if ( !message || typeof message !== 'object' ) {
		const err = taskException( 'Worker returned invalid reply' );
		handle._closeRemote( err );
		handle._rejectResult( err );
		return;
	}
	handle._receiveFrame( message );
}

function processWorkerHandleMessage( handle, message ) {
	if ( message.type === 'message' ) {
		handle._deliverBytes( message.bytes || [] );
		return;
	}
	if ( message.type === 'close' ) {
		handle._closeRemote();
		return;
	}
	if ( message.type === 'result' ) {
		if ( message.ok ) {
			handle._resolveResultBytes( message.bytes || [] );
		}
		else {
			const err = taskException( message.error || 'worker failed' );
			handle._remoteError = err;
			handle._rejectResult( err );
		}
		return;
	}
	const err = taskException( 'Worker returned invalid reply' );
	handle._closeRemote( err );
	handle._rejectResult( err );
}

module.exports = {
	Worker,
	__zuzu_set_runtime_policy: setRuntimePolicy,
};
