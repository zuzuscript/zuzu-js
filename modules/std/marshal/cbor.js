'use strict';

const { BinaryString, ZuzuBinary } = require( '../../../lib/runtime-helpers' );

const MAX_SAFE_INTEGER = 9_007_199_254_740_991;
const SELF_DESCRIBED_TAG = 55_799;

const PUSH_BYTES_CHUNK = 16_384;

class CborTextString {
	constructor( value ) {
		this.value = String( value ?? '' );
	}
}

class CborByteString {
	constructor( value ) {
		this.value = toUint8Array( value );
	}
}

class CborTagged {
	constructor( tagNumberValue, value ) {
		this.tagNumber = Number( tagNumberValue );
		this.value = value;
	}
}

function textString( value ) {
	return new CborTextString( value );
}

function byteString( value ) {
	return new CborByteString( value );
}

function tag( tagNumberValue, value ) {
	return new CborTagged( tagNumberValue, value );
}

function isTextString( value ) {
	return value instanceof CborTextString;
}

function isByteString( value ) {
	return value instanceof CborByteString;
}

function isTagged( value ) {
	return value instanceof CborTagged;
}

function textValue( value ) {
	if ( !isTextString( value ) ) {
		throw new Error( 'Not a CBOR text string' );
	}
	return value.value;
}

function bytesValue( value ) {
	if ( !isByteString( value ) ) {
		throw new Error( 'Not a CBOR byte string' );
	}
	return new Uint8Array( value.value );
}

function tagNumber( value ) {
	if ( !isTagged( value ) ) {
		throw new Error( 'Not a CBOR tag' );
	}
	return value.tagNumber;
}

function tagValue( value ) {
	if ( !isTagged( value ) ) {
		throw new Error( 'Not a CBOR tag' );
	}
	return value.value;
}

function encodeOne( item ) {
	const out = [];
	encodeItem( item, out );
	return new BinaryString( Uint8Array.from( out ) );
}

function decodeOne( input ) {
	const bytes = toUint8Array( input );
	const decoded = decodeItem( bytes, 0, true );
	if ( decoded.offset !== bytes.length ) {
		throw cborError( 'trailing bytes after item' );
	}
	return decoded.value;
}

function validateProfile( input ) {
	const bytes = toUint8Array( input );
	const offset = scanItem( bytes, 0, true );
	if ( offset !== bytes.length ) {
		throw cborError( 'trailing bytes after item' );
	}
	return true;
}

function encodeItem( item, out ) {
	if ( item == null ) {
		out.push( 0xf6 );
		return;
	}
	if ( item === false ) {
		out.push( 0xf4 );
		return;
	}
	if ( item === true ) {
		out.push( 0xf5 );
		return;
	}
	if ( typeof item === 'number' ) {
		encodeNumber( item, out );
		return;
	}
	if ( typeof item === 'string' || item instanceof CborTextString ) {
		const text = item instanceof CborTextString ? item.value : item;
		const bytes = new TextEncoder().encode( text );
		encodeUnsigned( 3, bytes.length, out );
		pushBytes( out, bytes );
		return;
	}
	if ( item instanceof CborByteString ) {
		encodeUnsigned( 2, item.value.length, out );
		pushBytes( out, item.value );
		return;
	}
	if ( item instanceof CborTagged ) {
		if ( item.tagNumber !== SELF_DESCRIBED_TAG ) {
			throw cborError( `unsupported tag ${item.tagNumber}` );
		}
		encodeUnsigned( 6, item.tagNumber, out );
		encodeItem( item.value, out );
		return;
	}
	if ( item instanceof Uint8Array || item instanceof ZuzuBinary ) {
		const bytes = toUint8Array( item );
		encodeUnsigned( 2, bytes.length, out );
		pushBytes( out, bytes );
		return;
	}
	if ( Array.isArray( item ) ) {
		encodeUnsigned( 4, item.length, out );
		for ( const value of item ) {
			encodeItem( value, out );
		}
		return;
	}
	if ( item instanceof Map ) {
		encodeUnsigned( 5, item.size, out );
		for ( const [ key, value ] of item.entries() ) {
			encodeItem( key, out );
			encodeItem( value, out );
		}
		return;
	}
	if ( typeof item === 'object' ) {
		const entries = Object.entries( item );
		encodeUnsigned( 5, entries.length, out );
		for ( const [ key, value ] of entries ) {
			encodeItem( new CborTextString( key ), out );
			encodeItem( value, out );
		}
		return;
	}
	throw cborError( `unsupported value type ${typeof item}` );
}

