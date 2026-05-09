'use strict';

let nodeSpawnSync;
let nodeSpawnLoaded = false;
let nodeFs;
let nodeHttps;
let nodeOs;
let nodePath;
let hostName = null;
const { Task, traceBlockingOperation } = require( '../task' );

function _nodeSpawnSync() {
	if ( nodeSpawnLoaded ) {
		return nodeSpawnSync;
	}
	nodeSpawnLoaded = true;
	if ( typeof require !== 'function' ) {
		nodeSpawnSync = null;
		return nodeSpawnSync;
	}
	try {
		nodeSpawnSync = require( 'node:child_process' ).spawnSync;
	}
	catch ( _err ) {
		nodeSpawnSync = null;
	}
	return nodeSpawnSync;
}

function _nodeModule( name ) {
	if ( typeof require !== 'function' ) {
		return null;
	}
	try {
		return require( name );
	}
	catch ( _err ) {
		return null;
	}
}

function _nodeFs() {
	nodeFs = nodeFs || _nodeModule( 'node:fs' );
	return nodeFs;
}

function _nodeHttps() {
	nodeHttps = nodeHttps || _nodeModule( 'node:https' );
	return nodeHttps;
}

function _nodeOs() {
	nodeOs = nodeOs || _nodeModule( 'node:os' );
	return nodeOs;
}

function _nodePath() {
	nodePath = nodePath || _nodeModule( 'node:path' );
	return nodePath;
}

function _toDict( value ) {
	if ( value == null ) {
		return {};
	}
	if ( value && Array.isArray( value.list ) ) {
		const out = {};
		for ( const pair of value.list ) {
			if ( Array.isArray( pair ) && pair.length >= 2 ) {
				out[String( pair[0] )] = pair[1];
			}
		}
		return out;
	}
	if ( typeof value !== 'object' || Array.isArray( value ) ) {
		return {};
	}
	return { ...value };
}

function _decorateDict( value ) {
	if ( value == null || typeof value !== 'object' || Array.isArray( value ) ) {
		return value;
	}
	if ( !Object.prototype.hasOwnProperty.call( value, 'get' ) ) {
		Object.defineProperty( value, 'get', {
			value( key, fallback = null ) {
				return Object.prototype.hasOwnProperty.call( this, String( key ) )
					? this[String( key )]
					: fallback;
			},
			enumerable: false,
			configurable: true,
			writable: true,
		} );
	}
	return value;
}

function _syncUnsupportedResponse( spec ) {
	return new Response( {
		status: 599,
		reason: 'Synchronous HTTP is unsupported on JS/Browser',
		url: _urlWithQuery( spec.url, spec.query ),
		content: '',
		headers: {},
		success: false,
	} );
}

function _urlWithQuery( url, query ) {
	const queryMap = _toDict( query );
	const keys = Object.keys( queryMap );
	if ( keys.length === 0 ) {
		return String( url );
	}
	const usp = new URLSearchParams();
	for ( const key of keys.sort() ) {
		usp.set( key, queryMap[key] == null ? '' : String( queryMap[key] ) );
	}
	const base = String( url );
	return `${base}${base.includes( '?' ) ? '&' : '?'}${usp.toString()}`;
}

function _maxRedirect( spec, uaConfig ) {
	const value = spec.max_redirect ?? uaConfig.max_redirect ?? 10;
	const number = Number( value );
	return Number.isFinite( number ) && number >= 0 ? Math.floor( number ) : 10;
}

function _writeDownload( spec, content ) {
	if ( spec.download_to === undefined ) {
		return;
	}
	const fs = _nodeFs();
	if ( !fs ) {
		throw new Error( 'Exception: download_to filesystem support is unavailable' );
	}
	fs.writeFileSync( String( spec.download_to ), content, 'utf8' );
}

class CookieJar {
	constructor() {
		this._cookies = new Map();
	}

	add( url, setCookie ) {
		this._cookies.set( String( url ?? '' ), String( setCookie ?? '' ) );
		return this;
	}

	cookie_header( url ) {
		return this._cookies.get( String( url ?? '' ) ) ?? null;
	}

	clear() {
		this._cookies.clear();
		return this;
	}
}

class Response {
	constructor( payload ) {
		this._payload = payload;
	}

