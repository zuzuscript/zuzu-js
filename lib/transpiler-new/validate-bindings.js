'use strict';

const { TranspilerSyntaxError } = require( './errors' );

class Scope {
	constructor( parent = null ) {
		this.parent = parent;
		this.bindings = new Map();
	}

	declare( name, mutable, node ) {
		if ( !name ) {
			return;
		}
		if ( this.bindings.has( name ) ) {
			throw syntaxError( `Redeclaration of '${name}' in the same scope`, node );
		}
		this.bindings.set( name, { mutable } );
	}

	lookup( name ) {
		if ( this.bindings.has( name ) ) {
			return this.bindings.get( name );
		}
		return this.parent ? this.parent.lookup( name ) : null;
	}
}

function tokenFor( node ) {
	const start = node && node.loc && node.loc.start;
	if ( !start ) {
		return null;
	}
	return {
		line: start.line,
		column: start.column,
	};
}

function syntaxError( message, node ) {
	return new TranspilerSyntaxError( message, tokenFor( node ) );
}

function validateBindings( ast ) {
	const scope = new Scope();
	for ( const name of [
		'__argc__',
		'__file__',
		'__global__',
		'__system__',
	] ) {
		scope.declare( name, false, null );
	}
	validateStatements( ast.body || [], scope );
	return ast;
}

function validateStatements( statements, scope ) {
	for ( const statement of statements || [] ) {
		validateStatement( statement, scope );
	}
}

function validateStatement( node, scope ) {
	if ( !node ) {
		return;
	}

	switch ( node.type ) {
		case 'BlockStatement':
			validateStatements( node.body, new Scope( scope ) );
			return;
		case 'VariableDeclaration':
			validateExpression( node.init, scope );
			scope.declare( node.id && node.id.name, node.kind !== 'const', node );
			return;
		case 'FunctionDeclaration':
			scope.declare( node.id && node.id.name, false, node );
			validateFunctionBody( node, scope );
			return;
		case 'ClassDeclaration':
			scope.declare( node.id && node.id.name, false, node );
			validateClassBody( node, scope );
			return;
		case 'TraitDeclaration':
			scope.declare( node.id && node.id.name, false, node );
			validateTraitBody( node, scope );
			return;
		case 'ForInStatement':
			validateExpression( node.iterable, scope );
			validateForBody( node, scope );
			return;
		case 'ExpressionStatement':
			validateExpression( node.expression, scope );
			return;
		default:
			validateChildNodes( node, scope );
	}
}

function validateForBody( node, scope ) {
	const loopScope = new Scope( scope );
	loopScope.declare(
		node.left && node.left.name,
		node.kind !== 'const',
		node.left || node
	);
	validateStatement( node.body, loopScope );
	validateStatement( node.elseBlock, new Scope( scope ) );
}

function validateFunctionBody( node, parentScope ) {
	const scope = new Scope( parentScope );
	for ( const param of node.params || [] ) {
		if ( param.type === 'Parameter' ) {
			scope.declare( param.name, true, param );
		}
		else if ( param.type === 'SpecialParameter' ) {
			scope.declare( param.leadName, true, param );
			scope.declare( param.name, true, param );
		}
	}
	validateStatements( node.body && node.body.body, scope );
}

function validateClassBody( node, scope ) {
	const classScope = new Scope( scope );
	validateExpression( node.base, scope );
	for ( const trait of node.traits || [] ) {
		validateExpression( trait, scope );
	}
	for ( const entry of node.body || [] ) {
		if ( entry.type === 'FieldDeclaration' ) {
			validateExpression( entry.defaultValue, classScope );
		}
		else if ( entry.type === 'MethodDeclaration' ) {
			validateFunctionBody( entry, classScope );
		}
		else {
			validateStatement( entry, classScope );
		}
	}
}

function validateTraitBody( node, scope ) {
	for ( const entry of node.body || [] ) {
		validateFunctionBody( entry, scope );
	}
}

function validateExpression( node, scope ) {
	if ( !node ) {
		return;
	}

	switch ( node.type ) {
		case 'AssignmentExpression':
			validateExpression( node.right, scope );
			if ( node.left && node.left.type === 'Identifier' ) {
				requireMutable( node.left, scope );
			}
			else {
				validateExpression( node.left, scope );
			}
			return;
		case 'UpdateExpression':
			if ( node.argument && node.argument.type === 'Identifier' ) {
				requireMutable( node.argument, scope );
			}
			else {
				validateExpression( node.argument, scope );
			}
			return;
		case 'FunctionExpression':
			validateFunctionBody( node, scope );
			return;
		default:
			validateChildNodes( node, scope );
	}
}

function requireMutable( node, scope ) {
	const binding = scope.lookup( node.name );
	if ( binding && !binding.mutable ) {
		throw syntaxError( `Cannot assign to const '${node.name}' (compile-time)`, node );
	}
}

function validateChildNodes( node, scope ) {
	if ( !node || typeof node !== 'object' ) {
		return;
	}
	for ( const value of Object.values( node ) ) {
		if ( !value ) {
			continue;
		}
		if ( Array.isArray( value ) ) {
			for ( const item of value ) {
				validateChildNode( item, scope );
			}
		}
		else {
			validateChildNode( value, scope );
		}
	}
}

function validateChildNode( node, scope ) {
	if ( !node || typeof node !== 'object' || typeof node.type !== 'string' ) {
		return;
	}
	if ( node.type.endsWith( 'Statement' ) || node.type.endsWith( 'Declaration' ) ) {
		validateStatement( node, scope );
	}
	else {
		validateExpression( node, scope );
	}
}

module.exports = {
	validateBindings,
};
