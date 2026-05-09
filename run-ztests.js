#!/usr/bin/env node
'use strict';

const fs = require( 'node:fs' );
const path = require( 'node:path' );
const vm = require( 'node:vm' );
const {
	ZuzuScript,
	parseTap,
	transpile,
	normalizeTranspilerName,
} = require( './lib/zuzu' );

function parseTranspilerArg( argv ) {
	for ( let i = 0; i < argv.length; i++ ) {
		const arg = argv[i];
		if ( arg === '--transpiler' ) {
			if ( i + 1 >= argv.length ) {
				throw new Error( 'Missing value for --transpiler' );
			}
			return argv[i + 1];
		}
		if ( arg.startsWith( '--transpiler=' ) ) {
			return arg.slice( '--transpiler='.length );
		}
	}
	return null;
}

function collectZtests( rootDir ) {
	return collectZtestsWithOptions( rootDir, { includeStd: false } );
}

function collectZtestsWithOptions( rootDir, options = {} ) {
	const includeStd = options.includeStd === true;
	const out = [];
	for ( const entry of fs.readdirSync( rootDir, { withFileTypes: true } ) ) {
		const full = path.join( rootDir, entry.name );
		if ( entry.isDirectory() ) {
			out.push( ...collectZtestsWithOptions( full, options ) );
			continue;
		}
		if ( !entry.isFile() || !full.endsWith( '.zzs' ) ) {
			continue;
		}
		const isStd = full.includes( `${path.sep}std${path.sep}` );
		if ( includeStd || !isStd ) {
			out.push( full );
		}
	}
	return out.sort();
}


const repoRoot = path.resolve( __dirname, '..', '..' );
process.chdir( repoRoot );
const ztestsDir = path.join( repoRoot, 't', 'ztests' );
let selectedTranspiler = parseTranspilerArg( process.argv );
if ( selectedTranspiler != null ) {
	try {
		selectedTranspiler = normalizeTranspilerName( selectedTranspiler );
	}
	catch ( err ) {
		console.error( err.message );
		process.exit( 2 );
	}
}
const runtime = new ZuzuScript( {
	repoRoot,
	transpiler: selectedTranspiler,
} );
const includeStdTests = process.argv.includes( '--include-std' ) || process.env.ZUZU_JS_INCLUDE_STD === '1';
const ztests = collectZtestsWithOptions( ztestsDir, { includeStd: includeStdTests } );
const unsupportedFiles = new Set( [ 't/ztests/perl.zzs' ] );
const dumpRequested = process.argv.includes( '--dump-transpiled' ) || process.env.ZUZU_JS_DUMP_TRANSPILED === '1';
const dumpRoot = process.env.ZUZU_JS_DUMP_DIR || path.join( '/tmp', 'zuzu-js-transpiled' );
const jsonSummaryPathArgIndex = process.argv.indexOf( '--json-summary' );
const jsonSummaryPath = jsonSummaryPathArgIndex >= 0
	? process.argv[ jsonSummaryPathArgIndex + 1 ]
	: process.env.ZUZU_JS_SUMMARY_JSON;
const milestoneTargets = new Map( [
	[ 'A', 20 ],
	[ 'B', 30 ],
	[ 'C', 40 ],
	[ 'D', 52 ],
] );
const requestedMilestone = ( process.env.ZUZU_JS_MILESTONE || '' ).toUpperCase();
const failOnMilestoneMiss = process.argv.includes( '--fail-on-milestone-miss' ) || process.env.ZUZU_JS_FAIL_ON_MILESTONE_MISS === '1';

if ( requestedMilestone && !milestoneTargets.has( requestedMilestone ) ) {
	console.error( `Unknown milestone "${requestedMilestone}". Expected one of A, B, C, D.` );
	process.exit( 2 );
}

if ( jsonSummaryPathArgIndex >= 0 && typeof jsonSummaryPath !== 'string' ) {
	console.error( '--json-summary requires a file path or "-" for stdout.' );
	process.exit( 2 );
}

function transpiledPath( rel ) {
	return path.join( dumpRoot, rel.replace( /\.zzs$/g, '.js' ) );
}

function dumpTranspiled( rel, jsCode ) {
	if ( !dumpRequested ) {
		return;
	}
	const outPath = transpiledPath( rel );
	fs.mkdirSync( path.dirname( outPath ), { recursive: true } );
	fs.writeFileSync( outPath, jsCode, 'utf8' );
}

if ( ztests.length === 0 ) {
	console.error( 'No .zzs tests found.' );
	process.exit( 1 );
}

