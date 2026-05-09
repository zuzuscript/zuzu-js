'use strict';

const { PairList } = require( '../../../lib/collections' );

let runtimePolicy = {
	deny_fs: false,
	deny_db: false,
	host_name: 'node',
};
let nodeFs;
let nodeFsLoaded = false;
let PathClass;
let PathClassLoaded = false;
let DatabaseHandleClass;
let DatabaseHandleClassLoaded = false;

function _safeRequire( moduleName ) {
	if ( typeof require !== 'function' ) {
		return null;
	}
	try {
		return require( moduleName );
	}
	catch ( _err ) {
		return null;
	}
}

function _nodeFs() {
	if ( nodeFsLoaded ) {
		return nodeFs;
	}
	nodeFsLoaded = true;
	nodeFs = _safeRequire( 'node:fs' );
	return nodeFs;
}

function _PathClass() {
	if ( PathClassLoaded ) {
		return PathClass;
	}
	PathClassLoaded = true;
	const loaded = _safeRequire( '../io.js' );
	PathClass = loaded && loaded.Path ? loaded.Path : null;
	return PathClass;
}

function _DatabaseHandleClass() {
	if ( DatabaseHandleClassLoaded ) {
		return DatabaseHandleClass;
	}
	DatabaseHandleClassLoaded = true;
	const loaded = _safeRequire( '../db.js' );
	DatabaseHandleClass = loaded && loaded.DatabaseHandle
		? loaded.DatabaseHandle
		: null;
	return DatabaseHandleClass;
}

function assertCapability( capability, message ) {
	if ( runtimePolicy[`deny_${capability}`] ) {
		throw new Error( message );
	}
}

function typeName( value ) {
	if ( value == null ) {
		return 'Null';
	}
	if ( typeof value === 'string' ) {
		return 'String';
	}
	return value.constructor && value.constructor.name
		? value.constructor.name
		: typeof value;
}

function bool( value ) {
	return value ? 1 : 0;
}

function isPlainObject( value ) {
	return value != null
		&& typeof value === 'object'
		&& !Array.isArray( value )
		&& !( value instanceof PairList );
}

function isPath( value ) {
	if ( value == null || typeof value !== 'object' ) {
		return false;
	}
	const Path = _PathClass();
	return Path ? value instanceof Path : false;
}

function isDbHandle( value ) {
	if ( value == null || typeof value !== 'object' ) {
		return false;
	}
	const DatabaseHandle = _DatabaseHandleClass();
	return DatabaseHandle ? value instanceof DatabaseHandle : false;
}

function optionsObject( value ) {
	if ( value instanceof PairList ) {
		return Object.fromEntries(
			value.list.map( ([ key, inner ]) => [ String( key ), inner ] )
		);
	}
	if ( isPlainObject( value ) ) {
		return { ...value };
	}
	return {};
}

function arrayValue( value ) {
	if ( Array.isArray( value ) ) {
		return value.slice();
	}
	return [];
}

function objectValue( value ) {
	return isPlainObject( value ) ? { ...value } : {};
}

function normalizeConfig( ...parts ) {
	const out = {};
	for ( const part of parts ) {
		Object.assign( out, optionsObject( part ) );
	}
	return out;
}

function runtimeConfig( ...parts ) {
	const config = normalizeConfig( ...parts );
	for ( const key of [ 'columns', 'required_columns', 'sniff_candidates' ] ) {
		if ( key in config ) {
			config[key] = arrayValue( config[key] );
		}
	}
	for ( const key of [
		'defaults',
		'rename_headers',
		'column_map',
		'column_types',
		'types',
		'parsers',
		'formatters',
	] ) {
		if ( key in config ) {
			config[key] = objectValue( config[key] );
		}
	}
	return config;
}

function columnNamesFromConfig( config ) {
	if ( Array.isArray( config.columns ) ) {
		return config.columns.map( (name) => String( name ?? '' ) );
	}
	return null;
}

function defaultColumnsForRow( row ) {
	const out = [];
	for ( let i = 0; i < row.length; i++ ) {
		out.push( `column${i + 1}` );
	}
	return out;
}

function normalizeFieldValue( value, config ) {
	if ( value === '' && config.blank_is_undef ) {
		return null;
	}
	if ( value === '' && config.empty_is_undef ) {
		return null;
	}
	return value;
}

