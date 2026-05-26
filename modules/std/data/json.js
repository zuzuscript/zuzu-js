'use strict';

const { Pair, PairList, ZuzuBag } = require( '../../../lib/collections' );
const { BinaryString } = require( '../../../lib/runtime-helpers' );
const utf8Decoder = new TextDecoder( 'utf-8', { fatal: true } );
const utf8Encoder = new TextEncoder();

function _isPlainObject( value ) {
	return value != null
		&& typeof value === 'object'
		&& !Array.isArray( value )
		&& !( value instanceof PairList )
		&& !( value instanceof ZuzuBag )
		&& Object.prototype.toString.call( value ) !== '[object Set]';
}

function _isSet( value ) {
	return Object.prototype.toString.call( value ) === '[object Set]';
}

function _optionsObject( value ) {
	if ( value instanceof PairList ) {
		const out = {};
		for ( const [ key, inner ] of value.list ) {
			out[String( key )] = inner;
		}
		return out;
	}
	if ( _isPlainObject( value ) ) {
		return value;
	}
	return {};
}

function _decorateDict( value ) {
	if ( !_isPlainObject( value ) ) {
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
				if ( typeof key === 'function' ) {
					for ( const entryKey of Object.keys( this ) ) {
						if ( key( new Pair( { pair: [ entryKey, this[entryKey] ] } ) ) ) {
							delete this[entryKey];
						}
					}
					return this;
				}
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
		value[key] = _decorateValue( value[key] );
	}
	return value;
}

function _decoratePairList( value ) {
	if ( !( value instanceof PairList ) ) {
		return value;
	}
	for ( const [ name, getter ] of [
		[ 'keys', function _keys() { return value.list.map( (pair) => pair[0] ); } ],
		[ 'values', function _values() { return value.list.map( (pair) => pair[1] ); } ],
	] ) {
		if ( !Object.prototype.hasOwnProperty.call( value, name ) ) {
			Object.defineProperty( value, name, {
				get: getter,
				enumerable: false,
				configurable: true,
			} );
		}
	}
	return value;
}

function _decorateArray( value ) {
	if ( !Array.isArray( value ) ) {
		return value;
	}
	for ( let i = 0; i < value.length; i++ ) {
		value[i] = _decorateValue( value[i] );
	}
	return value;
}

function _decorateValue( value ) {
	if ( Array.isArray( value ) ) {
		return _decorateArray( value );
	}
	if ( value instanceof PairList ) {
		return _decoratePairList( value );
	}
	if ( _isPlainObject( value ) ) {
		return _decorateDict( value );
	}
	return value;
}

function _sortCollectionValues( values ) {
	return values
		.slice()
		.sort( (left, right) => String( left ).localeCompare( String( right ) ) );
}

function _collapsePairListEntries( entries ) {
	const order = [];
	const values = new Map();
	for ( const [ rawKey, entryValue ] of entries ) {
		const key = String( rawKey );
		if ( !values.has( key ) ) {
			order.push( key );
		}
		values.set( key, entryValue );
	}
	return order.map( (key) => [ key, values.get( key ) ] );
}

function _objectEntriesForEncode( value, options ) {
	if ( value instanceof PairList ) {
		const entries = value.list.map( (pair) => [ String( pair[0] ), pair[1] ] );
		if ( options.pairlists ) {
			return options.canonical
				? entries.slice().sort( (left, right) => left[0].localeCompare( right[0] ) )
				: entries;
		}
		value = Object.fromEntries( _collapsePairListEntries( entries ) );
	}
	const entries = Object.keys( value ).map( (key) => [ key, value[key] ] );
	if ( options.canonical ) {
		entries.sort( (left, right) => left[0].localeCompare( right[0] ) );
	}
	return entries;
}

