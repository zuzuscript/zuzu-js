'use strict';

const { spawn, spawnSync } = require( 'node:child_process' );
const fs = require( 'node:fs' );
const os = require( 'node:os' );
const path = require( 'node:path' );
const { Task, traceBlockingOperation } = require( './task' );

const signalCallbacks = new Map();
const installedSignals = new Set();

function normalizeSignalName( value ) {
	return String( value ?? '' )
		.trim()
		.replace( /^SIG/iu, '' )
		.toUpperCase();
}

function isPlainObject( value ) {
	return value != null && typeof value === 'object' && !Array.isArray( value );
}

function toCommandArray( command, argv ) {
	if ( Array.isArray( command ) ) {
		return command.map( (item) => String( item ?? '' ) );
	}
	const args = Array.isArray( argv )
		? argv.map( (item) => String( item ?? '' ) )
		: [];
	return [ String( command ?? '' ), ...args ];
}

function normalizeCommandForCwd( cmd ) {
	const out = cmd.slice();
	if (
		out.length > 0
		&& !path.isAbsolute( out[0] )
		&& /[\\/]/u.test( out[0] )
	) {
		out[0] = path.resolve( out[0] );
	}
	return out;
}

function resultOk( result ) {
	if ( !isPlainObject( result ) ) {
		return 0;
	}
	if ( result.error != null && result.error !== '' ) {
		return 0;
	}
	if ( Number( result.signal || 0 ) !== 0 ) {
		return 0;
	}
	if ( Number( result.exit_code || 0 ) !== 0 ) {
		return 0;
	}
	return 1;
}

function cwdErrorResult( cmd, options, message ) {
	const captureStdout = Object.prototype.hasOwnProperty.call( options, 'capture_stdout' )
		? Boolean( options.capture_stdout )
		: true;
	const captureStderr = Object.prototype.hasOwnProperty.call( options, 'capture_stderr' )
		? Boolean( options.capture_stderr )
		: true;
	return {
		command: cmd.slice(),
		exit_code: 0,
		signal: 0,
		core_dump: 0,
		ok: 0,
		stdout: captureStdout ? '' : null,
		stderr: captureStderr ? '' : null,
		error: message,
		timed_out: 0,
	};
}

function buildProcEnv( options ) {
	const hasEnv = isPlainObject( options.env ) ? options.env : null;
	if ( !hasEnv ) {
		return null;
	}
	const env = { ...process.env };
	if ( hasEnv ) {
		for ( const [ key, value ] of Object.entries( hasEnv ) ) {
			if ( value == null ) {
				delete env[key];
			}
			else {
				env[key] = String( value );
			}
		}
	}
	return env;
}

function normalizeCwd( options ) {
	if ( !Object.prototype.hasOwnProperty.call( options, 'cwd' ) ) {
		return { cwd: null };
	}
	const cwd = String( options.cwd ?? '' );
	if ( cwd === '' ) {
		return { cwd: null };
	}
	let stat;
	try {
		stat = fs.statSync( cwd );
	}
	catch ( err ) {
		return {
			error: `cwd does not exist: ${cwd}`,
		};
	}
	if ( !stat.isDirectory() ) {
		return {
			error: `cwd is not a directory: ${cwd}`,
		};
	}
	return { cwd };
}

function statusText( result ) {
	if ( !isPlainObject( result ) ) {
		return 'invalid result';
	}
	if ( result.error != null && result.error !== '' ) {
		return `error: ${result.error}`;
	}
	if ( Number( result.signal || 0 ) !== 0 ) {
		return `signal ${result.signal}`;
	}
	return `exit ${Number( result.exit_code || 0 )}`;
}

