'use strict';

let AsyncLocalStorage = null;
try {
	AsyncLocalStorage = require( 'node:async_hooks' ).AsyncLocalStorage;
}
catch ( _err ) {
}

class Exception extends Error {
	constructor( message = '' ) {
		super( String( message ?? '' ) );
		this.name = 'Exception';
	}

	to_String() {
		const name = this.name || this.constructor.name || 'Exception';
		const message = String( this.message ?? '' );
		if ( message === name || message.startsWith( `${name}:` ) ) {
			return message;
		}
		return message === '' ? name : `${name}: ${message}`;
	}
}

class CancelledException extends Exception {
	constructor( message = 'Task cancelled' ) {
		super( message );
		this.name = 'CancelledException';
	}
}

class TimeoutException extends Exception {
	constructor( message = 'timeout' ) {
		super( message );
		this.name = 'TimeoutException';
	}
}

class ChannelClosedException extends Exception {
	constructor( message = 'send on closed channel' ) {
		super( message );
		this.name = 'ChannelClosedException';
	}
}

let taskStorage = AsyncLocalStorage ? new AsyncLocalStorage() : null;
let fallbackCurrentTask = null;
let debugLevel = 0;
let nextTaskId = 1;
const activeTasks = new Map();
const traceEvents = [];
const callsiteStack = [];

function globalTimerRoot() {
	if ( typeof globalThis !== 'undefined' ) {
		return globalThis;
	}
	if ( typeof global !== 'undefined' ) {
		return global;
	}
	return {};
}

function safeSetTimeout( callback, delay ) {
	const root = globalTimerRoot();
	return root.setTimeout.call( root, callback, delay );
}

function safeClearTimeout( timer ) {
	const root = globalTimerRoot();
	return root.clearTimeout.call( root, timer );
}

function safeQueueMicrotask( callback ) {
	const root = globalTimerRoot();
	if ( typeof root.queueMicrotask === 'function' ) {
		return root.queueMicrotask.call( root, callback );
	}
	return safeSetTimeout( callback, 0 );
}

function currentTask() {
	return taskStorage ? taskStorage.getStore() : fallbackCurrentTask;
}

function runWithTask( task, fn ) {
	if ( taskStorage ) {
		return taskStorage.run( task, fn );
	}
	const previous = fallbackCurrentTask;
	fallbackCurrentTask = task;
	try {
		return fn();
	}
	finally {
		fallbackCurrentTask = previous;
	}
}

function normalizeException( value, ExceptionClass = Exception ) {
	if ( value instanceof Error ) {
		return value;
	}
	return new ExceptionClass( value == null ? '' : String( value ) );
}

function currentCallsite() {
	return callsiteStack.length > 0
		? callsiteStack[callsiteStack.length - 1]
		: null;
}

function withCallsite( metadata, fn ) {
	callsiteStack.push( metadata || null );
	try {
		return fn();
	}
	finally {
		callsiteStack.pop();
	}
}

function traceTask( event, task = null, extra = null ) {
	if ( debugLevel <= 0 ) {
		return null;
	}
	const record = {
		event,
		task_id: task ? task._id : null,
		parent_task_id: task ? task._parentId : null,
		name: task ? task._name : null,
		status: task ? task._status : null,
		file: task ? task._file : null,
		line: task ? task._line : null,
	};
	if ( extra && typeof extra === 'object' ) {
		Object.assign( record, extra );
	}
	traceEvents.push( record );
	return record;
}

function cleanupTask( task ) {
	if ( !task || !task.done() ) {
		return;
	}
	activeTasks.delete( task._id );
	traceTask( 'cleanup', task );
}

