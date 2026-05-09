'use strict';

const assert = require( 'node:assert/strict' );
const { createNodeRuntime } = require( '../lib/runtime-entrypoints' );
const taskRuntime = require( '../modules/std/task' );

async function run( source, options = {} ) {
	const runtime = createNodeRuntime( {
		debugLevel: options.debugLevel || 0,
	} );
	return Promise.resolve( runtime.runSource( source, {
		filename: options.filename || '/async-parity.zzs',
		scriptArgs: options.scriptArgs || [],
		onStdout: options.onStdout,
		onStderr: options.onStderr,
	} ) );
}

( async () => {
	{
		const events = [];
		const pending = run( `
			from std/task import sleep;

			async function __main__ () {
				say "before";
				await { sleep(0.02); };
				warn "between";
				say "after";
			}
		`, {
			onStdout(chunk) {
				events.push( [ 'stdout', chunk ] );
			},
			onStderr(chunk) {
				events.push( [ 'stderr', chunk ] );
			},
		} );
		await new Promise( (resolve) => setTimeout( resolve, 5 ) );
		assert.deepEqual( events, [ [ 'stdout', 'before\n' ] ] );
		const result = await pending;
		assert.equal( result.status, 0, result.stderr || result.stdout );
		assert.equal( result.stdout, 'before\nafter\n' );
		assert.equal( result.stderr, '' );
		assert.deepEqual( events, [
			[ 'stdout', 'before\n' ],
			[ 'stderr', 'between\n' ],
			[ 'stdout', 'after\n' ],
		] );
	}

	{
		const started = Date.now();
		const result = await run( `
			from std/task import *;
			from std/internals import active_task_count, clear_task_trace, task_trace;
			from std/io import Path;
			from std/proc import Proc;
			from test/more import *;

			clear_task_trace();
			let sleeper := sleep(0.001);
			let expected_file := "/trace-parity.zzs";
			ok( sleeper.id() > 0, "task exposes id" );
			is( sleeper.parent_id(), null, "root task parent id is null" );
			is( sleeper.name(), "sleep", "task exposes scheduler name" );
			is( sleeper.to_String(), "[Task sleeping]", "task string includes status" );
			ok( active_task_count() >= 1, "active task count includes sleeper" );
			await {
				sleeper;
			};
			is( active_task_count(), 0, "active task count cleans up completed task" );
			let trace := task_trace();
			ok(
				trace.grep( function ( event ) {
					return event{name} eq "sleep"
						and event{event} eq "schedule"
						and event{file} eq expected_file
						and event{line} > 0;
				} ).length() >= 1,
				"debug trace records sleep schedule event with source location",
			);
			ok(
				trace.grep( function ( event ) {
					return event{name} eq "sleep" and event{event} eq "cleanup";
				} ).length() >= 1,
				"debug trace records sleep cleanup event",
			);

			let file := Path.tempfile();
			file.spew_utf8("trace");
			clear_task_trace();
			let blocked := spawn {
				file.slurp_utf8();
				Proc.run( "perl", [ "-e", "" ] );
			};
			await {
				blocked;
			};
			trace := task_trace();
			ok(
				trace.grep( function ( event ) {
					return event{event} eq "blocked_operation"
						and event{operation} eq "std/io Path.slurp_utf8"
						and event{file} eq expected_file
						and event{line} > 0;
				} ).length() >= 1,
				"debug trace records blocking std/io operations with source location",
			);
			ok(
				trace.grep( function ( event ) {
					return event{event} eq "blocked_operation"
						and event{operation} eq "std/proc Proc.run"
						and event{file} eq expected_file
						and event{line} > 0;
				} ).length() >= 1,
				"debug trace records blocking std/proc operations with source location",
			);
			done_testing();
		`, { debugLevel: 1, filename: '/trace-parity.zzs' } );
		assert.equal( result.status, 0, result.stderr || result.stdout );
		assert.ok( Date.now() - started < 500, 'detached tasks do not hold run open' );
	}

	{
		const first = await run( `
			from std/task import sleep;
			from test/more import *;

			let task := sleep(0);
			is( task.id(), 1, "first run starts task ids at one" );
			is( task.status(), "sleeping", "zero sleep starts as sleeping" );
			ok( task.poll(), "zero sleep poll completes the task" );
			is( task.status(), "fulfilled", "zero sleep poll marks fulfilled" );
			await {
				task;
			};
			done_testing();
		` );
		assert.equal( first.status, 0, first.stderr || first.stdout );

		const second = await run( `
			from std/task import sleep;
			from test/more import *;

			let task := sleep(0);
			is( task.id(), 1, "second run resets task ids" );
			await {
				task;
			};
			done_testing();
		` );
		assert.equal( second.status, 0, second.stderr || second.stdout );
	}

	{
		const result = await run( `
			from std/task import *;
			from std/internals import active_task_count;
			from test/more import *;

			let ch := new Channel();
			is(
				await {
					ch.send("message");
				},
				"message",
				"channel.send resolves to sent value",
			);

			let all_error := "";
			try {
				await {
					all([1]);
				};
			}
			catch ( Exception e ) {
				all_error := e.to_String();
			}
			like( all_error, /all expects only Task values/, "all rejects non-task values" );

			let race_error := "";
			try {
				await {
					race([]);
				};
			}
			catch ( Exception e ) {
				race_error := e.to_String();
			}
			like( race_error, /race expects at least one task/, "race rejects empty input" );

			let timeout_error := "";
			try {
				await {
					timeout( 0.001, 1 );
				};
			}
			catch ( Exception e ) {
				timeout_error := e.to_String();
			}
			like( timeout_error, /timeout expects a Task/, "timeout rejects non-task value" );

			let fast := await {
				timeout( 1, resolved("fast") );
			};
			is( fast, "fast", "timeout returns fast task result" );
			is( active_task_count(), 0, "timeout cleans up unused timer task" );

			let victim := sleep(1);
			let timeout_typed := false;
			try {
				await {
					timeout( 0.001, victim );
				};
			}
			catch ( TimeoutException e ) {
				timeout_typed := true;
			}
			ok( timeout_typed, "timeout still throws TimeoutException" );
			is( victim.status(), "cancelled", "timeout cancellation marks child cancelled" );
			is( active_task_count(), 0, "timeout cleans up cancelled child task" );

			let watch_error := "";
			try {
				new CancellationSource().token().watch(1);
			}
			catch ( Exception e ) {
				watch_error := e.to_String();
			}
			like(
				watch_error,
				/CancellationToken.watch expects a Task/,
				"CancellationToken.watch rejects non-task values",
			);

			let t := sleep(1);
			t.cancel();
			let cancel_error := "";
			try {
				await {
					t;
				};
			}
			catch ( Exception e ) {
				cancel_error := e.to_String();
			}
			like( cancel_error, /Task cancelled/, "default cancellation message matches Perl" );
			done_testing();
		` );
		assert.equal( result.status, 0, result.stderr || result.stdout );
	}

	{
		const result = await run( `
			from std/task import *;
			from std/internals import clear_task_trace, task_trace;
			from test/more import *;

			async function value () {
				return await {
					resolved("ok");
				};
			}

			class Box {
				async method value () {
					return await {
						resolved("method-ok");
					};
				}
			}

			async function bad_await () {
				return await {
					1;
				};
			}

			clear_task_trace();
			let task := value();
			ok( task instanceof Task, "async function returns a Task" );
			is( task.name(), "value", "async function task uses function name" );
			let trace := task_trace();
			ok(
				trace.grep( function ( event ) {
					return event{event} eq "schedule"
						and event{name} eq "value"
						and event{file} eq "/async-function-trace.zzs"
						and event{line} > 0;
				} ).length() >= 1,
				"async function task trace includes call source location",
			);
			is(
				await {
					task;
				},
				"ok",
				"async function task awaits result",
			);

			let lambda := async fn n -> await {
				resolved(n + 1);
			};
			let lambda_task := lambda(41);
			ok( lambda_task instanceof Task, "async lambda returns a Task" );
			is(
				await {
					lambda_task;
				},
				42,
				"async lambda task awaits result",
			);

			let method_task := new Box().value();
			ok( method_task instanceof Task, "async method returns a Task" );
			is( method_task.name(), "value", "async method task uses method name" );
			is(
				await {
					method_task;
				},
				"method-ok",
				"async method task awaits result",
			);

			let await_error := "";
			try {
				await {
					bad_await();
				};
			}
			catch ( Exception e ) {
				await_error := e.to_String();
			}
			like(
				await_error,
				/await block must return a Task/,
				"await block rejects non-task values",
			);
			done_testing();
		`, { debugLevel: 1, filename: '/async-function-trace.zzs' } );
		assert.equal( result.status, 0, result.stderr || result.stdout );
	}

	{
		const result = await run( `
			from std/proc import Proc, sleep_async;
			from test/more import *;

			async function main () {
				let sleeper := sleep_async(0.001);
				is( sleeper.name(), "proc.sleep_async", "Proc sleep_async task is named" );
				await {
					sleeper;
				};
				let zero_sleep := sleep_async(0);
				is( zero_sleep.status(), "sleeping", "Proc sleep_async zero starts sleeping" );
				ok( zero_sleep.poll(), "Proc sleep_async zero poll completes task" );
				is( zero_sleep.status(), "fulfilled", "Proc sleep_async zero poll marks fulfilled" );

				let timed := await {
					Proc.run_async(
						"perl",
						[ "-e", "select undef,undef,undef,1" ],
						{ timeout: 0.001 },
					);
				};
				is( timed{timed_out}, 1, "Proc.run_async reports timeout" );
				is( timed{signal}, 14, "Proc.run_async timeout uses SIGALRM code" );

				let task := Proc.run_async(
					"perl",
					[ "-e", "select undef,undef,undef,1" ],
				);
				is( task.name(), "proc.run_async", "Proc.run_async task is named" );
				task.cancel();
				let cancel_error := "";
				try {
					await {
						task;
					};
				}
				catch ( Exception e ) {
					cancel_error := e.to_String();
				}
				like(
					cancel_error,
					/Task cancelled/,
					"Proc.run_async task cancellation is observable",
				);

				let pipeline_task := Proc.pipeline_async(
					[
						[ "perl", "-e", "print qq<ok>" ],
						[ "perl", "-pe", "s/ok/OK/" ],
					],
				);
				is(
					pipeline_task.name(),
					"proc.pipeline_async",
					"Proc.pipeline_async task is named",
				);
				let pipeline := await {
					pipeline_task;
				};
				ok( pipeline{ok}, "Proc.pipeline_async still succeeds" );
			}

			await {
				main();
			};
			done_testing();
		` );
		assert.equal( result.status, 0, result.stderr || result.stdout );
	}

	{
		const started = Date.now();
		const result = await run( `
			from std/task import sleep;

			async function main () {
				spawn {
					await {
						sleep(2);
					};
				};
				say("done");
			}

			await {
				main();
			};
		` );
		assert.equal( result.status, 0, result.stderr || result.stdout );
		assert.equal( result.stdout, 'done\n' );
		assert.ok( Date.now() - started < 500, 'shutdown cancels detached sleep task' );
	}

	{
		const result = await run( `
			from std/task import sleep;

			async function __main__ ( argv ) {
				await {
					sleep(0.001);
				};
				say( argv.length() );
				say( argv[0] );
				say( argv[1] );
			}
		`, {
			scriptArgs: [ 'alpha', 'beta' ],
		} );
		assert.equal( result.status, 0, result.stderr || result.stdout );
		assert.equal( result.stdout, '2\nalpha\nbeta\n' );
	}

	{
		let cleanupLog = '';
		await taskRuntime.withoutAsyncLocalStorageForTesting( async () => {
			taskRuntime.resetForRun();
			const child = () => taskRuntime.task( async () => {
				try {
					await taskRuntime.awaitBlock( Promise.resolve( {
						__zuzu_await_block_value: taskRuntime.sleep( 1 ),
					} ) );
					cleanupLog += 'late';
				}
				finally {
					cleanupLog += 'clean';
				}
			}, { name: 'fallback-child' } );
			const parent = taskRuntime.spawn( async () => {
				await taskRuntime.awaitBlock( Promise.resolve( {
					__zuzu_await_block_value: child(),
				} ) );
			}, { name: 'fallback-parent' } );
			await new Promise( (resolve) => setTimeout( resolve, 20 ) );
			parent.cancel( 'stop' );
			await assert.rejects(
				() => parent,
				(err) => err && err.name === 'CancelledException',
			);
			await new Promise( (resolve) => setTimeout( resolve, 20 ) );
			assert.equal( cleanupLog, 'clean' );
			taskRuntime.resetForRun();
		} );
	}

	console.log( 'zuzu-js async parity tests passed' );
} )().catch( (err) => {
	console.error( err && err.stack ? err.stack : String( err ) );
	process.exitCode = 1;
} );
