'use strict';

const { UnsupportedSyntaxError } = require( './errors' );

let loopCounter = 0;
let chainCounter = 0;
const emitContextStack = [];

function currentEmitContext() {
	return emitContextStack.length > 0
		? emitContextStack[emitContextStack.length - 1]
		: {};
}

function withEmitContext( options, fn ) {
	emitContextStack.push( options || {} );
	try {
		return fn();
	}
	finally {
		emitContextStack.pop();
	}
}

function emitProgram( ast, options = {} ) {
	loopCounter = 0;
	chainCounter = 0;
	const needsAsyncWrapper = programNeedsAsyncWrapper( ast );
	const syncEval = options.syncEval === true;
	const expressionDeclaredNames = collectExpressionDeclaredNames( ast.body );
	const sharedOptions = {
		...options,
		asyncContext: needsAsyncWrapper && !syncEval,
		asyncNames: new Set( collectAsyncFunctionNames( ast.body ) ),
		evalNames: new Set( [ 'eval', ...collectEvalImportNames( ast.body ) ] ),
		weakStorageNames: new Set( collectWeakDeclaredNames( ast.body ) ),
		scopeNames: new Set( [
			...expressionDeclaredNames,
		] ),
		bodylessFunctionNames: new Set(),
		syncEval,
		topLevel: !syncEval,
	};
	if ( syncEval ) {
		return `( () => {\n${emitExpressionBlock( { body: ast.body }, sharedOptions )}\n} )()`;
	}
	const body = ast.body.map( (stmt) => emitStatement( stmt, {
		...sharedOptions,
		topLevel: true,
	} ) ).join( '\n' );
	const prelude = emitPredeclaredNames( expressionDeclaredNames );
	const source = [ prelude, body ].filter( Boolean ).join( '\n' );
	if ( needsAsyncWrapper && !syncEval ) {
		return `( async () => {\n${source}\n} )()`;
	}
	return source;
}

function marshalSourceSlice( node, options = currentEmitContext() ) {
	if (
		!options.marshalSource
		|| !node.loc
		|| !node.loc.start
		|| !node.loc.end
	) {
		return null;
	}
	return options.marshalSource.slice( node.loc.start.offset, node.loc.end.offset );
}

function marshalFunctionSource( node, options = currentEmitContext() ) {
	const source = marshalSourceSlice( node, options );
	if (! source) {
		return null;
	}
	return source
		.replace( /^\s*async\s+function\s+[A-Za-z_][A-Za-z0-9_]*/u, 'async function' )
		.replace( /^\s*function\s+[A-Za-z_][A-Za-z0-9_]*/u, 'function' );
}

function marshalCaptureNames( node, options = currentEmitContext() ) {
	const names = new Set();
	const declared = new Set( [
		...( options.scopeNames || [] ),
		...extractDeclaredParamNames( node.params || [] ),
		node.id && node.id.name,
		'self',
		'true',
		'false',
		'null',
		'__argc__',
		'__file__',
		'__global__',
		'__system__',
		...( options.evalNames || [] ),
	].filter( Boolean ) );
	const localKinds = new Set( [
		'FunctionDeclaration',
		'VariableDeclaration',
		'ClassDeclaration',
		'TraitDeclaration',
	] );
	function visit( value, parent = null ) {
		if (! value || typeof value !== 'object') {
			return;
		}
		if ( Array.isArray( value ) ) {
			for ( const item of value ) {
				visit( item, parent );
			}
			return;
		}
		if ( value.type === 'Identifier' ) {
			if (
				parent
				&& (
					( parent.type === 'MemberExpression' && parent.property === value && !parent.computed )
					|| ( parent.type === 'FieldDeclaration' && parent.id === value )
					|| ( parent.type === 'MethodDeclaration' && parent.id === value )
				)
			) {
				return;
			}
			if (! declared.has( value.name )) {
				names.add( value.name );
			}
			return;
		}
		if ( value.type === 'TryStatement' ) {
			visit( value.block, value );
			for ( const handler of value.handlers || [] ) {
				const paramName = handler.paramName;
				const hadParam = paramName ? declared.has( paramName ) : false;
				if ( paramName ) {
					declared.add( paramName );
				}
				visit( handler.body, handler );
				if ( paramName && !hadParam ) {
					declared.delete( paramName );
				}
			}
			return;
		}
		if ( value.type === 'VariableUnpackDeclaration' ) {
			visit( value.init, value );
			for ( const entry of bindingEntriesForPattern( value.pattern ) ) {
				visit( entry.key, entry );
				visit( entry.defaultValue, entry );
			}
			for ( const name of declaredNamesForStatement( value ) ) {
				declared.add( name );
			}
			return;
		}
		if ( localKinds.has( value.type ) ) {
			for ( const name of declaredNamesForStatement( value ) ) {
				declared.add( name );
			}
		}
		for ( const [ key, child ] of Object.entries( value ) ) {
			if ( key === 'loc' ) {
				continue;
			}
			visit( child, value );
		}
	}
	visit( node.body || node );
	return [ ...names ].filter( (name) => /^[A-Za-z_][A-Za-z0-9_]*$/u.test( name ) );
}

function marshalMetaExpression( kind, name, source, captureNames = [] ) {
	return `{ kind: ${JSON.stringify( kind )}, name: ${JSON.stringify( name || null )}, source: ${JSON.stringify( source || '' )}, captures: ${marshalCapturesExpression( captureNames )} }`;
}

function marshalCapturesExpression( captureNames = [] ) {
	const captures = captureNames
		.map( (capture) => `${JSON.stringify( capture )}: typeof ${capture} !== "undefined" ? ${capture} : null` )
		.join( ', ' );
	return `{ ${captures} }`;
}

function marshalClassCaptureNames( node, options = currentEmitContext() ) {
	const names = new Set( marshalCaptureNames( node, options ) );
	for ( const trait of node.traits || [] ) {
		if ( trait && trait.type === 'Identifier' ) {
			names.add( trait.name );
		}
	}
	for ( const field of node.body.filter( (entry) => entry.type === 'FieldDeclaration' ) ) {
		names.delete( field.id.name );
	}
	for ( const entry of node.body ) {
		if ( entry.id && entry.id.name ) {
			names.delete( entry.id.name );
		}
		if ( entry.type === 'MethodDeclaration' ) {
			for ( const param of extractDeclaredParamNames( entry.params || [] ) ) {
				names.delete( param );
			}
		}
	}
	return [ ...names ];
}

function marshalTraitCaptureNames( node, options = currentEmitContext() ) {
	const names = new Set( marshalCaptureNames( node, options ) );
	for ( const method of node.body || [] ) {
		if ( method.id && method.id.name ) {
			names.delete( method.id.name );
		}
		for ( const param of extractDeclaredParamNames( method.params || [] ) ) {
			names.delete( param );
		}
	}
	return [ ...names ];
}

function nestedFunctionOptions( options = {} ) {
	return {
		marshalSource: options.marshalSource,
		syncEval: options.syncEval,
		asyncContext: options.asyncContext,
		asyncNames: options.asyncNames,
		evalNames: options.evalNames,
		weakStorageNames: options.weakStorageNames,
		scopeNames: options.scopeNames,
		bodylessFunctionNames: options.bodylessFunctionNames,
		chainHereName: options.chainHereName,
	};
}

function emitStatement( node, options = {} ) {
	return withEmitContext( options, () => {
		if ( node.exported ) {
			return emitExportedStatement( node, options );
		}
		switch ( node.type ) {
		case 'EmptyStatement':
			return ';';
		case 'ImportDeclaration':
			return emitImportDeclaration( node, options );
		case 'VariableDeclaration':
			{
				const value = emitVariableDeclarationValue( node );
				return `${node.kind} ${emitExpression( node.id )} = ${value};`;
			}
		case 'VariableUnpackDeclaration':
			return emitVariableUnpackDeclaration( node, options );
		case 'FunctionDeclaration':
			{
				const name = emitExpression( node.id );
				if ( node.isPredeclared ) {
					if ( options.bodylessFunctionNames ) {
						options.bodylessFunctionNames.add( node.id.name );
					}
					const declaration = `let ${name} = __zuzu_bodyless_function( ${JSON.stringify( node.id.name )} );`;
					return options.topLevel
						? `${declaration}\nglobalThis[${JSON.stringify( node.id.name )}] = ${name};`
						: declaration;
				}
				const fn = emitFunctionLike( node, `${node.isAsync ? 'async ' : ''}function ${name}()`, {
					...nestedFunctionOptions( options ),
					returnTypeName: node.returnType,
					callableName: node.id.name,
					asyncContext: node.isAsync === true,
					syncEval: options.syncEval === true,
				} );
				const meta = marshalMetaExpression(
					'function',
					node.id.name,
					marshalFunctionSource( node, options ),
					marshalCaptureNames( node, options )
				);
				if ( options.bodylessFunctionNames && options.bodylessFunctionNames.has( node.id.name ) ) {
					options.bodylessFunctionNames.delete( node.id.name );
					return `${name} = __zuzu_complete_function( ${name}, ${fn}, ${meta} );`;
				}
				const declaration = `const ${name} = __zuzu_with_marshal_meta( ${fn}, ${meta} );`;
				return options.topLevel
					? `${declaration}\nglobalThis[${JSON.stringify( node.id.name )}] = ${name};`
					: declaration;
			}
		case 'ReturnStatement':
			{
				if ( node.argument == null && !options.returnTypeName ) {
					return options.inSwitchSection
						? 'return { __zuzu_return: true, value: undefined };'
						: 'return;';
				}
				const value = node.argument
					? emitReturnValue( node.argument, options )
					: emitReturnValue( null, options );
			if ( options.inSwitchSection ) {
					return `return { __zuzu_return: true, value: ${value} };`;
				}
				return node.argument ? `return ${value};` : `return ${value};`;
			}
		case 'IfStatement':
			return [
				node.declaration ? emitStatement( node.declaration, options ) : '',
				`if ( __zuzu_truthy( ${emitExpression( node.test )} ) ) ${emitBlock( node.consequent, options )}`,
				node.alternate ? `else ${node.alternate.type === 'BlockStatement' ? emitBlock( node.alternate, options ) : emitStatement( node.alternate, options )}` : '',
			].filter( Boolean ).join( ' ' );
		case 'BlockStatement':
			return emitBlock( node, options );
		case 'ExpressionStatement':
			return `${emitExpression( node.expression )};`;
		case 'ForInStatement':
			return emitForInStatement( node, options );
		case 'WhileStatement':
			return [
				node.declaration ? emitStatement( node.declaration, options ) : '',
				`while ( __zuzu_truthy( ${emitExpression( node.test )} ) ) ${emitBlock( node.body, {
					...options,
					loopDepth: ( options.loopDepth || 0 ) + 1,
				} )}`,
			].filter( Boolean ).join( '\n' );
		case 'ContinueStatement':
			if ( options.inSwitchSection && ( options.loopDepth || 0 ) === 0 ) {
				return 'return true;';
			}
			return 'continue;';
		case 'BreakStatement':
			return 'break;';
		case 'ThrowStatement':
			return `__zuzu_throw( ${emitExpression( node.argument )}, ${JSON.stringify( node.loc.start.line )} );`;
		case 'DieStatement':
			return `__zuzu_die( ${emitExpression( node.argument )} );`;
		case 'WarnStatement':
			return `__zuzu_warn( ${emitExpression( node.argument )} );`;
		case 'AssertStatement':
			return `__zuzu_assert( () => ${emitExpression( node.argument )} );`;
		case 'DebugStatement':
			return emitDebugStatement( node );
		case 'TryStatement':
			return emitTryStatement( node, options );
		case 'SwitchStatement':
			return emitSwitchStatement( node, options );
		case 'ClassDeclaration':
			return emitClassDeclaration( node, options );
		case 'TraitDeclaration':
			return emitTraitDeclaration( node, options );
		default:
			throw new UnsupportedSyntaxError( `Unsupported statement node ${node.type}` );
		}
	} );
}

function emitExportedStatement( node, options = {} ) {
	if ( node.type === 'VariableUnpackDeclaration' ) {
		const unexported = {
			...node,
			exported: false,
		};
		return [
			emitStatement( unexported, options ),
			...declaredNamesForStatement( node )
				.map( (name) => `module.exports[${JSON.stringify( name )}] = ${name};` ),
		].join( '\n' );
	}
	if ( !node.id || !node.id.name ) {
		throw new UnsupportedSyntaxError( `Cannot export statement node ${node.type}` );
	}
	const unexported = {
		...node,
		exported: false,
	};
	const name = node.id.name;
	return [
		emitStatement( unexported, options ),
		`module.exports[${JSON.stringify( name )}] = ${name};`,
	].join( '\n' );
}

