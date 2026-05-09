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

function _templateVar( values, name ) {
	if ( values[name] == null ) {
		return '';
	}
	return encodeURIComponent( _str( values[name] ) );
}

function _templateQuery( values, namesText ) {
	const names = String( namesText )
		.split( /\s*,\s*/u )
		.filter( Boolean );
	const parts = [];
	for ( const name of names ) {
		if ( values[name] == null ) {
			continue;
		}
		const key = encodeURIComponent( name );
		const val = encodeURIComponent( _str( values[name] ) );
		parts.push( `${key}=${val}` );
	}
	return parts.length > 0 ? `?${parts.join( '&' )}` : '';
}

function fill_template( template, values ) {
	const source = _str( template );
	const data = values && typeof values === 'object' && !Array.isArray( values )
		? values
		: {};
	return source
		.replace( /\{\?([^}]+)\}/gu, ( _, names ) => _templateQuery( data, names ) )
		.replace( /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/gu, ( _, name ) => _templateVar( data, name ) );
}

module.exports = {
	escape,
	unescape,
	parse,
	fill_template,
};
