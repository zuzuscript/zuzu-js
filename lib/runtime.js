'use strict';

const { capabilitiesForModule } = require( './host/capabilities' );
const { setCompiledSource } = require( './execution-metadata' );

const {
	DEFAULT_TRANSPILER,
	normalizeTranspilerName,
	transpile,
	stripPod,
} = require( './transpiler' );
const {
	collectTopLevelDeclarations,
	runSwitch,
	runMatch,
	contains,
	collectionUnion,
	collectionIntersection,
	collectionDifference,
	collectionSubsetOf,
	collectionSupersetOf,
	collectionEquivalentOf,
	makeSet,
	makeBag,
	makePairList,
	lengthOf,
	operatorString,
	operatorRegexp,
	ZuzuBinary,
	BinaryString,
	Pair,
	PairList,
	withArrayMethods,
	ZuzuBag,
	isWeakableValue,
	makeWeakValue,
	resolveWeakValue,
	retainValue,
	releaseValue,
	assignStrongValue,
	assignWeakValue,
} = require( './runtime-helpers' );
const taskRuntime = require( '../modules/std/task' );

const textEncoder = new TextEncoder();
const utf8Decoder = new TextDecoder( 'utf-8', { fatal: true } );
const ZUZU_SKIP_BUILD = Symbol.for( 'zuzu.skip_build' );

function defaultModuleSearchRoots( host, repoRoot, includePaths ) {
	if ( host.name === 'browser' ) {
		return includePaths.slice();
	}
	const pathsModule = './' + 'paths';
	return require( pathsModule ).defaultModuleSearchRoots( {
		includePaths,
		packageRoot: repoRoot,
		initialCwd: host.cwd(),
	} );
}

function installHostCollectionMethods() {
	withArrayMethods();
	const define = ( proto, name, fn ) => {
		if ( !Object.prototype.hasOwnProperty.call( proto, name ) ) {
			const desc = Object.create( null );
			desc.value = fn;
			desc.enumerable = false;
			desc.configurable = true;
			desc.writable = true;
			Object.defineProperty( proto, name, desc );
		}
	};
	define( Array.prototype, 'push_weak', function _pushWeak( ...values ) {
		this.push( ...values.map( makeWeakValue ) );
		return this;
	} );
	define( Array.prototype, 'unshift_weak', function _unshiftWeak( ...values ) {
		this.unshift( ...values.map( makeWeakValue ) );
		return this;
	} );
	define( Array.prototype, 'set_weak', function _setWeak( index, value ) {
		this[index] = makeWeakValue( value );
		return this;
	} );
	define( Set.prototype, 'add_weak', function _addWeak( value ) {
		this.add( makeWeakValue( value ) );
		return this;
	} );
	define( Set.prototype, 'copy', function _copy() {
		return new Set( this );
	} );
	define( ZuzuBag.prototype, 'add_weak', function _addWeak( ...values ) {
		this.items.push( ...values.map( makeWeakValue ) );
		return this;
	} );
	define( ZuzuBag.prototype, 'push_weak', function _pushWeak( ...values ) {
		return this.add_weak( ...values );
	} );
	define( PairList.prototype, 'add_weak', function _addWeak( key, value ) {
		this.list.push( [ String( key ), makeWeakValue( value ) ] );
		return this;
	} );
	define( PairList.prototype, 'set_weak', function _setWeak( key, value ) {
		return this.add_weak( key, value );
	} );
	Object.defineProperty( ZuzuBag.prototype, 'contains', {
		value: function _containsWeakAware( value ) {
			const resolved = resolveWeakValue( value );
			return this.items.some( (item) => resolveWeakValue( item ) === resolved ) ? 1 : 0;
		},
		enumerable: false,
		configurable: true,
		writable: true,
	} );
	Object.defineProperty( Set.prototype, 'contains', {
		value: function _containsWeakAware( value ) {
			const resolved = resolveWeakValue( value );
			for ( const item of this ) {
				if ( resolveWeakValue( item ) === resolved ) {
					return 1;
				}
			}
			return 0;
		},
		enumerable: false,
		configurable: true,
		writable: true,
	} );
}

function createObjectFacade() {
	function ZuzuContextObject( value ) {
		if ( new.target ) {
			return undefined;
		}
		return Object( value );
	}
	Object.setPrototypeOf( ZuzuContextObject, Object );
	Object.defineProperty( ZuzuContextObject, 'prototype', {
		value: Object.prototype,
		enumerable: false,
		configurable: false,
		writable: false,
	} );
	return ZuzuContextObject;
}

function zuzuStringify( value ) {
	value = resolveWeakValue( value );
	if ( value == null ) {
		return '';
	}
	if ( typeof value === 'boolean' ) {
		return value ? '1' : '0';
	}
	if ( value instanceof RegExp ) {
		return value.source;
	}
	if ( value instanceof ZuzuBinary ) {
		return value.to_String();
	}
	if ( value && typeof value.to_String === 'function' ) {
		return String( value.to_String() );
	}
	if ( value instanceof Error ) {
		return value.message || value.name || String( value );
	}
	return String( value );
}

function zuzuOperatorString( value ) {
	return operatorString( value );
}

function binaryFromLiteral( value ) {
	const text = String( value ?? '' );
	const bytes = [];
	for ( let i = 0; i < text.length; i++ ) {
		bytes.push( text.charCodeAt( i ) & 0xff );
	}
	return new BinaryString( bytes );
}

function toBinaryValue( value ) {
	value = resolveWeakValue( value );
	if ( value instanceof ZuzuBinary ) {
		return new BinaryString( value );
	}
	if ( typeof value === 'string' ) {
		return new BinaryString( textEncoder.encode( value ) );
	}
	throw new Error( `TypeException: expected String for to_binary, got ${zuzuTypeof( value )}` );
}

function toStringValue( value ) {
	value = resolveWeakValue( value );
	if ( typeof value === 'string' ) {
		return value;
	}
	if ( value instanceof ZuzuBinary ) {
		try {
			return utf8Decoder.decode( value.bytes );
		}
		catch ( err ) {
			return Array.from( value.bytes, (byte) => String.fromCharCode( byte ) ).join( '' );
		}
	}
	throw new Error( `TypeException: expected BinaryString for to_string, got ${zuzuTypeof( value )}` );
}

function stringCompare( left, right, options = {} ) {
	const l = options.insensitive
		? zuzuOperatorString( left ).toLowerCase()
		: zuzuOperatorString( left );
	const r = options.insensitive
		? zuzuOperatorString( right ).toLowerCase()
		: zuzuOperatorString( right );
	return l.localeCompare( r );
}

function parseNumericString( value ) {
	const text = String( value ).trim();
	const match = text.match( /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/ );
	if ( !match ) {
		throw new Error( `TypeException: cannot coerce String to Number: ${JSON.stringify( String( value ) )}` );
	}
	const parsed = Number( text );
	if ( Number.isNaN( parsed ) ) {
		throw new Error( `TypeException: cannot coerce String to Number: ${JSON.stringify( String( value ) )}` );
	}
	return parsed;
}

function zuzuToNumber( value ) {
	value = resolveWeakValue( value );
	if ( value == null ) {
		return 0;
	}
	if ( typeof value === 'number' || Object.prototype.toString.call( value ) === '[object Number]' ) {
		return Number( value );
	}
	if ( typeof value === 'boolean' || Object.prototype.toString.call( value ) === '[object Boolean]' ) {
		return value.valueOf() ? 1 : 0;
	}
	if ( typeof value === 'string' || Object.prototype.toString.call( value ) === '[object String]' ) {
		return parseNumericString( value );
	}
	if ( typeof value === 'function' ) {
		throw new Error( `TypeException: cannot coerce ${zuzuTypeof( value )} to Number` );
	}
	if ( value && typeof value.to_Number === 'function' ) {
		return zuzuToNumber( value.to_Number() );
	}
	throw new Error( `TypeException: cannot coerce ${zuzuTypeof( value )} to Number` );
}

function zuzuTruthy( value ) {
	value = resolveWeakValue( value );
	if ( value == null ) {
		return false;
	}
	if ( value && typeof value.to_Boolean === 'function' ) {
		return zuzuTruthy( value.to_Boolean() );
	}
	if ( value instanceof ZuzuBinary ) {
		return value.byteLength() > 0;
	}
	if ( typeof value === 'boolean' || Object.prototype.toString.call( value ) === '[object Boolean]' ) {
		return value.valueOf() === true;
	}
	if ( typeof value === 'number' || Object.prototype.toString.call( value ) === '[object Number]' ) {
		return Number( value ) !== 0;
	}
	if ( typeof value === 'string' || Object.prototype.toString.call( value ) === '[object String]' ) {
		return String( value ) !== '';
	}
	if ( Array.isArray( value ) ) {
		return value.length > 0;
	}
	if ( value instanceof PairList ) {
		return value.length() > 0;
	}
	if ( value instanceof ZuzuBag ) {
		return value.length() > 0;
	}
	if ( isSetLike( value ) ) {
		return value.size > 0;
	}
	const ctorName = value && value.constructor && value.constructor.name;
	if ( value && typeof value === 'object' && ( ctorName === 'Object' || ctorName == null ) ) {
		return Object.keys( value ).length > 0;
	}
	return Boolean( value );
}

function defaultOperator( leftInput, rightInput ) {
	const left = resolveWeakValue( leftInput );
	const right = resolveWeakValue( rightInput );
	const leftType = zuzuTypeof( left );
	if ( left != null && leftType !== 'Dict' && !( left instanceof PairList ) ) {
		throw new Error(
			`TypeException: default operator left operand expects Dict, PairList, or Null, got ${leftType}`
		);
	}
	if ( zuzuTypeof( right ) !== 'Dict' && !( right instanceof PairList ) ) {
		throw new Error(
			`TypeException: default operator right operand expects Dict or PairList, got ${zuzuTypeof( right )}`
		);
	}

	if ( leftType === 'Dict' ) {
		const result = {};
		for ( const key of Object.keys( left ) ) {
			result[key] = left[key];
		}
		if ( right instanceof PairList ) {
			for ( const [ key, value ] of right.list ) {
				if ( !Object.prototype.hasOwnProperty.call( result, key ) ) {
					result[key] = value;
				}
			}
		}
		else {
			for ( const key of Object.keys( right ).sort() ) {
				if ( !Object.prototype.hasOwnProperty.call( result, key ) ) {
					result[key] = right[key];
				}
			}
		}
		return result;
	}

	const values = left instanceof PairList
		? left.list.map( ([ key, value ]) => [ key, value ] )
		: [];
	const originalKeys = new Set( values.map( ([ key ]) => key ) );
	if ( right instanceof PairList ) {
		for ( const [ key, value ] of right.list ) {
			if ( !originalKeys.has( key ) ) {
				values.push( [ key, value ] );
			}
		}
	}
	else {
		for ( const key of Object.keys( right ).sort() ) {
			if ( !originalKeys.has( key ) ) {
				values.push( [ key, right[key] ] );
			}
		}
	}
	return makePairList( values );
}

function isNumericComparable( value ) {
	value = resolveWeakValue( value );
	if ( value == null ) {
		return true;
	}
	if (
		typeof value === 'number'
		|| typeof value === 'string'
		|| typeof value === 'boolean'
	) {
		return true;
	}
	const tag = Object.prototype.toString.call( value );
	if (
		tag === '[object Number]'
		|| tag === '[object String]'
		|| tag === '[object Boolean]'
	) {
		return true;
	}
	return Boolean( value && typeof value.to_Number === 'function' );
}

function numericEqual( left, right ) {
	const leftNum = zuzuToNumber( left );
	const rightNum = zuzuToNumber( right );
	if ( Object.is( leftNum, rightNum ) ) {
		return true;
	}
	if ( Number.isInteger( leftNum ) && Number.isInteger( rightNum ) ) {
		return false;
	}
	const scale = Math.max( 1, Math.abs( leftNum ), Math.abs( rightNum ) );
	return Math.abs( leftNum - rightNum ) <= ( Number.EPSILON * 16 * scale );
}

function isExhaustedIteratorError( err ) {
	if ( !err ) {
		return false;
	}
	const name = String( err.name || err.constructor && err.constructor.name || '' );
	if ( name === 'ExhaustedException' ) {
		return true;
	}
	const message = String( err.message || '' );
	if ( /\bExhaustedException\b/.test( message ) ) {
		return true;
	}
	const stack = String( err.stack || '' );
	return /\bExhaustedException\b/.test( stack );
}

function formatRuntimeError( err ) {
	if ( err && err.name === 'SyntaxError' && typeof err.stack === 'string' && err.stack.trim() ) {
		return `${err.stack}\n`;
	}
	if ( err && err.name && err.message ) {
		return `${err.name}: ${err.message}\n`;
	}
	return `${String( err )}\n`;
}

async function runSwitchAsync( value, comparator, cases, defaultBody ) {
	const cmp = (left, right) => {
		switch ( comparator ) {
			case 'eq':
				return stringCompare( left, right ) === 0;
			case 'ne':
				return stringCompare( left, right ) !== 0;
			case '=':
				return numericEqual( zuzuToNumber( left ), zuzuToNumber( right ) );
			case '==':
			default:
				return !!zuzuEqual( left, right );
		}
	};
	let runNext = false;
	for ( const section of cases ) {
		const matched = section.values.some( (item) => cmp( value, item ) );
		if ( matched || runNext ) {
			const result = await taskRuntime.awaitValue( section.body() );
			runNext = result === true;
			if ( !runNext && result && typeof result === 'object' && result.__zuzu_return ) {
				return result;
			}
			if ( !runNext ) {
				return null;
			}
		}
	}
	if ( defaultBody ) {
		const result = await taskRuntime.awaitValue( defaultBody() );
		if ( result && typeof result === 'object' && result.__zuzu_return ) {
			return result;
		}
	}
	return null;
}

function concatValue( left, right ) {
	left = resolveWeakValue( left );
	right = resolveWeakValue( right );
	if ( left instanceof ZuzuBinary && right instanceof ZuzuBinary ) {
		const merged = new Uint8Array( left.length + right.length );
		merged.set( left.bytes, 0 );
		merged.set( right.bytes, left.length );
		return new BinaryString( merged );
	}
	if ( typeof left === 'string' && typeof right === 'string' ) {
		return left + right;
	}
	if ( left instanceof ZuzuBinary && typeof right === 'string' ) {
		if ( !left.isAscii() ) {
			throw new Error( 'TypeException: Cannot implicitly concatenate non-ASCII BinaryString with String' );
		}
		return left.to_String() + right;
	}
	if ( typeof left === 'string' && right instanceof ZuzuBinary ) {
		if ( !right.isAscii() ) {
			throw new Error( 'TypeException: Cannot implicitly concatenate non-ASCII BinaryString with String' );
		}
		return left + right.to_String();
	}
	return zuzuOperatorString( left ) + zuzuOperatorString( right );
}