	status() { return this._payload.status; }
	reason() { return this._payload.reason; }
	url() { return this._payload.url; }
	content() { return this._payload.content; }
	headers() { return { ...this._payload.headers }; }
	header( name ) {
		return this._payload.headers[String( name ).toLowerCase()] ?? null;
	}
	success() { return this._payload.success ? 1 : 0; }
	json() { return JSON.parse( this._payload.content || '' ); }
	expect_success() {
		if ( this.success() ) {
			return this;
		}
		throw new Error( `HTTP request failed with status ${this.status()}` );
	}
	to_Dict() {
		return _decorateDict( {
			status: this.status(),
			reason: this.reason(),
			url: this.url(),
			content: this.content(),
			headers: _decorateDict( this.headers() ),
			success: this.success(),
		} );
	}
}

class Request {
	constructor( method, url ) {
		this._spec = {
			method: String( method || 'GET' ).toUpperCase(),
			url: String( url || '' ),
			headers: {},
		};
	}

	method( value ) { this._spec.method = String( value ).toUpperCase(); return this; }
	url( value ) { this._spec.url = String( value ); return this; }
	header( name, value ) { this._spec.headers[String( name ).toLowerCase()] = String( value ); return this; }
	headers( value ) {
		for ( const [ key, item ] of Object.entries( _toDict( value ) ) ) {
			this.header( key, item );
		}
		return this;
	}
	query( value ) { this._spec.query = _toDict( value ); return this; }
	body( value ) { this._spec.body = value == null ? '' : String( value ); return this; }
	json( value ) {
		this._spec.json = value;
		this._spec.headers['content-type'] = this._spec.headers['content-type'] || 'application/json';
		return this;
	}
	auth_bearer( token ) { return this.header( 'authorization', `Bearer ${token}` ); }
	timeout( value ) { this._spec.timeout = Number( value ); return this; }
	retries( value ) { this._spec.retries = Number( value ); return this; }
	max_redirect( value ) { this._spec.max_redirect = Number( value ); return this; }
	download_to( value ) { this._spec.download_to = String( value ); return this; }
	upload_from( value ) { this._spec.upload_from = String( value ); return this; }
	tls_identity( value ) { this._spec.tls_identity = value ?? null; return this; }
	multipart( value ) { this._spec.multipart = _toDict( value ); return this; }
	send( ua ) {
		if ( !( ua instanceof UserAgent ) ) {
			throw new Error( 'Request.send expects a UserAgent' );
		}
		return ua.send( this );
	}

	send_async( ua ) {
		if ( !( ua instanceof UserAgent ) ) {
			throw new Error( 'Request.send_async expects a UserAgent' );
		}
		return ua.send_async( this );
	}
}

function _derToPem( label, der ) {
	const bytes = der instanceof Uint8Array
		? der
		: der && der.bytes instanceof Uint8Array
			? der.bytes
			: Uint8Array.from( der || [] );
	const base64 = Buffer.from( bytes ).toString( 'base64' );
	const lines = base64.match( /.{1,64}/gu ) || [];
	return `-----BEGIN ${label}-----\n${lines.join( '\n' )}\n-----END ${label}-----\n`;
}

function _certificatePem( value, label ) {
	if ( value == null ) {
		return '';
	}
	if ( typeof value === 'string' ) {
		if ( !value.includes( '-----BEGIN CERTIFICATE-----' ) ) {
			throw new Error( `${label} expects PEM certificate text` );
		}
		return value;
	}
	if ( value && value.__secureCertificate ) {
		return _derToPem( 'CERTIFICATE', value.__secureCertificate.der );
	}
	throw new Error( `TypeException: ${label} expects Certificate, String PEM, or Array` );
}

function _caPem( value, label ) {
	if ( value == null ) {
		return null;
	}
	if ( Array.isArray( value ) ) {
		return value.map( ( item ) => _certificatePem( item, label ) ).join( '' );
	}
	return _certificatePem( value, label );
}

function _tlsPolicy( spec, uaConfig ) {
	const config = _toDict( uaConfig );
	const policy = {
		tls_identity: Object.prototype.hasOwnProperty.call( spec, 'tls_identity' )
			? spec.tls_identity
			: config.tls_identity ?? null,
		tls_ca: config.tls_ca ?? null,
		tls_verify: Object.prototype.hasOwnProperty.call( config, 'tls_verify' )
			? Boolean( config.tls_verify )
			: true,
		tls_server_name: config.tls_server_name ?? null,
		tls_min_version: config.tls_min_version ?? null,
		tls_ciphers: config.tls_ciphers ?? null,
	};
	policy.active = Boolean(
		policy.tls_identity
		|| policy.tls_ca
		|| policy.tls_verify === false
		|| policy.tls_server_name
		|| policy.tls_min_version
		|| policy.tls_ciphers
	);
	return policy;
}

