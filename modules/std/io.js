'use strict';

const fs = require( 'node:fs' );
const os = require( 'node:os' );
const path = require( 'node:path' );
const { BinaryString } = require( '../../lib/runtime-helpers' );
const { Task, traceBlockingOperation } = require( './task' );

let runtimePolicy = {};

function typeName( value ) {
	if ( value == null ) {
		return 'Null';
	}
	if ( typeof value === 'string' ) {
		return 'String';
	}
	if ( value.bytes instanceof Uint8Array ) {
		return 'BinaryString';
	}
	return value.constructor && value.constructor.name ? value.constructor.name : typeof value;
}

function bool( value ) {
	return value ? 1 : 0;
}

function formatSizeHuman( size ) {
	const units = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
	let value = Number( size );
	let unit = 0;
	while ( value >= 1024 && unit < units.length - 1 ) {
		value /= 1024;
		unit++;
	}
	if ( unit === 0 ) {
		return `${value} ${units[unit]}`;
	}
	return `${value.toFixed( 1 )} ${units[unit]}`;
}

function binaryLinesFromBuffer( buffer ) {
	const out = [];
	let start = 0;
	for ( let i = 0; i < buffer.length; i++ ) {
		if ( buffer[i] === 0x0a ) {
			out.push( new BinaryString( Uint8Array.from( buffer.slice( start, i + 1 ) ) ) );
			start = i + 1;
		}
	}
	if ( start < buffer.length ) {
		out.push( new BinaryString( Uint8Array.from( buffer.slice( start ) ) ) );
	}
	return out;
}

function textLinesFromString( text ) {
	const out = [];
	let start = 0;
	for ( let i = 0; i < text.length; i++ ) {
		if ( text[i] === '\n' ) {
			out.push( text.slice( start, i + 1 ) );
			start = i + 1;
		}
	}
	if ( start < text.length ) {
		out.push( text.slice( start ) );
	}
	return out;
}

function renderValue( value ) {
	if ( value && value.bytes instanceof Uint8Array ) {
		return value.to_String();
	}
	if ( typeof runtimePolicy.to_String === 'function' ) {
		return runtimePolicy.to_String( value );
	}
	return String( value ?? '' );
}

function writeStdout( text ) {
	if ( typeof runtimePolicy.stdout_write === 'function' ) {
		runtimePolicy.stdout_write( text );
		return;
	}
	process.stdout.write( text );
}

function writeStderr( text ) {
	if ( typeof runtimePolicy.stderr_write === 'function' ) {
		runtimePolicy.stderr_write( text );
		return;
	}
	process.stderr.write( text );
}

function streamPayload( values, newline ) {
	const text = values.map( renderValue ).join( '' );
	return newline ? `${text}\n` : text;
}

class StandardOutputStream {
	print( ...values ) {
		writeStdout( streamPayload( values, false ) );
		return null;
	}

	say( ...values ) {
		writeStdout( streamPayload( values, true ) );
		return null;
	}
}

class StandardErrorStream {
	print( ...values ) {
		writeStderr( streamPayload( values, false ) );
		return null;
	}

	say( ...values ) {
		writeStderr( streamPayload( values, true ) );
		return null;
	}
}

class StandardInputStream {
	constructor() {
		this._buffer = null;
		this._linePos = 0;
		this._lineMode = 'text';
	}

	_bufferBytes() {
		if ( this._buffer == null ) {
			this._buffer = fs.readFileSync( 0 );
		}
		return this._buffer;
	}

	_lines( raw ) {
		const buffer = this._bufferBytes();
		return raw
			? binaryLinesFromBuffer( buffer )
			: textLinesFromString( buffer.toString( 'utf8' ) );
	}

	next_line( raw = false ) {
		const mode = raw ? 'raw' : 'text';
		if ( this._lineMode !== mode ) {
			this._lineMode = mode;
			this._linePos = 0;
		}
		const lines = this._lines( raw );
		if ( this._linePos >= lines.length ) {
			return null;
		}
		return lines[this._linePos++];
	}

	each_line( fn, raw = false ) {
		for ( const line of this._lines( raw ).slice( this._linePos ) ) {
			fn( line );
			this._linePos++;
		}
		return this;
	}
}

