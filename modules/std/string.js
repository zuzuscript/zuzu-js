'use strict';

const { BinaryString } = require( '../../lib/runtime-helpers' );

function toStringValue( value ) {
	if ( value instanceof RegExp ) {
		return value.source;
	}
	if ( value && typeof value.to_String === 'function' ) {
		return String( value.to_String() );
	}
	if ( value instanceof Error ) {
		return value.message || value.name || String( value );
	}
	return value == null ? '' : String( value );
}

function isRegexLike( value ) {
	if ( value == null ) {
		return false;
	}
	if ( value instanceof RegExp ) {
		return true;
	}
	return Object.prototype.toString.call( value ) === '[object RegExp]';
}

function index( text, needle, start = 0 ) {
	const haystack = [ ...toStringValue( text ) ];
	const find = [ ...toStringValue( needle ) ];
	const offset = Math.max( 0, Math.trunc( Number( start ?? 0 ) ) );
	if ( find.length === 0 ) {
		return Math.min( offset, haystack.length );
	}
	for ( let i = offset; i <= haystack.length - find.length; i++ ) {
		let matched = true;
		for ( let j = 0; j < find.length; j++ ) {
			if ( haystack[i + j] !== find[j] ) {
				matched = false;
				break;
			}
		}
		if ( matched ) {
			return i;
		}
	}
	return -1;
}

function rindex( text, needle, start = null ) {
	const haystack = [ ...toStringValue( text ) ];
	const find = [ ...toStringValue( needle ) ];
	if ( start == null ) {
		start = haystack.length - find.length;
	}
	else {
		start = Math.trunc( Number( start ) );
	}
	if ( find.length === 0 ) {
		return Math.min( Math.max( 0, start ), haystack.length );
	}
	start = Math.min( Math.max( 0, start ), haystack.length - find.length );
	for ( let i = start; i >= 0; i-- ) {
		let matched = true;
		for ( let j = 0; j < find.length; j++ ) {
			if ( haystack[i + j] !== find[j] ) {
				matched = false;
				break;
			}
		}
		if ( matched ) {
			return i;
		}
	}
	return -1;
}

function contains( text, needle ) {
	return index( text, needle ) >= 0;
}

function integerValue( value, label ) {
	const number = Number( value ?? 0 );
	if ( !Number.isInteger( number ) ) {
		throw new Error( `${label} expects an integer` );
	}
	return number;
}

function chr( codepoint ) {
	if ( arguments.length !== 1 ) {
		throw new Error( 'chr() expects one argument' );
	}
	const value = integerValue( codepoint, 'chr()' );
	if ( value < 0 || value > 0x10FFFF ) {
		throw new Error( 'chr() expects a Unicode code point in 0..0x10FFFF' );
	}
	if ( value >= 0xD800 && value <= 0xDFFF ) {
		throw new Error( 'chr() rejects surrogate code points' );
	}
	return String.fromCodePoint( value );
}

function ord( text, index = 0 ) {
	if ( arguments.length < 1 || arguments.length > 2 ) {
		throw new Error( 'ord() expects one or two arguments' );
	}
	const chars = [ ...toStringValue( text ) ];
	const offset = integerValue( index, 'ord()' );
	if ( offset < 0 || offset >= chars.length ) {
		throw new Error( 'ord() index out of range' );
	}
	return chars[offset].codePointAt( 0 );
}

function substr( text, offset, length = null ) {
	const chars = [ ...toStringValue( text ) ];
	const from = Number( offset ?? 0 );
	if ( length == null ) {
		return chars.slice( from ).join( '' );
	}
	return chars.slice( from, from + Number( length ) ).join( '' );
}

function pattern_to_regexp( pattern, caseInsensitive = false ) {
	return new RegExp( String( pattern ?? '' ), caseInsensitive ? 'i' : '' );
}

const REGEXP_META_CHARS = new Set( [
	'\\',
	'/',
	'^',
	'$',
	'.',
	'|',
	'?',
	'*',
	'+',
	'(',
	')',
	'[',
	']',
	'{',
	'}',
	'"',
	"'",
] );

function quotemeta( text ) {
	return [ ...toStringValue( text ) ]
		.map( (ch) => REGEXP_META_CHARS.has( ch ) ? `\\${ch}` : ch )
		.join( '' );
}

function normalizePattern( pattern, flags = '' ) {
	if ( isRegexLike( pattern ) ) {
		const mergedFlags = [ ...( pattern.flags || '' ), ...( flags || '' ) ];
		const uniqFlags = [ ...new Set( mergedFlags ) ].join( '' );
		return new RegExp( pattern.source, uniqFlags );
	}
	return new RegExp( String( pattern ?? '' ), flags );
}

function search( text, pattern, flags = '' ) {
	const match = toStringValue( text ).match( normalizePattern( pattern, flags ) );
	return match ? match[0] : null;
}

function matches( text, pattern, flags = '' ) {
	return normalizePattern( pattern, flags ).test( toStringValue( text ) );
}