function runCommand( cmd, options = {} ) {
	cmd = normalizeCommandForCwd( cmd );
	const stdin = Object.prototype.hasOwnProperty.call( options, 'stdin' )
		? String( options.stdin ?? '' )
		: '';
	const captureStdout = Object.prototype.hasOwnProperty.call( options, 'capture_stdout' )
		? Boolean( options.capture_stdout )
		: true;
	const captureStderr = Object.prototype.hasOwnProperty.call( options, 'capture_stderr' )
		? Boolean( options.capture_stderr )
		: true;
	const mergeStderr = Boolean( options.merge_stderr );
	const timeoutSeconds = Number( options.timeout || 0 );
	const cwd = normalizeCwd( options );
	if ( cwd.error ) {
		return cwdErrorResult( cmd, options, cwd.error );
	}

	const stdinDir = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-proc-stdin-' ) );
	const stdinPath = path.join( stdinDir, 'stdin' );
	fs.writeFileSync( stdinPath, stdin, 'utf8' );
	const stdinFd = fs.openSync( stdinPath, 'r' );
	const spawnOptions = {
		encoding: 'utf8',
		maxBuffer: 10 * 1024 * 1024,
		stdio: [
			stdinFd,
			captureStdout ? 'pipe' : 'inherit',
			mergeStderr ? 'pipe' : ( captureStderr ? 'pipe' : 'inherit' ),
		],
	};

	if ( timeoutSeconds > 0 ) {
		spawnOptions.timeout = Math.floor( timeoutSeconds * 1000 );
		spawnOptions.killSignal = 'SIGALRM';
	}

	if ( cwd.cwd != null ) {
		spawnOptions.cwd = cwd.cwd;
	}

	const env = buildProcEnv( options );
	if ( env != null ) {
		spawnOptions.env = env;
	}

	let spawned;
	try {
		spawned = spawnSync( cmd[0], cmd.slice( 1 ), spawnOptions );
	}
	finally {
		fs.closeSync( stdinFd );
		try {
			fs.unlinkSync( stdinPath );
			fs.rmdirSync( stdinDir );
		}
		catch ( _err ) {
		}
	}
	const timedOut = spawned.error && spawned.error.code === 'ETIMEDOUT';
	const signal = timedOut
		? 14
		: ( spawned.signal ? normalizeSignalName( spawned.signal ) : 0 );
	const result = {
		command: cmd.slice(),
		exit_code: Number.isInteger( spawned.status ) ? spawned.status : 0,
		signal,
		core_dump: 0,
		ok: 0,
		stdout: captureStdout ? String( spawned.stdout ?? '' ) : null,
		stderr: mergeStderr
			? ( captureStderr ? String( spawned.stdout ?? '' ) : null )
			: ( captureStderr ? String( spawned.stderr ?? '' ) : null ),
		error: null,
		timed_out: timedOut ? 1 : 0,
	};

	if ( timedOut ) {
		result.error = `timeout after ${timeoutSeconds}s`;
	}
	else if ( spawned.error && !Number.isInteger( spawned.status ) ) {
		result.error = spawned.error.message || String( spawned.error );
	}

	result.ok = resultOk( result );
	return result;
}