function _assertBrowserTlsSupported( policy ) {
	if ( hostName === 'browser' && policy.active ) {
		throw new Error(
			'std/net/http TLS client configuration is not supported on JS/Browser'
		);
	}
}

function _identityState( identity, label ) {
	if ( !identity || !identity.__secureTlsIdentity ) {
		throw new Error( `TypeException: ${label} expects TlsIdentity` );
	}
	return identity.__secureTlsIdentity;
}

function _tlsMinVersion( value ) {
	if ( value == null ) {
		return undefined;
	}
	const text = String( value ).toLowerCase();
	if ( text === 'tls1.2' ) {
		return 'TLSv1.2';
	}
	if ( text === 'tls1.3' ) {
		return 'TLSv1.3';
	}
	throw new Error( "std/net/http tls_min_version must be 'tls1.2' or 'tls1.3'" );
}

function _writeTempFile( content, files ) {
	const fs = _nodeFs();
	const os = _nodeOs();
	const path = _nodePath();
	if ( !fs || !os || !path ) {
		throw new Error( 'Exception: temporary TLS file support is unavailable' );
	}
	const dir = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-http-tls-' ) );
	const file = path.join( dir, 'material.pem' );
	fs.writeFileSync( file, content );
	files.push( file, dir );
	return file;
}

function _cleanupTempFiles( files ) {
	const fs = _nodeFs();
	if ( !fs ) {
		return;
	}
	for ( const file of files ) {
		try {
			if ( fs.statSync( file ).isDirectory() ) {
				fs.rmdirSync( file );
			}
			else {
				fs.unlinkSync( file );
			}
		}
		catch ( _err ) {}
	}
}

