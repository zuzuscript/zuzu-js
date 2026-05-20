'use strict';

const { stripPod } = require( '../transpiler-utils' );
const {
	TranspilerSyntaxError,
	UnsupportedSyntaxError,
} = require( './errors' );

const KEYWORDS = new Set( [
	'from',
	'import',
	'as',
	'let',
	'const',
	'function',
	'async',
	'await',
	'spawn',
	'return',
	'if',
	'else',
	'true',
	'false',
	'null',
	'and',
	'or',
	'xor',
	'nand',
	'not',
	// TODO: Remove stale legacy JS-only words that are not current
	// ZuzuScript keywords: contains, difference, elsif, export, foreach,
	// given, isa, my, not_in, our, package, sub, then, use, when.
	'not_in',
	'eq',
	'ne',
	'gt',
	'ge',
	'lt',
	'le',
	'cmp',
	'eqi',
	'nei',
	'gti',
	'gei',
	'lti',
	'lei',
	'cmpi',
	'mod',
	'abs',
	'sqrt',
	'floor',
	'ceil',
	'round',
	'int',
	'length',
	'uc',
	'lc',
	'say',
	'class',
	'trait',
	'try',
	'catch',
	'switch',
	'case',
	'default',
	'for',
	'while',
	'do',
	'fn',
	'next',
	'continue',
	'last',
	'unless',
	'export',
	'die',
	'new',
	'method',
	'static',
	'extends',
	'with',
	'but',
	'super',
	'does',
	'my',
	'our',
	'use',
	'package',
	'given',
	'when',
	'then',
	'elsif',
	'foreach',
	'in',
	'isa',
	'can',
	'does',
	'typeof',
	'debug',
	'warn',
	'assert',
	'throw',
	'sub',
	'union',
	'intersection',
	'difference',
	'subsetof',
	'supersetof',
	'equivalentof',
	'contains',
] );

const SIMPLE_PUNCTUATION = new Set( [ '(', ')', '{', '}', '[', ']', ',', ';', '.' ] );

function decodeSimpleEscape( esc ) {
	switch ( esc ) {
		case 'n':
			return '\n';
		case 'r':
			return '\r';
		case 't':
			return '\t';
		case 'b':
			return '\b';
		case 'f':
			return '\f';
		case '"':
		case '\'':
		case '`':
		case '\\':
			return esc;
		default:
			return null;
	}
}

function decodeUnicodeEscape( digits ) {
	if ( !/^[0-9A-Fa-f]{4}$/u.test( digits ) ) {
		return null;
	}
	return String.fromCharCode( Number.parseInt( digits, 16 ) );
}

function isDigit( ch ) {
	return ch >= '0' && ch <= '9';
}

function isUnicodeLetter( ch ) {
	return ch.toLowerCase() !== ch.toUpperCase();
}

function isIdentifierStart( ch ) {
	return ch === '_' || ch === '$' || isUnicodeLetter( ch );
}

function isIdentifierPart( ch ) {
	return isIdentifierStart( ch ) || isDigit( ch );
}

function decodeBinaryLiteral( literal ) {
	try {
		return Function( `"use strict"; return (${literal});` )();
	}
	catch ( _err ) {
		return literal.slice( 1, -1 );
	}
}

function makeToken( type, value, start, end, source ) {
	return {
		type,
		value,
		start: start.offset,
		end: end.offset,
		line: start.line,
		column: start.column,
		endLine: end.line,
		endColumn: end.column,
		raw: source.slice( start.offset, end.offset ),
	};
}