( async () => {
let failedFiles = 0;
let passedFiles = 0;
let skippedFiles = 0;
const fileOutcomes = [];
for ( const testFile of ztests ) {
	const rel = path.relative( repoRoot, testFile );
	if ( unsupportedFiles.has( rel ) ) {
		skippedFiles++;
		fileOutcomes.push( {
			file: rel,
			outcome: 'skipped',
			reason: 'unsupported Perl interop in JS runtime',
		} );
		console.log( `ok - ${rel} (skipped: unsupported Perl interop in JS runtime)` );
		continue;
	}
	const source = fs.readFileSync( testFile, 'utf8' );
	let jsCode;
	try {
		jsCode = transpile( source, {
			transpiler: runtime.transpiler,
		} );
	}
	catch ( err ) {
		failedFiles++;
		console.error( `not ok - ${rel} (transpile threw)` );
		console.error( `${err.name}: ${err.message}` );
		fileOutcomes.push( {
			file: rel,
			outcome: 'failed',
			reason: 'transpile threw',
			detail: `${err.name}: ${err.message}`,
		} );
		continue;
	}
	try {
		new vm.Script( jsCode, { filename: rel } );
	}
	catch ( err ) {
		failedFiles++;
		dumpTranspiled( rel, jsCode );
		const where = ( err.lineNumber && err.columnNumber )
			? `${rel}:${err.lineNumber}:${err.columnNumber}`
			: rel;
		console.error( `not ok - ${rel} (transpile syntax check failed at ${where})` );
		console.error( `${err.name}: ${err.message}` );
		fileOutcomes.push( {
			file: rel,
			outcome: 'failed',
			reason: 'transpile syntax check failed',
			detail: `${err.name}: ${err.message}`,
		} );
		continue;
	}
	const result = await Promise.resolve( runtime.runFile( testFile ) );
	if ( result.status !== 0 ) {
		failedFiles++;
		dumpTranspiled( rel, jsCode );
		console.error( `not ok - ${rel} (exit ${result.status})` );
		if ( result.stderr ) {
			console.error( result.stderr.trimEnd() );
		}
		fileOutcomes.push( {
			file: rel,
			outcome: 'failed',
			reason: 'runtime exited non-zero',
			detail: `exit ${result.status}`,
		} );
		continue;
	}
	const tap = parseTap( result.stdout );
	if ( tap.failures > 0 || !tap.validPlan || tap.tests === 0 ) {
		failedFiles++;
		dumpTranspiled( rel, jsCode );
		console.error( `not ok - ${rel} (tap failures=${tap.failures}, tests=${tap.tests}, planned=${tap.planned})` );
		fileOutcomes.push( {
			file: rel,
			outcome: 'failed',
			reason: 'tap assertions failed or invalid plan',
			detail: `tap failures=${tap.failures}, tests=${tap.tests}, planned=${tap.planned}`,
		} );
		continue;
	}
	passedFiles++;
	fileOutcomes.push( {
		file: rel,
		outcome: 'passed',
		reason: 'tap passed',
		detail: `${tap.tests} tests`,
	} );
	console.log( `ok - ${rel} (${tap.tests} tests)` );
}

const totalFiles = ztests.length;
const countedPassingFiles = passedFiles + skippedFiles;
const passRate = totalFiles > 0
	? ( ( countedPassingFiles / totalFiles ) * 100 ).toFixed( 1 )
	: '0.0';
const summary = {
	includeStd: includeStdTests,
	totalFiles,
	passedFiles,
	skippedFiles,
	failedFiles,
	countedPassingFiles,
	passRate: Number.parseFloat( passRate ),
	files: fileOutcomes,
	milestones: [ ...milestoneTargets.entries() ].map( ( [ name, target ] ) => ( {
		name,
		target,
		reached: countedPassingFiles >= target,
	} ) ),
};

if ( typeof jsonSummaryPath === 'string' ) {
	const payload = `${JSON.stringify( summary, null, 2 )}\n`;
	if ( jsonSummaryPath === '-' ) {
		console.log( payload );
	}
	else {
		const summaryAbs = path.isAbsolute( jsonSummaryPath )
			? jsonSummaryPath
			: path.join( process.cwd(), jsonSummaryPath );
		fs.mkdirSync( path.dirname( summaryAbs ), { recursive: true } );
		fs.writeFileSync( summaryAbs, payload, 'utf8' );
		console.log( `JSON summary written to ${summaryAbs}` );
	}
}

console.error( '\nMilestones:' );
for ( const [ name, target ] of milestoneTargets ) {
	const reached = countedPassingFiles >= target;
	const marker = reached ? 'ok' : 'not ok';
	console.error( `${marker} - milestone ${name} (${countedPassingFiles}/${totalFiles}, target ${target})` );
}

if ( requestedMilestone ) {
	const target = milestoneTargets.get( requestedMilestone );
	if ( countedPassingFiles >= target ) {
		console.log( `Milestone gate passed: ${requestedMilestone} (${countedPassingFiles}/${totalFiles}).` );
	}
	else {
		const msg = `Milestone gate not met: ${requestedMilestone} requires ${target}, got ${countedPassingFiles} out of ${totalFiles}.`;
		if ( failOnMilestoneMiss ) {
			console.error( msg );
			process.exit( 1 );
		}
		console.error( msg );
	}
}

if ( failedFiles > 0 ) {
	if ( dumpRequested ) {
		console.error( `Transpiled outputs for failures written to ${dumpRoot}` );
	}
	console.error( `Passing summary: passed=${passedFiles}, skipped=${skippedFiles}, failed=${failedFiles}, pass-rate=${passRate}%` );
	console.error( `\n${failedFiles} ${includeStdTests ? '' : 'non-stdlib '}ztests failed.` );
	process.exit( 1 );
}

console.log( `\nAll ${totalFiles} ${includeStdTests ? '' : 'non-stdlib '}ztests passed.` );
console.log( `Passing summary: passed=${passedFiles}, skipped=${skippedFiles}, failed=${failedFiles}, pass-rate=${passRate}%` );
} )().catch( (err) => {
	console.error( err && err.stack ? err.stack : String( err ) );
	process.exit( 1 );
} );