function headerName( raw, config ) {
	let value = String( raw ?? '' );
	if ( config.trim_headers ) {
		value = value.trim();
	}
	if ( config.lowercase_headers ) {
		value = value.toLowerCase();
	}
	if ( config.rename_headers && Object.prototype.hasOwnProperty.call( config.rename_headers, value ) ) {
		value = String( config.rename_headers[value] );
	}
	return value;
}

function normalizeHeaders( headers, config ) {
	if ( !Array.isArray( headers ) ) {
		return [];
	}
	const seen = new Map();
	const out = [];
	const policy = String( config.duplicate_headers || 'overwrite' ).toLowerCase();
	for ( const raw of headers ) {
		let name = headerName( raw, config );
		if ( seen.has( name ) ) {
			if ( policy === 'error' ) {
				throw new Error( `Duplicate CSV header '${name}'` );
			}
			if ( policy === 'suffix' ) {
				const next = seen.get( name ) + 1;
				seen.set( name, next );
				name = `${name}_${next}`;
			}
			else {
				seen.set( name, seen.get( name ) + 1 );
			}
		}
		else {
			seen.set( name, 1 );
		}
		out.push( name );
	}
	return out;
}

function requireColumns( headers, config ) {
	const required = arrayValue( config.required_columns );
	if ( required.length === 0 ) {
		return;
	}
	const have = new Set( headers || [] );
	for ( const name of required ) {
		if ( !have.has( name ) ) {
			throw new Error( `Required CSV column '${name}' missing` );
		}
	}
}

function typeForColumn( config, headers, index ) {
	const types = config.types;
	if ( Array.isArray( types ) ) {
		return types[index];
	}
	if ( isPlainObject( types ) && Array.isArray( headers ) ) {
		return types[headers[index]];
	}
	return undefined;
}

function coerceScalar( value, type ) {
	if ( type == null ) {
		return value;
	}
	const name = String( type ).toLowerCase();
	if ( name === 'null' ) {
		return null;
	}
	if ( value == null ) {
		return name === 'string' ? '' : null;
	}
	if ( name === 'integer' || name === 'int' ) {
		return parseInt( String( value ), 10 ) || 0;
	}
	if ( [ 'number', 'float', 'real' ].includes( name ) ) {
		return Number( value ) || 0;
	}
	if ( name === 'boolean' || name === 'bool' ) {
		const text = String( value ).toLowerCase();
		if ( /^(1|true|yes|on)$/u.test( text ) ) {
			return 1;
		}
		if ( /^(0|false|no|off)?$/u.test( text ) ) {
			return 0;
		}
		return bool( value );
	}
	return String( value );
}

function applyRowRules( row, headers, config, state = {} ) {
	const working = row.slice();
	if ( Array.isArray( headers ) ) {
		const expected = headers.length;
		const actual = working.length;
		const ragged = String( config.ragged || 'allow' ).toLowerCase();
		if ( actual < expected ) {
			if ( ragged === 'fill' ) {
				while ( working.length < expected ) {
					working.push( config.fill_value ?? null );
				}
			}
			else if ( ragged === 'error' ) {
				throw new Error( `CSV row has too few fields at line ${state.line_number ?? '?'}` );
			}
		}
		else if ( actual > expected ) {
			if ( ragged === 'truncate' ) {
				working.length = expected;
			}
			else if ( ragged === 'error' ) {
				throw new Error( `CSV row has too many fields at line ${state.line_number ?? '?'}` );
			}
		}
	}

	for ( let i = 0; i < working.length; i++ ) {
		working[i] = coerceScalar(
			normalizeFieldValue( working[i], config ),
			typeForColumn( config, headers, i )
		);
	}

	if ( Array.isArray( headers ) ) {
		const out = {};
		for ( let i = 0; i < headers.length; i++ ) {
			out[headers[i]] = working[i];
		}
		for ( const [ key, value ] of Object.entries( objectValue( config.defaults ) ) ) {
			if ( out[key] == null || out[key] === '' ) {
				out[key] = value;
			}
		}
		if ( String( config.unknown_columns || 'keep' ).toLowerCase() === 'ignore' ) {
			const allowed = new Set( headers );
			for ( const key of Object.keys( out ) ) {
				if ( !allowed.has( key ) ) {
					delete out[key];
				}
			}
		}
		return out;
	}

	return working;
}

class UnterminatedQuoteError extends Error {}

