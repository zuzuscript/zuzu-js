'use strict';

// std/string/encode: character-encoding conversions between String and
// BinaryString. UTF-16 and UTF-32 encode to big-endian without a BOM (the
// deterministic canonical form shared by all runtimes); decode honours a
// leading BOM and otherwise assumes big-endian.

const { BinaryString } = require( '../../../lib/runtime-helpers' );

function typeName( value ) {
	if ( value == null ) {
		return 'Null';
	}
	if ( typeof value === 'string' || value instanceof String ) {
		return 'String';
	}
	if ( value.bytes instanceof Uint8Array ) {
		return 'BinaryString';
	}
	return value.constructor && value.constructor.name ? value.constructor.name : typeof value;
}

function canonicalEncoding( name ) {
	const upper = String( name == null ? 'UTF-8' : name ).toUpperCase().replace( /\s+/g, '' );
	if ( upper === 'UTF-8' || upper === 'UTF8' ) {
		return 'utf8';
	}
	if ( upper === 'UTF-16' || upper === 'UTF16' || upper === 'UTF-16BE' ) {
		return 'utf16';
	}
	if ( upper === 'UTF-32' || upper === 'UTF32' || upper === 'UTF-32BE' ) {
		return 'utf32';
	}
	if (
		upper === 'ISO-8859-1' || upper === 'ISO8859-1'
		|| upper === 'LATIN-1' || upper === 'LATIN1' || upper === 'LATIN'
	) {
		return 'latin1';
	}
	return null;
}

function codePoints( text ) {
	return Array.from( text, (ch) => ch.codePointAt( 0 ) );
}

function encode( value, encoding ) {
	if ( typeName( value ) !== 'String' ) {
		throw new Error( `TypeException: encode expects String, got ${typeName( value )}` );
	}
	const text = String( value );
	const codec = canonicalEncoding( encoding );
	if ( codec === 'utf8' ) {
		return new BinaryString( new TextEncoder().encode( text ) );
	}
	if ( codec === 'utf16' ) {
		const out = [];
		for ( let i = 0; i < text.length; i++ ) {
			const unit = text.charCodeAt( i );
			out.push( ( unit >> 8 ) & 0xff, unit & 0xff );
		}
		return new BinaryString( out );
	}
	if ( codec === 'utf32' ) {
		const out = [];
		for ( const point of codePoints( text ) ) {
			out.push(
				( point >>> 24 ) & 0xff,
				( point >>> 16 ) & 0xff,
				( point >>> 8 ) & 0xff,
				point & 0xff,
			);
		}
		return new BinaryString( out );
	}
	if ( codec === 'latin1' ) {
		const out = [];
		for ( const point of codePoints( text ) ) {
			if ( point > 0xff ) {
				const hex = point.toString( 16 ).toUpperCase().padStart( 4, '0' );
				throw new Error( `Exception: Character U+${hex} cannot be encoded as ISO-8859-1` );
			}
			out.push( point );
		}
		return new BinaryString( out );
	}
	throw new Error( `Exception: Unsupported encoding: ${encoding}` );
}

function decode( value, encoding ) {
	if ( typeName( value ) !== 'BinaryString' ) {
		throw new Error( `TypeException: decode expects BinaryString, got ${typeName( value )}` );
	}
	let bytes = value.bytes;
	const codec = canonicalEncoding( encoding );
	if ( codec === 'utf8' ) {
		try {
			return new TextDecoder( 'utf-8', { fatal: true } ).decode( bytes );
		}
		catch ( _err ) {
			throw new Error( 'Exception: Invalid UTF-8 in BinaryString' );
		}
	}
	if ( codec === 'utf16' ) {
		let bigEndian = true;
		if ( bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff ) {
			bytes = bytes.subarray( 2 );
		}
		else if ( bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe ) {
			bigEndian = false;
			bytes = bytes.subarray( 2 );
		}
		if ( bytes.length % 2 !== 0 ) {
			throw new Error( 'Exception: UTF-16 input length must be a multiple of 2 bytes' );
		}
		const units = [];
		for ( let i = 0; i < bytes.length; i += 2 ) {
			units.push( bigEndian
				? ( bytes[i] << 8 ) | bytes[i + 1]
				: ( bytes[i + 1] << 8 ) | bytes[i] );
		}
		let out = '';
		for ( let i = 0; i < units.length; i++ ) {
			const unit = units[i];
			if ( unit >= 0xd800 && unit <= 0xdbff ) {
				const next = units[i + 1];
				if ( next == null || next < 0xdc00 || next > 0xdfff ) {
					throw new Error( 'Exception: Invalid UTF-16 in BinaryString' );
				}
				out += String.fromCharCode( unit, next );
				i++;
				continue;
			}
			if ( unit >= 0xdc00 && unit <= 0xdfff ) {
				throw new Error( 'Exception: Invalid UTF-16 in BinaryString' );
			}
			out += String.fromCharCode( unit );
		}
		return out;
	}
	if ( codec === 'utf32' ) {
		let bigEndian = true;
		if (
			bytes.length >= 4
			&& bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0xfe && bytes[3] === 0xff
		) {
			bytes = bytes.subarray( 4 );
		}
		else if (
			bytes.length >= 4
			&& bytes[0] === 0xff && bytes[1] === 0xfe && bytes[2] === 0x00 && bytes[3] === 0x00
		) {
			bigEndian = false;
			bytes = bytes.subarray( 4 );
		}
		if ( bytes.length % 4 !== 0 ) {
			throw new Error( 'Exception: UTF-32 input length must be a multiple of 4 bytes' );
		}
		let out = '';
		for ( let i = 0; i < bytes.length; i += 4 ) {
			const point = bigEndian
				? ( bytes[i] * 0x1000000 ) + ( bytes[i + 1] << 16 ) + ( bytes[i + 2] << 8 ) + bytes[i + 3]
				: ( bytes[i + 3] * 0x1000000 ) + ( bytes[i + 2] << 16 ) + ( bytes[i + 1] << 8 ) + bytes[i];
			if ( point > 0x10ffff || ( point >= 0xd800 && point <= 0xdfff ) ) {
				throw new Error( 'Exception: Invalid UTF-32 in BinaryString' );
			}
			out += String.fromCodePoint( point );
		}
		return out;
	}
	if ( codec === 'latin1' ) {
		let out = '';
		for ( const byte of bytes ) {
			out += String.fromCharCode( byte );
		}
		return out;
	}
	throw new Error( `Exception: Unsupported encoding: ${encoding}` );
}

module.exports = {
	encode,
	decode,
	ENCODING_UTF8: 'UTF-8',
	ENCODING_UTF16: 'UTF-16',
	ENCODING_UTF32: 'UTF-32',
	ENCODING_LATIN: 'ISO-8859-1',
};
