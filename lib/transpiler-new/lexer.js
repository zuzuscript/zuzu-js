'use strict';

const { stripPod } = require( '../transpiler-utils' );
const {
	TranspilerSyntaxError,
	UnsupportedSyntaxError,
} = require( './errors' );

const UTF8_ENCODER = new TextEncoder();

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
	'nor',
	'xnor',
	'onlyif',
	'butnot',
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
	'divides',
	'intersection',
	'difference',
	'subsetof',
	'supersetof',
	'equivalentof',
	'contains',
] );

const SIMPLE_PUNCTUATION = new Set( [ '(', ')', '{', '}', '[', ']', ',', ';', '.' ] );
const VALUE_PRESERVING_LOGICAL_OPERATORS = new Set( [
	'and',
	'⋀',
	'or',
	'⋁',
	'xor',
	'⊻',
	'xnor',
	'↔',
	'nand',
	'⊼',
	'nor',
	'⊽',
	'onlyif',
	'⊨',
	'butnot',
	'⊭',
] );

function maybeValuePreservingOperator(value, peek, advance) {
	if ( VALUE_PRESERVING_LOGICAL_OPERATORS.has( value ) && peek() === '?' ) {
		advance();
		return `${value}?`;
	}
	return value;
}

function decodeSimpleEscape( esc ) {
	switch ( esc ) {
		case 'n':
			return '\n';
		case 'r':
			return '\r';
		case 't':
			return '\t';
		case '"':
		case '\'':
		case '`':
		case '/':
		case '$':
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
	const code = Number.parseInt( digits, 16 );
	if ( code >= 0xd800 && code <= 0xdfff ) {
		return null;
	}
	return String.fromCodePoint( code );
}

function decodeHexEscape( digits ) {
	if ( !/^[0-9A-Fa-f]{2}$/u.test( digits ) ) {
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

function appendUtf8ByteChars( out, ch ) {
	for ( const byte of UTF8_ENCODER.encode( ch ) ) {
		out.value += String.fromCharCode( byte );
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
		if ( delimiter !== '```' && ch === '\\' ) {
			advance();
			const escStart = cursor();
			const esc = advance();
			if ( esc === 'x' ) {
				const digits = advance() + advance();
				const decoded = decodeHexEscape( digits );
				if ( decoded == null ) {
					throw new TranspilerSyntaxError(
						'Invalid hex escape sequence',
						makeToken( 'escape', `x${digits}`, escStart, cursor(), text )
					);
				}
				textPart += decoded;
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
				throw new TranspilerSyntaxError(
					`Unsupported escape sequence \\${esc}`,
					makeToken( 'escape', esc, escStart, cursor(), text )
				);
			}
			textPart += decoded;
			continue;
		}
		if ( delimiter !== '```' && ch === '\n' ) {
			throw new TranspilerSyntaxError( 'Unterminated template literal', makeToken( 'template', '', start, cursor(), text ) );
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
		if (
			lastToken.type === 'keyword'
			&& [
				'return', 'case', 'if', 'while', 'throw',
				'and', 'and?', 'or', 'or?', 'xor', 'xor?', 'xnor', 'xnor?',
				'nand', 'nand?', 'nor', 'nor?', 'onlyif', 'onlyif?',
				'butnot', 'butnot?', 'not',
			].includes( lastToken.value )
		) {
			return true;
		}
		return false;
	}

	function readInterpolationSource() {
		advance();
		advance();
		const exprStart = offset;
		let depth = 1;
		while ( offset < text.length ) {
			if ( peek() === '"' || peek() === '\'' || peek() === '`' ) {
				const quote = advance();
				while ( offset < text.length ) {
					const ch = advance();
					if ( ch === '\\' ) {
						advance();
						continue;
					}
					if ( ch === quote ) {
						break;
					}
				}
				continue;
			}
			if ( peek() === '/' && peek( 1 ) === '/' ) {
				advance();
				advance();
				while ( offset < text.length && peek() !== '\n' ) {
					advance();
				}
				continue;
			}
			if ( peek() === '/' && peek( 1 ) === '*' ) {
				advance();
				advance();
				while ( offset < text.length ) {
					if ( peek() === '*' && peek( 1 ) === '/' ) {
						advance();
						advance();
						break;
					}
					advance();
				}
				continue;
			}
			const cur = advance();
			if ( cur === '{' ) {
				depth++;
			}
			else if ( cur === '}' ) {
				depth--;
				if ( depth === 0 ) {
					return text.slice( exprStart, offset - 1 );
				}
			}
		}
		throw new TranspilerSyntaxError( 'Unterminated template interpolation' );
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
			let textPart = '';
			const parts = [];
			let inClass = false;
			let sawInterpolation = false;
			advance();
			while ( offset < text.length ) {
				const cur = peek();
				if ( cur === '\\' ) {
					const backslash = advance();
					const escaped = advance();
					pattern += backslash + escaped;
					textPart += backslash + escaped;
					continue;
				}
				if ( cur === '[' ) {
					inClass = true;
				}
				else if ( cur === ']' ) {
					inClass = false;
				}
				if ( cur === '$' && peek( 1 ) === '{' ) {
					if ( textPart.length > 0 ) {
						parts.push( {
							type: 'text',
							value: textPart,
						} );
						textPart = '';
					}
					const expr = readInterpolationSource();
					parts.push( {
						type: 'expr',
						value: expr,
					} );
					sawInterpolation = true;
					pattern += `\${${expr}}`;
					continue;
				}
				if ( cur === '/' && !inClass ) {
					break;
				}
				if ( cur === '\n' ) {
					throw new TranspilerSyntaxError( 'Unterminated regexp literal' );
				}
				const value = advance();
				pattern += value;
				textPart += value;
			}
			if ( peek() !== '/' ) {
				throw new TranspilerSyntaxError( 'Unterminated regexp literal' );
			}
			advance();
			let flags = '';
			while ( /[a-z]/i.test( peek() ) ) {
				flags += advance();
			}
			if ( sawInterpolation && textPart.length > 0 ) {
				parts.push( {
					type: 'text',
					value: textPart,
				} );
			}
			addToken( 'regexp', { pattern, parts, flags }, start, cursor() );
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
						const digits = advance() + advance();
						const decoded = decodeHexEscape( digits );
						if ( decoded == null ) {
							throw new TranspilerSyntaxError(
								'Invalid hex escape sequence',
								makeToken( 'escape', `x${digits}`, escStart, cursor(), text )
							);
						}
						value += decoded;
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
				if ( peek() === '\n' ) {
					throw new TranspilerSyntaxError( 'Unterminated string literal' );
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
			if ( peek( 1 ) === '\'' && peek( 2 ) === '\'' ) {
				const out = { value: '' };
				advance();
				advance();
				advance();
				while ( offset < text.length ) {
					if ( peek() === '\'' && peek( 1 ) === '\'' && peek( 2 ) === '\'' ) {
						advance();
						advance();
						advance();
						addToken( 'binary_string', out.value, start, cursor() );
						out.value = null;
						break;
					}
					appendUtf8ByteChars( out, advance() );
				}
				if ( out.value !== null ) {
					throw new TranspilerSyntaxError( 'Unterminated triple-quoted binary string literal' );
				}
				continue;
			}
			let value = '';
			advance();
			while ( offset < text.length && peek() !== '\'' ) {
				if ( peek() === '\\' ) {
					const escStart = cursor();
					advance();
					const esc = advance();
					if ( esc === 'u' ) {
						throw new TranspilerSyntaxError(
							'Unicode escapes are not supported in binary strings',
							makeToken( 'escape', esc, escStart, cursor(), text )
						);
					}
					if ( esc === 'x' ) {
						const digits = advance() + advance();
						const decoded = decodeHexEscape( digits );
						if ( decoded == null ) {
							throw new TranspilerSyntaxError(
								'Invalid hex escape sequence',
								makeToken( 'escape', `x${digits}`, escStart, cursor(), text )
							);
						}
						value += decoded;
						continue;
					}
					const decoded = decodeSimpleEscape( esc );
					if ( decoded == null ) {
						throw new TranspilerSyntaxError(
							`Unsupported escape sequence \\${esc}`,
							makeToken( 'escape', esc, escStart, cursor(), text )
						);
					}
					value += decoded;
					continue;
				}
				if ( peek() === '\n' ) {
					throw new TranspilerSyntaxError( 'Unterminated binary string literal' );
				}
				const out = { value: '' };
				appendUtf8ByteChars( out, advance() );
				value += out.value;
			}
			if ( peek() !== '\'' ) {
				throw new TranspilerSyntaxError( 'Unterminated binary string literal' );
			}
			advance();
			addToken( 'binary_string', value, start, cursor() );
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
			// Radix-prefixed integers: 0x… hex, 0b… binary, 0o… octal.
			// Lowercase prefixes only; the token value is normalised to
			// decimal so later stages treat it as a plain number.
			const radixDigitOk = ch === '0'
				? ( peek( 1 ) === 'x'
					? (c) => /[0-9a-fA-F]/.test( c || '' )
					: peek( 1 ) === 'b'
						? (c) => c === '0' || c === '1'
						: peek( 1 ) === 'o'
							? (c) => /[0-7]/.test( c || '' )
							: null )
				: null;
			if ( radixDigitOk && radixDigitOk( peek( 2 ) ) ) {
				const radix = peek( 1 ) === 'x' ? 16 : peek( 1 ) === 'b' ? 2 : 8;
				advance();
				advance();
				let digits = '';
				while ( radixDigitOk( peek() ) ) {
					digits += advance();
				}
				addToken( 'number', String( parseInt( digits, radix ) ), start, cursor() );
				continue;
			}
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
			// Exponent: uppercase E only (lowercase e is not part of
			// the language).
			if (
				peek() === 'E'
				&& ( isDigit( peek( 1 ) )
					|| ( ( peek( 1 ) === '+' || peek( 1 ) === '-' ) && isDigit( peek( 2 ) ) ) )
			) {
				value += advance();
				if ( peek() === '+' || peek() === '-' ) {
					value += advance();
				}
				while ( isDigit( peek() ) ) {
					value += advance();
				}
			}
			addToken( 'number', value, start, cursor() );
			continue;
		}

		if ( ch === '⊤' || ch === '⊥' ) {
			advance();
			addToken( 'keyword', ch === '⊤' ? 'true' : 'false', start, cursor() );
			continue;
		}

		if ( isIdentifierStart( ch ) ) {
			let value = '';
			while ( isIdentifierPart( peek() ) ) {
				value += advance();
			}
			if ( KEYWORDS.has( value ) ) {
				value = maybeValuePreservingOperator( value, peek, advance );
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

		if ( [ '+', '-', '*', '/', '%', '<', '>', '=', '_', '?', ':', '~', '!', '\\', '&', '|', '^', '@', '×', '÷', '¬', '⋀', '⋁', '⊻', '⊼', '⊽', '↔', '⊨', '⊭' ].includes( ch ) ) {
			advance();
			const value = maybeValuePreservingOperator( ch, peek, advance );
			addToken( 'operator', value, start, cursor() );
			continue;
		}

		if ( [ '≡', '≢', '≠', '≤', '≥', '→', '√', '⌊', '⌋', '⌈', '⌉', '∈', '∉', '⋃', '⋂', '∖', '⊂', '⊃', '«', '»', '≶', '≷', '▷', '◁', '∣', '∤' ].includes( ch ) ) {
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
