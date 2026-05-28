'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const os = require( 'node:os' );
const path = require( 'node:path' );
const vm = require( 'node:vm' );
const { ZuzuScript, transpile } = require( '../lib/zuzu' );
const projectPaths = require( '../lib/paths' );

function run( src, options = {} ) {
	const runtime = new ZuzuScript();
	const result = runtime.runSource( src, options );
	assert.equal( result.status, 0, result.stderr );
	return result.stdout;
}

{
	const out = run( `
		from test/more import *;
		let seen := "";
		if ( true ) {
			seen := seen _ "a";
		}
		seen := seen _ "b" if true;
		seen := seen _ "c" unless false;
		is( seen, "abc", "if + postfix flow" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
}

{
	const out = run( `
		from test/more import *;
		const picked := try {
			die "boom";
			"toml";
		}
		catch ( Exception e ) {
			"ini";
		};
		is( picked, "ini", "try/catch expression returns catch value" );
		const direct := try {
			let n := 40;
			n + 2;
		}
		catch ( Exception e ) {
			0;
		};
		is( direct, 42, "try/catch expression returns try value" );
		const exprDefault := try {
			throw new Exception( message: "expr-default" );
			0;
		}
		catch {
			e{message};
		};
		const exprNameOnly := try {
			throw new Exception( message: "expr-name-only" );
			0;
		}
		catch ( err ) {
			err{message};
		};
		is( exprDefault, "expr-default", "catch defaults to Exception e" );
		is( exprNameOnly, "expr-name-only", "catch(name) defaults type" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
	assert.match( out, /ok\s+2\b/ );
	assert.match( out, /ok\s+3\b/ );
	assert.match( out, /ok\s+4\b/ );
}

{
	const js = transpile( 'is( parsed{""}{project}, "zuzu", "string literal brace key" );' );
	assert.match( js, /__zuzu_get_index\( parsed, "" \)/ );
	assert.match(
		js,
		/__zuzu_get_brace_member\(\s*__zuzu_get_index\( parsed, "" \),\s*"project"/
	);
}

{
	const out = run( `
		from test/more import *;
		function xyz () {
			let something := do {
				return "aaa";
			};
			return "bbb";
		}
		is( xyz(), "aaa", "return within do returns from containing function" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
}

{
	const out = run( `
		from test/more import *;
		const codec := do {
			new Exception( message: "codec" );
		};
		is( typeof codec, "Exception", "do expression returns last value" );
		const nested := do {
			let n := 39;
			do {
				n + 3;
			};
		};
		is( nested, 42, "nested do expression returns inner value" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
	assert.match( out, /ok\s+2\b/ );
}

{
	const out = run( `
		from test/more import *;
		let i := 0;
		let n := 3;
		while ( i < n and n > 0 ) {
			i++;
		}
		is( i, 3, "comparison operands with and keep loop semantics" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
}

{
	const out = run( `
		from test/more import *;
		let n := 12 - 9 + 1;
		is( n, 4, "left-associative + and - arithmetic" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
}

{
	const out = run( `
		from test/more import *;
		subtest( "nest", function () {
			ok( true, "inner truth" );
		} );
		ok( true, "outer truth" );
		done_testing();
	` );
	assert.match( out, /\s# Subtest: nest/ );
	assert.match( out, /\sok\s+1\s+-\s+inner truth/ );
	assert.match( out, /\s1\.\.1/ );
	assert.match( out, /ok\s+1\s+-\s+nest/ );
	assert.match( out, /ok\s+2\s+-\s+outer truth/ );
}

{
	const out = run( `
		from test/more import *;
		let total := 0;
		for ( let item in [ 1, 2, 3 ] ) {
			total := total + item;
		}
		is( total, 6, "for in loop" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
}

{
	const out = run( `
		from test/more import *;
		let picked := "";
		switch ( "bar" : eq ) {
			case "foo":
				picked := "foo";
			case "bar", "baz":
				picked := "bar";
				continue;
			default:
				picked := picked _ "!";
		}
		is( picked, "bar!", "switch with continue fallthrough" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
}


{
	const out = run( `
		from test/more import *;
		fn add( Number left, Number right ) {
			return left + right;
		}
		function mul( Number left, Number right ) {
			return left * right;
		}
		is( add( 2, 3 ), 5, "fn definition and call" );
		is( mul( 3, 4 ), 12, "typed function definition and call" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
	assert.match( out, /ok\s+2\b/ );
}

{
	const tempDir = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-' ) );
	const modulePath = path.join( tempDir, 'math.zzs' );
	fs.writeFileSync( modulePath, `
		export function inc( Number value ) {
			return value + 1;
		}
		export let magic := 9;
	`, 'utf8' );

	const out = run( `
		from test/more import *;
		from ./math import inc, magic;
		is( inc( 4 ), 5, "imported function" );
		is( magic, 9, "imported variable" );
		done_testing();
	`, { filename: path.join( tempDir, 'main.zzs' ) } );
	assert.match( out, /ok\s+1\b/ );
	assert.match( out, /ok\s+2\b/ );
}


{
	const tempDir = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-' ) );
	const modulePath = path.join( tempDir, 'aliases.zzs' );
	fs.writeFileSync( modulePath, `
		export const answer := 42;
		export function greet( String name ) {
			return "hi " _ name;
		}
	`, 'utf8' );

	const out = run( `
		from test/more import *;
		from ./aliases import answer as result, greet as hello;
		is( result, 42, "import alias for const" );
		is( hello( "zuzu" ), "hi zuzu", "import alias for function" );
		done_testing();
	`, { filename: path.join( tempDir, 'main.zzs' ) } );
	assert.match( out, /ok\s+1\b/ );
	assert.match( out, /ok\s+2\b/ );
}

{
	const tempDir = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-' ) );
	const modulePath = path.join( tempDir, 'defs.zzm' );
	fs.writeFileSync( modulePath, `
		class PublicClass {
			let kind := "class";
		}
		trait PublicTrait {
			method trait_label() {
				return "trait";
			}
		}
		function public_function () {
			return 7;
		}
		let public_variable := 8;
		const public_const := 9;
		let _private_variable := 10;
		const _private_const := 11;
	`, 'utf8' );

	const runtime = new ZuzuScript();
	const loaded = runtime.loadModule( './defs', path.join( tempDir, 'main.zzs' ) );
	assert.equal( typeof loaded.PublicClass, 'function' );
	assert.equal( typeof loaded.PublicTrait, 'object' );
	assert.equal( typeof loaded.public_function, 'function' );
	assert.equal( loaded.public_variable, 8 );
	assert.equal( loaded.public_const, 9 );
	assert.deepEqual(
		Object.keys( loaded ).sort(),
		[ 'PublicClass', 'PublicTrait', 'public_const', 'public_function', 'public_variable' ].sort()
	);
	assert.equal( loaded._private_variable, 10 );
	assert.equal( loaded._private_const, 11 );
}

{
	const tempDir = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-' ) );
	const modulePath = path.join( tempDir, 'defs.zzm' );
	fs.writeFileSync( modulePath, `
		let _private_variable := 123;
		const _private_const := 456;
	`, 'utf8' );

	const out = run( `
		from test/more import *;
		from ./defs import _private_variable, _private_const;
		is( _private_variable, 123, "named import can access underscored variable" );
		is( _private_const, 456, "named import can access underscored const" );
		done_testing();
	`, { filename: path.join( tempDir, 'main.zzs' ) } );
	assert.match( out, /ok\s+1\b/ );
	assert.match( out, /ok\s+2\b/ );
}

{
	const js = transpile( 'for ( let n in nums ) { next; }' );
	assert.match( js, /for \( let n of __zuzu_iter\(\s*nums\s*\)\s*\)/ );
	assert.match( js, /continue;/ );
}

{
	const js = transpile( 'for ( const n in nums ) { next; }' );
	assert.match( js, /for \( const n of __zuzu_iter\(\s*nums\s*\)\s*\)/ );
	assert.match( js, /continue;/ );
}

{
	const js = transpile( 'if ( typeof TODO eq "String" ) { ok( true ); }' );
	assert.doesNotMatch( js, /__zuzu_typeof\(\s*TODO\s+__zuzu_str_eq/ );
	assert.match( js, /__zuzu_str_eq\(\s*__zuzu_typeof\(\s*TODO\s*\),\s*"String"\s*\)/ );
}

{
	const js = transpile( 'if ( typeof value ≢ "Number" ) { ok( true ); }' );
	assert.doesNotMatch( js, /__zuzu_typeof\(\s*value\s*\)\s+__zuzu_ne\s+"Number"/ );
	assert.match( js, /__zuzu_ne\(\s*__zuzu_typeof\(\s*value\s*\),\s*"Number"\s*\)/ );
}

{
	const js = transpile( 'is( typeof[], "Array" ); is( typeof[1], "Array" );' );
	assert.match( js, /__zuzu_typeof\(\s*\[\s*\]\s*\)/ );
	assert.match( js, /__zuzu_typeof\(\s*\[\s*1\s*\]\s*\)/ );
}

{
	const js = transpile( 'for ( let n in[] ) { seen := 1; } else { seen := 2; }' );
	assert.match( js, /let __zuzu_iterated_n_0 = 0;\s*for \( let n of __zuzu_iter\(\s*\[\s*\]\s*\) \)/ );
	assert.match( js, /if \( !__zuzu_iterated_n_0 \) \{\s*seen = 2;\s*\}/ );
}

{
	const js = transpile( 'let f := fn Number n -> prefix _":" _ n;' );
	assert.match( js, /return __zuzu_concat\(\s*__zuzu_concat\(\s*prefix,\s*":"\s*\),\s*n\s*\)/ );
}

{
	const js = transpile( 'let nested := {{ bar: << 3, 2, 1 >>, baz: <<< 3, 2, 1, 1 >>> }};' );
	assert.match( js, /__zuzu_pairlist_literal\(\s*\[\s*\[\s*"bar",\s*__zuzu_set\(\s*\[\s*3,\s*2,\s*1\s*\]\s*\)\s*\],\s*\[\s*"baz",\s*__zuzu_bag\(\s*\[\s*3,\s*2,\s*1,\s*1\s*\]\s*\)\s*\]\s*\]\s*\)/ );
}

{
	const runtime = new ZuzuScript();
	const result = runtime.runSource( 'let x := ( 1 + ;', { filename: 'example.zzs' } );
	assert.equal( result.status, 3 );
	assert.match( result.stderr, /TranspilerSyntaxError: Unexpected token in expression at 1:16/ );
}

{
	const js = transpile( 'ok( not person.has_name(), "no slot" );' );
	assert.match( js, /ok\(\s*__zuzu_not\(\s*__zuzu_call_member\(\s*person,\s*"has_name"\s*\)\s*\),\s*"no slot"/ );
}

{
	const js = transpile( 'let label := "a1 b2"; label ~= /([a-z])([0-9])/g -> `${m[2]}${m[1]}`;' );
	assert.match( js, /label\s*=\s*String\(\s*label\s*\)\.replace\(\s*new RegExp\(\s*"\(\[a-z\]\)\(\[0-9\]\)",\s*"g"\s*\),\s*\(\s*\.\.\.__zuzu_match_args\s*\)\s*=>\s*\{\s*const m = __zuzu_match_args;/ );
	assert.match( js, /return __zuzu_concat\(\s*__zuzu_get_index\(\s*m,\s*2\s*\),\s*__zuzu_get_index\(\s*m,\s*1\s*\)\s*\);/ );
}

{
	const js = transpile( 'return self.get_name() _":" _ breed _":" _ self { species };' );
	assert.match( js, /__zuzu_call_member\(\s*self,\s*"get_name"\s*\)/ );
	assert.match( js, /__zuzu_get_brace_member\(\s*self,\s*"species",\s*\(\) => species\s*\)/ );
}

{
	const out = run( `
		from test/more import *;
		class WithArray {
			method to_Array () {
				return [ 1 ... 4 ].reverse();
			}
		}
		let got := [ ];
		for ( let v in new WithArray() ) {
			got.push(v);
		}
		is( got, [ 4, 3, 2, 1 ], "for uses class to_Array over Dict fallback" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
}

{
	const { join } = require( '../modules/std/string' );
	const iterOnly = {
		to_Iterator() {
			const values = [ 'a', 'b', 'c' ];
			let i = 0;
			return {
				next() {
					if ( i >= values.length ) {
						return { done: true };
					}
					return { value: values[i++], done: false };
				},
				[Symbol.iterator]() {
					return this;
				},
			};
		},
	};
	assert.equal( join( '-', iterOnly ), 'a-b-c' );
}

{
	const { join } = require( '../modules/std/string' );
	const iterPreferred = {
		to_Iterator() {
			return [ 'x', 'y' ][Symbol.iterator]();
		},
		to_Array() {
			return [ 'fallback' ];
		},
	};
	assert.equal( join( ':', iterPreferred ), 'x:y' );
}

{
	const out = run( `
		from test/more import *;
		let pl := {{ foo: 1, bar: 2, foo: 3 }};
		is( length( pl ), 3, "PairList length delegates to list size" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
}

{
	const js = transpile( 'value ~= /foo/ -> "bar";' );
	assert.doesNotMatch( js, /__zuzu_num_eq__/ );
	assert.match( js, /\.replace\(\s*new RegExp\(\s*"foo",\s*""\s*\)/ );
}

{
	const js = transpile( 'let ok := a≡b;' );
	assert.match( js, /__zuzu_eq\(\s*a,\s*b\s*\)/ );
}

{
	const js = transpile( 'is(( [ 1, 2 ] union[ 2, 3 ] ).length(), 3, "union compact rhs" );' );
	assert.match( js, /__zuzu_union\(\s*\[\s*1,\s*2\s*\],\s*\[\s*2,\s*3\s*\]\s*\)/ );
}

{
	const js = transpile( 'from std/string import *; let hit := search( "abc", /b/ );', { transpiler: 'new-only' } );
	assert.match( js, /const __zuzu_star = __zuzu_import\( "std\/string" \);/ );
	assert.match( js, /let hit = search\( "abc", new RegExp\( "b", "" \) \);/ );
}

{
	const js = transpile( `
		trait Renamable {
			method rename_to ( String value ) {
				return value;
			}
		}
		` );
	assert.match( js, /"rename_to":\s*\(\s*function\(\)\s*\{/ );
	assert.doesNotMatch( js, /String\s+value/ );
}

{
	const { decode } = require( '../modules/std/string/base64' );
	const out = decode( 'QUJD' );
	assert.equal( out.to_String(), 'ABC' );
}

{
	const out = run( String.raw`
		from std/string/base64 import encode;
		from test/more import *;
		is(
			encode( to_binary( "A\u0000B\u0001C\u00ff" ) ),
			"QQBCAUPDvw==",
			"unicode string escapes feed to_binary"
		);
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
}

{
	const js = transpile( `
		class Person {
			let String name with get, set, clear, has := "Anon";
		}
		` );
	assert.match( js, /name:\s*"name"/ );
	assert.match( js, /defaultValue:\s*function\(\)\s*\{\s*return "Anon";\s*\}/ );
	assert.match( js, /accessors:\s*\[\s*"get",\s*"set",\s*"clear",\s*"has"\s*\]/ );
}

{
	const js = transpile( 'const picked := try { die "boom"; 0; } catch { e{message}; };' );
	assert.match( js, /\(\s*\(\s*\)\s*=>\s*\{\s*try\s*\{/ );
	assert.match( js, /catch\s*\(\s*__zuzu_err\s*\)\s*\{/ );
	assert.match( js, /let e = __zuzu_err/ );
}

{
	const js = transpile( 'function f ( id, label? ) { return id _":" _( label ?: "none" ); }' );
	assert.match( js, /const f = function f\(\)/ );
	assert.doesNotMatch( js, /\)\s*_\s*\(/ );
	assert.match( js, /__zuzu_concat\(/ );
}

{
	assert.throws(
		() => transpile( 'function xyz () { return 1; } xyz := function () { return 2; };' ),
		/Cannot assign to const 'xyz'/
	);
	assert.throws(
		() => transpile( 'function xyz () { return 1; } function xyz () { return 2; }' ),
		/Redeclaration of 'xyz' in the same scope/
	);
}

{
	const js = transpile( 'function g ( id, label?, suffix := "none", ... more ) { return id _":" _( label ?: "none" ) _":" _ suffix _":" _ more.length(); }' );
	assert.doesNotMatch( js, /__zuzu_concat\(\s*_[\'\"]/ );
	assert.doesNotMatch( js, /\)\s+__zuzu_concat\(/ );
}

{
	const js = transpile( `let bytes := 'abc';`, { transpiler: 'new-only' } );
	assert.match( js, /__zuzu_binary_literal\(\s*"abc"\s*\)/ );
}

{
	const runtime = new ZuzuScript( { transpiler: 'new-only' } );
	const result = runtime.runSource( `
			from test/more import *;
			let BinaryString raw := 'ABC';
			let BinaryString utf := 'A\\xC3\\xA9';
		is( typeof raw, "BinaryString", "single quote literal is BinaryString" );
		ok( raw instanceof BinaryString, "binary instanceof BinaryString" );
		ok( not ( raw instanceof String ), "binary not instanceof String" );
		is( length utf, 3, "binary length counts bytes" );
		is( to_string( utf ), "Aé", "to_string decodes UTF-8" );
		is( to_string( to_binary( "Aé" ) ), "Aé", "utf8 roundtrip" );
		ok( "id:" _ '42' eq "id:42", "ASCII concat with string is implicit" );
			like(
				exception( function () {
					let _boom := "x" _ '\\xFF';
				} ),
				/non-ASCII BinaryString/,
				"non-ASCII concat requires explicit conversion"
			);
			like(
				exception( function () {
					uc 'abc';
				} ),
				/uc expects String/,
				"uc on BinaryString throws"
			);
		is( to_string( ('\\xF0\\x0F') & ('\\x0F\\xF0') ), "\\x00\\x00", "binary bitwise and" );
		is( to_string( ~'\\x00\\xFF' ), "\\xFF\\x00", "binary bitwise not" );
		is( to_string( \\raw[1]() ), "B", "binary index returns one-byte BinaryString" );
		is( to_string( \\raw[1:2]() ), "BC", "binary slice returns BinaryString" );
			like(
				exception( function () {
					function need_text( String text ) {
						return text;
					}
					need_text( 'abc' );
				} ),
				/must be String, got BinaryString/,
				"typed String arg rejects BinaryString"
			);
			done_testing();
		` );
	assert.equal( result.status, 0, result.stderr );
	const out = result.stdout;
	assert.match( out, /ok\s+1\b/ );
	assert.match( out, /ok\s+2\b/ );
	assert.match( out, /ok\s+3\b/ );
	assert.match( out, /ok\s+4\b/ );
}

{
	const js = transpile( `
		let Number total;
		fn keep_if_even ( list ) {
			return list.grep( fn Number n -> n mod 2 = 0 );
		}
	` );
	assert.match( js, /let total = null;/ );
	assert.match( js, /list\.grep\(\s*\(\s*function\(\)\s*\{/ );
	assert.match( js, /__zuzu_num_eq\(\s*\(\s*__zuzu_num\(\s*n\s*\)\s*%\s*__zuzu_num\(\s*2\s*\)\s*\),\s*0\s*\)/ );
}

{
	const js = transpile( `
		let label := fn ( String x, Number y ) -> ( y < 10 ) ? (uc x) : (lc x);
	` );
	assert.match( js, /let x = arguments\[0\]/ );
	assert.match( js, /__zuzu_type_matches\(\s*x,\s*"String"\s*\)/ );
	assert.match( js, /let y = arguments\[1\]/ );
	assert.match( js, /__zuzu_type_matches\(\s*y,\s*"Number"\s*\)/ );
}

{
	const js = transpile( `
		class Counter {
			let Number current;
			static method ten () {
				return 10;
			}
			method add_two (x) {
				return x + 2;
			}
		}
	` );
	assert.match( js, /__zuzu_define_class\(\s*"Counter"/ );
	assert.match( js, /name:\s*"current"/ );
	assert.match( js, /"ten":\s*\(\s*function\(\)/ );
	assert.match( js, /"add_two":\s*\(\s*function\(\)/ );
	assert.doesNotThrow( () => new vm.Script( js ) );
}

{
	const js = transpile( 'let m := "Abc" ~ /(a)(bc)/i;' );
	assert.match( js, /__zuzu_match\(\s*"Abc",\s*new RegExp\(\s*"\(a\)\(bc\)",\s*"i"\s*\)\s*\)/ );
}

{
	const js = transpile( `
		let seen := "";
		seen := seen _ "x" if true;
		seen := seen _ "y" unless false;
	` );
	assert.match( js, /if \( __zuzu_truthy\(\s*true\s*\) \) \{\s*seen = __zuzu_concat\( seen, "x" \);\s*\}/ );
	assert.match( js, /if \( __zuzu_truthy\(\s*__zuzu_not\(\s*false\s*\)\s*\) \) \{\s*seen = __zuzu_concat\( seen, "y" \);\s*\}/ );
}

{
	const js = transpile( `
		let hit := 0;
		if ( let n := 7 ) {
			hit := n;
		}
	` );
	assert.match( js, /let n = 7;\s*if \( __zuzu_truthy\(\s*n\s*\) \) \{/ );
}

{
	const js = transpile( `
		function f() {
			let ch := "[";
			if ( ch ≡ "[" ){ let arr := [];
				return arr;
			}
		}
	` );
	assert.match( js, /if \( __zuzu_truthy\(\s*__zuzu_eq\( ch, "\[" \)\s*\) \) \{\s*let arr = \[\s*\];/ );
	assert.doesNotMatch( js, /if \( \( __zuzu_eq\( ch, "\[" \) \)\{ let arr = \[\] \)/ );
}

{
	const js = transpile( `
		function f( Dict cursor, String key ) {
			if ( typeof cursor.get(key) ≢ "Dict" ) {
				die "bad";
			}
		}
	` );
	assert.match( js, /__zuzu_ne\(\s*__zuzu_typeof\(\s*cursor\.get\(\s*key\s*\)\s*\),\s*"Dict"\s*\)/ );
}

{
	const js = transpile( `
		function f( String line ) {
			if ( substr( line, 0, 1 ) ≡ "[" ){ die "Invalid table header" if substr( line, line.length() - 1, 1 ) ≢ "]";
				return line;
			}
		}
	` );
	assert.match( js, /__zuzu_eq\(\s*substr\( line, 0, 1 \),\s*"\["\s*\)/ );
	assert.match( js, /__zuzu_ne\(\s*substr\(\s*line,\s*__zuzu_sub\(\s*__zuzu_length\(\s*line\s*\),\s*1\s*\),\s*1\s*\),\s*"]"\s*\)/ );
}

{
	const js = transpile( `
		for ( let x in << 1, 2 >> ) {
			next;
		}
		else {
			die "never";
		}
	` );
	assert.match( js, /let __zuzu_iterated_x_0 = 0;\s*for \( let x of __zuzu_iter\(\s*__zuzu_set/ );
	assert.match( js, /if \( !__zuzu_iterated_x_0 \) \{/ );
}

{
	const js = transpile( `
		for ( const x in << 1, 2 >> ) {
			next;
		}
		else {
			die "never";
		}
	` );
	assert.match( js, /let __zuzu_iterated_x_0 = 0;\s*for \( const x of __zuzu_iter\(\s*__zuzu_set/ );
	assert.match( js, /if \( !__zuzu_iterated_x_0 \) \{/ );
}

{
	const js = transpile( 'from std/math import Math, π as PI_ALIAS;' );
	assert.match( js, /const \{ Math, π: PI_ALIAS \} = __zuzu_import\( "std\/math" \);/ );
}

{
	const js = transpile( 'from foo/../../bar import Blah;' );
	assert.match( js, /__zuzu_import\( "foo\/\.\.\/\.\.\/bar" \)/ );
}

{
	const runtime = new ZuzuScript();
	assert.throws(
		() => runtime.loadModule( 'foo/../../bar', path.join( process.cwd(), 'main.zzs' ) ),
		/Import module path cannot contain '\.\.' segments/
	);
}

{
	const js = transpile( `
		let r := /(foo)(bar)/i;
		is( \`m=\${ r }\`, "m=foobar", "template text keeps '=' and interpolation" );
	` );
	assert.match( js, /__zuzu_concat\(\s*"m=",\s*r\s*\)/ );
	assert.doesNotMatch( js, /__zuzu_num_eq__/ );
}

{
	const js = transpile( `
		let obj := {};
		let method := "go";
		obj.(method)( 3 );
	` );
	assert.match( js, /obj\[method\]\( 3 \);/ );
}

{
	const js = transpile( `
		class Person {
			let String name;
			method get_name () {
				return name;
			}
		}
	` );
	assert.match( js, /__zuzu_define_class\(\s*"Person"/ );
	assert.match( js, /return self\["name"\];/ );
}

{
	const js = transpile( `
		trait Named {
			method ping () { return 1; }
		}
		class Dog with Named;
		is( ( new Dog() ) does Named, 1, "trait composition marker" );
	` );
	assert.match( js, /let Named = __zuzu_trait/ );
	assert.match( js, /__zuzu_define_class\(\s*"Dog"/ );
	assert.match( js, /"traits":\s*\[\s*Named\s*\]/ );
}

{
	const js = transpile( `
		let dict := { answer: 41 };
		let slot := \\dict{answer};
		slot( 42 );
	` );
	assert.match( js, /__zuzu_ref_index\( dict, "answer" \)/ );
}

{
	const out = run( `
		from test/more import *;
		let key := "answer";
		let dict := {};
		dict{key} := 42;
		is( dict{answer}, 42, "brace assignment resolves dynamic key" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
}

{
	const js = transpile( `
		ok( true instanceof Any );
		ok( {} instanceof Dict );
		ok( [] instanceof Collection );
	` );
	assert.match( js, /__zuzu_instanceof\( true, Any \)/ );
	assert.match( js, /__zuzu_instanceof\( \{\s*\}, Dict \)/ );
	assert.match( js, /__zuzu_instanceof\( \[\s*\], Collection \)/ );
}

{
	const js = transpile( 'die new Fatal( code: 9 );' );
	assert.match( js, /__zuzu_die\( new Fatal\( __zuzu_pairlist_literal\( \[ \[ "code", 9 \] \] \) \) \);/ );
}

{
	const js = transpile( `
		assert true;
		warn "keep going";
		debug 123, "trace";
	` );
	assert.match( js, /__zuzu_assert\( \(\) => true \);/ );
	assert.match( js, /__zuzu_warn\( "keep going" \);/ );
	assert.match( js, /__zuzu_debug\( \(\) => 123, \(\) => "trace" \);/ );
}

{
	const js = transpile( 'from ./math import inc, magic;' );
	assert.match( js, /const \{ inc, magic \} = __zuzu_import\( "\.\/math" \);/ );
	assert.doesNotMatch( js, /__zuzu_div\(/ );
}

{
	const out = run( `
		from test/more import *;
		let seen := "";
		try {
			die "boom";
		}
		catch ( Exception e ) {
			seen := "caught";
		}
		let fallback := "";
		try {
			throw new Exception( message: "fallback" );
		}
		catch {
			fallback := e{message};
		}
		let named := "";
		try {
			throw new Exception( message: "named" );
		}
		catch ( err ) {
			named := err{message};
		}
		is( seen, "caught", "die + typed catch" );
		is( fallback, "fallback", "catch without signature binds e" );
		is( named, "named", "catch(name) binds Exception value" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
	assert.match( out, /ok\s+2\b/ );
	assert.match( out, /ok\s+3\b/ );
}

{
	const runtime = new ZuzuScript( { repoRoot: projectPaths.projectRoot } );
	const loaded = runtime.loadModule( 'modules/test/more' );
	assert.equal( typeof loaded.ok, 'function' );
	assert.equal( typeof loaded.subtest, 'function' );
}

{
	const js = transpile( `
		let switched := "none";
		switch ( "beta" : eq ) {
			case "beta":
				switched := "beta";
		}
	` );
	assert.match( js, /let switched = "none";/ );
	assert.match( js, /__zuzu_switch\( "beta", "eq"/ );
	assert.match( js, /let __zuzu_switch_result/ );
}

{
	const js = transpile( `
		from std/math import Math;
		let rounded := round( Math.sin( Math.pi / 2 ) * 1000 );
	` );
	assert.match( js, /Math\.sin\( __zuzu_div\( __zuzu_call_member\( Math, "pi" \), 2 \) \)/ );
	assert.match( js, /__zuzu_mul\(/ );
}

{
	const js = transpile( `
		let x := 3;
		x ×= 4;
		x ÷= 2;
		let y;
		y ?:= 9;
	` );
	assert.match( js, /x \*= 4;/ );
	assert.match( js, /x \/= 2;/ );
	assert.match( js, /\( y == null \? \( y = 9 \) : y \);/ );
	assert.doesNotMatch( js, /__zuzu_mul\(\s*x,\s*__zuzu_num_eq__/ );
}

{
	const js = transpile( `
		is(( [ 1, 2 ] intersection [ 2, 3 ] ).contains(2), 1, "intersection");
		is(( [ 1, 2, 3 ] \\ [ 2 ] ).length(), 2, "difference");
	` );
	assert.match( js, /\(\s*__zuzu_intersection\(\s*\[ 1, 2 \], \[ 2, 3 \]\s*\)\s*\)\.contains\(\s*2\s*\)/ );
	assert.match( js, /__zuzu_length\(\s*\(\s*__zuzu_difference\(\s*\[ 1, 2, 3 \], \[ 2 \]\s*\)\s*\)\s*\)/ );
}

{
	const js = transpile( 'is([ 5...1 ][3], 2, "descending range");' );
	assert.match( js, /__zuzu_get_index\(\s*\[\s*\.\.\.__zuzu_range\( 5, 1 \)\s*\],\s*3\s*\)/ );
}

{
	const js = transpile( 'let out := "id" _ ":" _ ( label ?: "none" ) _ ":" _ "tail";' );
	assert.match( js, /__zuzu_concat\( "id", ":" \)/ );
	assert.match( js, /__zuzu_truthy\(\s*label\s*\) \? label : "none"/ );
	assert.doesNotMatch( js, /"none"\s+__zuzu_concat/ );
}

{
	const js = transpile( 'die "boom" if false;' );
	assert.match( js, /if \( __zuzu_truthy\(\s*false\s*\) \) \{\s*__zuzu_die\( "boom" \);\s*\}/ );
}

{
	const js = transpile( `
		from std/math import Math
		let rounded := Math.round( 1.2 )
	` );
	assert.match( js, /__zuzu_import\( "std\/math" \)/ );
	assert.match( js, /let rounded = Math\.round\( 1\.2 \)/ );
}

{
	const js = transpile( 'from extras/not_real try import Missing;' );
	assert.match( js, /const \{ Missing = null \}/ );
	assert.match( js, /try \{\s*return __zuzu_import\( "extras\/not_real" \);/ );
	assert.match( js, /catch \( __zuzu_err \)/ );
}

{
	const js = transpile( 'from std/math import Math if enabled;' );
	assert.match( js, /if \( !\( __zuzu_truthy\( enabled \) \) \) \{ return \{ Math: null \}; \}/ );
	assert.match( js, /return __zuzu_import\( "std\/math" \);/ );
}

{
	const out = run( `
		from test/more import *;
		from extras/not_real try import Missing;
		is( Missing, null, "try import binds missing module export to null" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
}

{
	const out = run( `
		from test/more import *;
		let disabled := false;
		from std/math import Math if disabled;
		is( Math, null, "postfix if false binds import alias to null" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
}

{
	const out = run( `
		from test/more import *;
		from std/math import Math unless true;
		is( Math, null, "postfix unless true binds import alias to null" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
}

{
	const out = run( `
		from test/more import *;
		let enabled := true;
		from extras/not_real try import Missing if enabled;
		is( Missing, null, "try import combines with postfix if" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
}

{
	const out = run( `
		from test/more import *;
		function block_separator_js () {
			let value := 1
			return value
		}
		is( block_separator_js(), 1, "block final statement can omit semicolon" );
		done_testing();
	` );
	assert.match( out, /ok\s+1\b/ );
}

{
	const runtime = new ZuzuScript( { repoRoot: projectPaths.projectRoot } );
	const math = runtime.loadModule( 'std/math' );
	const strings = runtime.loadModule( 'std/string' );
	assert.equal( Math.round( math.Math.sin( math.Math.pi / 2 ) * 1000 ), 1000 );
	assert.equal( Math.round( math.π * 1000 ), 3142 );
	assert.equal( strings.index( 'abcdef', 'cd' ), 2 );
	assert.equal( strings.chr( 0x2603 ), '☃' );
	assert.equal( strings.ord( 'a☃😀', 2 ), 0x1F600 );
}

{
	const js = transpile( `
		let report := {};
		let focused := \\( report @ "/meta/title" );
		let many := ++( report @@ "/users/*/age" );
		let maybe := --( report @? "/meta/age" );
	` );
	assert.match(
		js,
		/__zuzu_path_ref\(\s*report,\s*"\/meta\/title",\s*"first"\s*\)/
	);
	assert.match(
		js,
		/__zuzu_path_update\(\s*report,\s*"\/users\/\*\/age",\s*"all",\s*"\+\+",\s*true\s*\)/
	);
	assert.match(
		js,
		/__zuzu_path_update\(\s*report,\s*"\/meta\/age",\s*"maybe",\s*"--",\s*true\s*\)/
	);
}

{
	const runtime = new ZuzuScript( { transpiler: 'new-only' } );
	const result = runtime.runSource( `
		from std/internals import setprop;
		from std/path/z import ZPath;
		from std/path/simple import SimplePath;
		from test/more import *;

		setprop( "paths", ZPath );
		let report := {
			meta: { count: 4, title: "Read 2026" },
			users: [ { age: 1 }, { age: 2 } ],
		};

		is(
			( report @@ "/users/*/age" )++,
			[ 1, 2 ],
			"feature smoke: @@ postfix update returns old values",
		);
		ok(
			not ++( report @? "/meta/missing" ),
			"feature smoke: @? update miss returns false",
		);
		is(
			\\( report @@ "/users/*/missing" ).length(),
			0,
			"feature smoke: @@ ref miss returns empty array",
		);
		ok(
			\\( report @? "/meta/missing" ) ≡ null,
			"feature smoke: @? ref miss returns null",
		);

		SimplePath.use();
		let simple := {
			store: {
				title: "Read 2026",
				books: [ { pages: 1 }, { pages: 2 } ],
			},
		};
		is(
			--( simple @@ "store.books[*].pages" ),
			[ 0, 1 ],
			"feature smoke: SimplePath multi-update works",
		);
		is(
			\\( simple @ "store.title" )(),
			"Read 2026",
			"feature smoke: SimplePath ref works",
		);
		done_testing();
	`, { filename: '/tmp/features-path-phase5.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.match( result.stdout, /ok\s+1\b/ );
	assert.match( result.stdout, /ok\s+2\b/ );
	assert.match( result.stdout, /ok\s+3\b/ );
	assert.match( result.stdout, /ok\s+4\b/ );
	assert.match( result.stdout, /ok\s+5\b/ );
	assert.match( result.stdout, /ok\s+6\b/ );
}

console.log( 'zuzu-js feature tests passed' );