function replace( text, pattern, replacement, flags = '' ) {
	return toStringValue( text ).replace( normalizePattern( pattern, flags ), toStringValue( replacement ) );
}

function formatWidth( text, width, flags, zeroPad = false ) {
	if ( width == null ) {
		return text;
	}
	const target = Number( width );
	const byteLength = new TextEncoder().encode( text ).length;
	if ( byteLength >= target ) {
		return text;
	}
	const padChar = zeroPad && !flags.includes( '-' ) ? '0' : ' ';
	const fill = padChar.repeat( target - byteLength );
	if ( flags.includes( '-' ) ) {
		return `${text}${fill}`;
	}
	if ( padChar === '0' && /^[+-]/u.test( text ) ) {
		return `${text[0]}${fill}${text.slice( 1 )}`;
	}
	return `${fill}${text}`;
}

function formatInteger( value, radix, uppercase = false, signed = true ) {
	const number = Number( value ?? 0 );
	const integer = Math.trunc( number );
	const negative = integer < 0;
	const magnitude = signed ? Math.abs( integer ) : integer >>> 0;
	let rendered = magnitude.toString( radix );
	if ( uppercase ) {
		rendered = rendered.toUpperCase();
	}
	return signed && negative ? `-${rendered}` : rendered;
}

function signPrefix( rendered, number, flags ) {
	if ( rendered.startsWith( '-' ) ) {
		return rendered;
	}
	if ( number < 0 ) {
		return `-${rendered}`;
	}
	if ( flags.includes( '+' ) ) {
		return `+${rendered}`;
	}
	if ( flags.includes( ' ' ) ) {
		return ` ${rendered}`;
	}
	return rendered;
}

function normalizeExponent( rendered ) {
	return rendered.replace( /([eE][+-])(\d)$/u, '$10$2' );
}

function trimGeneralFloat( rendered ) {
	return rendered
		.replace( /(\.\d*?)0+(e[+-]?\d+)$/iu, '$1$2' )
		.replace( /\.e/iu, 'e' )
		.replace( /(\.\d*?)0+$/u, '$1' )
		.replace( /\.$/u, '' );
}

function formatFloat( number, precision, kind ) {
	const digits = precision == null ? 6 : Number( precision );
	if ( kind === 'f' ) {
		return number.toFixed( digits );
	}
	if ( kind === 'e' ) {
		return normalizeExponent( number.toExponential( digits ) );
	}
	if ( kind === 'E' ) {
		return normalizeExponent( number.toExponential( digits ).toUpperCase() );
	}
	const significant = precision == null ? 6 : Number( precision );
	const rendered = trimGeneralFloat( number.toPrecision( significant ) );
	return kind === 'G' ? rendered.toUpperCase() : rendered;
}

