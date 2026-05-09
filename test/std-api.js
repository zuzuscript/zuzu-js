'use strict';

const assert = require( 'node:assert/strict' );
const { BinaryString } = require( '../lib/runtime-helpers' );
const { Archive } = require( '../modules/std/archive.js' );
const { CSV } = require( '../modules/std/data/csv.js' );
const { JSON: JSONCodec } = require( '../modules/std/data/json.js' );
const { Path } = require( '../modules/std/io.js' );
const { CookieJar, Request, Response, UserAgent } = require( '../modules/std/net/http.js' );
const { Mailer, MailResult } = require( '../modules/std/net/smtp.js' );

const { escape, fill_template, parse, unescape } = require( '../modules/std/net/url.js' );

{
	const bin = ( text ) => new BinaryString( Uint8Array.from( Buffer.from( text, 'utf8' ) ) );
	const source = {
		entries: [
			{ path: 'hello.txt', data: bin( 'Hello\n' ) },
			{ path: 'nested/world.txt', data: bin( 'World\n' ) },
		],
	};
	const tgz = Archive.encode( source, 'tar.gz' );
	const fromTgz = Archive.decode( tgz );
	assert.equal( fromTgz.format, 'tar.gz' );
	assert.equal( fromTgz.entries[0].path, 'hello.txt' );
	assert.equal( Buffer.from( fromTgz.entries[1].data.bytes ).toString( 'utf8' ), 'World\n' );

	const zip = Archive.encode( source, 'zip' );
	const fromZip = Archive.decode( zip );
	assert.equal( fromZip.format, 'zip' );
	assert.equal( fromZip.entries[1].path, 'nested/world.txt' );
	assert.equal( Buffer.from( fromZip.entries[0].data.bytes ).toString( 'utf8' ), 'Hello\n' );

	const gz = Archive.encode(
		{ entries: [ { path: 'payload.txt', data: bin( 'single\n' ) } ] },
		'gz'
	);
	const fromGz = Archive.decode( gz );
	assert.equal( fromGz.format, 'gz' );
	assert.equal( fromGz.entries[0].path, 'payload.txt' );
	assert.equal( Buffer.from( fromGz.entries[0].data.bytes ).toString( 'utf8' ), 'single\n' );

	const tbz2 = Archive.encode(
		{ entries: [ { path: 'bzip.txt', data: bin( 'bz2 ok\n' ) } ] },
		'tar.bz2'
	);
	const fromTbz2 = Archive.decode( tbz2 );
	assert.equal( fromTbz2.format, 'tar.bz2' );
	assert.equal( Buffer.from( fromTbz2.entries[0].data.bytes ).toString( 'utf8' ), 'bz2 ok\n' );

	const dir = Path.tempdir();
	const sourceFile = dir.child( 'from-file.txt' );
	sourceFile.spew( bin( 'from path\n' ) );
	const fromFileZip = Archive.encode(
		{ entries: [ { path: 'copied.txt', data_from: sourceFile } ] },
		'zip'
	);
	const fromFileLoaded = Archive.decode( fromFileZip );
	assert.equal( fromFileLoaded.entries[0].path, 'copied.txt' );
	assert.equal( Buffer.from( fromFileLoaded.entries[0].data.bytes ).toString( 'utf8' ), 'from path\n' );

	const zipPath = dir.child( 'sample.zip' );
	Archive.dump( zipPath, source );
	const loadedZip = Archive.load( zipPath );
	assert.equal( loadedZip.format, 'zip' );
	assert.equal( loadedZip.entries[1].path, 'nested/world.txt' );

	assert.throws(
		() => Archive.dump( 'archive.zip', source ),
		/TypeException: Archive\.dump expects Path as first argument/u
	);
	assert.throws(
		() => Archive.encode( { entries: [ { path: 'bad.txt', data: 'oops' } ] }, 'zip' ),
		/TypeException: Archive\.encode archive\.entries\[0\]\.data expects BinaryString, got String/u
	);
	assert.throws(
		() => Archive.encode( { entries: [ { path: 'bad.txt', data_from: 'oops' } ] }, 'zip' ),
		/TypeException: Archive\.encode archive\.entries\[0\]\.data_from expects Path as first argument/u
	);
	assert.throws(
		() => Archive.encode(
			{
				entries: [
					{ path: 'a.txt', data: bin( 'a' ) },
					{ path: 'b.txt', data: bin( 'b' ) },
				],
			},
			'gz'
		),
		/expects exactly one entry/u
	);
}

{
	const csv = new CSV( { headers: true } );
	const rows = csv.decode( 'name,age\nAda,32\nBob,27\n' );
	assert.equal( rows[0].name, 'Ada' );
	const file = Path.tempfile();
	csv.dump( file, rows );
	assert.equal( csv.load( file )[1].age, '27' );
}

{
	const codec = new JSONCodec( { canonical: true } );
	assert.equal( codec.encode( { foo: 1, bar: 2 } ), '{"bar":2,"foo":1}' );
	const file = Path.tempfile();
	codec.dump( file, { answer: 42 } );
	assert.equal( codec.load( file ).answer, 42 );
	assert.throws(
		() => codec.dump( 'data.json', { answer: 7 } ),
		/TypeException: JSON\.dump expects Path as first argument/u
	);
	assert.throws(
		() => codec.load( 'data.json' ),
		/TypeException: JSON\.load expects Path as first argument/u
	);
}