function encodeNumber( value, out ) {
	if ( !Number.isFinite( value ) ) {
		throw cborError( Number.isNaN( value ) ? 'NaN is invalid' : 'infinite float is invalid' );
	}
	if (
		!Object.is( value, -0 )
		&& Number.isInteger( value )
		&& Math.abs( value ) <= MAX_SAFE_INTEGER
	) {
		if ( value >= 0 ) {
			encodeUnsigned( 0, value, out );
		}
		else {
			encodeUnsigned( 1, -1 - value, out );
		}
		return;
	}
	out.push( 0xfb );
	const buffer = new ArrayBuffer( 8 );
	new DataView( buffer ).setFloat64( 0, value, false );
	pushBytes( out, new Uint8Array( buffer ) );
}

function encodeUnsigned( major, value, out ) {
	if ( !Number.isSafeInteger( value ) || value < 0 ) {
		throw cborError( 'integer is outside supported range' );
	}
	const prefix = major << 5;
	if ( value <= 23 ) {
		out.push( prefix | value );
	}
	else if ( value <= 0xff ) {
		out.push( prefix | 24, value );
	}
	else if ( value <= 0xffff ) {
		out.push( prefix | 25, value >> 8, value & 0xff );
	}
	else if ( value <= 0xffffffff ) {
		out.push(
			prefix | 26,
			( value >>> 24 ) & 0xff,
			( value >>> 16 ) & 0xff,
			( value >>> 8 ) & 0xff,
			value & 0xff
		);
	}
	else {
		out.push( prefix | 27 );
		const high = Math.floor( value / 0x100000000 );
		const low = value >>> 0;
		out.push(
			( high >>> 24 ) & 0xff,
			( high >>> 16 ) & 0xff,
			( high >>> 8 ) & 0xff,
			high & 0xff,
			( low >>> 24 ) & 0xff,
			( low >>> 16 ) & 0xff,
			( low >>> 8 ) & 0xff,
			low & 0xff
		);
	}
}

function decodeItem( bytes, offset, topLevel ) {
	requireAvailable( bytes, offset, 1, 'initial byte' );
	const initial = bytes[offset];
	const major = initial >> 5;
	const ai = initial & 0x1f;
	offset++;
	if ( ai === 31 ) {
		throw cborError( 'indefinite-length item' );
	}
	if ( ai >= 28 && ai <= 30 ) {
		throw cborError( 'reserved additional information' );
	}
	if ( major === 7 ) {
		return decodeSimpleOrFloat( bytes, offset, ai );
	}
	const argument = readArgument( bytes, offset, ai );
	const value = argument.value;
	offset = argument.offset;
	switch ( major ) {
		case 0:
			assertUnsignedNumberRange( value );
			return { value, offset };
		case 1:
			assertNegativeNumberRange( value );
			return { value: -1 - value, offset };
		case 2:
			requireAvailable( bytes, offset, value, 'byte string payload' );
			return {
				value: new CborByteString( bytes.subarray( offset, offset + value ) ),
				offset: offset + value,
			};
		case 3: {
			requireAvailable( bytes, offset, value, 'text string payload' );
			const text = new TextDecoder( 'utf-8', { fatal: true } )
				.decode( bytes.subarray( offset, offset + value ) );
			return { value: new CborTextString( text ), offset: offset + value };
		}
		case 4: {
			const values = [];
			for ( let i = 0; i < value; i++ ) {
				const item = decodeItem( bytes, offset, false );
				values.push( item.value );
				offset = item.offset;
			}
			return { value: values, offset };
		}
		case 5: {
			const map = new Map();
			for ( let i = 0; i < value; i++ ) {
				const key = decodeItem( bytes, offset, false );
				const mapValue = decodeItem( bytes, key.offset, false );
				map.set( key.value, mapValue.value );
				offset = mapValue.offset;
			}
			return { value: map, offset };
		}
		case 6: {
			if ( !topLevel || value !== SELF_DESCRIBED_TAG ) {
				throw cborError( `unsupported tag ${value}` );
			}
			const inner = decodeItem( bytes, offset, false );
			return {
				value: new CborTagged( value, inner.value ),
				offset: inner.offset,
			};
		}
		default:
			throw cborError( 'unsupported major type' );
	}
}

function scanItem( bytes, offset, topLevel ) {
	return decodeItem( bytes, offset, topLevel ).offset;
}