function operatorLength( value ) {
	value = resolveWeakValue( value );
	if ( value instanceof ZuzuBinary ) {
		return value.byteLength();
	}
	if (
		Array.isArray( value )
		|| value instanceof PairList
		|| value instanceof ZuzuBag
		|| isSetLike( value )
		|| ( value && typeof value === 'object' && value.constructor && value.constructor.name === 'Object' )
	) {
		return lengthOf( value );
	}
	return [ ...zuzuOperatorString( value ) ].length;
}

function regexReplaceValue( current, pattern, replacement ) {
	const source = zuzuOperatorString( current );
	const regex = operatorRegexp( pattern );
	return source.replace( regex, replacement );
}

function bitwiseBinaryPair( left, right, opName ) {
	if ( left.length !== right.length ) {
		throw new Error( 'Exception: BinaryString bitwise operands must be equal length' );
	}
	const out = new Uint8Array( left.length );
	for ( let i = 0; i < left.length; i++ ) {
		const a = left.bytes[i];
		const b = right.bytes[i];
		if ( opName === 'and' ) {
			out[i] = a & b;
		}
		else if ( opName === 'or' ) {
			out[i] = a | b;
		}
		else {
			out[i] = a ^ b;
		}
	}
	return new BinaryString( out );
}

function bitwiseAnd( left, right ) {
	if ( left instanceof ZuzuBinary && right instanceof ZuzuBinary ) {
		return bitwiseBinaryPair( left, right, 'and' );
	}
	return ( ( zuzuToNumber( left ) >>> 0 ) & ( zuzuToNumber( right ) >>> 0 ) ) >>> 0;
}

function bitwiseOr( left, right ) {
	if ( left instanceof ZuzuBinary && right instanceof ZuzuBinary ) {
		return bitwiseBinaryPair( left, right, 'or' );
	}
	return ( ( zuzuToNumber( left ) >>> 0 ) | ( zuzuToNumber( right ) >>> 0 ) ) >>> 0;
}

function bitwiseXor( left, right ) {
	if ( left instanceof ZuzuBinary && right instanceof ZuzuBinary ) {
		return bitwiseBinaryPair( left, right, 'xor' );
	}
	return ( ( zuzuToNumber( left ) >>> 0 ) ^ ( zuzuToNumber( right ) >>> 0 ) ) >>> 0;
}

function bitwiseNot( value ) {
	value = resolveWeakValue( value );
	if ( value instanceof ZuzuBinary ) {
		const out = new Uint8Array( value.length );
		for ( let i = 0; i < value.length; i++ ) {
			out[i] = ( ~value.bytes[i] ) & 0xff;
		}
		return new BinaryString( out );
	}
	return ( ~( zuzuToNumber( value ) >>> 0 ) ) >>> 0;
}

function zuzuComparableValue( value ) {
	value = resolveWeakValue( value );
	if ( typeof value === 'function' && value.length === 0 ) {
		try {
			return value();
		}
		catch ( _err ) {
			return value;
		}
	}
	return value;
}

function zuzuEqual( left, right ) {
	const a = zuzuComparableValue( left );
	const b = zuzuComparableValue( right );
	if ( a === b ) {
		return 1;
	}
	if ( a == null || b == null ) {
		return 0;
	}
	if ( a instanceof ZuzuBinary && b instanceof ZuzuBinary ) {
		if ( a.bytes.length !== b.bytes.length ) {
			return 0;
		}
		for ( let i = 0; i < a.bytes.length; i++ ) {
			if ( a.bytes[i] !== b.bytes[i] ) {
				return 0;
			}
		}
		return 1;
	}
	if ( Array.isArray( a ) && Array.isArray( b ) ) {
		if ( a.length !== b.length ) {
			return 0;
		}
		for ( let i = 0; i < a.length; i++ ) {
			if ( !zuzuEqual( a[i], b[i] ) ) {
				return 0;
			}
		}
		return 1;
	}
	if ( isSetLike( a ) && isSetLike( b ) ) {
		return collectionEquivalentOf( a, b ) ? 1 : 0;
	}
	if ( isBagLike( a ) && isBagLike( b ) ) {
		return zuzuEqual( a.to_Array(), b.to_Array() );
	}
	if ( a instanceof PairList && b instanceof PairList ) {
		if ( a.list.length !== b.list.length ) {
			return 0;
		}
		for ( let i = 0; i < a.list.length; i++ ) {
			if ( a.list[i][0] !== b.list[i][0] ) {
				return 0;
			}
			if ( !zuzuEqual( a.list[i][1], b.list[i][1] ) ) {
				return 0;
			}
		}
		return 1;
	}
	if ( isPlainObjectLike( a ) && isPlainObjectLike( b ) ) {
		const keysA = Object.keys( a ).sort();
		const keysB = Object.keys( b ).sort();
		if ( !zuzuEqual( keysA, keysB ) ) {
			return 0;
		}
		for ( const key of keysA ) {
			if ( !zuzuEqual( a[key], b[key] ) ) {
				return 0;
			}
		}
		return 1;
	}
	return 0;
}

function isSetLike( value ) {
	return Object.prototype.toString.call( value ) === '[object Set]';
}

function isBagLike( value ) {
	return value instanceof ZuzuBag || ( value && value.constructor && value.constructor.name === 'ZuzuBag' );
}

function isPlainObjectLike( value ) {
	return Object.prototype.toString.call( value ) === '[object Object]'
		&& !( value.constructor && value.constructor.__zuzu_class_name );
}

function isDictMethodReceiver( value ) {
	return value
		&& typeof value === 'object'
		&& !Array.isArray( value )
		&& !( value instanceof PairList )
		&& !isSetLike( value )
		&& !isBagLike( value );
}

function normalizeDictKey( key ) {
	key = resolveWeakValue( key );
	if ( key == null ) {
		return '';
	}
	if ( typeof key === 'string' ) {
		return key;
	}
	if ( key instanceof ZuzuBinary ) {
		return key.to_String();
	}
	if ( key && typeof key.to_String === 'function' ) {
		return String( key.to_String() );
	}
	return String( key );
}

const DICT_METHODS = Object.freeze( {
	length( self ) {
		return isDictMethodReceiver( self ) ? Object.keys( self ).length : 0;
	},
	keys( self ) {
		return isDictMethodReceiver( self ) ? Object.keys( self ).sort() : [];
	},
	values( self ) {
		if ( !isDictMethodReceiver( self ) ) {
			return [];
		}
		return DICT_METHODS.keys( self ).map( (key) => resolveWeakValue( self[key] ) );
	},
	copy( self ) {
		if ( !isDictMethodReceiver( self ) ) {
			return {};
		}
		const out = {};
		for ( const key of Object.keys( self ) ) {
			out[key] = self[key];
		}
		return out;
	},
	enumerate( self ) {
		if ( !isDictMethodReceiver( self ) ) {
			return [];
		}
		return DICT_METHODS.keys( self ).map(
			(key) => new Pair( { pair: [ key, resolveWeakValue( self[key] ) ] } )
		);
	},
	has( self, key ) {
		return isDictMethodReceiver( self )
			&& Object.prototype.hasOwnProperty.call( self, normalizeDictKey( key ) )
			? 1
			: 0;
	},
	contains( self, key ) {
		return DICT_METHODS.has( self, key );
	},
	exists( self, key ) {
		return DICT_METHODS.has( self, key );
	},
	defined( self, key ) {
		const normalized = normalizeDictKey( key );
		return isDictMethodReceiver( self )
			&& resolveWeakValue( self[normalized] ) != null ? 1 : 0;
	},
	get( self, key, fallback = null ) {
		const normalized = normalizeDictKey( key );
		return DICT_METHODS.has( self, normalized )
			? resolveWeakValue( self[normalized] )
			: fallback;
	},
	add( self, key, value ) {
		if ( !isDictMethodReceiver( self ) || key instanceof Pair ) {
			return self;
		}
		const normalized = normalizeDictKey( key );
		releaseValue( self[normalized] );
		self[normalized] = retainValue( value );
		return self;
	},
	set( self, key, value ) {
		return DICT_METHODS.add( self, key, value );
	},
	add_weak( self, key, value ) {
		if ( !isDictMethodReceiver( self ) || key instanceof Pair ) {
			return self;
		}
		self[normalizeDictKey( key )] = makeWeakValue( value );
		return self;
	},
	set_weak( self, key, value ) {
		return DICT_METHODS.add_weak( self, key, value );
	},
	kv( self ) {
		if ( !isDictMethodReceiver( self ) ) {
			return [];
		}
		const out = [];
		for ( const key of DICT_METHODS.keys( self ) ) {
			out.push( key, resolveWeakValue( self[key] ) );
		}
		return out;
	},
	sorted_keys( self ) {
		return DICT_METHODS.keys( self );
	},
	remove( self, key ) {
		if ( !isDictMethodReceiver( self ) ) {
			return self;
		}
		if ( typeof key === 'function' ) {
			for ( const [ k, v ] of Object.entries( self ) ) {
				if ( key( new Pair( { pair: [ k, v ] } ) ) ) {
					releaseValue( self[k] );
					delete self[k];
				}
			}
			return self;
		}
		if ( key instanceof Pair ) {
			return self;
		}
		const normalized = normalizeDictKey( key );
		releaseValue( self[normalized] );
		delete self[normalized];
		return self;
	},
	count( self ) {
		return DICT_METHODS.length( self );
	},
	empty( self ) {
		return DICT_METHODS.length( self ) === 0 ? 1 : 0;
	},
	is_empty( self ) {
		return DICT_METHODS.empty( self );
	},
	to_Array( self ) {
		return DICT_METHODS.enumerate( self );
	},
	to_Iterator( self ) {
		return DICT_METHODS.keys( self )[Symbol.iterator]();
	},
	for_each_key( self, fn ) {
		for ( const key of DICT_METHODS.keys( self ) ) {
			fn( key );
		}
		return self;
	},
	for_each_value( self, fn ) {
		for ( const value of DICT_METHODS.values( self ) ) {
			fn( value );
		}
		return self;
	},
	for_each_pair( self, fn ) {
		for ( const pair of DICT_METHODS.enumerate( self ) ) {
			fn( pair );
		}
		return self;
	},
	clear( self ) {
		if ( isDictMethodReceiver( self ) ) {
			for ( const key of Object.keys( self ) ) {
				delete self[key];
			}
		}
		return self;
	},
} );

const DICT_ZERO_ARG_METHODS = new Set( [
	'clear',
	'copy',
	'count',
	'empty',
	'enumerate',
	'is_empty',
	'keys',
	'kv',
	'length',
	'sorted_keys',
	'to_Array',
	'to_Iterator',
	'values',
] );

function getDictMethod( object, property ) {
	if ( typeof property === 'symbol' ) {
		return null;
	}
	const name = String( property );
	if (
		!isDictMethodReceiver( object )
		|| Object.prototype.hasOwnProperty.call( object, name )
		|| !Object.prototype.hasOwnProperty.call( DICT_METHODS, name )
	) {
		return null;
	}
	return function zuzuDictMethod( ...args ) {
		return DICT_METHODS[name]( object, ...args );
	};
}

class ZuzuMethod {
	constructor( name, fn ) {
		this.name = String( name || '' );
		this.fn = fn;
	}

	invoke( self, args = [] ) {
		return this.fn.apply( self, args );
	}

	to_String() {
		return this.name;
	}
}

function zuzuBoundMethod( receiver, name, fn ) {
	const methodName = String( name || '' );
	const bound = function __zuzu_bound_method( ...args ) {
		return fn.apply( receiver, args );
	};
	Object.defineProperty( bound, '__zuzu_method', {
		value: true,
		enumerable: false,
		configurable: true,
	} );
	Object.defineProperty( bound, '__zuzu_bound_receiver', {
		value: receiver,
		enumerable: false,
		configurable: true,
	} );
	Object.defineProperty( bound, '__zuzu_bound_method_name', {
		value: methodName,
		enumerable: false,
		configurable: true,
	} );
	bound.invoke = function invoke( _self, args = [] ) {
		return fn.apply( receiver, args );
	};
	bound.to_String = function to_String() {
		return methodName;
	};
	return bound;
}

