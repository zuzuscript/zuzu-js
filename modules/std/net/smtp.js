'use strict';

const { Task } = require( '../task' );
const { BinaryString } = require( '../../../lib/runtime-helpers' );
const { PairList } = require( '../../../lib/collections' );

let runtimePolicy = {};

const SENDMAIL_PATHS = [
	'/usr/sbin/sendmail',
	'/usr/lib/sendmail',
	'/sbin/sendmail',
	'/usr/bin/sendmail',
];

function nodeModule( name ) {
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

function isBrowser() {
	return runtimePolicy.host_name === 'browser';
}

function typeName( value ) {
	if ( value == null ) {
		return 'Null';
	}
	if ( value instanceof BinaryString ) {
		return 'BinaryString';
	}
	if ( value instanceof PairList ) {
		return 'PairList';
	}
	if ( Array.isArray( value ) ) {
		return 'Array';
	}
	if ( typeof value === 'string' ) {
		return 'String';
	}
	if ( typeof value === 'boolean' ) {
		return 'Boolean';
	}
	if ( typeof value === 'number' ) {
		return 'Number';
	}
	if ( value.constructor && value.constructor.name ) {
		return value.constructor.name === 'Object' ? 'Dict' : value.constructor.name;
	}
	return typeof value;
}

function asDict( value ) {
	if ( value == null ) {
		return {};
	}
	if ( value instanceof PairList ) {
		const out = {};
		for ( const [ key, item ] of value.list ) {
			out[String( key )] = item;
		}
		return out;
	}
	if ( typeof value !== 'object' || Array.isArray( value ) || value instanceof BinaryString ) {
		return {};
	}
	return { ...value };
}

function boolOption( value, fallback = false ) {
	if ( value == null ) {
		return fallback;
	}
	return Boolean( value );
}

function stringArray( value, label ) {
	if ( value == null ) {
		return [];
	}
	if ( !Array.isArray( value ) ) {
		throw new Error( `mail.invalid_address: ${label} expects Array, got ${typeName( value )}` );
	}
	return value.map( (item) => String( item ?? '' ) );
}

function validateSendmailArgs( args ) {
	for ( const arg of args ) {
		if (
			arg === '--read-recipients'
			|| ( /^-[^-]/u.test( arg ) && /^-[A-Za-z]*t[A-Za-z]*$/u.test( arg ) )
		) {
			throw new Error(
				'mail.unsupported: sendmail_args must not enable header-derived recipients'
			);
		}
	}
	return args;
}

function rejectUnsupportedSecurityOptions( config ) {
	const auth = String( config.auth || '' ).toLowerCase();
	if ( auth && ![ 'plain', 'login', 'xoauth2' ].includes( auth ) ) {
		throw new Error( `mail.auth: unsupported SMTP auth mechanism '${auth}'` );
	}
	if (
		( config.username || config.password || auth )
		&& !config.tls
		&& !config.starttls
		&& !config.allow_insecure_auth
	) {
		throw new Error(
			'mail.auth: SMTP authentication without TLS requires allow_insecure_auth: true'
		);
	}
}

function normalizeConfig( raw = {} ) {
	const config = { ...raw };
	config.transport = config.transport == null
		? 'smtp'
		: String( config.transport ).toLowerCase();
	if ( config.transport !== 'smtp' && config.transport !== 'sendmail' ) {
		throw new Error( "mail.unsupported: transport must be 'smtp' or 'sendmail'" );
	}
	const submission = boolOption( config.submission, false );
	config.host = config.host == null ? 'localhost' : String( config.host );
	config.port = config.port == null
		? ( submission ? 587 : 25 )
		: Math.trunc( Number( config.port ) );
	config.timeout = Number( config.timeout ?? 30 );
	if ( !Number.isFinite( config.timeout ) || config.timeout <= 0 ) {
		config.timeout = 30;
	}
	config.tls = boolOption( config.tls, false );
	config.starttls = Object.prototype.hasOwnProperty.call( config, 'starttls' )
		? boolOption( config.starttls, false )
		: submission;
	config.tls_verify = boolOption( config.tls_verify, true );
	config.smtputf8 = boolOption( config.smtputf8, false );
	config.allow_insecure_auth = boolOption( config.allow_insecure_auth, false );
	config.reject_partial = boolOption( config.reject_partial, false );
	config.sendmail_path = config.sendmail_path == null
		? null
		: String( config.sendmail_path );
	config.sendmail_args = validateSendmailArgs(
		stringArray( config.sendmail_args, 'sendmail_args' )
	);
	for ( const key of [ 'username', 'password', 'auth', 'tls_server_name' ] ) {
		if ( config[key] != null ) {
			config[key] = String( config[key] );
		}
	}
	return config;
}

function mergeConfig( base, options ) {
	return normalizeConfig( { ...( base || {} ), ...asDict( options ) } );
}

function sendmailPathAvailable() {
	if ( isBrowser() || runtimePolicy.deny_proc ) {
		return null;
	}
	const fs = nodeModule( 'node:fs' );
	if ( !fs ) {
		return null;
	}
	for ( const candidate of SENDMAIL_PATHS ) {
		try {
			fs.accessSync( candidate, fs.constants.X_OK );
			return candidate;
		}
		catch ( _err ) {}
	}
	return null;
}

function capabilities() {
	const nodeNet = !isBrowser() && !runtimePolicy.deny_net && nodeModule( 'node:net' );
	const nodeTls = !isBrowser() && !runtimePolicy.deny_net && nodeModule( 'node:tls' );
	return {
		smtp: Boolean( nodeNet ),
		sendmail: Boolean( sendmailPathAvailable() ),
		tls: Boolean( nodeTls ),
		starttls: Boolean( nodeTls ),
		auth: nodeTls ? [ 'plain', 'login', 'xoauth2' ] : [],
		async: !isBrowser(),
	};
}

function validateAddress( value ) {
	const address = String( value ?? '' );
	if ( address === '' ) {
		throw new Error( 'mail.invalid_address: envelope address must not be empty' );
	}
	if ( /[\x00-\x1F\x7F]/u.test( address ) ) {
		throw new Error( 'mail.invalid_address: envelope address contains a control character' );
	}
	if ( /[<>]/u.test( address ) ) {
		throw new Error( 'mail.invalid_address: envelope address must not contain angle brackets' );
	}
	return address;
}

function recipientList( value ) {
	const recipients = Array.isArray( value ) ? value : [ value ];
	if ( recipients.length === 0 ) {
		throw new Error( 'mail.invalid_address: at least one envelope recipient is required' );
	}
	return recipients.map( validateAddress );
}

function validateEnvelopeAscii( config, addresses ) {
	if ( config.smtputf8 ) {
		return;
	}
	for ( const address of addresses ) {
		if ( /[^\x00-\x7F]/u.test( address ) ) {
			throw new Error(
				'mail.invalid_address: non-ASCII envelope addresses require smtputf8: true'
			);
		}
	}
}

function assertPairList( headers ) {
	if ( headers instanceof PairList ) {
		return headers.list;
	}
	throw new Error( `mail.invalid_headers: headers expects PairList, got ${typeName( headers )}` );
}

function assertBody( body ) {
	if ( body instanceof BinaryString ) {
		return Buffer.from( body.bytes );
	}
	throw new Error( `TypeException: Mailer.send body expects BinaryString, got ${typeName( body )}` );
}

function headerName( name ) {
	const text = String( name ?? '' );
	if ( text === '' ) {
		throw new Error( 'mail.invalid_headers: header name must not be empty' );
	}
	if ( !/^[!-9;-~]+$/u.test( text ) ) {
		throw new Error( `mail.invalid_headers: invalid header name '${text}'` );
	}
	return text;
}

function headerValueBytes( name, value ) {
	let bytes;
	if ( value instanceof BinaryString ) {
		bytes = Buffer.from( value.bytes );
	}
	else if ( typeof value === 'string' ) {
		bytes = Buffer.from( value, 'utf8' );
	}
	else {
		throw new Error(
			`mail.invalid_headers: header '${name}' expects String or BinaryString, got ${typeName( value )}`
		);
	}
	if ( bytes.includes( 13 ) || bytes.includes( 10 ) ) {
		throw new Error( `mail.invalid_headers: header '${name}' value must not contain CR or LF` );
	}
	return bytes;
}

function serializeMessage( headers, body ) {
	const pairs = assertPairList( headers );
	const chunks = [];
	let messageId = null;
	for ( const pair of pairs ) {
		const name = headerName( pair[0] );
		const value = headerValueBytes( name, pair[1] );
		chunks.push( Buffer.from( `${name}: `, 'ascii' ), value, Buffer.from( '\r\n', 'ascii' ) );
		if ( messageId == null && name.toLowerCase() === 'message-id' ) {
			messageId = value.toString( 'utf8' );
		}
	}
	chunks.push( Buffer.from( '\r\n', 'ascii' ), assertBody( body ) );
	return {
		message: Buffer.concat( chunks ),
		messageId,
	};
}

function dotStuff( message ) {
	const parts = [];
	let start = 0;
	if ( message[0] === 46 ) {
		parts.push( Buffer.from( '.', 'ascii' ) );
	}
	for ( let i = 0; i + 2 < message.length; i++ ) {
		if ( message[i] === 13 && message[i + 1] === 10 && message[i + 2] === 46 ) {
			parts.push( message.subarray( start, i + 2 ), Buffer.from( '.', 'ascii' ) );
			start = i + 2;
		}
	}
	parts.push( message.subarray( start ) );
	return Buffer.concat( parts );
}

function mailResult( payload ) {
	return new MailResult( payload );
}

function rejectUnsupportedSmtp( config ) {
	rejectUnsupportedSecurityOptions( config );
	if ( runtimePolicy.deny_net || isBrowser() ) {
		throw new Error( 'mail.unsupported: SMTP transport is unsupported in this runtime' );
	}
}

function sendmailCommand( config, from, recipients ) {
	if ( runtimePolicy.deny_proc || isBrowser() ) {
		throw new Error( 'mail.unsupported: sendmail transport is unsupported in this runtime' );
	}
	const path = config.sendmail_path || sendmailPathAvailable();
	if ( !path ) {
		throw new Error( 'mail.unsupported: sendmail transport is unavailable; configure sendmail_path' );
	}
	return {
		path,
		args: [
			...config.sendmail_args,
			'-i',
			'-f',
			from,
			...recipients,
		],
	};
}

function sendmailSync( config, from, recipients, message, messageId ) {
	const childProcess = nodeModule( 'node:child_process' );
	if ( !childProcess || typeof childProcess.spawnSync !== 'function' ) {
		throw new Error( 'mail.unsupported: sendmail process support is unavailable' );
	}
	const command = sendmailCommand( config, from, recipients );
	const spawned = childProcess.spawnSync( command.path, command.args, {
		input: message,
		maxBuffer: 1024 * 1024,
	} );
	if ( spawned.error ) {
		throw new Error( `mail.process: sendmail failed to start: ${spawned.error.message}` );
	}
	if ( spawned.status !== 0 ) {
		const stderr = Buffer.from( spawned.stderr || [] ).toString( 'utf8' ).slice( 0, 4096 );
		throw new Error(
			`mail.process: sendmail exited with status ${spawned.status}${stderr ? `: ${stderr}` : ''}`
		);
	}
	return {
		transport: 'sendmail',
		accepted: recipients.slice(),
		rejected: [],
		message_id: messageId,
		response: 'sendmail exit 0',
	};
}

function sendmailAsync( config, from, recipients, message, messageId ) {
	const childProcess = nodeModule( 'node:child_process' );
	if ( !childProcess || typeof childProcess.spawn !== 'function' ) {
		return Promise.reject(
			new Error( 'mail.unsupported: sendmail process support is unavailable' )
		);
	}
	const command = sendmailCommand( config, from, recipients );
	return new Promise( ( resolve, reject ) => {
		const child = childProcess.spawn( command.path, command.args, {
			stdio: [ 'pipe', 'ignore', 'pipe' ],
		} );
		let stderr = Buffer.alloc( 0 );
		child.on( 'error', (err) => {
			reject( new Error( `mail.process: sendmail failed to start: ${err.message}` ) );
		} );
		child.stderr.on( 'data', (chunk) => {
			if ( stderr.length < 4096 ) {
				stderr = Buffer.concat( [ stderr, Buffer.from( chunk ) ] ).subarray( 0, 4096 );
			}
		} );
		child.on( 'close', (code) => {
			if ( code !== 0 ) {
				const diag = stderr.toString( 'utf8' );
				reject( new Error(
					`mail.process: sendmail exited with status ${code}${diag ? `: ${diag}` : ''}`
				) );
				return;
			}
			resolve( {
				transport: 'sendmail',
				accepted: recipients.slice(),
				rejected: [],
				message_id: messageId,
				response: 'sendmail exit 0',
			} );
		} );
		child.stdin.end( message );
	} );
}

class SmtpSession {
	constructor( config ) {
		this.config = config;
		this.net = nodeModule( 'node:net' );
		this.tls = nodeModule( 'node:tls' );
		this.socket = null;
		this.buffer = '';
		this.waiters = [];
		this.currentLines = [];
		this.closedError = null;
	}

	connect() {
		if ( !this.net || ( this.config.tls && !this.tls ) ) {
			return Promise.reject( new Error( 'mail.unsupported: SMTP network support is unavailable' ) );
		}
		return new Promise( ( resolve, reject ) => {
			const connectOptions = {
				host: this.config.host,
				port: this.config.port,
			};
			const socket = this.config.tls
				? this.tls.connect( {
					...connectOptions,
					servername: this.config.tls_server_name || this.config.host,
					rejectUnauthorized: this.config.tls_verify !== false,
				} )
				: this.net.createConnection( connectOptions );
			this._attachSocket( socket );
			let connected = false;
			socket.on( this.config.tls ? 'secureConnect' : 'connect', () => {
				connected = true;
				resolve();
			} );
			socket.on( 'error', (err) => {
				if ( !connected ) {
					reject( err );
				}
				this._failPending( err );
			} );
		} );
	}

	_attachSocket( socket ) {
		this.socket = socket;
		socket.setTimeout( Math.floor( this.config.timeout * 1000 ) );
		socket.on( 'timeout', () => {
			const err = new Error( 'mail.timeout: SMTP command timed out' );
			this._failPending( err );
			socket.destroy( err );
		} );
		socket.on( 'close', () => {
			this._failPending(
				new Error( 'mail.connection: SMTP server closed the connection' )
			);
		} );
		socket.on( 'data', (chunk) => this._onData( chunk ) );
	}

	upgradeTls() {
		if ( !this.tls ) {
			return Promise.reject( new Error( 'mail.unsupported: SMTP TLS support is unavailable' ) );
		}
		const oldSocket = this.socket;
		oldSocket.removeAllListeners( 'data' );
		oldSocket.removeAllListeners( 'close' );
		oldSocket.removeAllListeners( 'timeout' );
		return new Promise( ( resolve, reject ) => {
			const tlsSocket = this.tls.connect( {
				socket: oldSocket,
				servername: this.config.tls_server_name || this.config.host,
				rejectUnauthorized: this.config.tls_verify !== false,
			} );
			this._attachSocket( tlsSocket );
			tlsSocket.once( 'secureConnect', resolve );
			tlsSocket.once( 'error', reject );
		} );
	}

	_onData( chunk ) {
		this.buffer += Buffer.from( chunk ).toString( 'latin1' );
		for (;;) {
			const match = this.buffer.match( /\r?\n/u );
			if ( !match ) {
				break;
			}
			const rawLine = this.buffer.slice( 0, match.index );
			this.buffer = this.buffer.slice( match.index + match[0].length );
			this.currentLines.push( rawLine );
			if ( /^\d{3} /u.test( rawLine ) || !/^\d{3}-/u.test( rawLine ) ) {
				const lines = this.currentLines;
				this.currentLines = [];
				const waiter = this.waiters.shift();
				if ( waiter ) {
					try {
						waiter.resolve( parseResponse( lines ) );
					}
					catch ( err ) {
						waiter.reject( err );
					}
				}
			}
		}
	}

	_failPending( err ) {
		if ( this.closedError ) {
			return;
		}
		this.closedError = err;
		const waiters = this.waiters.splice( 0 );
		this.currentLines = [];
		for ( const waiter of waiters ) {
			waiter.reject( err );
		}
	}

	readResponse() {
		return new Promise( ( resolve, reject ) => {
			if ( this.closedError ) {
				reject( this.closedError );
				return;
			}
			this.waiters.push( { resolve, reject } );
		} );
	}

	command( line ) {
		this.socket.write( `${line}\r\n`, 'ascii' );
		return this.readResponse();
	}

	writeData( message ) {
		this.socket.write( dotStuff( message ) );
		if ( message.length < 2 || message[message.length - 2] !== 13 || message[message.length - 1] !== 10 ) {
			this.socket.write( Buffer.from( '\r\n', 'ascii' ) );
		}
		this.socket.write( Buffer.from( '.\r\n', 'ascii' ) );
		return this.readResponse();
	}

	close() {
		if ( this.socket ) {
			this.socket.end();
		}
	}
}

function parseResponse( lines ) {
	const first = lines[0] || '';
	const match = first.match( /^(\d{3})/u );
	if ( !match ) {
		throw new Error( 'mail.connection: SMTP server returned an invalid response' );
	}
	return {
		code: Number( match[1] ),
		lines,
		text: lines.join( '\n' ),
	};
}

function expectCode( category, response, codes, context ) {
	if ( codes.includes( response.code ) ) {
		return;
	}
	throw new Error( `${category}: ${context} failed: ${response.text}` );
}

function extensionsFromResponse( response ) {
	const extensions = new Set();
	for ( const line of response.lines || [] ) {
		const match = line.match( /^\d{3}[- ](.+)$/u );
		if ( !match ) {
			continue;
		}
		const name = match[1].trim().split( /\s+/u )[0];
		if ( name ) {
			extensions.add( name.toUpperCase() );
		}
	}
	return extensions;
}

function authMechanismsFromResponse( response ) {
	const mechanisms = new Set();
	for ( const line of response.lines || [] ) {
		const match = line.match( /^\d{3}[- ]AUTH(?:\s+(.+))?$/iu );
		if ( !match ) {
			continue;
		}
		for ( const mechanism of ( match[1] || '' ).trim().split( /\s+/u ) ) {
			if ( mechanism ) {
				mechanisms.add( mechanism.toLowerCase() );
			}
		}
	}
	return mechanisms;
}

async function smtpAuthenticate( session, config, response ) {
	if ( !config.username && !config.password && !config.auth ) {
		return;
	}
	const username = config.username || '';
	const password = config.password || '';
	const advertised = authMechanismsFromResponse( response );
	let mechanism = String( config.auth || '' ).toLowerCase();
	if ( !mechanism ) {
		for ( const candidate of [ 'plain', 'login', 'xoauth2' ] ) {
			if ( advertised.has( candidate ) ) {
				mechanism = candidate;
				break;
			}
		}
		if ( !mechanism ) {
			mechanism = 'plain';
		}
	}
	if ( ![ 'plain', 'login', 'xoauth2' ].includes( mechanism ) ) {
		throw new Error( `mail.auth: unsupported SMTP auth mechanism '${mechanism}'` );
	}
	if ( advertised.size > 0 && !advertised.has( mechanism ) ) {
		throw new Error( `mail.auth: SMTP server did not advertise AUTH ${mechanism}` );
	}
	if ( mechanism === 'plain' ) {
		const token = Buffer.from( `\0${username}\0${password}`, 'utf8' ).toString( 'base64' );
		const authResponse = await session.command( `AUTH PLAIN ${token}` );
		expectCode( 'mail.auth', authResponse, [ 235 ], 'AUTH PLAIN' );
		return;
	}
	if ( mechanism === 'login' ) {
		let authResponse = await session.command( 'AUTH LOGIN' );
		expectCode( 'mail.auth', authResponse, [ 334 ], 'AUTH LOGIN' );
		authResponse = await session.command( Buffer.from( username, 'utf8' ).toString( 'base64' ) );
		expectCode( 'mail.auth', authResponse, [ 334 ], 'AUTH username' );
		authResponse = await session.command( Buffer.from( password, 'utf8' ).toString( 'base64' ) );
		expectCode( 'mail.auth', authResponse, [ 235 ], 'AUTH password' );
		return;
	}
	const xoauth2 = `user=${username}\x01auth=Bearer ${password}\x01\x01`;
	const token = Buffer.from( xoauth2, 'utf8' ).toString( 'base64' );
	const authResponse = await session.command( `AUTH XOAUTH2 ${token}` );
	expectCode( 'mail.auth', authResponse, [ 235 ], 'AUTH XOAUTH2' );
}

async function sendSmtpPayload( payload ) {
	const { config, from, recipients, messageBase64, messageId } = payload;
	const message = Buffer.from( messageBase64, 'base64' );
	rejectUnsupportedSmtp( config );
	const session = new SmtpSession( config );
	try {
		await session.connect();
		let response = await session.readResponse();
		expectCode( 'mail.connection', response, [ 220 ], 'SMTP greeting' );
		const heloName = 'localhost';
		response = await session.command( `EHLO ${heloName}` );
		let extensions = new Set();
		if ( response.code >= 500 ) {
			response = await session.command( `HELO ${heloName}` );
			expectCode( 'mail.connection', response, [ 250 ], 'HELO' );
		}
		else {
			expectCode( 'mail.connection', response, [ 250 ], 'EHLO' );
			extensions = extensionsFromResponse( response );
		}
		if ( config.starttls ) {
			if ( !extensions.has( 'STARTTLS' ) ) {
				throw new Error( 'mail.tls: SMTP server did not advertise STARTTLS' );
			}
			response = await session.command( 'STARTTLS' );
			expectCode( 'mail.tls', response, [ 220 ], 'STARTTLS' );
			await session.upgradeTls();
			response = await session.command( `EHLO ${heloName}` );
			expectCode( 'mail.connection', response, [ 250 ], 'EHLO after STARTTLS' );
			extensions = extensionsFromResponse( response );
		}
		await smtpAuthenticate( session, config, response );
		if ( config.smtputf8 && !extensions.has( 'SMTPUTF8' ) ) {
			throw new Error( 'mail.unsupported: SMTPUTF8 was requested but not advertised' );
		}
		let mailFrom = `MAIL FROM:<${from}>`;
		if ( config.smtputf8 ) {
			mailFrom += ' SMTPUTF8';
		}
		response = await session.command( mailFrom );
		expectCode( 'mail.recipient', response, [ 250 ], 'MAIL FROM' );
		const accepted = [];
		const rejected = [];
		for ( const recipient of recipients ) {
			response = await session.command( `RCPT TO:<${recipient}>` );
			if ( [ 250, 251, 252 ].includes( response.code ) ) {
				accepted.push( recipient );
			}
			else {
				rejected.push( recipient );
			}
		}
		if ( accepted.length === 0 ) {
			try {
				await session.command( 'QUIT' );
			}
			catch ( _err ) {}
			throw new Error( 'mail.recipient: all recipients were rejected' );
		}
		if ( rejected.length > 0 && config.reject_partial ) {
			try {
				await session.command( 'QUIT' );
			}
			catch ( _err ) {}
			throw new Error( 'mail.recipient: one or more recipients were rejected' );
		}
		response = await session.command( 'DATA' );
		expectCode( 'mail.data', response, [ 354 ], 'DATA' );
		response = await session.writeData( message );
		expectCode( 'mail.data', response, [ 250 ], 'message DATA' );
		const dataResponse = response.text;
		try {
			await session.command( 'QUIT' );
		}
		catch ( _err ) {}
		return {
			transport: 'smtp',
			accepted,
			rejected,
			message_id: messageId,
			response: dataResponse,
		};
	}
	catch ( err ) {
		if ( err && /^mail\./u.test( err.message || '' ) ) {
			throw err;
		}
		throw new Error( `mail.connection: ${err && err.message ? err.message : String( err )}` );
	}
	finally {
		session.close();
	}
}

function sendSmtpSync( config, from, recipients, message, messageId ) {
	const childProcess = nodeModule( 'node:child_process' );
	if ( !childProcess || typeof childProcess.spawnSync !== 'function' ) {
		throw new Error( 'mail.unsupported: synchronous SMTP support is unavailable' );
	}
	const source = `
		const smtp = require( process.argv[1] );
		let input = '';
		process.stdin.setEncoding( 'utf8' );
		process.stdin.on( 'data', ( chunk ) => { input += chunk; } );
		process.stdin.on( 'end', async () => {
			try {
				const result = await smtp.__zuzu_smtp_send_payload( JSON.parse( input ) );
				process.stdout.write( JSON.stringify( { ok: true, result } ) );
			}
			catch ( err ) {
				process.stdout.write( JSON.stringify( {
					ok: false,
					error: err && err.message ? err.message : String( err ),
				} ) );
			}
		} );
	`;
	const payload = {
		config,
		from,
		recipients,
		messageBase64: message.toString( 'base64' ),
		messageId,
	};
	const spawned = childProcess.spawnSync(
		process.execPath,
		[ '-e', source, __filename ],
		{
			input: JSON.stringify( payload ),
			encoding: 'utf8',
			timeout: Math.floor( ( config.timeout + 2 ) * 1000 ),
			maxBuffer: 1024 * 1024,
		}
	);
	if ( spawned.error ) {
		if ( spawned.error.code === 'ETIMEDOUT' ) {
			throw new Error( 'mail.timeout: SMTP command timed out' );
		}
		throw new Error( `mail.connection: ${spawned.error.message}` );
	}
	const parsed = JSON.parse( spawned.stdout || '{"ok":false,"error":"empty SMTP worker response"}' );
	if ( !parsed.ok ) {
		throw new Error( parsed.error );
	}
	return parsed.result;
}

function prepareSend( baseConfig, fromValue, toValue, headers, body, options ) {
	const config = mergeConfig( baseConfig, options );
	rejectUnsupportedSecurityOptions( config );
	const from = validateAddress( fromValue );
	const recipients = recipientList( toValue );
	validateEnvelopeAscii( config, [ from, ...recipients ] );
	const serialized = serializeMessage( headers, body );
	return {
		config,
		from,
		recipients,
		message: serialized.message,
		messageId: serialized.messageId,
	};
}

class MailResult {
	constructor( payload = {} ) {
		this.transport = payload.transport ?? null;
		this.accepted = Array.isArray( payload.accepted ) ? payload.accepted.slice() : [];
		this.rejected = Array.isArray( payload.rejected ) ? payload.rejected.slice() : [];
		this.message_id = payload.message_id ?? null;
		this.response = payload.response ?? null;
	}

	to_Dict() {
		return {
			transport: this.transport,
			accepted: this.accepted.slice(),
			rejected: this.rejected.slice(),
			message_id: this.message_id,
			response: this.response,
		};
	}
}

class Mailer {
	constructor( options = {}, named = {} ) {
		this._config = normalizeConfig( { ...asDict( options ), ...asDict( named ) } );
	}

	static capabilities() {
		return capabilities();
	}

	send( fromValue, toValue, headers, body, options = {} ) {
		if ( isBrowser() ) {
			throw new Error( 'mail.unsupported: std/net/smtp delivery is unsupported on JS/Browser' );
		}
		const prepared = prepareSend(
			this._config,
			fromValue,
			toValue,
			headers,
			body,
			options,
		);
		const result = prepared.config.transport === 'sendmail'
			? sendmailSync(
				prepared.config,
				prepared.from,
				prepared.recipients,
				prepared.message,
				prepared.messageId,
			)
			: sendSmtpSync(
				prepared.config,
				prepared.from,
				prepared.recipients,
				prepared.message,
				prepared.messageId,
			);
		return mailResult( result );
	}

	send_async( fromValue, toValue, headers, body, options = {} ) {
		if ( isBrowser() ) {
			return Task.failed(
				new Error( 'mail.unsupported: std/net/smtp delivery is unsupported on JS/Browser' )
			);
		}
		let prepared;
		try {
			prepared = prepareSend(
				this._config,
				fromValue,
				toValue,
				headers,
				body,
				options,
			);
		}
		catch ( err ) {
			return Task.failed( err );
		}
		return new Task(
			async () => {
				const result = prepared.config.transport === 'sendmail'
					? await sendmailAsync(
						prepared.config,
						prepared.from,
						prepared.recipients,
						prepared.message,
						prepared.messageId,
					)
					: await sendSmtpPayload( {
						config: prepared.config,
						from: prepared.from,
						recipients: prepared.recipients,
						messageBase64: prepared.message.toString( 'base64' ),
						messageId: prepared.messageId,
					} );
				return mailResult( result );
			},
			{ name: 'smtp.send_async' },
		);
	}
}

function __zuzu_set_runtime_policy( policy = {} ) {
	runtimePolicy = policy || {};
}

const api = {
	Mailer,
	MailResult,
};

Object.defineProperty( api, '__zuzu_set_runtime_policy', {
	value: __zuzu_set_runtime_policy,
	enumerable: false,
} );

Object.defineProperty( api, '__zuzu_smtp_send_payload', {
	value: sendSmtpPayload,
	enumerable: false,
} );

module.exports = api;
