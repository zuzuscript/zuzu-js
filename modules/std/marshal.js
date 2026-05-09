'use strict';

const cbor = require( './marshal/cbor' );
const {
	dumpGraph,
	loadGraph,
	safeToDumpGraph,
	setRuntimePolicy,
} = require( './marshal/graph' );

class MarshallingException extends Error {
	constructor( message = 'std/marshal.dump failed' ) {
		super( String( message ) );
		this.name = 'MarshallingException';
	}

	to_String() {
		return `${this.name}: ${this.message}`;
	}
}

class UnmarshallingException extends Error {
	constructor( message = 'std/marshal.load failed' ) {
		super( String( message ) );
		this.name = 'UnmarshallingException';
	}

	to_String() {
		return `${this.name}: ${this.message}`;
	}
}

function dump( value ) {
	assertArity( 'dump', arguments.length, 1 );
	try {
		return dumpGraph( value );
	}
	catch ( err ) {
		throw new MarshallingException(
			`std/marshal.dump failed: ${err.message || err}`
		);
	}
}

function load( blob ) {
	assertArity( 'load', arguments.length, 1 );
	try {
		return loadGraph( blob );
	}
	catch ( err ) {
		if ( String( err && err.message || err ).startsWith( 'TypeException:' ) ) {
			throw err;
		}
		throw new UnmarshallingException(
			`std/marshal.load failed: ${err.message || err}`
		);
	}
}

function safe_to_dump( value ) {
	assertArity( 'safe_to_dump', arguments.length, 1 );
	return safeToDumpGraph( value );
}

function assertArity( name, got, expected ) {
	if ( got !== expected ) {
		throw new Error(
			`TypeException: ${name} expects ${expected} argument, got ${got}`
		);
	}
}

module.exports = {
	dump,
	load,
	safe_to_dump,
	MarshallingException,
	UnmarshallingException,
	__zuzu_set_runtime_policy: setRuntimePolicy,
};

Object.defineProperty( module.exports, '__cbor', {
	value: cbor,
	enumerable: false,
	configurable: false,
	writable: false,
} );
