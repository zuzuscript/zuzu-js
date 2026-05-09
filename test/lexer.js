'use strict';

const assert = require( 'node:assert/strict' );
const { tokenize } = require( '../lib/transpiler-new' );

{
	const tokens = tokenize( `
		// comment
		from std/string import trim, join as join_words;
		let greeting := "hello";
	` );
	const values = tokens
		.filter( (token) => token.type !== 'eof' )
		.map( (token) => `${token.type}:${token.value}` );
	assert.deepEqual( values, [
		'keyword:from',
		'identifier:std',
		'operator:/',
		'identifier:string',
		'keyword:import',
		'identifier:trim',
		'punctuation:,',
		'identifier:join',
		'keyword:as',
		'identifier:join_words',
		'punctuation:;',
		'keyword:let',
		'identifier:greeting',
		'operator::=',
		'string:hello',
		'punctuation:;',
	] );
	assert.equal( tokens[0].line, 3 );
	assert.equal( tokens[0].column, 3 );
}

{
	const tokens = tokenize( `#!/usr/bin/env zuzu-js
let greeting := "hello";
` );
	const values = tokens
		.filter( (token) => token.type !== 'eof' )
		.map( (token) => `${token.type}:${token.value}` );
	assert.deepEqual( values, [
		'keyword:let',
		'identifier:greeting',
		'operator::=',
		'string:hello',
		'punctuation:;',
	] );
	assert.equal( tokens[0].line, 2 );
	assert.equal( tokens[0].column, 1 );
}

console.log( 'zuzu-js lexer tests passed' );