function _curlRequest( spec, uaConfig ) {
	const spawnSync = _nodeSpawnSync();
	if ( !spawnSync ) {
		throw new Error( 'Exception: curl transport is unavailable' );
	}
	const policy = _tlsPolicy( spec, uaConfig );
	if ( policy.tls_server_name ) {
		throw new Error(
			'std/net/http tls_server_name is not supported by the synchronous JS/Node HTTP backend'
		);
	}
	const method = String( spec.method || 'GET' ).toUpperCase();
	const target = _urlWithQuery( spec.url, spec.query );
	const args = [
		'-sS',
		'-i',
		'-L',
		'--max-redirs',
		String( _maxRedirect( spec, uaConfig ) ),
		'-w',
		'\n\n__ZUZU_EFFECTIVE_URL:%{url_effective}',
		'-X',
		method,
		target,
	];
	const tempFiles = [];
	const headers = { ..._toDict( uaConfig.default_headers ), ..._toDict( spec.headers ) };
	if ( uaConfig.agent ) {
		headers['user-agent'] = String( uaConfig.agent );
	}
	if ( uaConfig.cookie_jar && typeof uaConfig.cookie_jar.cookie_header === 'function' ) {
		const cookie = uaConfig.cookie_jar.cookie_header( target );
		if ( cookie ) {
			headers.cookie = cookie;
		}
	}
	for ( const [ name, value ] of Object.entries( headers ) ) {
		args.push( '-H', `${name}: ${String( value )}` );
	}
	if ( spec.json !== undefined ) {
		args.push( '--data', JSON.stringify( spec.json ) );
	}
	else if ( spec.upload_from !== undefined ) {
		args.push( '--data-binary', `@${String( spec.upload_from )}` );
	}
	else if ( spec.body !== undefined ) {
		args.push( '--data', String( spec.body ) );
	}
	if ( policy.tls_identity ) {
		const identity = _identityState(
			policy.tls_identity,
			'std/net/http tls_identity'
		);
		args.push( '--cert', _writeTempFile(
			identity.certPem,
			tempFiles,
		) );
		args.push( '--key', _writeTempFile( identity.keyPem, tempFiles ) );
	}
	if ( policy.tls_ca ) {
		args.push( '--cacert', _writeTempFile(
			_caPem( policy.tls_ca, 'std/net/http tls_ca' ),
			tempFiles,
		) );
	}
	if ( policy.tls_verify === false ) {
		args.push( '--insecure' );
	}
	if ( policy.tls_min_version ) {
		args.push(
			String( policy.tls_min_version ).toLowerCase() === 'tls1.3'
				? '--tlsv1.3'
				: '--tlsv1.2'
		);
	}
	if ( policy.tls_ciphers ) {
		args.push( '--ciphers', String( policy.tls_ciphers ) );
	}
	let spawned;
	try {
		spawned = spawnSync( 'curl', args, { encoding: 'utf8' } );
	}
	finally {
		_cleanupTempFiles( tempFiles );
	}
	if ( spawned.error ) {
		throw spawned.error;
	}
	let raw = String( spawned.stdout || '' );
	let effectiveUrl = target;
	const effectiveMatch = raw.match( /\n\n__ZUZU_EFFECTIVE_URL:([^\n\r]*)\s*$/u );
	if ( effectiveMatch ) {
		effectiveUrl = effectiveMatch[1] || target;
		raw = raw.slice( 0, effectiveMatch.index );
	}
	const split = raw.split( /\r?\n\r?\n/u );
	let headerIndex = 0;
	for ( let i = 0; i < split.length; i++ ) {
		if ( /^HTTP\/\d(?:\.\d)?\s+\d+/u.test( split[i] || '' ) ) {
			headerIndex = i;
		}
	}
	const headerText = split[headerIndex] || '';
	const body = split.slice( headerIndex + 1 ).join( '\n\n' );
	const headerLines = headerText.split( /\r?\n/u );
	const statusLine = headerLines.shift() || 'HTTP/1.1 599 Request Failed';
	const statusMatch = statusLine.match( /^HTTP\/\d(?:\.\d)?\s+(\d+)(?:\s+(.*))?$/u );
	const status = statusMatch ? Number( statusMatch[1] ) : 599;
	const reason = statusMatch ? ( statusMatch[2] || '' ) : 'Request Failed';
	const outHeaders = {};
	for ( const line of headerLines ) {
		const idx = line.indexOf( ':' );
		if ( idx < 0 ) {
			continue;
		}
		outHeaders[line.slice( 0, idx ).trim().toLowerCase()] = line.slice( idx + 1 ).trim();
	}
	if ( outHeaders['set-cookie'] && uaConfig.cookie_jar && typeof uaConfig.cookie_jar.add === 'function' ) {
		uaConfig.cookie_jar.add( effectiveUrl, outHeaders['set-cookie'] );
	}
	_writeDownload( spec, body );
	return new Response( {
		status,
		reason,
		url: effectiveUrl,
		content: body,
		headers: outHeaders,
		success: status >= 200 && status < 300,
	} );
}

