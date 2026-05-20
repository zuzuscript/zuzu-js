'use strict';

const assert = require( 'node:assert/strict' );
const { tokenize, parse } = require( '../lib/transpiler-new' );

{
	const ast = parse( tokenize( `
		from std/string import trim, join as join_words;
		let greeting := "hello";
		function render ( value ) {
			return trim( value );
		}
	` ) );

	assert.equal( ast.type, 'Program' );
	assert.equal( ast.body.length, 3 );
	assert.equal( ast.body[0].type, 'ImportDeclaration' );
	assert.equal( ast.body[0].source, 'std/string' );
	assert.equal( ast.body[0].tryMode, false );
	assert.equal( ast.body[0].condition, null );
	assert.deepEqual( ast.body[0].specifiers, [
		{ type: 'ImportSpecifier', imported: 'trim', local: 'trim' },
		{ type: 'ImportSpecifier', imported: 'join', local: 'join_words' },
	] );
	assert.equal( ast.body[1].type, 'VariableDeclaration' );
	assert.equal( ast.body[1].id.name, 'greeting' );
	assert.equal( ast.body[2].type, 'FunctionDeclaration' );
	assert.equal( ast.body[2].id.name, 'render' );
	assert.equal( ast.body[2].body.body[0].type, 'ReturnStatement' );
}

{
	const ast = parse( tokenize( 'from extras/not_real try import Missing;' ) );
	assert.equal( ast.body[0].type, 'ImportDeclaration' );
	assert.equal( ast.body[0].source, 'extras/not_real' );
	assert.equal( ast.body[0].tryMode, true );
	assert.deepEqual( ast.body[0].specifiers, [
		{ type: 'ImportSpecifier', imported: 'Missing', local: 'Missing' },
	] );
}

{
	const ast = parse( tokenize( 'from extras/math import add_x if enabled;' ) );
	assert.equal( ast.body[0].type, 'ImportDeclaration' );
	assert.equal( ast.body[0].source, 'extras/math' );
	assert.equal( ast.body[0].tryMode, false );
	assert.equal( ast.body[0].condition.type, 'PostfixCondition' );
	assert.equal( ast.body[0].condition.keyword, 'if' );
	assert.equal( ast.body[0].condition.test.name, 'enabled' );
}

{
	const ast = parse( tokenize( `
		function join_values (
			String left,
			String right,
		) {
			return left _ right;
		}
	` ) );
	assert.equal( ast.body[0].type, 'FunctionDeclaration' );
	assert.equal( ast.body[0].params.length, 2 );
	assert.equal( ast.body[0].params[0].name, 'left' );
	assert.equal( ast.body[0].params[1].name, 'right' );
}

assert.throws(
	() => parse( tokenize( 'from extras/math try import *;' ) ),
	/Wildcard import '\*' cannot be combined with try import/,
);

assert.throws(
	() => parse( tokenize( 'from extras/math import * if true;' ) ),
	/Wildcard import '\*' cannot be combined with postfix if\/unless/,
);

assert.throws(
	() => parse( tokenize( 'let f := fn ^^ -> ^^;' ) ),
	/'\^\^' is reserved for the chain placeholder/,
);

{
	const ast = parse( tokenize( `
		let owner := null;
		let parent := owner but weak;
		parent := owner but weak;
		class Node {
			let parent with get, set but weak;
		}
	` ) );
	assert.equal( ast.body[1].type, 'VariableDeclaration' );
	assert.equal( ast.body[1].isWeakStorage, true );
	assert.equal( ast.body[2].type, 'ExpressionStatement' );
	assert.equal( ast.body[2].expression.type, 'AssignmentExpression' );
	assert.equal( ast.body[2].expression.isWeakWrite, true );
	assert.equal( ast.body[3].type, 'ClassDeclaration' );
	assert.equal( ast.body[3].body[0].type, 'FieldDeclaration' );
	assert.equal( ast.body[3].body[0].isWeakStorage, true );
}

for ( const source of [
	'let myarray := [];\nlet x := null;\nmyarray.push(x but weak);',
	'let y := null;\nlet x := (y but weak);',
	'let x := 1;\nlet y := 2;\nx += y but weak;',
	'let x := "";\nlet y := "suffix";\nx _= y but weak;',
	'let x;\nlet y := 1;\nx ?:= y but weak;',
	'let owner := null;\nlet data := {};\ndata @? "/parent" := owner but weak;',
	'let owner but strong;',
] ) {
	assert.throws(
		() => parse( tokenize( source ) ),
		/but|weak|Expected|Unexpected|assignment/,
	);
}

console.log( 'zuzu-js parser tests passed' );
