'use strict';

const assert = require( 'node:assert/strict' );
const {
	ZuzuScript,
	transpile,
} = require( '../lib/zuzu' );
const {
	tokenize,
	parse,
	transpileWithoutFallback,
} = require( '../lib/transpiler-new' );

{
	const tokens = tokenize( 'let msg := `a${1+2}b`;' );
	const template = tokens.find( (token) => token.type === 'template' );
	assert.ok( template );
	assert.deepEqual(
		template.value.map( (part) => part.type ),
		[ 'text', 'expr', 'text' ]
	);
	assert.equal( template.value[0].value, 'a' );
	assert.equal( template.value[2].value, 'b' );
}

{
	const ast = parse( tokenize( 'let msg := `a${1+2}b`; let items := << 1, 2 >>; let bag := <<< 1, 2 >>>;' ) );
	assert.equal( ast.body[0].init.type, 'TemplateLiteral' );
	assert.equal( ast.body[1].init.type, 'SetLiteral' );
	assert.equal( ast.body[2].init.type, 'BagLiteral' );
}

{
	const ast = parse( tokenize( 'let pl := {{ foo: 1, "bar": 2, foo: 3 }};' ) );
	assert.equal( ast.body[0].init.type, 'PairListLiteral' );
	assert.equal( ast.body[0].init.entries[0].type, 'PairListEntry' );
	assert.equal( ast.body[0].init.entries[0].key, 'foo' );
	assert.equal( ast.body[0].init.entries[1].key, 'bar' );
}

{
	const ast = parse( tokenize( 'report{meta};' ) );
	assert.equal( ast.body[0].expression.type, 'MemberExpression' );
	assert.equal( ast.body[0].expression.property.type, 'StringLiteral' );
	assert.equal( ast.body[0].expression.property.value, 'meta' );
}

{
	const js = transpileWithoutFallback( 'let msg := `a${1+2}b`; let items := << 1, 2 >>; let bag := <<< 1, 2 >>>; let pl := {{ foo: 1, "bar": 2 }};' );
	assert.match( js, /let msg = __zuzu_concat\(\s*__zuzu_concat\(\s*"a",\s*__zuzu_add\(\s*1,\s*2\s*\)\s*\),\s*"b"\s*\);/ );
	assert.match( js, /let items = __zuzu_set\(\s*\[\s*1,\s*2\s*\]\s*\);/ );
	assert.match( js, /let bag = __zuzu_bag\(\s*\[\s*1,\s*2\s*\]\s*\);/ );
	assert.match( js, /let pl = __zuzu_pairlist_literal\(\s*\[\s*\[\s*"foo",\s*1\s*\],\s*\[\s*"bar",\s*2\s*\]\s*\]\s*\);/ );
}

{
	const js = transpileWithoutFallback( `
		from std/string import trim;
		let label := trim( "  hi  " );
		say( label );
	` );
	assert.match( js, /__zuzu_import\( "std\/string" \)/ );
	assert.match( js, /let label = trim\( "  hi  " \);/ );
}