function parseRecord( record, config ) {
	const sep = String( config.sep_char ?? ',' );
	const quote = String( config.quote_char ?? '"' );
	const escape = String( config.escape_char ?? quote );
	const allowWhitespace = !!config.allow_whitespace;
	const row = [];
	let field = '';
	let inQuotes = false;
	let afterQuote = false;

	for ( let i = 0; i < record.length; i++ ) {
		const ch = record[i];
		if ( inQuotes ) {
			if ( ch === quote ) {
				if ( escape === quote && record[i + 1] === quote ) {
					field += quote;
					i++;
				}
				else {
					inQuotes = false;
					afterQuote = true;
				}
				continue;
			}
			if ( escape !== quote && ch === escape && i + 1 < record.length ) {
				field += record[i + 1];
				i++;
				continue;
			}
			field += ch;
			continue;
		}

		if ( afterQuote ) {
			if ( ch === sep ) {
				row.push( normalizeFieldValue( field, config ) );
				field = '';
				afterQuote = false;
				continue;
			}
			if ( ch === '\n' ) {
				row.push( normalizeFieldValue( field, config ) );
				return row;
			}
			if ( ch === '\r' ) {
				continue;
			}
			if ( allowWhitespace && /\s/u.test( ch ) ) {
				continue;
			}
			throw new Error( `unexpected trailing text after closing quote near column ${row.length + 1}` );
		}

		if ( ch === sep ) {
			row.push( normalizeFieldValue( field, config ) );
			field = '';
			continue;
		}
		if ( ch === quote && field === '' ) {
			inQuotes = true;
			continue;
		}
		if ( ch === '\n' ) {
			row.push( normalizeFieldValue( field, config ) );
			return row;
		}
		if ( ch === '\r' ) {
			continue;
		}
		field += ch;
	}

	if ( inQuotes ) {
		throw new UnterminatedQuoteError( 'unterminated quoted field' );
	}

	row.push( normalizeFieldValue( field, config ) );
	return row;
}

function csvErrorDetail( error, state = {} ) {
	const parts = [];
	if ( state.line_number != null ) {
		parts.push( `line ${state.line_number}` );
	}
	if ( state.column_number != null ) {
		parts.push( `column ${state.column_number}` );
	}
	if ( state.raw_line != null ) {
		parts.push( `row ${state.raw_line}` );
	}
	return {
		message: parts.length > 0
			? `${error.message} (${parts.join( ', ' )})`
			: error.message,
		line_number: state.line_number ?? null,
		column_number: state.column_number ?? null,
		raw_line: state.raw_line ?? null,
	};
}

function sourceLinesFromText( text ) {
	const source = String( text ?? '' );
	let index = 0;
	return function nextLine() {
		if ( index >= source.length ) {
			return null;
		}
		let end = source.indexOf( '\n', index );
		if ( end === -1 ) {
			end = source.length;
		}
		else {
			end += 1;
		}
		const line = source.slice( index, end );
		index = end;
		return line;
	};
}

class FileLineSource {
	constructor( target ) {
		const fs = _nodeFs();
		if ( !fs ) {
			throw new Error( 'CSV file access requires filesystem support' );
		}
		this.fd = fs.openSync( target.to_String(), 'r' );
		this.buffer = '';
		this.eof = false;
	}

	nextLine() {
		const fs = _nodeFs();
		while ( true ) {
			const idx = this.buffer.indexOf( '\n' );
			if ( idx >= 0 ) {
				const line = this.buffer.slice( 0, idx + 1 );
				this.buffer = this.buffer.slice( idx + 1 );
				return line;
			}
			if ( this.eof ) {
				if ( this.buffer === '' ) {
					return null;
				}
				const tail = this.buffer;
				this.buffer = '';
				return tail;
			}
			const chunk = Buffer.allocUnsafe( 8192 );
			const bytesRead = fs.readSync( this.fd, chunk, 0, chunk.length, null );
			if ( bytesRead === 0 ) {
				this.eof = true;
			}
			else {
				this.buffer += chunk.toString( 'utf8', 0, bytesRead );
			}
		}
	}

	close() {
		if ( this.fd != null ) {
			const fs = _nodeFs();
			fs.closeSync( this.fd );
			this.fd = null;
		}
	}
}

