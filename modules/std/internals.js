'use strict';

const { getCompiledSource } = require( '../../lib/execution-metadata' );
const taskRuntime = require( './task' );

const frameProps = new Map();
const refIds = new WeakMap();
const scopeTrees = new Map();
const ZUZU_SKIP_BUILD = Symbol.for( 'zuzu.skip_build' );
let refSeq = 1;
let nodeFs;
let nodeFsLoaded = false;
let runtimePolicy = {
	load_module: null,
	to_String: null,
	to_Number: null,
	to_Boolean: null,
	to_Regexp: null,
};

function setRuntimePolicy( policy = {} ) {
	runtimePolicy = {
		...runtimePolicy,
		...policy,
	};
}

function _thisModuleFilename() {
	return typeof __filename === 'string' ? __filename : null;
}

function _nodeFs() {
	if ( nodeFsLoaded ) {
		return nodeFs;
	}
	nodeFsLoaded = true;
	if ( typeof require !== 'function' ) {
		nodeFs = null;
		return nodeFs;
	}
	try {
		nodeFs = require( 'node:fs' );
	}
	catch ( _err ) {
		nodeFs = null;
	}
	return nodeFs;
}

function parseUserFrames() {
	const lines = String( new Error().stack || '' ).split( '\n' ).slice( 1 );
	const frames = [];
	for ( const line of lines ) {
		const trimmed = line.trim();
		let match = trimmed.match( /^at\s+(.*?)\s+\((.+):(\d+):(\d+)\)$/ );
		if ( !match ) {
			match = trimmed.match( /^at\s+(.+):(\d+):(\d+)$/ );
			if ( match ) {
				match = [ match[0], '', match[1], match[2], match[3] ];
			}
		}
		if ( !match ) {
			continue;
		}
		const file = match[2];
		if ( file.includes( '<anonymous>' ) || file.startsWith( 'eval at ' ) ) {
			continue;
		}
		const thisFile = _thisModuleFilename();
		if (
			( thisFile != null && file === thisFile ) ||
			/[\\/]extras[\\/]zuzu-js[\\/]lib[\\/]runtime\.js$/.test( file ) ||
			/[\\/]zuzu-js[\\/]lib[\\/]runtime\.js$/.test( file ) ||
			/[\\/]zuzu-browser\.js$/.test( file ) ||
			file.startsWith( 'node:' ) ||
			file === '[stdin]'
		) {
			continue;
		}
		frames.push( {
			func: match[1] || '',
			file,
			line: Number( match[3] ),
			col: Number( match[4] ),
		} );
	}
	return frames;
}

function loadScopeTree( file ) {
	if ( scopeTrees.has( file ) ) {
		return scopeTrees.get( file );
	}

	let source = '';
	const compiled = getCompiledSource( file );
	if ( compiled != null ) {
		source = compiled;
	}
	else try {
		const fs = _nodeFs();
		if ( !fs ) {
			throw new Error( 'fs unavailable' );
		}
		source = fs.readFileSync( file, 'utf8' );
	}
	catch ( _err ) {
		const fallback = {
			nodes: [ { id: 0, parent: null, startLine: 1, endLine: Number.MAX_SAFE_INTEGER } ],
		};
		scopeTrees.set( file, fallback );
		return fallback;
	}

	const nodes = [
		{ id: 0, parent: null, startLine: 1, endLine: Number.MAX_SAFE_INTEGER },
	];
	const stack = [ 0 ];
	let line = 1;
	let mode = 'code';
	let quote = '';
	let escaped = false;
	let atLineStart = true;
	let inPod = false;

	for ( let i = 0; i < source.length; i++ ) {
		const ch = source[i];
		const next = source[i + 1] || '';

		if ( ch === '\n' ) {
			line++;
			atLineStart = true;
			if ( mode === 'line-comment' ) {
				mode = 'code';
			}
			continue;
		}

		if ( inPod ) {
			if ( atLineStart && ch === '=' ) {
				const end = source.indexOf( '\n', i );
				const rest = source.slice( i, end === -1 ? source.length : end );
				if ( /^=cut\b/.test( rest ) ) {
					inPod = false;
				}
			}
			atLineStart = false;
			continue;
		}

		if ( atLineStart && ch === '=' ) {
			const end = source.indexOf( '\n', i );
			const rest = source.slice( i, end === -1 ? source.length : end );
			if ( /^=\w+/.test( rest ) && !/^=cut\b/.test( rest ) ) {
				inPod = true;
				atLineStart = false;
				continue;
			}
		}

		atLineStart = false;

		if ( mode === 'line-comment' ) {
			continue;
		}

		if ( mode === 'block-comment' ) {
			if ( ch === '*' && next === '/' ) {
				mode = 'code';
				i++;
			}
			continue;
		}

		if ( mode === 'string' ) {
			if ( escaped ) {
				escaped = false;
				continue;
			}
			if ( ch === '\\' ) {
				escaped = true;
				continue;
			}
			if ( ch === quote ) {
				mode = 'code';
			}
			continue;
		}

		if ( ch === '/' && next === '/' ) {
			mode = 'line-comment';
			i++;
			continue;
		}

		if ( ch === '/' && next === '*' ) {
			mode = 'block-comment';
			i++;
			continue;
		}

		if ( ch === '"' || ch === '\'' || ch === '`' ) {
			mode = 'string';
			quote = ch;
			escaped = false;
			continue;
		}

		if ( ch === '{' ) {
			const id = nodes.length;
			nodes.push( {
				id,
				parent: stack[stack.length - 1],
				startLine: line,
				endLine: Number.MAX_SAFE_INTEGER,
			} );
			stack.push( id );
			continue;
		}

		if ( ch === '}' && stack.length > 1 ) {
			const id = stack.pop();
			nodes[id].endLine = line;
		}
	}

	const tree = { nodes };
	scopeTrees.set( file, tree );
	return tree;
}