function statToDict( stats ) {
	if ( !stats ) {
		return null;
	}
	const out = {
		dev: stats.dev,
		ino: stats.ino,
		mode: stats.mode,
		nlink: stats.nlink,
		uid: stats.uid,
		gid: stats.gid,
		rdev: stats.rdev,
		size: stats.size,
		atime: Math.floor( stats.atimeMs / 1000 ),
		mtime: Math.floor( stats.mtimeMs / 1000 ),
		ctime: Math.floor( stats.ctimeMs / 1000 ),
		blksize: stats.blksize ?? 0,
		blocks: stats.blocks ?? 0,
	};
	Object.defineProperty( out, 'has', {
		value( key ) {
			return Object.prototype.hasOwnProperty.call( out, String( key ) ) ? 1 : 0;
		},
		enumerable: false,
	} );
	Object.defineProperty( out, 'get', {
		value( key, fallback = null ) {
			return Object.prototype.hasOwnProperty.call( out, String( key ) )
				? out[String( key )]
				: fallback;
		},
		enumerable: false,
	} );
	return out;
}

class Path {
	constructor( rawPath ) {
		this.value = String( rawPath );
		this._linePos = 0;
		this._lineMode = 'text';
	}

	to_String() { return this.value; }
	parent() {
		const dir = path.dirname( this.value );
		return new Path( dir === '' ? '.' : dir );
	}
	sibling( name ) {
		return this.parent().child( name );
	}
	absolute() {
		return new Path( path.resolve( this.value ) );
	}
	realpath() {
		try {
			return new Path( fs.realpathSync( this.value ) );
		}
		catch ( _err ) {
			return null;
		}
	}
	is_absolute() { return path.isAbsolute( this.value ) ? 1 : 0; }
	basename() { return path.basename( this.value ); }
	exists() { return bool( fs.existsSync( this.value ) ); }
	is_file() {
		try {
			return bool( fs.statSync( this.value ).isFile() );
		}
		catch ( _err ) {
			return 0;
		}
	}
	is_dir() {
		try {
			return bool( fs.statSync( this.value ).isDirectory() );
		}
		catch ( _err ) {
			return 0;
		}
	}
	size() { return fs.statSync( this.value ).size; }
	size_human() { return formatSizeHuman( this.size() ); }
	stat() { return statToDict( fs.statSync( this.value ) ); }
	lstat() { return statToDict( fs.lstatSync( this.value ) ); }
	child( name ) { return new Path( path.join( this.value, String( name ) ) ); }
	children() {
		return fs.readdirSync( this.value ).map( (name) => new Path( path.join( this.value, name ) ) );
	}
	iterator() {
		const kids = this.children();
		let i = 0;
		return {
			next() {
				if ( i >= kids.length ) {
					return null;
				}
				return kids[i++];
			},
		};
	}
	chmod( mode ) {
		fs.chmodSync( this.value, Number( mode ) );
		return Number( mode );
	}
	copy( target ) {
		const dest = target instanceof Path ? target : new Path( target );
		fs.copyFileSync( this.value, dest.value );
		return dest;
	}
	move( target ) {
		const dest = target instanceof Path ? target : new Path( target );
		fs.renameSync( this.value, dest.value );
		return dest;
	}
	remove() {
		try {
			fs.rmSync( this.value, { force: true } );
			return 1;
		}
		catch ( _err ) {
			return 0;
		}
	}
	remove_tree() {
		try {
			fs.rmSync( this.value, { recursive: true, force: true } );
			return 1;
		}
		catch ( _err ) {
			return 0;
		}
	}
	touchpath() {
		fs.mkdirSync( path.dirname( this.value ), { recursive: true } );
		if ( !fs.existsSync( this.value ) ) {
			fs.writeFileSync( this.value, '' );
		}
		return this;
	}
	mkdir() {
		fs.mkdirSync( this.value, { recursive: true } );
		return 1;
	}
	mkdir_exclusive() {
		try {
			fs.mkdirSync( this.value );
			return 1;
		}
		catch ( err ) {
			if ( err && err.code === 'EEXIST' ) {
				return 0;
			}
			throw err;
		}
	}
	spew( value ) {
		traceBlockingOperation( 'std/io Path.spew' );
		if ( !( value && value.bytes instanceof Uint8Array ) ) {
			throw new Error( `TypeException: Path.spew expects BinaryString, got ${typeName( value )}` );
		}
		fs.writeFileSync( this.value, Buffer.from( value.bytes ) );
		return this;
	}
	spew_async( value ) {
		return new Task( async () => {
			this.spew( value );
			return this;
		} );
	}
	slurp() {
		traceBlockingOperation( 'std/io Path.slurp' );
		return new BinaryString( Uint8Array.from( fs.readFileSync( this.value ) ) );
	}
	slurp_async() {
		return new Task( async () => (
			new BinaryString( Uint8Array.from( await fs.promises.readFile( this.value ) ) )
		) );
	}
	spew_utf8( text ) {
		traceBlockingOperation( 'std/io Path.spew_utf8' );
		if ( typeof text !== 'string' ) {
			throw new Error( `TypeException: Path.spew_utf8 expects String, got ${typeName( text )}` );
		}
		fs.writeFileSync( this.value, text, 'utf8' );
		return this;
	}
	spew_utf8_async( text ) {
		return new Task( async () => {
			if ( typeof text !== 'string' ) {
				throw new Error( `TypeException: Path.spew_utf8 expects String, got ${typeName( text )}` );
			}
			await fs.promises.writeFile( this.value, text, 'utf8' );
			return this;
		} );
	}
	slurp_utf8() {
		traceBlockingOperation( 'std/io Path.slurp_utf8' );
		return fs.readFileSync( this.value, 'utf8' );
	}
	slurp_utf8_async() {
		return new Task( async () => fs.promises.readFile( this.value, 'utf8' ) );
	}
	append_async( value ) {
		return new Task( async () => {
			if ( !( value && value.bytes instanceof Uint8Array ) ) {
				throw new Error( `TypeException: Path.append expects BinaryString, got ${typeName( value )}` );
			}
			await fs.promises.appendFile( this.value, Buffer.from( value.bytes ) );
			return this;
		} );
	}
	append_utf8_async( text ) {
		return new Task( async () => {
			if ( typeof text !== 'string' ) {
				throw new Error( `TypeException: Path.append_utf8 expects String, got ${typeName( text )}` );
			}
			await fs.promises.appendFile( this.value, text, 'utf8' );
			return this;
		} );
	}
	lines_async() {
		return new Task( async () => binaryLinesFromBuffer( await fs.promises.readFile( this.value ) ) );
	}
	lines_utf8_async() {
		return new Task( async () => textLinesFromString( await fs.promises.readFile( this.value, 'utf8' ) ) );
	}
	each_line( fn, raw = false ) {
		traceBlockingOperation( 'std/io Path.each_line' );
		const lines = raw ? binaryLinesFromBuffer( fs.readFileSync( this.value ) ) : textLinesFromString( this.slurp_utf8() );
		for ( const line of lines ) {
			fn( line );
		}
		return this;
	}
	next_line( raw = false ) {
		traceBlockingOperation( 'std/io Path.next_line' );
		const mode = raw ? 'raw' : 'text';
		if ( this._lineMode !== mode ) {
			this._lineMode = mode;
			this._linePos = 0;
		}
		const lines = raw ? binaryLinesFromBuffer( fs.readFileSync( this.value ) ) : textLinesFromString( this.slurp_utf8() );
		if ( this._linePos >= lines.length ) {
			return null;
		}
		return lines[this._linePos++];
	}