function emitDebugStatement( node ) {
	const args = node.arguments || [];
	const level = args[0] ? emitExpression( args[0] ) : '0';
	const message = args[1] ? emitExpression( args[1] ) : '""';
	return `__zuzu_debug( () => ${level}, () => ${message} );`;
}

function emitFunctionLike( node, header, options = {} ) {
	const signature = analyzeSpecialSignature( node.params );
	const functionOptions = createFunctionOptions( node, options );
	const cleanupNames = collectCleanupNames( node.body );
	const bodySource = withEmitContext(
		functionOptions,
		() => emitFunctionBlock( node.body, cleanupNames, functionOptions )
	);
	const cleanup = cleanupNames
		.map( (name) => `__zuzu_maybe_demolish( ${name} );` )
		.join( '\n' );
	const bodyWrapper = [
		'try {',
		bodySource,
		'} catch ( __zuzu_nonlocal ) {',
		'if ( __zuzu_nonlocal && __zuzu_nonlocal.__zuzu_nonlocal_return ) { return __zuzu_nonlocal.value; }',
		'throw __zuzu_nonlocal;',
		'}',
		cleanupNames.length > 0 ? 'finally {' : '',
		cleanupNames.length > 0 ? cleanup : '',
		cleanupNames.length > 0 ? '}' : '',
	].filter( Boolean ).join( '\n' );
	if ( node.isAsync === true ) {
		const taskName = options.callableName || ( node.id ? node.id.name : null ) || '<async>';
		const line = node.loc && node.loc.start ? node.loc.start.line : null;
		const syncHeader = header.replace( /^async\s+/u, '' );
		const taskHelper = options.syncEval ? '__zuzu_task_sync' : '__zuzu_task';
		const executorPrefix = options.syncEval ? '()' : 'async ()';
		return [
			`${syncHeader} {`,
			`return ${taskHelper}( ${executorPrefix} => {`,
			emitFunctionPreamble( node.params, signature ),
			options.extraPreamble || '',
			...cleanupNames.map( (name) => `let ${name} = null;` ),
			bodyWrapper,
			`}, { name: ${JSON.stringify( taskName )}, line: ${JSON.stringify( line )} } );`,
			'}',
		].filter( Boolean ).join( '\n' );
	}
	return [
		`${header} {`,
		emitFunctionPreamble( node.params, signature ),
		options.extraPreamble || '',
		...cleanupNames.map( (name) => `let ${name} = null;` ),
		bodyWrapper,
		'}',
	].filter( Boolean ).join( '\n' );
}

function emitFunctionBodyStatement( node, cleanupNames, options = {} ) {
	if (
		node.type === 'VariableDeclaration'
		&& node.id
		&& cleanupNames.includes( node.id.name )
	) {
		return `${emitExpression( node.id )} = ${emitVariableDeclarationValue( node )};`;
	}
	if (
		node.type === 'VariableUnpackDeclaration'
		&& bindingEntriesForPattern( node.pattern )
			.some( (entry) => cleanupNames.includes( entry.name ) )
	) {
		return emitVariableUnpackAssignments( node );
	}
	return emitStatement( node, options );
}

function emitFunctionBlock( block, cleanupNames, options = {} ) {
	if ( !block || !Array.isArray( block.body ) || block.body.length === 0 ) {
		return '';
	}
	return emitFunctionStatements( block.body, cleanupNames, options );
}

function emitFunctionStatements( statements, cleanupNames, options = {} ) {
	const lines = [];
	const lastIndex = statements.length - 1;
	for ( let i = 0; i < statements.length; i++ ) {
		const stmt = statements[i];
		if ( stmt.type === 'VariableUnpackDeclaration' ) {
			const unpack = emitVariableUnpackParts( stmt );
			const rest = emitFunctionStatements(
				statements.slice( i + 1 ),
				cleanupNames,
				{
					...options,
					scopeNames: new Set( [
						...( options.scopeNames || [] ),
						...declaredNamesForStatement( stmt ),
					] ),
				}
			);
			lines.push( ...unpack.prelude );
			lines.push( '{' );
			lines.push( ...unpack.declarations );
			lines.push( emitUnpackScopedRest( stmt, rest ) );
			lines.push( '}' );
			return lines.filter( (line) => line !== '' ).join( '\n' );
		}
		if ( i === lastIndex ) {
			lines.push( emitFunctionTailStatement( stmt, cleanupNames, options ) );
		}
		else {
			lines.push( emitFunctionBodyStatement( stmt, cleanupNames, options ) );
		}
	}
	return lines.join( '\n' );
}

function emitFunctionTailStatement( stmt, cleanupNames, options = {} ) {
	if ( stmt.type === 'ExpressionStatement' ) {
		return `return ${emitExpression( stmt.expression )};`;
	}
	if ( stmt.type === 'BlockStatement' ) {
		return emitBlock( stmt, options );
	}
	if ( stmt.type === 'IfStatement' ) {
		const prefix = stmt.declaration ? `${emitStatement( stmt.declaration, options )}\n` : '';
		const alternate = stmt.alternate
			? emitFunctionTailStatement( stmt.alternate, cleanupNames, options )
			: 'return null;';
		return `${prefix}if ( __zuzu_truthy( ${emitExpression( stmt.test, options )} ) ) { ${emitFunctionBlock( stmt.consequent, cleanupNames, options )} } else { ${alternate} }`;
	}
	return emitFunctionBodyStatement( stmt, cleanupNames, options );
}

function collectCleanupNames( block ) {
	const names = [];
	for ( const stmt of block.body ) {
		if (
			[ 'VariableDeclaration', 'ClassDeclaration', 'TraitDeclaration' ].includes( stmt.type )
		) {
			for ( const name of declaredNamesForStatement( stmt ) ) {
				if ( name !== 'self' ) {
					names.push( name );
				}
			}
		}
	}
	names.push( ...collectExpressionDeclaredNames( block.body ) );
	return [ ...new Set( names ) ];
}

function collectWeakDeclaredNames( statements = [] ) {
	const names = [];
	for ( const stmt of statements || [] ) {
		if (
			stmt.type === 'VariableDeclaration'
			&& stmt.isWeakStorage
			&& stmt.id
			&& stmt.id.name
		) {
			names.push( stmt.id.name );
		}
		else if ( stmt.type === 'VariableUnpackDeclaration' ) {
			for ( const entry of bindingEntriesForPattern( stmt.pattern ) ) {
				if ( entry.isWeakStorage && entry.name ) {
					names.push( entry.name );
				}
			}
		}
	}
	names.push( ...collectExpressionDeclaredEntries( statements )
		.filter( (entry) => entry.isWeakStorage )
		.map( (entry) => entry.name ) );
	return [ ...new Set( names ) ];
}

function createFunctionOptions( node, options = {} ) {
	const signature = analyzeSpecialSignature( node.params );
	const paramNames = extractDeclaredParamNames( node.params );
	const body = node.body ? node.body.body : [];
	const expressionDeclaredNames = collectExpressionDeclaredNames( body );
	const hereParamName = ( node.params || [] ).some( (param) => param.type === 'Parameter' && param.name === '^^' )
		? '__zuzu_here'
		: null;
	return {
		...options,
		returnTypeName: options.returnTypeName || node.returnType || null,
		callableName: options.callableName || ( node.id ? node.id.name : null ),
		asyncContext: node.isAsync === true || options.asyncContext === true,
		asyncNames: new Set( [ ...( options.asyncNames || [] ), ...collectAsyncFunctionNames( body ) ] ),
		weakStorageNames: new Set( [
			...( options.weakStorageNames || [] ),
			...collectWeakDeclaredNames( body ),
		] ),
		scopeNames: new Set( [
			...( options.scopeNames || [] ),
			...paramNames,
			...( hereParamName ? [ hereParamName ] : [] ),
			...extractSpecialPreludeNames( signature ),
			...expressionDeclaredNames,
		] ),
		bodylessFunctionNames: new Set(),
		chainHereName: hereParamName || options.chainHereName,
	};
}

function extractDeclaredParamNames( params ) {
	const names = [];
	for ( const param of params ) {
		if ( param.type === 'Parameter' ) {
			names.push( param.name );
		}
		else if ( param.type === 'SpecialParameter' ) {
			if ( param.leadName ) {
				names.push( param.leadName );
			}
			names.push( param.name );
		}
	}
	return names;
}

function extractSpecialPreludeNames( signature ) {
	if ( !signature ) {
		return [];
	}
	switch ( signature.kind ) {
		case 'pairlist_only':
			return [ '__zuzu_call_args', signature.namedName ];
		case 'pairlist_rest_array':
		case 'rest_array_pairlist':
			return [ '__zuzu_call_args', signature.namedName, signature.restName, '__a' ];
		case 'lead_pairlist':
			return [ '__zuzu_call_args', signature.headName, signature.namedName, signature.restName, '__i', '__a' ];
		case 'trail_pairlist':
			return [ '__zuzu_call_args', signature.headName, signature.restName, signature.namedName, '__i', '__a' ];
		case 'scalar_pairlist':
			return [ '__zuzu_call_args', signature.headName, signature.namedName, '__i', '__a' ];
		case 'variadic':
			return [ '__zuzu_call_args', signature.headName, signature.restName, '__i', '__a' ];
		default:
			return [];
	}
}

function analyzeSpecialSignature( params ) {
	if ( params.length === 1 && params[0].type === 'SpecialParameter' && params[0].special === 'rest_only' && params[0].containerType === 'PairList' ) {
		return {
			kind: 'pairlist_only',
			namedName: params[0].name,
		};
	}
	if (
		params.length === 2
		&& params[0].type === 'SpecialParameter'
		&& params[0].special === 'rest_only'
		&& params[0].containerType === 'Array'
		&& params[1].type === 'Parameter'
		&& params[1].typeName === 'PairList'
	) {
		return {
			kind: 'rest_array_pairlist',
			restName: params[0].name,
			namedName: params[1].name,
		};
	}
	if (
		params.length === 2
		&& params[0].type === 'SpecialParameter'
		&& params[0].special === 'rest_only'
		&& params[0].containerType === 'PairList'
		&& params[1].type === 'Parameter'
		&& ( params[1].typeName === 'Array' || params[1].typeName == null )
	) {
		return {
			kind: 'pairlist_rest_array',
			namedName: params[0].name,
			restName: params[1].name,
		};
	}
	if (
		params.length === 2
		&& params[0].type === 'SpecialParameter'
		&& params[0].special === 'lead_rest'
		&& params[0].containerType === 'PairList'
		&& params[1].type === 'Parameter'
		&& ( params[1].typeName === 'Array' || params[1].typeName == null )
	) {
		return {
			kind: 'lead_pairlist',
			headName: params[0].leadName,
			namedName: params[0].name,
			restName: params[1].name,
		};
	}
	if (
		params.length === 2
		&& params[0].type === 'SpecialParameter'
		&& params[0].special === 'lead_rest'
		&& params[0].containerType === 'Array'
		&& params[1].type === 'Parameter'
		&& params[1].typeName === 'PairList'
	) {
		return {
			kind: 'trail_pairlist',
			headName: params[0].leadName,
			restName: params[0].name,
			namedName: params[1].name,
		};
	}
	if (
		params.length === 2
		&& params[0].type === 'Parameter'
		&& params[1].type === 'SpecialParameter'
		&& params[1].special === 'rest_only'
		&& params[1].containerType === 'PairList'
	) {
		return {
			kind: 'scalar_pairlist',
			headName: params[0].name,
			namedName: params[1].name,
		};
	}
	if (
		params.length === 1
		&& params[0].type === 'SpecialParameter'
		&& params[0].special === 'lead_rest'
		&& params[0].containerType === 'Array'
	) {
		return {
			kind: 'variadic',
			headName: params[0].leadName,
			restName: params[0].name,
		};
	}
	return null;
}

