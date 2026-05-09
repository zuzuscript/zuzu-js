'use strict';

let runtimePolicy = {
	host_name: 'node',
};

function dbError( message ) {
	const err = new Error( String( message ) );
	err.to_String = function to_String() {
		return this.message;
	};
	return err;
}

function fail( message ) {
	throw dbError( message );
}

function assertWorkerCapability() {
	if ( runtimePolicy.deny_worker ) {
		fail( 'connect failed: DB worker backend is denied by runtime policy' );
	}
}

function loadBuiltinSqlite() {
	try {
		const sqlite = require( 'node:sqlite' );
		if ( sqlite && typeof sqlite.DatabaseSync === 'function' ) {
			return sqlite;
		}
	}
	catch ( _err ) {
	}
	return null;
}

function loadBetterSqlite3() {
	try {
		return require( 'better-sqlite3' );
	}
	catch ( err ) {
		fail( `connect failed: ${err.message}` );
	}
}

function loadNodeModule( name ) {
	try {
		return require( name );
	}
	catch ( err ) {
		fail( `connect failed: ${err.message}` );
	}
}

function pathString( value ) {
	if ( value == null ) {
		return '';
	}
	if ( typeof value === 'string' ) {
		return value;
	}
	if ( typeof value.to_String === 'function' ) {
		return String( value.to_String() );
	}
	return String( value );
}

function sqlLiteral( value ) {
	if ( value == null ) {
		return 'NULL';
	}
	if ( typeof value === 'number' ) {
		return Number.isFinite( value ) ? String( value ) : 'NULL';
	}
	if ( typeof value === 'boolean' ) {
		return value ? '1' : '0';
	}
	return `'${String( value ).replace( /'/gu, "''" )}'`;
}

function inferCode( value ) {
	if ( typeof value === 'number' ) {
		return Number.isInteger( value ) ? 'INTEGER' : 'REAL';
	}
	if ( typeof value === 'string' ) {
		return 'TEXT';
	}
	if ( typeof value === 'boolean' ) {
		return 'BOOLEAN';
	}
	return 'UNKNOWN';
}

function decorateDict( value ) {
	const methods = [
		[ 'length', function _length() { return Object.keys( this ).length; } ],
		[ 'count', function _count() { return Object.keys( this ).length; } ],
		[ 'empty', function _empty() { return Object.keys( this ).length === 0 ? 1 : 0; } ],
		[ 'keys', function _keys() { return Object.keys( this ).sort(); } ],
		[ 'values', function _values() { return this.keys().map( (key) => this[key] ); } ],
		[
			'has',
			function _has( key ) {
				return Object.prototype.hasOwnProperty.call( this, String( key ) ) ? 1 : 0;
			},
		],
		[ 'contains', function _contains( key ) { return this.has( key ); } ],
		[ 'exists', function _exists( key ) { return this.has( key ); } ],
		[
			'defined',
			function _defined( key ) {
				return Object.prototype.hasOwnProperty.call( this, String( key ) )
					&& this[String( key )] != null ? 1 : 0;
			},
		],
		[ 'get', function _get( key, fallback = null ) { return this.has( key ) ? this[String( key )] : fallback; } ],
		[ 'set', function _set( key, item ) { this[String( key )] = item; return this; } ],
		[ 'add', function _add( key, item ) { this[String( key )] = item; return this; } ],
		[ 'remove', function _remove( key ) { delete this[String( key )]; return this; } ],
		[ 'sorted_keys', function _sorted_keys() { return this.keys(); } ],
		[ 'to_Iterator', function _to_iterator() { return this.keys()[Symbol.iterator](); } ],
	];
	for ( const [ name, fn ] of methods ) {
		if ( !Object.prototype.hasOwnProperty.call( value, name ) ) {
			Object.defineProperty( value, name, { value: fn, enumerable: false } );
		}
	}
	return value;
}

function parseSelectedTable( sql ) {
	const match = String( sql ).match( /\bfrom\s+([A-Za-z_][A-Za-z0-9_]*)/iu );
	return match ? match[1] : null;
}