function decodeSimpleOrFloat( bytes, offset, ai ) {
	if ( ai === 20 ) {
		return { value: false, offset };
	}
	if ( ai === 21 ) {
		return { value: true, offset };
	}
	if ( ai === 22 ) {
		return { value: null, offset };
	}
	if ( ai === 25 ) {
		throw cborError( 'half-precision float is invalid' );
	}
	if ( ai === 26 ) {
		throw cborError( 'single-precision float is invalid' );
	}
	if ( ai === 27 ) {
		requireAvailable( bytes, offset, 8, 'binary64 float' );
		const value = new DataView(
			bytes.buffer,
			bytes.byteOffset + offset,
			8
		).getFloat64( 0, false );
		if ( Number.isNaN( value ) ) {
			throw cborError( 'NaN is invalid' );
		}
		if ( !Number.isFinite( value ) ) {
			throw cborError( 'infinite float is invalid' );
		}
		return { value, offset: offset + 8 };
	}
	throw cborError( 'unsupported simple value' );
}

function readArgument( bytes, offset, ai ) {
	if ( ai <= 23 ) {
		return { value: ai, offset };
	}
	if ( ai === 24 ) {
		requireAvailable( bytes, offset, 1, 'uint8 argument' );
		const value = bytes[offset];
		assertShortestArgument( value, 24 );
		return { value, offset: offset + 1 };
	}
	if ( ai === 25 ) {
		requireAvailable( bytes, offset, 2, 'uint16 argument' );
		const value = ( bytes[offset] << 8 ) | bytes[offset + 1];
		assertShortestArgument( value, 256 );
		return { value, offset: offset + 2 };
	}
	if ( ai === 26 ) {
		requireAvailable( bytes, offset, 4, 'uint32 argument' );
		const value = (
			( bytes[offset] * 0x1000000 )
			+ ( bytes[offset + 1] << 16 )
			+ ( bytes[offset + 2] << 8 )
			+ bytes[offset + 3]
		);
		assertShortestArgument( value, 65_536 );
		return { value, offset: offset + 4 };
	}
	if ( ai === 27 ) {
		requireAvailable( bytes, offset, 8, 'uint64 argument' );
		const high = (
			( bytes[offset] * 0x1000000 )
			+ ( bytes[offset + 1] << 16 )
			+ ( bytes[offset + 2] << 8 )
			+ bytes[offset + 3]
		);
		const low = (
			( bytes[offset + 4] * 0x1000000 )
			+ ( bytes[offset + 5] << 16 )
			+ ( bytes[offset + 6] << 8 )
			+ bytes[offset + 7]
		);
		const value = ( high * 0x100000000 ) + low;
		assertShortestArgument( value, 4_294_967_296 );
		return { value, offset: offset + 8 };
	}
	throw cborError( 'unsupported additional information' );
}

function assertShortestArgument( value, minimum ) {
	if ( value < minimum ) {
		throw cborError( 'non-shortest integer encoding' );
	}
}

function assertUnsignedNumberRange( value ) {
	if ( value > MAX_SAFE_INTEGER ) {
		throw cborError( 'integer is outside Zuzu Number range' );
	}
}

function assertNegativeNumberRange( value ) {
	if ( value >= MAX_SAFE_INTEGER ) {
		throw cborError( 'integer is outside Zuzu Number range' );
	}
}

function requireAvailable( bytes, offset, length, context ) {
	if ( offset + length > bytes.length ) {
		throw cborError( `incomplete ${context}` );
	}
}

function pushBytes( out, bytes ) {
	for ( let offset = 0; offset < bytes.length; offset += PUSH_BYTES_CHUNK ) {
		out.push( ...bytes.subarray( offset, offset + PUSH_BYTES_CHUNK ) );
	}
}

function toUint8Array( value ) {
	if ( value instanceof ZuzuBinary ) {
		return new Uint8Array( value.bytes );
	}
	if ( value instanceof Uint8Array ) {
		return new Uint8Array( value );
	}
	if ( Array.isArray( value ) ) {
		return Uint8Array.from( value.map( (item) => Number( item ) & 0xff ) );
	}
	if ( value && value.buffer instanceof ArrayBuffer ) {
		return new Uint8Array( value.buffer, value.byteOffset || 0, value.byteLength );
	}
	throw new Error( 'TypeException: CBOR adapter expects BinaryString or Uint8Array bytes' );
}

function cborError( message ) {
	return new Error( `CBOR profile error: ${message}` );
}

module.exports = {
	CborTextString,
	CborByteString,
	CborTagged,
	SELF_DESCRIBED_TAG,
	byteString,
	bytesValue,
	decodeOne,
	encodeOne,
	isByteString,
	isTagged,
	isTextString,
	tag,
	tagNumber,
	tagValue,
	textString,
	textValue,
	validateProfile,
};
