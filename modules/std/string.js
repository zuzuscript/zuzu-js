'use strict';

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

function sprint( format, ...args ) {
	let idx = 0;
	return toStringValue( format ).replace( /%([0-9]+)?(?:\.([0-9]+))?([sdfc])/gu, ( _token, width, precision, kind ) => {
		const value = args[idx++];
		let out = '';
		if ( kind === 'd' ) {
			out = String( Math.trunc( Number( value ?? 0 ) ) );
		}
		else if ( kind === 'f' ) {
			const num = Number( value ?? 0 );
			out = precision != null ? num.toFixed( Number( precision ) ) : String( num );
		}
		else if ( kind === 'c' ) {
			out = String.fromCharCode( Number( value ?? 0 ) );
		}
		else {
			out = toStringValue( value );
		}
		if ( width != null ) {
			const target = Number( width );
			if ( out.length < target ) {
				out = `${' '.repeat( target - out.length )}${out}`;
			}
		}
		return out;
	} );
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
	rindex,
	replace,
	search,
	snake,
	split,
	starts_with,
	sprint,
	substr,
	title,
	trim,
};