function _nodeHttpsRequest( spec, uaConfig, signal = null ) {
	const https = _nodeHttps();
	if ( !https ) {
		throw new Error( 'Exception: https transport is unavailable' );
	}
	const policy = _tlsPolicy( spec, uaConfig );
	const method = String( spec.method || 'GET' ).toUpperCase();
	const target = _urlWithQuery( spec.url, spec.query );
	const url = new URL( target );
	if ( url.protocol !== 'https:' ) {
		throw new Error( 'std/net/http TLS configuration requires an https URL' );
	}
	const headers = { ..._toDict( uaConfig.default_headers ), ..._toDict( spec.headers ) };
	if ( uaConfig.agent ) {
		headers['user-agent'] = String( uaConfig.agent );
	}
	if ( uaConfig.cookie_jar && typeof uaConfig.cookie_jar.cookie_header === 'function' ) {
		const cookie = uaConfig.cookie_jar.cookie_header( target );
		if ( cookie ) {
			headers.cookie = cookie;
		}
	}
	const body = spec.json !== undefined
		? JSON.stringify( spec.json )
		: spec.body !== undefined
			? String( spec.body )
			: null;
	if ( spec.json !== undefined ) {
		headers['content-type'] = headers['content-type'] || 'application/json';
	}
	const options = {
		method,
		headers,
		rejectUnauthorized: policy.tls_verify !== false,
	};
	if ( policy.tls_identity ) {
		const identity = _identityState(
			policy.tls_identity,
			'std/net/http tls_identity'
		);
		options.cert = identity.chainPem || identity.certPem;
		options.key = identity.keyPem;
		if ( identity.password ) {
			options.passphrase = identity.password;
		}
	}
	if ( policy.tls_ca ) {
		options.ca = _caPem( policy.tls_ca, 'std/net/http tls_ca' );
	}
	if ( policy.tls_server_name ) {
		options.servername = String( policy.tls_server_name );
	}
	if ( policy.tls_min_version ) {
		options.minVersion = _tlsMinVersion( policy.tls_min_version );
	}
	if ( policy.tls_ciphers ) {
		options.ciphers = String( policy.tls_ciphers );
	}
	return new Promise( ( resolve, reject ) => {
		const req = https.request( url, options, ( response ) => {
			const chunks = [];
			response.on( 'data', ( chunk ) => chunks.push( chunk ) );
			response.on( 'end', () => {
				const outHeaders = {};
				for ( const [ name, value ] of Object.entries( response.headers ) ) {
					outHeaders[String( name ).toLowerCase()] = Array.isArray( value )
						? value.join( ', ' )
						: String( value ?? '' );
				}
				if (
					outHeaders['set-cookie']
					&& uaConfig.cookie_jar
					&& typeof uaConfig.cookie_jar.add === 'function'
				) {
					uaConfig.cookie_jar.add( target, outHeaders['set-cookie'] );
				}
				const content = Buffer.concat( chunks ).toString( 'utf8' );
				_writeDownload( spec, content );
				resolve( new Response( {
					status: response.statusCode || 599,
					reason: response.statusMessage || '',
					url: target,
					content,
					headers: outHeaders,
					success: ( response.statusCode || 0 ) >= 200
						&& ( response.statusCode || 0 ) < 300,
				} ) );
			} );
		} );
		req.on( 'error', reject );
		if ( signal ) {
			signal.addEventListener( 'abort', () => req.destroy(
				new Error( 'HTTP request cancelled' )
			) );
		}
		if ( body != null ) {
			req.write( body );
		}
		req.end();
	} );
}

async function _fetchRequest( spec, uaConfig, signal = null ) {
	if ( typeof fetch !== 'function' ) {
		throw new Error( 'Exception: fetch transport is unavailable' );
	}
	const method = String( spec.method || 'GET' ).toUpperCase();
	const target = _urlWithQuery( spec.url, spec.query );
	const headers = { ..._toDict( uaConfig.default_headers ), ..._toDict( spec.headers ) };
	if ( uaConfig.agent ) {
		headers['user-agent'] = String( uaConfig.agent );
	}
	if ( uaConfig.cookie_jar && typeof uaConfig.cookie_jar.cookie_header === 'function' ) {
		const cookie = uaConfig.cookie_jar.cookie_header( target );
		if ( cookie ) {
			headers.cookie = cookie;
		}
	}
	const fetchOptions = {
		method,
		headers,
	};
	if ( signal ) {
		fetchOptions.signal = signal;
	}
	if ( spec.json !== undefined ) {
		headers['content-type'] = headers['content-type'] || 'application/json';
		fetchOptions.body = JSON.stringify( spec.json );
	}
	else if ( spec.body !== undefined ) {
		fetchOptions.body = String( spec.body );
	}
	const response = await fetch( target, {
		...fetchOptions,
		redirect: _maxRedirect( spec, uaConfig ) === 0 ? 'manual' : 'follow',
	} );
	const outHeaders = {};
	if ( response.headers && typeof response.headers.forEach === 'function' ) {
		response.headers.forEach( ( value, key ) => {
			outHeaders[String( key ).toLowerCase()] = String( value );
		} );
	}
	if ( outHeaders['set-cookie'] && uaConfig.cookie_jar && typeof uaConfig.cookie_jar.add === 'function' ) {
		uaConfig.cookie_jar.add( target, outHeaders['set-cookie'] );
	}
	const content = await response.text();
	_writeDownload( spec, content );
	return new Response( {
		status: response.status,
		reason: response.statusText || '',
		url: response.url || target,
		content,
		headers: outHeaders,
		success: response.ok,
	} );
}

async function _asyncRequest( spec, uaConfig, signal = null ) {
	try {
		const policy = _tlsPolicy( spec, uaConfig );
		_assertBrowserTlsSupported( policy );
		if ( hostName !== 'browser' && policy.active ) {
			return await _nodeHttpsRequest( spec, uaConfig, signal );
		}
		if ( typeof fetch === 'function' ) {
			return await _fetchRequest( spec, uaConfig, signal );
		}
		return _curlRequest( spec, uaConfig );
	}
	catch ( err ) {
		return new Response( {
			status: 599,
			reason: err && err.message ? err.message : String( err || 'Request Failed' ),
			url: _urlWithQuery( spec.url, spec.query ),
			content: '',
			headers: {},
			success: false,
		} );
	}
}