{
	const js = transpileWithoutFallback( 'class Foo extends Bar; let ok := ¬false; let n := 6 × 7; let c := 5 ≶ 4; let b := true ⋀ false;' );
	assert.match( js, /let Foo = __zuzu_make_class\( "Foo", Bar \);/ );
	assert.match( js, /let ok = __zuzu_not\( false \);/ );
	assert.match( js, /let n = __zuzu_mul\( 6, 7 \);/ );
	assert.match( js, /let c = __zuzu_cmp\( 5, 4 \);/ );
	assert.match( js, /let b = \( \(\) => \{ const __zuzu_left = true;/ );
	assert.match( js, /return __zuzu_truthy\( __zuzu_left \) \? \( __zuzu_truthy\( false \) \? 1 : 0 \) : 0;/ );
}

{
	const js = transpile( 'class Foo {}' );
	assert.equal( js, 'let Foo = __zuzu_define_class( "Foo", Object, { "traits": [  ], "fields": [  ], "methods": {  }, "statics": {  }, "nested": {  } } );' );
}

{
	const js = transpileWithoutFallback( `
		class Box {
			method value () {
				return 1;
			}
		}
		let box := new Box();
		let got := box.value;
	` );
	assert.match( js, /__zuzu_call_member\(\s*box,\s*"value"\s*\)/u );
}

for ( const source of [
	'class Box { method value () { return 1; } } let box := new Box(); box.value := 2;',
	'class Box { method value () { return 1; } } let box := new Box(); box.value() := 2;',
	'function value () { return 1; } value() := 2;',
	'class Box { method value () { return 1; } } let box := new Box(); box.value += 2;',
	'class Box { method value () { return 1; } } let box := new Box(); ++box.value;',
	'class Box { method value () { return 1; } } let box := new Box(); box.value++;',
] ) {
	assert.throws(
		() => transpileWithoutFallback( source ),
		/Invalid assignment target/u
	);
}

{
	const runtime = new ZuzuScript();
	const result = runtime.runSource( `
		let left := 40;
		let right := 2;
		say( left + right );
	`, { filename: '/tmp/new-transpiler.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout, '42\n' );
}

{
	const runtime = new ZuzuScript();
	const result = runtime.runSource( `
		from test/more import *;

		class Box {
			let hidden := 5;
		}

		let err := exception( function () {
			let box := new Box();
			let got := box.hidden;
		} );
		isnt( err, null, "dot syntax does not read a field fallback" );

		done_testing();
	`, { filename: '/tmp/dot-method-no-fallback.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.match( result.stdout, /1\.\.1/u );
	assert.doesNotMatch( result.stdout, /^not ok/mu );
}

{
	const runtime = new ZuzuScript( { transpiler: 'new-only' } );
	const result = runtime.runSource( `
		class Box;
		fn add( Number left, Number right ) {
			return left + right;
		}
		say( add( 6 × 7, ¬false ? 0 : 0 ) );
	`, { filename: '/tmp/new-only-unicode.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout, '42\n' );
}

{
	const runtime = new ZuzuScript( { transpiler: 'new-only' } );
	const result = runtime.runSource( `
		from test/more import *;
		let hit_and := 0;
		let left := null;
		let a := left ≢ null and left.get("key") ≡ null;
		let hit_or := 0;
		let b := left ≡ null or do {
			hit_or++;
			false;
		};
		is( a, false, "and short-circuits null guard" );
		is( hit_and, 0, "and skips right side when left is false" );
		is( b, true, "or short-circuits truthy left side" );
		is( hit_or, 0, "or skips right side when left is true" );
		done_testing();
	`, { filename: '/tmp/new-only-short-circuit.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.match( result.stdout, /ok\s+1\b/ );
	assert.match( result.stdout, /ok\s+2\b/ );
	assert.match( result.stdout, /ok\s+3\b/ );
	assert.match( result.stdout, /ok\s+4\b/ );
}

{
	const runtime = new ZuzuScript( { transpiler: 'new-only' } );
	const result = runtime.runSource( `
		function english_listish ( Collection c ) {
			return c.length();
		}
		say( english_listish( [ "foo", "bar" ] ) );
	`, { filename: '/tmp/new-only-collection.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout, '2\n' );
}

{
	const runtime = new ZuzuScript( { transpiler: 'new-only' } );
	const result = runtime.runSource( `
		function crcish ( BinaryString value ) {
			return value;
		}
		try {
			crcish( "abc" );
			say( "no error" );
		}
		catch ( Exception err ) {
			say( err.message );
		}
	`, { filename: '/tmp/new-only-typeerror.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.match( result.stdout, /TypeException: 'value' must be BinaryString, got String/ );
}

{
	assert.throws(
		() => transpile( 'class Foo {}', { transpiler: 'new' } ),
		/Unknown transpiler: new/
	);
}

{
	const js = transpileWithoutFallback(
		'let report := { meta: { title: "Before" } }; let title := report @ "/meta/title" := "After";'
	);
	assert.match(
		js,
		/__zuzu_path_assign\(\s*report,\s*"\/meta\/title",\s*"After",\s*"first",\s*":="\s*\)/
	);
}

{
	const js = transpileWithoutFallback(
		'let report := {}; report @? "/meta/title" += 1; report @@ "/users/*/age" += 2;'
	);
	assert.match(
		js,
		/__zuzu_path_assign\(\s*report,\s*"\/meta\/title",\s*1,\s*"maybe",\s*"\+=\"\s*\)/
	);
	assert.match(
		js,
		/__zuzu_path_assign\(\s*report,\s*"\/users\/\*\/age",\s*2,\s*"all",\s*"\+=\"\s*\)/
	);
}

{
	const js = transpileWithoutFallback(
		'let report := {}; let focused := \\( report @ "/meta/title" ); let maybe := \\( report @? "/meta/title" ); let many := \\( report @@ "/users/*/age" );'
	);
	assert.match(
		js,
		/__zuzu_path_ref\(\s*report,\s*"\/meta\/title",\s*"first"\s*\)/
	);
	assert.match(
		js,
		/__zuzu_path_ref\(\s*report,\s*"\/meta\/title",\s*"maybe"\s*\)/
	);
	assert.match(
		js,
		/__zuzu_path_ref\(\s*report,\s*"\/users\/\*\/age",\s*"all"\s*\)/
	);
}

{
	const js = transpileWithoutFallback(
		'let report := {}; ++( report @ "/meta/title" ); ( report @@ "/users/*/age" )++;'
	);
	assert.match(
		js,
		/__zuzu_path_update\(\s*report,\s*"\/meta\/title",\s*"first",\s*"\+\+",\s*true\s*\)/
	);
	assert.match(
		js,
		/__zuzu_path_update\(\s*report,\s*"\/users\/\*\/age",\s*"all",\s*"\+\+",\s*false\s*\)/
	);
}

{
	const js = transpileWithoutFallback(
		'let report := {}; report @ "/meta/title" ~= /[0-9]+/ -> "world";'
	);
	assert.match(
		js,
		/__zuzu_path_assign\(\s*report,\s*"\/meta\/title",\s*\[\s*new RegExp\( "\[0-9\]\+", "" \),\s*\(\s*m\s*\)\s*=>\s*"world"\s*\],\s*"first",\s*"~="\s*\)/
	);
}

{
	const js = transpileWithoutFallback( `
		let switched := "none";
		switch ( "beta" : eq ) {
			case "alpha":
				switched := "alpha";
			case "beta", "gamma":
				switched := switched _ "!";
				continue;
			default:
				switched := switched _ "?";
		}
	` );
	assert.match( js, /__zuzu_switch\( "beta", "eq"/ );
	assert.match( js, /tests: \[ function\( __zuzu_switch_value \)/ );
	assert.match( js, /__zuzu_str_eq\( __zuzu_switch_value, "alpha" \)/ );
	assert.match( js, /__zuzu_str_eq\( __zuzu_switch_value, "gamma" \)/ );
	assert.match( js, /return true;/ );
	assert.doesNotMatch( js, /let __zuzu_switch_result :=/ );
}

{
	const runtime = new ZuzuScript( { transpiler: 'new-only' } );
	const result = runtime.runSource( `
		from test/more import *;
		fn choose( String label ) {
			switch ( label : eq ) {
				case "first":
					return "one";
				case "second":
					while ( false ) {
						continue;
					}
					return "two";
				default:
					return "other";
			}
		}
		is( choose( "first" ), "one", "switch case return works in new parser" );
		is( choose( "second" ), "two", "loop continue stays a loop continue" );
		is( choose( "other" ), "other", "default return works in new parser" );
		done_testing();
	`, { filename: '/tmp/new-only-switch.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.match( result.stdout, /ok\s+1\b/ );
	assert.match( result.stdout, /ok\s+2\b/ );
	assert.match( result.stdout, /ok\s+3\b/ );
}

{
	const runtime = new ZuzuScript( { transpiler: 'new-only' } );
	const result = runtime.runSource( `
		from std/internals import setprop;
		from std/path/z import ZPath;
		from test/more import *;
		setprop( "paths", ZPath );
		let report := {
			meta: { title: "Before" },
			users: [
				{ name: "Ada", role: "admin" },
				{ name: "Bob", role: "reader" },
			],
		};
		let focused := report @ "/meta/title" := "After";
		let bulk := report @@ "/users/*/role" := "member";
		is( focused, "After", "path @ assignment returns assigned value" );
		is( bulk, "member", "path @@ assignment returns assigned value" );
		is( report{meta}{title}, "After", "path @ assignment mutates target" );
		is( report{users}[0]{role}, "member", "path @@ assignment mutates first match" );
		is( report{users}[1]{role}, "member", "path @@ assignment mutates later matches" );
		done_testing();
	`, { filename: '/tmp/new-only-path-assignment.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.match( result.stdout, /ok\s+1\b/ );
	assert.match( result.stdout, /ok\s+2\b/ );
	assert.match( result.stdout, /ok\s+3\b/ );
	assert.match( result.stdout, /ok\s+4\b/ );
	assert.match( result.stdout, /ok\s+5\b/ );
}

{
	const runtime = new ZuzuScript( { transpiler: 'new-only' } );
	const result = runtime.runSource( `
		from std/path/z import ZPath;
		from std/path/simple import SimplePath;
		from test/more import *;

		let report := {
			meta: { title: "Read 2026" },
			users: [
				{ name: "Ada", age: 32 },
				{ name: "Bob", age: 27 },
			],
		};

		let z_age := new ZPath( path: "/users/#0/age" );
		is(
			z_age.assign_first( report, 8, "+=" ),
			40,
			"ZPath assign_first accepts operator argument",
		);
		ok(
			new ZPath( path: "/users/#9/age" ).assign_maybe( report, 1, "+=" ) ≡ false,
			"ZPath assign_maybe returns false on no match",
		);
		let z_title_ref := new ZPath( path: "/meta/title" ).ref_first(report);
		is( z_title_ref(), "Read 2026", "ZPath ref_first getter works" );
		z_title_ref("Updated");
		is( report{meta}{title}, "Updated", "ZPath ref_first setter mutates target" );

		let simple_authors := new SimplePath( path: "users[*].name" );
		is(
			simple_authors.assign_all( report, "!", "_=" ),
			"!",
			"SimplePath assign_all accepts operator argument",
		);
		let simple_refs := simple_authors.ref_all(report);
		is( simple_refs.length(), 2, "SimplePath ref_all returns refs" );
		is( simple_refs[1](), "Bob!", "SimplePath ref_all getter works" );
		ok(
			new SimplePath( path: "users[9].name" ).ref_maybe(report) ≡ null,
			"SimplePath ref_maybe returns null on no match",
		);
		done_testing();
	`, { filename: '/tmp/new-only-path-api-phase1.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.match( result.stdout, /ok\s+1\b/ );
	assert.match( result.stdout, /ok\s+2\b/ );
	assert.match( result.stdout, /ok\s+3\b/ );
	assert.match( result.stdout, /ok\s+4\b/ );
	assert.match( result.stdout, /ok\s+5\b/ );
	assert.match( result.stdout, /ok\s+6\b/ );
	assert.match( result.stdout, /ok\s+7\b/ );
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
			meta: { title: "Read 2026" },
			users: [
				{ name: "Ada", age: 1 },
				{ name: "Bob", age: 2 },
			],
		};

		is(
			report @ "/meta/title" ~= /[0-9]+/ -> "world",
			"Read world",
			"path ~= returns replaced value for @ target",
		);
		is( report{meta}{title}, "Read world", "path ~= mutates @ target" );

		is(
			( report @@ "/users/*/age" )++,
			[ 1, 2 ],
			"@@ postfix update returns array of old values",
		);
		is(
			report @@ "/users/*/age",
			[ 2, 3 ],
			"@@ postfix update mutates all selected values",
		);
		is(
			++( report @ "/users/#0/age" ),
			3,
			"@ prefix update returns new scalar value",
		);
		ok(
			++( report @? "/users/#1/age" ),
			"@? prefix update returns true on match",
		);
		ok(
			not ++( report @? "/users/#9/age" ),
			"@? prefix update returns false on miss",
		);

		let title_ref := \\( report @ "/meta/title" );
		is( title_ref(), "Read world", "path ref getter works at runtime" );
		is( title_ref("Done"), "Done", "path ref setter returns assigned value at runtime" );
		is( report{meta}{title}, "Done", "path ref setter mutates runtime target" );

		SimplePath.use();
		let simple := { users: [ { age: 4 }, { age: 8 } ] };
		is(
			++( simple @ "users[0].age" ),
			5,
			"SimplePath override supports path update helper",
		);
		is(
			( simple @@ "users[*].age" )--,
			[ 5, 8 ],
			"SimplePath override supports multi-target postfix update",
		);
		is(
			simple @@ "users[*].age",
			[ 4, 7 ],
			"SimplePath override mutates through path update helper",
		);
		done_testing();
	`, { filename: '/tmp/new-only-path-runtime-phase4.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.match( result.stdout, /ok\s+1\b/ );
	assert.match( result.stdout, /ok\s+2\b/ );
	assert.match( result.stdout, /ok\s+3\b/ );
	assert.match( result.stdout, /ok\s+4\b/ );
	assert.match( result.stdout, /ok\s+5\b/ );
	assert.match( result.stdout, /ok\s+6\b/ );
	assert.match( result.stdout, /ok\s+7\b/ );
	assert.match( result.stdout, /ok\s+8\b/ );
	assert.match( result.stdout, /ok\s+9\b/ );
	assert.match( result.stdout, /ok\s+10\b/ );
	assert.match( result.stdout, /ok\s+11\b/ );
	assert.match( result.stdout, /ok\s+12\b/ );
	assert.match( result.stdout, /ok\s+13\b/ );
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
			++( report @@ "/users/*/missing" ),
			[],
			"phase5 runtime: @@ update miss returns []",
		);
		ok(
			not ++( report @? "/meta/missing" ),
			"phase5 runtime: @? update miss returns false",
		);
		is(
			\\( report @@ "/users/*/missing" ).length(),
			0,
			"phase5 runtime: @@ ref miss returns empty array",
		);
		ok(
			\\( report @? "/meta/missing" ) ≡ null,
			"phase5 runtime: @? ref miss returns null",
		);

		SimplePath.use();
		let simple := {
			store: {
				title: "Read 2026",
				books: [ { pages: 1 }, { pages: 2 } ],
			},
		};
		is(
			( simple @@ "store.books[*].pages" )--,
			[ 1, 2 ],
			"phase5 runtime: SimplePath postfix update returns old values",
		);
		is(
			simple{store}{books}[0]{pages},
			0,
			"phase5 runtime: SimplePath postfix update mutates first target",
		);
		is(
			\\( simple @ "store.title" )(),
			"Read 2026",
			"phase5 runtime: SimplePath ref works under lexical override",
		);
		done_testing();
	`, { filename: '/tmp/new-only-path-runtime-phase5.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.match( result.stdout, /ok\s+1\b/ );
	assert.match( result.stdout, /ok\s+2\b/ );
	assert.match( result.stdout, /ok\s+3\b/ );
	assert.match( result.stdout, /ok\s+4\b/ );
	assert.match( result.stdout, /ok\s+5\b/ );
	assert.match( result.stdout, /ok\s+6\b/ );
	assert.match( result.stdout, /ok\s+7\b/ );
}

{
	const runtime = new ZuzuScript( { transpiler: 'new-only' } );
	const result = runtime.runSource( 'say( 40 + 2 );', {
		filename: '/tmp/new-only.zzs',
	} );
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout, '42\n' );
}

{
	const runtime = new ZuzuScript( { transpiler: 'new-only' } );
	const result = runtime.runSource( `
		let seen := [];
		for ( let x in [ 1, 2, 3, 4 ] ) {
			if ( x = 2 ) {
				next;
			}
			if ( x = 4 ) {
				seen.push(40);
				last;
			}
			seen.push(x);
		}
		say( seen[0] );
		say( seen[1] );
		say( seen[2] );
	`, { filename: '/tmp/new-only-loop.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout, '1\n3\n40\n' );
}

assert.equal(
	transpile( 'class Foo {}', { transpiler: 'new-only' } ),
	'let Foo = __zuzu_define_class( "Foo", Object, { "traits": [  ], "fields": [  ], "methods": {  }, "statics": {  }, "nested": {  } } );'
);

console.log( 'zuzu-js new transpiler tests passed' );
