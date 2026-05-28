'use strict';

const assert = require( 'node:assert/strict' );
const crypto = require( 'node:crypto' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const util = require( 'node:util' );
const vm = require( 'node:vm' );

const bundlePath = path.join( __dirname, '..', 'dist', 'zuzu-browser.js' );
assert.ok(
	fs.existsSync( bundlePath ),
	'run extras/zuzu-js/bin/build-browser-bundle before browser bundle tests'
);

const listeners = new Map();
const context = {
	console,
	TextDecoder: util.TextDecoder,
	TextEncoder: util.TextEncoder,
	URL,
	crypto: crypto.webcrypto,
	queueMicrotask,
	document: {
		readyState: 'loading',
		querySelectorAll() {
			return [];
		},
		addEventListener( event, handler ) {
			listeners.set( event, handler );
		},
	},
};
context.window = context;

function createVmWorkerFactory() {
	return function vmWorkerFactory( options = {} ) {
		const source = String( options.source || '' );
		let mainMessageHandler = null;
		let mainErrorHandler = null;
		let terminated = false;
		const workerListeners = new Map();
		const workerContext = {
			console,
			TextDecoder: util.TextDecoder,
			TextEncoder: util.TextEncoder,
			URL,
			queueMicrotask: queueMicrotask.bind( globalThis ),
			setTimeout: setTimeout.bind( globalThis ),
			clearTimeout: clearTimeout.bind( globalThis ),
			addEventListener( event, handler ) {
				workerListeners.set( event, handler );
			},
			postMessage( message ) {
				if ( terminated || !mainMessageHandler ) {
					return;
				}
				Promise.resolve().then( () => {
					if ( !terminated ) {
						mainMessageHandler( { data: message } );
					}
				} );
			},
		};
		workerContext.self = workerContext;
		workerContext.globalThis = workerContext;
		vm.createContext( workerContext );
		try {
			vm.runInContext( source, workerContext, {
				filename: 'zuzu-browser-worker.js',
			} );
		}
		catch ( err ) {
			Promise.resolve().then( () => {
				if ( mainErrorHandler ) {
					mainErrorHandler( err );
				}
			} );
		}
		return {
			addEventListener( event, handler ) {
				if ( event === 'message' ) {
					mainMessageHandler = handler;
				}
				else if ( event === 'error' ) {
					mainErrorHandler = handler;
				}
			},
			postMessage( message ) {
				const handler = workerListeners.get( 'message' )
					|| workerContext.onmessage;
				if ( terminated || typeof handler !== 'function' ) {
					return;
				}
				Promise.resolve().then( () => {
					if ( !terminated ) {
						handler( { data: message } );
					}
				} );
			},
			terminate() {
				terminated = true;
			},
		};
	};
}

vm.createContext( context );
const bundleSource = fs.readFileSync( bundlePath, 'utf8' );
assert.doesNotMatch(
	bundleSource,
	/extras\/zuzu-js\/lib\/host\/node-host\.js/u,
	'browser bundle must not include the Node host'
);
assert.doesNotMatch(
	bundleSource,
	/extras\/zuzu-js\/lib\/runtime-entrypoints\.js/u,
	'browser bundle must not include Node runtime entrypoints'
);
assert.doesNotMatch(
	bundleSource,
	/lib\/paths\.js/u,
	'browser bundle must not include Node filesystem path helpers'
);
vm.runInContext( bundleSource, context, {
	filename: bundlePath,
} );

assert.equal( typeof context.ZuzuBrowser, 'object' );
assert.equal( typeof context.ZuzuBrowser.createBrowserRuntime, 'function' );
assert.equal( typeof context.ZuzuBrowser.createBrowserGuiBridge, 'function' );
assert.equal( typeof context.ZuzuBrowser.createBrowserGuiRenderer, 'function' );
assert.equal( typeof context.ZuzuBrowser.zuzu_eval, 'function' );
assert.equal( typeof context.zuzu_eval, 'function' );
assert.equal( typeof context.zuzu_run, 'function' );
assert.equal( typeof context.zuzu_compile, 'function' );
assert.equal( context.zuzu_eval( '5 mod 2' ), 1 );

{
	const runtime = context.ZuzuBrowser.createBrowserRuntime(
		context.__ZUZU_BROWSER_DEFAULT_RUNTIME_OPTIONS__
	).runtime;
	const { Button } = runtime.loadModule( 'std/gui/objects', '/app/main.zzs' );
	class MinifiedButton extends Button {}
	assert.equal(
		new MinifiedButton( { text: 'OK' } ).__zuzu_gui_snapshot().type,
		'Button',
		'GUI snapshot types must survive class-name minification',
	);
}

const requiredModules = [
	[
		'std/string',
		`from std/string import trim; say( trim( '  hi  ' ) );`,
		'hi',
	],
	[
		'std/string/quoted_printable',
		`
			from std/string/quoted_printable import encode, decode;
			from std/string/base64 import decode as b64_decode;
			say( encode( b64_decode( "YT1i" ) ) );
			say( to_string( decode( "a=3Db" ) ) );
		`,
		'a=3Db\na=b',
	],
	[
		'std/time',
		`from std/time import Time; say( new Time( 0 ).year() );`,
		'1970',
	],
	[
		'std/data/json',
		`
			from std/data/json import JSON;
			say( new JSON( canonical: true ).encode( { b: 2, a: 1 } ) );
		`,
		'{"a":1,"b":2}',
	],
	[
		'std/path/jsonpointer',
		`
			from std/path/jsonpointer import JSONPointer;
			let pointer := new JSONPointer( path: "/foo/0" );
			say( pointer.first( { foo: [ "bar" ] } ) );
		`,
		'bar',
	],
	[
		'std/data/json/schema',
		`
			from std/data/json/schema import FormatError, valid, validate;
			say( valid( { type: "object" }, { name: "Ada" } ) );
			let result := validate(
				{ type: "string", format: "email" },
				"not email",
				{ format_assert: true },
			);
			say( result.errors()[0] instanceof FormatError );
		`,
		'true\n1',
	],
	[
		'std/data/xml',
		`
			from std/data/xml import XML;
			let parsed := XML.parse( '<root>z</root>' );
			say( parsed.documentElement().nodeName() );
		`,
		'root',
	],
	[
		'std/uuid',
		`from std/uuid import create_uuid; say( typeof create_uuid );`,
		'Function',
	],
	[
		'std/net/http',
		`
			from std/net/http import CookieJar, UserAgent;
			let jar := new CookieJar();
			let ua := new UserAgent( cookie_jar: jar );
			let req := ua.build_request( 'GET', 'https://example.com/' );
			say( typeof req );
			let resp := ua.send(req);
			say( resp.status() );
			say( resp.reason() );
		`,
		'Request\n599\nSynchronous HTTP is unsupported on JS/Browser',
	],
	[
		'std/net/http browser TLS policy',
		`
			from std/net/http import UserAgent;
			let ua := new UserAgent( tls_verify: false );
			let req := ua.build_request( 'GET', 'https://example.com/' );
			try {
				ua.send(req);
				say(false);
			}
			catch ( Exception e ) {
				if ( e ~ /TLS client configuration/ ) {
					say(true);
				}
				else {
					say(false);
				}
			}
		`,
		'true',
	],
	[
		'std/path/z',
		`
			from std/path/z import ZPath;
			let query := new ZPath( path: "/users/#0/name" );
			say( query.first( { users: [ { name: "Ada" } ] } ) );
		`,
		'Ada',
	],
	[
		'std/math',
		`from std/math import Math; say( Math.sum( 1, 2, 3 ) );`,
		'6',
	],
	[
		'std/secure',
		`
			from std/secure import
				Certificate,
				Cipher,
				KeyDerivation,
				PasswordHash,
				Secure,
				SecureRandom,
				SigningKey;
			say( Secure.capabilities(){host} );
			say( Secure.capabilities(){random} );
			say( Secure.has( "password_hash", "pbkdf2-sha256" ) );
			say( Secure.has( "password_hash", "argon2id" ) );
			say( Secure.has( "password_hash", "scrypt" ) );
			say( Secure.has( "password_hash", "crypt" ) );
			say( Secure.has( "signing", "ed25519" ) );
			say( Secure.has( "signing", "ecdsa-p256-sha256" ) );
			say( Secure.has( "signing", "ecdsa-p384-sha384" ) );
			say( Secure.has( "key_agreement", "x25519" ) );
			say( Secure.capabilities(){async_required}{password_hash} );
			say( Secure.capabilities(){async_required}{signing} );
			say( Secure.capabilities(){async_required}{key_agreement} );
			say( Secure.has( "certificate", "parse-x509-der" ) );
			say( Secure.has( "certificate", "parse-x509" ) );
			say( Secure.has( "certificate", "fingerprint-sha256" ) );
			say( Secure.has( "certificate", "fingerprint-sha384" ) );
			say( Secure.has( "certificate", "fingerprint-sha512" ) );
			say( Secure.has( "certificate", "public-key" ) );
			say( Secure.has( "certificate", "verify-chain" ) );
			say( Secure.has( "tls_identity", "pem" ) );
			say( Secure.has( "tls_identity", "pkcs12" ) );
			say( PasswordHash.default_algorithm() );
			say( Secure.has( "cipher", "aes-128-gcm" ) );
			say( Secure.has( "cipher", "aes-192-gcm" ) );
			say( Secure.has( "cipher", "aes-256-gcm" ) );
			say( Secure.has( "cipher", "chacha20-poly1305" ) );
			try {
				Cipher.generate_key( "aes-128-gcm" );
				say(false);
			}
			catch ( Exception e ) {
				if ( e ~ /not available|unsupported/ ) {
					say(true);
				}
				else {
					say(false);
				}
			}
			try {
				Cipher.generate_key( "chacha20-poly1305" );
				say(false);
			}
			catch ( Exception e ) {
				if ( e ~ /not available|unsupported/ ) {
					say(true);
				}
				else {
					say(false);
				}
			}
			say( Secure.capabilities(){async_required}{cipher} );
			say( typeof SecureRandom.bytes(1) );
			say( length Cipher.generate_key() );
			say( length KeyDerivation.hkdf_sha256( to_binary("ikm"), 32 ) );
		`,
		'browser\ntrue\ntrue\nfalse\nfalse\nfalse\nfalse\ntrue\ntrue\ntrue\ntrue\ntrue\ntrue\ntrue\nfalse\ntrue\nfalse\nfalse\nfalse\nfalse\ntrue\nfalse\npbkdf2-sha256\nfalse\nfalse\ntrue\nfalse\ntrue\ntrue\ntrue\nBinaryString\n32\n32',
	],
	[
		'std/secure certificate',
		`
			from std/secure import Certificate;
			from std/string/base64 import decode, encode;
			let der := decode("MIIBgjCCASigAwIBAgIHAaKzxNXm9zAKBggqhkjOPQQDAjAdMRswGQYDVQQDDBJadXp1IFBoYXNlIDEwIFRlc3QwHhcNMjYwNTA2MDk1MDI3WhcNMzYwNTAzMDk1MDI3WjAdMRswGQYDVQQDDBJadXp1IFBoYXNlIDEwIFRlc3QwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAQNhaMBEKKr40vbIIbpk9XaqHPpsVRCG1kXWCMCzZg4P9fjfoMj/hpxyTrg/6Lt9gjKf2n11W7aLsva3lwoKvApo1MwUTAdBgNVHQ4EFgQUz4hGUwtnqKFeiRnGXpzKZyov4uIwHwYDVR0jBBgwFoAUz4hGUwtnqKFeiRnGXpzKZyov4uIwDwYDVR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAgNIADBFAiEA18V9akgZ8/7gfjk6rCjYgQXc8ziib4j9ykw9/jmE8vECIAtIe34EJdQlsSKrqtjjwILidcouqpyPofHYArmX3qoW");
			let cert := Certificate.parse(der);
			say( typeof cert );
			say( cert.serial_number() );
			say( cert.not_before().epoch() );
			say( encode( cert.fingerprint("sha256") ) );
			say( Certificate.parse_chain(der).length() );
			if ( cert.to_der() == der ) {
				say(true);
			}
			else {
				say(false);
			}
			try {
				Certificate.parse( decode("AA==") );
				say(false);
			}
			catch ( Exception e ) {
				if ( e ~ /DER X.509/ ) {
					say(true);
				}
				else {
					say(false);
				}
			}
			try {
				cert.fingerprint("sha384");
				say(false);
			}
			catch ( Exception e ) {
				if ( e ~ /sha256|not available/ ) {
					say(true);
				}
				else {
					say(false);
				}
			}
			try {
				Certificate.parse("-----BEGIN CERTIFICATE-----\\nAA==\\n-----END CERTIFICATE-----\\n");
				say(false);
			}
			catch ( Exception e ) {
				if ( e ~ /DER BinaryString/ ) {
					say(true);
				}
				else {
					say(false);
				}
			}
			try {
				Certificate.verify_chain([ cert ]);
				say(false);
			}
			catch ( Exception e ) {
				if ( e ~ /not supported/ ) {
					say(true);
				}
				else {
					say(false);
				}
			}
			try {
				cert.public_key();
				say(false);
			}
			catch ( Exception e ) {
				if ( e ~ /not supported/ ) {
					say(true);
				}
				else {
					say(false);
				}
			}
		`,
		'Certificate\n01A2B3C4D5E6F7\n1778061027\npvGPojgxS7kYopcpTQv1ImVDg5hxcmNh+7VAzRrKXTw=\n1\ntrue\ntrue\ntrue\ntrue\ntrue\ntrue',
	],
	[
		'std/secure TLS identity',
		`
			from std/secure import TlsIdentity;
			from std/string/base64 import decode;
			let cert_pem := "-----BEGIN CERTIFICATE-----\\n"
				_ "MIIBiTCCATCgAwIBAgIHEaKzxNXm9zAKBggqhkjOPQQDAjAhMR8wHQYDVQQDDBZa\\n"
				_ "dXp1IFBoYXNlIDExIElkZW50aXR5MB4XDTI2MDUwNjEwMTQwMFoXDTM2MDUwMzEw\\n"
				_ "MTQwMFowITEfMB0GA1UEAwwWWnV6dSBQaGFzZSAxMSBJZGVudGl0eTBZMBMGByqG\\n"
				_ "SM49AgEGCCqGSM49AwEHA0IABBqh009HRDMap7KENy3wz6T4BMwm0NGlhDUj2rq2\\n"
				_ "8AV1NNXSPHZVEN7KZL5lEIxtpGCIor7RUwQIh7ZZx6BBbMOjUzBRMB0GA1UdDgQW\\n"
				_ "BBTubhkQTDb7kJ1TAUHfRS9SpoyeZjAfBgNVHSMEGDAWgBTubhkQTDb7kJ1TAUHf\\n"
				_ "RS9SpoyeZjAPBgNVHRMBAf8EBTADAQH/MAoGCCqGSM49BAMCA0cAMEQCIDOWVQ8D\\n"
				_ "O1yB29Gh5hK2NMClbtXOD4MLGZ3DVde8/0BtAiBxzs7F8HP38PM74WglPjqg63c0\\n"
				_ "vep6a0oDQ0c+HxrZYQ==\\n"
				_ "-----END CERTIFICATE-----\\n";
			let key_pem := "-----BEGIN EC PRIVATE KEY-----\\n"
				_ "MHcCAQEEIOMgouBB7RG00/bWhg0h6/31QaDuU6JzcxJqOz+t2MjhoAoGCCqGSM49\\n"
				_ "AwEHoUQDQgAEGqHTT0dEMxqnsoQ3LfDPpPgEzCbQ0aWENSPaurbwBXU01dI8dlUQ\\n"
				_ "3spkvmUQjG2kYIiivtFTBAiHtlnHoEFsww==\\n"
				_ "-----END EC PRIVATE KEY-----\\n";
			let identity := TlsIdentity.from_pem( cert_pem, key_pem );
			say( typeof identity );
			say( identity.certificate().serial_number() );
			say( identity.certificate().not_before().epoch() );
			try {
				identity.private_key();
				say(false);
			}
			catch ( Exception e ) {
				if ( e ~ /not supported/ ) {
					say(true);
				}
				else {
					say(false);
				}
			}
			try {
				TlsIdentity.from_pkcs12( decode("AA=="), "password" );
				say(false);
			}
			catch ( Exception e ) {
				if ( e ~ /not supported/ ) {
					say(true);
				}
				else {
					say(false);
				}
			}
		`,
		'TlsIdentity\n11A2B3C4D5E6F7\n1778062440\ntrue\ntrue',
	],
	[
		'std/task',
		`
			from std/task import resolved;
			let task := resolved(null);
			say( typeof task );
		`,
		'Task',
	],
	[
		'std/eval',
		`from std/eval import eval; say( eval( "6 * 7" ) );`,
		'42',
	],
	[
		'std/gui',
		`
			from std/gui import *;
			let ui := gui_from_xml(
				"<Window title=\\"Bundle XML\\"><Button id=\\"ok\\" text=\\"OK\\" /></Window>"
			);
			say( __system__{deny_gui} );
			say( typeof Window );
			say( ui.title() );
			say( ui.title );
			say( ui.find_by_id( "ok" ).text() );
			say( ui.find_by_id( "ok" ).text );
		`,
		'false\nFunction\nBundle XML\nBundle XML\nOK\nOK',
	],
	[
		'std/template/z',
		`
			from std/template/z import ZTemplate;
			let tmpl := new ZTemplate( string: "Hello {{ name }}!" );
			say( tmpl.process( { name: "Ada" } ) );
		`,
		'Hello Ada!',
	],
	[
		'std/template/zz',
		`
			from std/template/zz import ZZTemplate;
			let tmpl := new ZZTemplate( string: "{{ zero ?: fallback }}" );
			say( tmpl.process( { zero: 0, fallback: "yes" } ) );
		`,
		'yes',
	],
	[
		'std/dump',
		`from std/dump import Dumper; say( typeof Dumper );`,
		'Class',
	],
	[
		'std/marshal',
		`
			from std/marshal import
				dump,
				load,
				safe_to_dump,
				MarshallingException,
				UnmarshallingException;
			say( typeof dump );
			say( typeof load );
			say( typeof safe_to_dump );
			say( typeof MarshallingException );
			say( typeof UnmarshallingException );
		`,
		'Function\nFunction\nFunction\nClass\nClass',
	],
	[
		'std/worker',
		`
			from std/worker import Worker;
			say( Worker can "spawn" );
			say( Worker can "spawn_handle" );
		`,
		'1\n1',
	],
];

for ( const [ name, source, expected ] of requiredModules ) {
	const result = context.zuzu_run( source, { throwOnError: false } );
	assert.equal( result.status, 0, `${name} failed: ${result.stderr}` );
	assert.equal( result.stdout.trimEnd(), expected, `${name} output` );
}

{
	const dialogCalls = [];
	const fakeDocument = {
		head: {
			appendChild() {},
		},
		body: {
			appendChild() {},
		},
		createElement( tagName ) {
			return {
				tagName: String( tagName ).toUpperCase(),
				children: [],
				dataset: {},
				style: {},
				classList: {
					add() {},
					toggle() {},
				},
				append() {},
				appendChild() {},
				addEventListener() {},
				setAttribute() {},
			};
		},
		getElementById() {
			return null;
		},
	};
	const runtime = context.ZuzuBrowser.createBrowserRuntime( {
		document: fakeDocument,
		guiRoot: {
			ownerDocument: fakeDocument,
			appendChild() {},
		},
		guiDialogs: {
			alert( message ) {
				dialogCalls.push( [ 'alert', message ] );
			},
			confirm( message ) {
				dialogCalls.push( [ 'confirm', message ] );
				return true;
			},
			prompt( message, value ) {
				dialogCalls.push( [ 'prompt', message, value ] );
				return message === 'Colour:' ? 'red' : 'Ada';
			},
		},
	} );
	const result = runtime.zuzu_run(
		`
			from std/gui/dialogue import alert, confirm, prompt, colour_picker;
			alert( "Saved" );
			say( confirm( "Continue?" ) );
			say( prompt( "Name:", value: "Grace" ) );
			say( colour_picker( value: "#000000" ) );
		`,
		{ throwOnError: false },
	);
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout.trimEnd(), 'true\nAda\n#ff0000' );
	assert.deepEqual(
		dialogCalls,
		[
			[ 'alert', 'Saved' ],
			[ 'confirm', 'Continue?' ],
			[ 'prompt', 'Name:', 'Grace' ],
			[ 'prompt', 'Colour:', '#000000' ],
		],
	);
	const denied = runtime.zuzu_run(
		'from std/gui/dialogue import file_open; file_open();',
		{ throwOnError: false },
	);
	assert.notEqual( denied.status, 0 );
	assert.match( denied.stderr, /GUI_DIALOGUE_/ );
}