function schemaForQuery( dbh, sql, columns, rows ) {
	if ( Array.isArray( columns ) && columns.length > 0 ) {
		const typed = columns.map( (col) => ( {
			name: col.name,
			code: col.type || null,
		} ) );
		if ( typed.some( (col) => col.code ) ) {
			return typed.map( (col) => ( {
				name: col.name,
				code: col.code || 'UNKNOWN',
			} ) );
		}
	}
	const table = parseSelectedTable( sql );
	if ( table ) {
		try {
			const cols = dbh.backend.query(
				`pragma table_info(${quoteSqliteIdentifier( table )});`,
				[]
			).rows;
			if ( Array.isArray( cols ) && cols.length > 0 ) {
				return cols.map( (col) => ( {
					name: col.name,
					code: col.type || 'UNKNOWN',
				} ) );
			}
		}
		catch ( _err ) {
		}
	}
	const first = rows[0] || {};
	return Object.keys( first ).map( (name) => ( {
		name,
		code: inferCode( first[name] ),
	} ) );
}

function quoteSqliteIdentifier( value ) {
	return `"${String( value ).replace( /"/gu, '""' )}"`;
}

function normalizeBindValues( values ) {
	return values.map( (value) => ( typeof value === 'boolean' ? ( value ? 1 : 0 ) : value ) );
}

function parseDbiDsn( dsn ) {
	const text = String( dsn ?? '' );
	const match = text.match( /^dbi:([^:]+):(.*)$/iu );
	if ( !match ) {
		return null;
	}
	const attrs = Object.create( null );
	const body = match[2];
	for ( const part of body.split( ';' ) ) {
		if ( part === '' ) {
			continue;
		}
		const eq = part.indexOf( '=' );
		if ( eq < 0 ) {
			attrs[part.toLowerCase()] = '';
			continue;
		}
		attrs[part.slice( 0, eq ).toLowerCase()] = part.slice( eq + 1 );
	}
	return {
		driver: match[1].toLowerCase(),
		attrs,
		text,
	};
}

function sqliteBeginSql( settings ) {
	const isolation = String( settings?.isolation_level || 'deferred' ).toLowerCase();
	if ( ![ 'deferred', 'immediate', 'exclusive' ].includes( isolation ) ) {
		fail( `connect failed: unsupported SQLite isolation_level ${isolation}` );
	}
	return `begin ${isolation}`;
}

class BetterSqliteBackend {
	constructor( dbPath, settings = {} ) {
		this.kind = 'sqlite';
		this.dbPath = dbPath;
		this.settings = settings && typeof settings === 'object' ? settings : {};
		const BetterSqlite3 = loadBetterSqlite3();
		try {
			this.db = new BetterSqlite3( dbPath );
		}
		catch ( err ) {
			fail( `connect failed: ${err.message}` );
		}
	}

	query( sql, values ) {
		try {
			const stmt = this.db.prepare( String( sql ) );
			const bind = normalizeBindValues( values );
			if ( stmt.reader ) {
				return {
					rows: stmt.all( ...bind ),
					columns: stmt.columns(),
				};
			}
			stmt.run( ...bind );
			return { rows: [], columns: [] };
		}
		catch ( err ) {
			fail( err.message || err );
		}
	}

	begin() {
		try {
			this.db.exec( sqliteBeginSql( this.settings ) );
		}
		catch ( err ) {
			fail( err.message || err );
		}
	}

	commit() {
		try {
			this.db.exec( 'commit' );
		}
		catch ( err ) {
			fail( err.message || err );
		}
	}

	rollback() {
		try {
			this.db.exec( 'rollback' );
		}
		catch ( err ) {
			fail( err.message || err );
		}
	}
}

class BuiltinSqliteBackend {
	constructor( dbPath, settings = {} ) {
		this.kind = 'sqlite';
		this.dbPath = dbPath;
		this.settings = settings && typeof settings === 'object' ? settings : {};
		const sqlite = loadBuiltinSqlite();
		if ( !sqlite ) {
			fail( 'connect failed: node:sqlite is not available' );
		}
		try {
			this.db = new sqlite.DatabaseSync( dbPath );
		}
		catch ( err ) {
			fail( `connect failed: ${err.message}` );
		}
	}

	query( sql, values ) {
		try {
			const stmt = this.db.prepare( String( sql ) );
			const bind = normalizeBindValues( values );
			const columns = stmt.columns();
			return {
				rows: stmt.all( ...bind ),
				columns,
			};
		}
		catch ( err ) {
			fail( err.message || err );
		}
	}

