'use strict';

const { ZuzuBag, Pair, PairList, withArrayMethods } = require( './collections' );

class ZuzuBinary {
	constructor( bytes = [] ) {
		if ( bytes instanceof ZuzuBinary ) {
			this.bytes = new Uint8Array( bytes.bytes );
			return;
		}
		if ( bytes instanceof Uint8Array ) {
			this.bytes = new Uint8Array( bytes );
			return;
		}
		if ( Array.isArray( bytes ) ) {
			this.bytes = Uint8Array.from( bytes.map( (item) => Number( item ) & 0xff ) );
			return;
		}
		this.bytes = new Uint8Array( 0 );
	}

	get length() {
		return this.bytes.length;
	}

	byteLength() {
		return this.bytes.length;
	}

	isAscii() {
		for ( const byte of this.bytes ) {
			if ( byte > 0x7f ) {
				return 0;
			}
		}
		return 1;
	}

	slice( start, end ) {
		return new ZuzuBinary( this.bytes.slice( start, end ) );
	}

	at( index ) {
		const idx = Number( index );
		if ( idx < 0 || idx >= this.bytes.length ) {
			return null;
		}
		return new ZuzuBinary( [ this.bytes[idx] ] );
	}

	to_String() {
		let out = '';
		for ( const byte of this.bytes ) {
			out += String.fromCharCode( byte );
		}
		return out;
	}

	toString() {
		return this.to_String();
	}

	[Symbol.toPrimitive]( hint ) {
		if ( hint === 'number' ) {
			return NaN;
		}
		return this.to_String();
	}
}

class BinaryString extends ZuzuBinary {
	constructor( bytes ) {
		super( bytes );
	}
}

const weakStates = new WeakMap();

class ZuzuWeakCell {
	constructor( value ) {
		this.value = value;
	}

	deref() {
		const value = this.value;
		if ( !isWeakableValue( value ) ) {
			return value;
		}
		const state = weakStates.get( value );
		return state && state.strong > 0 ? value : null;
	}
}

function isWeakCell( value ) {
	return value instanceof ZuzuWeakCell;
}

function isWeakableValue( value ) {
	if ( value == null ) {
		return false;
	}
	if (
		typeof value === 'boolean'
		|| typeof value === 'number'
		|| typeof value === 'string'
	) {
		return false;
	}
	const tag = Object.prototype.toString.call( value );
	if (
		tag === '[object Boolean]'
		|| tag === '[object Number]'
		|| tag === '[object String]'
		|| tag === '[object RegExp]'
	) {
		return false;
	}
	if ( value instanceof ZuzuBinary ) {
		return false;
	}
	return typeof value === 'object' || typeof value === 'function';
}

function resolveWeakValue( value ) {
	return isWeakCell( value ) ? value.deref() : value;
}

function makeWeakValue( value ) {
	return new ZuzuWeakCell( resolveWeakValue( value ) );
}

function retainValue( value ) {
	const resolved = resolveWeakValue( value );
	if ( isWeakableValue( resolved ) ) {
		const state = weakStates.get( resolved ) || { strong: 0 };
		state.strong += 1;
		weakStates.set( resolved, state );
	}
	return resolved;
}

function releaseValue( value ) {
	if ( isWeakCell( value ) ) {
		return null;
	}
	const resolved = resolveWeakValue( value );
	if ( isWeakableValue( resolved ) ) {
		const state = weakStates.get( resolved );
		if ( state ) {
			state.strong = Math.max( 0, state.strong - 1 );
		}
	}
	return null;
}

function assignStrongValue( oldValue, newValue ) {
	releaseValue( oldValue );
	return retainValue( newValue );
}

function assignWeakValue( oldValue, newValue ) {
	releaseValue( oldValue );
	return makeWeakValue( newValue );
}

function isSetLike( value ) {
	return Object.prototype.toString.call( value ) === '[object Set]';
}