class CSVReader {
	constructor( target, options = {} ) {
		if ( !isPath( target ) ) {
			throw new Error( 'TypeException: CSV.open expects Path as first argument' );
		}
		this.config = runtimeConfig( options );
		this.source = new FileLineSource( target );
		this.headersList = columnNamesFromConfig( this.config );
		this.mode = this.headersList ? 'dict' : 'array';
		this.lineNumberValue = 0;
		this.rowNumberValue = 0;
		this.errorsList = [];
		this.recordBuffer = '';
		this.recordStartLine = null;
		this.skipRemaining = Number( this.config.skip_lines || 0 );
		this.closed = false;
		if ( !this.headersList && this.config.headers ) {
			const headerRow = this._readNextArray( true );
			this.headersList = normalizeHeaders( headerRow || [], this.config );
			requireColumns( this.headersList, this.config );
			this.mode = 'dict';
		}
		else if ( this.headersList ) {
			requireColumns( this.headersList, this.config );
		}
	}

	_state() {
		return {
			line_number: this.recordStartLine ?? this.lineNumberValue,
			row_number: this.rowNumberValue,
			raw_line: this.recordBuffer,
		};
	}

	_nextPhysicalLine() {
		const line = this.source.nextLine();
		if ( line != null ) {
			this.lineNumberValue++;
		}
		return line;
	}

	_readNextArray( internal = false ) {
		while ( true ) {
			const line = this._nextPhysicalLine();
			if ( line == null ) {
				if ( this.recordBuffer === '' ) {
					return null;
				}
				try {
					const finalRow = parseRecord( this.recordBuffer, this.config );
					this.recordBuffer = '';
					return finalRow;
				}
				catch ( error ) {
					if ( error instanceof UnterminatedQuoteError ) {
						const detail = csvErrorDetail( error, this._state() );
						this.errorsList.push( detail );
						if ( internal || String( this.config.on_error || 'die' ).toLowerCase() !== 'collect' ) {
							throw new Error( detail.message );
						}
						this.recordBuffer = '';
						return null;
					}
					throw error;
				}
			}

			if ( this.recordBuffer === '' ) {
				if ( this.skipRemaining > 0 ) {
					this.skipRemaining--;
					continue;
				}
				if (
					this.config.comment_char
					&& line.startsWith( String( this.config.comment_char ) )
				) {
					continue;
				}
				if ( this.config.skip_empty_rows && /^\s*$/u.test( line ) ) {
					continue;
				}
				this.recordStartLine = this.lineNumberValue;
			}

			this.recordBuffer += line;
			try {
				const row = parseRecord( this.recordBuffer, this.config );
				this.recordBuffer = '';
				return row;
			}
			catch ( error ) {
				if ( error instanceof UnterminatedQuoteError ) {
					continue;
				}
				const detail = csvErrorDetail( error, this._state() );
				this.errorsList.push( detail );
				this.recordBuffer = '';
				if ( internal || String( this.config.on_error || 'die' ).toLowerCase() !== 'collect' ) {
					throw new Error( detail.message );
				}
			}
		}
	}

	next_array() {
		while ( true ) {
			const row = this._readNextArray( false );
			if ( row == null ) {
				return null;
			}
			const result = applyRowRules(
				row,
				this.headersList,
				this.config,
				{
					line_number: this.recordStartLine,
					row_number: this.rowNumberValue + 1,
					raw_line: this.recordBuffer,
				},
			);
			this.rowNumberValue++;
			if ( Array.isArray( result ) ) {
				return result;
			}
			return ( this.headersList || [] ).map( (name) => result[name] );
		}
	}

	next_dict() {
		if ( !Array.isArray( this.headersList ) || this.headersList.length === 0 ) {
			throw new Error( 'CSVReader.next_dict requires headers or columns' );
		}
		const row = this._readNextArray( false );
		if ( row == null ) {
			return null;
		}
		this.rowNumberValue++;
		const result = applyRowRules(
			row,
			this.headersList,
			this.config,
			{
				line_number: this.recordStartLine,
				row_number: this.rowNumberValue,
				raw_line: this.recordBuffer,
			},
		);
		return Array.isArray( result )
			? Object.fromEntries( this.headersList.map( (name, index) => [ name, result[index] ] ) )
			: result;
	}

