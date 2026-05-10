'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const projectPaths = require( '../lib/paths' );

const repoRoot = projectPaths.projectRoot;
const projectRoot = repoRoot;
const packageJson = JSON.parse(
	fs.readFileSync( path.join( projectRoot, 'package.json' ), 'utf8' )
);

assert.equal( packageJson.bin['zuzu-js'], 'bin/zuzu-js' );
assert.equal( packageJson.bin['zuzu-js-compile'], 'bin/zuzu-js-compile' );
assert.equal( packageJson.bin['zuzu-js-electron'], 'bin/zuzu-js-electron' );
assert.match( packageJson.scripts['test:electron'], /electron-gui\.js/ );
assert.match( packageJson.scripts['test:electron'], /electron-renderer\.js/ );
assert.match( packageJson.scripts['electron:demo'], /zuzu-js-electron/ );

for ( const rel of [
	'bin/zuzu-js',
	'bin/zuzu-js-electron',
	'lib/electron/main.js',
	'lib/electron/preload.js',
	'lib/electron/renderer.html',
	'lib/electron/renderer.js',
	'lib/gui/dom-renderer.js',
] ) {
	assert.ok( fs.existsSync( path.join( projectRoot, rel ) ), `${rel} exists` );
}

const packagingDocPath = path.join( repoRoot, 'docs', 'gui-electron-packaging.md' );
if ( fs.existsSync( packagingDocPath ) ) {
	const packagingDoc = fs.readFileSync( packagingDocPath, 'utf8' );
	assert.match( packagingDoc, /zuzu-js --electron/ );
	assert.match( packagingDoc, /contextIsolation/ );
	assert.match( packagingDoc, /Linux/ );
	assert.match( packagingDoc, /macOS/ );
	assert.match( packagingDoc, /Windows/ );
}

console.log( 'electron packaging tests passed' );