class Task {
	constructor( executor = null, options = {} ) {
		const parent = currentTask();
		const callsite = currentCallsite();
		this._id = nextTaskId++;
		this._parentId = options.parentTaskId != null
			? options.parentTaskId
			: ( parent ? parent._id : null );
		this._name = options.name || '<task>';
		this._file = options.file || ( callsite ? callsite.file : null ) || null;
		this._line = options.line || ( callsite ? callsite.line : null ) || null;
		this._status = options.status || 'pending';
		this._value = undefined;
		this._reason = null;
		this._children = new Set();
		this._cancelHook = typeof options.cancel === 'function' ? options.cancel : null;
		this._pollHook = typeof options.poll === 'function' ? options.poll : null;
		activeTasks.set( this._id, this );
		traceTask( 'schedule', this );
		this._promise = new Promise( (resolve, reject) => {
			this._resolve = (value) => {
				if ( this.done() ) {
					return;
				}
				this._status = 'fulfilled';
				this._value = value;
				traceTask( 'fulfill', this );
				resolve( value );
				cleanupTask( this );
			};
			this._reject = (err, forcedStatus = null) => {
				if ( this.done() ) {
					return;
				}
				this._status = forcedStatus
					|| ( err instanceof CancelledException ? 'cancelled' : 'rejected' );
				this._reason = err;
				traceTask( this._status === 'cancelled' ? 'cancel' : 'reject', this );
				reject( err );
				cleanupTask( this );
			};
		} );
		this._promise.catch( () => {} );
		if ( executor ) {
			safeQueueMicrotask( () => {
				if ( this.done() ) {
					return;
				}
				this._status = options.status || 'running';
				traceTask( 'start', this );
				runWithTask( this, async () => {
					try {
						this._resolve( await executor() );
					}
					catch ( err ) {
						this._reject( err );
					}
				} );
			} );
		}
	}

	static resolved( value = null ) {
		const task = new Task();
		task._resolve( value );
		return task;
	}

	static failed( value ) {
		const task = new Task();
		task._reject( normalizeException( value ) );
		return task;
	}

	static from( value ) {
		if ( value instanceof Task ) {
			return value;
		}
		if ( value && typeof value.then === 'function' ) {
			const task = new Task();
			Promise.resolve( value ).then(
				(result) => task._resolve( result ),
				(err) => task._reject( err ),
			);
			return task;
		}
		return Task.resolved( value );
	}

	then( resolve, reject ) {
		return this._promise.then( resolve, reject );
	}

	catch( reject ) {
		return this._promise.catch( reject );
	}

	finally( callback ) {
		return this._promise.finally( callback );
	}

	status() {
		return this._status;
	}

	id() {
		return this._id;
	}

	parent_id() {
		return this._parentId;
	}

	name() {
		return this._name;
	}

	is_done() {
		return this.done();
	}

	done() {
		return [ 'fulfilled', 'rejected', 'cancelled' ].includes( this._status ) ? 1 : 0;
	}

	poll() {
		if ( !this.done() && this._pollHook ) {
			try {
				this._pollHook();
			}
			catch ( err ) {
				this._reject( err );
			}
		}
		return this.done();
	}

	to_String() {
		return `[Task ${this._status}]`;
	}

	cancel( reason = null ) {
		if ( this.done() ) {
			return this;
		}
		const err = normalizeException(
			reason == null ? 'Task cancelled' : reason,
			CancelledException,
		);
		this._reason = err;
		for ( const child of this._children ) {
			if ( child && typeof child.cancel === 'function' ) {
				child.cancel( err );
			}
		}
		if ( this._cancelHook ) {
			try {
				this._cancelHook( err );
			}
			catch ( _err ) {
			}
		}
		this._reject( err, 'cancelled' );
		return this;
	}

	_track( child ) {
		if ( child instanceof Task ) {
			this._children.add( child );
		}
	}

	_untrack( child ) {
		if ( child instanceof Task ) {
			this._children.delete( child );
		}
	}
}

Object.defineProperty( Task.prototype, '__zuzu_type_name', {
	value: 'Task',
	enumerable: false,
	configurable: true,
	writable: true,
} );

async function awaitValueWithParent( value, parent ) {
	if ( parent && parent.status() === 'cancelled' ) {
		throw parent._reason || new CancelledException();
	}
	const task = Task.from( value );
	if ( parent ) {
		parent._track( task );
	}
	try {
		return await task;
	}
	finally {
		if ( parent ) {
			parent._untrack( task );
			if ( parent.status() === 'cancelled' ) {
				throw parent._reason || new CancelledException();
			}
		}
	}
}

async function awaitValue( value ) {
	return awaitValueWithParent( value, currentTask() );
}