function emitFunctionPreamble( params, signature = null ) {
	if ( signature ) {
		return emitSpecialFunctionPreamble( signature );
	}
	const lines = [];
	const required = params.reduce( (count, param) => {
		if ( param.type === 'Parameter' ) {
			return count + ( !param.optional && param.defaultValue == null && !param.rest ? 1 : 0 );
		}
		if ( param.type === 'SpecialParameter' && param.special === 'lead_rest' ) {
			return count + 1;
		}
		return count;
	}, 0 );
	lines.push( 'const __argc__ = arguments.length;' );
	lines.push( `if ( arguments.length < ${required} ) { throw new Error( "Wrong number of arguments" ); }` );
	let argIndex = 0;
	for ( const param of params ) {
		if ( param.type === 'SpecialParameter' ) {
			if ( param.special === 'lead_rest' ) {
				lines.push( `const ${param.leadName} = arguments[${argIndex}];` );
				argIndex++;
				lines.push( `const ${param.name} = Array.prototype.slice.call( arguments, ${argIndex} );` );
				continue;
			}
			if ( param.special === 'rest_only' ) {
				if ( param.containerType === 'PairList' ) {
					lines.push( `let ${param.name} = __zuzu_pairlist_literal( [] );` );
					lines.push( `for ( let __i = ${argIndex}; __i < arguments.length; __i++ ) {` );
					lines.push( 'const __a = arguments[__i];' );
					lines.push( `if ( __zuzu_is_pairlist( __a ) ) { ${param.name} = __a; } else { throw new Exception( "named PairList parameter only accepts named arguments" ); }` );
					lines.push( '}' );
				}
				else {
					lines.push( `const ${param.name} = Array.prototype.slice.call( arguments, ${argIndex} );` );
				}
				continue;
			}
		}
		if ( param.type !== 'Parameter' ) {
			continue;
		}
		const paramName = param.name === '^^' ? '__zuzu_here' : param.name;
		if ( param.rest ) {
			lines.push( `const ${paramName} = Array.prototype.slice.call( arguments, ${argIndex} );` );
			continue;
		}
		if ( param.defaultValue ) {
			lines.push( `const ${paramName} = __argc__ > ${argIndex} ? arguments[${argIndex}] : ${emitExpression( param.defaultValue )};` );
		}
		else if ( param.optional ) {
			lines.push( `const ${paramName} = __argc__ > ${argIndex} ? arguments[${argIndex}] : null;` );
		}
		else {
			lines.push( `const ${paramName} = arguments[${argIndex}];` );
		}
		if ( param.typeName ) {
			lines.push(
				`if ( ${paramName} != null && !__zuzu_type_matches( ${paramName}, ${JSON.stringify( param.typeName )} ) ) { throw new Error( \`TypeException: '${param.name}' must be ${param.typeName}, got \${ __zuzu_typeof( ${paramName} ) }\` ); }`
			);
		}
		argIndex++;
	}
	return lines.join( '\n' );
}

function emitSpecialFunctionPreamble( signature ) {
	switch ( signature.kind ) {
		case 'pairlist_only':
			return [
				`const __zuzu_call_args = Array.prototype.slice.call( arguments );`,
				'let __zuzu_named_args = __zuzu_pairlist_literal( [] );',
				'for ( const __a of __zuzu_call_args ) {',
				'if ( __zuzu_is_pairlist( __a ) ) { __zuzu_named_args = __a; } else { throw new Exception( "named PairList parameter only accepts named arguments" ); }',
				'}',
				`const ${signature.namedName} = __zuzu_named_args;`,
			].join( '\n' );
		case 'pairlist_rest_array':
		case 'rest_array_pairlist':
			return [
				`const __zuzu_call_args = Array.prototype.slice.call( arguments );`,
				'let __zuzu_named_args = __zuzu_pairlist_literal( [] );',
				'const __zuzu_rest_args = [];',
				'for ( const __a of __zuzu_call_args ) {',
				'if ( __zuzu_is_pairlist( __a ) ) { __zuzu_named_args = __a; } else { __zuzu_rest_args.push( __a ); }',
				'}',
				`const ${signature.namedName} = __zuzu_named_args;`,
				`const ${signature.restName} = __zuzu_rest_args;`,
			].join( '\n' );
		case 'lead_pairlist':
			return [
				'const __zuzu_call_args = Array.prototype.slice.call( arguments );',
				`const ${signature.headName} = __zuzu_call_args[0];`,
				'let __zuzu_named_args = __zuzu_pairlist_literal( [] );',
				'const __zuzu_rest_args = [];',
				'for ( let __i = 1; __i < __zuzu_call_args.length; __i++ ) {',
				'const __a = __zuzu_call_args[__i];',
				'if ( __zuzu_is_pairlist( __a ) ) { __zuzu_named_args = __a; } else { __zuzu_rest_args.push( __a ); }',
				'}',
				`const ${signature.namedName} = __zuzu_named_args;`,
				`const ${signature.restName} = __zuzu_rest_args;`,
			].join( '\n' );
		case 'trail_pairlist':
			return [
				'const __zuzu_call_args = Array.prototype.slice.call( arguments );',
				`const ${signature.headName} = __zuzu_call_args[0];`,
				'const __zuzu_rest_args = [];',
				'let __zuzu_named_args = __zuzu_pairlist_literal( [] );',
				'for ( let __i = 1; __i < __zuzu_call_args.length; __i++ ) {',
				'const __a = __zuzu_call_args[__i];',
				'if ( __zuzu_is_pairlist( __a ) ) { __zuzu_named_args = __a; } else { __zuzu_rest_args.push( __a ); }',
				'}',
				`const ${signature.restName} = __zuzu_rest_args;`,
				`const ${signature.namedName} = __zuzu_named_args;`,
			].join( '\n' );
		case 'scalar_pairlist':
			return [
				'const __zuzu_call_args = Array.prototype.slice.call( arguments );',
				`const ${signature.headName} = __zuzu_call_args[0];`,
				'let __zuzu_named_args = __zuzu_pairlist_literal( [] );',
				'for ( let __i = 1; __i < __zuzu_call_args.length; __i++ ) {',
				'const __a = __zuzu_call_args[__i];',
				'if ( __zuzu_is_pairlist( __a ) ) { __zuzu_named_args = __a; } else { throw new Exception( "named arguments not allowed for this function" ); }',
				'}',
				`const ${signature.namedName} = __zuzu_named_args;`,
			].join( '\n' );
		case 'variadic':
			return [
				'const __zuzu_call_args = Array.prototype.slice.call( arguments );',
				`const ${signature.headName} = __zuzu_call_args[0];`,
				'const __zuzu_rest_args = [];',
				'for ( let __i = 1; __i < __zuzu_call_args.length; __i++ ) {',
				'const __a = __zuzu_call_args[__i];',
				'if ( __zuzu_is_pairlist( __a ) ) { throw new Exception( "named arguments not allowed for this function" ); } __zuzu_rest_args.push( __a );',
				'}',
				`const ${signature.restName} = __zuzu_rest_args;`,
			].join( '\n' );
		default:
			return '';
	}
}

function emitReturnValue( argument, options = {} ) {
	let value;
	if ( argument == null ) {
		value = 'undefined';
	}
	else {
		value = emitExpression( argument );
	}
	if ( options.returnTypeName && options.returnTypeName !== 'Any' ) {
		return `__zuzu_checked_return( ${JSON.stringify( options.callableName || '' )}, ${JSON.stringify( options.returnTypeName )}, ${value} )`;
	}
	return value;
}

function emitForInStatement( node, options = {} ) {
	const loopId = loopCounter++;
	const implicitHere = node.left.name === '^^';
	const loopName = implicitHere ? `__zuzu_loop_here_${loopId}` : node.left.name;
	const iterName = `__zuzu_iterated_${implicitHere ? 'here' : node.left.name}_${loopId}`;
	const elsePart = node.elseBlock
		? `if ( !${iterName} ) ${emitBlock( node.elseBlock, options )}`
		: '';
	const loopKeyword = node.kind ? `${node.kind} ` : '';
	const bodyOptions = implicitHere
		? {
			...options,
			chainHereName: loopName,
		}
		: options;
	return [
		`let ${iterName} = 0;`,
		`for ( ${loopKeyword}${loopName} of __zuzu_iter( ${emitExpression( node.iterable )} ) ) {`,
		`${iterName} = 1;`,
		node.body.body.map( (stmt) => emitStatement( stmt, {
			...bodyOptions,
			loopDepth: ( options.loopDepth || 0 ) + 1,
		} ) ).join( '\n' ),
		'}',
		elsePart,
	].filter( Boolean ).join( '\n' );
}

function emitTryStatement( node, options = {} ) {
	const handlers = node.handlers || [];
	let catchBody = 'throw __zuzu_err;';
	if ( handlers.length > 0 ) {
		const branches = handlers.map( (handler, index ) => {
			const cond = handler.typeName === 'Exception' || handler.typeName === 'Any'
				? 'true'
				: `__zuzu_instanceof( __zuzu_err, ${handler.typeName} )`;
			const prefix = index === 0 ? `if ( ${cond} )` : `else if ( ${cond} )`;
			return `${prefix} { let ${handler.paramName} = __zuzu_err; ${handler.body.body.map( (stmt) => emitStatement( stmt, options ) ).join( '\n' )} }`;
		} );
		catchBody = `if ( __zuzu_err && __zuzu_err.__zuzu_nonlocal_return ) { throw __zuzu_err; } __zuzu_err = __zuzu_normalize_exception( __zuzu_err ); ${branches.join( ' ' )} else { throw __zuzu_err; }`;
	}
	return `try ${emitBlock( node.block, options )} catch ( __zuzu_err ) { ${catchBody} }`;
}

function emitImportDeclaration( node, options = {} ) {
	if ( node.importAll ) {
		if ( options.syncEval ) {
			return `{ const __zuzu_star = __zuzu_import( ${JSON.stringify( node.source )} ); }`;
		}
		if ( node.source === 'std/eval' ) {
			return `{ const __zuzu_star = __zuzu_import( ${JSON.stringify( node.source )} ); for ( const __zuzu_key of Object.keys( __zuzu_star ) ) { if ( __zuzu_key === "eval" ) { continue; } const __zuzu_desc = Object.create( null ); __zuzu_desc.configurable = true; __zuzu_desc.enumerable = true; __zuzu_desc.get = function() { return __zuzu_star[ __zuzu_key ] ?? null; }; __zuzu_desc.set = function( value ) { __zuzu_star[ __zuzu_key ] = value; }; Object.defineProperty( globalThis, __zuzu_key, __zuzu_desc ); } }`;
		}
		return `{ const __zuzu_star = __zuzu_import( ${JSON.stringify( node.source )} ); if ( Object.prototype.hasOwnProperty.call( __zuzu_star, "done_testing" ) ) { var done_testing = __zuzu_star.done_testing ?? null; } for ( const __zuzu_key of Object.keys( __zuzu_star ) ) { if ( __zuzu_key === "done_testing" ) { continue; } const __zuzu_desc = Object.create( null ); __zuzu_desc.configurable = true; __zuzu_desc.enumerable = true; __zuzu_desc.get = function() { return __zuzu_star[ __zuzu_key ] ?? null; }; __zuzu_desc.set = function( value ) { __zuzu_star[ __zuzu_key ] = value; }; Object.defineProperty( globalThis, __zuzu_key, __zuzu_desc ); } }`;
	}
	const moduleName = `__zuzu_imported_${Math.abs( hashString( node.source ) )}_${node.specifiers.length}_${options.syncEval ? loopCounter++ : 0}`;
	const defineImports = node.specifiers.map( (specifier) => {
		const importedName = normalizeImportedName( node.source, specifier.imported );
		if (
			node.source === 'std/eval'
			&& importedName === 'eval'
		) {
			return '';
		}
		return defineLiveImport( specifier.local, moduleName, importedName, options );
	} ).filter( Boolean );
	const legacyImports = node.specifiers.map( (specifier) => {
		const importedName = normalizeImportedName( node.source, specifier.imported );
		const mapped = importedName === specifier.local
			? importedName
			: `${importedName}: ${specifier.local}`;
		return node.tryMode
			? `${mapped} = null`
			: mapped;
	} );
	const legacyShape = `/* const { ${legacyImports.join( ', ' )} } = __zuzu_import( ${JSON.stringify( node.source )} ); */`;
	const importCondition = node.condition
		? node.condition.keyword === 'unless'
			? `!__zuzu_truthy( ${emitExpression( node.condition.test )} )`
			: `__zuzu_truthy( ${emitExpression( node.condition.test )} )`
		: null;
	const disabledImports = `{ ${node.specifiers.map( (specifier) => {
		const importedName = normalizeImportedName( node.source, specifier.imported );
		return `${importedName}: null`;
	} ).join( ', ' )} }`;
	if ( options.syncEval ) {
		if ( node.tryMode ) {
			return [
				`const ${moduleName} = ( () => {`,
				'try {',
				importCondition ? `if ( !( ${importCondition} ) ) { return {}; }` : '',
				`return __zuzu_import( ${JSON.stringify( node.source )} );`,
				'}',
				'catch ( __zuzu_err ) {',
				'if ( __zuzu_err && __zuzu_err.__zuzu_nonlocal_return ) { throw __zuzu_err; }',
				'return {};',
				'}',
				'} )();',
				...defineImports,
			].filter( Boolean ).join( ' ' );
		}
		if ( importCondition ) {
			return [
				`const ${moduleName} = ( () => {`,
				`if ( !( ${importCondition} ) ) { return ${disabledImports}; }`,
				`return __zuzu_import( ${JSON.stringify( node.source )} );`,
				'} )();',
				...defineImports,
			].join( ' ' );
		}
		return `const ${moduleName} = __zuzu_import( ${JSON.stringify( node.source )} ); ${defineImports.join( ' ' )}`;
	}
	if ( node.tryMode ) {
		return [
			`{ ${legacyShape} const ${moduleName} = ( () => {`,
			'try {',
			importCondition ? `if ( !( ${importCondition} ) ) { return {}; }` : '',
			`return __zuzu_import( ${JSON.stringify( node.source )} );`,
			'}',
			'catch ( __zuzu_err ) {',
			'if ( __zuzu_err && __zuzu_err.__zuzu_nonlocal_return ) { throw __zuzu_err; }',
			'return {};',
			'}',
			'} )();',
			...defineImports,
			'}',
		].filter( Boolean ).join( ' ' );
	}
	if ( importCondition ) {
		return [
			`{ ${legacyShape} const ${moduleName} = ( () => {`,
			`if ( !( ${importCondition} ) ) { return ${disabledImports}; }`,
			`return __zuzu_import( ${JSON.stringify( node.source )} );`,
			'} )();',
			...defineImports,
			'}',
		].join( ' ' );
	}
	return `{ ${legacyShape} const ${moduleName} = __zuzu_import( ${JSON.stringify( node.source )} ); ${defineImports.join( ' ' )} }`;
}