function _encodeJson( value, options, depth = 0 ) {
	if ( value == null ) {
		return 'null';
	}
	if ( typeof value === 'string' ) {
		return JSON.stringify( value );
	}
	if ( typeof value === 'number' ) {
		return Number.isFinite( value ) ? String( value ) : 'null';
	}
	if ( typeof value === 'boolean' ) {
		return value ? 'true' : 'false';
	}
	if ( Array.isArray( value ) ) {
		const items = value.map( (item) => {
			const encoded = _encodeJson( item, options, depth + 1 );
			return encoded === undefined ? 'null' : encoded;
		} );
		if ( !options.pretty ) {
			return `[${items.join( ',' )}]`;
		}
		if ( items.length === 0 ) {
			return '[]';
		}
		const indent = '\t'.repeat( depth );
		const inner = '\t'.repeat( depth + 1 );
		return `[\n${inner}${items.join( `,\n${inner}` )}\n${indent}]`;
	}
	if ( value instanceof ZuzuBag ) {
		return _encodeJson( _sortCollectionValues( value.items ), options, depth );
	}
	if ( _isSet( value ) ) {
		return _encodeJson( _sortCollectionValues( [ ...value ] ), options, depth );
	}
	if ( value instanceof PairList || _isPlainObject( value ) ) {
		const entries = _objectEntriesForEncode( value, options )
			.map( (pair) => [ pair[0], _encodeJson( pair[1], options, depth + 1 ) ] )
			.filter( (pair) => pair[1] !== undefined );
		if ( !options.pretty ) {
			return `{${entries.map( (pair) => `${JSON.stringify( pair[0] )}:${pair[1]}` ).join( ',' )}}`;
		}
		if ( entries.length === 0 ) {
			return '{}';
		}
		const indent = '\t'.repeat( depth );
		const inner = '\t'.repeat( depth + 1 );
		return `{\n${inner}${entries.map( (pair) => `${JSON.stringify( pair[0] )}: ${pair[1]}` ).join( `,\n${inner}` )}\n${indent}}`;
	}
	if ( typeof value.toJSON === 'function' ) {
		return _encodeJson( value.toJSON(), options, depth );
	}
	return undefined;
}