class UserAgent {
	constructor( options = {}, named = {} ) {
		this._config = { ..._toDict( options ), ..._toDict( named ) };
	}

	build_request( method, url ) {
		return new Request( method, url );
	}

	send( request ) {
		if ( !( request instanceof Request ) ) {
			throw new Error( 'UserAgent.send expects a Request' );
		}
		traceBlockingOperation( 'std/net/http UserAgent.send' );
		const policy = _tlsPolicy( request._spec, this._config );
		_assertBrowserTlsSupported( policy );
		if ( hostName === 'browser' ) {
			return _syncUnsupportedResponse( request._spec );
		}
		if ( !_nodeSpawnSync() && typeof fetch === 'function' ) {
			return _fetchRequest( request._spec, this._config );
		}
		return _curlRequest( request._spec, this._config );
	}

	send_async( request ) {
		if ( !( request instanceof Request ) ) {
			throw new Error( 'UserAgent.send_async expects a Request' );
		}
		const timeoutSeconds = Number(
			request._spec.timeout
			|| this._config.timeout
			|| 0
		);
		const controller = typeof AbortController === 'function'
			? new AbortController()
			: null;
		let timer = null;
		const task = new Task(
			() => _asyncRequest(
				request._spec,
				this._config,
				controller ? controller.signal : null,
			),
			{
				name: 'http.request',
				cancel() {
					if ( timer != null ) {
						clearTimeout( timer );
						timer = null;
					}
					if ( controller ) {
						controller.abort();
					}
				},
			},
		);
		if ( timeoutSeconds > 0 && controller ) {
			timer = setTimeout( () => {
				controller.abort();
			}, Math.floor( timeoutSeconds * 1000 ) );
			task.finally( () => {
				if ( timer != null ) {
					clearTimeout( timer );
					timer = null;
				}
			} );
		}
		return task;
	}

	request( method, url, data, headers ) {
		const req = this.build_request( method, url );
		if ( method === 'POST' || method === 'PUT' || method === 'PATCH' ) {
			if ( data !== undefined ) {
				req.body( data );
			}
			if ( headers !== undefined ) {
				req.headers( headers );
			}
		}
		else {
			if ( data !== undefined ) {
				req.headers( data );
			}
		}
		return this.send( req );
	}

	request_async( method, url, data, headers ) {
		const req = this.build_request( method, url );
		if ( method === 'POST' || method === 'PUT' || method === 'PATCH' ) {
			if ( data !== undefined ) {
				req.body( data );
			}
			if ( headers !== undefined ) {
				req.headers( headers );
			}
		}
		else if ( data !== undefined ) {
			req.headers( data );
		}
		return this.send_async( req );
	}

	get( url, headers ) { return this.request( 'GET', url, headers ); }
	get_async( url, headers ) { return this.request_async( 'GET', url, headers ); }
	head( url, headers ) { return this.request( 'HEAD', url, headers ); }
	head_async( url, headers ) { return this.request_async( 'HEAD', url, headers ); }
	delete( url, headers ) { return this.request( 'DELETE', url, headers ); }
	delete_async( url, headers ) { return this.request_async( 'DELETE', url, headers ); }
	options( url, headers ) { return this.request( 'OPTIONS', url, headers ); }
	options_async( url, headers ) { return this.request_async( 'OPTIONS', url, headers ); }
	post( url, data, headers ) { return this.request( 'POST', url, data, headers ); }
	post_async( url, data, headers ) { return this.request_async( 'POST', url, data, headers ); }
	put( url, data, headers ) { return this.request( 'PUT', url, data, headers ); }
	put_async( url, data, headers ) { return this.request_async( 'PUT', url, data, headers ); }
	patch( url, data, headers ) { return this.request( 'PATCH', url, data, headers ); }
	patch_async( url, data, headers ) { return this.request_async( 'PATCH', url, data, headers ); }
}

const api = {
	CookieJar,
	Request,
	Response,
	UserAgent,
};

Object.defineProperty( api, '__zuzu_set_runtime_policy', {
	value( policy = {} ) {
		hostName = policy.host_name || null;
	},
	enumerable: false,
} );

module.exports = api;