function normalizeImportedName( source, imported ) {
	return source === 'std/math' && imported === 'pi' ? 'π' : imported;
}

function hashString( value ) {
	let hash = 0;
	for ( let i = 0; i < value.length; i++ ) {
		hash = ( ( hash << 5 ) - hash ) + value.charCodeAt( i );
		hash |= 0;
	}
	return hash;
}

function defineLiveImport( localName, moduleName, importedName, options = {} ) {
	if ( options.syncEval ) {
		return `const ${localName} = ${moduleName}[${JSON.stringify( importedName )}] ?? null;`;
	}
	if ( localName === 'done_testing' ) {
		return `var done_testing = ${moduleName}[${JSON.stringify( importedName )}] ?? null;`;
	}
	return [
		'{',
		'const __zuzu_desc = Object.create( null );',
		'__zuzu_desc.configurable = true;',
		'__zuzu_desc.enumerable = true;',
		`__zuzu_desc.get = function() { return ${moduleName}[${JSON.stringify( importedName )}] ?? null; };`,
		`__zuzu_desc.set = function( value ) { ${moduleName}[${JSON.stringify( importedName )}] = value; };`,
		'Object.defineProperty( globalThis,',
		`${JSON.stringify( localName )},`,
		'__zuzu_desc );',
		'}',
	].join( ' ' );
}

function emitBlock( node, options = {} ) {
	const expressionDeclaredNames = collectExpressionDeclaredNames( node.body );
	const scopedOptions = {
		...options,
		asyncNames: new Set( [ ...( options.asyncNames || [] ), ...collectAsyncFunctionNames( node.body ) ] ),
		weakStorageNames: new Set( [
			...( options.weakStorageNames || [] ),
			...collectWeakDeclaredNames( node.body ),
		] ),
		bodylessFunctionNames: new Set(),
		scopeNames: new Set( [
			...( options.scopeNames || [] ),
			...collectDeclaredNames( node.body ),
			...expressionDeclaredNames,
		] ),
	};
	const cleanupNames = collectCleanupNames( node );
	const body = emitBlockBodyStatements( node.body, cleanupNames, scopedOptions );
	if ( cleanupNames.length === 0 ) {
		return `{\n${body}\n}`;
	}
	const cleanup = cleanupNames
		.map( (name) => `__zuzu_maybe_demolish( ${name} );` )
		.join( '\n' );
	return `{\n${cleanupNames.map( (name) => `let ${name} = null;` ).join( '\n' )}\ntry {\n${body}\n} finally {\n${cleanup}\n}\n}`;
}

function emitBlockBodyStatements( statements, cleanupNames, options = {} ) {
	const lines = [];
	for ( let i = 0; i < statements.length; i++ ) {
		const stmt = statements[i];
		if ( stmt.type === 'VariableUnpackDeclaration' ) {
			const unpack = emitVariableUnpackParts( stmt );
			const rest = emitBlockBodyStatements(
				statements.slice( i + 1 ),
				cleanupNames,
				{
					...options,
					scopeNames: new Set( [
						...( options.scopeNames || [] ),
						...declaredNamesForStatement( stmt ),
					] ),
				}
			);
			lines.push( ...unpack.prelude );
			lines.push( '{' );
			lines.push( ...unpack.declarations );
			lines.push( emitUnpackScopedRest( stmt, rest ) );
			lines.push( '}' );
			return lines.filter( (line) => line !== '' ).join( '\n' );
		}
		lines.push( emitBlockStatement( stmt, cleanupNames, options ) );
	}
	return lines.join( '\n' );
}

function emitUnpackScopedRest( stmt, rest ) {
	const cleanupNames = declaredNamesForStatement( stmt )
		.filter( (name) => name !== 'self' );
	if ( cleanupNames.length === 0 ) {
		return rest;
	}
	const cleanup = cleanupNames
		.map( (name) => `__zuzu_maybe_demolish( ${name} );` )
		.join( '\n' );
	return `try {\n${rest}\n} finally {\n${cleanup}\n}`;
}

function collectAsyncFunctionNames( statements = [] ) {
	const names = [];
	for ( const stmt of statements ) {
		if ( stmt.type === 'FunctionDeclaration' && stmt.isAsync && stmt.id && stmt.id.name ) {
			names.push( stmt.id.name );
		}
		else if (
			stmt.type === 'VariableDeclaration'
			&& stmt.init
			&& stmt.init.type === 'FunctionExpression'
			&& stmt.init.isAsync
			&& stmt.id
			&& stmt.id.name
		) {
			names.push( stmt.id.name );
		}
	}
	return names;
}

function collectEvalImportNames( statements = [] ) {
	const names = [];
	for ( const stmt of statements ) {
		if ( stmt.type !== 'ImportDeclaration' || stmt.source !== 'std/eval' ) {
			continue;
		}
		for ( const specifier of stmt.specifiers || [] ) {
			const importedName = normalizeImportedName( stmt.source, specifier.imported );
			if ( importedName === 'eval' && specifier.local ) {
				names.push( specifier.local );
			}
		}
	}
	return names;
}

function collectDeclaredNames( statements ) {
	const names = [];
	for ( const stmt of statements || [] ) {
		names.push( ...declaredNamesForStatement( stmt ) );
	}
	return names;
}

function declaredNamesForStatement( stmt ) {
	if ( !stmt ) {
		return [];
	}
	if (
		[ 'VariableDeclaration', 'FunctionDeclaration', 'ClassDeclaration', 'TraitDeclaration' ].includes( stmt.type )
		&& stmt.id
		&& stmt.id.name
	) {
		return [ stmt.id.name ];
	}
	if ( stmt.type === 'VariableUnpackDeclaration' ) {
		return bindingEntriesForPattern( stmt.pattern )
			.map( (entry) => entry.name )
			.filter( Boolean );
	}
	return [];
}

function emitPredeclaredNames( names ) {
	const unique = [ ...new Set( names || [] ) ].filter( Boolean );
	return unique.length > 0
		? `let ${unique.map( (name) => `${name} = null` ).join( ', ' )};`
		: '';
}

function collectExpressionDeclaredNames( statements = [] ) {
	return collectExpressionDeclaredEntries( statements )
		.map( (entry) => entry.name )
		.filter( Boolean );
}

function collectExpressionDeclaredEntries( statements = [] ) {
	const entries = [];
	for ( const stmt of statements || [] ) {
		collectExpressionDeclaredEntriesFromNode( stmt, entries );
	}
	return entries;
}

function collectExpressionDeclaredEntriesFromNode( node, entries ) {
	if ( !node || typeof node !== 'object' ) {
		return;
	}
	if ( Array.isArray( node ) ) {
		for ( const item of node ) {
			collectExpressionDeclaredEntriesFromNode( item, entries );
		}
		return;
	}
	if ( node.type === 'LetExpression' ) {
		if ( node.id && node.id.name ) {
			entries.push( {
				name: node.id.name,
				isWeakStorage: node.isWeakStorage === true,
			} );
		}
		collectExpressionDeclaredEntriesFromNode( node.init, entries );
		return;
	}
	if (
		[
			'BlockStatement',
			'ClassDeclaration',
			'DoExpression',
			'FunctionDeclaration',
			'FunctionExpression',
			'MethodDeclaration',
			'TraitDeclaration',
			'TryExpression',
			'AwaitExpression',
			'SpawnExpression',
		].includes( node.type )
	) {
		return;
	}
	for ( const [ key, value ] of Object.entries( node ) ) {
		if ( key === 'loc' ) {
			continue;
		}
		collectExpressionDeclaredEntriesFromNode( value, entries );
	}
}

function bindingEntriesForPattern( pattern ) {
	return pattern && Array.isArray( pattern.entries ) ? pattern.entries : [];
}

function scopeHasName( options, name ) {
	return !!( options.scopeNames && options.scopeNames.has( name ) );
}

function emitStoredValue( value, isWeakStorage ) {
	return isWeakStorage
		? `__zuzu_make_weak_value( ${value} )`
		: `__zuzu_retain_value( ${value} )`;
}

function expressionRetainsCollectionValues( node ) {
	return [
		'ArrayExpression',
		'BagLiteral',
		'ObjectExpression',
		'PairListLiteral',
		'SetLiteral',
	].includes( node.type );
}

function emitVariableDeclarationValue( node ) {
	let value = node.init ? emitExpression( node.init ) : 'null';
	if ( node.init && node.declaredType && node.declaredType !== 'Any' ) {
		value = `__zuzu_checked_declaration( ${JSON.stringify( node.id.name )}, ${JSON.stringify( node.declaredType )}, ${value} )`;
	}
	return emitStoredValue( value, node.isWeakStorage );
}

function emitLetExpression( node ) {
	const name = emitExpression( node.id );
	const value = emitVariableDeclarationValue( node );
	return `( ${name} = ${value}, __zuzu_resolve_weak_value( ${name} ) )`;
}

function emitVariableUnpackDeclaration( node ) {
	const parts = emitVariableUnpackParts( node );
	return [ ...parts.prelude, ...parts.declarations ].join( '\n' );
}

function emitVariableUnpackParts( node ) {
	const sourceName = `__zuzu_unpack_source_${loopCounter++}`;
	const entries = bindingEntriesForPattern( node.pattern );
	const prelude = [
		`const ${sourceName} = __zuzu_unpack_source( ${emitExpression( node.init )} );`,
	];
	const valueNames = entries.map( () => `__zuzu_unpack_value_${loopCounter++}` );
	for ( let i = 0; i < entries.length; i++ ) {
		prelude.push(
			`const ${valueNames[i]} = ${emitUnpackEntryValue( sourceName, entries[i] )};`
		);
	}
	if ( node.init && expressionRetainsCollectionValues( node.init ) ) {
		prelude.push( `__zuzu_release_collection_values( ${sourceName} );` );
	}
	const declarations = [];
	for ( let i = 0; i < entries.length; i++ ) {
		const entry = entries[i];
		declarations.push(
			`${node.kind} ${entry.name} = ${valueNames[i]};`
		);
	}
	return { prelude, declarations, entries, valueNames };
}