function runCommandAsync( cmd, options = {} ) {
	cmd = normalizeCommandForCwd( cmd );
	let child = null;
	let timeoutTimer = null;
	let timedOut = false;
	const task = new Task( null, {
		status: 'running',
		name: 'proc.run_async',
		cancel() {
			if ( timeoutTimer != null ) {
				clearTimeout( timeoutTimer );
				timeoutTimer = null;
			}
			if ( child && !child.killed ) {
				try {
					child.kill( 'SIGTERM' );
				}
				catch ( _err ) {
				}
			}
		},
	} );
	const stdin = Object.prototype.hasOwnProperty.call( options, 'stdin' )
		? String( options.stdin ?? '' )
		: '';
	const captureStdout = Object.prototype.hasOwnProperty.call( options, 'capture_stdout' )
		? Boolean( options.capture_stdout )
		: true;
	const captureStderr = Object.prototype.hasOwnProperty.call( options, 'capture_stderr' )
		? Boolean( options.capture_stderr )
		: true;
	const mergeStderr = Boolean( options.merge_stderr );
	const timeoutSeconds = Number( options.timeout || 0 );
	const cwd = normalizeCwd( options );
	if ( cwd.error ) {
		task._resolve( cwdErrorResult( cmd, options, cwd.error ) );
		return task;
	}
	const spawnOptions = {
		stdio: [
			'pipe',
			captureStdout ? 'pipe' : 'inherit',
			mergeStderr ? 'pipe' : ( captureStderr ? 'pipe' : 'inherit' ),
		],
	};
	const env = buildProcEnv( options );
	if ( env != null ) {
		spawnOptions.env = env;
	}
	if ( cwd.cwd != null ) {
		spawnOptions.cwd = cwd.cwd;
	}
	let stdout = '';
	let stderr = '';
	let error = null;
	try {
		child = spawn( cmd[0], cmd.slice( 1 ), spawnOptions );
	}
	catch ( err ) {
		task._resolve( {
			command: cmd.slice(),
			exit_code: 0,
			signal: 0,
			core_dump: 0,
			ok: 0,
			stdout: captureStdout ? '' : null,
			stderr: captureStderr ? '' : null,
			error: err.message || String( err ),
			timed_out: 0,
		} );
		return task;
	}
	if ( timeoutSeconds > 0 ) {
		timeoutTimer = setTimeout( () => {
			timedOut = true;
			error = `timeout after ${timeoutSeconds}s`;
			if ( child && !child.killed ) {
				try {
					child.kill( 'SIGALRM' );
				}
				catch ( _err ) {
					try {
						child.kill( 'SIGTERM' );
					}
					catch ( _err2 ) {
					}
				}
			}
		}, Math.floor( timeoutSeconds * 1000 ) );
	}
	if ( child.stdout ) {
		child.stdout.setEncoding( 'utf8' );
		child.stdout.on( 'data', (chunk) => { stdout += chunk; } );
	}
	if ( child.stderr ) {
		child.stderr.setEncoding( 'utf8' );
		child.stderr.on( 'data', (chunk) => { stderr += chunk; } );
	}
	child.on( 'error', (err) => {
		error = err.message || String( err );
	} );
	if ( child.stdin ) {
		child.stdin.on( 'error', (err) => {
			if ( err && err.code !== 'EPIPE' ) {
				error = err.message || String( err );
			}
		} );
		child.stdin.end( stdin );
	}
	child.on( 'close', (code, signalName) => {
		if ( timeoutTimer != null ) {
			clearTimeout( timeoutTimer );
			timeoutTimer = null;
		}
		const signal = timedOut
			? 14
			: ( signalName ? normalizeSignalName( signalName ) : 0 );
		const result = {
			command: cmd.slice(),
			exit_code: Number.isInteger( code ) ? code : 0,
			signal,
			core_dump: 0,
			ok: 0,
			stdout: captureStdout ? stdout : null,
			stderr: mergeStderr
				? ( captureStderr ? stdout : null )
				: ( captureStderr ? stderr : null ),
			error,
			timed_out: timedOut ? 1 : 0,
		};
		result.ok = resultOk( result );
		task._resolve( result );
	} );
	return task;
}

function installSignalHandler( signal ) {
	if ( installedSignals.has( signal ) ) {
		return;
	}
	process.on( `SIG${signal}`, () => {
		const callbacks = signalCallbacks.get( signal ) || [];
		for ( const callback of callbacks ) {
			try {
				callback();
			}
			catch ( _err ) {
			}
		}
	} );
	installedSignals.add( signal );
}

function dispatchSignalCallbacks( signal ) {
	const callbacks = signalCallbacks.get( signal ) || [];
	for ( const callback of callbacks ) {
		try {
			callback();
		}
		catch ( _err ) {
		}
	}
}

class Env {
	static get( name, defaultValue = null ) {
		const key = String( name ?? '' );
		return Object.prototype.hasOwnProperty.call( process.env, key )
			? process.env[key]
			: defaultValue;
	}

	static set( name, value ) {
		const key = String( name ?? '' );
		process.env[key] = String( value ?? '' );
		return process.env[key];
	}

	static remove( name ) {
		delete process.env[String( name ?? '' )];
		return null;
	}
}

class Proc {
	static pid() {
		return process.pid;
	}

	static exit( code = 0 ) {
		process.exit( Number( code ) || 0 );
	}

	static run( command, argv = [], options = {} ) {
		traceBlockingOperation( 'std/proc Proc.run' );
		return runCommand(
			toCommandArray( command, argv ),
			isPlainObject( options ) ? options : {},
		);
	}

	static run_async( command, argv = [], options = {} ) {
		return runCommandAsync(
			toCommandArray( command, argv ),
			isPlainObject( options ) ? options : {},
		);
	}

