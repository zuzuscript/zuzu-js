'use strict';

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
};