function emitVariableUnpackAssignments( node ) {
	const sourceName = `__zuzu_unpack_source_${loopCounter++}`;
	const lines = [
		`const ${sourceName} = __zuzu_unpack_source( ${emitExpression( node.init )} );`,
	];
	const entries = bindingEntriesForPattern( node.pattern );
	const valueNames = entries.map( () => `__zuzu_unpack_value_${loopCounter++}` );
	for ( let i = 0; i < entries.length; i++ ) {
		lines.push(
			`const ${valueNames[i]} = ${emitUnpackEntryValue( sourceName, entries[i] )};`
		);
	}
	if ( node.init && expressionRetainsCollectionValues( node.init ) ) {
		lines.push( `__zuzu_release_collection_values( ${sourceName} );` );
	}
	for ( let i = 0; i < entries.length; i++ ) {
		lines.push( `${entries[i].name} = ${valueNames[i]};` );
	}
	return lines.join( '\n' );
}

function emitUnpackEntryValue( sourceName, entry ) {
	const defaultThunk = entry.defaultValue
		? `() => ${emitExpression( entry.defaultValue )}`
		: 'null';
	return `__zuzu_unpack_value( ${sourceName}, ${emitExpression( entry.key )}, ${defaultThunk}, ${JSON.stringify( entry.name )}, ${entry.declaredType ? JSON.stringify( entry.declaredType ) : 'null'}, ${entry.isWeakStorage ? 'true' : 'false'} )`;
}

function emitBlockStatement( node, cleanupNames, options = {} ) {
	if (
		node.type === 'VariableDeclaration'
		&& node.id
		&& cleanupNames.includes( node.id.name )
	) {
		return `${emitExpression( node.id )} = ${emitVariableDeclarationValue( node )};`;
	}
	if (
		node.type === 'VariableUnpackDeclaration'
		&& bindingEntriesForPattern( node.pattern )
			.some( (entry) => cleanupNames.includes( entry.name ) )
	) {
		return emitVariableUnpackAssignments( node );
	}
	return emitStatement( node, options );
}

function emitSwitchStatement( node, options = {} ) {
	if ( options.asyncContext && !options.syncEval ) {
		const cases = node.cases.map( (section) => (
			`{ values: [ ${section.values.map( emitExpression ).join( ', ' )} ], body: async function() ${emitBlock( section.consequent, {
				...options,
				inSwitchSection: true,
				loopDepth: 0,
			} )} }`
		) );
		const defaultBody = node.defaultCase
			? `async function() ${emitBlock( node.defaultCase.consequent, {
				...options,
				inSwitchSection: true,
				loopDepth: 0,
			} )}`
			: 'null';
		const tail = switchStatementContainsReturn( node )
			? options.inSwitchSection
				? 'if ( __zuzu_switch_result && __zuzu_switch_result.__zuzu_return ) { return __zuzu_switch_result; }'
				: 'if ( __zuzu_switch_result && __zuzu_switch_result.__zuzu_return ) { return __zuzu_switch_result.value; }'
			: '';
		return `{ let __zuzu_switch_result = await __zuzu_switch_async( ${emitExpression( node.discriminant )}, ${JSON.stringify( node.comparator )}, [ ${cases.join( ', ' )} ], ${defaultBody} ); ${tail} }`;
	}
	const cases = node.cases.map( (section) => (
		`{ values: [ ${section.values.map( emitExpression ).join( ', ' )} ], body: function() ${emitBlock( section.consequent, {
			...options,
			inSwitchSection: true,
			loopDepth: 0,
		} )} }`
	) );
	const defaultBody = node.defaultCase
		? `function() ${emitBlock( node.defaultCase.consequent, {
			...options,
			inSwitchSection: true,
			loopDepth: 0,
		} )}`
		: 'null';
	const tail = switchStatementContainsReturn( node )
		? options.inSwitchSection
			? 'if ( __zuzu_switch_result && __zuzu_switch_result.__zuzu_return ) { return __zuzu_switch_result; }'
			: 'if ( __zuzu_switch_result && __zuzu_switch_result.__zuzu_return ) { return __zuzu_switch_result.value; }'
		: '';
	return `{ let __zuzu_switch_result = __zuzu_switch( ${emitExpression( node.discriminant )}, ${JSON.stringify( node.comparator )}, [ ${cases.join( ', ' )} ], ${defaultBody} ); ${tail} }`;
}

function emitTraitDeclaration( node, options = {} ) {
	const methods = completeMethodDeclarations( node.body || [] ).map( (method) => {
		const value = emitMethodFunction( method, {
			...options,
			callableName: method.id.name,
			returnTypeName: method.returnType,
			fieldNames: [],
			className: null,
			isStatic: false,
			methodSelfName: 'self',
		} );
		return `${JSON.stringify( method.id.name )}: ${value}`;
	} );
	return `let ${emitExpression( node.id )} = __zuzu_trait( ${JSON.stringify( node.id.name )}, { ${methods.join( ', ' )} }, ${JSON.stringify( marshalSourceSlice( node, options ) || '' )}, ${marshalCapturesExpression( marshalTraitCaptureNames( node, options ) )} );`;
}

function emitClassDeclaration( node, options = {} ) {
	return emitClassDeclarationWithName( node, node.id.name, options );
}

function emitFieldSpec( node ) {
	return `{ kind: ${JSON.stringify( node.kind || 'let' )}, name: ${JSON.stringify( node.id.name )}, typeName: ${node.typeName ? JSON.stringify( node.typeName ) : 'null'}, isWeakStorage: ${node.isWeakStorage ? 'true' : 'false'}, accessors: [ ${node.accessors.map( (item) => JSON.stringify( item ) ).join( ', ' )} ], defaultValue: ${node.defaultValue ? `function() { return ${emitExpression( node.defaultValue )}; }` : 'null'} }`;
}

function emitNestedDeclarationEntry( node, parentName, options = {} ) {
	if ( node.type === 'ClassDeclaration' ) {
		const qualified = `${parentName}{${JSON.stringify( node.id.name )}}`;
		return `${JSON.stringify( node.id.name )}: ( function() { ${emitClassDeclarationWithName( node, qualified, options )} return ${node.id.name}; } )()`;
	}
	return `${JSON.stringify( node.id.name )}: ( function() { ${emitStatement( node, options )} return ${node.id.name}; } )()`;
}

function emitMethodFunction( node, meta ) {
	if ( node.isPredeclared ) {
		return `__zuzu_bodyless_function( ${JSON.stringify( node.id.name )} )`;
	}
	return `( ${emitFunctionLike( node, `${node.isAsync ? 'async ' : ''}function()`, {
		...meta,
		asyncContext: node.isAsync === true,
		extraPreamble: [
			'let self = this;',
			`let __zuzu_super_class__ = ${meta.className ? meta.className : 'null'};`,
			`let __zuzu_super_method__ = ${JSON.stringify( node.id.name )};`,
			`let __zuzu_super_static__ = ${meta.isStatic ? 1 : 0};`,
			...( meta.nestedNames || [] ).map( (name) => `let ${name} = self[${JSON.stringify( name )}];` ),
		].join( '\n' ),
		scopeNames: new Set( [ 'self', '__zuzu_super_class__', '__zuzu_super_method__', '__zuzu_super_static__' ] ),
		fieldNames: meta.fieldNames || [],
		methodSelfName: meta.methodSelfName || 'self',
	} )} )`;
}

function emitClassDeclarationWithName( node, runtimeName, options = {} ) {
	if ( node.shorthand && node.traits.length === 0 ) {
		return `let ${emitExpression( node.id )} = __zuzu_make_class( ${JSON.stringify( runtimeName )}, ${node.base ? emitExpression( node.base ) : 'Object'} );`;
	}
	const fields = node.body.filter( (entry) => entry.type === 'FieldDeclaration' );
	const methodEntries = completeMethodDeclarations( node.body.filter( (entry) => entry.type === 'MethodDeclaration' ) );
	const methods = methodEntries.filter( (entry) => !entry.static );
	const statics = methodEntries.filter( (entry) => entry.static );
	const nested = node.body.filter( (entry) => [ 'ClassDeclaration', 'TraitDeclaration' ].includes( entry.type ) );
	const fieldNames = fields.map( (field) => field.id.name );
	const nestedNames = nested.map( (entry) => entry.id.name );
	return `let ${emitExpression( node.id )} = __zuzu_define_class( ${JSON.stringify( runtimeName )}, ${node.base ? emitExpression( node.base ) : 'Object'}, { "marshalSource": ${JSON.stringify( marshalSourceSlice( node, options ) || '' )}, "marshalCaptures": ${marshalCapturesExpression( marshalClassCaptureNames( node, options ) )}, "traits": [ ${node.traits.map( emitExpression ).join( ', ' )} ], "fields": [ ${fields.map( emitFieldSpec ).join( ', ' )} ], "methods": { ${methods.map( (method) => `${JSON.stringify( method.id.name )}: ${emitMethodFunction( method, {
		...options,
		callableName: method.id.name,
		returnTypeName: method.returnType,
		fieldNames,
		className: node.id.name,
		isStatic: false,
		methodSelfName: 'self',
		nestedNames,
	} )}` ).join( ', ' )} }, "statics": { ${statics.map( (method) => `${JSON.stringify( method.id.name )}: ${emitMethodFunction( method, {
		...options,
		callableName: method.id.name,
		returnTypeName: method.returnType,
		fieldNames: [],
		className: node.id.name,
		isStatic: true,
		methodSelfName: 'self',
		nestedNames,
	} )}` ).join( ', ' )} }, "nested": { ${nested.map( (entry) => emitNestedDeclarationEntry( entry, runtimeName, options ) ).join( ', ' )} } } );`;
}

function completeMethodDeclarations( entries ) {
	const ordered = [];
	const indexes = new Map();
	for ( const entry of entries || [] ) {
		if ( entry.type !== 'MethodDeclaration' ) {
			continue;
		}
		const key = `${entry.static ? 'static:' : 'instance:'}${entry.id.name}`;
		if ( indexes.has( key ) ) {
			const index = indexes.get( key );
			if ( ordered[index].isPredeclared && !entry.isPredeclared ) {
				ordered[index] = entry;
			}
			continue;
		}
		indexes.set( key, ordered.length );
		ordered.push( entry );
	}
	return ordered;
}

function switchStatementContainsReturn( node ) {
	return node.cases.some( (section) => blockContainsReturn( section.consequent ) )
		|| ( node.defaultCase && blockContainsReturn( node.defaultCase.consequent ) );
}

function blockContainsReturn( block ) {
	return block.body.some( statementContainsReturn );
}

function statementContainsReturn( stmt ) {
	switch ( stmt.type ) {
		case 'ReturnStatement':
			return true;
		case 'BlockStatement':
			return blockContainsReturn( stmt );
		case 'IfStatement':
			return blockContainsReturn( stmt.consequent )
				|| ( stmt.alternate
					? stmt.alternate.type === 'BlockStatement'
						? blockContainsReturn( stmt.alternate )
						: statementContainsReturn( stmt.alternate )
					: false );
		case 'ForInStatement':
			return blockContainsReturn( stmt.body )
				|| ( stmt.elseBlock ? blockContainsReturn( stmt.elseBlock ) : false );
		case 'WhileStatement':
			return blockContainsReturn( stmt.body );
		case 'TryStatement':
			return blockContainsReturn( stmt.block )
				|| ( stmt.handlers || [] ).some( (handler) => blockContainsReturn( handler.body ) );
		case 'SwitchStatement':
			return switchStatementContainsReturn( stmt );
		default:
			return false;
	}
}