{
	assert.equal( escape( 'tea time+milk' ), 'tea%20time%2Bmilk' );
	assert.equal( unescape( 'tea%20time%2Bmilk' ), 'tea time+milk' );
	const parsed = parse( 'https://user@example.com:8443/a/b?x=1&y=two#frag' );
	assert.equal( parsed.scheme, 'https' );
	assert.equal( parsed.userinfo, 'user' );
	assert.equal( parsed.host, 'example.com' );
	assert.equal( parsed.port, '8443' );
	assert.equal( parsed.path, '/a/b' );
	assert.equal( parsed.query_params.x, '1' );
	assert.equal( parsed.query_params.y, 'two' );
	assert.equal(
		fill_template( 'https://api.example.com/{version}/users/{id}{?q}', { version: 'v1', id: 7, q: 'tea time' } ),
		'https://api.example.com/v1/users/7?q=tea%20time'
	);
}

{
	const jar = new CookieJar();
	jar.add( 'https://example.com/', 'a=b' );
	assert.equal( jar.cookie_header( 'https://example.com/' ), 'a=b' );
	jar.clear();
	assert.equal( jar.cookie_header( 'https://example.com/' ), null );

	const ua = new UserAgent( {
		agent: 'zuzu-test/0.1',
		default_headers: { accept: 'text/html' },
		cookie_jar: jar,
	} );
	const req = ua.build_request( 'GET', 'https://example.com/' );
	assert.ok( req instanceof Request );
	const resp = ua.send( req );
	assert.ok( resp instanceof Response );
	assert.ok( resp.status() > 0 );
	assert.ok( resp.content() != null );
}

{
	const fs = require( 'node:fs' );
	const os = require( 'node:os' );
	const path = require( 'node:path' );
	const tmp = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-smtp-js-' ) );
	const fixture = path.join( tmp, 'fake-sendmail.pl' );
	const argvFile = path.join( tmp, 'argv.txt' );
	const stdinFile = path.join( tmp, 'stdin.bin' );
	fs.writeFileSync( fixture, `
		my ( $argv_file, $stdin_file, $exit ) = splice @ARGV, 0, 3;
		open my $afh, '>', $argv_file or die $!;
		binmode $afh;
		print {$afh} join "\\n", @ARGV;
		close $afh;
		open my $sfh, '>', $stdin_file or die $!;
		binmode STDIN;
		binmode $sfh;
		local $/;
		print {$sfh} scalar <STDIN>;
		close $sfh;
		exit $exit;
	`, 'utf8' );
	const headers = new ( require( '../lib/collections' ).PairList )();
	headers.add( 'From', 'sender@example.test' );
	headers.add( 'X-Dup', 'one' );
	headers.add( 'X-Dup', 'two' );
	headers.add( 'Message-ID', '<js@example.test>' );
	const body = new BinaryString( Uint8Array.from( Buffer.from( 'Body\r\n', 'utf8' ) ) );
	const mailer = new Mailer( {
		transport: 'sendmail',
		sendmail_path: '/usr/bin/env',
		sendmail_args: [ 'perl', fixture, argvFile, stdinFile, '0' ],
	} );
	const result = mailer.send(
		'sender@example.test',
		[ 'rcpt@example.test' ],
		headers,
		body
	);
	assert.ok( result instanceof MailResult );
	assert.equal( result.transport, 'sendmail' );
	assert.equal( result.accepted[0], 'rcpt@example.test' );
	assert.equal( result.message_id, '<js@example.test>' );
	assert.equal(
		fs.readFileSync( argvFile, 'utf8' ),
		'-i\n-f\nsender@example.test\nrcpt@example.test'
	);
	assert.equal(
		fs.readFileSync( stdinFile, 'utf8' ),
		'From: sender@example.test\r\nX-Dup: one\r\nX-Dup: two\r\n'
			+ 'Message-ID: <js@example.test>\r\n\r\nBody\r\n'
	);
	assert.throws(
		() => mailer.send( 'sender@example.test', 'rcpt@example.test', {}, body ),
		/mail\.invalid_headers: headers expects PairList/u
	);
	assert.throws(
		() => mailer.send( 'sender@example.test', 'rcpt@example.test', { list: [] }, body ),
		/mail\.invalid_headers: headers expects PairList/u
	);
	assert.throws(
		() => mailer.send( 'sender@example.test', 'rcpt@example.test', headers, 'Body' ),
		/TypeException: Mailer\.send body expects BinaryString, got String/u
	);
	const badHeaders = new ( require( '../lib/collections' ).PairList )();
	badHeaders.add( 'X-Number', 7 );
	assert.throws(
		() => mailer.send( 'sender@example.test', 'rcpt@example.test', badHeaders, body ),
		/header 'X-Number' expects String or BinaryString, got Number/u
	);
	assert.throws(
		() => new Mailer( {
			transport: 'sendmail',
			sendmail_path: '/usr/bin/env',
			sendmail_args: [ '-t' ],
		} ),
		/sendmail_args must not enable header-derived recipients/u
	);
	assert.throws(
		() => new Mailer( {
			transport: 'sendmail',
			sendmail_path: '/usr/bin/env',
			username: 'sender@example.test',
			password: 'secret',
		} ).send( 'sender@example.test', 'rcpt@example.test', headers, body ),
		/mail\.auth: SMTP authentication without TLS requires allow_insecure_auth/u
	);
}

console.log( 'stdlib api tests passed' );