	static cwd() { return new Path( process.cwd() ); }
	static tempfile() {
		const dir = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-' ) );
		return new Path( path.join( dir, 'tmp.txt' ) );
	}
	static tempdir() {
		return new Path( fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-dir-' ) ) );
	}
	static join( parts ) { return new Path( path.join( ...parts.map( (p) => String( p ) ) ) ); }
	static split( source ) { return path.normalize( String( source ) ).split( path.sep ).filter( Boolean ); }
	static normalize( source ) { return new Path( path.normalize( String( source ) ) ); }
	static glob( pattern ) {
		const text = String( pattern );
		const star = text.indexOf( '*' );
		if ( star < 0 ) {
			return fs.existsSync( text ) ? [ new Path( text ) ] : [];
		}
		const dir = path.dirname( text );
		const ext = text.slice( star + 1 );
		return fs.readdirSync( dir )
			.filter( (name) => ext === '' || name.endsWith( ext.replace( /^\./u, '.' ) ) )
			.map( (name) => new Path( path.join( dir, name ) ) );
	}
}

module.exports = {
	Path,
	STDIN: new StandardInputStream(),
	STDOUT: new StandardOutputStream(),
	STDERR: new StandardErrorStream(),
};

Object.defineProperty( module.exports, '__zuzu_set_runtime_policy', {
	value( policy = {} ) {
		runtimePolicy = policy || {};
	},
	enumerable: false,
} );
