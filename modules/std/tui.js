'use strict';

let stdinBuffer = null;
let denyFs = false;

function hasProcess() {
	return typeof process !== 'undefined' && process;
}

function nodeRequire( name ) {
	if ( typeof require !== 'function' ) {
		return null;
	}
	try {
		return require( name );
	}
	catch ( _err ) {
		return null;
	}
}

function ansi_esc() {
	return '\x1b';
}

function supports_ansi() {
	if ( !hasProcess() || process.env.NO_COLOR ) {
		return 0;
	}
	if ( !process.stdout || !process.stdout.isTTY ) {
		return 0;
	}
	if ( process.platform === 'win32' ) {
		return (
			process.env.ANSICON
			|| process.env.WT_SESSION
			|| process.env.ConEmuANSI
			|| process.env.TERM_PROGRAM
		) ? 1 : 0;
	}
	const term = process.env.TERM || '';
	return term && term !== 'dumb' ? 1 : 0;
}

function ansiCode( colour ) {
	switch ( String( colour || '' ).toLowerCase() ) {
		case 'black': return 30;
		case 'red': return 31;
		case 'green': return 32;
		case 'yellow': return 33;
		case 'blue': return 34;
		case 'magenta': return 35;
		case 'cyan': return 36;
		case 'white': return 37;
		default: return null;
	}
}

function colour_text( text, colour ) {
	const value = text == null ? '' : String( text );
	const code = ansiCode( colour );
	if ( !code || !supports_ansi() ) {
		return value;
	}
	return `${ansi_esc()}[${code}m${value}${ansi_esc()}[0m`;
}

function output( text ) {
	if ( hasProcess() && process.stdout && typeof process.stdout.write === 'function' ) {
		process.stdout.write( String( text ) );
		return;
	}
	if ( typeof console !== 'undefined' && typeof console.log === 'function' ) {
		console.log( String( text ) );
	}
}

function write( text, colour ) {
	output( colour_text( text, colour ) );
	return null;
}

function write_line( text, colour ) {
	output( `${colour_text( text, colour )}\n` );
	return null;
}

function readStdinLine() {
	const fs = nodeRequire( 'node:fs' ) || nodeRequire( 'fs' );
	if ( !fs ) {
		return null;
	}
	if ( stdinBuffer == null ) {
		try {
			stdinBuffer = fs.readFileSync( 0, 'utf8' );
		}
		catch ( _err ) {
			stdinBuffer = '';
		}
	}
	if ( stdinBuffer.length === 0 ) {
		return null;
	}
	const match = /^([^\n\r]*)(?:\r?\n|\r)?/.exec( stdinBuffer );
	const line = match ? match[1] : stdinBuffer;
	stdinBuffer = stdinBuffer.slice( match ? match[0].length : stdinBuffer.length );
	return line;
}

function readline( prompt = '', defaultValue = '', _completionCallback = null ) {
	if (
		_completionCallback != null
		&& typeof _completionCallback !== 'function'
	) {
		throw new Error( 'readline completion must be Function or null' );
	}
	output( prompt == null ? '' : String( prompt ) );
	const line = readStdinLine();
	if ( line == null || line === '' ) {
		return defaultValue == null ? '' : String( defaultValue );
	}
	return line;
}

function readline_supports_completion() {
	return 0;
}

function pathCompletions( text, directoryOnly ) {
	if ( denyFs ) {
		return [];
	}
	const fs = nodeRequire( 'node:fs' ) || nodeRequire( 'fs' );
	const path = nodeRequire( 'node:path' ) || nodeRequire( 'path' );
	if ( !fs || !path ) {
		return [];
	}
	const raw = text == null ? '' : String( text );
	const sepMatch = /[/\\]$/u.test( raw );
	const dir = sepMatch ? raw : path.dirname( raw || '.' );
	const base = sepMatch ? '' : path.basename( raw );
	const searchDir = dir && dir !== '.' ? dir : '.';
	const visibleDir = dir && dir !== '.' ? dir : '';
	let entries;
	try {
		entries = fs.readdirSync( searchDir, { withFileTypes: true } );
	}
	catch ( _err ) {
		return [];
	}
	return entries
		.filter( (entry) => entry.name.startsWith( base ) )
		.filter( (entry) => !directoryOnly || entry.isDirectory() )
		.map( (entry) => {
			const prefix = visibleDir ? `${visibleDir}${path.sep}` : '';
			return `${prefix}${entry.name}${entry.isDirectory() ? path.sep : ''}`;
		} )
		.sort();
}

function filename_completions( text ) {
	return pathCompletions( text, false );
}

function directory_completions( text ) {
	return pathCompletions( text, true );
}

const api = {
	ansi_esc,
	colour_text,
	directory_completions,
	filename_completions,
	readline,
	readline_supports_completion,
	supports_ansi,
	write,
	write_line,
};

Object.defineProperty( api, '__zuzu_set_runtime_policy', {
	value( policy = {} ) {
		denyFs = !!policy.deny_fs;
	},
	enumerable: false,
} );

module.exports = api;