function zuzuTypeof( value ) {
	value = resolveWeakValue( value );
	if ( value == null ) {
		return 'Null';
	}
	if ( value && value.__zuzu_method ) {
		return 'Method';
	}
	if ( value instanceof ZuzuMethod ) {
		return 'Method';
	}
	if (
		value
		&& ( typeof value === 'object' || typeof value === 'function' )
		&& typeof value.__zuzu_type_name === 'string'
	) {
		return value.__zuzu_type_name;
	}
	if ( isBagLike( value ) ) {
		return 'Bag';
	}
	if ( isSetLike( value ) ) {
		return 'Set';
	}
	if ( Array.isArray( value ) ) {
		return 'Array';
	}
	if ( value instanceof Pair ) {
		return 'Pair';
	}
	if ( value instanceof RegExp ) {
		return 'Regexp';
	}
	if ( Object.prototype.toString.call( value ) === '[object RegExp]' ) {
		return 'Regexp';
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
	if ( value instanceof ZuzuBinary ) {
		return 'BinaryString';
	}
	if ( typeof value === 'function' ) {
		const source = Function.prototype.toString.call( value );
		if ( /^\s*class\b/.test( source ) ) {
			return 'Class';
		}
		return 'Function';
	}
	if ( value && value.constructor ) {
		const ctorName = value.constructor.name || 'Object';
		if ( ctorName === 'Object' ) {
			return 'Dict';
		}
		if ( ctorName === 'Error' ) {
			return 'Exception';
		}
		return ctorName;
	}
	return 'Object';
}

function zuzuInstanceof( value, klass ) {
	value = resolveWeakValue( value );
	klass = resolveWeakValue( klass );
	if ( klass == null ) {
		return value == null ? 1 : 0;
	}
	const klassName = ( typeof klass === 'function' && klass.name ) ? klass.name : '';
	if ( klassName === 'Any' ) {
		return 1;
	}
	if ( klassName === 'Null' ) {
		return value == null ? 1 : 0;
	}
	if ( klassName === 'Boolean' || klass === Boolean ) {
		return ( typeof value === 'boolean' || Object.prototype.toString.call( value ) === '[object Boolean]' ) ? 1 : 0;
	}
	if ( klassName === 'Number' || klass === Number ) {
		return ( typeof value === 'number' || Object.prototype.toString.call( value ) === '[object Number]' ) ? 1 : 0;
	}
	if ( klassName === 'String' || klass === String ) {
		return ( typeof value === 'string' || Object.prototype.toString.call( value ) === '[object String]' ) ? 1 : 0;
	}
	if ( klassName === 'Array' || klass === Array ) {
		return Array.isArray( value ) ? 1 : 0;
	}
	if ( klassName === 'BinaryString' ) {
		return value instanceof ZuzuBinary ? 1 : 0;
	}
	if ( klassName === 'Function' || klass === Function ) {
		return typeof value === 'function' ? 1 : 0;
	}
	if ( klassName === 'Exception' ) {
		if ( value == null ) {
			return 0;
		}
		if ( value instanceof Error ) {
			return 1;
		}
		const valueName = String(
			value.name
			|| value.constructor && value.constructor.name
			|| ''
		);
		return [
			'Exception',
			'TypeException',
			'ExhaustedException',
			'CancelledException',
			'TimeoutException',
			'ChannelClosedException',
		].includes( valueName ) ? 1 : 0;
	}
	if ( klassName === 'TypeException' ) {
		if ( value == null ) {
			return 0;
		}
		const valueName = String(
			value.name
			|| value.constructor && value.constructor.name
			|| ''
		);
		return valueName === 'TypeException' ? 1 : 0;
	}
	if ( klassName === 'ExhaustedException' ) {
		if ( value == null ) {
			return 0;
		}
		const valueName = String(
			value.name
			|| value.constructor && value.constructor.name
			|| ''
		);
		return valueName === 'ExhaustedException' ? 1 : 0;
	}
	if ( [
		'CancelledException',
		'TimeoutException',
		'ChannelClosedException',
	].includes( klassName ) ) {
		if ( value == null ) {
			return 0;
		}
		const valueName = String(
			value.name
			|| value.constructor && value.constructor.name
			|| ''
		);
		return valueName === klassName ? 1 : 0;
	}
	if ( klassName === 'Collection' ) {
		return (
			Array.isArray( value )
			|| isSetLike( value )
			|| isBagLike( value )
			|| zuzuTypeof( value ) === 'Dict'
		) ? 1 : 0;
	}
	if ( klassName === 'Dict' ) {
		return zuzuTypeof( value ) === 'Dict' ? 1 : 0;
	}
	if ( klassName === 'Set' ) {
		return isSetLike( value ) ? 1 : 0;
	}
	if ( klassName === 'Bag' ) {
		return isBagLike( value ) ? 1 : 0;
	}
	if ( klassName === 'Class' ) {
		return typeof value === 'function' ? 1 : 0;
	}
	if ( klassName === 'Object' || klass === Object ) {
		return ( value !== null && typeof value === 'object' ) ? 1 : 0;
	}
	try {
		return value instanceof klass ? 1 : 0;
	}
	catch ( _err ) {
		return 0;
	}
}

function isNativeErrorConstructorName( name ) {
	return [
		'Error',
		'EvalError',
		'RangeError',
		'ReferenceError',
		'SyntaxError',
		'TypeError',
		'URIError',
	].includes( String( name || '' ) );
}

function zuzuTrait( name, methods, source = null, captures = {} ) {
	const trait = {
		__zuzu_trait_name: String( name || '' ),
		__zuzu_trait_methods: methods || {},
	};
	if ( source != null ) {
		Object.defineProperty( trait, '__zuzu_marshal_meta', {
			value: {
				kind: 'trait',
				name: String( name || '' ),
				source: String( source ),
				captures: captures || {},
			},
			enumerable: false,
			configurable: true,
			writable: true,
		} );
	}
	return trait;
}

function zuzuApplyTraits( klass, traits ) {
	if ( !klass || !klass.prototype || !Array.isArray( traits ) ) {
		return klass;
	}
	if ( !Object.prototype.hasOwnProperty.call( klass, '__zuzu_traits' ) ) {
		const desc = Object.create( null );
		desc.value = new Set();
		desc.enumerable = false;
		desc.configurable = true;
		desc.writable = true;
		Object.defineProperty( klass, '__zuzu_traits', desc );
	}
	for ( const trait of traits ) {
		if ( !trait || !trait.__zuzu_trait_methods ) {
			continue;
		}
		klass.__zuzu_traits.add( trait.__zuzu_trait_name || '' );
		for ( const [ name, fn ] of Object.entries( trait.__zuzu_trait_methods ) ) {
			if ( typeof fn !== 'function' ) {
				continue;
			}
			if ( Object.prototype.hasOwnProperty.call( klass.prototype, name )
				&& typeof klass.prototype[name] === 'function' ) {
				klass.prototype[`__zuzu_trait_super__${name}`] = fn;
			}
			else {
				klass.prototype[name] = fn;
			}
		}
	}
	return klass;
}

function zuzuDoes( value, trait ) {
	value = resolveWeakValue( value );
	if ( value == null || !trait ) {
		return 0;
	}
	const name = trait.__zuzu_trait_name || trait.name || String( trait );
	let ctor = value.constructor;
	while ( ctor ) {
		if ( ctor.__zuzu_traits instanceof Set && ctor.__zuzu_traits.has( name ) ) {
			return 1;
		}
		ctor = Object.getPrototypeOf( ctor );
	}
	return 0;
}

function zuzuStoreField( object, field, value ) {
	const stored = field.isWeakStorage
		? makeWeakValue( value )
		: retainValue( value );
	releaseValue( object[field.name] );
	object[field.name] = stored;
	return stored;
}

function defineZuzuClass( name, base, spec = {} ) {
	const parent = typeof base === 'function' ? base : Object;
	const fields = Array.isArray( spec.fields ) ? spec.fields : [];
	const traits = Array.isArray( spec.traits ) ? spec.traits : [];
	const methods = spec.methods && typeof spec.methods === 'object' ? spec.methods : {};
	const statics = spec.statics && typeof spec.statics === 'object' ? spec.statics : {};
	const nested = spec.nested && typeof spec.nested === 'object' ? spec.nested : {};
	const ctor = {
		[name]: class extends parent {
			constructor( ...args ) {
				const skipBuild = args[0] === ZUZU_SKIP_BUILD;
				const ctorArgs = skipBuild ? args.slice( 1 ) : args;
				const superArgs = parent.__zuzu_class_name
					? ( skipBuild ? args : [ ZUZU_SKIP_BUILD, ...ctorArgs ] )
					: ctorArgs;
				super( ...superArgs );
				if ( this instanceof Error ) {
					this.name = name;
				}
				for ( const field of fields ) {
					let value = null;
					if ( field.defaultValue && typeof field.defaultValue === 'function' ) {
						value = field.defaultValue.call( this );
					}
					zuzuStoreField( this, field, value );
				}
				let named = null;
				if ( ctorArgs.length === 1 && ctorArgs[0] instanceof PairList ) {
					named = ctorArgs[0];
				}
				else if (
					ctorArgs.length === 1
					&& ctorArgs[0]
					&& typeof ctorArgs[0] === 'object'
					&& !Array.isArray( ctorArgs[0] )
				) {
					named = ctorArgs[0];
				}
				if ( named ) {
					for ( const field of fields ) {
						const incoming = named instanceof PairList
							? named.get( field.name, resolveWeakValue( this[field.name] ) )
							: Object.prototype.hasOwnProperty.call( named, field.name )
								? named[field.name]
								: resolveWeakValue( this[field.name] );
						if ( field.typeName && incoming != null && !zuzuTypeMatches( incoming, field.typeName ) ) {
							throw new Error( `TypeException: field '${field.name}' must be ${field.typeName}, got ${zuzuTypeof( incoming )}` );
						}
						zuzuStoreField( this, field, incoming );
					}
				}
				for ( const [ nestedName, nestedClass ] of Object.entries( nested ) ) {
					this[nestedName] = nestedClass;
				}
				if ( !skipBuild && typeof this.__build__ === 'function' ) {
					this.__build__();
				}
			}
		},
	}[name];
	for ( const field of fields ) {
		if ( Array.isArray( field.accessors ) ) {
			if ( field.accessors.includes( 'get' ) && typeof ctor.prototype[`get_${field.name}`] !== 'function' ) {
				ctor.prototype[`get_${field.name}`] = function _get_field() {
					return resolveWeakValue( this[field.name] );
				};
			}
			if ( field.accessors.includes( 'set' ) && typeof ctor.prototype[`set_${field.name}`] !== 'function' ) {
				ctor.prototype[`set_${field.name}`] = function _set_field( value ) {
					if ( field.typeName && value != null && !zuzuTypeMatches( value, field.typeName ) ) {
						throw new Error( `TypeException: field '${field.name}' must be ${field.typeName}, got ${zuzuTypeof( value )}` );
					}
					zuzuStoreField( this, field, value );
					return this;
				};
			}
			if ( field.accessors.includes( 'clear' ) && typeof ctor.prototype[`clear_${field.name}`] !== 'function' ) {
				ctor.prototype[`clear_${field.name}`] = function _clear_field() {
					zuzuStoreField( this, field, null );
					return this;
				};
			}
			if ( field.accessors.includes( 'has' ) && typeof ctor.prototype[`has_${field.name}`] !== 'function' ) {
				ctor.prototype[`has_${field.name}`] = function _has_field() {
					return resolveWeakValue( this[field.name] ) != null ? 1 : 0;
				};
			}
		}
	}
	for ( const [ methodName, fn ] of Object.entries( methods ) ) {
		ctor.prototype[methodName] = fn;
	}
	for ( const [ methodName, fn ] of Object.entries( statics ) ) {
		ctor[methodName] = fn;
	}
	for ( const [ nestedName, nestedClass ] of Object.entries( nested ) ) {
		ctor[nestedName] = nestedClass;
	}
	zuzuApplyTraits( ctor, traits );
	Object.defineProperty( ctor, '__zuzu_class_name', {
		value: name,
		enumerable: false,
		configurable: true,
		writable: true,
	} );
	Object.defineProperty( ctor, '__zuzu_class_spec', {
		value: {
			fields: fields.map( (field) => ( { ...field } ) ),
			traits: traits.slice(),
			methods: { ...methods },
			statics: { ...statics },
			nested: { ...nested },
		},
		enumerable: false,
		configurable: true,
		writable: true,
	} );
	if ( typeof spec.marshalSource === 'string' ) {
		Object.defineProperty( ctor, '__zuzu_marshal_meta', {
			value: {
				kind: 'class',
				name,
				source: spec.marshalSource,
				captures: spec.marshalCaptures || {},
			},
			enumerable: false,
			configurable: true,
			writable: true,
		} );
	}
	return ctor;
}

function zuzuGetMember( object, property ) {
	object = resolveWeakValue( object );
	if ( object == null ) {
		return null;
	}
	const value = resolveWeakValue( object[property] );
	if (
		typeof value === 'function'
		&& value.length === 0
		&& !value.__zuzu_marshal_meta
	) {
		return value.call( object );
	}
	const dictMethod = getDictMethod( object, property );
	if ( dictMethod && DICT_ZERO_ARG_METHODS.has( String( property ) ) ) {
		return dictMethod();
	}
	if ( dictMethod ) {
		return dictMethod;
	}
	return resolveWeakValue( value );
}

function zuzuResolveBraceKey( _object, literalProperty, _getDynamicProperty ) {
	const literal = String( literalProperty || '' );
	return literal;
}

function zuzuGetBraceMember( object, literalProperty, getDynamicProperty ) {
	object = resolveWeakValue( object );
	if ( object == null ) {
		return null;
	}
	return zuzuGetIndex( object, zuzuResolveBraceKey( object, literalProperty, getDynamicProperty ) );
}

function zuzuCallMember( object, property, ...args ) {
	object = resolveWeakValue( object );
	if ( object == null ) {
		if ( args.length === 0 ) {
			return null;
		}
		throw new TypeError( `Cannot call member ${String( property )} of null` );
	}
	if ( property instanceof ZuzuMethod || ( property && property.__zuzu_method ) ) {
		return property.invoke( object, args );
	}
	const value = resolveWeakValue( object[property] );
	if ( typeof value === 'function' ) {
		return value.apply( object, args );
	}
	let proto = Object.getPrototypeOf( object );
	while ( proto ) {
		const descriptor = Object.getOwnPropertyDescriptor( proto, property );
		if ( descriptor && typeof descriptor.value === 'function' ) {
			return descriptor.value.apply( object, args );
		}
		proto = Object.getPrototypeOf( proto );
	}
	const dictMethod = getDictMethod( object, property );
	if ( dictMethod ) {
		return dictMethod( ...args );
	}
	if ( args.length === 0 ) {
		return value;
	}
	throw new TypeError( `${String( property )} is not a function` );
}

function zuzuMaybeDemolish( value ) {
	const original = value;
	value = resolveWeakValue( value );
	let result = null;
	if ( value && typeof value.__demolish__ === 'function' ) {
		result = value.__demolish__();
	}
	releaseValue( original );
	return result;
}

function zuzuCan( value, methodName ) {
	value = resolveWeakValue( value );
	if ( value == null ) {
		return 0;
	}
	const key = String( methodName || '' );
	if ( getDictMethod( value, key ) ) {
		return 1;
	}
	return ( typeof value[key] === 'function' ) ? 1 : 0;
}

function zuzuSuperCall( self, klass, methodName, args = [] ) {
	const method = String( methodName || '' );
	const argv = Array.isArray( args ) ? args : [];
	if ( klass && self && typeof self[`__zuzu_trait_super__${method}`] === 'function' ) {
		return self[`__zuzu_trait_super__${method}`].apply( self, argv );
	}
	if ( !klass && self && self.constructor ) {
		klass = self.constructor;
	}
	if ( klass && klass.prototype ) {
		const parentProto = Object.getPrototypeOf( klass.prototype );
		if ( parentProto && typeof parentProto[method] === 'function' ) {
			return parentProto[method].apply( self, argv );
		}
	}
	return null;
}

function zuzuSuperStaticCall( klass, methodName, args = [] ) {
	const method = String( methodName || '' );
	const argv = Array.isArray( args ) ? args : [];
	if ( !klass ) {
		return null;
	}
	const parentClass = Object.getPrototypeOf( klass );
	if ( parentClass && typeof parentClass[method] === 'function' ) {
		return parentClass[method].apply( klass, argv );
	}
	return null;
}

function zuzuSuperDispatch( isStatic, self, klass, methodName, args = [] ) {
	return isStatic
		? zuzuSuperStaticCall( klass, methodName, args )
		: zuzuSuperCall( self, klass, methodName, args );
}

function refIndex( target, index ) {
	target = resolveWeakValue( target );
	return function refValue( maybeValue ) {
		if ( arguments.length === 0 ) {
			if ( target instanceof ZuzuBinary ) {
				return target.at( index );
			}
			return resolveWeakValue( target[index] );
		}
		if ( target instanceof ZuzuBinary ) {
			throw new Error( 'Exception: BinaryString index assignment is not supported' );
		}
		target[index] = maybeValue;
		return maybeValue;
	};
}

function zuzuGetIndex( target, index ) {
	target = resolveWeakValue( target );
	if ( target == null ) {
		return null;
	}
	const key = String( index );
	if ( typeof target === 'function' && target.prototype ) {
		if ( typeof target.prototype[key] === 'function' ) {
			return new ZuzuMethod( key, target.prototype[key] );
		}
	}
	if ( target instanceof ZuzuBinary ) {
		return target.at( index );
	}
	if ( target instanceof PairList ) {
		return resolveWeakValue( target.get( index, null ) );
	}
	if ( typeof target === 'string' || Array.isArray( target ) ) {
		let resolved = Number( index );
		if ( Number.isFinite( resolved ) ) {
			if ( resolved < 0 ) {
				resolved = target.length + resolved;
			}
			return resolveWeakValue( target[resolved] );
		}
	}
	if (
		target
		&& typeof target === 'object'
		&& target.constructor
		&& typeof target.constructor.__zuzu_class_name === 'string'
		&& !Object.prototype.hasOwnProperty.call( target, key )
		&& typeof target[key] === 'function'
	) {
		return zuzuBoundMethod( target, key, target[key] );
	}
	return resolveWeakValue( target[index] );
}

function zuzuAssignSlice( target, from, length, value ) {
	const start = Number( from );
	const hasLength = length != null;
	const span = hasLength ? Number( length ) : null;
	const replacement = value == null ? '' : value;
	if ( typeof target === 'string' ) {
		const end = hasLength
			? ( span >= 0 ? start + span : span )
			: target.length;
		return target.slice( 0, start ) + String( replacement ) + target.slice( end );
	}
	if ( Array.isArray( target ) ) {
		const items = Array.isArray( replacement ) ? replacement : [ replacement ];
		if ( hasLength ) {
			target.splice( start, span, ...items );
		}
		else {
			target.splice( start, target.length - start, ...items );
		}
		return target;
	}
	if ( target instanceof ZuzuBinary ) {
		throw new Error( 'Exception: BinaryString slice assignment is not supported' );
	}
	throw new Error( `TypeException: slice assignment expects String or Array, got ${zuzuTypeof( target )}` );
}

function refKey( target, key ) {
	target = resolveWeakValue( target );
	return function refValue( maybeValue ) {
		if ( arguments.length === 0 ) {
			return resolveWeakValue( target[key] );
		}
		target[key] = maybeValue;
		return maybeValue;
	};
}

function assignIndexedValue( target, index, value, isWeakWrite = false ) {
	target = resolveWeakValue( target );
	if ( target == null ) {
		throw new Error( 'TypeException: cannot assign to null' );
	}
	if ( target instanceof ZuzuBinary ) {
		throw new Error( 'Exception: BinaryString index assignment is not supported' );
	}
	const stored = isWeakWrite ? makeWeakValue( value ) : retainValue( value );
	if ( target instanceof PairList ) {
		target.set( index, stored );
		return stored;
	}
	releaseValue( target[index] );
	target[index] = stored;
	return stored;
}

function refSlice( target, from, length ) {
	target = resolveWeakValue( target );
	return function refSliceValue( maybeValue ) {
		const start = Number( from );
		const hasLength = length != null;
		const span = hasLength ? Number( length ) : null;
		if ( arguments.length === 0 ) {
			const end = hasLength
				? ( span >= 0 ? start + span : span )
				: undefined;
			if ( target instanceof ZuzuBinary ) {
				return target.slice( start, end );
			}
			return target.slice( start, end );
		}
		if ( target instanceof ZuzuBinary ) {
			throw new Error( 'Exception: BinaryString slice assignment is not supported' );
		}
		if ( !hasLength ) {
			target.splice( start, target.length - start, ...maybeValue );
			return maybeValue;
		}
		target.splice( start, span, ...maybeValue );
		return maybeValue;
	};
}

function makePathOperator( runtime, filename ) {
	return function zuzuPathOp( haystack, pathSpec, mode = 'first' ) {
		const pathObj = resolvePathObject( runtime, filename, pathSpec );
		if ( mode === 'all' ) {
			return pathObj.query( haystack );
		}
		if ( mode === 'exists' ) {
			return pathObj.exists( haystack );
		}
		return pathObj.first( haystack, null );
	};
}

function resolveActivePathClass( runtime, filename ) {
	const internals = runtime.loadModule( 'std/internals', filename );
	if ( !internals || typeof internals.getupperprop !== 'function' ) {
		return null;
	}
	return internals.getupperprop( 0, 'paths' );
}

function resolvePathObject( runtime, filename, pathSpec ) {
	let PathClass = resolveActivePathClass( runtime, filename );
	const pathText = String( pathSpec ?? '' );
	if ( !PathClass ) {
		const zzpath = runtime.loadModule( 'std/path/zz', filename );
		PathClass = zzpath && zzpath.ZZPath ? zzpath.ZZPath : null;
	}
	if ( !PathClass ) {
		throw new Error( 'Exception: no path implementation available' );
	}
	return (
		pathSpec
		&& typeof pathSpec === 'object'
		&& typeof pathSpec.query === 'function'
	)
		? pathSpec
		: new PathClass( { path: pathText } );
}

function makePathAssignmentOperator( runtime, filename ) {
	return function zuzuPathAssign(
		haystack,
		pathSpec,
		value,
		mode = 'first',
		op = ':=',
		isWeakWrite = false
	) {
		const pathObj = resolvePathObject( runtime, filename, pathSpec );
		const storedValue = isWeakWrite ? makeWeakValue( value ) : value;
		if ( mode === 'all' ) {
			return pathObj.assign_all( haystack, storedValue, op );
		}
		if ( mode === 'maybe' ) {
			return pathObj.assign_maybe( haystack, storedValue, op );
		}
		return pathObj.assign_first( haystack, storedValue, op );
	};
}

function makePathReferenceOperator( runtime, filename ) {
	return function zuzuPathRef( haystack, pathSpec, mode = 'first' ) {
		const pathObj = resolvePathObject( runtime, filename, pathSpec );
		if ( mode === 'all' ) {
			return pathObj.ref_all( haystack );
		}
		if ( mode === 'maybe' ) {
			return pathObj.ref_maybe( haystack );
		}
		return pathObj.ref_first( haystack );
	};
}

function callPathRef( refFn ) {
	if ( typeof refFn !== 'function' ) {
		throw new Error( 'Exception: path reference target is not assignable' );
	}
	return refFn();
}

function setPathRef( refFn, value ) {
	if ( typeof refFn !== 'function' ) {
		throw new Error( 'Exception: path reference target is not assignable' );
	}
	return refFn( value );
}

function makePathUpdateOperator( runtime, filename ) {
	return function zuzuPathUpdate( haystack, pathSpec, mode, operator, prefix ) {
		const pathObj = resolvePathObject( runtime, filename, pathSpec );
		if ( mode === 'all' ) {
			const refs = pathObj.ref_all( haystack );
			const oldValues = [];
			const newValues = [];
			for ( const refFn of refs ) {
				const oldValue = zuzuToNumber( callPathRef( refFn ) );
				const newValue = operator === '++' ? oldValue + 1 : oldValue - 1;
				setPathRef( refFn, newValue );
				oldValues.push( oldValue );
				newValues.push( newValue );
			}
			return prefix ? newValues : oldValues;
		}
		if ( mode === 'maybe' ) {
			const refFn = pathObj.ref_maybe( haystack );
			if ( refFn == null ) {
				return false;
			}
			const oldValue = zuzuToNumber( callPathRef( refFn ) );
			const newValue = operator === '++' ? oldValue + 1 : oldValue - 1;
			setPathRef( refFn, newValue );
			return true;
		}
		const refFn = pathObj.ref_first( haystack );
		const oldValue = zuzuToNumber( callPathRef( refFn ) );
		const newValue = operator === '++' ? oldValue + 1 : oldValue - 1;
		setPathRef( refFn, newValue );
		return prefix ? newValue : oldValue;
	};
}

function zuzuTypeMatches( value, typeName ) {
	value = resolveWeakValue( value );
	if ( typeName === 'Any' ) {
		return 1;
	}
	if ( value == null ) {
		return 0;
	}
	if (
		typeName === 'Number'
		|| typeName === 'String'
		|| typeName === 'Array'
		|| typeName === 'Dict'
		|| typeName === 'Set'
		|| typeName === 'Bag'
		|| typeName === 'Collection'
		|| typeName === 'Class'
		|| typeName === 'Function'
		|| typeName === 'Object'
		|| typeName === 'Exception'
		|| typeName === 'Regexp'
	) {
		if ( typeName === 'Collection' ) {
			return (
				Array.isArray( value )
				|| isSetLike( value )
				|| isBagLike( value )
				|| zuzuTypeof( value ) === 'Dict'
			) ? 1 : 0;
		}
		if ( typeName === 'Object' ) {
			return ( value !== null && typeof value === 'object' ) ? 1 : 0;
		}
		return zuzuTypeof( value ) === typeName ? 1 : 0;
	}
	if ( typeName === 'BinaryString' ) {
		return value instanceof ZuzuBinary ? 1 : 0;
	}
	if ( typeName === 'Boolean' ) {
		if ( typeof value === 'boolean' || Object.prototype.toString.call( value ) === '[object Boolean]' ) {
			return 1;
		}
		if ( typeof value === 'number' ) {
			return ( value === 0 || value === 1 ) ? 1 : 0;
		}
	}
		if ( typeName === 'Regexp' ) {
			return Object.prototype.toString.call( value ) === '[object RegExp]' ? 1 : 0;
		}
		if ( zuzuTypeof( value ) === typeName ) {
			return 1;
		}
		if (
			Array.isArray( value.__zuzu_type_names )
			&& value.__zuzu_type_names.includes( typeName )
		) {
			return 1;
		}
		let proto = Object.getPrototypeOf( value );
		while ( proto ) {
			const ctor = proto.constructor;
			if ( ctor && ctor.name === typeName ) {
				return 1;
			}
			proto = Object.getPrototypeOf( proto );
		}
		const globalType = globalThis[typeName];
		if ( globalType == null ) {
			return 0;
		}
		return zuzuInstanceof( value, globalType ) ? 1 : 0;
	}

class ZuzuScript {
	constructor( options = {} ) {
		if ( options.host ) {
			this.host = options.host;
		}
		else {
			const { createNodeHost } = require( './host/' + 'node-host' );
			this.host = createNodeHost( options );
		}
		this.repoRoot = this.host.repoRoot;
		this.includePaths = this.host.includePaths;
		this.moduleSearchRoots = defaultModuleSearchRoots(
			this.host,
			this.repoRoot,
			this.includePaths
		);
		const allowCapabilities = new Set( Array.isArray( options.allowCapabilities )
			? options.allowCapabilities.map( (item) => String( item ) )
			: [] );
		this.denyCapabilities = new Set( Array.isArray( options.denyCapabilities )
			? options.denyCapabilities.map( (item) => String( item ) )
			: [] );
		for ( const capability of [ 'gui' ] ) {
			if (
				!allowCapabilities.has( capability )
				&& !this.host.capabilities.has( capability )
			) {
				this.denyCapabilities.add( capability );
			}
		}
		this.denyModules = new Set( Array.isArray( options.denyModules )
			? options.denyModules.map( (item) => String( item ) )
			: [] );
		this.debugLevel = Number.isFinite( Number( options.debugLevel ) )
			? Number( options.debugLevel )
			: 0;
		this.moduleCache = new Map();
		this.moduleLoading = new Set();
		this.evalCapabilityOverrides = null;
		this.outputLines = null;
		this.stdoutHandler = null;
		this.stderrHandler = null;
		this.executionTimeoutMs = Number.isFinite( Number( options.executionTimeoutMs ) )
			? Number( options.executionTimeoutMs )
			: null;
		this.transpiler = normalizeTranspilerName(
			options.transpiler || DEFAULT_TRANSPILER
		);
		if ( typeof this.host.loadJsModule !== 'function' ) {
			this.host.loadJsModule = ( filename ) => require( filename );
		}
	}

	transpile( source, options = {} ) {
		return transpile( source, {
			...options,
			transpiler: options.transpiler || this.transpiler,
		} );
	}

	getModuleSearchRoots() {
		return this.moduleSearchRoots.slice();
	}

	isDeniedByCapability( moduleName ) {
		const required = capabilitiesForModule( moduleName );
		for ( const capability of required ) {
			if ( this.isCapabilityDenied( capability ) ) {
				return capability;
			}
			if ( !this.host.capabilities.has( capability ) ) {
				return capability;
			}
		}
		return null;
	}

	isCapabilityDenied( capability ) {
		if ( this.denyCapabilities.has( capability ) ) {
			return true;
		}
		if ( this.evalCapabilityOverrides ) {
			const flagName = `deny_${capability}`;
			if ( this.evalCapabilityOverrides[flagName] ) {
				return true;
			}
		}
		return false;
	}

	enforceModulePolicy( moduleName ) {
		if ( this.denyModules.has( moduleName ) ) {
			throw new Error( `Denied module: ${moduleName}` );
		}
		const capability = this.isDeniedByCapability( moduleName );
		if ( capability ) {
			if ( this.denyCapabilities.has( capability ) ) {
				throw new Error( `Denied capability '${capability}' blocks module '${moduleName}'` );
			}
			throw new Error( `Module '${moduleName}' requires unsupported capability '${capability}' on host '${this.host.name}'` );
		}
	}

	fileValueForFilename( filename ) {
		if (
			this.isCapabilityDenied( 'fs' )
			|| !this.host.capabilities.has( 'fs' )
			|| !filename
			|| String( filename ).startsWith( '<' )
			|| String( filename ).startsWith( '(' )
		) {
			return null;
		}
		const { Path } = require( '../modules/std/io.js' );
		return new Path( filename );
	}

	resolveModulePath( moduleName, fromFile ) {
		const fromDir = fromFile ? this.host.dirname( fromFile ) : this.repoRoot;
		if ( !moduleName.startsWith( '.' ) && !moduleName.startsWith( '/' ) ) {
			const runtimeSupported = this.host.resolve(
				this.repoRoot,
				'modules',
				`${moduleName}.js`
			);
			if ( this.host.fileExists( runtimeSupported ) ) {
				return runtimeSupported;
			}
		}
		const candidates = [];
		if ( moduleName.startsWith( '.' ) || moduleName.startsWith( '/' ) ) {
			candidates.push( this.host.resolve( fromDir, moduleName ) );
		}
		else {
			for ( const base of this.getModuleSearchRoots() ) {
				candidates.push( this.host.resolve( base, moduleName ) );
			}
		}
		const withExt = [];
		for ( const candidate of candidates ) {
			withExt.push( candidate, `${candidate}.zzs`, `${candidate}.zzm`, `${candidate}.js` );
		}
		for ( const candidate of withExt ) {
			if ( this.host.fileExists( candidate ) ) {
				return candidate;
			}
		}
		throw new Error( `Unable to resolve module: ${moduleName}` );
	}

	buildContext( options = {} ) {
		const filename = options.filename;
		const runtime = this;
		taskRuntime.setDebugLevel( this.debugLevel );
		let context;
		const capabilityFlags = Object.create( null );
		for ( const name of this.host.capabilities ) {
			if ( !this.denyCapabilities.has( name ) ) {
				capabilityFlags[name] = 1;
			}
		}
		if ( this.evalCapabilityOverrides ) {
			for ( const [ flagName, denied ] of Object.entries( this.evalCapabilityOverrides ) ) {
				const capability = flagName.replace( /^deny_/, '' );
				if ( denied ) {
					delete capabilityFlags[capability];
				}
				else if (
					this.host.capabilities.has( capability )
					&& !this.denyCapabilities.has( capability )
				) {
					capabilityFlags[capability] = 1;
				}
			}
		}
		const moduleSearchRoots = this.getModuleSearchRoots();
		const emit = ( value ) => {
			const line = String( value );
			if ( this.outputLines ) {
				this.outputLines.push( line );
			}
			if ( typeof this.stdoutHandler === 'function' ) {
				this.stdoutHandler( `${line}\n` );
			}
			else if ( !this.outputLines ) {
				this.host.consoleLog( line );
			}
		};
		const emitStderr = ( value ) => {
			const line = String( value );
			if ( typeof this.stderrHandler === 'function' ) {
				this.stderrHandler( `${line}\n` );
			}
			else if ( typeof console !== 'undefined' && typeof console.warn === 'function' ) {
				console.warn( line );
			}
		};
		installHostCollectionMethods();
		const ZuzuException = class Exception extends Error {
			constructor( value = '' ) {
				if ( value instanceof PairList ) {
					super( value.get( 'message', '' ) );
					this.name = 'Exception';
					this.file = value.get( 'file', null );
					this.line = value.get( 'line', null );
					this.code = value.get( 'code', null );
					return;
				}
				if (
					value
					&& typeof value === 'object'
					&& !Array.isArray( value )
					&& Object.prototype.hasOwnProperty.call( value, 'message' )
				) {
					super( value.message );
					this.name = 'Exception';
					this.file = Object.prototype.hasOwnProperty.call( value, 'file' )
						? value.file
						: null;
					this.line = Object.prototype.hasOwnProperty.call( value, 'line' )
						? value.line
						: null;
					this.code = Object.prototype.hasOwnProperty.call( value, 'code' )
						? value.code
						: null;
					return;
				}
				super( value );
				this.name = 'Exception';
				this.file = null;
				this.line = null;
				this.code = null;
			}

			to_String() {
				const name = this.name || this.constructor.name || 'Exception';
				const message = String( this.message ?? '' );
				if ( message === name || message.startsWith( `${name}:` ) ) {
					return message;
				}
				return message === '' ? name : `${name}: ${message}`;
			}
		};
		const ZuzuTypeException = class TypeException extends ZuzuException {
			constructor( value = '' ) {
				super( value );
				this.name = 'TypeException';
			}
		};
		const snapshotSpreadArg = ( input ) => {
			const value = resolveWeakValue( input );
			if ( Array.isArray( value ) ) {
				return {
					type: 'spread_positional',
					values: value.slice(),
				};
			}
			if ( value instanceof PairList ) {
				return {
					type: 'spread_named',
					entries: value.list.map( (pair) => [ pair[0], pair[1] ] ),
				};
			}
			if ( zuzuTypeof( value ) === 'Dict' ) {
				return {
					type: 'spread_named',
					entries: Object.keys( value ).sort().map( (key) => [ key, value[key] ] ),
				};
			}
			throw new ZuzuTypeException(
				`argument spread expects Array, Dict, or PairList, got ${zuzuTypeof( value )}`
			);
		};
		const spreadCallArgs = ( parts ) => {
			const positional = [];
			const named = [];
			for ( const part of parts ) {
				if ( part.type === 'positional' ) {
					positional.push( part.value );
					continue;
				}
				if ( part.type === 'named' ) {
					named.push( part.value );
					continue;
				}
				if ( part.type === 'spread_positional' ) {
					positional.push( ...part.values );
					continue;
				}
				if ( part.type === 'spread_named' ) {
					for ( const entry of part.entries ) {
						named.push( entry );
					}
					continue;
				}
				throw new ZuzuTypeException( 'invalid call argument descriptor' );
			}
			if ( named.length > 0 ) {
				positional.push( makePairList( named ) );
			}
			return positional;
		};
		const normalizeZuzuException = ( err ) => {
			if ( err instanceof ZuzuException ) {
				return err;
			}
			if ( err && err.__zuzu_nonlocal_return ) {
				return err;
			}
			if (
				err instanceof Error
				&& [
					'CancelledException',
					'TimeoutException',
					'ChannelClosedException',
				].includes( err.name )
			) {
				return err;
			}
			if ( err && typeof err === 'object' ) {
				const ctorName = err.constructor && err.constructor.name;
				if ( !isNativeErrorConstructorName( ctorName ) ) {
					return err;
				}
			}
			const message = err && err.message != null ? String( err.message ) : String( err );
			if ( message.startsWith( 'TypeException:' ) ) {
				return new ZuzuTypeException( {
					message,
					file: err && err.file != null ? err.file : null,
					line: err && err.line != null ? err.line : null,
					code: err && err.code != null ? err.code : null,
				} );
			}
			return new ZuzuException( {
				message: message.startsWith( 'Exception: ' )
					? message.slice( 'Exception: '.length )
					: message,
				file: err && err.file != null ? err.file : null,
				line: err && err.line != null ? err.line : null,
				code: err && err.code != null ? err.code : null,
			} );
		};
		const ZuzuExhaustedException = class ExhaustedException extends Error {
			constructor( message = '' ) {
				super( message );
				this.name = 'ExhaustedException';
			}

			to_String() {
				const message = String( this.message ?? '' );
				if ( message === this.name || message.startsWith( `${this.name}:` ) ) {
					return message;
				}
				return message === '' ? this.name : `${this.name}: ${message}`;
			}
		};
		const defineRuntimeMethod = ( proto, name, fn ) => {
			const desc = Object.create( null );
			desc.value = fn;
			desc.enumerable = false;
			Object.defineProperty( proto, name, desc );
		};
		if ( !Number.prototype.contains ) {
			defineRuntimeMethod( Number.prototype, 'contains', function _containsNumber( value ) {
				return Number( this.valueOf() ) === Number( value ) ? 1 : 0;
			} );
		}
		if ( !Set.prototype.push ) {
			defineRuntimeMethod( Set.prototype, 'length', function _lengthSet() { return this.size; } );
			defineRuntimeMethod( Set.prototype, 'count', function _countSet() { return this.size; } );
			defineRuntimeMethod( Set.prototype, 'empty', function _emptySet() { return this.size === 0 ? 1 : 0; } );
			defineRuntimeMethod( Set.prototype, 'is_empty', function _isEmptySet() { return this.empty(); } );
			defineRuntimeMethod( Set.prototype, 'push', function _pushSet( ...values ) { for ( const v of values ) { this.add( v ); } return this; } );
			defineRuntimeMethod( Set.prototype, 'contains', function _containsSet( value ) { return contains( this, value ); } );
			defineRuntimeMethod( Set.prototype, 'remove', function _removeSet( value ) { this.delete( value ); return this; } );
			defineRuntimeMethod( Set.prototype, 'to_Array', function _setToArray() { return [ ...this ]; } );
			defineRuntimeMethod( Set.prototype, 'to_Bag', function _setToBag() { return new ZuzuBag( [ ...this ] ); } );
			defineRuntimeMethod( Set.prototype, 'copy', function _setCopy() { return new Set( this ); } );
			defineRuntimeMethod( Set.prototype, 'union', function _setUnion( other ) { return collectionUnion( this, other ); } );
			defineRuntimeMethod( Set.prototype, 'intersection', function _setIntersection( other ) { return collectionIntersection( this, other ); } );
			defineRuntimeMethod( Set.prototype, 'difference', function _setDifference( other ) { return collectionDifference( this, other ); } );
			defineRuntimeMethod( Set.prototype, 'symmetric_difference', function _setSymmetricDifference( other ) { return collectionDifference( this.union( other ), this.intersection( other ) ); } );
			defineRuntimeMethod( Set.prototype, 'is_subset', function _setIsSubset( other ) { return collectionSubsetOf( this, other ); } );
			defineRuntimeMethod( Set.prototype, 'is_superset', function _setIsSuperset( other ) { return collectionSupersetOf( this, other ); } );
			defineRuntimeMethod( Set.prototype, 'is_disjoint', function _setIsDisjoint( other ) { return this.intersection( other ).size === 0 ? 1 : 0; } );
			defineRuntimeMethod( Set.prototype, 'equals', function _setEquals( other ) { return collectionEquivalentOf( this, other ); } );
			defineRuntimeMethod( Set.prototype, 'sort', function _setSort( fn ) { return [ ...this ].sort( fn ); } );
			defineRuntimeMethod( Set.prototype, 'sortstr', function _setSortstr() { return [ ...this ].sort( (a, b) => String( a ).localeCompare( String( b ) ) ); } );
			defineRuntimeMethod( Set.prototype, 'sortnum', function _setSortnum() { return [ ...this ].map( (item) => Number( item ) ).sort( (a, b) => a - b ); } );
			defineRuntimeMethod( Set.prototype, 'map', function _setMap( fn ) { return new Set( [ ...this ].map( fn ) ); } );
			defineRuntimeMethod( Set.prototype, 'grep', function _setGrep( fn ) { return new Set( [ ...this ].filter( fn ) ); } );
			defineRuntimeMethod( Set.prototype, 'any', function _setAny( fn ) { return [ ...this ].some( fn ) ? 1 : 0; } );
			defineRuntimeMethod( Set.prototype, 'all', function _setAll( fn ) { return [ ...this ].every( fn ) ? 1 : 0; } );
			defineRuntimeMethod( Set.prototype, 'first', function _setFirst( fn ) { for ( const v of this ) { if ( fn( v ) ) { return v; } } return null; } );
			defineRuntimeMethod( Set.prototype, 'remove_if', function _setRemoveIf( fn ) { for ( const v of [ ...this ] ) { if ( fn( v ) ) { this.delete( v ); } } return this; } );
			defineRuntimeMethod( Set.prototype, 'for_each_value', function _setForEachValue( fn ) { for ( const v of this ) { fn( v ); } return this; } );
		}
		const fallbackDoneTesting = function done_testing( n = null ) {
				if ( typeof globalThis._LEVEL === 'number' && globalThis._LEVEL > 0 ) {
					throw new Error( 'Unexpected done_testing() in subtest' );
				}
				let seen = 0;
				if ( Array.isArray( runtime.outputLines ) ) {
					for ( const line of runtime.outputLines ) {
						if ( /^ok\b/.test( line ) || /^not ok\b/.test( line ) ) {
							seen++;
						}
					}
				}
				if ( n != null && Number( n ) !== Number( seen ) ) {
					throw new Error( `Expected ${n} tests, but ran ${seen}` );
				}
				emit( `1..${seen}` );
				if ( typeof globalThis._FAILED === 'number' && globalThis._FAILED > 0 ) {
					throw new Error( `Failed ${globalThis._FAILED} tests` );
				}
				return true;
			};
		const systemGlobalSeed = {
			language_version: 0,
			runtime: 'zuzu-js',
			runtime_version: 'dev',
			platform: this.host.name,
			inc: Object.freeze( moduleSearchRoots.slice() ),
			deny_fs: capabilityFlags.fs ? false : true,
			deny_net: capabilityFlags.net ? false : true,
			deny_perl: true,
			deny_js: capabilityFlags.js ? false : true,
			deny_proc: capabilityFlags.proc ? false : true,
			deny_db: capabilityFlags.db ? false : true,
			deny_clib: capabilityFlags.clib ? false : true,
			deny_gui: capabilityFlags.gui ? false : true,
			deny_worker: capabilityFlags.worker ? false : true,
		};
		if ( this.host.name === 'node' && typeof process !== 'undefined' && process.versions ) {
			systemGlobalSeed.nodejs_version = String( process.versions.node || '' );
		}
		Object.freeze( systemGlobalSeed );
		const currentSystem = () => {
			const current = {
				...systemGlobalSeed,
				deny_fs: this.isCapabilityDenied( 'fs' ) || !this.host.capabilities.has( 'fs' ),
				deny_net: this.isCapabilityDenied( 'net' ) || !this.host.capabilities.has( 'net' ),
				deny_perl: true,
				deny_js: this.isCapabilityDenied( 'js' ) || !this.host.capabilities.has( 'js' ),
				deny_proc: this.isCapabilityDenied( 'proc' ) || !this.host.capabilities.has( 'proc' ),
				deny_db: this.isCapabilityDenied( 'db' ) || !this.host.capabilities.has( 'db' ),
				deny_clib: this.isCapabilityDenied( 'clib' ) || !this.host.capabilities.has( 'clib' ),
				deny_gui: this.isCapabilityDenied( 'gui' ) || !this.host.capabilities.has( 'gui' ),
				deny_worker: this.isCapabilityDenied( 'worker' ) || !this.host.capabilities.has( 'worker' ),
			};
			return Object.freeze( current );
		};
		context = {
			...( options.globals || {} ),
			__file__: this.fileValueForFilename( filename ),
			__zuzu_system_seed: systemGlobalSeed,
			__zuzu_current_system: currentSystem,
			DEBUG: this.debugLevel,
			__zuzu_host_capabilities: capabilityFlags,
			has_capability( name ) {
				const key = String( name );
				return capabilityFlags[key] ? 1 : 0;
			},
			outputLines: this.outputLines,
			done_testing: ( options.globals && typeof options.globals.done_testing === 'function' )
				? options.globals.done_testing
				: fallbackDoneTesting,
			exports: options.exports,
			module: options.module,
			console: {
				log: ( value ) => this.host.consoleLog( value ),
				warn: ( value ) => emitStderr( value ),
				error: ( value ) => emitStderr( value ),
			},
			Bag: ZuzuBag,
			PairList,
			Exception: ZuzuException,
			TypeException: ZuzuTypeException,
			ExhaustedException: ZuzuExhaustedException,
			__zuzu_normalize_exception: normalizeZuzuException,
			Task: taskRuntime.Task,
			CancelledException: taskRuntime.CancelledException,
			TimeoutException: taskRuntime.TimeoutException,
			ChannelClosedException: taskRuntime.ChannelClosedException,
			Null: null,
			Any: function Any() {},
			Collection: function Collection() {},
			Class: function Class() {},
			BinaryString,
			say( value, ...parts ) {
				if ( Array.isArray( value ) && Object.prototype.hasOwnProperty.call( value, 'raw' ) ) {
					let out = '';
					for ( let i = 0; i < value.length; i++ ) {
						out += value[i];
						if ( i < parts.length ) {
							out += String( parts[i] );
						}
					}
					emit( out );
					return;
				}
				emit( value );
			},
			__zuzu_switch: runSwitch,
			__zuzu_switch_async: runSwitchAsync,
			__zuzu_match: runMatch,
			__zuzu_to_regexp: operatorRegexp,
			__zuzu_regex_replace: regexReplaceValue,
			__zuzu_contains: contains,
			__zuzu_union: collectionUnion,
			__zuzu_intersection: collectionIntersection,
			__zuzu_difference: collectionDifference,
			__zuzu_default: defaultOperator,
			__zuzu_subsetof: collectionSubsetOf,
			__zuzu_supersetof: collectionSupersetOf,
			__zuzu_equivalentof: collectionEquivalentOf,
			__zuzu_set: makeSet,
			__zuzu_bag: makeBag,
			__zuzu_pairlist_literal: makePairList,
			__zuzu_snapshot_spread_arg: snapshotSpreadArg,
			__zuzu_spread_call_args: spreadCallArgs,
			__zuzu_path_op: makePathOperator( runtime, filename ),
			__zuzu_path_assign: makePathAssignmentOperator( runtime, filename ),
			__zuzu_path_ref: makePathReferenceOperator( runtime, filename ),
			__zuzu_path_update: makePathUpdateOperator( runtime, filename ),
			__zuzu_call_member: zuzuCallMember,
			__zuzu_is_weakable_value: isWeakableValue,
			__zuzu_make_weak_value: makeWeakValue,
			__zuzu_resolve_weak_value: resolveWeakValue,
			__zuzu_retain_value: retainValue,
			__zuzu_release_value: releaseValue,
			__zuzu_assign_strong: assignStrongValue,
			__zuzu_assign_weak: assignWeakValue,
			__zuzu_assign_index: assignIndexedValue,
			__zuzu_bodyless_function( name ) {
				let target = null;
				const fn = function __zuzu_bodyless_function_wrapper( ...args ) {
					if ( typeof target === 'function' ) {
						return target.apply( this, args );
					}
					throw new Error( `Exception: Function '${name}' has no body` );
				};
				Object.defineProperty( fn, '__zuzu_complete_body', {
					value( completed ) {
						target = completed;
						return fn;
					},
					enumerable: false,
					configurable: true,
				} );
				return fn;
			},
			__zuzu_complete_function( current, completed, meta ) {
				const value = completed;
				if ( value && ( typeof value === 'function' || typeof value === 'object' ) ) {
					Object.defineProperty( value, '__zuzu_marshal_meta', {
						value: meta || {},
						enumerable: false,
						configurable: true,
						writable: true,
					} );
				}
				if ( current && typeof current.__zuzu_complete_body === 'function' ) {
					return current.__zuzu_complete_body( value );
				}
				throw new Error( 'Exception: function predeclaration target is not bodyless' );
			},
			__zuzu_with_marshal_meta( value, meta ) {
				if ( value && ( typeof value === 'function' || typeof value === 'object' ) ) {
					Object.defineProperty( value, '__zuzu_marshal_meta', {
						value: meta || {},
						enumerable: false,
						configurable: true,
						writable: true,
					} );
				}
				return value;
			},
			__zuzu_await_value( value ) {
				return taskRuntime.awaitValue( value );
			},
			__zuzu_await_block( value ) {
				return taskRuntime.awaitBlock( value );
			},
			__zuzu_callsite( metadata, fn ) {
				return taskRuntime.withCallsite(
					{
						file: filename,
						...( metadata || {} ),
					},
					fn,
				);
			},
			__zuzu_task( fn, metadata ) {
				return taskRuntime.task( fn, {
					file: filename,
					...( metadata || {} ),
				} );
			},
			__zuzu_task_sync( fn, metadata ) {
				return taskRuntime.taskSync( fn, {
					file: filename,
					...( metadata || {} ),
				} );
			},
			__zuzu_spawn( fn, metadata ) {
				return taskRuntime.spawn( fn, {
					file: filename,
					...( metadata || {} ),
				} );
			},
			async __zuzu_collection_map_async( collection, fn ) {
				const out = [];
				for ( const item of collection || [] ) {
					out.push( await taskRuntime.awaitValue( fn( item ) ) );
				}
				return out;
			},
			async __zuzu_collection_grep_async( collection, fn ) {
				const out = [];
				for ( const item of collection || [] ) {
					if ( zuzuTruthy( await taskRuntime.awaitValue( fn( item ) ) ) ) {
						out.push( item );
					}
				}
				return out;
			},
			async __zuzu_collection_reduce_async( collection, fn ) {
				const items = Array.from( collection || [] );
				if ( items.length === 0 ) {
					return null;
				}
				let acc = items[0];
				for ( let i = 1; i < items.length; i++ ) {
					acc = await taskRuntime.awaitValue( fn( acc, items[i] ) );
				}
				return acc;
			},
			__zuzu_prepare_eval( source, namedArgs = null ) {
				if ( typeof source !== 'string' ) {
					throw new ZuzuTypeException(
						`TypeException: eval expects String, got ${zuzuTypeof( source )}`
					);
				}
				if ( namedArgs != null && !( namedArgs instanceof PairList ) ) {
					throw new ZuzuTypeException(
						`TypeException: eval named arguments must be PairList, got ${zuzuTypeof( namedArgs )}`
					);
				}
				let compiled;
				try {
					compiled = runtime.transpile( source, { syncEval: true } );
				}
				catch ( err ) {
					const line = err && err.token && err.token.line != null
						? err.token.line
						: 1;
					throw new ZuzuException( {
						message: err && err.message
							? String( err.message )
							: String( err ),
						file: '<std/eval>',
						line,
						code: 'E_COMPILE_SYNTAX',
					} );
				}
				if ( namedArgs == null ) {
					return compiled;
				}
				const overrides = Object.create( null );
				const accepted = new Set( [
					'deny_fs',
					'deny_net',
					'deny_perl',
					'deny_js',
					'deny_proc',
					'deny_db',
					'deny_clib',
					'deny_gui',
					'deny_worker',
				] );
				for ( const optName of namedArgs.keys() ) {
					if ( !accepted.has( optName ) ) {
						throw new ZuzuException(
							`Unknown named argument '${optName}' for eval`
						);
					}
				}
				for ( const [ optName, flagName ] of [
					[ 'deny_fs', 'deny_fs' ],
					[ 'deny_net', 'deny_net' ],
					[ 'deny_perl', 'deny_perl' ],
					[ 'deny_js', 'deny_js' ],
					[ 'deny_proc', 'deny_proc' ],
					[ 'deny_db', 'deny_db' ],
					[ 'deny_clib', 'deny_clib' ],
					[ 'deny_gui', 'deny_gui' ],
					[ 'deny_worker', 'deny_worker' ],
				] ) {
					if ( namedArgs.has( optName ) && zuzuTruthy( namedArgs.get( optName ) ) ) {
						overrides[flagName] = true;
					}
				}
				if ( Object.keys( overrides ).length === 0 ) {
					return compiled;
				}
				return [
					'( () => {',
					`const __zuzu_eval_prev_caps = __zuzu_push_eval_capability_overrides( ${JSON.stringify( overrides )} );`,
					'try {',
					'return ( () => {',
					'const __system__ = __zuzu_current_system();',
					`return ${compiled};`,
					'} )();',
					'} finally {',
					'__zuzu_pop_eval_capability_overrides( __zuzu_eval_prev_caps );',
					'}',
					'} )()',
				].join( '\n' );
			},
			__zuzu_prepare_eval_call_args( args ) {
				let source = '';
				let namedArgs = null;
				if ( args.length > 0 ) {
					if ( args[args.length - 1] instanceof PairList ) {
						namedArgs = args[args.length - 1];
						if ( args.length > 1 ) {
							source = args[0];
						}
					}
					else {
						source = args[0];
					}
				}
				return context.__zuzu_prepare_eval( source, namedArgs );
			},
			__zuzu_await_block_sync( value ) {
				return taskRuntime.awaitBlockSync( value );
			},
			__zuzu_iter( value ) {
				const asIterable = (input) => {
					const hasMethodHere = ( candidate, name ) => {
						if ( candidate == null ) {
							return false;
						}
						if ( Object.prototype.hasOwnProperty.call( candidate, name ) ) {
							return true;
						}
						const proto = Object.getPrototypeOf( candidate );
						if ( !proto ) {
							return false;
						}
						return Object.prototype.hasOwnProperty.call( proto, name );
					};
					if ( input == null ) {
						return [];
					}
					if ( typeof input[Symbol.iterator] === 'function' ) {
						return input;
					}
					if ( typeof input === 'function' ) {
						return {
							*[Symbol.iterator]() {
								while ( true ) {
									try {
										yield input();
									}
									catch ( err ) {
										if ( isExhaustedIteratorError( err ) ) {
											return;
										}
										throw err;
									}
								}
							},
						};
					}
					if ( input && typeof input.to_Iterator === 'function' && hasMethodHere( input, 'to_Iterator' ) ) {
						const iterator = input.to_Iterator();
						if ( typeof iterator === 'function' && input && typeof input === 'object' ) {
							return asIterable( iterator.bind( input ) );
						}
						return asIterable( iterator );
					}
					if ( input && typeof input.to_Array === 'function' && hasMethodHere( input, 'to_Array' ) ) {
						return asIterable( input.to_Array() );
					}
					if ( isPlainObjectLike( input ) && typeof input.to_Iterator === 'function' ) {
						return asIterable( input.to_Iterator() );
					}
					if ( isPlainObjectLike( input ) && typeof input.to_Array === 'function' ) {
						return asIterable( input.to_Array() );
					}
					if ( input && typeof input === 'object' ) {
						return Object.keys( input ).sort();
					}
					return [];
				};
				return asIterable( value );
			},
			__zuzu_length: operatorLength,
			__zuzu_num( value ) { return zuzuToNumber( value ); },
			__zuzu_truthy( value ) { return zuzuTruthy( value ); },
			__zuzu_not( value ) { return zuzuTruthy( value ) ? 0 : 1; },
			__zuzu_and( left, right ) { return zuzuTruthy( left ) && zuzuTruthy( right ) ? 1 : 0; },
			__zuzu_or( left, right ) { return zuzuTruthy( left ) || zuzuTruthy( right ) ? 1 : 0; },
			__zuzu_typeof( value ) { return zuzuTypeof( value ); },
			__zuzu_instanceof( value, klass ) { return zuzuInstanceof( value, klass ); },
			__zuzu_trait( name, methods, source = null, captures = {} ) {
				return zuzuTrait( name, methods, source, captures );
			},
			__zuzu_apply_traits( klass, traits ) { return zuzuApplyTraits( klass, traits ); },
			__zuzu_does( value, trait ) { return zuzuDoes( value, trait ); },
			__zuzu_can( value, methodName ) { return zuzuCan( value, methodName ); },
			__zuzu_super_call( self, klass, methodName, args ) { return zuzuSuperCall( self, klass, methodName, args ); },
			__zuzu_super_static_call( klass, methodName, args ) { return zuzuSuperStaticCall( klass, methodName, args ); },
			__zuzu_super_dispatch( isStatic, self, klass, methodName, args ) { return zuzuSuperDispatch( isStatic, self, klass, methodName, args ); },
			__zuzu_type_matches( value, typeName ) { return zuzuTypeMatches( value, typeName ); },
			__zuzu_require_type( argName, typeName, value ) {
				if ( !zuzuTypeMatches( value, typeName ) ) {
					throw new Error( `TypeException: argument '${argName}' must be ${typeName}, got ${zuzuTypeof( value )}` );
				}
				return value;
			},
			__zuzu_checked_declaration( name, typeName, value ) {
				if ( typeName !== 'Any' && !zuzuTypeMatches( value, typeName ) ) {
					throw new Error( `TypeException: '${name}' must be ${typeName}, got ${zuzuTypeof( value )}` );
				}
				return value;
			},
			__zuzu_checked_return( fnName, typeName, value ) {
				if ( typeName !== 'Any' && !zuzuTypeMatches( value, typeName ) ) {
					throw new Error( `TypeException: 'return value of '${fnName}'' must be ${typeName}, got ${zuzuTypeof( value )}` );
				}
				return value;
			},
			__zuzu_die( value ) {
				if ( typeof value === 'string' ) {
					throw new ZuzuException( value );
				}
				throw value;
			},
			__zuzu_throw( value, line ) {
				const err = (
					value instanceof Error
					|| ( value && typeof value === 'object' )
				)
					? value
					: new ZuzuException( value );
				if ( err.file == null ) {
					err.file = filename;
				}
				if ( err.line == null ) {
					err.line = Number( line || 0 );
				}
				throw err;
			},
			__zuzu_add( left, right ) { return zuzuToNumber( left ) + zuzuToNumber( right ); },
			__zuzu_concat( left, right ) { return concatValue( left, right ); },
			__zuzu_binary_literal( value ) { return binaryFromLiteral( value ); },
			to_binary( value ) { return toBinaryValue( value ); },
			to_string( value ) { return toStringValue( value ); },
			is_ascii( value ) {
				if ( !( value instanceof ZuzuBinary ) ) {
					throw new Error( `TypeException: expected BinaryString for is_ascii, got ${zuzuTypeof( value )}` );
				}
				return value.isAscii();
			},
			__zuzu_bit_and( left, right ) { return bitwiseAnd( left, right ); },
			__zuzu_bit_or( left, right ) { return bitwiseOr( left, right ); },
			__zuzu_bit_xor( left, right ) { return bitwiseXor( left, right ); },
			__zuzu_bit_not( value ) { return bitwiseNot( value ); },
			__zuzu_sub( left, right ) { return zuzuToNumber( left ) - zuzuToNumber( right ); },
			__zuzu_mul( left, right ) { return zuzuToNumber( left ) * zuzuToNumber( right ); },
			__zuzu_div( left, right ) { return zuzuToNumber( left ) / zuzuToNumber( right ); },
			__zuzu_mod( left, right ) { return zuzuToNumber( left ) % zuzuToNumber( right ); },
			__zuzu_pow( left, right ) { return zuzuToNumber( left ) ** zuzuToNumber( right ); },
			__zuzu_cmp( left, right ) {
				const l = zuzuToNumber( left );
				const r = zuzuToNumber( right );
				return l < r ? -1 : ( l > r ? 1 : 0 );
			},
			__zuzu_eq( left, right ) {
				if ( arguments.length < 2 ) {
					return 0;
				}
				return zuzuEqual( left, right );
			},
			__zuzu_ne( left, right ) {
				if ( arguments.length < 2 ) {
					return 0;
				}
				return zuzuEqual( left, right ) ? 0 : 1;
			},
			__zuzu_str_eq( left, right ) { return stringCompare( left, right ) === 0 ? 1 : 0; },
			__zuzu_str_ne( left, right ) { return stringCompare( left, right ) !== 0 ? 1 : 0; },
			__zuzu_str_gt( left, right ) { return stringCompare( left, right ) > 0 ? 1 : 0; },
			__zuzu_str_ge( left, right ) { return stringCompare( left, right ) >= 0 ? 1 : 0; },
			__zuzu_str_lt( left, right ) { return stringCompare( left, right ) < 0 ? 1 : 0; },
			__zuzu_str_le( left, right ) { return stringCompare( left, right ) <= 0 ? 1 : 0; },
			__zuzu_str_cmp( left, right ) { return stringCompare( left, right ); },
			__zuzu_str_eqi( left, right ) { return stringCompare( left, right, { insensitive: true } ) === 0 ? 1 : 0; },
			__zuzu_str_nei( left, right ) { return stringCompare( left, right, { insensitive: true } ) !== 0 ? 1 : 0; },
			__zuzu_str_gti( left, right ) { return stringCompare( left, right, { insensitive: true } ) > 0 ? 1 : 0; },
			__zuzu_str_gei( left, right ) { return stringCompare( left, right, { insensitive: true } ) >= 0 ? 1 : 0; },
			__zuzu_str_lti( left, right ) { return stringCompare( left, right, { insensitive: true } ) < 0 ? 1 : 0; },
			__zuzu_str_lei( left, right ) { return stringCompare( left, right, { insensitive: true } ) <= 0 ? 1 : 0; },
			__zuzu_str_cmpi( left, right ) { return stringCompare( left, right, { insensitive: true } ); },
			__zuzu_warn( ...parts ) {
				emitStderr( parts.map( (part) => zuzuStringify( part ) ).join( '' ) );
			},
			__zuzu_debug( levelThunk, messageThunk ) {
				const level = typeof levelThunk === 'function' ? levelThunk() : levelThunk;
				if ( Number( level || 0 ) > runtime.debugLevel ) {
					return null;
				}
				const message = typeof messageThunk === 'function' ? messageThunk() : messageThunk;
				emitStderr( zuzuStringify( message ?? '' ) );
				return null;
			},
			__zuzu_assert( conditionThunk ) {
				if ( runtime.debugLevel <= 0 ) {
					return null;
				}
				const condition = typeof conditionThunk === 'function' ? conditionThunk() : conditionThunk;
				if ( !condition ) {
					throw new Error( 'Assertion failed' );
				}
				return condition;
			},
			__zuzu_make_class( name, base ) {
				const parent = typeof base === 'function' ? base : Object;
				return {
					[name]: class extends parent {
						constructor( ...args ) {
							if (
								args.length === 1
								&& args[0]
								&& typeof args[0] === 'object'
								&& !Array.isArray( args[0] )
								&& Object.prototype.hasOwnProperty.call( args[0], 'message' )
							) {
								super( args[0].message );
								if ( this instanceof Error ) {
									this.name = name;
								}
								return;
							}
							super( ...args );
							if ( this instanceof Error ) {
								this.name = name;
							}
						}
					},
				}[name];
			},
			__zuzu_define_class( name, base, spec ) {
				return defineZuzuClass( name, base, spec );
			},
			__zuzu_get_member( object, property ) {
				return zuzuGetMember( object, property );
			},
			__zuzu_get_index( object, index ) {
				return zuzuGetIndex( object, index );
			},
			__zuzu_get_brace_member( object, literalProperty, getDynamicProperty ) {
				return zuzuGetBraceMember( object, literalProperty, getDynamicProperty );
			},
			__zuzu_resolve_brace_key( object, literalProperty, getDynamicProperty ) {
				return zuzuResolveBraceKey( object, literalProperty, getDynamicProperty );
			},
			__zuzu_maybe_demolish( value ) {
				return zuzuMaybeDemolish( value );
			},
			__zuzu_xor( left, right ) { return ( zuzuTruthy( left ) !== zuzuTruthy( right ) ) ? 1 : 0; },
			__zuzu_nand( left, right ) { return ( zuzuTruthy( left ) && zuzuTruthy( right ) ) ? 0 : 1; },
			__zuzu_num_eq( left, right ) {
				if ( !isNumericComparable( left ) || !isNumericComparable( right ) ) {
					return zuzuEqual( left, right );
				}
				return numericEqual( left, right ) ? 1 : 0;
			},
			__zuzu_num_ne( left, right ) {
				if ( !isNumericComparable( left ) || !isNumericComparable( right ) ) {
					return zuzuEqual( left, right ) ? 0 : 1;
				}
				return numericEqual( left, right ) ? 0 : 1;
			},
			__zuzu_num_lt( left, right ) { return zuzuToNumber( left ) < zuzuToNumber( right ) ? 1 : 0; },
			__zuzu_num_lte( left, right ) { return zuzuToNumber( left ) <= zuzuToNumber( right ) ? 1 : 0; },
			__zuzu_num_gt( left, right ) { return zuzuToNumber( left ) > zuzuToNumber( right ) ? 1 : 0; },
			__zuzu_num_gte( left, right ) { return zuzuToNumber( left ) >= zuzuToNumber( right ) ? 1 : 0; },
			__zuzu_abs( value ) { return Math.abs( zuzuToNumber( value ) ); },
			__zuzu_sqrt( value ) { return Math.sqrt( zuzuToNumber( value ) ); },
			__zuzu_floor( value ) { return Math.floor( zuzuToNumber( value ) ); },
			__zuzu_ceil( value ) { return Math.ceil( zuzuToNumber( value ) ); },
			__zuzu_round( value ) {
				const n = zuzuToNumber( value );
				return n >= 0 ? Math.floor( n + 0.5 ) : Math.ceil( n - 0.5 );
			},
			__zuzu_int( value ) {
				const n = zuzuToNumber( value );
				return n < 0 ? Math.ceil( n ) : Math.floor( n );
			},
			__zuzu_uc( value ) {
				if ( value instanceof ZuzuBinary ) {
					throw new Error( 'TypeException: uc expects String, got BinaryString' );
				}
				return zuzuOperatorString( value ).toUpperCase();
			},
			__zuzu_lc( value ) {
				if ( value instanceof ZuzuBinary ) {
					throw new Error( 'TypeException: lc expects String, got BinaryString' );
				}
				return zuzuOperatorString( value ).toLowerCase();
			},
			__zuzu_range( start, end ) {
				const from = zuzuToNumber( start );
				const to = zuzuToNumber( end );
				const out = [];
				const step = from <= to ? 1 : -1;
				for ( let n = from; step > 0 ? n <= to : n >= to; n += step ) {
					out.push( n );
				}
				return out;
			},
			__zuzu_ref_index( target, index ) { return refIndex( target, index ); },
			__zuzu_ref_key( target, key ) { return refKey( target, key ); },
			__zuzu_ref_slice( target, from, length ) { return refSlice( target, from, length ); },
			__zuzu_assign_slice( target, from, length, value ) { return zuzuAssignSlice( target, from, length, value ); },
			Pair,
		};
		if ( this.host.name === 'browser' ) {
			context.Object = createObjectFacade();
		}
		context.__zuzu_push_eval_capability_overrides = (overrides = {}) => {
			const previous = this.evalCapabilityOverrides;
			const next = { ...( previous || {} ) };
			for ( const [ key, value ] of Object.entries( overrides || {} ) ) {
				if ( value ) {
					next[key] = true;
				}
			}
			this.evalCapabilityOverrides = Object.keys( next ).length > 0 ? next : null;
			return previous;
		};
		context.__zuzu_pop_eval_capability_overrides = (previous) => {
			this.evalCapabilityOverrides = previous || null;
		};
		context.__zuzu_import = (name) => {
			if ( name === 'std/eval' ) {
				return { eval: context.__zuzu_native_eval };
			}
			return this.loadModule( name, filename, context );
		};
		return context;
	}

	installCollectionMethods( context ) {
		const bootstrap = `
			(function () {
				globalThis.__zuzu_native_eval = eval;
				globalThis.Dict = function Dict( value ) {
					if ( value && typeof value === 'object' && !Array.isArray( value ) ) {
						return Object.assign( {}, value );
					}
					return {};
				};
				if ( !globalThis.__zuzu_define_property_patched ) {
					const __zuzu_native_define_property = Object.defineProperty;
					const __zuzu_native_define_properties = Object.defineProperties;
					const __zuzu_safe_descriptor = function ( descriptor ) {
						if ( !descriptor || typeof descriptor !== 'object' ) {
							return descriptor;
						}
						const safe = Object.create( null );
						for ( const key of [ 'value', 'get', 'set', 'writable', 'enumerable', 'configurable' ] ) {
							if ( Object.prototype.hasOwnProperty.call( descriptor, key ) ) {
								safe[key] = descriptor[key];
							}
						}
						return safe;
					};
					Object.defineProperty = function __zuzu_define_property( obj, prop, descriptor ) {
						return __zuzu_native_define_property(
							obj,
							prop,
							__zuzu_safe_descriptor( descriptor )
						);
					};
					Object.defineProperties = function __zuzu_define_properties( obj, descriptors ) {
						const safeDescriptors = Object.create( null );
						for ( const key of Object.keys( descriptors || {} ) ) {
							safeDescriptors[key] = __zuzu_safe_descriptor( descriptors[key] );
						}
						return __zuzu_native_define_properties( obj, safeDescriptors );
					};
					globalThis.__zuzu_define_property_patched = true;
				}
				const __zuzu_seed = globalThis.__zuzu_system_seed || Object.create( null );
				const __zuzu_system_desc = Object.create( null );
				__zuzu_system_desc.get = function __zuzu_get_system() {
					if ( typeof globalThis.__zuzu_current_system === 'function' ) {
						return globalThis.__zuzu_current_system();
					}
					return Object.freeze( Object.assign( {}, __zuzu_seed ) );
				};
				__zuzu_system_desc.enumerable = true;
				__zuzu_system_desc.configurable = true;
				Object.defineProperty(
					globalThis,
					'__system__',
					__zuzu_system_desc
				);
				delete globalThis.__zuzu_system_seed;
				const define = ( proto, name, fn ) => {
					if ( !Object.prototype.hasOwnProperty.call( proto, name ) ) {
						const desc = Object.create( null );
						desc.value = fn;
						desc.enumerable = false;
						desc.configurable = true;
						desc.writable = true;
						Object.defineProperty( proto, name, desc );
					}
				};
				define( Array.prototype, 'length', function _length() { return this.length; } );
				define( Array.prototype, 'count', function _count() { return this.length; } );
				define( Array.prototype, 'empty', function _empty() { return this.length === 0 ? 1 : 0; } );
				define( Array.prototype, 'is_empty', function _is_empty() { return this.empty(); } );
				define( Array.prototype, 'append', function _append( ...values ) { this.push( ...values ); return this; } );
				define( Array.prototype, 'add', function _add( ...values ) { this.push( ...values ); return this; } );
				define( Array.prototype, 'prepend', function _prepend( ...values ) { this.unshift( ...values ); return this; } );
				define( Array.prototype, 'push_weak', function _push_weak( ...values ) { this.push( ...values.map( __zuzu_make_weak_value ) ); return this; } );
				define( Array.prototype, 'unshift_weak', function _unshift_weak( ...values ) { this.unshift( ...values.map( __zuzu_make_weak_value ) ); return this; } );
				define( Array.prototype, 'get', function _get( idx, fallback = null ) { return idx >= 0 && idx < this.length ? this[idx] : fallback; } );
				define( Array.prototype, 'set', function _set( idx, value ) { this[idx] = value; return this; } );
				define( Array.prototype, 'set_weak', function _set_weak( idx, value ) { this[idx] = __zuzu_make_weak_value( value ); return this; } );
				define( Array.prototype, 'grep', function _grep( fn ) { return this.filter( fn ); } );
				define( Array.prototype, 'any', function _any( fn ) { return this.some( fn ) ? 1 : 0; } );
				define( Array.prototype, 'all', function _all( fn ) { return this.every( fn ) ? 1 : 0; } );
				define( Array.prototype, 'first', function _first( fn ) { return this.find( fn ) ?? null; } );
				define( Array.prototype, 'remove', function _remove( fn ) { for ( let i = this.length - 1; i >= 0; i-- ) { if ( fn( this[i] ) ) { this.splice( i, 1 ); } } return this; } );
				define( Array.prototype, 'contains', function _contains( value ) { return this.includes( value ) ? 1 : 0; } );
				define( Array.prototype, 'first_index', function _first_index( fn ) { return this.findIndex( fn ); } );
				define( Array.prototype, 'reductions', function _reductions( fn ) { const out = []; for ( const item of this ) { out.push( out.length === 0 ? item : fn( out[out.length - 1], item ) ); } return out; } );
				define( Array.prototype, 'head', function _head( n ) { return this.slice( 0, n ); } );
				define( Array.prototype, 'tail', function _tail( n ) { return this.slice( n - 1 ); } );
				define( Array.prototype, 'sum', function _sum() { return this.reduce( (a, b) => Number( a ) + Number( b ), 0 ); } );
				define( Array.prototype, 'product', function _product() { return this.reduce( (a, b) => Number( a ) * Number( b ), 1 ); } );
				define( Array.prototype, 'shuffle', function _shuffle() { return this.slice(); } );
				define( Array.prototype, 'sample', function _sample( n ) { return this.slice( 0, n ); } );
				define( Array.prototype, 'for_each_value', function _for_each_value( fn ) { this.forEach( fn ); return this; } );
				define( Array.prototype, 'sortstr', function _sortstr() { return this.slice().sort( (a, b) => String( a ).localeCompare( String( b ) ) ); } );
				define( Array.prototype, 'sortnum', function _sortnum() { return this.map( (item) => Number( item ) ).sort( (a, b) => a - b ); } );
				define( Array.prototype, 'to_Array', function _to_array() { return this.slice(); } );
				define( Array.prototype, 'to_Set', function _to_set() { return new Set( this ); } );
				define( Array.prototype, 'to_Bag', function _to_bag() { return new Bag( this ); } );
				define( Array.prototype, 'to_Iterator', function _to_iterator() { return this[Symbol.iterator](); } );
				define( Array.prototype, 'copy', function _copy() { return this.slice(); } );
				define( Array.prototype, 'clear', function _clear() { this.splice( 0, this.length ); return this; } );

				define( Set.prototype, 'length', function _length() { return this.size; } );
				define( Set.prototype, 'count', function _count() { return this.size; } );
				define( Set.prototype, 'empty', function _empty() { return this.size === 0 ? 1 : 0; } );
				define( Set.prototype, 'is_empty', function _is_empty() { return this.empty(); } );
				define( Set.prototype, 'push', function _push( ...values ) { for ( const v of values ) { this.add( v ); } return this; } );
				define( Set.prototype, 'add_weak', function _add_weak( value ) { this.add( __zuzu_make_weak_value( value ) ); return this; } );
				define( Set.prototype, 'contains', function _contains( value ) { return __zuzu_contains( this, value ); } );
				define( Set.prototype, 'remove', function _remove( value ) { this.delete( value ); return this; } );
				define( Set.prototype, 'to_Array', function _to_array() { return [ ...this ]; } );
				define( Set.prototype, 'to_Bag', function _to_bag() { return new Bag( [ ...this ] ); } );
				define( Set.prototype, 'to_Iterator', function _to_iterator() { return this.values(); } );
				define( Set.prototype, 'copy', function _copy() { return new Set( this ); } );
				define( Set.prototype, 'union', function _union( other ) { return __zuzu_union( this, other ); } );
				define( Set.prototype, 'intersection', function _intersection( other ) { return __zuzu_intersection( this, other ); } );
				define( Set.prototype, 'difference', function _difference( other ) { return __zuzu_difference( this, other ); } );
				define( Set.prototype, 'symmetric_difference', function _symmetric_difference( other ) { return __zuzu_difference( this.union( other ), this.intersection( other ) ); } );
				define( Set.prototype, 'is_subset', function _is_subset( other ) { return __zuzu_subsetof( this, other ); } );
				define( Set.prototype, 'is_superset', function _is_superset( other ) { return __zuzu_supersetof( this, other ); } );
				define( Set.prototype, 'is_disjoint', function _is_disjoint( other ) { return this.intersection( other ).size === 0 ? 1 : 0; } );
				define( Set.prototype, 'equals', function _equals( other ) { return __zuzu_equivalentof( this, other ); } );
				define( Set.prototype, 'sort', function _sort( fn ) { return [ ...this ].sort( fn ); } );
				define( Set.prototype, 'sortstr', function _sortstr() { return [ ...this ].sort( (a, b) => String( a ).localeCompare( String( b ) ) ); } );
				define( Set.prototype, 'sortnum', function _sortnum() { return [ ...this ].map( (item) => Number( item ) ).sort( (a, b) => a - b ); } );
				define( Set.prototype, 'map', function _map( fn ) { return new Set( [ ...this ].map( fn ) ); } );
				define( Set.prototype, 'grep', function _grep( fn ) { return new Set( [ ...this ].filter( fn ) ); } );
				define( Set.prototype, 'any', function _any( fn ) { return [ ...this ].some( fn ) ? 1 : 0; } );
				define( Set.prototype, 'all', function _all( fn ) { return [ ...this ].every( fn ) ? 1 : 0; } );
				define( Set.prototype, 'first', function _first( fn ) { for ( const v of this ) { if ( fn( v ) ) { return v; } } return null; } );
				define( Set.prototype, 'remove_if', function _remove_if( fn ) { for ( const v of [ ...this ] ) { if ( fn( v ) ) { this.delete( v ); } } return this; } );
				define( Set.prototype, 'for_each_value', function _for_each_value( fn ) { for ( const v of this ) { fn( v ); } return this; } );
				const clearSet = Set.prototype.clear;
				define( Set.prototype, 'clear', function _clear() { clearSet.call( this ); return this; } );
				define( RegExp.prototype, 'to_String', function _to_string() { return this.source; } );
				if ( !Object.prototype.hasOwnProperty.call( RegExp.prototype, Symbol.toPrimitive ) ) {
					const regDesc = Object.create( null );
					regDesc.value = function _regexp_to_primitive( hint ) {
						if ( hint === 'string' || hint === 'default' ) {
							return this.to_String();
						}
						return NaN;
					};
					regDesc.enumerable = false;
					regDesc.configurable = true;
					regDesc.writable = true;
					Object.defineProperty( RegExp.prototype, Symbol.toPrimitive, regDesc );
				}
				if ( !Object.prototype.hasOwnProperty.call( Object.prototype, Symbol.toPrimitive ) ) {
					const objectDesc = Object.create( null );
					objectDesc.value = function _object_to_primitive( hint ) {
						if ( ( hint === 'string' || hint === 'default' ) && typeof this.to_String === 'function' ) {
							return this.to_String();
						}
						const methods = hint === 'number'
							? [ 'valueOf', 'toString' ]
							: [ 'toString', 'valueOf' ];
						for ( const methodName of methods ) {
							const method = this[methodName];
							if ( typeof method !== 'function' ) {
								continue;
							}
							if ( methodName === 'toString' && method === Object.prototype.toString ) {
								continue;
							}
							if ( methodName === 'valueOf' && method === Object.prototype.valueOf ) {
								continue;
							}
							const value = method.call( this );
							if ( value == null || typeof value !== 'object' ) {
								return value;
							}
						}
						return Object.prototype.toString.call( this );
					};
					objectDesc.enumerable = false;
					objectDesc.configurable = true;
					objectDesc.writable = true;
					Object.defineProperty( Object.prototype, Symbol.toPrimitive, objectDesc );
				}

			})();
		`;
		const bootstrapRunOptions = {};
		if ( this.executionTimeoutMs != null ) {
			bootstrapRunOptions.timeout = this.executionTimeoutMs;
		}
		this.host.runInContext( bootstrap, context, bootstrapRunOptions );
	}

	loadModule( moduleName, fromFile, contextForPolicy = null ) {
		if ( /(^|\/)\.\.(\/|$)/.test( moduleName ) ) {
			throw new Error( "Import module path cannot contain '..' segments" );
		}
		this.enforceModulePolicy( moduleName );
		const resolved = this.resolveModulePath( moduleName, fromFile );
		const cacheable = moduleName !== 'test/more'
			&& this.evalCapabilityOverrides == null;
		if ( cacheable && this.moduleCache.has( resolved ) ) {
			return this.moduleCache.get( resolved );
		}
		if ( this.moduleLoading.has( resolved ) ) {
			throw new Error( 'Circular module loading detected' );
		}
		if ( resolved.endsWith( '.js' ) ) {
			const hiddenObjectPrototypeMethods = [];
			for ( const name of [ 'get', 'set' ] ) {
				const desc = Object.prototype.hasOwnProperty.call( Object.prototype, name )
					? Object.getOwnPropertyDescriptor( Object.prototype, name )
					: null;
				if ( desc && desc.configurable ) {
					hiddenObjectPrototypeMethods.push( [ name, desc ] );
					delete Object.prototype[name];
				}
			}
			let loaded;
			try {
				loaded = this.host.loadJsModule( resolved, moduleName, fromFile );
			}
			finally {
				for ( const [ name, desc ] of hiddenObjectPrototypeMethods ) {
					Object.defineProperty( Object.prototype, name, desc );
				}
			}
			if (
				loaded
				&& typeof loaded.__zuzu_set_runtime_policy === 'function'
			) {
				const policy = {
					gui: this.host.gui || null,
					host_name: this.host.name,
					repo_root: this.repoRoot,
					include_paths: this.includePaths.slice(),
					deny_modules: [ ...this.denyModules ],
					debug_level: this.debugLevel,
					transpiler: this.transpiler,
					load_module: ( name, requestFromFile = fromFile ) => this.loadModule(
						name,
						requestFromFile || fromFile,
						contextForPolicy
					),
					builtin_class: ( name ) => {
						if ( !contextForPolicy ) {
							return null;
						}
						const builtins = {
							Array: contextForPolicy.Array,
							Bag: contextForPolicy.Bag,
							Class: contextForPolicy.Class,
							Dict: contextForPolicy.Dict || contextForPolicy.Object,
							Function: contextForPolicy.Function,
							Object: contextForPolicy.Object,
							Pair: contextForPolicy.Pair,
							PairList: contextForPolicy.PairList,
							Regexp: contextForPolicy.RegExp,
							Set: contextForPolicy.Set,
						};
						return builtins[name] || null;
					},
						to_String: ( value ) => zuzuOperatorString( value ),
						to_Number: ( value ) => zuzuToNumber( value ),
						to_Boolean: ( value ) => zuzuTruthy( value ),
						to_Regexp: ( value ) => operatorRegexp( value ),
						stdout_write: ( text ) => {
							if ( typeof this.stdoutHandler === 'function' ) {
								this.stdoutHandler( String( text ) );
							}
							else if ( typeof process !== 'undefined' && process.stdout ) {
								process.stdout.write( String( text ) );
							}
							else {
								this.host.consoleLog( String( text ) );
							}
						},
						stderr_write: ( text ) => {
							if ( typeof this.stderrHandler === 'function' ) {
								this.stderrHandler( String( text ) );
							}
							else if ( typeof process !== 'undefined' && process.stderr ) {
								process.stderr.write( String( text ) );
							}
							else if ( typeof console !== 'undefined' && typeof console.warn === 'function' ) {
								console.warn( String( text ) );
							}
						},
						browser_worker_source: this.host.workerSource || null,
						browser_worker_url: this.host.workerUrl || null,
						browser_worker_factory: this.host.workerFactory || null,
				};
				for ( const capability of [
					'fs',
					'net',
					'perl',
					'js',
					'proc',
					'db',
					'clib',
					'gui',
					'worker',
				] ) {
					policy[`deny_${capability}`] =
						this.isCapabilityDenied( capability )
						|| !this.host.capabilities.has( capability );
				}
				loaded.__zuzu_set_runtime_policy( policy );
			}
			if ( cacheable ) {
				this.moduleCache.set( resolved, loaded );
			}
			return loaded;
		}
		const source = this.host.readFileText( resolved );
		let js = this.transpile( source );
		setCompiledSource( resolved, js );
		const exportNames = resolved.endsWith( '.zzm' )
			? collectTopLevelDeclarations( source, stripPod )
			: [];
		if ( exportNames.length > 0 ) {
			const exportBridge = exportNames
				.map( (name) => {
					if ( name.startsWith( '_' ) ) {
						return `if ( typeof ${name} !== "undefined" ) { const __zuzu_desc = Object.create( null ); __zuzu_desc.get = function() { return ${name}; }; __zuzu_desc.set = function( value ) { ${name} = value; }; __zuzu_desc.enumerable = false; __zuzu_desc.configurable = true; Object.defineProperty( module.exports, ${JSON.stringify( name )}, __zuzu_desc ); }`;
					}
					return `if ( typeof ${name} !== "undefined" ) { const __zuzu_desc = Object.create( null ); __zuzu_desc.get = function() { return ${name}; }; __zuzu_desc.set = function( value ) { ${name} = value; }; __zuzu_desc.enumerable = true; __zuzu_desc.configurable = true; Object.defineProperty( module.exports, ${JSON.stringify( name )}, __zuzu_desc ); }`;
				} )
				.join( '\n' );
			js += `\n${exportBridge}\n`;
		}
		const moduleObj = { exports: {} };
		const context = this.buildContext( {
			exports: moduleObj.exports,
			module: moduleObj,
			filename: resolved,
		} );
		context.__global__ = Object.create( null );
		this.installCollectionMethods( context );
		const moduleRunOptions = { filename: resolved };
		if ( this.executionTimeoutMs != null ) {
			moduleRunOptions.timeout = this.executionTimeoutMs;
		}
		this.moduleLoading.add( resolved );
		try {
			this.host.runInContext( js, context, moduleRunOptions );
			if ( cacheable ) {
				this.moduleCache.set( resolved, moduleObj.exports );
			}
		}
		finally {
			this.moduleLoading.delete( resolved );
		}
		return moduleObj.exports;
	}

	runSource( source, options = {} ) {
		const filename = options.filename || this.host.join( this.repoRoot, '<inline>.zzs' );
		let js;
		try {
			js = this.transpile( source );
		}
		catch ( err ) {
			const stderr = formatRuntimeError( err );
			if ( typeof options.onStderr === 'function' ) {
				options.onStderr( stderr );
			}
			return {
				status: 3,
				stdout: '',
				stderr,
			};
		}
		return this.runCompiled( js, options );
	}

	runCompiled( js, options = {} ) {
		const filename = options.filename || this.host.join( this.repoRoot, '<inline>.zzs' );
		taskRuntime.resetForRun( this.debugLevel );
		setCompiledSource( filename, js );
		const preloadGlobals = Object.create( null );
		if ( Array.isArray( options.preloadModules ) ) {
			for ( const moduleName of options.preloadModules ) {
				Object.assign( preloadGlobals, this.loadModule( moduleName, filename ) );
			}
		}
		this.outputLines = [];
		const previousStdoutHandler = this.stdoutHandler;
		const previousStderrHandler = this.stderrHandler;
		this.stdoutHandler = typeof options.onStdout === 'function'
			? options.onStdout
			: null;
		this.stderrHandler = typeof options.onStderr === 'function'
			? options.onStderr
			: null;
		const context = this.buildContext( {
			filename,
			globals: preloadGlobals,
		} );
		context.__global__ = Object.create( null );
		this.installCollectionMethods( context );
		const finishRun = () => {
			let topLevelTests = 0;
			let hasTopLevelPlan = false;
			for ( const line of this.outputLines ) {
				if ( /^\d+\.\.\d+\s*$/.test( line ) ) {
					hasTopLevelPlan = true;
				}
				if ( /^ok\b/.test( line ) || /^not ok\b/.test( line ) ) {
					topLevelTests++;
				}
			}
			if ( topLevelTests > 0 && !hasTopLevelPlan ) {
				const stdout = this.outputLines.length > 0 ? `${this.outputLines.join( '\n' )}\n` : '';
				const stderr = 'Error: TAP plan missing (expected 1..N)\n';
				if ( typeof this.stderrHandler === 'function' ) {
					this.stderrHandler( stderr );
				}
				return {
					status: 1,
					stdout,
					stderr,
				};
			}
			const stdout = this.outputLines.length > 0 ? `${this.outputLines.join( '\n' )}\n` : '';
			return {
				status: 0,
				stdout,
				stderr: '',
			};
		};
		const failRun = (err) => {
			const stdout = this.outputLines.length > 0 ? `${this.outputLines.join( '\n' )}\n` : '';
			const isParse = err && err.name === 'SyntaxError';
			const stderr = formatRuntimeError( err );
			if ( typeof this.stderrHandler === 'function' ) {
				this.stderrHandler( stderr );
			}
			return {
				status: isParse ? 3 : 1,
				stdout,
				stderr,
			};
		};
		const cleanupRun = (result) => {
			taskRuntime.shutdown( 'Task cancelled' );
			this.outputLines = null;
			this.stdoutHandler = previousStdoutHandler;
			this.stderrHandler = previousStderrHandler;
			return result;
		};
		const invokeMain = () => {
			if ( typeof context.__main__ !== 'function' ) {
				return null;
			}
			const argv = Array.isArray( options.scriptArgs )
				? options.scriptArgs.map( (value) => String( value ) )
				: [];
			const mainResult = context.__main__( argv );
			if (
				mainResult instanceof taskRuntime.Task
				|| ( mainResult && typeof mainResult.then === 'function' )
			) {
				return taskRuntime.awaitValue( mainResult );
			}
			return null;
		};
		try {
			const scriptRunOptions = { filename };
			if ( this.executionTimeoutMs != null ) {
				scriptRunOptions.timeout = this.executionTimeoutMs;
			}
			const topLevelResult = this.host.runInContext( js, context, scriptRunOptions );
			if ( topLevelResult && typeof topLevelResult.then === 'function' ) {
				return Promise.resolve( topLevelResult )
					.then( invokeMain )
					.then( finishRun, failRun )
					.then( cleanupRun );
			}
			const mainResult = invokeMain();
			if ( mainResult && typeof mainResult.then === 'function' ) {
				return Promise.resolve( mainResult )
					.then( finishRun, failRun )
					.then( cleanupRun );
			}
			return cleanupRun( finishRun() );
		}
		catch ( err ) {
			return cleanupRun( failRun( err ) );
		}
	}

	runFile( scriptPath ) {
		const source = this.host.readFileText( scriptPath );
		return this.runSource( source, {
			filename: scriptPath,
			scriptArgs: [],
		} );
	}
}

module.exports = {
	ZuzuScript,
	isWeakableValue,
	makeWeakValue,
	resolveWeakValue,
};