function readTemplateLiteral( text, start, state ) {
	const parts = [];
	let offset = state.offset;
	let line = state.line;
	let column = state.column;
	const delimiter = text.slice( start.offset, start.offset + 3 ) === '```'
		? '```'
		: '`';

	function peek( n = 0 ) {
		return text[offset + n] || '';
	}

	function advance() {
		const ch = text[offset] || '';
		offset++;
		if ( ch === '\n' ) {
			line++;
			column = 1;
		}
		else {
			column++;
		}
		return ch;
	}

	function cursor() {
		return { offset, line, column };
	}

	function skipQuoted() {
		const quote = advance();
		while ( offset < text.length ) {
			const ch = advance();
			if ( ch === '\\' ) {
				advance();
				continue;
			}
			if ( ch === quote ) {
				return;
			}
		}
		throw new TranspilerSyntaxError( 'Unterminated quoted section in template literal' );
	}

	function skipLineComment() {
		advance();
		advance();
		while ( offset < text.length && peek() !== '\n' ) {
			advance();
		}
	}

	function skipBlockComment() {
		advance();
		advance();
		while ( offset < text.length ) {
			if ( peek() === '*' && peek( 1 ) === '/' ) {
				advance();
				advance();
				return;
			}
			advance();
		}
		throw new TranspilerSyntaxError( 'Unterminated block comment in template literal' );
	}

	let textPart = '';
	for ( let i = 0; i < delimiter.length; i++ ) {
		advance();
	}
	while ( offset < text.length ) {
		const ch = peek();
		if (
			delimiter === '```'
				? text.slice( offset, offset + 3 ) === '```'
				: ch === '`'
		) {
			if ( textPart.length > 0 ) {
				parts.push( {
					type: 'text',
					value: textPart,
				} );
			}
			for ( let i = 0; i < delimiter.length; i++ ) {
				advance();
			}
			return {
				parts,
				end: cursor(),
			};
		}
		if ( ch === '\\' ) {
			advance();
			const escStart = cursor();
			const esc = advance();
			if ( esc === 'x' ) {
				const hi = advance();
				const lo = advance();
				if ( !/[0-9A-Fa-f]/.test( hi ) || !/[0-9A-Fa-f]/.test( lo ) ) {
					throw new TranspilerSyntaxError(
						'Invalid hex escape sequence',
						makeToken( 'escape', `x${hi}${lo}`, escStart, cursor(), text )
					);
				}
				textPart += String.fromCharCode( Number.parseInt( `${hi}${lo}`, 16 ) );
				continue;
			}
			if ( esc === 'u' ) {
				const digits = advance() + advance() + advance() + advance();
				const decoded = decodeUnicodeEscape( digits );
				if ( decoded == null ) {
					throw new TranspilerSyntaxError(
						'Invalid unicode escape sequence',
						makeToken( 'escape', `u${digits}`, escStart, cursor(), text )
					);
				}
				textPart += decoded;
				continue;
			}
			const decoded = decodeSimpleEscape( esc );
			if ( decoded == null ) {
				textPart += esc;
			}
			else {
				textPart += decoded;
			}
			continue;
		}
		if ( ch === '$' && peek( 1 ) === '{' ) {
			if ( textPart.length > 0 ) {
				parts.push( {
					type: 'text',
					value: textPart,
				} );
				textPart = '';
			}
			advance();
			advance();
			const exprStart = offset;
			let depth = 1;
			while ( offset < text.length ) {
				if ( peek() === '"' || peek() === '\'' || peek() === '`' ) {
					skipQuoted();
					continue;
				}
				if ( peek() === '/' && peek( 1 ) === '/' ) {
					skipLineComment();
					continue;
				}
				if ( peek() === '/' && peek( 1 ) === '*' ) {
					skipBlockComment();
					continue;
				}
				const cur = advance();
				if ( cur === '{' ) {
					depth++;
				}
				else if ( cur === '}' ) {
					depth--;
					if ( depth === 0 ) {
						parts.push( {
							type: 'expr',
							value: text.slice( exprStart, offset - 1 ),
						} );
						break;
					}
				}
			}
			if ( depth !== 0 ) {
				throw new TranspilerSyntaxError( 'Unterminated template interpolation' );
			}
			continue;
		}
		textPart += advance();
	}
	throw new TranspilerSyntaxError( 'Unterminated template literal', makeToken( 'template', '', start, cursor(), text ) );
}

