'use strict';

function isPlainObject( value ) {
	return value != null
		&& typeof value === 'object'
		&& !Array.isArray( value )
		&& Object.prototype.toString.call( value ) === '[object Object]';
}

function decorateDict( value ) {
	if ( !isPlainObject( value ) ) {
		return value;
	}
	for ( const [ name, fn ] of [
		[ 'length', function _length() { return Object.keys( this ).length; } ],
		[ 'count', function _count() { return Object.keys( this ).length; } ],
		[ 'empty', function _empty() { return Object.keys( this ).length === 0 ? 1 : 0; } ],
		[ 'keys', function _keys() { return Object.keys( this ); } ],
		[ 'values', function _values() { return Object.keys( this ).map( (key) => this[key] ); } ],
		[ 'has', function _has( key ) { return Object.prototype.hasOwnProperty.call( this, String( key ) ) ? 1 : 0; } ],
		[ 'contains', function _contains( key ) { return this.has( key ); } ],
		[ 'exists', function _exists( key ) { return this.has( key ); } ],
		[ 'defined', function _defined( key ) { return this.has( key ) && this[String( key )] != null ? 1 : 0; } ],
		[ 'get', function _get( key, fallback = null ) { return this.has( key ) ? this[String( key )] : fallback; } ],
		[ 'add', function _add( key, inner ) { this[String( key )] = inner; return this; } ],
		[ 'set', function _set( key, inner ) { return this.add( key, inner ); } ],
		[ 'to_Iterator', function _to_iterator() { return this.keys()[Symbol.iterator](); } ],
	] ) {
		if ( !Object.prototype.hasOwnProperty.call( value, name ) ) {
			Object.defineProperty( value, name, {
				value: fn,
				enumerable: false,
				configurable: true,
				writable: true,
			} );
		}
	}
	for ( const key of Object.keys( value ) ) {
		value[key] = convertSafeValue( value[key] );
	}
	return value;
}

function convertSafeValue( value ) {
	if ( value == null ) {
		return null;
	}
	if (
		typeof value === 'string'
		|| typeof value === 'number'
		|| typeof value === 'boolean'
	) {
		return value;
	}
	if ( Array.isArray( value ) ) {
		for ( let i = 0; i < value.length; i++ ) {
			value[i] = convertSafeValue( value[i] );
		}
		return value;
	}
	if ( isPlainObject( value ) ) {
		return decorateDict( value );
	}
	return value;
}

function isSafeValue( value, seen = new Set() ) {
	if ( value == null ) {
		return true;
	}
	if (
		typeof value === 'string'
		|| typeof value === 'number'
		|| typeof value === 'boolean'
	) {
		return true;
	}
	if ( typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol' ) {
		return false;
	}
	if ( seen.has( value ) ) {
		return false;
	}
	seen.add( value );
	try {
		if ( Array.isArray( value ) ) {
			return value.every( (item) => isSafeValue( item, seen ) );
		}
		if ( isPlainObject( value ) ) {
			return Object.values( value ).every( (item) => isSafeValue( item, seen ) );
		}
		return false;
	}
	finally {
		seen.delete( value );
	}
}

function jsonValue( value, seen = new Set() ) {
	if ( value == null ) {
		return null;
	}
	if (
		typeof value === 'string'
		|| typeof value === 'number'
		|| typeof value === 'boolean'
	) {
		return value;
	}
	if ( typeof value === 'bigint' ) {
		return value.toString();
	}
	if ( typeof value === 'function' || typeof value === 'symbol' ) {
		return null;
	}
	if ( seen.has( value ) ) {
		throw new Error( 'Exception: circular JavaScript value cannot be encoded as JSON' );
	}
	seen.add( value );
	try {
		if ( Array.isArray( value ) ) {
			return value.map( (item) => jsonValue( item, seen ) );
		}
		if ( isPlainObject( value ) ) {
			const out = {};
			for ( const [ key, inner ] of Object.entries( value ) ) {
				out[key] = jsonValue( inner, seen );
			}
			return out;
		}
		if ( typeof value.toJSON === 'function' ) {
			return jsonValue( value.toJSON(), seen );
		}
		return String( value );
	}
	finally {
		seen.delete( value );
	}
}

function evaluate( code, thisValue ) {
	const src = String( code ?? '' );
	return Function(
		'code',
		'return (function () { return eval( code ); }).call( this );'
	).call( thisValue, src );
}

class JSResult {
	constructor( value ) {
		this._value = value;
	}

	eval( code ) {
		return new JSResult( evaluate( code, this._value ) );
	}

	isSafe() {
		return isSafeValue( this._value ) ? 1 : 0;
	}

	value() {
		if ( !this.isSafe() ) {
			throw new Error( 'Exception: JavaScript value is not safely representable in Zuzu' );
		}
		return convertSafeValue( this._value );
	}

	toJSON() {
		return JSON.stringify( jsonValue( this._value ) );
	}

	to_String() {
		if ( this._value == null ) {
			return 'null';
		}
		return String( this._value );
	}
}

const JS = {
	eval( code ) {
		return new JSResult( evaluate( code, globalThis ) );
	},
	version() {
		return String( globalThis.process && globalThis.process.version ? globalThis.process.version : 'javascript' );
	},
};

module.exports = {
	JS,
	JSResult,
};