function scopePathForLocation( file, line ) {
	const tree = loadScopeTree( file );
	let current = 0;
	let found = true;

	while ( found ) {
		found = false;
		for ( let i = tree.nodes.length - 1; i >= 1; i-- ) {
			const node = tree.nodes[i];
			if ( node.parent !== current ) {
				continue;
			}
			if ( node.startLine <= line && line <= node.endLine ) {
				current = node.id;
				found = true;
				break;
			}
		}
	}

	const path = [];
	let nodeId = current;
	while ( nodeId != null ) {
		path.push( nodeId );
		nodeId = tree.nodes[nodeId].parent;
	}
	return path;
}

function contextAtDepth( depth = 0 ) {
	const frames = parseUserFrames();
	const frame = frames[depth];
	if ( !frame ) {
		return null;
	}
	const isVirtualBrowserPath = runtimePolicy.host_name === 'browser';
	const line = isVirtualBrowserPath
		? frame.line - 2
		: frame.line;

	return {
		activationKey: `file:${frame.file}`,
		scopePath: scopePathForLocation( frame.file, Math.max( 1, line ) ),
	};
}

function ensureFrame( activationKey, scopeId ) {
	const key = `${activationKey}#${scopeId}`;
	if ( !frameProps.has( key ) ) {
		frameProps.set( key, new Map() );
	}
	return frameProps.get( key );
}

function getFrame( activationKey, scopeId ) {
	return frameProps.get( `${activationKey}#${scopeId}` );
}

function class_name( value ) {
	if ( value == null || typeof value !== 'object' ) {
		return null;
	}
	return value.constructor && value.constructor.name ? value.constructor.name : null;
}

function object_slots( value ) {
	if ( value == null || typeof value !== 'object' ) {
		return null;
	}
	const out = {};
	for ( const key of Object.keys( value ) ) {
		if ( !key.startsWith( '_' ) ) {
			out[key] = value[key];
		}
	}
	Object.defineProperty(
		out,
		'get',
		{
			value( key ) {
				const id = String( key );
				return Object.prototype.hasOwnProperty.call( out, id ) ? out[id] : null;
			},
			enumerable: false,
		}
	);
	Object.defineProperty(
		out,
		'keys',
		{
			value() {
				return Object.keys( out );
			},
			enumerable: false,
		}
	);
	Object.defineProperty(
		out,
		'sorted_keys',
		{
			value() {
				return Object.keys( out ).sort();
			},
			enumerable: false,
		}
	);
	return out;
}

function ansi_esc() {
	return '\x1b';
}

function ref_id( value ) {
	if ( value == null || ( typeof value !== 'object' && typeof value !== 'function' ) ) {
		return null;
	}
	if ( !refIds.has( value ) ) {
		refIds.set( value, `ref:${refSeq++}` );
	}
	return refIds.get( value );
}

