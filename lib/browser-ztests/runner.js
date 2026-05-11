'use strict';

( () => {
	const statusEl = document.getElementById( 'status' );
	const summaryEl = document.getElementById( 'summary' );
	const resultsEl = document.getElementById( 'results' );
	const jsonEl = document.getElementById( 'json' );

	function setStatus( text ) {
		if ( statusEl ) {
			statusEl.textContent = text;
		}
	}

	function appendText( parent, text ) {
		parent.appendChild( document.createTextNode( text ) );
	}

	function makeCell( text ) {
		const td = document.createElement( 'td' );
		appendText( td, text );
		return td;
	}

	function updateSummary( matrix, total ) {
		if ( !summaryEl ) {
			return;
		}
		const counts = {
			pass: 0,
			soft_fail: 0,
			hard_fail: 0,
		};
		for ( const entry of Object.values( matrix ) ) {
			const result = entry['JS/Browser'];
			if ( result && counts[result.status] != null ) {
				counts[result.status]++;
			}
		}
		const done = counts.pass + counts.soft_fail + counts.hard_fail;
		summaryEl.textContent = [
			`${done}/${total} complete`,
			`pass ${counts.pass}`,
			`soft fail ${counts.soft_fail}`,
			`hard fail ${counts.hard_fail}`,
		].join( ' | ' );
	}

	function appendResult( test, result ) {
		if ( !resultsEl ) {
			return;
		}
		const tr = document.createElement( 'tr' );
		tr.appendChild( makeCell( test.file ) );

		const statusCell = document.createElement( 'td' );
		const badge = document.createElement( 'span' );
		badge.className = `badge ${result.status}`;
		appendText( badge, result.status );
		statusCell.appendChild( badge );
		tr.appendChild( statusCell );

		tr.appendChild( makeCell( result.reason || '' ) );
		tr.appendChild( makeCell( `${result.elapsed.toFixed( 3 )}s` ) );

		const outputCell = document.createElement( 'td' );
		const details = document.createElement( 'details' );
		const summary = document.createElement( 'summary' );
		appendText( summary, 'output' );
		const pre = document.createElement( 'pre' );
		appendText( pre, result.output || '' );
		details.appendChild( summary );
		details.appendChild( pre );
		outputCell.appendChild( details );
		tr.appendChild( outputCell );

		resultsEl.appendChild( tr );
	}

	function isoNow() {
		return new Date().toISOString().replace( /\.\d{3}Z$/u, 'Z' );
	}

	function assessTap( stdout ) {
		if ( typeof stdout !== 'string' || stdout === '' ) {
			return {
				status: 'hard_fail',
				reason: 'no TAP tests',
			};
		}

		const lines = stdout.split( /\r?\n/u );
		let planned = null;
		let skipAll = false;
		let skipReason = '';
		let testsSeen = 0;
		let invalid = false;
		const notOk = [];

		for ( const line of lines ) {
			const plan = line.match( /^1\.\.([0-9]+)(?:\s*#\s*(SKIP)\b\s*(.*))?\s*$/iu );
			if ( plan ) {
				planned = Number( plan[1] );
				if ( planned === 0 && plan[2] && plan[2].toUpperCase() === 'SKIP' ) {
					skipAll = true;
					skipReason = String( plan[3] || '' );
				}
				continue;
			}
			const test = line.match( /^(not )?ok\b(?:\s+[0-9]+)?(?:\s*-\s*)?(.*)$/u );
			if ( !test ) {
				continue;
			}
			testsSeen++;
			if ( test[1] ) {
				const directive = String( test[2] || '' ).match( /#\s*(TODO|SKIP)\b/iu );
				notOk.push( {
					directive: directive ? directive[1].toUpperCase() : null,
				} );
			}
		}

		if ( testsSeen === 0 ) {
			if ( skipAll ) {
				return {
					status: 'soft_fail',
					reason: skipReason ? `skip: ${skipReason}` : 'skip',
				};
			}
			return {
				status: 'soft_fail',
				reason: 'no tests',
			};
		}
		if ( planned != null && planned !== testsSeen ) {
			invalid = true;
		}
		if ( invalid ) {
			return {
				status: 'hard_fail',
				reason: 'invalid TAP',
			};
		}
		if ( notOk.length === 0 ) {
			return {
				status: 'pass',
				reason: 'ok',
			};
		}
		if ( notOk.every( (item) => item.directive === 'TODO' || item.directive === 'SKIP' ) ) {
			return {
				status: 'soft_fail',
				reason: 'todo/skip in TAP',
			};
		}
		return {
			status: 'hard_fail',
			reason: 'not ok in TAP',
		};
	}

	function timeoutPromise( seconds ) {
		return new Promise( (resolve) => {
			window.setTimeout( () => resolve( {
				timedOut: true,
			} ), seconds * 1000 );
		} );
	}

	function createInlineWorkerFactory() {
		return function inlineWorkerFactory( options = {} ) {
			const source = String( options.source || '' );
			let mainMessageHandler = null;
			let mainErrorHandler = null;
			let terminated = false;
			const workerListeners = new Map();
			const workerGlobal = {
				console,
				TextDecoder,
				TextEncoder,
				URL,
				queueMicrotask: queueMicrotask.bind( window ),
				setTimeout: setTimeout.bind( window ),
				clearTimeout: clearTimeout.bind( window ),
				addEventListener( event, handler ) {
					workerListeners.set( event, handler );
				},
				postMessage( message ) {
					if ( terminated || !mainMessageHandler ) {
						return;
					}
					Promise.resolve().then( () => {
						if ( !terminated ) {
							mainMessageHandler( { data: message } );
						}
					} );
				},
			};
			workerGlobal.self = workerGlobal;
			workerGlobal.globalThis = workerGlobal;
			try {
				Function(
					'workerGlobal',
					`with ( workerGlobal ) { ${source}\n }`
				)( workerGlobal );
			}
			catch ( err ) {
				Promise.resolve().then( () => {
					if ( mainErrorHandler ) {
						mainErrorHandler( err );
					}
				} );
			}
			return {
				addEventListener( event, handler ) {
					if ( event === 'message' ) {
						mainMessageHandler = handler;
					}
					else if ( event === 'error' ) {
						mainErrorHandler = handler;
					}
				},
				postMessage( message ) {
					const handler = workerListeners.get( 'message' )
						|| workerGlobal.onmessage;
					if ( terminated || typeof handler !== 'function' ) {
						return;
					}
					Promise.resolve().then( () => {
						if ( !terminated ) {
							handler( { data: message } );
						}
					} );
				},
				terminate() {
					terminated = true;
				},
			};
		};
	}

	async function runOne( runtime, test, timeoutSeconds ) {
		const started = isoNow();
		const startedTs = performance.now();
		let output = '';
		let status = 'hard_fail';
		let reason = 'unknown';

		try {
			const run = Promise.resolve( runtime.zuzu_run( test.source, {
				filename: `/${test.file}`,
				throwOnError: false,
			} ) );
			const result = await Promise.race( [
				run,
				timeoutPromise( timeoutSeconds ),
			] );
			if ( result && result.timedOut ) {
				reason = `timeout >${timeoutSeconds}s`;
			}
			else {
				output = `${result.stdout || ''}${result.stderr || ''}`;
				const tapAssessment = assessTap( result.stdout || '' );
				status = tapAssessment.status;
				reason = tapAssessment.reason;
				if (
					result.status !== 0
					&& !(
						status === 'soft_fail'
						&& String( reason || '' ).startsWith( 'skip' )
						&& String( result.stderr || '' ).includes(
							String( reason || '' ).replace( /^skip:\s*/u, '' )
						)
					)
				) {
					status = 'hard_fail';
					reason = `exit ${result.status}`;
				}
			}
		}
		catch ( err ) {
			status = 'hard_fail';
			reason = 'exception';
			output = `${err && ( err.stack || err.message ) || err}\n`;
		}

		return {
			status,
			reason,
			output,
			started,
			finished: isoNow(),
			elapsed: ( performance.now() - startedTs ) / 1000,
		};
	}

	async function postResults( matrix ) {
		await fetch( '/__zuzu_browser_ztests/results', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
			},
			body: JSON.stringify( matrix ),
		} );
	}

	async function main() {
		if ( !window.ZuzuBrowser || typeof window.ZuzuBrowser.createBrowserRuntime !== 'function' ) {
			const loadErrors = Array.isArray( window.__zuzuBrowserBundleLoadErrors )
				? window.__zuzuBrowserBundleLoadErrors.filter( Boolean )
				: [];
			throw new Error(
				'ZuzuBrowser bundle did not load' +
				( loadErrors.length > 0 ? `\n${loadErrors.join( '\n' )}` : '' )
			);
		}
		const manifest = await fetch( '/__zuzu_browser_ztests/manifest.json' )
			.then( (res) => res.json() );
		const runtimeOptions = {
			reset: true,
			repoRoot: '/',
			includePaths: [ '/stdlib/test-modules' ],
			executionTimeoutMs: ( manifest.timeoutSeconds || 60 ) * 1000,
			virtualFiles: manifest.virtualFiles || {},
			workerUrl: '/dist/zuzu-browser-worker.js',
			workerFactory: createInlineWorkerFactory(),
		};
		const matrix = {};
		for ( let i = 0; i < manifest.tests.length; i++ ) {
			const test = manifest.tests[i];
			const runtime = window.ZuzuBrowser.createBrowserRuntime( runtimeOptions );
			setStatus( `${i + 1}/${manifest.tests.length} ${test.file}` );
			matrix[test.file] = {
				'JS/Browser': await runOne(
					runtime,
					test,
					manifest.timeoutSeconds || 60,
				),
			};
			appendResult( test, matrix[test.file]['JS/Browser'] );
			updateSummary( matrix, manifest.tests.length );
		}
		setStatus( 'complete' );
		if ( jsonEl ) {
			jsonEl.textContent = JSON.stringify( matrix, null, 2 );
		}
		await postResults( matrix );
	}

	main().catch( async (err) => {
		setStatus( err.stack || err.message );
		await postResults( {
			'__browser_harness__': {
				'JS/Browser': {
					status: 'hard_fail',
					reason: 'harness exception',
					output: `${err.stack || err.message}\n`,
					started: isoNow(),
					finished: isoNow(),
					elapsed: 0,
				},
			},
		} );
	} );
} )();