{
	const result = context.zuzu_run(
		'from std/clib import CLib;',
		{ throwOnError: false },
	);
	assert.notEqual( result.status, 0 );
	assert.match( result.stderr, /unsupported capability 'clib'/ );
}

async function runAsyncTests() {
	const runtime = context.ZuzuBrowser.createBrowserRuntime( {
		workerFactory: createVmWorkerFactory(),
	} );
	const secureResult = await runtime.zuzu_run(
		`
			from std/secure import
				Cipher,
				KeyAgreement,
				KeyDerivation,
				PasswordHash,
				Secure,
				SigningKey;
			from std/string/base64 import decode, encode;
			async function main () {
				let out := await {
					KeyDerivation.hkdf_sha256_async( to_binary("ikm"), 32 );
				};
				say( typeof out );
				say( length out );
				let salt := decode("AAECAwQFBgcICQoLDA0ODw==");
				let hashed := await {
					PasswordHash.hash_async(
						"correct horse battery staple",
						{ iterations: 1000, salt: salt },
					);
				};
				say(hashed);
				say( await {
					PasswordHash.verify_async(
						"correct horse battery staple",
						hashed,
					);
				} );
				say( encode( await {
					PasswordHash.derive_key_async(
						"correct horse battery staple",
						{ iterations: 1000, salt: salt },
					);
				} ) );
				for ( let algorithm in [ "argon2id", "scrypt" ] ) {
					try {
						await {
							PasswordHash.hash_async(
								"correct horse battery staple",
								{ algorithm: algorithm, salt: salt },
							);
						};
						say(false);
					}
					catch ( Exception e ) {
						if ( e ~ /not available|unsupported/ ) {
							say(true);
						}
						else {
							say(false);
						}
					}
				}
				let key := Cipher.generate_key();
				let plaintext := decode("c2VjcmV0");
				let aad := decode("Y29udGV4dA==");
				let sealed := await {
					Cipher.encrypt_async(
						plaintext,
						key,
						{ aad: aad },
					);
				};
				let opened := await {
					Cipher.decrypt_async(
						sealed,
						key,
						{ aad: aad },
					);
				};
				say( encode(opened) );
				for ( let algorithm in [
					"ecdsa-p256-sha256",
					"ecdsa-p384-sha384",
				] ) {
					let ecdsa_signing := await {
						SigningKey.generate_async(algorithm);
					};
					let ecdsa_public := ecdsa_signing.public_key();
					let ecdsa_message := to_binary(algorithm);
					let ecdsa_signature := await {
						ecdsa_signing.sign_async(ecdsa_message);
					};
					say( await {
						ecdsa_public.verify_async(
							ecdsa_message,
							ecdsa_signature,
						);
					} );
					say( length ecdsa_signing.export_private() );
					say( length ecdsa_public.export() );
				}
				if ( Secure.has( "key_agreement", "x25519" ) ) {
					let alice := await {
						KeyAgreement.generate_async("x25519");
					};
					let bob := await {
						KeyAgreement.generate_async();
					};
					let alice_public := alice.public_key();
					let bob_public := bob.public_key();
					let alice_secret := await {
						alice.derive_async(bob_public);
					};
					let bob_secret := await {
						bob.derive_async(alice_public);
					};
					if ( encode(alice_secret) eq encode(bob_secret) ) {
						say(true);
					}
					else {
						say(false);
					}
					say( length alice_secret );
					say( length alice.export_private() );
					say( length alice_public.export() );
				}
				else {
					say("unsupported-x25519");
				}
				try {
					let signing := await {
						SigningKey.generate_async();
					};
					let signing_public := signing.public_key();
					let signing_message := to_binary("browser-ed25519");
					let signing_signature := await {
						signing.sign_async(signing_message);
					};
					say( await {
						signing_public.verify_async(
							signing_message,
							signing_signature,
						);
					} );
				}
				catch ( Exception e ) {
					if ( e ~ /not available|unavailable|unsupported/ ) {
						say("unsupported-ed25519");
					}
					else {
						say("unexpected-ed25519-error");
					}
				}
			}
			await {
				main();
			};
		`,
		{ throwOnError: false },
	);
	assert.equal( secureResult.status, 0, secureResult.stderr );
	const secureExpectedPrefix = 'BinaryString\n32\n'
			+ '$zuzu-pbkdf2-sha256$v=1$i=1000,l=32'
			+ '$AAECAwQFBgcICQoLDA0ODw'
			+ '$ppsXnjrdPB4KryJ6DrOqKqhkWrhv7PbKAMF1Eml8cZ4\n'
			+ 'true\n'
			+ 'ppsXnjrdPB4KryJ6DrOqKqhkWrhv7PbKAMF1Eml8cZ4=\n'
			+ 'true\ntrue\n'
			+ 'c2VjcmV0\n'
			+ 'true\n32\n65\n'
			+ 'true\n48\n97\n'
			+ 'true\n32\n32\n32\n';
	const secureOutput = secureResult.stdout.trimEnd();
	assert.ok(
		secureOutput === `${secureExpectedPrefix}unsupported-ed25519`,
		secureOutput
	);

	const result = await runtime.zuzu_run(
		`
			from std/worker import Worker;
			say( Worker can "spawn" );

			async function main () {
				let value := await {
					Worker.spawn(
						function ( x ) {
							return x * 2;
						},
						[ 21 ],
					);
				};
				say( value );

				let handle := Worker.spawn_handle(
					async function ( inbox ) {
						let sent := await {
							inbox.recv();
						};
						await {
							inbox.send( sent + 1 );
						};
						inbox.close();
						return sent * 2;
					},
					[],
				);
				await {
					handle.send(20);
				};
				say( await { handle.recv(); } );
				say( await { handle.result(); } );
			}

			await {
				main();
			};
		`,
		{ throwOnError: false },
	);
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout.trimEnd(), '1\n42\n21\n40' );
}

runAsyncTests().then(
	() => {
		console.log( 'browser bundle tests passed' );
	},
	(err) => {
		console.error( err );
		process.exitCode = 1;
	},
);
