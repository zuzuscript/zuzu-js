'use strict';

const fs = require( 'node:fs' );
const path = require( 'node:path' );

const projectRoot = path.resolve( __dirname, '..' );
const jsModuleRoot = path.join( projectRoot, 'modules' );
const pureModuleRoot = path.join( projectRoot, 'stdlib', 'modules' );
const stdlibTestModuleRoot = path.join( projectRoot, 'stdlib', 'test-modules' );
const localTestModuleRoot = path.join( projectRoot, 't', 'modules' );
const languageTestsRoot = path.join( projectRoot, 'languagetests' );
const stdlibTestsRoot = path.join( projectRoot, 'stdlib', 'tests' );
const stdlibFixtureRoot = path.join( projectRoot, 'stdlib', 'test-fixtures' );
const localFixtureRoot = path.join( projectRoot, 't', 'fixtures' );
const distRoot = path.join( projectRoot, 'dist' );
const parentRoot = path.resolve( projectRoot, '..' );

function resolveCompatibilityPath( rawPath ) {
	const text = String( rawPath ?? '' );
	if ( text === '' || fs.existsSync( text ) ) {
		return text;
	}
	const normal = text.replace( /\\/gu, '/' );
	const mappings = [
		{
			prefix: 'extras/zuzu-js/',
			base: projectRoot,
		},
		{
			prefix: 'examples/',
			base: path.join( parentRoot, 'examples' ),
		},
	];
	for ( const mapping of mappings ) {
		if ( normal.startsWith( mapping.prefix ) ) {
			const mapped = path.join(
				mapping.base,
				normal.slice( mapping.prefix.length )
			);
			if ( fs.existsSync( mapped ) || /[*?[]/u.test( normal ) ) {
				return mapped;
			}
		}
	}
	return text;
}

module.exports = {
	projectRoot,
	jsModuleRoot,
	pureModuleRoot,
	stdlibTestModuleRoot,
	localTestModuleRoot,
	languageTestsRoot,
	stdlibTestsRoot,
	stdlibFixtureRoot,
	localFixtureRoot,
	distRoot,
	resolveCompatibilityPath,
};
