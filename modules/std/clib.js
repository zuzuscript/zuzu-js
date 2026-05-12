'use strict';

const path = require( 'node:path' );
const koffi = require( 'koffi' );
const { BinaryString, ZuzuBinary } = require( '../../lib/runtime-helpers' );

function loadLibc() {
	for ( const name of [ 'libc.so.6', 'libc.dylib', 'msvcrt.dll' ] ) {
		try {
			return koffi.load( name );
		}
		catch ( _err ) {
		}
	}
	return null;
}

const libc = loadLibc();
const strlen = libc ? libc.func( 'strlen', 'size_t', [ 'void *' ] ) : null;

function typeName( value ) {
	if ( value == null ) {
		return 'Null';
	}
	if ( value instanceof ZuzuBinary || value.bytes instanceof Uint8Array ) {
		return 'BinaryString';
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
	return value.constructor && value.constructor.name
		? value.constructor.name
		: typeof value;
}

function isPlainObject( value ) {
	return value != null && typeof value === 'object' && !Array.isArray( value );
}

function normalizeDescriptor( raw, context ) {
	const desc = typeof raw === 'string'
		? { type: raw }
		: ( isPlainObject( raw ) ? { ...raw } : null );
	if ( !desc ) {
		throw new Error( `${context} descriptor must be String or Dict` );
	}

	desc.type = String( desc.type ?? '' ).toLowerCase();
	if ( desc.type === 'null' ) {
		desc.ffiType = 'void';
	}
	else if ( desc.type === 'bool' ) {
		desc.ffiType = 'bool';
	}
	else if ( desc.type === 'int' ) {
		const bits = Number( desc.bits ?? 64 );
		if ( bits !== 64 ) {
			throw new Error( `${context} int descriptor only supports bits=64` );
		}
		desc.bits = 64;
		desc.signed = Object.prototype.hasOwnProperty.call( desc, 'signed' )
			? Boolean( desc.signed )
			: true;
		desc.ffiType = desc.signed ? 'int64_t' : 'uint64_t';
	}
	else if ( desc.type === 'float' ) {
		const bits = Number( desc.bits ?? 64 );
		if ( bits !== 64 ) {
			throw new Error( `${context} float descriptor only supports bits=64` );
		}
		desc.bits = 64;
		desc.ffiType = 'double';
	}
	else if ( desc.type === 'binary' ) {
		desc.ffiType = 'void *';
		desc.nullable = Boolean( desc.nullable );
	}
	else {
		throw new Error( `${context} descriptor has unsupported type '${desc.type}'` );
	}

	return desc;
}

function normalizeParams( raw ) {
	if ( !Array.isArray( raw ) ) {
		throw new Error( 'params descriptor must be Array' );
	}
	return raw.map( (item, index) => normalizeDescriptor(
		item,
		`parameter ${index}`,
	) );
}

function prepareArg( desc, value, index, temps ) {
	if ( desc.type === 'null' ) {
		if ( value != null ) {
			throw new Error( `argument ${index} must be Null, got ${typeName( value )}` );
		}
		return null;
	}
	if ( desc.type === 'bool' ) {
		if ( typeof value !== 'boolean' ) {
			throw new Error( `argument ${index} must be Boolean, got ${typeName( value )}` );
		}
		return value;
	}
	if ( desc.type === 'int' ) {
		if ( typeof value !== 'number' ) {
			throw new Error( `argument ${index} must be Number, got ${typeName( value )}` );
		}
		if ( !desc.signed && value < 0 ) {
			throw new Error( `argument ${index} must be non-negative for unsigned int` );
		}
		return Math.trunc( value );
	}
	if ( desc.type === 'float' ) {
		if ( typeof value !== 'number' ) {
			throw new Error( `argument ${index} must be Number, got ${typeName( value )}` );
		}
		return value;
	}
	if ( desc.type === 'binary' ) {
		if ( value == null ) {
			if ( !desc.nullable ) {
				throw new Error( `argument ${index} must be BinaryString, got Null` );
			}
			return null;
		}
		if ( !( value instanceof ZuzuBinary || value.bytes instanceof Uint8Array ) ) {
			throw new Error(
				`argument ${index} must be BinaryString, got ${typeName( value )}`
			);
		}
		const source = Buffer.from( value.bytes );
		const bytes = desc.terminated_by === 'nul'
			? Buffer.concat( [ source, Buffer.from( [ 0 ] ) ] )
			: source;
		temps.push( bytes );
		return bytes;
	}
	throw new Error( `argument ${index} has unsupported type '${desc.type}'` );
}

function returnLength( desc, args ) {
	if ( Object.prototype.hasOwnProperty.call( desc, 'length' ) ) {
		const length = Math.trunc( Number( desc.length ) );
		if ( length < 0 ) {
			throw new Error( 'binary return length must be non-negative' );
		}
		return length;
	}
	if ( Object.prototype.hasOwnProperty.call( desc, 'length_arg' ) ) {
		const index = Math.trunc( Number( desc.length_arg ) );
		if ( index < 0 || index >= args.length ) {
			throw new Error( `binary return length_arg index ${index} is out of range` );
		}
		const length = Math.trunc( Number( args[index] ) );
		if ( length < 0 ) {
			throw new Error( 'binary return length_arg value must be non-negative' );
		}
		return length;
	}
	return null;
}

function pointerIsNull( ptr ) {
	return ptr == null || koffi.address( ptr ) === 0n;
}

function finishBinaryReturn( owner, desc, ptr, args ) {
	if ( pointerIsNull( ptr ) ) {
		return null;
	}
	let length = returnLength( desc, args );
	if ( length == null ) {
		if ( desc.terminated_by !== 'nul' ) {
			throw new Error( 'binary return requires length, length_arg, or terminated_by' );
		}
		if ( !strlen ) {
			throw new Error( 'binary NUL-terminated return requires libc strlen' );
		}
		length = Number( strlen( ptr ) );
	}
	const out = new BinaryString( Uint8Array.from(
		koffi.decode( ptr, 'uint8_t', length )
	) );
	if ( desc.free ) {
		owner.freeFunction( String( desc.free ) )( ptr );
	}
	return out;
}

function finishReturn( owner, desc, raw, args ) {
	if ( desc.type === 'null' ) {
		return null;
	}
	if ( desc.type === 'bool' ) {
		return Boolean( raw );
	}
	if ( desc.type === 'int' || desc.type === 'float' ) {
		return typeof raw === 'bigint' ? Number( raw ) : Number( raw );
	}
	if ( desc.type === 'binary' ) {
		return finishBinaryReturn( owner, desc, raw, args );
	}
	throw new Error( `return descriptor has unsupported type '${desc.type}'` );
}

class CLib {
	static open( rawPath ) {
		const libraryPath = path.resolve( String( rawPath ?? '' ) );
		let loaded;
		try {
			loaded = koffi.load( libraryPath );
		}
		catch ( err ) {
			throw new Error( `Could not load C library '${rawPath}': ${err.message}` );
		}
		return new CLibrary( libraryPath, loaded );
	}
}

class CLibrary {
	constructor( libraryPath, loaded ) {
		this.path = libraryPath;
		this.loaded = loaded;
		this.closed = false;
		this.freeFunctions = new Map();
	}

	assertOpen() {
		if ( this.closed ) {
			throw new Error( 'CLibrary is closed' );
		}
	}

	has_symbol( name ) {
		this.assertOpen();
		try {
			this.loaded.func( String( name ?? '' ), 'void *', [] );
			return true;
		}
		catch ( _err ) {
			return false;
		}
	}

	close() {
		this.closed = true;
		return null;
	}

	freeFunction( name ) {
		if ( !this.freeFunctions.has( name ) ) {
			this.freeFunctions.set(
				name,
				this.loaded.func( name, 'void', [ 'void *' ] ),
			);
		}
		return this.freeFunctions.get( name );
	}

	func( name, params, returnType ) {
		this.assertOpen();
		const symbol = String( name ?? '' );
		if ( symbol === '' ) {
			throw new Error( 'C function name must not be empty' );
		}
		const paramDescs = normalizeParams( params );
		const returnDesc = normalizeDescriptor( returnType, 'return' );
		const paramTypes = paramDescs.map( (desc) => desc.ffiType );
		let callable;
		try {
			callable = this.loaded.func( symbol, returnDesc.ffiType, paramTypes );
		}
		catch ( err ) {
			throw new Error(
				`Could not bind C function '${symbol}' in '${this.path}': ${err.message}`
			);
		}
		if ( returnDesc.type === 'binary' && returnDesc.free ) {
			try {
				this.freeFunction( String( returnDesc.free ) );
			}
			catch ( err ) {
				throw new Error(
					`Could not bind free function '${returnDesc.free}' in `
					+ `'${this.path}': ${err.message}`
				);
			}
		}
		return new CFunction( this, symbol, paramDescs, returnDesc, callable );
	}
}

class CFunction {
	constructor( owner, name, paramDescs, returnDesc, callable ) {
		this.owner = owner;
		this.name = name;
		this.paramDescs = paramDescs;
		this.returnDesc = returnDesc;
		this.callable = callable;
	}

	call( ...args ) {
		if ( this.owner.closed ) {
			throw new Error( 'CFunction belongs to a closed CLibrary' );
		}
		if ( args.length !== this.paramDescs.length ) {
			throw new Error(
				`Function '${this.name}' expects ${this.paramDescs.length} `
				+ `arguments, got ${args.length}`
			);
		}
		const temps = [];
		const ffiArgs = this.paramDescs.map( (desc, index) => prepareArg(
			desc,
			args[index],
			index,
			temps,
		) );
		const raw = this.callable( ...ffiArgs );
		return finishReturn( this.owner, this.returnDesc, raw, args );
	}
}

module.exports = {
	CLib,
	CLibrary,
	CFunction,
};