function sprint( format, ...args ) {
	let idx = 0;
	const source = toStringValue( format );
	return source.replace( /%([-+ 0#]*)([0-9]+)?(?:\.([0-9]+))?([sdiuoxXfeEgGc%])/gu, ( token, rawFlags, width, precision, kind ) => {
		if ( kind === '%' ) {
			return '%';
		}
		const value = args[idx++];
		const flags = rawFlags || '';
		let out = '';
		let zeroPad = false;
		if ( kind === 's' ) {
			out = toStringValue( value );
			if ( precision != null ) {
				out = [ ...out ].slice( 0, Number( precision ) ).join( '' );
			}
		}
		else if ( kind === 'd' || kind === 'i' ) {
			const number = Math.trunc( Number( value ?? 0 ) );
			out = signPrefix( String( Math.abs( number ) ), number, flags );
			if ( number < 0 ) {
				out = `-${Math.abs( number )}`;
			}
			zeroPad = flags.includes( '0' );
		}
		else if ( kind === 'u' ) {
			out = formatInteger( value, 10, false, false );
			zeroPad = flags.includes( '0' );
		}
		else if ( kind === 'x' || kind === 'X' ) {
			out = formatInteger( value, 16, kind === 'X', true );
			if ( flags.includes( '#' ) && !out.startsWith( '-' ) && Number( value ?? 0 ) !== 0 ) {
				out = `${kind === 'X' ? '0X' : '0x'}${out}`;
			}
			zeroPad = flags.includes( '0' );
		}
		else if ( kind === 'o' ) {
			out = formatInteger( value, 8, false, true );
			if ( flags.includes( '#' ) && !out.startsWith( '-' ) && !out.startsWith( '0' ) ) {
				out = `0${out}`;
			}
			zeroPad = flags.includes( '0' );
		}
		else if ( kind === 'f' || kind === 'e' || kind === 'E' || kind === 'g' || kind === 'G' ) {
			const number = Number( value ?? 0 );
			const negative = number < 0 || Object.is( number, -0 );
			out = formatFloat( Math.abs( number ), precision, kind );
			out = signPrefix( out, negative ? -1 : number, flags );
			zeroPad = flags.includes( '0' );
		}
		else if ( kind === 'c' ) {
			out = String.fromCodePoint( Number( value ?? 0 ) );
		}
		else {
			return token;
		}
		return formatWidth( out, width, flags, zeroPad );
	} );
}

function repeat( count, text, separator = null ) {
	if ( arguments.length < 2 || arguments.length > 3 ) {
		throw new Error( 'repeat() expects two or three arguments' );
	}
	const repetitions = Math.floor( Number( count ?? 0 ) );
	if ( repetitions < 0 ) {
		throw new Error( 'repeat() count cannot be negative' );
	}

	const textIsBinary = text instanceof BinaryString;
	const separatorIsBinary = separator instanceof BinaryString;
	if ( separator != null && textIsBinary !== separatorIsBinary ) {
		throw new Error( 'TypeException: repeat() cannot mix String and BinaryString values' );
	}

	if ( textIsBinary ) {
		const source = text.bytes;
		const sep = separator == null ? new Uint8Array( 0 ) : separator.bytes;
		const total = repetitions === 0
			? 0
			: source.length * repetitions + sep.length * ( repetitions - 1 );
		const out = new Uint8Array( total );
		let offset = 0;
		for ( let i = 0; i < repetitions; i++ ) {
			if ( i > 0 ) {
				out.set( sep, offset );
				offset += sep.length;
			}
			out.set( source, offset );
			offset += source.length;
		}
		return new BinaryString( out );
	}

	const value = toStringValue( text );
	const sep = separator == null ? '' : toStringValue( separator );
	return Array.from( { length: repetitions }, () => value ).join( sep );
}

function join( separator, values ) {
	const sep = toStringValue( separator );
	if ( Array.isArray( values ) ) {
		return values.map( (value) => toStringValue( value ) ).join( sep );
	}
	if ( values == null ) {
		return '';
	}
	if ( typeof values.to_Iterator === 'function' ) {
		const out = [];
		for ( const value of values.to_Iterator() ) {
			out.push( toStringValue( value ) );
		}
		return out.join( sep );
	}
	if ( typeof values.to_Array === 'function' ) {
		return join( sep, values.to_Array() );
	}
	if ( typeof values[Symbol.iterator] === 'function' ) {
		return Array.from( values, (value) => toStringValue( value ) ).join( sep );
	}
	return toStringValue( values );
}

function split( text, pattern ) {
	return toStringValue( text ).split( pattern );
}

function starts_with( text, prefix ) {
	return toStringValue( text ).startsWith( toStringValue( prefix ) );
}

function ends_with( text, suffix ) {
	return toStringValue( text ).endsWith( toStringValue( suffix ) );
}

function trim( text ) {
	return toStringValue( text ).trim();
}

function pad( text, width, ch = ' ', side = 'right' ) {
	const src = toStringValue( text );
	const padChar = toStringValue( ch || ' ' );
	const target = Number( width ?? 0 );
	if ( src.length >= target ) {
		return src;
	}
	const fill = padChar.repeat( target - src.length );
	return side === 'left' ? `${fill}${src}` : `${src}${fill}`;
}

function chomp( text ) {
	return toStringValue( text ).replace( /\r?\n$/u, '' );
}

function words( text ) {
	return toStringValue( text )
		.replace( /([a-z0-9])([A-Z])/gu, '$1 $2' )
		.replace( /[_\-]+/gu, ' ' )
		.trim()
		.split( /\s+/u )
		.filter( Boolean );
}

function title( text ) { return words( text ).map( (w) => `${w[0].toUpperCase()}${w.slice( 1 ).toLowerCase()}` ).join( ' ' ); }
function snake( text ) { return words( text ).map( (w) => w.toLowerCase() ).join( '_' ); }
function kebab( text ) { return words( text ).map( (w) => w.toLowerCase() ).join( '-' ); }
function camel( text ) {
	const ws = words( text ).map( (w) => w.toLowerCase() );
	return ws.map( (w, i) => ( i === 0 ? w : `${w[0].toUpperCase()}${w.slice( 1 )}` ) ).join( '' );
}

function to_binary( value ) {
	if ( typeof value !== 'string' && !( value instanceof String ) ) {
		const type = value == null
			? 'Null'
			: ( value && value.bytes instanceof Uint8Array ) ? 'BinaryString' : typeof value;
		throw new Error( `TypeException: to_binary expects String, got ${type}` );
	}
	return new BinaryString( new TextEncoder().encode( String( value ) ) );
}

function to_string( value ) {
	if ( !( value && value.bytes instanceof Uint8Array ) ) {
		throw new Error( 'TypeException: to_string expects BinaryString' );
	}
	return new TextDecoder( 'utf-8', { fatal: true } ).decode( value.bytes );
}

module.exports = {
	camel,
	chomp,
	chr,
	contains,
	ends_with,
	index,
	join,
	kebab,
	matches,
	ord,
	pad,
	pattern_to_regexp,
	quotemeta,
	repeat,
	rindex,
	replace,
	search,
	snake,
	split,
	starts_with,
	sprint,
	substr,
	title,
	to_binary,
	to_string,
	trim,
};