	static pipeline( commands, options = {} ) {
		traceBlockingOperation( 'std/proc Proc.pipeline' );
		const items = Array.isArray( commands ) ? commands : [];
		const opts = isPlainObject( options ) ? { ...options } : {};
		const steps = [];
		let stdin = Object.prototype.hasOwnProperty.call( opts, 'stdin' )
			? String( opts.stdin ?? '' )
			: '';

		for ( const command of items ) {
			const stepOptions = {
				...opts,
				stdin,
				capture_stdout: true,
			};
			const result = runCommand(
				toCommandArray( command, [] ),
				stepOptions,
			);
			steps.push( result );
			stdin = result.stdout ?? '';
			if ( !result.ok ) {
				break;
			}
		}

		const last = steps.length > 0
			? steps[steps.length - 1]
			: {
				command: [],
				exit_code: 0,
				signal: 0,
				core_dump: 0,
				ok: 1,
				stdout: '',
				stderr: '',
				error: null,
				timed_out: 0,
			};

		return {
			ok: last.ok,
			stdout: last.stdout,
			stderr: last.stderr,
			error: last.error,
			exit_code: last.exit_code,
			signal: last.signal,
			core_dump: last.core_dump,
			timed_out: last.timed_out,
			steps,
		};
	}

	static pipeline_async( commands, options = {} ) {
		return new Task( async () => {
			const items = Array.isArray( commands ) ? commands : [];
			const opts = isPlainObject( options ) ? { ...options } : {};
			const steps = [];
			let stdin = Object.prototype.hasOwnProperty.call( opts, 'stdin' )
				? String( opts.stdin ?? '' )
				: '';
			for ( const command of items ) {
				const result = await runCommandAsync(
					toCommandArray( command, [] ),
					{
						...opts,
						stdin,
						capture_stdout: true,
					},
				);
				steps.push( result );
				stdin = result.stdout ?? '';
				if ( !result.ok ) {
					break;
				}
			}
			const last = steps.length > 0
				? steps[steps.length - 1]
				: {
					command: [],
					exit_code: 0,
					signal: 0,
					core_dump: 0,
					ok: 1,
					stdout: '',
					stderr: '',
					error: null,
					timed_out: 0,
				};
			return {
				ok: last.ok,
				stdout: last.stdout,
				stderr: last.stderr,
				error: last.error,
				exit_code: last.exit_code,
				signal: last.signal,
				core_dump: last.core_dump,
				timed_out: last.timed_out,
				steps,
			};
		}, { name: 'proc.pipeline_async' } );
	}

	static is_success( result ) {
		return resultOk( result );
	}

	static status_text( result ) {
		return statusText( result );
	}

	static kill( signalName, pid = null ) {
		const signal = normalizeSignalName( signalName );
		const target = pid == null ? process.pid : Number( pid );
		if ( target === process.pid && signalCallbacks.has( signal ) ) {
			dispatchSignalCallbacks( signal );
			return 1;
		}
		process.kill( target, `SIG${signal}` );
		return 1;
	}

	static onsignal( signalName, callback ) {
		const signal = normalizeSignalName( signalName );
		if ( !signalCallbacks.has( signal ) ) {
			signalCallbacks.set( signal, [] );
		}
		signalCallbacks.get( signal ).push( callback );
		installSignalHandler( signal );
		return signalCallbacks.get( signal ).length;
	}
}

function sleep( seconds = 0 ) {
	traceBlockingOperation( 'std/proc sleep' );
	const durationMs = Math.max( 0, Number( seconds ) || 0 ) * 1000;
	if ( durationMs <= 0 ) {
		return null;
	}

	if ( typeof SharedArrayBuffer === 'function' && typeof Atomics.wait === 'function' ) {
		const buffer = new SharedArrayBuffer( Int32Array.BYTES_PER_ELEMENT );
		const view = new Int32Array( buffer );
		Atomics.wait( view, 0, 0, durationMs );
		return null;
	}

	const deadline = Date.now() + durationMs;
	while ( Date.now() < deadline ) {
	}
	return null;
}

function sleep_async( seconds = 0 ) {
	let timer = null;
	const readyAt = Date.now() + Math.max( 0, Number( seconds ) || 0 ) * 1000;
	const task = new Task( null, {
		status: 'sleeping',
		name: 'proc.sleep_async',
		poll() {
			if ( Date.now() >= readyAt ) {
				if ( timer != null ) {
					clearTimeout( timer );
					timer = null;
				}
				task._resolve( null );
			}
		},
		cancel() {
			if ( timer != null ) {
				clearTimeout( timer );
				timer = null;
			}
		},
	} );
	timer = setTimeout( () => {
		timer = null;
		task._resolve( null );
	}, Math.max( 0, Number( seconds ) || 0 ) * 1000 );
	return task;
}

module.exports = {
	Proc,
	Env,
	sleep,
	sleep_async,
};