function tokenize( source ) {
	const text = stripPod( String( source ?? '' ) );
	const tokens = [];
	let lastToken = null;
	let offset = 0;
	let line = 1;
	let column = 1;

	function cursor() {
		return { offset, line, column };
	}

	function peek( n = 0 ) {
		return text[offset + n] || '';
	}

	function advance() {
		const ch = text[offset] || '';
		offset++;
		if ( ch === '\n' ) {
			line++;
			column = 1;
		}
		else {
			column++;
		}
		return ch;
	}

	function addToken( type, value, start, end ) {
		const token = makeToken( type, value, start, end, text );
		tokens.push( token );
		lastToken = token;
	}

	function canStartRegex() {
		if ( !lastToken ) {
			return true;
		}
		if ( lastToken.type === 'punctuation' && [ '(', '[', '{', ',', ';' ].includes( lastToken.value ) ) {
			return true;
		}
		if ( lastToken.type === 'operator' ) {
			return true;
		}
		if ( lastToken.type === 'keyword' && [ 'return', 'case', 'if', 'while', 'throw', 'and', 'or', 'xor', 'nand', 'not' ].includes( lastToken.value ) ) {
			return true;
		}
		return false;
	}

	while ( offset < text.length ) {
		const ch = peek();

		if ( offset === 0 && ch === '#' && peek( 1 ) === '!' ) {
			advance();
			advance();
			while ( offset < text.length && peek() !== '\n' ) {
				advance();
			}
			continue;
		}

		if ( ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' ) {
			advance();
			continue;
		}

		if ( ch === '/' && peek( 1 ) === '/' ) {
			while ( offset < text.length && peek() !== '\n' ) {
				advance();
			}
			continue;
		}

		if ( ch === '/' && peek( 1 ) === '*' ) {
			advance();
			advance();
			while ( offset < text.length && !( peek() === '*' && peek( 1 ) === '/' ) ) {
				advance();
			}
			if ( offset >= text.length ) {
				throw new TranspilerSyntaxError( 'Unterminated block comment' );
			}
			advance();
			advance();
			continue;
		}

		const start = cursor();

		if ( ch === '/' && peek( 1 ) !== '/' && peek( 1 ) !== '*' && canStartRegex() ) {
			let pattern = '';
			advance();
			while ( offset < text.length ) {
				const cur = peek();
				if ( cur === '\\' ) {
					pattern += advance();
					pattern += advance();
					continue;
				}
				if ( cur === '/' ) {
					break;
				}
				if ( cur === '\n' ) {
					throw new TranspilerSyntaxError( 'Unterminated regexp literal' );
				}
				pattern += advance();
			}
			if ( peek() !== '/' ) {
				throw new TranspilerSyntaxError( 'Unterminated regexp literal' );
			}
			advance();
			let flags = '';
			while ( /[a-z]/i.test( peek() ) ) {
				flags += advance();
			}
			addToken( 'regexp', { pattern, flags }, start, cursor() );
			continue;
		}

		if ( ch === '"' ) {
			if ( peek( 1 ) === '"' && peek( 2 ) === '"' ) {
				let value = '';
				advance();
				advance();
				advance();
				while ( offset < text.length ) {
					if ( peek() === '"' && peek( 1 ) === '"' && peek( 2 ) === '"' ) {
						advance();
						advance();
						advance();
						addToken( 'string', value, start, cursor() );
						value = null;
						break;
					}
					value += advance();
				}
				if ( value !== null ) {
					throw new TranspilerSyntaxError( 'Unterminated triple-quoted string literal' );
				}
				continue;
			}
			let value = '';
			advance();
			while ( offset < text.length && peek() !== '"' ) {
				if ( peek() === '\\' ) {
					const escStart = cursor();
					advance();
					const esc = advance();
					if ( esc === 'x' ) {
						const hi = advance();
						const lo = advance();
						if ( !/[0-9A-Fa-f]/.test( hi ) || !/[0-9A-Fa-f]/.test( lo ) ) {
							throw new TranspilerSyntaxError(
								'Invalid hex escape sequence',
								makeToken( 'escape', `x${hi}${lo}`, escStart, cursor(), text )
							);
						}
						value += String.fromCharCode( Number.parseInt( `${hi}${lo}`, 16 ) );
					}
					else if ( esc === 'u' ) {
						const digits = advance() + advance() + advance() + advance();
						const decoded = decodeUnicodeEscape( digits );
						if ( decoded == null ) {
							throw new TranspilerSyntaxError(
								'Invalid unicode escape sequence',
								makeToken( 'escape', `u${digits}`, escStart, cursor(), text )
							);
						}
						value += decoded;
					}
					else {
						const decoded = decodeSimpleEscape( esc );
						if ( decoded == null ) {
							throw new TranspilerSyntaxError(
								`Unsupported escape sequence \\${esc}`,
								makeToken( 'escape', esc, escStart, cursor(), text )
							);
						}
						value += decoded;
					}
					continue;
				}
				value += advance();
			}
			if ( peek() !== '"' ) {
				throw new TranspilerSyntaxError( 'Unterminated string literal' );
			}
			advance();
			addToken( 'string', value, start, cursor() );
			continue;
		}

		if ( ch === '\'' ) {
			let literal = advance();
			while ( offset < text.length ) {
				const cur = advance();
				literal += cur;
				if ( cur === '\\' ) {
					if ( offset < text.length ) {
						literal += advance();
					}
					continue;
				}
				if ( cur === '\'' ) {
					break;
				}
			}
			if ( literal[literal.length - 1] !== '\'' ) {
				throw new TranspilerSyntaxError( 'Unterminated binary string literal' );
			}
			addToken( 'binary_string', decodeBinaryLiteral( literal ), start, cursor() );
			continue;
		}

		if ( ch === '`' ) {
			const template = readTemplateLiteral( text, start, cursor() );
			offset = template.end.offset;
			line = template.end.line;
			column = template.end.column;
			addToken( 'template', template.parts, start, template.end );
			continue;
		}

		const twoChar = ch + peek( 1 );
		const threeChar = twoChar + peek( 2 );

		if ( twoChar === '^^' ) {
			advance();
			advance();
			addToken( 'identifier', '^^', start, cursor() );
			continue;
		}

		if ( [ '...', '<<<', '>>>', '**=', '?:=', '<=>' ].includes( threeChar ) ) {
			advance();
			advance();
			advance();
			addToken( 'operator', threeChar, start, cursor() );
			continue;
		}

		if ( [ '{{', '<<', '>>', ':=', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '_=', '++', '--', '->', '?:', '**', '@@', '@?', '~=', '|>', '<|', '⊂⊃', '×=', '÷=' ].includes( twoChar ) ) {
			advance();
			advance();
			addToken( 'operator', twoChar, start, cursor() );
			continue;
		}

		if ( ch === '_' && !isIdentifierPart( peek( 1 ) ) ) {
			advance();
			addToken( 'operator', '_', start, cursor() );
			continue;
		}

		if ( isDigit( ch ) ) {
			let value = '';
			while ( isDigit( peek() ) ) {
				value += advance();
			}
			if ( peek() === '.' && isDigit( peek( 1 ) ) ) {
				value += advance();
				while ( isDigit( peek() ) ) {
					value += advance();
				}
			}
			addToken( 'number', value, start, cursor() );
			continue;
		}

		if ( isIdentifierStart( ch ) ) {
			let value = '';
			while ( isIdentifierPart( peek() ) ) {
				value += advance();
			}
			if ( KEYWORDS.has( value ) ) {
				addToken( 'keyword', value, start, cursor() );
			}
			else {
				addToken( 'identifier', value, start, cursor() );
			}
			continue;
		}

		if ( SIMPLE_PUNCTUATION.has( ch ) ) {
			advance();
			addToken( 'punctuation', ch, start, cursor() );
			continue;
		}

		if ( [ '+', '-', '*', '/', '%', '<', '>', '=', '_', '?', ':', '~', '!', '\\', '&', '|', '^', '@', '×', '÷', '¬', '⋀', '⋁', '⊻', '⊼' ].includes( ch ) ) {
			advance();
			addToken( 'operator', ch, start, cursor() );
			continue;
		}

		if ( [ '≡', '≢', '≠', '≤', '≥', '→', '√', '⌊', '⌋', '⌈', '⌉', '∈', '∉', '⋃', '⋂', '∖', '⊂', '⊃', '«', '»', '≶', '≷', '▷', '◁' ].includes( ch ) ) {
			advance();
			addToken( 'operator', ch, start, cursor() );
			continue;
		}

		throw new UnsupportedSyntaxError(
			`Unsupported character ${JSON.stringify( ch )}`,
			makeToken( 'unsupported', ch, start, start, text )
		);
	}

	const end = cursor();
	tokens.push( makeToken( 'eof', '', end, end, text ) );
	return tokens;
}

module.exports = {
	tokenize,
};