	next() {
		return this.mode === 'dict' ? this.next_dict() : this.next_array();
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

	headers() {
		return this.headersList ? this.headersList.slice() : null;
	}

	columns() {
		return this.headers();
	}

	set_columns( columns ) {
		this.headersList = arrayValue( columns ).map( (name) => String( name ) );
		this.mode = 'dict';
		return this.headers();
	}

	row_number() {
		return this.rowNumberValue;
	}

	skip_lines( count ) {
		let skipped = 0;
		while ( skipped < Number( count || 0 ) ) {
			if ( this._nextPhysicalLine() == null ) {
				break;
			}
			skipped++;
		}
		return skipped;
	}

	errors() {
		return this.errorsList.slice();
	}

	close() {
		if ( !this.closed ) {
			this.closed = true;
			this.source.close();
		}
		return 1;
	}

	*[Symbol.iterator]() {
		let row;
		while ( ( row = this.next() ) !== null ) {
			yield row;
		}
	}

	to_Iterator() {
		return this[Symbol.iterator]();
	}
}

function outputColumnsFromRows( rows, config ) {
	const configured = columnNamesFromConfig( config );
	if ( configured && configured.length > 0 ) {
		return configured;
	}
	for ( const row of rows ) {
		if ( Array.isArray( row ) ) {
			return config.headers ? defaultColumnsForRow( row ) : null;
		}
		if ( isPlainObject( row ) ) {
			const keys = Object.keys( row );
			if ( config.sort_columns ) {
				keys.sort( (left, right) => left.localeCompare( right ) );
			}
			return keys;
		}
	}
	return null;
}

function formatOutputRow( row, columns ) {
	if ( Array.isArray( row ) ) {
		return row.slice();
	}
	if ( isPlainObject( row ) ) {
		return ( columns || Object.keys( row ) ).map( (name) => row[name] );
	}
	return [ row ];
}

function encodeCell( value, config ) {
	if ( value == null ) {
		return '';
	}
	const sep = String( config.sep_char ?? ',' );
	const quote = String( config.quote_char ?? '"' );
	const escape = String( config.escape_char ?? quote );
	let text = String( value );
	const needsQuote = config.always_quote
		|| text.includes( sep )
		|| text.includes( '\n' )
		|| text.includes( '\r' )
		|| text.includes( quote )
		|| ( config.quote_space && /^\s|\s$/u.test( text ) )
		|| ( config.quote_empty && text === '' );
	if ( !needsQuote ) {
		return text;
	}
	if ( escape === quote ) {
		text = text.replaceAll( quote, quote + quote );
	}
	else {
		text = text.replaceAll( escape, escape + escape );
		text = text.replaceAll( quote, escape + quote );
	}
	return `${quote}${text}${quote}`;
}

function quotedIdentifier( name ) {
	return `"${String( name ).replaceAll( '"', '""' )}"`;
}

class CSVWriter {
	constructor( target, options = {} ) {
		if ( !isPath( target ) ) {
			throw new Error( 'TypeException: CSV.open_writer expects Path as first argument' );
		}
		const fs = _nodeFs();
		if ( !fs ) {
			throw new Error( 'CSV file access requires filesystem support' );
		}
		this.config = runtimeConfig( options );
		this.columnsList = columnNamesFromConfig( this.config );
		this.rowNumberValue = 0;
		this.wroteHeader = !!this.config.append;
		const flag = this.config.append ? 'a' : 'w';
		this.fd = fs.openSync( target.to_String(), flag );
		this.closed = false;
	}

	_writeText( text ) {
		const fs = _nodeFs();
		fs.writeSync( this.fd, text, null, 'utf8' );
	}

	columns() {
		return this.columnsList ? this.columnsList.slice() : null;
	}

	write_header( columns = null ) {
		if ( columns != null ) {
			this.columnsList = arrayValue( columns ).map( (name) => String( name ) );
		}
		if ( !Array.isArray( this.columnsList ) ) {
			this.columnsList = [];
		}
		this._writeText(
			this.columnsList.map( (value) => encodeCell( value, this.config ) ).join( String( this.config.sep_char ?? ',' ) )
			+ String( this.config.eol ?? '\n' )
		);
		this.wroteHeader = true;
		return this.columns();
	}

	write_row( row ) {
		if ( this.closed ) {
			throw new Error( 'CSVWriter is closed' );
		}
		if ( !this.columnsList ) {
			if ( Array.isArray( row ) && this.config.headers ) {
				this.columnsList = defaultColumnsForRow( row );
			}
			else if ( isPlainObject( row ) ) {
				this.columnsList = Object.keys( row );
				if ( this.config.sort_columns ) {
					this.columnsList.sort( (left, right) => left.localeCompare( right ) );
				}
			}
		}
		if ( this.config.headers && !this.wroteHeader && this.columnsList ) {
			this.write_header( this.columnsList );
		}
		const fields = formatOutputRow( row, this.columnsList );
		this._writeText(
			fields.map( (value) => encodeCell( value, this.config ) ).join( String( this.config.sep_char ?? ',' ) )
			+ String( this.config.eol ?? '\n' )
		);
		this.rowNumberValue++;
		return fields;
	}