async function awaitBlock( value ) {
	const parent = currentTask();
	const boxedValue = value && typeof value.then === 'function'
		? await value
		: value;
	const resolvedValue = boxedValue
		&& typeof boxedValue === 'object'
		&& Object.prototype.hasOwnProperty.call( boxedValue, '__zuzu_await_block_value' )
		? boxedValue.__zuzu_await_block_value
		: boxedValue;
	if ( !( resolvedValue instanceof Task ) ) {
		throw new Exception( 'await block must return a Task' );
	}
	return awaitValueWithParent( resolvedValue, parent );
}

function awaitValueSync( value ) {
	const task = Task.from( value );
	if ( task.status() === 'fulfilled' ) {
		return task._value;
	}
	if ( task.status() === 'rejected' || task.status() === 'cancelled' ) {
		throw task._reason || new Exception( 'Task failed' );
	}
	throw new Exception( 'cannot synchronously await pending task' );
}

function awaitBlockSync( value ) {
	const resolvedValue = value
		&& typeof value === 'object'
		&& Object.prototype.hasOwnProperty.call( value, '__zuzu_await_block_value' )
		? value.__zuzu_await_block_value
		: value;
	if ( !( resolvedValue instanceof Task ) ) {
		throw new Exception( 'await block must return a Task' );
	}
	return awaitValueSync( resolvedValue );
}

function task( fn, _metadata = {} ) {
	const callsite = currentCallsite();
	return new Task( async () => fn(), {
		name: _metadata.name || '<async>',
		file: ( callsite ? callsite.file : null ) || _metadata.file || null,
		line: ( callsite ? callsite.line : null ) || _metadata.line || null,
	} );
}

function taskSync( fn, _metadata = {} ) {
	const callsite = currentCallsite();
	const task = new Task( null, {
		name: _metadata.name || '<async>',
		file: ( callsite ? callsite.file : null ) || _metadata.file || null,
		line: ( callsite ? callsite.line : null ) || _metadata.line || null,
	} );
	task._status = 'running';
	traceTask( 'start', task );
	try {
		const value = runWithTask( task, () => fn() );
		if ( value instanceof Task ) {
			if ( value.status() === 'fulfilled' ) {
				task._resolve( value._value );
			}
			else if ( value.status() === 'rejected' || value.status() === 'cancelled' ) {
				task._reject( value._reason || new Exception( 'Task failed' ) );
			}
			else {
				task._reject( new Exception( 'cannot synchronously await pending task' ) );
			}
		}
		else if ( value && typeof value.then === 'function' ) {
			Task.from( value ).then(
				(result) => task._resolve( result ),
				(err) => task._reject( err ),
			);
		}
		else {
			task._resolve( value );
		}
	}
	catch ( err ) {
		task._reject( err );
	}
	return task;
}

function spawn( fn, _metadata = {} ) {
	return new Task( async () => fn(), {
		status: 'running',
		name: _metadata.name || '<spawn>',
		file: _metadata.file || ( currentCallsite() ? currentCallsite().file : null ) || null,
		line: _metadata.line || ( currentCallsite() ? currentCallsite().line : null ) || null,
	} );
}

function resolved( value = null ) {
	return Task.resolved( value );
}

function failed( value ) {
	return Task.failed( value == null ? 'Task failed' : value );
}

function sleep( seconds = 0 ) {
	let timer = null;
	const readyAt = Date.now() + Math.max( 0, Number( seconds ) || 0 ) * 1000;
	const task = new Task( null, {
		status: 'sleeping',
		name: 'sleep',
		poll() {
			if ( Date.now() >= readyAt ) {
				if ( timer != null ) {
					safeClearTimeout( timer );
					timer = null;
				}
				task._resolve( null );
			}
		},
		cancel() {
			if ( timer != null ) {
				safeClearTimeout( timer );
				timer = null;
			}
		},
	} );
	timer = safeSetTimeout( () => {
		timer = null;
		task._resolve( null );
	}, Math.max( 0, Number( seconds ) || 0 ) * 1000 );
	return task;
}

function yieldTask() {
	let timer = null;
	const task = new Task( null, {
		status: 'waiting',
		name: 'yield',
		cancel() {
			if ( timer != null ) {
				safeClearTimeout( timer );
				timer = null;
			}
		},
	} );
	timer = safeSetTimeout( () => {
		timer = null;
		task._resolve( null );
	}, 0 );
	return task;
}

