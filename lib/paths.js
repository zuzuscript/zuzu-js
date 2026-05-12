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

function resolveFromBase( rawPath, baseDir = process.cwd() ) {
	return path.resolve( baseDir, String( rawPath ?? '' ) );
}

function existingDirectory( rawPath ) {
	if ( !rawPath ) {
		return null;
	}
	const resolved = resolveFromBase( rawPath );
	return fs.existsSync( resolved ) && fs.statSync( resolved ).isDirectory()
		? resolved
		: null;
}

function userModulesDir() {
	if ( process.platform === 'win32' ) {
		return existingDirectory(
			process.env.LOCALAPPDATA
				? path.join( process.env.LOCALAPPDATA, 'Zuzu', 'modules' )
				: null
		);
	}
	return existingDirectory(
		process.env.HOME
			? path.join( process.env.HOME, '.zuzu', 'modules' )
			: null
	);
}

function systemModulesDir() {
	if ( process.platform === 'win32' ) {
		return existingDirectory(
			process.env.ProgramData
				? path.join( process.env.ProgramData, 'Zuzu', 'modules' )
				: null
		);
	}
	return existingDirectory( '/var/lib/zuzu/modules' );
}

function dedupePaths( paths ) {
	const seen = new Set();
	const out = [];
	for ( const rawPath of paths ) {
		if ( !rawPath || seen.has( rawPath ) ) {
			continue;
		}
		seen.add( rawPath );
		out.push( rawPath );
	}
	return out;
}

function defaultModuleSearchRoots( {
	includePaths = [],
	packageRoot = projectRoot,
	initialCwd = process.cwd(),
} = {} ) {
	const roots = includePaths.map( (item) => resolveFromBase( item, initialCwd ) );
	if ( process.env.ZUZULIB ) {
		roots.push(
			...process.env.ZUZULIB
				.split( path.delimiter )
				.filter( Boolean )
				.map( (item) => resolveFromBase( item, initialCwd ) )
		);
	}

	const userDir = userModulesDir();
	if ( userDir ) {
		roots.push( userDir );
	}

	const systemDir = systemModulesDir();
	if ( systemDir ) {
		roots.push( systemDir );
	}

	if ( process.env.ZUZU_STDLIB ) {
		roots.push( resolveFromBase( process.env.ZUZU_STDLIB, initialCwd ) );
	}
	else {
		roots.push( path.resolve( packageRoot, 'stdlib', 'modules' ) );
	}

	return dedupePaths( roots );
}

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
	defaultModuleSearchRoots,
	resolveFromBase,
	resolveCompatibilityPath,
};