function _parseJson( text, pairlists ) {
	let index = 0;
	let source = '';
	if ( text && text.bytes instanceof Uint8Array ) {
		source = utf8Decoder.decode( text.bytes );
	}
	else {
		source = String( text ?? '' );
	}

	function error( message ) {
		throw new Error( `JSON.parse error at position ${index}: ${message}` );
	}

	function skipWhitespace() {
		while ( index < source.length && /\s/u.test( source[index] ) ) {
			index++;
		}
	}

	function parseString() {
		let out = '';
		index++;
		while ( index < source.length ) {
			const ch = source[index++];
			if ( ch === '"' ) {
				return out;
			}
			if ( ch !== '\\' ) {
				out += ch;
				continue;
			}
			if ( index >= source.length ) {
				error( 'unterminated escape sequence' );
			}
			const esc = source[index++];
			if ( esc === '"' || esc === '\\' || esc === '/' ) {
				out += esc;
				continue;
			}
			if ( esc === 'b' ) {
				out += '\b';
				continue;
			}
			if ( esc === 'f' ) {
				out += '\f';
				continue;
			}
			if ( esc === 'n' ) {
				out += '\n';
				continue;
			}
			if ( esc === 'r' ) {
				out += '\r';
				continue;
			}
			if ( esc === 't' ) {
				out += '\t';
				continue;
			}
			if ( esc === 'u' ) {
				const hex = source.slice( index, index + 4 );
				if ( !/^[0-9A-Fa-f]{4}$/u.test( hex ) ) {
					error( 'invalid unicode escape' );
				}
				out += String.fromCharCode( Number.parseInt( hex, 16 ) );
				index += 4;
				continue;
			}
			error( `invalid escape ${esc}` );
		}
		error( 'unterminated string literal' );
	}

	function parseNumber() {
		const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec( source.slice( index ) );
		if ( !match ) {
			error( 'invalid number' );
		}
		index += match[0].length;
		return Number( match[0] );
	}

	function parseLiteral( literal, value ) {
		if ( source.slice( index, index + literal.length ) !== literal ) {
			error( `expected ${literal}` );
		}
		index += literal.length;
		return value;
	}

	function parseArray() {
		index++;
		skipWhitespace();
		const out = [];
		if ( source[index] === ']' ) {
			index++;
			return out;
		}
		while ( index < source.length ) {
			out.push( parseValue() );
			skipWhitespace();
			if ( source[index] === ']' ) {
				index++;
				return out;
			}
			if ( source[index] !== ',' ) {
				error( 'expected , or ]' );
			}
			index++;
			skipWhitespace();
		}
		error( 'unterminated array' );
	}

	function parseObject() {
		index++;
		skipWhitespace();
		const entries = [];
		if ( source[index] === '}' ) {
			index++;
			return pairlists ? _decoratePairList( new PairList() ) : _decorateDict( {} );
		}
		while ( index < source.length ) {
			if ( source[index] !== '"' ) {
				error( 'expected object key string' );
			}
			const key = parseString();
			skipWhitespace();
			if ( source[index] !== ':' ) {
				error( 'expected :' );
			}
			index++;
			skipWhitespace();
			entries.push( [ key, parseValue() ] );
			skipWhitespace();
			if ( source[index] === '}' ) {
				index++;
				if ( pairlists ) {
					return _decoratePairList( new PairList( { list: entries } ) );
				}
				const out = {};
				for ( const [ entryKey, entryValue ] of entries ) {
					Object.defineProperty( out, entryKey, {
						value: entryValue,
						enumerable: true,
						configurable: true,
						writable: true,
					} );
				}
				return _decorateDict( out );
			}
			if ( source[index] !== ',' ) {
				error( 'expected , or }' );
			}
			index++;
			skipWhitespace();
		}
		error( 'unterminated object' );
	}

	function parseValue() {
		skipWhitespace();
		const ch = source[index];
		if ( ch === '"' ) {
			return parseString();
		}
		if ( ch === '[' ) {
			return parseArray();
		}
		if ( ch === '{' ) {
			return parseObject();
		}
		if ( ch === 't' ) {
			return parseLiteral( 'true', true );
		}
		if ( ch === 'f' ) {
			return parseLiteral( 'false', false );
		}
		if ( ch === 'n' ) {
			return parseLiteral( 'null', null );
		}
		return parseNumber();
	}

	const value = parseValue();
	skipWhitespace();
	if ( index !== source.length ) {
		error( 'unexpected trailing input' );
	}
	return _decorateValue( value );
}

function _asPath( value, methodName ) {
	if ( value && typeof value.slurp === 'function' && typeof value.spew === 'function' ) {
		return value;
	}
	throw new Error( `TypeException: ${methodName} expects Path as first argument` );
}

class JSONCodec {
	constructor( options = {}, named = {} ) {
		const merged = {
			..._optionsObject( options ),
			..._optionsObject( named ),
		};
		this.utf8 = Boolean( merged.utf8 );
		this.pretty = Boolean( merged.pretty );
		this.canonical = Boolean( merged.canonical );
		this.pairlists = Boolean( merged.pairlists );
	}

	encode( value ) {
		return _encodeJson( value, {
			canonical: this.canonical,
			pairlists: this.pairlists,
			pretty: this.pretty,
		} );
	}

	encode_binarystring( value ) {
		return new BinaryString( utf8Encoder.encode( this.encode( value ) ) );
	}

	decode( text ) {
		return _parseJson( text, this.pairlists );
	}

	decode_binarystring( raw ) {
		if ( !( raw instanceof BinaryString ) ) {
			throw new Error( 'TypeException: JSON.decode_binarystring expects BinaryString' );
		}
		return _parseJson( raw, this.pairlists );
	}

	load( pathObj ) {
		const pathValue = _asPath( pathObj, 'JSON.load' );
		return this.decode_binarystring( pathValue.slurp() );
	}

	dump( pathObj, value ) {
		const pathValue = _asPath( pathObj, 'JSON.dump' );
		pathValue.spew( this.encode_binarystring( value ) );
		return pathObj;
	}
}

module.exports = {
	JSON: JSONCodec,
};