	begin() {
		try {
			this.db.exec( sqliteBeginSql( this.settings ) );
		}
		catch ( err ) {
			fail( err.message || err );
		}
	}

	commit() {
		try {
			this.db.exec( 'commit' );
		}
		catch ( err ) {
			fail( err.message || err );
		}
	}

	rollback() {
		try {
			this.db.exec( 'rollback' );
		}
		catch ( err ) {
			fail( err.message || err );
		}
	}
}

function createSqliteBackend( dbPath, settings ) {
	if ( loadBuiltinSqlite() ) {
		return new BuiltinSqliteBackend( dbPath, settings );
	}
	return new BetterSqliteBackend( dbPath, settings );
}

function driverWorkerConfig( driver, attrs, settings = {} ) {
	const config = {
		...attrs,
		...( settings && typeof settings === 'object' ? settings : {} ),
	};
	const database = config.database || config.dbname;
	const out = {};
	if ( database ) {
		out.database = String( database );
	}
	if ( config.user ) {
		out.user = String( config.user );
	}
	if ( config.password || config.pass ) {
		out.password = String( config.password || config.pass );
	}
	if ( config.port ) {
		out.port = Number( config.port );
	}
	if ( config.host ) {
		out.host = String( config.host );
	}
	if ( driver === 'mysql' ) {
		if ( config.mysql_socket || config.socket ) {
			out.socketPath = String( config.mysql_socket || config.socket );
		}
		out.decimalNumbers = true;
		out.dateStrings = true;
	}
	if ( driver === 'postgresql' || driver === 'pg' ) {
		if ( config.ssl ) {
			out.ssl = config.ssl;
		}
	}
	return out;
}

class WorkerSqlBackend {
	constructor( driver, attrs, settings = {} ) {
		if ( runtimePolicy.host_name === 'browser' ) {
			fail( 'connect failed: std/db SQL clients are not available in browser' );
		}
		assertWorkerCapability();
		const { Worker } = loadNodeModule( 'node:worker_threads' );
		const path = loadNodeModule( 'node:path' );
		this.kind = driver;
		this.dbPath = null;
		this.settings = settings && typeof settings === 'object' ? settings : {};
		this.worker = new Worker(
			path.join( __dirname, 'db-worker.js' ),
			{
				workerData: {
					driver,
					config: driverWorkerConfig( driver, attrs, this.settings ),
				},
			}
		);
		this.worker.unref();
		this._request( { op: 'connect' } );
	}

	_request( request ) {
		const fs = loadNodeModule( 'node:fs' );
		const os = loadNodeModule( 'node:os' );
		const path = loadNodeModule( 'node:path' );
		const dir = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-db-' ) );
		const responsePath = path.join( dir, 'response.json' );
		const signal = new SharedArrayBuffer( 4 );
		const state = new Int32Array( signal );
		this.worker.postMessage( {
			...request,
			responsePath,
			signal,
		} );
		Atomics.wait( state, 0, 0 );
		let response;
		try {
			response = JSON.parse( fs.readFileSync( responsePath, 'utf8' ) );
		}
		finally {
			fs.rmSync( dir, { recursive: true, force: true } );
		}
		if ( !response.ok ) {
			fail( response.error || 'database request failed' );
		}
		return response.result;
	}

	query( sql, values ) {
		return this._request( {
			op: 'query',
			sql: String( sql ),
			values: normalizeBindValues( values ),
		} );
	}

	begin() {
		this._request( { op: 'begin' } );
	}

	commit() {
		this._request( { op: 'commit' } );
	}

	rollback() {
		this._request( { op: 'rollback' } );
	}

	close() {
		if ( this.worker ) {
			try {
				this._request( { op: 'close' } );
			}
			catch ( _err ) {
			}
			this.worker = null;
		}
	}
}

class StatementHandle {
	constructor( dbh, sql ) {
		this.dbh = dbh;
		this.sql = String( sql );
		this.rows = [];
		this.columns = [];
		this.types = [];
		this.index = 0;
	}

	execute( ...values ) {
		this.index = 0;
		const result = this.dbh.backend.query( this.sql, values );
		if ( result.columns.length > 0 ) {
			this.rows = result.rows;
			this.columns = result.columns.map( (col) => col.name );
			this.types = schemaForQuery( this.dbh, this.sql, result.columns, this.rows );
		}
		else {
			this.rows = [];
			this.columns = [];
			this.types = [];
		}
		return this;
	}