function all( values = [] ) {
	const tasks = taskItems( values, 'all' );
	return new Task(
		() => new Promise( (resolve, reject) => {
			if ( tasks.length === 0 ) {
				resolve( [] );
				return;
			}
			const results = new Array( tasks.length );
			let remaining = tasks.length;
			let settled = false;
			tasks.forEach( (task, index) => {
				task.then(
					(value) => {
						if ( settled ) {
							return;
						}
						results[index] = value;
						remaining--;
						if ( remaining === 0 ) {
							settled = true;
							resolve( results );
						}
					},
					(err) => {
						if ( settled ) {
							return;
						}
						settled = true;
						for ( const child of tasks ) {
							if ( child !== task ) {
								child.cancel();
							}
						}
						reject( err );
					},
				);
			} );
		} ),
		{
			status: 'waiting',
			name: 'all',
			cancel(reason) {
				for ( const task of tasks ) {
					task.cancel( reason );
				}
			},
		},
	);
}

function race( values = [] ) {
	const tasks = taskItems( values, 'race' );
	if ( tasks.length === 0 ) {
		return Task.failed( new Exception( 'race expects at least one task' ) );
	}
	return new Task(
		() => new Promise( (resolve, reject) => {
			let settled = false;
			for ( const task of tasks ) {
				task.then(
					(value) => {
						if ( settled ) {
							return;
						}
						settled = true;
						for ( const loser of tasks ) {
							if ( loser !== task ) {
								loser.cancel( new CancelledException( 'race loser cancelled' ) );
							}
						}
						resolve( value );
					},
					(err) => {
						if ( settled ) {
							return;
						}
						settled = true;
						for ( const loser of tasks ) {
							if ( loser !== task ) {
								loser.cancel( new CancelledException( 'race loser cancelled' ) );
							}
						}
						reject( err );
					},
				);
			}
		} ),
		{
			status: 'waiting',
			name: 'race',
			cancel(reason) {
				for ( const task of tasks ) {
					task.cancel( reason );
				}
			},
		},
	);
}

function timeout( seconds, value ) {
	if ( !( value instanceof Task ) ) {
		throw new Exception( 'timeout expects a Task' );
	}
	const waited = value;
	const timeoutError = () => new TimeoutException( `timeout after ${Number( seconds ) || 0}s` );
	let settled = false;
	let timer = null;
	return new Task(
		() => new Promise( (resolve, reject) => {
			timer = safeSetTimeout( () => {
				if ( settled ) {
					return;
				}
				settled = true;
				const err = timeoutError();
				waited.cancel( err );
				reject( err );
			}, Math.max( 0, Number( seconds ) || 0 ) * 1000 );
			waited.then(
				(result) => {
					if ( settled ) {
						return;
					}
					settled = true;
					if ( timer != null ) {
						safeClearTimeout( timer );
						timer = null;
					}
					resolve( result );
				},
				(err) => {
					if ( settled ) {
						return;
					}
					settled = true;
					if ( timer != null ) {
						safeClearTimeout( timer );
						timer = null;
					}
					reject( err );
				},
			);
		} ),
		{
			status: 'waiting',
			name: 'timeout',
			cancel(reason) {
				settled = true;
				if ( timer != null ) {
					safeClearTimeout( timer );
					timer = null;
				}
				waited.cancel( reason );
			},
		},
	);
}

class Channel {
	constructor() {
		this._closed = false;
		this._queue = [];
		this._receivers = [];
	}

	send( value = null ) {
		if ( this._closed ) {
			return Task.failed( new ChannelClosedException() );
		}
		const receiver = this._receivers.shift();
		if ( receiver ) {
			receiver._resolve( value );
		}
		else {
			this._queue.push( value );
		}
		return Task.resolved( value );
	}

	recv() {
		if ( this._queue.length > 0 ) {
			return Task.resolved( this._queue.shift() );
		}
		if ( this._closed ) {
			return Task.resolved( null );
		}
		const task = new Task( null, {
			status: 'waiting',
			name: 'channel.recv',
			cancel: () => {
				this._receivers = this._receivers.filter( (item) => item !== task );
			},
		} );
		this._receivers.push( task );
		return task;
	}

	close() {
		this._closed = true;
		while ( this._receivers.length > 0 ) {
			this._receivers.shift()._resolve( null );
		}
		return null;
	}
}