function collectTopLevelDeclarations( source, stripPod ) {
	const stripped = stripPod( source );
	const masked = [];
	let depth = 0;
	let inSingle = false;
	let inDouble = false;
	let inBacktick = false;
	let inLineComment = false;
	let inBlockComment = false;
	let escape = false;

	for ( let i = 0; i < stripped.length; i++ ) {
		const ch = stripped[i];
		const next = stripped[i + 1] || '';

		if ( inLineComment ) {
			if ( ch === '\n' ) {
				inLineComment = false;
				masked.push( '\n' );
			}
			else {
				masked.push( ' ' );
			}
			continue;
		}
		if ( inBlockComment ) {
			if ( ch === '*' && next === '/' ) {
				inBlockComment = false;
				masked.push( ' ' );
				i++;
				masked.push( ' ' );
				continue;
			}
			masked.push( ch === '\n' ? '\n' : ' ' );
			continue;
		}
		if ( inSingle || inDouble || inBacktick ) {
			if ( escape ) {
				escape = false;
				masked.push( ' ' );
				continue;
			}
			if ( ch === '\\' ) {
				escape = true;
				masked.push( ' ' );
				continue;
			}
			if ( inSingle && ch === '\'' ) {
				inSingle = false;
			}
			else if ( inDouble && ch === '"' ) {
				inDouble = false;
			}
			else if ( inBacktick && ch === '`' ) {
				inBacktick = false;
			}
			masked.push( ch === '\n' ? '\n' : ' ' );
			continue;
		}

		if ( ch === '/' && next === '/' ) {
			inLineComment = true;
			masked.push( ' ' );
			i++;
			masked.push( ' ' );
			continue;
		}
		if ( ch === '/' && next === '*' ) {
			inBlockComment = true;
			masked.push( ' ' );
			i++;
			masked.push( ' ' );
			continue;
		}
		if ( ch === '\'' ) {
			inSingle = true;
			masked.push( ' ' );
			continue;
		}
		if ( ch === '"' ) {
			inDouble = true;
			masked.push( ' ' );
			continue;
		}
		if ( ch === '`' ) {
			inBacktick = true;
			masked.push( ' ' );
			continue;
		}
		if ( ch === '{' ) {
			depth++;
			masked.push( ' ' );
			continue;
		}
		if ( ch === '}' ) {
			if ( depth > 0 ) {
				depth--;
			}
			masked.push( ' ' );
			continue;
		}

		masked.push( depth === 0 ? ch : ( ch === '\n' ? '\n' : ' ' ) );
	}

	const topLevel = masked.join( '' );
	const names = new Set();
	const patterns = [
		/(?:^|[;\n])\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(|\b)/gm,
		/(?:^|[;\n])\s*(?:export\s+)?(?:async\s+)?fn\s+(?:[A-Za-z_][A-Za-z0-9_]*\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(|\b)/gm,
		/(?:^|[;\n])\s*(?:export\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)\b/gm,
		/(?:^|[;\n])\s*(?:export\s+)?trait\s+([A-Za-z_][A-Za-z0-9_]*)\b/gm,
		/(?:^|[;\n])\s*(?:export\s+)?(?:let|const)\s+(?:[A-Za-z_][A-Za-z0-9_]*\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?::=|=|;)/gm,
	];
	for ( const rx of patterns ) {
		let match = rx.exec( topLevel );
		while ( match ) {
			names.add( match[1] );
			match = rx.exec( topLevel );
		}
	}
	const importRx = /(?:^|[;\n])\s*from\s+[^;\n]+?\s+(?:try\s+)?import\s+([\s\S]*?);/gm;
	let importMatch = importRx.exec( topLevel );
	while ( importMatch ) {
		for ( const rawPart of importMatch[1].split( ',' ) ) {
			const part = rawPart.trim();
			if ( !part || part === '*' ) {
				continue;
			}
			const alias = part.match( /\bas\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/u );
			if ( alias ) {
				names.add( alias[1] );
				continue;
			}
			const direct = part.match( /^([A-Za-z_][A-Za-z0-9_]*)\b/u );
			if ( direct ) {
				names.add( direct[1] );
			}
		}
		importMatch = importRx.exec( topLevel );
	}
	return [ ...names ];
}

function buildComparator( name ) {
	if ( name === 'eq' ) {
		return ( left, right ) => String( left ) === String( right );
	}
	if ( name === '~' ) {
		return ( left, right ) => {
			if ( right && typeof right.test === 'function' ) {
				return right.test( String( left ) );
			}
			return false;
		};
	}
	return ( left, right ) => left == right;
}

function runSwitch( value, cmpName, cases, defaultBody ) {
	const cmp = buildComparator( cmpName );
	let runNext = false;
	for ( const section of cases ) {
		const matched = section.values.some( (item) => cmp( value, item ) );
		if ( matched || runNext ) {
			const result = section.body();
			runNext = result === true;
			if ( !runNext && result && typeof result === 'object' && result.__zuzu_return ) {
				return result;
			}
			if ( !runNext ) {
				return;
			}
		}
	}
	if ( defaultBody ) {
		const result = defaultBody();
		if ( result && typeof result === 'object' && result.__zuzu_return ) {
			return result;
		}
	}
}

function runMatch( left, right ) {
	if ( right && typeof right.test === 'function' ) {
		const flags = typeof right.flags === 'string' ? right.flags : '';
		const clone = new RegExp( right.source || operatorString( right ), flags );
		const input = operatorString( left );
		if ( flags.includes( 'g' ) ) {
			return [ ...input.matchAll( clone ) ];
		}
		const matched = input.match( clone );
		return matched || false;
	}
	const input = operatorString( left );
	const pattern = operatorRegexp( right );
	const matched = input.match( pattern );
	return matched || false;
}

function toArrayLike( value ) {
	if ( value instanceof ZuzuBag ) {
		return value.to_Array();
	}
	if ( isSetLike( value ) ) {
		return [ ...value ];
	}
	if ( Array.isArray( value ) ) {
		return value.slice();
	}
	if ( value && typeof value === 'object' ) {
		return Object.keys( value );
	}
	return [];
}

function contains( collection, item ) {
	collection = resolveWeakValue( collection );
	item = resolveWeakValue( item );
	if ( collection instanceof ZuzuBag ) {
		return collection.contains( item );
	}
	if ( isSetLike( collection ) ) {
		for ( const value of collection ) {
			if ( resolveWeakValue( value ) === item ) {
				return 1;
			}
		}
		return 0;
	}
	if ( Array.isArray( collection ) ) {
		return collection.some( (value) => resolveWeakValue( value ) === item ) ? 1 : 0;
	}
	if ( collection && typeof collection === 'object' ) {
		return Object.prototype.hasOwnProperty.call( collection, String( item ) ) ? 1 : 0;
	}
	return 0;
}

function makeLike( left, values ) {
	if ( left instanceof ZuzuBag ) {
		return new ZuzuBag( values );
	}
	if ( isSetLike( left ) ) {
		return new Set( values );
	}
	if ( Array.isArray( left ) ) {
		return [ ...new Set( values ) ];
	}
	if ( left && typeof left === 'object' ) {
		const out = {};
		for ( const key of values ) {
			out[String( key )] = true;
		}
		const desc = Object.create( null );
		desc.value = function _containsKey( key ) {
			return Object.prototype.hasOwnProperty.call( out, String( key ) ) ? 1 : 0;
		};
		desc.enumerable = false;
		Object.defineProperty( out, 'contains', desc );
		return out;
	}
	return values;
}

function collectionUnion( left, right ) {
	const merged = [ ...toArrayLike( left ), ...toArrayLike( right ) ];
	const deduped = [ ...new Set( merged ) ];
	return makeLike( left, deduped );
}

function collectionIntersection( left, right ) {
	const rightArr = toArrayLike( right );
	return makeLike( left, toArrayLike( left ).filter( (item) => rightArr.includes( item ) ) );
}

function collectionDifference( left, right ) {
	const rightArr = toArrayLike( right );
	return makeLike( left, toArrayLike( left ).filter( (item) => !rightArr.includes( item ) ) );
}

function collectionSubsetOf( left, right ) {
	const rightArr = toArrayLike( right );
	return toArrayLike( left ).every( (item) => rightArr.includes( item ) ) ? 1 : 0;
}

function collectionSupersetOf( left, right ) {
	return collectionSubsetOf( right, left );
}

function collectionEquivalentOf( left, right ) {
	return collectionSubsetOf( left, right ) && collectionSubsetOf( right, left ) ? 1 : 0;
}

function makeSet( values ) {
	const set = new Set( values );
	if ( typeof set.to_Iterator !== 'function' ) {
		const desc = Object.create( null );
		desc.value = function _toIterator() { return this.values(); };
		desc.enumerable = false;
		Object.defineProperty( set, 'to_Iterator', desc );
	}
	return set;
}

function makeBag( values ) {
	return new ZuzuBag( values );
}

function makePairList( entries = [] ) {
	return new PairList( { list: entries.map( (entry) => [ String( entry[0] ), entry[1] ] ) } );
}

function lengthOf( value ) {
	if ( value instanceof ZuzuBinary ) {
		return value.byteLength();
	}
	if ( value && value.bytes instanceof Uint8Array ) {
		return value.bytes.length;
	}
	if ( value instanceof PairList ) {
		return value.length();
	}
	if ( value instanceof ZuzuBag ) {
		return value.length();
	}
	if ( isSetLike( value ) ) {
		return value.size;
	}
	if ( typeof value === 'string' ) {
		return [ ...value ].length;
	}
	if ( Array.isArray( value ) ) {
		return value.length;
	}
	if ( value && typeof value === 'object' ) {
		return Object.keys( value ).length;
	}
	return 0;
}

function typeName( value ) {
	value = resolveWeakValue( value );
	if ( value == null ) {
		return 'Null';
	}
	if ( value instanceof ZuzuBinary ) {
		return 'BinaryString';
	}
	if ( value instanceof PairList ) {
		return 'PairList';
	}
	if ( value instanceof ZuzuBag ) {
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
	if ( value instanceof RegExp || Object.prototype.toString.call( value ) === '[object RegExp]' ) {
		return 'Regexp';
	}
	if ( typeof value === 'boolean' || Object.prototype.toString.call( value ) === '[object Boolean]' ) {
		return 'Boolean';
	}
	if ( typeof value === 'number' || Object.prototype.toString.call( value ) === '[object Number]' ) {
		return 'Number';
	}
	if ( typeof value === 'string' || Object.prototype.toString.call( value ) === '[object String]' ) {
		return 'String';
	}
	if ( typeof value === 'function' ) {
		const source = Function.prototype.toString.call( value );
		return /^\s*class\b/.test( source ) ? 'Class' : 'Function';
	}
	if ( value && value.constructor && value.constructor.name ) {
		const name = value.constructor.name;
		return name === 'Object' ? 'Dict' : name;
	}
	return 'Object';
}

function renderNumber( value ) {
	if ( Object.is( value, -0 ) ) {
		return '0';
	}
	return String( value );
}

function operatorString( value ) {
	value = resolveWeakValue( value );
	if ( value == null ) {
		return '';
	}
	if ( typeof value === 'string' || Object.prototype.toString.call( value ) === '[object String]' ) {
		return String( value );
	}
	if ( typeof value === 'number' || Object.prototype.toString.call( value ) === '[object Number]' ) {
		return renderNumber( Number( value ) );
	}
	if ( typeof value === 'boolean' || Object.prototype.toString.call( value ) === '[object Boolean]' ) {
		return value.valueOf() ? 'true' : 'false';
	}
	if ( value instanceof RegExp || Object.prototype.toString.call( value ) === '[object RegExp]' ) {
		return value.source || '';
	}
	if ( value instanceof ZuzuBinary ) {
		throw new Error( `TypeException: cannot coerce ${typeName( value )} to String` );
	}
	if (
		typeof value === 'function'
		|| value.__zuzu_method === true
		|| ( value.constructor && value.constructor.name === 'ZuzuMethod' )
	) {
		throw new Error( `TypeException: cannot coerce ${typeName( value )} to String` );
	}
	if ( value && typeof value.to_String === 'function' ) {
		return operatorString( value.to_String() );
	}
	throw new Error( `TypeException: cannot coerce ${typeName( value )} to String` );
}

function operatorRegexp( value ) {
	value = resolveWeakValue( value );
	if ( value instanceof RegExp || Object.prototype.toString.call( value ) === '[object RegExp]' ) {
		const flags = typeof value.flags === 'string' ? value.flags : '';
		return new RegExp( value.source || '', flags );
	}
	return new RegExp( operatorString( value ) );
}

module.exports = {
	collectTopLevelDeclarations,
	runSwitch,
	runMatch,
	toArrayLike,
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
	ZuzuWeakCell,
	isWeakCell,
	isWeakableValue,
	makeWeakValue,
	resolveWeakValue,
	retainValue,
	releaseValue,
	assignStrongValue,
	assignWeakValue,
	ZuzuBag,
	Pair,
	PairList,
	withArrayMethods,
};