function emitExpression( node ) {
	const options = currentEmitContext();
	switch ( node.type ) {
		case 'Identifier':
			if ( node.name === '^^' ) {
				return options.chainHereName
					|| "( () => { throw new Error( \"Undeclared variable '^^'\" ); } )()";
			}
			if (
				options.fieldNames
				&& options.fieldNames.includes( node.name )
				&& !scopeHasName( options, node.name )
			) {
				return `${options.methodSelfName || 'self'}[${JSON.stringify( node.name )}]`;
			}
			return node.name === '__argc__' ? '__argc__' : node.name;
		case 'NumericLiteral':
			return String( node.value );
		case 'StringLiteral':
			return JSON.stringify( node.value );
		case 'BinaryStringLiteral':
			return `__zuzu_binary_literal( ${JSON.stringify( node.value )} )`;
		case 'TemplateLiteral':
			return emitTemplateLiteral( node );
		case 'RegExpLiteral':
			return `new RegExp( ${emitRegExpPattern( node )}, ${JSON.stringify( node.flags )} )`;
		case 'Literal':
			if ( node.value === null ) {
				return 'null';
			}
			return node.value ? 'true' : 'false';
		case 'Super':
			throw new UnsupportedSyntaxError( 'super must be called like a method' );
		case 'GroupedExpression':
			return `( ${emitExpression( node.expression )} )`;
		case 'ArrayExpression':
			return `__zuzu_array( [ ${node.elements.map( (element) => {
				if ( element.type === 'BinaryExpression' && element.operator === '...' ) {
					return `...${emitExpression( element )}`;
				}
				return emitExpression( element );
			} ).join( ', ' )} ] )`;
		case 'SetLiteral':
			return `__zuzu_set( [ ${emitCollectionElements( node.elements )} ] )`;
		case 'BagLiteral':
			return `__zuzu_bag( [ ${emitCollectionElements( node.elements )} ] )`;
		case 'PairListLiteral':
			return `__zuzu_pairlist_literal( [ ${emitPairListEntries( node.entries )} ] )`;
		case 'ObjectExpression':
			return `( () => { const __zuzu_obj = {}; ${node.properties.map(
				(prop) => `__zuzu_obj[${JSON.stringify( prop.key )}] = __zuzu_retain_collection_value( __zuzu_obj, ${emitExpression( prop.value )} );`
			).join( ' ' )} return __zuzu_obj; } )()`;
		case 'NamedArgument':
			return `[ ${emitExpression( node.keyExpr || { type: 'StringLiteral', value: node.key } )}, ${emitExpression( node.value )} ]`;
		case 'BraceIdentifier':
			return JSON.stringify( node.name );
		case 'SliceExpression':
			return emitSliceExpression( node );
		case 'MemberExpression':
			if ( node.computed ) {
				if ( node.property.type === 'BraceIdentifier' ) {
					return `__zuzu_get_brace_member( ${emitExpression( node.object )}, ${JSON.stringify( node.property.name )}, () => ${node.property.name} )`;
				}
				return `__zuzu_get_index( ${emitExpression( node.object )}, ${emitExpression( node.property )} )`;
			}
			if ( node.property.name === 'length' ) {
				return `__zuzu_length( ${emitExpression( node.object )} )`;
			}
			return `__zuzu_call_member( ${emitExpression( node.object )}, ${JSON.stringify( node.property.name )} )`;
		case 'CallExpression':
			return emitCallExpression( node, options );
		case 'RegexReplaceExpression':
			return emitRegexReplaceExpression( node );
		case 'RefExpression':
			return emitRefExpression( node );
		case 'AssignmentExpression':
			return emitAssignmentExpression( node );
		case 'LetExpression':
			return emitLetExpression( node );
		case 'ConditionalExpression':
			return `( __zuzu_truthy( ${emitExpression( node.test )} ) ? ${emitExpression( node.consequent )} : ${emitExpression( node.alternate )} )`;
		case 'ShortTernaryExpression':
			return `( __zuzu_truthy( ${emitExpression( node.test )} ) ? ${emitExpression( node.test )} : ${emitExpression( node.alternate )} )`;
		case 'TryExpression':
			return emitTryExpression( node );
		case 'DoExpression':
			return emitDoExpression( node );
		case 'UnaryExpression':
			return emitUnaryExpression( node );
		case 'BinaryExpression':
			return emitBinaryExpression( node );
		case 'UpdateExpression':
			{
				const target = unwrapGroupedExpression( node.argument );
				if (
					target
					&& target.type === 'BinaryExpression'
					&& [ '@', '@@', '@?' ].includes( target.operator )
				) {
					const mode = target.operator === '@@'
						? 'all'
						: target.operator === '@?'
							? 'maybe'
							: 'first';
					return `__zuzu_path_update( ${emitExpression( target.left )}, ${emitExpression( target.right )}, "${mode}", ${JSON.stringify( node.operator )}, ${node.prefix ? 'true' : 'false'} )`;
				}
			}
			return node.prefix
				? `( ${emitAssignmentTarget( node.argument )} = __zuzu_${node.operator === '++' ? 'add' : 'sub'}( ${emitAssignmentTarget( node.argument )}, 1 ) )`
				: `( () => { const __zuzu_old = __zuzu_num( ${emitAssignmentTarget( node.argument )} ); ${emitAssignmentTarget( node.argument )} = __zuzu_${node.operator === '++' ? 'add' : 'sub'}( __zuzu_old, 1 ); return __zuzu_old; } )()`;
		case 'FunctionExpression':
			{
				const fn = emitFunctionLike( node, `${node.isAsync ? 'async ' : ''}function()`, {
					...nestedFunctionOptions( options ),
					asyncContext: node.isAsync === true,
					syncEval: options.syncEval === true,
				} );
				const meta = marshalMetaExpression(
					'function',
					node.id && node.id.name,
					marshalFunctionSource( node ),
					marshalCaptureNames( node )
				);
				return `__zuzu_with_marshal_meta( ( ${fn} ), ${meta} )`;
			}
		case 'AwaitExpression':
			if ( currentEmitContext().syncEval ) {
				return `__zuzu_await_block_sync( ( () => { ${emitExpressionBlock( node.block, {
					...options,
					asyncContext: false,
					nonLocalReturn: true,
					boxResult: true,
					syncEval: true,
				} )} } )() )`;
			}
			return `await __zuzu_await_block( ( async () => { ${emitExpressionBlock( node.block, {
				...options,
				asyncContext: true,
				nonLocalReturn: true,
				boxResult: true,
			} )} } )() )`;
		case 'SpawnExpression':
			return `__zuzu_spawn( async () => { ${emitExpressionBlock( node.block, {
				...options,
				asyncContext: true,
				nonLocalReturn: true,
			} )} }, { name: "<spawn>", line: ${JSON.stringify( node.loc.start.line )} } )`;
		case 'NewExpression':
			return emitNewExpression( node );
		default:
			throw new UnsupportedSyntaxError( `Unsupported expression node ${node.type}` );
	}
}

function emitNewExpression( node ) {
	const traitList = Array.isArray( node.traits ) && node.traits.length > 0
		? `[ ${node.traits.map( emitExpression ).join( ', ' )} ]`
		: null;
	if ( node.callee.type === 'CallExpression' ) {
		const callee = emitExpression( node.callee.callee );
		const constructor = traitList
			? `__zuzu_class_with_traits( ${callee}, ${traitList} )`
			: callee;
		const args = emitCallArgumentList( node.callee.arguments );
		if ( traitList ) {
			return `new (${constructor})( ${args} )`;
		}
		if (
			node.callee.callee.type === 'Identifier'
			|| (
				node.callee.callee.type === 'MemberExpression'
				&& !node.callee.callee.computed
			)
		) {
			return `new ${constructor}( ${args} )`;
		}
		return `new (${constructor})( ${args} )`;
	}
	if ( traitList ) {
		return `new (__zuzu_class_with_traits( ${emitExpression( node.callee )}, ${traitList} ))`;
	}
	return `new ${emitExpression( node.callee )}`;
}

function emitCallExpression( node, options = {} ) {
	let source;
	if ( node.callee.type === 'Super' ) {
		const argArray = emitCallArgumentArray( node.arguments );
		source = `__zuzu_super_dispatch( __zuzu_super_static__, self, __zuzu_super_class__, __zuzu_super_method__, ${argArray} )`;
	}
	else if (
		node.callee.type === 'Identifier'
		&& ( options.evalNames || new Set( [ 'eval' ] ) ).has( node.callee.name )
		&& node.arguments.length > 0
	) {
		source = emitEvalCall( node.arguments );
	}
	else if (
		node.callee.type === 'MemberExpression'
		&& !node.callee.computed
		&& node.callee.property.type === 'Identifier'
		&& node.callee.property.name === 'length'
		&& node.arguments.length === 0
	) {
		source = `__zuzu_length( ${emitExpression( node.callee.object )} )`;
	}
	else if ( callReleasesTemporaryCollectionReceiver( node ) ) {
		const object = emitExpression( node.callee.object );
		const property = JSON.stringify( node.callee.property.name );
		source = `( () => { const __zuzu_receiver = ${object}; const __zuzu_result = __zuzu_call_member( __zuzu_receiver, ${property} ); __zuzu_release_collection_values( __zuzu_receiver ); return __zuzu_result; } )()`;
	}
	else if ( node.callee.type === 'MemberExpression' ) {
		const args = emitCallArgumentList( node.arguments );
		if (
			options.asyncContext
			&& !options.syncEval
			&& !node.callee.computed
			&& node.callee.property.type === 'Identifier'
			&& [ 'map', 'grep', 'reduce' ].includes( node.callee.property.name )
			&& node.arguments.length > 0
		) {
			const object = emitExpression( node.callee.object );
			const method = node.callee.property.name;
			source = `await __zuzu_collection_${method}_async( ${object}, ${args} )`;
		}
		else if ( node.arguments.length === 0 ) {
			const object = emitExpression( node.callee.object );
			const property = node.callee.computed
				? node.callee.property.type === 'BraceIdentifier'
					? `__zuzu_resolve_brace_key( ${object}, ${JSON.stringify( node.callee.property.name )}, () => ${node.callee.property.name} )`
					: emitExpression( node.callee.property )
				: JSON.stringify( node.callee.property.name );
			source = `__zuzu_call_member( ${object}, ${property} )`;
		}
		else {
			const object = emitExpression( node.callee.object );
			if ( node.callee.computed ) {
				const property = node.callee.property.type === 'BraceIdentifier'
					? `__zuzu_resolve_brace_key( ${object}, ${JSON.stringify( node.callee.property.name )}, () => ${node.callee.property.name} )`
					: emitExpression( node.callee.property );
				source = `__zuzu_call_member( ${object}, ${property}, ${args} )`;
			}
			else {
				source = `__zuzu_call_member( ${object}, ${JSON.stringify( node.callee.property.name )}, ${args} )`;
			}
		}
	}
	else {
		source = `${emitExpression( node.callee )}( ${emitCallArgumentList( node.arguments )} )`;
	}
	if ( !callNeedsTraceMetadata( node, options ) || /\bawait\b/u.test( source ) ) {
		return source;
	}
	const line = node.loc && node.loc.start ? node.loc.start.line : null;
	return `__zuzu_callsite( { line: ${JSON.stringify( line )} }, () => ${source} )`;
}

function callReleasesTemporaryCollectionReceiver( node ) {
	return node.callee.type === 'MemberExpression'
		&& !node.callee.computed
		&& node.callee.property.type === 'Identifier'
		&& node.arguments.length === 0
		&& node.callee.object.type === 'ArrayExpression'
		&& [ 'copy', 'to_Array', 'to_Bag', 'to_List', 'to_Set' ]
			.includes( node.callee.property.name );
}

function callNeedsTraceMetadata( node, options = {} ) {
	if ( node.callee.type === 'Identifier' ) {
		if ( options.asyncNames && options.asyncNames.has( node.callee.name ) ) {
			return true;
		}
		return [
			'all',
			'failed',
			'race',
			'resolved',
			'sleep',
			'timeout',
			'yield',
		].includes( node.callee.name );
	}
	if (
		node.callee.type === 'MemberExpression'
		&& !node.callee.computed
		&& node.callee.property.type === 'Identifier'
	) {
		return [
			'append_async',
			'append_utf8_async',
			'each_line',
			'lines',
			'lines_async',
			'lines_utf8',
			'lines_utf8_async',
			'next_line',
			'pipeline',
			'pipeline_async',
			'recv',
			'request',
			'request_async',
			'run',
			'run_async',
			'send',
			'send_async',
			'sleep_async',
			'slurp',
			'slurp_async',
			'slurp_utf8',
			'slurp_utf8_async',
			'spew',
			'spew_async',
			'spew_utf8',
			'spew_utf8_async',
		].includes( node.callee.property.name );
	}
	return false;
}

