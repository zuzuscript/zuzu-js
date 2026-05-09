'use strict';

const { BinaryString } = require( '../../../lib/runtime-helpers' );

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DECODE = (() => {
	const out = Object.create( null );
	for ( let i = 0; i < ALPHABET.length; i++ ) {
		out[ALPHABET[i]] = i;
	}
	return out;
})();

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

function encodeBytes( bytes ) {
	let out = '';
	for ( let i = 0; i < bytes.length; i += 3 ) {
		const b0 = bytes[i];
		const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
		const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;

		out += ALPHABET[b0 >> 2];
		out += ALPHABET[( ( b0 & 0x03 ) << 4 ) | ( b1 >> 4 )];
		out += i + 1 < bytes.length
			? ALPHABET[( ( b1 & 0x0f ) << 2 ) | ( b2 >> 6 )]
			: '=';
		out += i + 2 < bytes.length
			? ALPHABET[b2 & 0x3f]
			: '=';
	}
	return out;
}

function decodeText( value ) {
	const clean = String( value ).replace( /\s+/gu, '' );
	if ( clean.length % 4 !== 0 ) {
		throw new Error( 'Exception: invalid Base64 length' );
	}

	let padding = 0;
	if ( clean.endsWith( '==' ) ) {
		padding = 2;
	}
	else if ( clean.endsWith( '=' ) ) {
		padding = 1;
	}

	const bytes = [];
	for ( let i = 0; i < clean.length; i += 4 ) {
		const chunk = clean.slice( i, i + 4 );
		const values = [];
		for ( let j = 0; j < 4; j++ ) {
			const ch = chunk[j];
			if ( ch === '=' ) {
				values.push( 0 );
				continue;
			}
			if ( DECODE[ch] == null ) {
				throw new Error( `Exception: invalid Base64 character '${ch}'` );
			}
			values.push( DECODE[ch] );
		}
		const triple = (
			( values[0] << 18 )
			| ( values[1] << 12 )
			| ( values[2] << 6 )
			| values[3]
		);
		bytes.push( ( triple >> 16 ) & 0xff );
		if ( chunk[2] !== '=' ) {
			bytes.push( ( triple >> 8 ) & 0xff );
		}
		if ( chunk[3] !== '=' ) {
			bytes.push( triple & 0xff );
		}
	}

	const firstPadding = clean.indexOf( '=' );
	if ( firstPadding >= 0 && firstPadding !== clean.length - padding ) {
		throw new Error( 'Exception: invalid Base64 padding' );
	}

	return new Uint8Array( bytes );
}

function encode( value ) {
	if ( !( value && value.bytes instanceof Uint8Array ) ) {
		throw new Error( `TypeException: encode expects BinaryString, got ${typeName( value )}` );
	}
	return encodeBytes( value.bytes );
}

function decode( value ) {
	if ( typeof value !== 'string' ) {
		throw new Error( `TypeException: decode expects String, got ${typeName( value )}` );
	}
	return new BinaryString( decodeText( value ) );
}

function encode_urlsafe( value ) {
	return encode( value )
		.replace( /\+/gu, '-' )
		.replace( /\//gu, '_' )
		.replace( /=+$/gu, '' );
}

function decode_urlsafe( value ) {
	if ( typeof value !== 'string' ) {
		throw new Error( `TypeException: decode expects String, got ${typeName( value )}` );
	}
	let normalized = value
		.replace( /-/gu, '+' )
		.replace( /_/gu, '/' );
	const mod = normalized.length % 4;
	if ( mod !== 0 ) {
		normalized += '='.repeat( 4 - mod );
	}
	return decode( normalized );
}

module.exports = {
	decode,
	decode_urlsafe,
	encode,
	encode_urlsafe,
};