	execute_batch( rows ) {
		for ( const row of Array.isArray( rows ) ? rows : [] ) {
			this.execute( ...( Array.isArray( row ) ? row : [] ) );
		}
		return this;
	}

	column_names() {
		return this.columns.slice();
	}

	column_types() {
		return this.types.map( (entry) => ( { code: entry.code, name: entry.name } ) );
	}

	_nextRow() {
		if ( this.index >= this.rows.length ) {
			return null;
		}
		return this.rows[this.index++];
	}

	coerceRowObject( row ) {
		return row == null ? null : decorateDict( { ...row } );
	}

	next_array() {
		const row = this._nextRow();
		return row == null ? null : this.columns.map( (name) => row[name] );
	}

	next_dict() {
		const row = this._nextRow();
		return this.coerceRowObject( row );
	}

	all_array() {
		const out = [];
		let row;
		while ( ( row = this.next_array() ) !== null ) {
			out.push( row );
		}
		return out;
	}

	all_dict() {
		const out = [];
		let row;
		while ( ( row = this.next_dict() ) !== null ) {
			out.push( row );
		}
		return out;
	}

	next_typed_array() {
		return this.next_array();
	}

	next_typed_dict() {
		return this.next_dict();
	}

	all_typed_array() {
		return this.all_array();
	}

	all_typed_dict() {
		return this.all_dict();
	}

	*[Symbol.iterator]() {
		let row;
		while ( ( row = this.next_typed_dict() ) !== null ) {
			yield row;
		}
	}

	to_Iterator() {
		return this[Symbol.iterator]();
	}
}

class DatabaseHandle {
	constructor( backend, settings = {} ) {
		this.backend = backend;
		this.dbPath = backend.dbPath;
		this.settings = settings && typeof settings === 'object' ? settings : {};
	}

	prepare( sql ) {
		return new StatementHandle( this, sql );
	}

	quote( value ) {
		return sqlLiteral( value );
	}

	begin() {
		this.backend.begin();
		return this;
	}

	commit() {
		this.backend.commit();
		return this;
	}

	rollback() {
		this.backend.rollback();
		return this;
	}

	execute_batch( sql, rows ) {
		return this.prepare( sql ).execute_batch( rows );
	}

	close() {
		if ( this.backend && typeof this.backend.close === 'function' ) {
			this.backend.close();
		}
		return null;
	}
}

function sqliteBackendFromDsn( dsn, settings ) {
	const text = String( dsn ?? '' );
	const match = text.match( /^dbi:sqlite:dbname=(.+)$/iu );
	if ( !match ) {
		fail( `connect failed: unsupported dsn ${text}` );
	}
	return createSqliteBackend( match[1], settings );
}

function backendFromDsn( dsn, settings ) {
	const parsed = parseDbiDsn( dsn );
	if ( !parsed ) {
		fail( `connect failed: unsupported dsn ${String( dsn ?? '' )}` );
	}
	if ( parsed.driver === 'sqlite' ) {
		return sqliteBackendFromDsn( parsed.text, settings );
	}
	if ( parsed.driver === 'mysql' ) {
		return new WorkerSqlBackend( 'mysql', parsed.attrs, settings );
	}
	if ( parsed.driver === 'pg' || parsed.driver === 'postgresql' ) {
		return new WorkerSqlBackend( 'postgresql', parsed.attrs, settings );
	}
	fail( `connect failed: unsupported dsn ${parsed.text}` );
}

function sqliteHandle( dbPath, settings ) {
	return new DatabaseHandle( createSqliteBackend( dbPath, settings ), settings );
}

const DB = {
	connect( dsn, settings = {} ) {
		return new DatabaseHandle( backendFromDsn( dsn, settings ), settings );
	},
	temp( settings = {} ) {
		return sqliteHandle( ':memory:', settings );
	},
	open( target, settings = {} ) {
		return sqliteHandle( pathString( target ), settings );
	},
};

module.exports = {
	DB,
	DatabaseHandle,
	StatementHandle,
	__zuzu_set_runtime_policy( policy = {} ) {
		runtimePolicy = {
			...runtimePolicy,
			...( policy && typeof policy === 'object' ? policy : {} ),
		};
	},
};