function emitUnaryExpression( node ) {
	const target = unwrapGroupedExpression( node.argument );
	if (
		( node.operator === '++' || node.operator === '--' )
		&& target
		&& target.type === 'BinaryExpression'
		&& [ '@', '@@', '@?' ].includes( target.operator )
	) {
		const mode = target.operator === '@@'
			? 'all'
			: target.operator === '@?'
				? 'maybe'
				: 'first';
		return `__zuzu_path_update( ${emitExpression( target.left )}, ${emitExpression( target.right )}, "${mode}", ${JSON.stringify( node.operator )}, true )`;
	}
	if ( node.operator === 'not' ) {
		return `__zuzu_not( ${emitExpression( node.argument )} )`;
	}
	if ( node.operator === '¬' ) {
		return `__zuzu_not( ${emitExpression( node.argument )} )`;
	}
	if ( node.operator === '!' ) {
		return `__zuzu_not( ${emitExpression( node.argument )} )`;
	}
	if ( node.operator === '~' ) {
		return `__zuzu_bit_not( ${emitExpression( node.argument )} )`;
	}
	if ( node.operator === 'typeof' ) {
		return `__zuzu_typeof( ${emitExpression( node.argument )} )`;
	}
	if ( node.operator === 'abs' ) {
		return `__zuzu_abs( ${emitExpression( node.argument )} )`;
	}
	if ( node.operator === 'sqrt' ) {
		return `__zuzu_sqrt( ${emitExpression( node.argument )} )`;
	}
	if ( node.operator === '√' ) {
		return `__zuzu_sqrt( ${emitExpression( node.argument )} )`;
	}
	if ( node.operator === 'floor' ) {
		return `__zuzu_floor( ${emitExpression( node.argument )} )`;
	}
	if ( node.operator === 'ceil' ) {
		return `__zuzu_ceil( ${emitExpression( node.argument )} )`;
	}
	if ( node.operator === 'round' ) {
		return `__zuzu_round( ${emitExpression( node.argument )} )`;
	}
	if ( node.operator === 'int' ) {
		return `__zuzu_int( ${emitExpression( node.argument )} )`;
	}
	if ( node.operator === 'length' ) {
		return `__zuzu_length( ${emitExpression( node.argument )} )`;
	}
	if ( node.operator === 'uc' ) {
		return `__zuzu_uc( ${emitExpression( node.argument )} )`;
	}
	if ( node.operator === 'lc' ) {
		return `__zuzu_lc( ${emitExpression( node.argument )} )`;
	}
	if ( node.operator === '+' ) {
		return `__zuzu_num( ${emitExpression( node.argument )} )`;
	}
	if ( node.operator === '-' ) {
		return `( -__zuzu_num( ${emitExpression( node.argument )} ) )`;
	}
	return `${node.operator}${emitExpression( node.argument )}`;
}

function emitTemplateLiteral( node ) {
	if ( !node.parts || node.parts.length === 0 ) {
		return '""';
	}
	let out = emitExpression( node.parts[0] );
	for ( let i = 1; i < node.parts.length; i++ ) {
		out = `__zuzu_concat( ${out}, ${emitExpression( node.parts[i] )} )`;
	}
	return out;
}

function emitRegExpPattern( node ) {
	if ( !node.parts || node.parts.length === 0 ) {
		return JSON.stringify( node.pattern );
	}
	return emitTemplateLiteral( {
		type: 'TemplateLiteral',
		parts: node.parts,
	} );
}

function emitCollectionElements( elements ) {
	return elements.map( (element) => {
		if ( element.type === 'BinaryExpression' && element.operator === '...' ) {
			return `...${emitExpression( element )}`;
		}
		return emitExpression( element );
	} ).join( ', ' );
}

function emitPairListEntries( entries ) {
	return entries.map( (entry) => {
		if ( entry.type === 'PairListEntry' ) {
			const keyExpr = entry.keyExpr || { type: 'StringLiteral', value: entry.key };
			return `[ ${emitExpression( keyExpr )}, ${emitExpression( entry.value )} ]`;
		}
		return emitExpression( entry );
	} ).join( ', ' );
}

function emitBinaryExpression( node ) {
	if ( node.operator === '▷' || node.operator === '|>' ) {
		const input = emitExpression( node.left );
		const hereName = `__zuzu_chain_${chainCounter++}`;
		const right = withEmitContext( {
			...currentEmitContext(),
			chainHereName: hereName,
		}, () => emitExpression( node.right ) );
		return `( () => { const ${hereName} = ${input}; return ${right}; } )()`;
	}
	if ( node.operator === '◁' || node.operator === '<|' ) {
		const input = emitExpression( node.right );
		const hereName = `__zuzu_chain_${chainCounter++}`;
		const left = withEmitContext( {
			...currentEmitContext(),
			chainHereName: hereName,
		}, () => emitExpression( node.left ) );
		return `( () => { const ${hereName} = ${input}; return ${left}; } )()`;
	}
	const left = emitExpression( node.left );
	const right = emitExpression( node.right );
		switch ( node.operator ) {
			case 'and':
			case '⋀':
				return `( () => { const __zuzu_left = ${left}; return __zuzu_truthy( __zuzu_left ) ? ( __zuzu_truthy( ${right} ) ? 1 : 0 ) : 0; } )()`;
			case 'or':
			case '⋁':
				return `( () => { const __zuzu_left = ${left}; return __zuzu_truthy( __zuzu_left ) ? 1 : ( __zuzu_truthy( ${right} ) ? 1 : 0 ); } )()`;
		case 'xor':
		case '⊻':
			return `__zuzu_xor( ${left}, ${right} )`;
		case 'nand':
		case '⊼':
			return `__zuzu_nand( ${left}, ${right} )`;
		case 'eq':
			return `__zuzu_str_eq( ${left}, ${right} )`;
		case 'ne':
			return `( __zuzu_str_eq( ${left}, ${right} ) ? 0 : 1 )`;
		case 'default':
			return `__zuzu_default( ${left}, ${right} )`;
		case '==':
			return `__zuzu_eq( ${left}, ${right} )`;
		case '=':
			return `__zuzu_num_eq( ${left}, ${right} )`;
		case '≡':
			return `__zuzu_eq( ${left}, ${right} )`;
		case '≢':
			return `__zuzu_ne( ${left}, ${right} )`;
		case '!=':
		case '≠':
			return `__zuzu_ne( ${left}, ${right} )`;
		case '~':
			return `__zuzu_match( ${left}, ${right} )`;
		case '_':
			return `__zuzu_concat( ${left}, ${right} )`;
		case '+':
			return `__zuzu_add( ${left}, ${right} )`;
		case '-':
			return `__zuzu_sub( ${left}, ${right} )`;
		case '*':
		case '×':
			return `__zuzu_mul( ${left}, ${right} )`;
		case '/':
		case '÷':
			return `__zuzu_div( ${left}, ${right} )`;
		case '**':
			return `__zuzu_pow( ${left}, ${right} )`;
		case 'mod':
			return `( __zuzu_num( ${left} ) % __zuzu_num( ${right} ) )`;
		case '...':
			return `__zuzu_range( ${left}, ${right} )`;
		case '<=>':
		case '≶':
		case '≷':
			return `__zuzu_cmp( ${left}, ${right} )`;
		case 'cmp':
			return `__zuzu_str_cmp( ${left}, ${right} )`;
		case 'gt':
			return `__zuzu_str_gt( ${left}, ${right} )`;
		case 'ge':
			return `__zuzu_str_ge( ${left}, ${right} )`;
		case 'lt':
			return `__zuzu_str_lt( ${left}, ${right} )`;
		case 'le':
			return `__zuzu_str_le( ${left}, ${right} )`;
		case 'eqi':
			return `__zuzu_str_eqi( ${left}, ${right} )`;
		case 'nei':
			return `__zuzu_str_nei( ${left}, ${right} )`;
		case 'gti':
			return `__zuzu_str_gti( ${left}, ${right} )`;
		case 'gei':
			return `__zuzu_str_gei( ${left}, ${right} )`;
		case 'lti':
			return `__zuzu_str_lti( ${left}, ${right} )`;
		case 'lei':
			return `__zuzu_str_lei( ${left}, ${right} )`;
		case 'cmpi':
			return `__zuzu_str_cmpi( ${left}, ${right} )`;
		case '≤':
			return `__zuzu_num_lte( ${left}, ${right} )`;
		case '≥':
			return `__zuzu_num_gte( ${left}, ${right} )`;
		case '<':
			return `__zuzu_num_lt( ${left}, ${right} )`;
		case '<=':
			return `__zuzu_num_lte( ${left}, ${right} )`;
		case '>':
			return `__zuzu_num_gt( ${left}, ${right} )`;
		case '>=':
			return `__zuzu_num_gte( ${left}, ${right} )`;
		case 'union':
		case '⋃':
			return `__zuzu_union( ${left}, ${right} )`;
		case 'intersection':
		case '⋂':
			return `__zuzu_intersection( ${left}, ${right} )`;
		case '\\':
		case '∖':
		case 'difference':
			return `__zuzu_difference( ${left}, ${right} )`;
		case 'subsetof':
		case '⊂':
			return `__zuzu_subsetof( ${left}, ${right} )`;
		case 'supersetof':
		case '⊃':
			return `__zuzu_supersetof( ${left}, ${right} )`;
		case 'equivalentof':
		case '⊂⊃':
			return `__zuzu_equivalentof( ${left}, ${right} )`;
		case 'instanceof':
			return `__zuzu_instanceof( ${left}, ${right} )`;
		case 'does':
			return `__zuzu_does( ${left}, ${right} )`;
		case 'can':
			if ( node.right.type === 'Identifier' ) {
				return `__zuzu_can( ${left}, ${JSON.stringify( node.right.name )} )`;
			}
			return `__zuzu_can( ${left}, ${right} )`;
		case 'in':
		case '∈':
			return `__zuzu_contains( ${right}, ${left} )`;
		case 'not_in':
		case '∉':
			return `( __zuzu_contains( ${right}, ${left} ) ? 0 : 1 )`;
		case '@':
			return `__zuzu_path_op( ${left}, ${right}, "first" )`;
		case '@@':
			return `__zuzu_path_op( ${left}, ${right}, "all" )`;
		case '@?':
			return `__zuzu_path_op( ${left}, ${right}, "exists" )`;
		case '&':
			return `__zuzu_bit_and( ${left}, ${right} )`;
		case '|':
			return `__zuzu_bit_or( ${left}, ${right} )`;
		case '^':
			return `__zuzu_bit_xor( ${left}, ${right} )`;
		default:
			return `( ${left} ${node.operator} ${right} )`;
	}
}

function emitAssignmentExpression( node ) {
	const options = currentEmitContext();
	if (
		node.left
		&& node.left.type === 'BinaryExpression'
		&& [ '@', '@@', '@?' ].includes( node.left.operator )
	) {
		const target = emitExpression( node.left.left );
		const path = emitExpression( node.left.right );
		const right = emitExpression( node.right );
		const mode = node.left.operator === '@@'
			? 'all'
			: node.left.operator === '@?'
				? 'maybe'
				: 'first';
		return `__zuzu_path_assign( ${target}, ${path}, ${right}, "${mode}", ${JSON.stringify( node.operator )}, ${node.isWeakWrite ? 'true' : 'false'} )`;
	}
	if ( node.left && node.left.type === 'SliceExpression' && node.operator === ':=' ) {
		const objectTarget = emitAssignmentTarget( node.left.object );
		const objectValue = emitExpression( node.left.object );
		const start = node.left.start ? emitExpression( node.left.start ) : '0';
		const length = node.left.length == null ? 'null' : emitExpression( node.left.length );
		const right = emitExpression( node.right );
		return `${objectTarget} = __zuzu_assign_slice( ${objectValue}, ${start}, ${length}, ${right} )`;
	}
	const left = emitAssignmentTarget( node.left );
	const right = emitExpression( node.right );
	switch ( node.operator ) {
		case ':=':
			if ( node.left && node.left.type === 'Identifier' ) {
				const weakStorage = options.weakStorageNames
					&& options.weakStorageNames.has( node.left.name );
				return weakStorage || node.isWeakWrite
					? `${left} = __zuzu_assign_weak( ${left}, ${right} )`
					: `${left} = __zuzu_assign_strong( ${left}, ${right} )`;
			}
			if ( node.left && node.left.type === 'MemberExpression' ) {
				const object = emitExpression( node.left.object );
				const objectTarget = emitAssignmentTarget( node.left.object );
				const key = node.left.computed
					? node.left.property.type === 'BraceIdentifier'
						? `__zuzu_resolve_brace_key( ${object}, ${JSON.stringify( node.left.property.name )}, () => ${node.left.property.name} )`
						: emitExpression( node.left.property )
					: JSON.stringify( node.left.property.name );
				return `__zuzu_assign_index( ${object}, ${key}, ${right}, ${node.isWeakWrite ? 'true' : 'false'}, ( __zuzu_updated ) => ( ${objectTarget} = __zuzu_updated ) )`;
			}
			return `${left} = ${right}`;
		case '+=':
			return `${left} = __zuzu_add( ${left}, ${right} )`;
		case '-=':
			return `${left} = __zuzu_sub( ${left}, ${right} )`;
		case '*=':
		case '×=':
			return `${left} = __zuzu_mul( ${left}, ${right} )`;
		case '/=':
		case '÷=':
			return `${left} = __zuzu_div( ${left}, ${right} )`;
		case '%=':
			return `${left} = __zuzu_mod( ${left}, ${right} )`;
		case '**=':
			return `${left} = __zuzu_pow( ${left}, ${right} )`;
		case '_=':
			return `${left} = __zuzu_concat( ${left}, ${right} )`;
		case '?:=':
			return `( ${left} == null ? ( ${left} = ${right} ) : ${left} )`;
		default:
			throw new UnsupportedSyntaxError( `Unsupported assignment operator ${node.operator}` );
	}
}