	print_row( row ) {
		return this.write_row( row );
	}

	row_number() {
		return this.rowNumberValue;
	}

	close() {
		if ( !this.closed ) {
			this.closed = true;
			const fs = _nodeFs();
			fs.closeSync( this.fd );
		}
		return 1;
	}
}

function sniffCounts( text, char ) {
	return String( text ?? '' )
		.split( /\r?\n/u )
		.filter( (line) => line !== '' )
		.slice( 0, 5 )
		.reduce( (count, line) => count + ( line.split( char ).length - 1 ), 0 );
}

function sniffText( source, config = {} ) {
	const candidates = arrayValue( config.sniff_candidates );
	const chars = candidates.length > 0 ? candidates : [ ',', '\t', ';', '|' ];
	let best = chars[0];
	let bestScore = -1;
	for ( const char of chars ) {
		const score = sniffCounts( source, char );
		if ( score > bestScore ) {
			bestScore = score;
			best = char;
		}
	}
	const first = String( source ?? '' )
		.split( /\r?\n/u )
		.find( (line) => /\S/u.test( line ) ) || '';
	let headers = 0;
	if ( first !== '' ) {
		const parts = first.split( best );
		headers = parts.length > 0 && parts.every( (part) => !/^-?(?:\d+(?:\.\d+)?)$/u.test( part ) ) ? 1 : 0;
	}
	return {
		sep_char: best,
		headers,
		quote_char: '"',
	};
}

class CSV {
	constructor( options = {} ) {
		this.config = runtimeConfig( options );
	}

	sniff( source ) {
		if ( isPath( source ) ) {
			assertCapability( 'fs', 'CSV.sniff is denied by runtime policy' );
			return sniffText( source.slurp_utf8(), this.config );
		}
		return sniffText( source, this.config );
	}

	transpose( rows ) {
		const matrix = Array.isArray( rows ) ? rows : [];
		let max = 0;
		for ( const row of matrix ) {
			max = Math.max( max, Array.isArray( row ) ? row.length : 1 );
		}
		const out = [];
		for ( let i = 0; i < max; i++ ) {
			const next = [];
			for ( const row of matrix ) {
				next.push( Array.isArray( row ) ? row[i] : ( i === 0 ? row : null ) );
			}
			out.push( next );
		}
		return out;
	}

	decode( text ) {
		const report = this.decode_report( text );
		if (
			report.errors.length > 0
			&& String( this.config.on_error || 'die' ).toLowerCase() !== 'collect'
		) {
			throw new Error( report.errors[0].message );
		}
		return report.rows;
	}

	decode_report( text ) {
		const config = runtimeConfig( this.config, { on_error: 'collect' } );
		const rows = [];
		const errors = [];
		const nextLine = sourceLinesFromText( text );
		let headers = columnNamesFromConfig( config );
		let lineNumber = 0;
		let rowNumber = 0;
		let buffer = '';
		let recordStartLine = null;
		let skipRemaining = Number( config.skip_lines || 0 );

		while ( true ) {
			const line = nextLine();
			if ( line == null ) {
				break;
			}
			lineNumber++;
			if ( buffer === '' ) {
				if ( skipRemaining > 0 ) {
					skipRemaining--;
					continue;
				}
				if ( config.comment_char && line.startsWith( String( config.comment_char ) ) ) {
					continue;
				}
				if ( config.skip_empty_rows && /^\s*$/u.test( line ) ) {
					continue;
				}
				recordStartLine = lineNumber;
			}
			buffer += line;
			let row;
			try {
				row = parseRecord( buffer, config );
			}
			catch ( error ) {
				if ( error instanceof UnterminatedQuoteError ) {
					continue;
				}
				errors.push(
					csvErrorDetail(
						error,
						{
							line_number: recordStartLine,
							row_number: rowNumber + 1,
							raw_line: buffer,
						},
					)
				);
				buffer = '';
				break;
			}
			buffer = '';
			if ( !headers && config.headers ) {
				headers = normalizeHeaders( row, config );
				requireColumns( headers, config );
				continue;
			}
			try {
				rowNumber++;
				rows.push(
					applyRowRules(
						row,
						headers,
						config,
						{
							line_number: recordStartLine,
							row_number: rowNumber,
							raw_line: line,
						},
					)
				);
			}
			catch ( error ) {
				errors.push(
					csvErrorDetail(
						error,
						{
							line_number: recordStartLine,
							row_number: rowNumber,
							raw_line: line,
						},
					)
				);
				buffer = '';
			}
		}

		if ( buffer !== '' ) {
			try {
				const row = parseRecord( buffer, config );
				if ( !headers && config.headers ) {
					headers = normalizeHeaders( row, config );
					requireColumns( headers, config );
				}
				else {
					rowNumber++;
					rows.push(
						applyRowRules(
							row,
							headers,
							config,
							{
								line_number: recordStartLine,
								row_number: rowNumber,
								raw_line: buffer,
							},
						)
					);
				}
			}
			catch ( error ) {
				errors.push(
					csvErrorDetail(
						error,
						{
							line_number: recordStartLine,
							row_number: rowNumber + 1,
							raw_line: buffer,
						},
					)
				);
			}
		}

		return { rows, errors };
	}

