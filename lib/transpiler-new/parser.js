'use strict';

const { withLoc } = require( './ast' );
const { tokenize } = require( './lexer' );
const {
	TranspilerSyntaxError,
	UnsupportedSyntaxError,
} = require( './errors' );

function parse( tokens, options = {} ) {
	let index = 0;
	let asyncContextDepth = 1;

	function startLocFromToken( token ) {
		return {
			start: token.start,
			line: token.line,
			column: token.column,
		};
	}

	function startLocFromNode( node ) {
		return {
			start: node.loc.start.offset,
			line: node.loc.start.line,
			column: node.loc.start.column,
		};
	}

	function endLocFromToken( token ) {
		return {
			end: token.end,
			endLine: token.endLine,
			endColumn: token.endColumn,
		};
	}

	function endLocFromNode( node ) {
		return {
			end: node.loc.end.offset,
			endLine: node.loc.end.line,
			endColumn: node.loc.end.column,
		};
	}

	function current() {
		return tokens[index];
	}

	function peekToken( n = 1 ) {
		return tokens[index + n] || tokens[tokens.length - 1];
	}

	function previous() {
		return tokens[index - 1];
	}

	function canTerminateStatement() {
		const token = current();
		const prev = previous();
		if ( !prev ) {
			return false;
		}
		if ( token.type === 'punctuation' && token.value === '}' ) {
			return true;
		}
		if ( token.type === 'eof' ) {
			return true;
		}
		return token.line > prev.endLine;
	}

	function consumeStatementTerminator(message) {
		if ( match( 'punctuation', ';' ) ) {
			return;
		}
		if ( canTerminateStatement() ) {
			return;
		}
		throw new TranspilerSyntaxError( message || 'Expected statement terminator', current() );
	}

	function atEnd() {
		return current().type === 'eof';
	}

	function match(type, value = null) {
		const token = current();
		if ( token.type !== type ) {
			return false;
		}
		if ( value != null && token.value !== value ) {
			return false;
		}
		index++;
		return true;
	}

	function expect(type, value = null, message = null) {
		const token = current();
		if ( match( type, value ) ) {
			return previous();
		}
		throw new TranspilerSyntaxError(
			message || `Expected ${value != null ? `${type} ${value}` : type}`,
			token
		);
	}

	function expectIdentifier(message = 'Expected identifier') {
		const token = current();
		if ( token.type === 'identifier' || token.type === 'keyword' ) {
			index++;
			return token;
		}
		throw new TranspilerSyntaxError( message, token );
	}

	function parseProgram() {
		const body = [];
		const start = current();
		while ( !atEnd() ) {
			body.push( parseStatement() );
		}
		return withLoc( {
			type: 'Program',
			body,
		}, start, previous() || start );
	}

	function matchPairListClose() {
		if (
			current().type === 'punctuation'
			&& current().value === '}'
			&& peekToken().type === 'punctuation'
			&& peekToken().value === '}'
		) {
			index += 2;
			return true;
		}
		return false;
	}

	function parseExpressionRoot() {
		const expr = parseExpression();
		if ( !atEnd() ) {
			throw new TranspilerSyntaxError( 'Unexpected token after expression', current() );
		}
		return expr;
	}

	function parseStatement() {
		const token = current();
		if ( token.type === 'punctuation' && token.value === ';' ) {
			index++;
			return withLoc( { type: 'EmptyStatement' }, token, token );
		}
		if ( token.type === 'keyword' ) {
			switch ( token.value ) {
				case 'from':
					return parseImportDeclaration();
				case 'let':
				case 'const':
					return parseVariableDeclaration();
				case 'function':
					return parseFunctionDeclaration();
				case 'async':
					if ( peekToken().type === 'keyword' && peekToken().value === 'function' ) {
						return parseFunctionDeclaration();
					}
					if ( peekToken().type === 'keyword' && peekToken().value === 'fn' ) {
						const start = expect( 'keyword', 'async' );
						return parseFunctionDeclarationLikeFn( true, start );
					}
					break;
				case 'return':
					return parseReturnStatement();
				case 'if':
					return parseIfStatement();
				case 'for':
					return parseForStatement();
				case 'while':
					return parseWhileStatement();
				case 'switch':
					return parseSwitchStatement();
				case 'next':
				case 'continue':
					return parseLoopControlStatement( 'ContinueStatement' );
				case 'last':
					return parseLoopControlStatement( 'BreakStatement' );
				case 'throw':
					return parseThrowStatement();
				case 'die':
					return parseDieStatement();
				case 'warn':
					return parseWarnStatement();
				case 'assert':
					return parseAssertStatement();
				case 'debug':
					return parseDebugStatement();
				case 'say':
					return parseSayStatement();
				case 'try':
					return parseTryStatement();
				case 'class':
					return parseClassDeclaration();
				case 'trait':
					return parseTraitDeclaration();
				case 'export':
					return parseExportDeclaration();
				case 'catch':
				case 'unless':
					throw new UnsupportedSyntaxError(
						`Keyword ${token.value} is not supported by zuzu-js transpilation yet`,
						token
					);
				case 'fn':
					return parseFunctionDeclarationLikeFn();
				default:
					break;
			}
		}
		if ( token.type === 'punctuation' && token.value === '{' ) {
			return parseBlockStatement();
		}
		return parseExpressionStatement();
	}

	function parseExportDeclaration() {
		const start = expect( 'keyword', 'export' );
		const token = current();
		const allowed = new Set( [ 'let', 'const', 'function', 'async', 'fn', 'class', 'trait' ] );
		if ( token.type !== 'keyword' || !allowed.has( token.value ) ) {
			throw new TranspilerSyntaxError( 'Expected declaration after export', token );
		}
		const declaration = parseStatement();
		declaration.exported = true;
		declaration.loc.start = {
			offset: start.start,
			line: start.line,
			column: start.column,
		};
		return declaration;
	}

	function parseImportDeclaration() {
		const start = expect( 'keyword', 'from' );
		const moduleParts = [];
		while (
			!( current().type === 'keyword'
				&& ( current().value === 'import' || current().value === 'try' ) )
		) {
			if (
				current().type === 'identifier'
				|| current().type === 'keyword'
				|| ( current().type === 'operator' && current().value === '/' )
				|| ( current().type === 'operator' && current().value === '.' )
				|| ( current().type === 'punctuation' && current().value === '.' )
			) {
				moduleParts.push( current().value );
				index++;
				continue;
			}
			if ( current().type === 'string' ) {
				moduleParts.push( current().value );
				index++;
				break;
			}
			throw new TranspilerSyntaxError( 'Invalid module path in import', current() );
		}
		const tryMode = match( 'keyword', 'try' );
		expect( 'keyword', 'import' );
		let importAll = false;
		const specifiers = [];
		if ( match( 'operator', '*' ) ) {
			if ( tryMode ) {
				throw new TranspilerSyntaxError(
					"Wildcard import '*' cannot be combined with try import",
					previous(),
				);
			}
			importAll = true;
		}
		else {
			do {
				const imported = expectIdentifier();
				let local = imported;
				if ( match( 'keyword', 'as' ) ) {
					local = expectIdentifier( 'Expected alias name after as' );
				}
				specifiers.push( {
					type: 'ImportSpecifier',
					imported: imported.value,
					local: local.value,
				} );
			}
			while ( match( 'punctuation', ',' ) );
		}
		let condition = null;
		if ( current().type === 'keyword' && [ 'if', 'unless' ].includes( current().value ) ) {
			const keyword = current();
			if ( importAll ) {
				throw new TranspilerSyntaxError(
					"Wildcard import '*' cannot be combined with postfix if/unless",
					keyword,
				);
			}
			index++;
			condition = {
				type: 'PostfixCondition',
				keyword: keyword.value,
				test: parseExpression(),
			};
		}
		consumeStatementTerminator( 'Expected ; after import declaration' );
		return withLoc( {
			type: 'ImportDeclaration',
			source: moduleParts.join( '' ),
			tryMode,
			importAll,
			specifiers,
			condition,
		}, start, previous() );
	}

	function parseVariableDeclaration() {
		const start = expect( 'keyword' );
		let declaredType = null;
		let id = expectIdentifier();
		if (
			current().type === 'identifier'
			&& ![ ':=', '=', ';', ',', ')' ].includes( current().value )
		) {
			declaredType = id.value;
			id = expectIdentifier();
		}
		let isWeakStorage = parseOptionalWeakModifier( 'declaration' );
		let init = null;
		if ( match( 'operator', ':=' ) || match( 'operator', '=' ) ) {
			init = parseExpression();
			isWeakStorage = parseOptionalWeakModifier( 'declaration' ) || isWeakStorage;
		}
		consumeStatementTerminator( 'Expected ; after variable declaration' );
		return withLoc( {
			type: 'VariableDeclaration',
			kind: start.value,
			declaredType,
			id: {
				type: 'Identifier',
				name: id.value,
			},
			init,
			isWeakStorage,
		}, start, previous() );
	}

	function parseFunctionDeclaration() {
		let isAsync = false;
		let start = current();
		if ( match( 'keyword', 'async' ) ) {
			isAsync = true;
			start = previous();
		}
		expect( 'keyword', 'function' );
		const id = expectIdentifier();
		const params = parseParameterList();
		const returnType = parseOptionalReturnType();
		const body = parseBlockInAsyncContext( isAsync );
		return withLoc( {
			type: 'FunctionDeclaration',
			id: {
				type: 'Identifier',
				name: id.value,
			},
			params,
			returnType,
			isAsync,
			body,
		}, start, previous() );
	}

	function parseFunctionDeclarationLikeFn( isAsync = false, startOverride = null ) {
		const start = startOverride || current();
		expect( 'keyword', 'fn' );
		const id = expectIdentifier();
		const params = parseParameterList();
		const returnType = parseOptionalReturnType();
		const body = parseBlockInAsyncContext( isAsync );
		return withLoc( {
			type: 'FunctionDeclaration',
			id: {
				type: 'Identifier',
				name: id.value,
			},
			params,
			returnType,
			isAsync,
			body,
		}, start, previous() );
	}

	function parseClassDeclaration() {
		const start = expect( 'keyword', 'class' );
		const id = expectIdentifier( 'Expected class name' );
		let base = null;
		if ( match( 'keyword', 'extends' ) ) {
			const baseId = expectIdentifier( 'Expected base class name after extends' );
			base = withLoc( {
				type: 'Identifier',
				name: baseId.value,
			}, baseId, baseId );
		}
		const traits = parseTraitCompositionList();
		if ( match( 'punctuation', ';' ) ) {
			return withLoc( {
				type: 'ClassDeclaration',
				id: withLoc( {
					type: 'Identifier',
					name: id.value,
				}, id, id ),
				base,
				traits,
				body: [],
				shorthand: true,
			}, start, previous() );
		}
		expect( 'punctuation', '{', 'Expected { to start class body' );
		const body = [];
		while ( !( current().type === 'punctuation' && current().value === '}' ) ) {
			if ( atEnd() ) {
				throw new TranspilerSyntaxError( 'Unterminated class declaration', current() );
			}
			if ( current().type === 'punctuation' && current().value === ';' ) {
				index++;
				continue;
			}
			body.push( parseClassMember() );
		}
		expect( 'punctuation', '}' );
		return withLoc( {
			type: 'ClassDeclaration',
			id: withLoc( {
				type: 'Identifier',
				name: id.value,
			}, id, id ),
			base,
			traits,
			body,
			shorthand: false,
		}, start, previous() );
	}

	function parseTraitDeclaration() {
		const start = expect( 'keyword', 'trait' );
		const id = expectIdentifier( 'Expected trait name' );
		expect( 'punctuation', '{', 'Expected { to start trait body' );
		const body = [];
		while ( !( current().type === 'punctuation' && current().value === '}' ) ) {
			if ( atEnd() ) {
				throw new TranspilerSyntaxError( 'Unterminated trait declaration', current() );
			}
			if ( current().type === 'punctuation' && current().value === ';' ) {
				index++;
				continue;
			}
			body.push( parseMethodDeclaration( { allowStatic: false } ) );
		}
		expect( 'punctuation', '}' );
		return withLoc( {
			type: 'TraitDeclaration',
			id: withLoc( {
				type: 'Identifier',
				name: id.value,
			}, id, id ),
			body,
		}, start, previous() );
	}

	function parseTraitCompositionList() {
		const traits = [];
		if ( current().type === 'keyword' && [ 'with', 'but' ].includes( current().value ) ) {
			index++;
			do {
				const traitId = expectIdentifier( 'Expected trait name' );
				traits.push( withLoc( {
					type: 'Identifier',
					name: traitId.value,
				}, traitId, traitId ) );
			}
			while ( match( 'punctuation', ',' ) );
		}
		return traits;
	}

	function parseOptionalWeakModifier( context ) {
		if ( current().type !== 'keyword' || current().value !== 'but' ) {
			return false;
		}
		index++;
		const modifier = current();
		if (
			!( modifier.type === 'identifier' || modifier.type === 'keyword' )
			|| modifier.value !== 'weak'
		) {
			throw new TranspilerSyntaxError(
				`Unknown but modifier '${modifier.value || ''}' in ${context}; expected 'but weak'`,
				modifier,
			);
		}
		index++;
		return true;
	}

	function parseClassMember() {
		if ( current().type === 'keyword' && [ 'static', 'async' ].includes( current().value ) ) {
			return parseMethodDeclaration( { allowStatic: true } );
		}
		if ( current().type === 'keyword' && current().value === 'method' ) {
			return parseMethodDeclaration( { allowStatic: true } );
		}
		if ( current().type === 'keyword' && [ 'let', 'const' ].includes( current().value ) ) {
			return parseFieldDeclaration();
		}
		if ( current().type === 'keyword' && current().value === 'class' ) {
			return parseClassDeclaration();
		}
		if ( current().type === 'keyword' && current().value === 'trait' ) {
			return parseTraitDeclaration();
		}
		throw new UnsupportedSyntaxError( 'Unsupported class member', current() );
	}

	function parseMethodDeclaration( { allowStatic = true } = {} ) {
		const start = current();
		let isStatic = false;
		let isAsync = false;
		while ( current().type === 'keyword' && [ 'static', 'async' ].includes( current().value ) ) {
			if ( current().value === 'static' ) {
				if ( !allowStatic || isStatic ) {
					break;
				}
				isStatic = true;
				index++;
				continue;
			}
			if ( isAsync ) {
				break;
			}
			isAsync = true;
			index++;
		}
		expect( 'keyword', 'method', 'Expected method declaration' );
		const id = expectIdentifier( 'Expected method name' );
		const params = parseParameterList();
		const returnType = parseOptionalReturnType();
		const body = parseBlockInAsyncContext( isAsync );
		return withLoc( {
			type: 'MethodDeclaration',
			id: withLoc( {
				type: 'Identifier',
				name: id.value,
			}, id, id ),
			params,
			returnType,
			body,
			static: isStatic,
			isAsync,
		}, start, previous() );
	}

	function parseFieldDeclaration() {
		const start = expect( 'keyword' );
		let typeName = null;
		let id = expectIdentifier( 'Expected field name' );
		if (
			current().type === 'identifier'
			&& current().value !== 'with'
			&& !( current().type === 'operator' && current().value === ':=' )
			&& !( current().type === 'punctuation' && [ ';', '}' ].includes( current().value ) )
		) {
			typeName = id.value;
			id = expectIdentifier( 'Expected field name after type' );
		}
		const accessors = [];
		if ( match( 'keyword', 'with' ) ) {
			do {
				accessors.push( expectIdentifier( 'Expected accessor name' ).value );
			}
			while ( match( 'punctuation', ',' ) );
		}
		let isWeakStorage = parseOptionalWeakModifier( 'field declaration' );
		let defaultValue = null;
		if ( match( 'operator', ':=' ) ) {
			defaultValue = parseExpression();
			isWeakStorage = parseOptionalWeakModifier( 'field declaration' ) || isWeakStorage;
		}
		consumeStatementTerminator( 'Expected ; after field declaration' );
		return withLoc( {
			type: 'FieldDeclaration',
			kind: start.value,
			typeName,
			id: withLoc( {
				type: 'Identifier',
				name: id.value,
			}, id, id ),
			accessors,
			defaultValue,
			isWeakStorage,
		}, start, previous() );
	}

	function parseParameterList() {
		expect( 'punctuation', '(' );
		const params = [];
		if ( !match( 'punctuation', ')' ) ) {
			while ( true ) {
				if ( match( 'punctuation', ',' ) ) {
					continue;
				}
				params.push( parseParameter() );
				if ( match( 'punctuation', ')' ) ) {
					break;
				}
				if ( match( 'punctuation', ',' ) && match( 'punctuation', ')' ) ) {
					break;
				}
			}
		}
		return params;
	}

	function parseParameter() {
		const start = current();
		let rest = false;
		if ( match( 'operator', '...' ) ) {
			if ( current().type === 'identifier' && peekToken().type === 'identifier' ) {
				const containerType = expectIdentifier( 'Expected parameter type after ...' );
				const id = expectIdentifier( 'Expected parameter name' );
				return withLoc( {
					type: 'SpecialParameter',
					special: 'rest_only',
					leadName: null,
					containerType: containerType.value,
					name: id.value,
				}, start, previous() || start );
			}
			rest = true;
		}
		let typeName = null;
		let id = expectIdentifier( 'Expected parameter name' );
		if (
			!rest
			&& current().type === 'operator'
			&& current().value === '...'
		) {
			index++;
			const first = expectIdentifier( 'Expected parameter type or name after ...' );
			let containerType;
			let target;
			if (
				current().type === 'identifier'
				&& ![ '?', ':=', ',', ')' ].includes( current().value )
			) {
				containerType = first.value;
				target = expectIdentifier( 'Expected parameter name after special variadic type' );
			}
			else {
				containerType = 'Array';
				target = first;
			}
			return withLoc( {
				type: 'SpecialParameter',
				special: 'lead_rest',
				leadName: id.value,
				containerType,
				name: target.value,
			}, start, previous() || start );
		}
		if (
			!rest
			&& current().type === 'identifier'
			&& ![ '?', ':=', ',', ')' ].includes( current().value )
			&& peekToken().type !== 'identifier'
		) {
			typeName = id.value;
			id = expectIdentifier( 'Expected parameter name after type' );
		}
		let optional = false;
		let defaultValue = null;
		if ( match( 'operator', '?' ) ) {
			optional = true;
		}
		if ( match( 'operator', ':=' ) ) {
			defaultValue = parseExpression();
		}
		return withLoc( {
			type: 'Parameter',
			name: id.value,
			typeName,
			optional,
			defaultValue,
			rest,
		}, start, previous() || start );
	}

	function parseOptionalReturnType() {
		if (
			current().type === 'operator'
			&& ( current().value === '->' || current().value === '→' )
		) {
			index++;
			return expectIdentifier( 'Expected return type after ->' ).value;
		}
		return null;
	}

	function parseReturnStatement() {
		const start = expect( 'keyword', 'return' );
		let argument = null;
		if (
			!( current().type === 'punctuation' && current().value === ';' )
			&& !( current().type === 'keyword' && [ 'if', 'unless' ].includes( current().value ) )
		) {
			argument = parseExpression();
		}
		const stmt = withLoc( {
			type: 'ReturnStatement',
			argument,
		}, start, previous() || start );
		return finishStatement( stmt, 'Expected ; after return statement' );
	}

	function parseIfStatement() {
		const start = expect( 'keyword', 'if' );
		expect( 'punctuation', '(' );
		let declaration = null;
		let test = null;
		if ( current().type === 'keyword' && [ 'let', 'const' ].includes( current().value ) ) {
			declaration = parseInlineVariableDeclaration();
			test = declaration.id;
		}
		else {
			test = parseExpression();
		}
		expect( 'punctuation', ')', 'Expected ) after if condition' );
		const consequent = parseBlockStatement();
		let alternate = null;
		if ( match( 'keyword', 'else' ) ) {
			if ( current().type === 'keyword' && current().value === 'if' ) {
				alternate = parseIfStatement();
			}
			else {
				alternate = parseBlockStatement();
			}
		}
		return withLoc( {
			type: 'IfStatement',
			declaration,
			test,
			consequent,
			alternate,
		}, start, previous() );
	}

	function parseForStatement() {
		const start = expect( 'keyword', 'for' );
		expect( 'punctuation', '(' );
		const decl = expect( 'keyword' );
		if ( decl.value !== 'let' && decl.value !== 'const' ) {
			throw new UnsupportedSyntaxError( 'for loop must declare let or const iterator', decl );
		}
		const id = expectIdentifier( 'Expected loop variable' );
		expect( 'keyword', 'in', 'Expected in inside for loop' );
		const iterable = parseExpression();
		expect( 'punctuation', ')', 'Expected ) after for loop header' );
		const body = parseBlockStatement();
		let elseBlock = null;
		if ( match( 'keyword', 'else' ) ) {
			elseBlock = parseBlockStatement();
		}
		return withLoc( {
			type: 'ForInStatement',
			kind: decl.value,
			left: {
				type: 'Identifier',
				name: id.value,
			},
			iterable,
			body,
			elseBlock,
		}, start, previous() );
	}

	function parseWhileStatement() {
		const start = expect( 'keyword', 'while' );
		expect( 'punctuation', '(' );
		let declaration = null;
		let test = null;
		if ( current().type === 'keyword' && [ 'let', 'const' ].includes( current().value ) ) {
			declaration = parseInlineVariableDeclaration();
			test = declaration.id;
		}
		else {
			test = parseExpression();
		}
		expect( 'punctuation', ')', 'Expected ) after while condition' );
		const body = parseBlockStatement();
		return withLoc( {
			type: 'WhileStatement',
			declaration,
			test,
			body,
		}, start, previous() );
	}

	function parseSwitchStatement() {
		const start = expect( 'keyword', 'switch' );
		expect( 'punctuation', '(' );
		const discriminant = parseExpression();
		let comparator = '==';
		if ( match( 'operator', ':' ) ) {
			const token = current();
			if ( ![ 'identifier', 'keyword', 'operator', 'string' ].includes( token.type ) ) {
				throw new TranspilerSyntaxError( 'Expected switch comparator after :', token );
			}
			index++;
			comparator = token.value;
		}
		expect( 'punctuation', ')', 'Expected ) after switch header' );
		expect( 'punctuation', '{', 'Expected { to start switch body' );
		const cases = [];
		let defaultCase = null;
		while ( !( current().type === 'punctuation' && current().value === '}' ) ) {
			if ( atEnd() ) {
				throw new TranspilerSyntaxError( 'Unterminated switch statement', current() );
			}
			if ( current().type === 'keyword' && current().value === 'case' ) {
				cases.push( parseSwitchCase() );
				continue;
			}
			if ( current().type === 'keyword' && current().value === 'default' ) {
				if ( defaultCase ) {
					throw new TranspilerSyntaxError( 'Duplicate default clause in switch statement', current() );
				}
				defaultCase = parseSwitchDefaultCase();
				continue;
			}
			throw new TranspilerSyntaxError( 'Expected case or default inside switch statement', current() );
		}
		expect( 'punctuation', '}' );
		return withLoc( {
			type: 'SwitchStatement',
			discriminant,
			comparator,
			cases,
			defaultCase,
		}, start, previous() );
	}

	function parseSwitchCase() {
		const start = expect( 'keyword', 'case' );
		const values = [ parseExpression() ];
		while ( match( 'punctuation', ',' ) ) {
			values.push( parseExpression() );
		}
		expect( 'operator', ':', 'Expected : after switch case' );
		const consequent = parseSwitchConsequent( start );
		return withLoc( {
			type: 'SwitchCase',
			values,
			consequent,
		}, start, endLocFromNode( consequent ) );
	}

	function parseSwitchDefaultCase() {
		const start = expect( 'keyword', 'default' );
		expect( 'operator', ':', 'Expected : after default' );
		const consequent = parseSwitchConsequent( start );
		return withLoc( {
			type: 'SwitchCase',
			values: null,
			consequent,
		}, start, endLocFromNode( consequent ) );
	}

	function parseSwitchConsequent( startToken ) {
		const body = [];
		while ( true ) {
			if ( atEnd() ) {
				throw new TranspilerSyntaxError( 'Unterminated switch case body', current() );
			}
			if ( current().type === 'punctuation' && current().value === '}' ) {
				break;
			}
			if ( current().type === 'keyword' && [ 'case', 'default' ].includes( current().value ) ) {
				break;
			}
			body.push( parseStatement() );
		}
		return withLoc( {
			type: 'BlockStatement',
			body,
		}, startToken, previous() || startToken );
	}

	function parseInlineVariableDeclaration() {
		const start = expect( 'keyword' );
		let declaredType = null;
		let id = expectIdentifier();
		if (
			current().type === 'identifier'
			&& ![ ':=', '=', ';', ',', ')' ].includes( current().value )
		) {
			declaredType = id.value;
			id = expectIdentifier( 'Expected variable name after type' );
		}
		let isWeakStorage = parseOptionalWeakModifier( 'declaration' );
		let init = null;
		if ( match( 'operator', ':=' ) || match( 'operator', '=' ) ) {
			init = parseExpression();
			isWeakStorage = parseOptionalWeakModifier( 'declaration' ) || isWeakStorage;
		}
		return withLoc( {
			type: 'VariableDeclaration',
			kind: start.value,
			declaredType,
			id: {
				type: 'Identifier',
				name: id.value,
			},
			init,
			isWeakStorage,
		}, start, previous() );
	}

	function parseLoopControlStatement( type ) {
		const start = expect( 'keyword' );
		const stmt = withLoc( { type }, start, previous() || start );
		return finishStatement( stmt, `Expected ; after ${start.value}` );
	}

	function parseThrowStatement() {
		const start = expect( 'keyword', 'throw' );
		const argument = parseExpression();
		const stmt = withLoc( {
			type: 'ThrowStatement',
			argument,
		}, start, previous() );
		return finishStatement( stmt, 'Expected ; after throw statement' );
	}

	function parseDieStatement() {
		const start = expect( 'keyword', 'die' );
		const argument = parseExpression();
		const stmt = withLoc( {
			type: 'DieStatement',
			argument,
		}, start, previous() );
		return finishStatement( stmt, 'Expected ; after die statement' );
	}

	function parseWarnStatement() {
		const start = expect( 'keyword', 'warn' );
		const argument = parseExpression();
		const stmt = withLoc( {
			type: 'WarnStatement',
			argument,
		}, start, previous() );
		return finishStatement( stmt, 'Expected ; after warn statement' );
	}

	function parseAssertStatement() {
		const start = expect( 'keyword', 'assert' );
		const argument = parseExpression();
		const stmt = withLoc( {
			type: 'AssertStatement',
			argument,
		}, start, previous() );
		return finishStatement( stmt, 'Expected ; after assert statement' );
	}

	function parseDebugStatement() {
		const start = expect( 'keyword', 'debug' );
		const argumentsList = [];
		if ( !( current().type === 'punctuation' && current().value === ';' ) ) {
			argumentsList.push( parseExpression() );
			while ( match( 'punctuation', ',' ) ) {
				argumentsList.push( parseExpression() );
			}
		}
		const stmt = withLoc( {
			type: 'DebugStatement',
			arguments: argumentsList,
		}, start, previous() || start );
		return finishStatement( stmt, 'Expected ; after debug statement' );
	}

	function parseSayStatement() {
		const start = expect( 'keyword', 'say' );
		const args = [];
		if ( !( current().type === 'punctuation' && current().value === ';' ) ) {
			args.push( parseExpression() );
			while ( match( 'punctuation', ',' ) ) {
				args.push( parseExpression() );
			}
		}
		const stmt = withLoc( {
			type: 'ExpressionStatement',
			expression: withLoc( {
				type: 'CallExpression',
				callee: withLoc( {
					type: 'Identifier',
					name: 'say',
				}, start, start ),
				arguments: args,
			}, start, previous() || start ),
		}, start, previous() || start );
		return finishStatement( stmt, 'Expected ; after say statement' );
	}

	function parseTryStatement() {
		const parsed = parseTryLike();
		return withLoc( {
			type: 'TryStatement',
			block: parsed.block,
			handlers: parsed.handlers,
		}, parsed.start, previous() );
	}

	function parseTryLike() {
		const start = expect( 'keyword', 'try' );
		const block = parseBlockStatement();
		const handlers = [];
		while ( current().type === 'keyword' && current().value === 'catch' ) {
			const catchTok = expect( 'keyword', 'catch' );
			let typeName = 'Exception';
			let paramName = 'e';
			if ( match( 'punctuation', '(' ) ) {
				if ( current().type === 'identifier' ) {
					const first = current();
					index++;
					if ( current().type === 'identifier' ) {
						typeName = first.value;
						paramName = current().value;
						index++;
					}
					else {
						paramName = first.value;
					}
				}
				expect( 'punctuation', ')', 'Expected ) after catch clause' );
			}
			const handlerBody = parseBlockStatement();
			handlers.push( withLoc( {
				type: 'CatchClause',
				typeName,
				paramName,
				body: handlerBody,
			}, catchTok, previous() ) );
		}
		return {
			start,
			block,
			handlers,
		};
	}

	function parseBlockStatement() {
		const start = expect( 'punctuation', '{' );
		const body = [];
		while ( !( current().type === 'punctuation' && current().value === '}' ) ) {
			if ( atEnd() ) {
				throw new TranspilerSyntaxError( 'Unterminated block statement', current() );
			}
			body.push( parseStatement() );
		}
		expect( 'punctuation', '}' );
		return withLoc( {
			type: 'BlockStatement',
			body,
		}, start, previous() );
	}

	function parseBlockInAsyncContext( isAsync ) {
		const previousDepth = asyncContextDepth;
		asyncContextDepth = isAsync ? previousDepth + 1 : 0;
		try {
			return parseBlockStatement();
		}
		finally {
			asyncContextDepth = previousDepth;
		}
	}

	function parseExpressionStatement() {
		const start = current();
		const expression = parseExpression();
		const stmt = withLoc( {
			type: 'ExpressionStatement',
			expression,
		}, start, previous() );
		return finishStatement( stmt, 'Expected ; after expression' );
	}

	function finishStatement(stmt, semicolonMessage) {
		if ( current().type === 'keyword' && [ 'if', 'unless' ].includes( current().value ) ) {
			const keyword = current();
			index++;
			let test = parseExpression();
			if ( keyword.value === 'unless' ) {
				test = withLoc( {
					type: 'UnaryExpression',
					operator: 'not',
					argument: test,
					prefix: true,
				}, keyword, endLocFromNode( test ) );
			}
			expect( 'punctuation', ';', semicolonMessage );
			const consequent = withLoc( {
				type: 'BlockStatement',
				body: [ stmt ],
			}, startLocFromNode( stmt ), endLocFromNode( stmt ) );
			return withLoc( {
				type: 'IfStatement',
				declaration: null,
				test,
				consequent,
				alternate: null,
			}, startLocFromNode( stmt ), endLocFromNode( consequent ) );
		}
		consumeStatementTerminator( semicolonMessage );
		return stmt;
	}

	function parseExpression() {
		return parseAssignment();
	}

	function parseConditional() {
		return parseConditionalTail( parseLogicalOr() );
	}

	function parseConditionalTail(expr) {
		if ( match( 'operator', '?:' ) ) {
			const alternate = parseConditional();
			return withLoc( {
				type: 'ShortTernaryExpression',
				test: expr,
				alternate,
			}, startLocFromNode( expr ), endLocFromNode( alternate ) );
		}
		if ( match( 'operator', '?' ) ) {
			const consequent = parseExpression();
			expect( 'operator', ':', 'Expected : in ternary expression' );
			const alternate = parseConditional();
			return withLoc( {
				type: 'ConditionalExpression',
				test: expr,
				consequent,
				alternate,
			}, startLocFromNode( expr ), endLocFromNode( alternate ) );
		}
		return expr;
	}

	function parseAssignment() {
		const left = parseLogicalOr();
		if (
			current().type === 'operator'
			&& [ ':=', '+=', '-=', '*=', '/=', '%=', '**=', '_=', '?:=', '×=', '÷=' ].includes( current().value )
		) {
			const op = current();
			index++;
			const right = parseAssignment();
			const isWeakWrite = parseOptionalWeakModifier( 'assignment' );
			if ( isWeakWrite && op.value !== ':=' ) {
				throw new TranspilerSyntaxError(
					"but weak is only valid on ':=' assignments",
					op,
				);
			}
			if (
				isWeakWrite
				&& left
				&& left.type === 'BinaryExpression'
				&& left.operator === '@?'
			) {
				throw new TranspilerSyntaxError(
					'but weak is not valid on @? path assignments',
					op,
				);
			}
			return withLoc( {
				type: 'AssignmentExpression',
				operator: op.value,
				left,
				right,
				isWeakWrite,
			}, startLocFromNode( left ), endLocFromNode( right ) );
		}
		if ( current().type === 'operator' && current().value === '~=' ) {
			const op = current();
			index++;
			const pattern = parseLogicalOr();
			if (
				current().type !== 'operator'
				|| !( current().value === '->' || current().value === '→' )
			) {
				throw new TranspilerSyntaxError( 'Expected -> after regex replacement pattern', current() );
			}
			index++;
			const replacement = parseAssignment();
			return withLoc( {
				type: 'RegexReplaceExpression',
				operator: op.value,
				left,
				pattern,
				replacement,
			}, startLocFromNode( left ), endLocFromNode( replacement ) );
		}
		return parseConditionalTail( left );
	}

	function parseLogicalOr() {
		return parseLeftAssociative(
			parseLogicalAnd,
			(token) => token.type === 'keyword' && [ 'or', 'xor', 'nand' ].includes( token.value )
				|| ( token.type === 'operator' && [ '⋁', '⊻', '⊼' ].includes( token.value ) )
		);
	}

	function parseLogicalAnd() {
		return parseLeftAssociative(
			parseEquality,
			(token) => token.type === 'keyword' && token.value === 'and'
				|| ( token.type === 'operator' && token.value === '⋀' )
		);
	}

	function parseEquality() {
		return parseLeftAssociative(
			parseBitwise,
			(token) => token.type === 'operator' && [ '==', '!=', '=' ].includes( token.value )
				|| ( token.type === 'operator' && [ '≡', '≢', '≠' ].includes( token.value ) )
				|| ( token.type === 'keyword' && [ 'eq', 'ne' ].includes( token.value ) )
		);
	}

	function parseBitwise() {
		return parseLeftAssociative(
			parseComparison,
			(token) => token.type === 'operator' && [ '&', '|', '^' ].includes( token.value )
		);
	}

	function parseComparison() {
		return parseLeftAssociative(
			parseRange,
			(token) => (
				token.type === 'operator'
				&& [ '<', '<=', '>', '>=', '≤', '≥', '~', '<=>', '@', '@@', '@?', '\\', '∈', '∉', '⋃', '⋂', '∖', '⊂', '⊃', '⊂⊃', '≶', '≷' ].includes( token.value )
			) || (
				token.type === 'keyword'
				&& [ 'gt', 'ge', 'lt', 'le', 'cmp', 'eqi', 'nei', 'gti', 'gei', 'lti', 'lei', 'cmpi', 'in', 'not_in', 'union', 'intersection', 'difference', 'subsetof', 'supersetof', 'equivalentof', 'does', 'can' ].includes( token.value )
			) || (
				token.type === 'identifier' && token.value === 'instanceof'
			)
		);
	}

	function parseRange() {
		return parseLeftAssociative(
			parseTerm,
			(token) => token.type === 'operator' && token.value === '...'
		);
	}

	function parseTerm() {
		return parseLeftAssociative(
			parseFactor,
			(token) => token.type === 'operator' && [ '+', '-', '_' ].includes( token.value )
		);
	}

	function parseFactor() {
		return parseLeftAssociative(
			parseUnary,
			(token) => (
				token.type === 'operator' && [ '*', '/', '%', '**' ].includes( token.value )
				|| ( token.type === 'operator' && [ '×', '÷' ].includes( token.value ) )
			) || (
				token.type === 'keyword' && token.value === 'mod'
			)
		);
	}

	function parseLeftAssociative(nextFn, predicate) {
		let expr = nextFn();
		while ( predicate( current() ) ) {
			const op = current();
			index++;
			const right = nextFn();
			expr = withLoc( {
				type: 'BinaryExpression',
				operator: op.value,
				left: expr,
				right,
			}, startLocFromNode( expr ), endLocFromNode( right ) );
		}
		return expr;
	}

	function parseUnary() {
		if (
			( current().type === 'operator' && [ '-', '+', '++', '--', '!', '~', '\\', '√', '¬' ].includes( current().value ) )
			|| ( current().type === 'keyword' && [ 'not', 'typeof', 'abs', 'sqrt', 'floor', 'ceil', 'round', 'int', 'length', 'uc', 'lc' ].includes( current().value ) )
		) {
			const op = current();
			index++;
			const argument = op.value === '\\' ? parseReferenceTarget() : parseUnary();
			let expr = withLoc( {
				type: op.value === '\\' ? 'RefExpression' : 'UnaryExpression',
				operator: op.value,
				argument,
				prefix: true,
			}, startLocFromToken( op ), endLocFromNode( argument ) );
			if ( op.value === '\\' ) {
				expr = parsePostfixSuffixes( expr );
			}
			return expr;
		}
		return parsePostfix();
	}

	function parseReferenceTarget() {
		let expr = parsePrimary();
		while ( true ) {
			const nextExpr = parseMemberAccess( expr );
			if ( nextExpr === expr ) {
				break;
			}
			expr = nextExpr;
		}
		return expr;
	}

	function parsePostfix() {
		return parsePostfixSuffixes( parsePrimary() );
	}

	function parsePostfixSuffixes(expr) {
		while ( true ) {
			const nextExpr = parseMemberAccess( expr );
			if ( nextExpr !== expr ) {
				expr = nextExpr;
				continue;
			}
			if ( current().type === 'punctuation' && current().value === '(' ) {
				const args = parseCallArgumentsOnly();
				expr = withLoc( {
					type: 'CallExpression',
					callee: expr,
					arguments: args,
				}, startLocFromNode( expr ), endLocFromToken( previous() ) );
				continue;
			}
			if ( current().type === 'operator' && [ '++', '--' ].includes( current().value ) ) {
				const op = current();
				index++;
				expr = withLoc( {
					type: 'UpdateExpression',
					operator: op.value,
					argument: expr,
					prefix: false,
				}, startLocFromNode( expr ), endLocFromToken( op ) );
				continue;
			}
			break;
		}
		return expr;
	}

	function parseMemberAccess(expr) {
		if ( match( 'punctuation', '.' ) ) {
			if ( match( 'punctuation', '(' ) ) {
				const property = parseExpression();
				expect( 'punctuation', ')', 'Expected ) after dynamic member name' );
				return withLoc( {
					type: 'MemberExpression',
					object: expr,
					property,
					computed: true,
				}, startLocFromNode( expr ), endLocFromToken( previous() ) );
			}
			const property = expectIdentifier( 'Expected property name after .' );
			return withLoc( {
				type: 'MemberExpression',
				object: expr,
				property: {
					type: 'Identifier',
					name: property.value,
				},
				computed: false,
			}, startLocFromNode( expr ), endLocFromToken( property ) );
		}
		if ( match( 'punctuation', '[' ) ) {
			const closeBracket = current().type === 'punctuation' && current().value === ']';
			const startsWithColon = current().type === 'operator' && current().value === ':';
			let first = null;
			if ( !closeBracket && !startsWithColon ) {
				first = parseExpression();
			}
			if ( match( 'operator', ':' ) ) {
				let second = null;
				if ( !( current().type === 'punctuation' && current().value === ']' ) ) {
					second = parseExpression();
				}
				expect( 'punctuation', ']' );
				return withLoc( {
					type: 'SliceExpression',
					object: expr,
					start: first,
					length: second,
				}, startLocFromNode( expr ), endLocFromToken( previous() ) );
			}
			if ( first == null ) {
				throw new TranspilerSyntaxError( 'Expected index or slice expression', current() );
			}
			expect( 'punctuation', ']' );
			return withLoc( {
				type: 'MemberExpression',
				object: expr,
				property: first,
				computed: true,
			}, startLocFromNode( expr ), endLocFromToken( previous() ) );
		}
		if ( match( 'punctuation', '{' ) ) {
			let property;
			if (
				( current().type === 'identifier' || current().type === 'keyword' )
				&& peekToken().type === 'punctuation'
				&& peekToken().value === '}'
			) {
				const key = current();
				index++;
				property = withLoc(
					key.type === 'identifier'
						? {
							type: 'BraceIdentifier',
							name: key.value,
						}
						: {
							type: 'StringLiteral',
							value: key.value,
						},
					key,
					key
				);
			}
			else {
				property = parseExpression();
			}
			expect( 'punctuation', '}' );
			return withLoc( {
				type: 'MemberExpression',
				object: expr,
				property,
				computed: true,
			}, startLocFromNode( expr ), endLocFromToken( previous() ) );
		}
		return expr;
	}

	function parseCallArgumentsOnly() {
		expect( 'punctuation', '(' );
		const args = [];
		let closed = false;
		if ( !match( 'punctuation', ')' ) ) {
			while ( true ) {
				if ( match( 'punctuation', ',' ) ) {
					if ( current().type === 'punctuation' && current().value === ')' ) {
						break;
					}
					continue;
				}
				if ( current().type === 'punctuation' && current().value === ')' ) {
					break;
				}
				args.push( parseCallArgument() );
				if ( match( 'punctuation', ')' ) ) {
					closed = true;
					break;
				}
				match( 'punctuation', ',' );
			}
			if ( !closed && current().type === 'punctuation' && current().value === ')' ) {
				expect( 'punctuation', ')', 'Expected ) after call arguments' );
			}
		}
		return args;
	}

	function parseCallArgument() {
		const start = current();
		const expr = parseExpression();
		if ( current().type === 'keyword' && current().value === 'but' ) {
			throw new TranspilerSyntaxError(
				'but weak is not valid as a function argument marker',
				current(),
			);
		}
		if ( current().type === 'operator' && current().value === ':' ) {
			const normalized = normalizeNamedArgumentKey( expr );
			expect( 'operator', ':', 'Expected : in named argument' );
			const value = parseExpression();
			return withLoc( {
				type: 'NamedArgument',
				key: normalized.key,
				keyExpr: normalized.keyExpr,
				value,
			}, startLocFromNode( expr ), previous() );
		}
		return expr;
	}

	function normalizeNamedArgumentKey(expr) {
		if ( expr.type === 'Identifier' ) {
			return {
				key: expr.name,
				keyExpr: withLoc( {
					type: 'StringLiteral',
					value: expr.name,
				}, startLocFromNode( expr ), endLocFromNode( expr ) ),
			};
		}
		if ( expr.type === 'StringLiteral' ) {
			return {
				key: expr.value,
				keyExpr: expr,
			};
		}
		if ( expr.type === 'GroupedExpression' ) {
			return normalizeNamedArgumentKey( expr.expression );
		}
		if ( expr.type === 'MemberExpression' ) {
			if ( expr.computed && expr.property.type === 'StringLiteral' ) {
				return {
					key: expr.property.value,
					keyExpr: withLoc( {
						type: 'StringLiteral',
						value: expr.property.value,
					}, startLocFromNode( expr.property ), endLocFromNode( expr.property ) ),
				};
			}
			if ( !expr.computed && expr.property.type === 'Identifier' ) {
				return {
					key: expr.property.name,
					keyExpr: withLoc( {
						type: 'StringLiteral',
						value: expr.property.name,
					}, startLocFromNode( expr.property ), endLocFromNode( expr.property ) ),
				};
			}
		}
		return {
			key: null,
			keyExpr: expr,
		};
	}

	function parsePrimary() {
		const token = current();
		if ( match( 'number' ) ) {
			return withLoc( {
				type: 'NumericLiteral',
				value: Number( token.value ),
			}, token, token );
		}
		if ( match( 'string' ) ) {
			return withLoc( {
				type: 'StringLiteral',
				value: token.value,
			}, token, token );
		}
		if ( match( 'binary_string' ) ) {
			return withLoc( {
				type: 'BinaryStringLiteral',
				value: token.value,
			}, token, token );
		}
		if ( match( 'template' ) ) {
			const parts = token.value.map( (part) => {
				if ( part.type === 'text' ) {
					return withLoc( {
						type: 'StringLiteral',
						value: part.value,
					}, token, token );
				}
				return parseTemplateExpression( part.value, token );
			} );
			return withLoc( {
				type: 'TemplateLiteral',
				parts,
			}, token, token );
		}
		if ( match( 'regexp' ) ) {
			return withLoc( {
				type: 'RegExpLiteral',
				pattern: token.value.pattern,
				flags: token.value.flags,
			}, token, token );
		}
		if ( token.type === 'keyword' && [ 'true', 'false', 'null' ].includes( token.value ) ) {
			index++;
			return withLoc( {
				type: 'Literal',
				value: token.value === 'null' ? null : token.value === 'true',
			}, token, token );
		}
		if ( token.type === 'keyword' && token.value === 'super' ) {
			index++;
			return withLoc( {
				type: 'Super',
			}, token, token );
		}
		if ( match( 'identifier' ) ) {
			return withLoc( {
				type: 'Identifier',
				name: token.value,
			}, token, token );
		}
		if ( token.type === 'keyword' && token.value === 'say' ) {
			index++;
			return withLoc( {
				type: 'Identifier',
				name: token.value,
			}, token, token );
		}
		if ( token.type === 'keyword' && token.value === 'function' ) {
			index++;
			const params = parseParameterList();
			const body = parseBlockInAsyncContext( false );
			return withLoc( {
				type: 'FunctionExpression',
				params,
				isAsync: false,
				body,
			}, token, previous() );
		}
		if ( token.type === 'keyword' && token.value === 'async' ) {
			index++;
			if ( current().type === 'keyword' && current().value === 'function' ) {
				const functionToken = current();
				index++;
				const params = parseParameterList();
				const body = parseBlockInAsyncContext( true );
				return withLoc( {
					type: 'FunctionExpression',
					params,
					isAsync: true,
					body,
				}, token, previous() || functionToken );
			}
			if ( current().type === 'keyword' && current().value === 'fn' ) {
				return parseFnExpression( token, true );
			}
			throw new TranspilerSyntaxError( 'Expected function or fn after async', current() );
		}
		if ( token.type === 'keyword' && token.value === 'fn' ) {
			return parseFnExpression( token, false );
		}
		if ( token.type === 'keyword' && token.value === 'await' ) {
			if ( asyncContextDepth <= 0 ) {
				throw new TranspilerSyntaxError( 'await may only be used inside async code', token );
			}
			index++;
			const block = parseBlockStatement();
			return withLoc( {
				type: 'AwaitExpression',
				block,
			}, token, previous() );
		}
		if ( token.type === 'keyword' && token.value === 'spawn' ) {
			if ( asyncContextDepth <= 0 ) {
				throw new TranspilerSyntaxError( 'spawn may only be used inside async code', token );
			}
			index++;
			const block = parseBlockStatement();
			return withLoc( {
				type: 'SpawnExpression',
				block,
			}, token, previous() );
		}
		if ( token.type === 'keyword' && token.value === 'try' ) {
			const parsed = parseTryLike();
			return withLoc( {
				type: 'TryExpression',
				block: parsed.block,
				handlers: parsed.handlers,
			}, parsed.start, previous() );
		}
		if ( token.type === 'keyword' && token.value === 'do' ) {
			index++;
			const block = parseBlockStatement();
			return withLoc( {
				type: 'DoExpression',
				block,
			}, token, previous() );
		}
		if ( token.type === 'keyword' && token.value === 'new' ) {
			index++;
			let callee = parsePrimary();
			while ( true ) {
				const nextExpr = parseMemberAccess( callee );
				if ( nextExpr === callee ) {
					break;
				}
				callee = nextExpr;
			}
			if ( current().type === 'punctuation' && current().value === '(' ) {
				const args = parseCallArgumentsOnly();
				callee = withLoc( {
					type: 'CallExpression',
					callee,
					arguments: args,
				}, startLocFromNode( callee ), endLocFromToken( previous() ) );
			}
			return withLoc( {
				type: 'NewExpression',
				callee,
			}, token, previous() );
		}
		if ( token.type === 'keyword' ) {
			index++;
			return withLoc( {
				type: 'Identifier',
				name: token.value,
			}, token, token );
		}
		if ( match( 'operator', '⌊' ) ) {
			const expr = parseExpression();
			expect( 'operator', '⌋', 'Expected closing floor operator' );
			return withLoc( {
				type: 'UnaryExpression',
				operator: 'floor',
				argument: expr,
				prefix: true,
			}, token, previous() );
		}
		if ( match( 'operator', '⌈' ) ) {
			const expr = parseExpression();
			expect( 'operator', '⌉', 'Expected closing ceil operator' );
			return withLoc( {
				type: 'UnaryExpression',
				operator: 'ceil',
				argument: expr,
				prefix: true,
			}, token, previous() );
		}
		if ( match( 'punctuation', '(' ) ) {
			const expr = parseExpression();
			expect( 'punctuation', ')', 'Expected ) after grouped expression' );
			return withLoc( {
				type: 'GroupedExpression',
				expression: expr,
			}, token, previous() );
		}
		if ( match( 'punctuation', '[' ) ) {
			const elements = [];
			if ( !match( 'punctuation', ']' ) ) {
				while ( true ) {
					if ( match( 'punctuation', ',' ) ) {
						continue;
					}
					if ( match( 'punctuation', ']' ) ) {
						break;
					}
					elements.push( parseExpression() );
					if ( match( 'punctuation', ']' ) ) {
						break;
					}
					match( 'punctuation', ',' );
				}
			}
			return withLoc( {
				type: 'ArrayExpression',
				elements,
			}, token, previous() );
		}
		if (
			match( 'operator', '{{' )
		) {
			const opener = previous();
			const entries = [];
			if ( !matchPairListClose() ) {
				while ( true ) {
					if ( match( 'punctuation', ',' ) ) {
						continue;
					}
					if ( matchPairListClose() ) {
						break;
					}
					const start = current();
					const keyExpr = parseExpression();
					if ( current().type === 'operator' && current().value === ':' ) {
						const normalized = normalizeNamedArgumentKey( keyExpr );
						expect( 'operator', ':', 'Expected : in pairlist literal' );
						const value = parseExpression();
						entries.push( withLoc( {
							type: 'PairListEntry',
							key: normalized.key,
							keyExpr: normalized.keyExpr,
							value,
						}, startLocFromNode( keyExpr ), endLocFromNode( value ) ) );
					}
					else {
						entries.push( keyExpr );
					}
					if ( matchPairListClose() ) {
						break;
					}
					match( 'punctuation', ',' );
				}
			}
			return withLoc( {
				type: 'PairListLiteral',
				entries,
			}, opener, previous() );
		}
		if (
			match( 'operator', '<<' )
			|| match( 'operator', '<<<' )
			|| match( 'operator', '«' )
		) {
			const opener = previous();
			const closer = opener.value === '<<<'
				? '>>>'
				: opener.value === '«'
					? '»'
					: '>>';
			const elements = parseDelimitedCollection( closer );
			return withLoc( {
				type: opener.value === '<<<' ? 'BagLiteral' : 'SetLiteral',
				elements,
			}, opener, previous() );
		}
		if ( match( 'punctuation', '{' ) ) {
			const properties = [];
			if ( !match( 'punctuation', '}' ) ) {
				while ( true ) {
					if ( match( 'punctuation', ',' ) ) {
						continue;
					}
					if ( match( 'punctuation', '}' ) ) {
						break;
					}
					let key;
					if ( current().type === 'identifier' || current().type === 'keyword' ) {
						key = current().value;
						index++;
					}
					else if ( current().type === 'string' ) {
						key = current().value;
						index++;
					}
					else {
						throw new TranspilerSyntaxError( 'Expected object literal key', current() );
					}
					expect( 'operator', ':', 'Expected : in object literal' );
					const value = parseExpression();
					properties.push( { key, value } );
					if ( match( 'punctuation', '}' ) ) {
						break;
					}
					match( 'punctuation', ',' );
				}
			}
			return withLoc( {
				type: 'ObjectExpression',
				properties,
			}, token, previous() );
		}
		throw new TranspilerSyntaxError( 'Unexpected token in expression', token );
	}

	function parseFnExpression( token, isAsync ) {
		index++;
		let params;
		if ( current().type === 'punctuation' && current().value === '(' ) {
			params = parseParameterList();
		}
		else {
			params = [ parseParameter() ];
		}
		if ( current().type === 'operator' && ( current().value === '->' || current().value === '→' ) ) {
			index++;
		}
		else {
			throw new TranspilerSyntaxError( 'Expected -> after fn parameters', current() );
		}
		const previousDepth = asyncContextDepth;
		asyncContextDepth = isAsync ? previousDepth + 1 : 0;
		let expr;
		try {
			expr = parseExpression();
		}
		finally {
			asyncContextDepth = previousDepth;
		}
		const returnStmt = withLoc( {
			type: 'ReturnStatement',
			argument: expr,
		}, token, token );
		const body = withLoc( {
			type: 'BlockStatement',
			body: [ returnStmt ],
		}, token, token );
		return withLoc( {
			type: 'FunctionExpression',
			params,
			isAsync,
			body,
		}, token, previous() || token );
	}

	function parseDelimitedCollection( closer ) {
		const elements = [];
		if ( match( 'operator', closer ) ) {
			return elements;
		}
		while ( true ) {
			if ( match( 'punctuation', ',' ) ) {
				continue;
			}
			if ( match( 'operator', closer ) ) {
				break;
			}
			elements.push( parseExpression() );
			if ( match( 'operator', closer ) ) {
				break;
			}
			match( 'punctuation', ',' );
		}
		return elements;
	}

	function parseTemplateExpression( source, token ) {
		try {
			return parse( tokenize( source ), { expression: true } );
		}
		catch ( err ) {
			if ( err instanceof TranspilerSyntaxError || err instanceof UnsupportedSyntaxError ) {
				throw new TranspilerSyntaxError( 'Invalid template interpolation', token );
			}
			throw err;
		}
	}

	if ( options.expression ) {
		return parseExpressionRoot();
	}
	return parseProgram();
}

module.exports = {
	parse,
};
