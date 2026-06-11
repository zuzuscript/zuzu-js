'use strict';

function _str( value, fallback = '' ) {
	if ( value == null ) {
		return fallback;
	}
	return String( value );
}


function _dict( source = {} ) {
	const out = { ...source };
	Object.defineProperties( out, {
		has: {
			value( key ) {
				return Object.prototype.hasOwnProperty.call( out, String( key ) ) ? 1 : 0;
			},
			enumerable: false,
		},
		exists: {
			value( key ) {
				return out.has( key );
			},
			enumerable: false,
		},
		get: {
			value( key, fallback = null ) {
				return out.has( key ) ? out[String( key )] : fallback;
			},
			enumerable: false,
		},
	} );
	return out;
}

function escape( value ) {
	return encodeURIComponent( _str( value ) );
}

function unescape( value ) {
	return decodeURIComponent( _str( value ) );
}

function parse( value ) {
	const urlText = _str( value );
	const parsed = new URL( urlText, 'http://localhost' );
	const out = _dict( {
		url: parsed.href,
		scheme: parsed.protocol.replace( /:$/u, '' ) || null,
		authority: parsed.host || null,
		userinfo: null,
		host: parsed.hostname || null,
		port: parsed.port || null,
		path: parsed.pathname || '',
		query: parsed.search.replace( /^\?/u, '' ) || null,
		fragment: parsed.hash.replace( /^#/u, '' ) || null,
		query_params: _dict( {} ),
	} );
	if ( parsed.username || parsed.password ) {
		out.userinfo = parsed.username;
		if ( parsed.password ) {
			out.userinfo += `:${parsed.password}`;
		}
	}
	for ( const [ key, item ] of parsed.searchParams.entries() ) {
		out.query_params[key] = item;
	}
	return out;
}

const { StdUriTemplate } = require( '@std-uritemplate/std-uritemplate' );

function _templateValue( value ) {
	if ( value == null ) {
		return null;
	}
	if ( Array.isArray( value ) ) {
		return value.map( (item) => _str( item ) );
	}
	if ( typeof value === 'boolean' ) {
		return value ? 'true' : 'false';
	}
	if ( typeof value === 'object' && !( value.bytes instanceof Uint8Array ) ) {
		// Associative values: keys sorted for deterministic expansion.
		const out = {};
		for ( const key of Object.keys( value ).sort() ) {
			out[key] = _str( value[key] );
		}
		return out;
	}
	return _str( value );
}

function fill_template( template, values ) {
	const source = _str( template );
	const data = {};
	if ( values && typeof values === 'object' && !Array.isArray( values ) ) {
		for ( const key of Object.keys( values ) ) {
			const converted = _templateValue( values[key] );
			if ( converted != null ) {
				data[key] = converted;
			}
		}
	}
	try {
		return StdUriTemplate.expand( source, data );
	}
	catch ( err ) {
		throw new Error( `Exception: invalid URL template: ${source}` );
	}
}

module.exports = {
	escape,
	unescape,
	parse,
	fill_template,
};