function make_instance( klass, slots = null ) {
	if (
		typeof klass !== 'function'
		|| typeof klass.__zuzu_class_name !== 'string'
	) {
		throw new Error( 'make_instance expects a user class' );
	}
	if ( slots == null ) {
		return new klass( ZUZU_SKIP_BUILD );
	}
	if (
		typeof slots !== 'object'
		|| Array.isArray( slots )
	) {
		throw new Error( 'make_instance slot values must be Dict' );
	}
	return new klass( ZUZU_SKIP_BUILD, slots );
}

function currentUserFile() {
	const frame = parseUserFrames()[0];
	return frame && frame.file ? frame.file : null;
}

function moduleExportKeys( loaded ) {
	return Reflect.ownKeys( Object( loaded ) )
		.filter( (key) => typeof key === 'string' )
		.filter( (key) => !key.startsWith( '__zuzu_' ) );
}

function load_module( moduleName, symbolName = null ) {
	if ( arguments.length < 1 || arguments.length > 2 ) {
		throw new Error( 'load_module expects 1 to 2 arguments' );
	}
	if ( typeof moduleName !== 'string' ) {
		throw new Error( 'load_module module must be String' );
	}
	if ( symbolName != null && typeof symbolName !== 'string' ) {
		throw new Error( 'load_module symbol must be String' );
	}
	if ( typeof runtimePolicy.load_module !== 'function' ) {
		throw new Error( 'load_module is unavailable in this runtime' );
	}

	const loaded = runtimePolicy.load_module( moduleName, currentUserFile() );
	if ( symbolName != null ) {
		if ( !Object.prototype.hasOwnProperty.call( Object( loaded ), symbolName ) ) {
			throw new Error( `Module '${moduleName}' has no export '${symbolName}'` );
		}
		return loaded[symbolName];
	}

	const out = {};
	for ( const key of moduleExportKeys( loaded ) ) {
		out[key] = loaded[key];
	}
	return out;
}

function requirePolicyFunction( name ) {
	const fn = runtimePolicy[name];
	if ( typeof fn !== 'function' ) {
		throw new Error( `${name} is unavailable in this runtime` );
	}
	return fn;
}

function to_String( value ) {
	return requirePolicyFunction( 'to_String' )( value );
}

function to_Number( value ) {
	return requirePolicyFunction( 'to_Number' )( value );
}

function to_Boolean( value ) {
	return requirePolicyFunction( 'to_Boolean' )( value );
}

function to_Regexp( value ) {
	return requirePolicyFunction( 'to_Regexp' )( value );
}

function validateKey( key ) {
	if ( typeof key !== 'string' ) {
		throw new Error( 'getprop|setprop key must be String' );
	}
}

function setprop( key, value ) {
	validateKey( key );
	const ctx = contextAtDepth( 0 );
	if ( !ctx ) {
		return value;
	}
	ensureFrame( ctx.activationKey, ctx.scopePath[0] ).set( key, value );
	return value;
}

function getprop( key ) {
	validateKey( key );
	const ctx = contextAtDepth( 0 );
	if ( !ctx ) {
		return null;
	}
	for ( const scopeId of ctx.scopePath ) {
		const frame = getFrame( ctx.activationKey, scopeId );
		if ( frame && frame.has( key ) ) {
			return frame.get( key );
		}
	}
	return null;
}

function setupperprop( level, key, value ) {
	validateKey( key );
	const ctx = contextAtDepth( Number( level ?? 0 ) );
	if ( !ctx ) {
		return value;
	}
	ensureFrame( ctx.activationKey, ctx.scopePath[0] ).set( key, value );
	return value;
}

function getupperprop( level, key ) {
	validateKey( key );
	const ctx = contextAtDepth( Number( level ?? 0 ) );
	if ( !ctx ) {
		return null;
	}
	for ( const scopeId of ctx.scopePath ) {
		const frame = getFrame( ctx.activationKey, scopeId );
		if ( frame && frame.has( key ) ) {
			return frame.get( key );
		}
	}
	return null;
}

const api = {
	active_task_count: taskRuntime.activeCount,
	ansi_esc,
	class_name,
	clear_task_trace: taskRuntime.clearTrace,
	getprop,
	getupperprop,
	load_module,
	make_instance,
	object_slots,
	ref_id,
	setprop,
	setupperprop,
	shutdown_tasks: taskRuntime.shutdown,
	task_trace: taskRuntime.taskTrace,
	to_Boolean,
	to_Number,
	to_Regexp,
	to_String,
};

Object.defineProperty( api, '__zuzu_set_runtime_policy', {
	value: setRuntimePolicy,
	enumerable: false,
	configurable: true,
	writable: true,
} );

module.exports = api;