	encode( rows ) {
		const input = Array.isArray( rows ) ? rows : [];
		const columns = outputColumnsFromRows( input, this.config );
		const lines = [];
		if ( this.config.headers && columns ) {
			lines.push( this.encode_row( columns ).replace( /\n$/u, '' ) );
		}
		for ( const row of input ) {
			lines.push(
				formatOutputRow( row, columns )
					.map( (value) => encodeCell( value, this.config ) )
					.join( String( this.config.sep_char ?? ',' ) )
			);
		}
		return lines.join( String( this.config.eol ?? '\n' ) ) + ( lines.length > 0 ? String( this.config.eol ?? '\n' ) : '' );
	}

	encode_row( row ) {
		const fields = formatOutputRow( row, null );
		return fields.map( (value) => encodeCell( value, this.config ) ).join( String( this.config.sep_char ?? ',' ) )
			+ String( this.config.eol ?? '\n' );
	}

	load( pathValue ) {
		if ( !isPath( pathValue ) ) {
			throw new Error( 'TypeException: CSV.load expects Path as first argument' );
		}
		assertCapability( 'fs', 'CSV.load is denied by runtime policy' );
		return this.decode( pathValue.slurp_utf8() );
	}

	load_report( pathValue ) {
		if ( !isPath( pathValue ) ) {
			throw new Error( 'TypeException: CSV.load_report expects Path as first argument' );
		}
		assertCapability( 'fs', 'CSV.load_report is denied by runtime policy' );
		return this.decode_report( pathValue.slurp_utf8() );
	}

	dump( pathValue, rows ) {
		if ( !isPath( pathValue ) ) {
			throw new Error( 'TypeException: CSV.dump expects Path as first argument' );
		}
		assertCapability( 'fs', 'CSV.dump is denied by runtime policy' );
		pathValue.spew_utf8( this.encode( rows ) );
		return pathValue;
	}

	open( pathValue ) {
		if ( !isPath( pathValue ) ) {
			throw new Error( 'TypeException: CSV.open expects Path as first argument' );
		}
		assertCapability( 'fs', 'CSV.open is denied by runtime policy' );
		return new CSVReader( pathValue, this.config );
	}

	open_writer( pathValue, options = {} ) {
		if ( !isPath( pathValue ) ) {
			throw new Error( 'TypeException: CSV.open_writer expects Path as first argument' );
		}
		assertCapability( 'fs', 'CSV.open_writer is denied by runtime policy' );
		return new CSVWriter( pathValue, normalizeConfig( this.config, options ) );
	}

	dump_query( pathValue, dbh, sql, bind = [], options = {} ) {
		if ( !isPath( pathValue ) ) {
			throw new Error( 'TypeException: CSV.dump_query expects Path as first argument' );
		}
		if ( !isDbHandle( dbh ) ) {
			throw new Error( 'TypeException: CSV.dump_query expects DatabaseHandle' );
		}
		assertCapability( 'fs', 'CSV.dump_query is denied by runtime policy' );
		assertCapability( 'db', 'CSV.dump_query is denied by runtime policy' );
		const stmt = dbh.prepare( String( sql ) );
		stmt.execute( ...( Array.isArray( bind ) ? bind : [] ) );
		const rows = stmt.all_dict();
		const config = normalizeConfig( this.config, { headers: true }, options );
		return new CSV( config ).dump( pathValue, rows );
	}