function emitAssignmentTarget( node ) {
	if ( node && node.type === 'MemberExpression' && node.computed && node.property ) {
		if ( node.property.type === 'BraceIdentifier' ) {
			const object = emitExpression( node.object );
			return `${object}[__zuzu_resolve_brace_key( ${object}, ${JSON.stringify( node.property.name )}, () => ${node.property.name} )]`;
		}
		return `${emitExpression( node.object )}[${emitExpression( node.property )}]`;
	}
	return emitExpression( node );
}

function emitSliceExpression( node ) {
	const object = emitExpression( node.object );
	const start = node.start ? emitExpression( node.start ) : '0';
	const length = node.length == null ? 'null' : emitExpression( node.length );
	return `__zuzu_get_slice( ${object}, ${start}, ${length} )`;
}

function unwrapGroupedExpression( node ) {
	let current = node;
	while ( current && current.type === 'GroupedExpression' ) {
		current = current.expression;
	}
	return current;
}

function emitRegexReplaceExpression( node ) {
	const leftTarget = unwrapGroupedExpression( node.left );
	if (
		leftTarget
		&& leftTarget.type === 'BinaryExpression'
		&& [ '@', '@@', '@?' ].includes( leftTarget.operator )
	) {
		const mode = leftTarget.operator === '@@'
			? 'all'
			: leftTarget.operator === '@?'
				? 'maybe'
				: 'first';
		const pattern = node.pattern.type === 'RegExpLiteral'
			? emitExpression( node.pattern )
			: `__zuzu_to_regexp( ${emitExpression( node.pattern )} )`;
		return `__zuzu_path_assign( ${emitExpression( leftTarget.left )}, ${emitExpression( leftTarget.right )}, [ ${pattern}, ( m ) => ${emitExpression( node.replacement )} ], "${mode}", "~=" )`;
	}
	const left = emitExpression( node.left );
	const pattern = node.pattern.type === 'RegExpLiteral'
		? emitExpression( node.pattern )
		: `__zuzu_to_regexp( ${emitExpression( node.pattern )} )`;
	const replacement = emitExpression( node.replacement );
	return `${left} = __zuzu_regex_replace( ${left}, ${pattern}, ( ...__zuzu_match_args ) => { const m = __zuzu_match_args; return ${replacement}; } )`;
}

function emitRefExpression( node ) {
	const arg = unwrapGroupedExpression( node.argument );
	if (
		arg
		&& arg.type === 'BinaryExpression'
		&& [ '@', '@@', '@?' ].includes( arg.operator )
	) {
		const mode = arg.operator === '@@'
			? 'all'
			: arg.operator === '@?'
				? 'maybe'
				: 'first';
		return `__zuzu_path_ref( ${emitExpression( arg.left )}, ${emitExpression( arg.right )}, "${mode}" )`;
	}
	if ( arg.type === 'SliceExpression' ) {
		return `__zuzu_ref_slice( ${emitExpression( arg.object )}, ${arg.start ? emitExpression( arg.start ) : '0'}, ${arg.length == null ? 'null' : emitExpression( arg.length )} )`;
	}
	if ( arg.type === 'MemberExpression' ) {
		if ( arg.computed ) {
			if ( arg.property.type === 'BraceIdentifier' ) {
				return `__zuzu_ref_index( ${emitExpression( arg.object )}, ${JSON.stringify( arg.property.name )} )`;
			}
			return `__zuzu_ref_index( ${emitExpression( arg.object )}, ${emitExpression( arg.property )} )`;
		}
		return `__zuzu_ref_key( ${emitExpression( arg.object )}, ${JSON.stringify( arg.property.name )} )`;
	}
	throw new UnsupportedSyntaxError( 'Unsupported reference target' );
}

function emitExpressionBlock( block, options = {} ) {
	return withEmitContext( options, () => {
		if ( !block || !Array.isArray( block.body ) || block.body.length === 0 ) {
			return options.boxResult
				? 'return { __zuzu_await_block_value: null };'
				: 'return null;';
		}
		const expressionDeclaredNames = collectExpressionDeclaredNames( block.body );
		const scopedOptions = {
			...options,
			weakStorageNames: new Set( [
				...( options.weakStorageNames || [] ),
				...collectWeakDeclaredNames( block.body ),
			] ),
			scopeNames: new Set( [
				...( options.scopeNames || [] ),
				...expressionDeclaredNames,
			] ),
		};
		return withEmitContext( scopedOptions, () => {
			const lines = [];
			const prelude = emitPredeclaredNames( expressionDeclaredNames );
			if ( prelude ) {
				lines.push( prelude );
			}
			const lastIndex = block.body.length - 1;
			for ( let i = 0; i < block.body.length; i++ ) {
				const stmt = block.body[i];
				if ( i === lastIndex ) {
					lines.push( emitExpressionTail( stmt, scopedOptions ) );
				}
				else {
					lines.push( emitExpressionInnerStatement( stmt, scopedOptions ) );
				}
			}
			return lines.join( '\n' );
		} );
	} );
}

function emitExpressionInnerStatement( stmt, options = {} ) {
	if ( options.nonLocalReturn && stmt.type === 'ReturnStatement' ) {
		return emitDoReturnStatement( stmt );
	}
	return emitStatement( stmt, options );
}

function emitExpressionTail( stmt, options = {} ) {
	if ( stmt.type === 'ExpressionStatement' ) {
		const value = emitExpression( stmt.expression );
		return options.boxResult
			? `return { __zuzu_await_block_value: ${value} };`
			: `return ${value};`;
	}
	if ( stmt.type === 'ReturnStatement' ) {
		return options.nonLocalReturn
			? emitDoReturnStatement( stmt )
			: emitStatement( stmt );
	}
	if ( stmt.type === 'BlockStatement' ) {
		return emitExpressionBlock( stmt, options );
	}
	if ( stmt.type === 'IfStatement' ) {
		const prefix = stmt.declaration ? `${emitStatement( stmt.declaration, options )}\n` : '';
		const alternate = stmt.alternate
			? emitExpressionTail( stmt.alternate, options )
			: options.boxResult
				? 'return { __zuzu_await_block_value: null };'
				: 'return null;';
		return `${prefix}if ( __zuzu_truthy( ${emitExpression( stmt.test )} ) ) { ${emitExpressionBlock( stmt.consequent, options )} } else { ${alternate} }`;
	}
	return emitStatement( stmt, options );
}

function emitDoReturnStatement( stmt ) {
	return `throw { __zuzu_nonlocal_return: true, value: ${stmt.argument ? emitExpression( stmt.argument ) : 'null'} };`;
}

function emitTryExpression( node ) {
	const options = currentEmitContext();
	const handlers = node.handlers || [];
	let catchBody = 'throw __zuzu_err;';
	if ( handlers.length > 0 ) {
		const branches = handlers.map( (handler, index ) => {
			const cond = handler.typeName === 'Exception' || handler.typeName === 'Any'
				? 'true'
				: `__zuzu_instanceof( __zuzu_err, ${handler.typeName} )`;
			const prefix = index === 0 ? `if ( ${cond} )` : `else if ( ${cond} )`;
			return `${prefix} { let ${handler.paramName} = __zuzu_err; ${emitExpressionBlock( handler.body, options )} }`;
		} );
		catchBody = `if ( __zuzu_err && __zuzu_err.__zuzu_nonlocal_return ) { throw __zuzu_err; } __zuzu_err = __zuzu_normalize_exception( __zuzu_err ); ${branches.join( ' ' )} else { throw __zuzu_err; }`;
	}
	return `( ${options.asyncContext ? 'async ' : ''}() => { try { ${emitExpressionBlock( node.block, options )} } catch ( __zuzu_err ) { ${catchBody} } } )()`;
}

function emitDoExpression( node ) {
	return `( () => { ${emitExpressionBlock( node.block, {
		...currentEmitContext(),
		nonLocalReturn: true,
	} )} } )()`;
}

function emitCallArguments( args ) {
	const positional = [];
	const named = [];
	for ( const arg of args ) {
		if ( arg.type === 'NamedArgument' ) {
			named.push( arg );
		}
		else {
			positional.push( emitExpression( arg ) );
		}
	}
	if ( named.length > 0 ) {
		positional.push( `__zuzu_temp_pairlist( [ ${named.map( (arg) => emitExpression( arg ) ).join( ', ' )} ] )` );
	}
	return positional;
}

function emitCallArgumentList( args ) {
	if ( !callArgumentsHaveSpread( args ) ) {
		return emitCallArguments( args ).join( ', ' );
	}
	return `...${emitSpreadCallArguments( args )}`;
}

function emitCallArgumentArray( args ) {
	if ( args.length === 0 ) {
		return '[]';
	}
	if ( !callArgumentsHaveSpread( args ) ) {
		return `[ ${emitCallArguments( args ).join( ', ' )} ]`;
	}
	return emitSpreadCallArguments( args );
}

function callArgumentsHaveSpread( args ) {
	return args.some( (arg) => arg.type === 'SpreadArgument' );
}

function emitSpreadCallArguments( args ) {
	return `__zuzu_spread_call_args( [ ${args.map( emitSpreadCallArgumentPart ).join( ', ' )} ] )`;
}

function emitSpreadCallArgumentPart( arg ) {
	if ( arg.type === 'SpreadArgument' ) {
		return `__zuzu_snapshot_spread_arg( ${emitExpression( arg.argument )} )`;
	}
	if ( arg.type === 'NamedArgument' ) {
		return `{ type: "named", value: ${emitExpression( arg )} }`;
	}
	return `{ type: "positional", value: ${emitExpression( arg )} }`;
}

function emitEvalCall( args ) {
	if ( callArgumentsHaveSpread( args ) ) {
		return `eval( __zuzu_prepare_eval_call_args( ${emitSpreadCallArguments( args )} ) )`;
	}
	const positional = [];
	const named = [];
	for ( const arg of args ) {
		if ( arg.type === 'NamedArgument' ) {
			named.push( arg );
		}
		else {
			positional.push( arg );
		}
	}
	const source = positional.length > 0 ? emitExpression( positional[0] ) : '""';
	const namedArgs = named.length > 0
		? `__zuzu_pairlist_literal( [ ${named.map( (arg) => emitExpression( arg ) ).join( ', ' )} ] )`
		: 'null';
	return `eval( __zuzu_prepare_eval( ${source}, ${namedArgs} ) )`;
}

module.exports = {
	emitProgram,
};

function programNeedsAsyncWrapper( ast ) {
	return ast.body.some( (stmt) => nodeContainsAsyncControl( stmt ) );
}

function nodeContainsAsyncControl( node ) {
	if ( !node || typeof node !== 'object' ) {
		return false;
	}
	if ( node.type === 'AwaitExpression' || node.type === 'SpawnExpression' ) {
		return true;
	}
	if (
		[ 'FunctionDeclaration', 'FunctionExpression', 'MethodDeclaration' ].includes( node.type )
	) {
		return false;
	}
	for ( const value of Object.values( node ) ) {
		if ( Array.isArray( value ) ) {
			if ( value.some( nodeContainsAsyncControl ) ) {
				return true;
			}
		}
		else if ( nodeContainsAsyncControl( value ) ) {
			return true;
		}
	}
	return false;
}