class CancellationToken {
	constructor() {
		this._cancelled = false;
		this._reason = null;
		this._tasks = new Set();
	}

	cancelled() {
		return this._cancelled ? 1 : 0;
	}

	reason() {
		return this._reason;
	}

	throw_if_cancelled() {
		if ( this._cancelled ) {
			throw this._reason || new CancelledException();
		}
		return null;
	}

	watch( task ) {
		if ( !( task instanceof Task ) ) {
			throw new Exception( 'CancellationToken.watch expects a Task' );
		}
		if ( this._cancelled ) {
			task.cancel( this._reason );
		}
		else {
			this._tasks.add( task );
		}
		return task;
	}
}

class CancellationSource {
	constructor() {
		this._token = new CancellationToken();
	}

	token() {
		return this._token;
	}

	cancel( reason = null ) {
		if ( this._token._cancelled ) {
			return this;
		}
		this._token._cancelled = true;
		this._token._reason = normalizeException(
			reason == null ? 'Task cancelled' : reason,
			CancelledException,
		);
		for ( const task of this._token._tasks ) {
			task.cancel( this._token._reason );
		}
		this._token._tasks.clear();
		return this;
	}

	cancelled() {
		return this._token.cancelled();
	}

	reason() {
		return this._token.reason();
	}
}

function setDebugLevel( level = 0 ) {
	debugLevel = Number( level ) || 0;
}

function clearTrace() {
	traceEvents.length = 0;
	return null;
}

function taskTrace() {
	return traceEvents.map( (record) => ( { ...record } ) );
}

function activeCount() {
	for ( const task of [ ...activeTasks.values() ] ) {
		cleanupTask( task );
	}
	return activeTasks.size;
}

function traceBlockingOperation( operation, metadata = {} ) {
	const task = currentTask();
	if ( !task || debugLevel <= 0 ) {
		return null;
	}
	return traceTask( 'blocked_operation', task, {
		operation: String( operation ?? '' ),
		...metadata,
	} );
}

function shutdown( reason = null ) {
	for ( const task of [ ...activeTasks.values() ] ) {
		if ( !task.done() ) {
			task.cancel( reason == null ? 'Task cancelled' : reason );
		}
	}
	traceTask( 'shutdown', null );
	return null;
}

function resetForRun( level = 0 ) {
	const previousDebugLevel = debugLevel;
	debugLevel = 0;
	shutdown( 'Task cancelled' );
	debugLevel = Number( level ) || 0;
	traceEvents.length = 0;
	nextTaskId = 1;
	fallbackCurrentTask = null;
	callsiteStack.length = 0;
	return previousDebugLevel;
}

function withoutAsyncLocalStorageForTesting( fn ) {
	const previous = taskStorage;
	taskStorage = null;
	try {
		const result = fn();
		if ( result && typeof result.then === 'function' ) {
			return Promise.resolve( result ).finally( () => {
				taskStorage = previous;
				fallbackCurrentTask = null;
			} );
		}
		taskStorage = previous;
		fallbackCurrentTask = null;
		return result;
	}
	catch ( err ) {
		taskStorage = previous;
		fallbackCurrentTask = null;
		throw err;
	}
}

function taskItems( values, label ) {
	if ( !Array.isArray( values ) ) {
		throw new Exception( 'TypeException: task combinator expects Array' );
	}
	const out = [];
	for ( const value of values ) {
		if ( !( value instanceof Task ) ) {
			throw new Exception( `${label} expects only Task values` );
		}
		out.push( value );
	}
	return out;
}

module.exports = {
	Task,
	Exception,
	CancelledException,
	TimeoutException,
	ChannelClosedException,
	Channel,
	CancellationToken,
	CancellationSource,
	awaitValue,
	awaitBlock,
	awaitValueSync,
	awaitBlockSync,
	withCallsite,
	runWithTask,
	currentTask,
	setDebugLevel,
	clearTrace,
	taskTrace,
	activeCount,
	traceBlockingOperation,
	shutdown,
	resetForRun,
	withoutAsyncLocalStorageForTesting,
	task,
	taskSync,
	spawn,
	resolved,
	failed,
	sleep,
	yield: yieldTask,
	all,
	race,
	timeout,
};