	dump_table( pathValue, dbh, table, options = {} ) {
		return this.dump_query(
			pathValue,
			dbh,
			`select * from ${quotedIdentifier( table )}`,
			[],
			normalizeConfig( { headers: true }, options )
		);
	}

	load_table( pathValue, dbh, table, options = {} ) {
		if ( !isPath( pathValue ) ) {
			throw new Error( 'TypeException: CSV.load_table expects Path as first argument' );
		}
		if ( !isDbHandle( dbh ) ) {
			throw new Error( 'TypeException: CSV.load_table expects DatabaseHandle' );
		}
		assertCapability( 'fs', 'CSV.load_table is denied by runtime policy' );
		assertCapability( 'db', 'CSV.load_table is denied by runtime policy' );
		const config = normalizeConfig( this.config, options );
		const reader = new CSV( config ).open( pathValue );
		let sourceColumns = reader.columns();
		let firstRow = sourceColumns ? reader.next_dict() : reader.next_array();
		if ( firstRow == null ) {
			reader.close();
			return 0;
		}
		if ( !sourceColumns ) {
			sourceColumns = Array.isArray( firstRow )
				? defaultColumnsForRow( firstRow )
				: Object.keys( firstRow );
			reader.set_columns( sourceColumns );
			if ( Array.isArray( firstRow ) ) {
				firstRow = Object.fromEntries(
					sourceColumns.map( (name, index) => [ name, firstRow[index] ] )
				);
			}
		}

		const targetColumns = sourceColumns.map(
			(name) => config.column_map && Object.prototype.hasOwnProperty.call( config.column_map, name )
				? config.column_map[name]
				: name
		);

		if ( config.create_table ) {
			if ( String( config.if_exists || 'append' ).toLowerCase() === 'replace' ) {
				dbh.prepare( `drop table if exists ${quotedIdentifier( table )}` ).execute();
			}
			const defs = targetColumns.map( (name, index) => {
				let type = 'TEXT';
				if ( Array.isArray( config.column_types ) ) {
					type = String( config.column_types[index] || 'TEXT' );
				}
				else if ( isPlainObject( config.column_types ) ) {
					type = String( config.column_types[name] || 'TEXT' );
				}
				return `${quotedIdentifier( name )} ${type}`;
			} );
			const ifNotExists = String( config.if_exists || 'append' ).toLowerCase() === 'append'
				? ' if not exists'
				: '';
			dbh.prepare(
				`create table${ifNotExists} ${quotedIdentifier( table )} (${defs.join( ', ' )})`
			).execute();
		}

		const conflict = String( config.conflict || '' ).trim();
		const insertPrefix = conflict === '' || conflict.toLowerCase() === 'default'
			? 'insert'
			: `insert or ${conflict.toUpperCase()}`;
		const placeholders = targetColumns.map( () => '?' ).join( ', ' );
		const stmt = dbh.prepare(
			`${insertPrefix} into ${quotedIdentifier( table )} (${targetColumns.map( quotedIdentifier ).join( ', ' )}) values (${placeholders})`
		);

		const transactionEnabled = config.transaction !== false;
		const commitInterval = Number( config.commit_interval || 0 );
		let count = 0;
		if ( transactionEnabled ) {
			dbh.begin();
		}
		try {
			const writeRow = (row) => {
				const dict = Array.isArray( row )
					? Object.fromEntries( sourceColumns.map( (name, index) => [ name, row[index] ] ) )
					: row;
				const values = sourceColumns.map( (name) => dict[name] );
				stmt.execute( ...values );
				count++;
				if ( transactionEnabled && commitInterval > 0 && count % commitInterval === 0 ) {
					dbh.commit();
					dbh.begin();
				}
			};
			writeRow( firstRow );
			let row;
			while ( ( row = reader.next_dict() ) !== null ) {
				writeRow( row );
			}
			if ( transactionEnabled ) {
				dbh.commit();
			}
		}
		catch ( error ) {
			if ( transactionEnabled ) {
				dbh.rollback();
			}
			reader.close();
			throw error;
		}
		reader.close();
		return count;
	}
}

module.exports = {
	CSV,
	CSVReader,
	CSVWriter,
	__zuzu_set_runtime_policy( policy = {} ) {
		runtimePolicy = { ...runtimePolicy, ...policy };
	},
};
