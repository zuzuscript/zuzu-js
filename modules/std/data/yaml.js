'use strict';

const yaml = require( 'js-yaml' );
const { Pair, PairList, ZuzuBag } = require( '../../../lib/collections' );

function isPlainObject( value ) {
	return value != null
		&& typeof value === 'object'
		&& !Array.isArray( value )
		&& !( value instanceof PairList )
		&& !( value instanceof ZuzuBag )
		&& Object.prototype.toString.call( value ) !== '[object Set]';
}

function isPath( value ) {
	return value
		&& value.constructor
		&& value.constructor.name === 'Path'
		&& typeof value.spew_utf8 === 'function';
}

function normalizeValue( value ) {
	if ( value instanceof PairList ) {
		const out = {};
		for ( const [ key, inner ] of value.list ) {
			if ( !Object.prototype.hasOwnProperty.call( out, String( key ) ) ) {
				out[String( key )] = normalizeValue( inner );
			}
		}
		return out;
	}
	if (
		value
		&& Array.isArray( value.items )
		&& typeof value.to_Array === 'function'
	) {
		return normalizeValue(
			value.to_Array().slice()
				.sort( (left, right) => String( left ).localeCompare( String( right ) ) )
		);
	}
	if (
		value
		&& value.constructor
		&& value.constructor.name === 'Set'
		&& typeof value.to_Array === 'function'
	) {
		return normalizeValue(
			value.to_Array().slice()
				.sort( (left, right) => String( left ).localeCompare( String( right ) ) )
		);
	}
	if (
		value
		&& value.constructor
		&& value.constructor.name === 'ZuzuBag'
		&& typeof value.to_Array === 'function'
	) {
		return normalizeValue(
			value.to_Array().slice()
				.sort( (left, right) => String( left ).localeCompare( String( right ) ) )
		);
	}
	if (
		value
		&& value.constructor
		&& [ 'Set', 'ZuzuBag', 'PairList' ].includes( value.constructor.name )
		&& typeof value.to_Array === 'function'
	) {
		return normalizeValue( value.to_Array() );
	}
	if ( Array.isArray( value ) ) {
		return value.map( (item) => normalizeValue( item ) );
	}
	if ( value && value.constructor && value.constructor.name === 'Object' ) {
		const out = {};
		for ( const key of Object.keys( value ).sort() ) {
			out[key] = normalizeValue( value[key] );
		}
		return out;
	}
	return value;
}

function decorateValue( value ) {
	if ( Array.isArray( value ) ) {
		for ( let i = 0; i < value.length; i++ ) {
			value[i] = decorateValue( value[i] );
		}
		return value;
	}
	if ( !isPlainObject( value ) ) {
		return value;
	}
	const sortedKeys = () => Object.keys( value ).sort();
	for ( const [ name, fn ] of [
		[ 'length', function _length() { return Object.keys( this ).length; } ],
		[ 'count', function _count() { return Object.keys( this ).length; } ],
		[ 'empty', function _empty() { return Object.keys( this ).length === 0 ? 1 : 0; } ],
		[ 'keys', function _keys() { return new Set( sortedKeys() ); } ],
		[ 'values', function _values() { return new ZuzuBag( sortedKeys().map( (key) => this[key] ) ); } ],
		[
			'enumerate',
			function _enumerate() {
				return new ZuzuBag(
					sortedKeys().map(
						(key) => new Pair( { pair: [ key, this[key] ] } )
					)
				);
			},
		],
		[ 'has', function _has( key ) { return Object.prototype.hasOwnProperty.call( this, String( key ) ) ? 1 : 0; } ],
		[ 'contains', function _contains( key ) { return this.has( key ); } ],
		[ 'exists', function _exists( key ) { return this.has( key ); } ],
		[ 'defined', function _defined( key ) { return this.has( key ) && this[String( key )] != null ? 1 : 0; } ],
		[ 'get', function _get( key, fallback = null ) { return this.has( key ) ? this[String( key )] : fallback; } ],
		[ 'add', function _add( key, inner ) { this[String( key )] = inner; return this; } ],
		[ 'set', function _set( key, inner ) { return this.add( key, inner ); } ],
		[
			'kv',
			function _kv() {
				const out = [];
				for ( const key of sortedKeys() ) {
					out.push( key, this[key] );
				}
				return out;
			},
		],
		[ 'sorted_keys', function _sorted_keys() { return sortedKeys(); } ],
		[
			'to_Array',
			function _to_array() {
				return sortedKeys().map(
					(key) => new Pair( { pair: [ key, this[key] ] } )
				);
			},
		],
		[ 'to_Iterator', function _to_iterator() { return sortedKeys()[Symbol.iterator](); } ],
		[
			'for_each_key',
			function _for_each_key( fn ) {
				for ( const key of sortedKeys() ) {
					fn( key );
				}
				return this;
			},
		],
		[
			'for_each_value',
			function _for_each_value( fn ) {
				for ( const key of sortedKeys() ) {
					fn( this[key] );
				}
				return this;
			},
		],
		[
			'for_each_pair',
			function _for_each_pair( fn ) {
				for ( const key of sortedKeys() ) {
					fn( new Pair( { pair: [ key, this[key] ] } ) );
				}
				return this;
			},
		],
		[
			'remove',
			function _remove( key ) {
				delete this[String( key )];
				return this;
			},
		],
		[
			'clear',
			function _clear() {
				for ( const key of Object.keys( this ) ) {
					delete this[key];
				}
				return this;
			},
		],
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
		value[key] = decorateValue( value[key] );
	}
	return value;
}

class YAML {
	constructor( options = {} ) {
		const merged = options instanceof PairList
			? Object.fromEntries( options.list.map( ([ key, value ]) => [ String( key ), value ] ) )
			: options;
		this.pretty = !!merged.pretty;
		this.canonical = !!merged.canonical;
	}

	encode( value ) {
		const text = yaml.dump( normalizeValue( value ), {
			lineWidth: -1,
			noArrayIndent: true,
			noRefs: true,
			sortKeys: true,
		} );
		return this.pretty ? text : text.replace( /\n$/u, '' );
	}

	decode( text ) {
		const value = yaml.load( String( text ) );
		return value === undefined ? null : decorateValue( value );
	}

	dump( pathValue, value ) {
		if ( !isPath( pathValue ) ) {
			throw new Error( 'TypeException: YAML.dump expects Path as first argument' );
		}
		pathValue.spew_utf8( this.encode( value ) );
		return pathValue;
	}

	load( pathValue ) {
		if ( !isPath( pathValue ) ) {
			throw new Error( 'TypeException: YAML.load expects Path as first argument' );
		}
		return this.decode( pathValue.slurp_utf8() );
	}
}

module.exports = {
	YAML,
};
