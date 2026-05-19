'use strict';

const {
	BinaryString,
	ZuzuBinary,
	ZuzuBag,
	Pair,
	PairList,
	isPairListLike,
	isWeakCell,
	makeWeakValue,
	retainCollectionValue,
	retainValue,
	resolveWeakValue,
} = require( '../../../lib/runtime-helpers' );
const cbor = require( './cbor' );

const KIND_PAIR = 1;
const KIND_ARRAY = 2;
const KIND_DICT = 3;
const KIND_PAIRLIST = 4;
const KIND_SET = 5;
const KIND_BAG = 6;
const KIND_OBJECT = 7;
const KIND_FUNCTION = 8;
const KIND_CLASS = 9;
const KIND_TRAIT = 10;
const KIND_BOUND_METHOD = 11;
const KIND_TIME = 12;
const KIND_PATH = 13;

const CODE_FUNCTION = 1;
const CODE_CLASS = 2;
const CODE_TRAIT = 3;
const MAX_SAFE_INTEGER = 9_007_199_254_740_991;
const classRegistry = new Map();
const codeRegistry = new Map();
let runtimePolicy = {
	host_name: 'node',
	repo_root: null,
	include_paths: [],
	deny_modules: [],
	debug_level: 0,
	transpiler: null,
};

function setRuntimePolicy( policy = {} ) {
	runtimePolicy = {
		...runtimePolicy,
		...policy,
		include_paths: Array.isArray( policy.include_paths )
			? policy.include_paths.slice()
			: runtimePolicy.include_paths,
		deny_modules: Array.isArray( policy.deny_modules )
			? policy.deny_modules.slice()
			: runtimePolicy.deny_modules,
	};
}

function dumpGraph( value ) {
	const state = {
		objects: [],
		ids: new WeakMap(),
		code: [],
		codeIds: new WeakMap(),
		onDump: new WeakSet(),
	};
	const root = encodeValue( value, state );
	return cbor.encodeOne(
		cbor.tag( cbor.SELF_DESCRIBED_TAG, [
			cbor.textString( 'ZUZU-MARSHAL' ),
			1,
			new Map(),
			root,
			state.objects,
			state.code,
		] )
	);
}

function loadGraph( blob ) {
	if ( !( blob instanceof BinaryString ) ) {
		throw new Error(
			`TypeException: std/marshal.load expects BinaryString, got ${typeName( blob )}`
		);
	}
	const decoded = cbor.decodeOne( blob );
	const envelope = decodeEnvelope( decoded );
	const codeValues = loadCodeTable( envelope.code );
	const placeholders = allocatePlaceholders( envelope.objects, codeValues );
	fillPlaceholders( envelope.objects, placeholders );
	const value = decodeValue( envelope.root, placeholders, {
		allowWeak: false,
		context: 'Envelope root',
	} );
	runOnLoadHooks( envelope.objects, placeholders );
	return value;
}

function safeToDumpGraph( value ) {
	try {
		dumpGraph( value );
		return true;
	}
	catch ( _err ) {
		return false;
	}
}

function encodeValue( value, state ) {
	if ( isWeakCell( value ) ) {
		return [ 1, encodeValue( resolveWeakValue( value ), state ) ];
	}
	if ( value == null ) {
		return null;
	}
	if ( typeof value === 'boolean' ) {
		return value;
	}
	if ( typeof value === 'number' ) {
		return encodeNumber( value );
	}
	if ( typeof value === 'string' ) {
		return cbor.textString( value );
	}
	if ( value instanceof ZuzuBinary ) {
		return cbor.byteString( value.bytes );
	}
	if ( isBoundMethodValue( value ) ) {
		return encodeBoundMethod( value, state );
	}
	if ( isUserClassValue( value ) ) {
		return encodeClassReference( value, state );
	}
	if ( isTraitValue( value ) ) {
		return encodeTraitReference( value, state );
	}
	if ( isFunctionValue( value ) ) {
		return encodeFunctionReference( value, state );
	}
	if ( value instanceof Pair ) {
		return encodeObjectTableValue( value, KIND_PAIR, state, encodePairPayload );
	}
	if ( Array.isArray( value ) ) {
		return encodeObjectTableValue( value, KIND_ARRAY, state, encodeArrayPayload );
	}
	if ( isPairListLike( value ) ) {
		return encodeObjectTableValue(
			value,
			KIND_PAIRLIST,
			state,
			encodePairListPayload
		);
	}
	if ( value instanceof Set ) {
		return encodeObjectTableValue( value, KIND_SET, state, encodeSetPayload );
	}
	if ( value instanceof ZuzuBag ) {
		return encodeObjectTableValue( value, KIND_BAG, state, encodeBagPayload );
	}
	if ( isTimeValue( value ) ) {
		return encodeObjectTableValue( value, KIND_TIME, state, encodeTimePayload );
	}
	if ( isPathValue( value ) ) {
		return encodeObjectTableValue( value, KIND_PATH, state, encodePathPayload );
	}
	if ( isPlainDict( value ) ) {
		return encodeObjectTableValue( value, KIND_DICT, state, encodeDictPayload );
	}
	if ( isUserObjectValue( value ) ) {
		return encodeUserObject( value, state );
	}
	throw new Error( `Value of type ${typeName( value )} is not marshalable in this phase` );
}

function encodeNumber( value ) {
	if ( !Number.isFinite( value ) ) {
		throw new Error( 'Number values must be finite' );
	}
	if (
		!Object.is( value, -0 )
		&& Number.isInteger( value )
		&& Math.abs( value ) <= MAX_SAFE_INTEGER
	) {
		return value;
	}
	return Number( value );
}

function encodeObjectTableValue( value, kind, state, payloadEncoder ) {
	if ( state.ids.has( value ) ) {
		return [ 0, state.ids.get( value ) ];
	}
	const id = state.objects.length;
	state.ids.set( value, id );
	state.objects.push( null );
	state.objects[id] = [ kind, payloadEncoder( value, state ) ];
	return [ 0, id ];
}

function encodeArrayPayload( value, state ) {
	return value.map( (item) => encodeValue( item, state ) );
}

function encodeDictPayload( value, state ) {
	return Object.keys( value )
		.sort()
		.map( (key) => [
			cbor.textString( key ),
			encodeValue( value[key], state ),
		] );
}

function encodePairListPayload( value, state ) {
	return value.list.map( (pair) => [
		cbor.textString( pair[0] ),
		encodeValue( pair[1], state ),
	] );
}

function encodeSetPayload( value, state ) {
	return [ ...value ].map( (item) => encodeValue( item, state ) );
}

function encodeBagPayload( value, state ) {
	return value.items.map( (item) => encodeValue( item, state ) );
}

function encodePairPayload( value, state ) {
	return [
		cbor.textString( value.key ),
		encodeValue( value.value, state ),
	];
}

function encodeTimePayload( value, _state ) {
	const epoch = typeof value.epoch === 'function' ? value.epoch() : value._epoch;
	if ( typeof epoch !== 'number' || !Number.isFinite( epoch ) ) {
		throw new Error( 'Time value has invalid internal epoch' );
	}
	const zone = typeof value.timezone === 'function'
		? value.timezone().to_String()
		: value._timezone;
	if ( zone == null ) {
		return [ encodeNumber( epoch ) ];
	}
	return [ encodeNumber( epoch ), cbor.textString( String( zone ) ) ];
}

function encodePathPayload( value, _state ) {
	const pathText = typeof value.to_String === 'function'
		? value.to_String()
		: value.value;
	if ( pathText == null ) {
		throw new Error( 'Path value has invalid internal path' );
	}
	return [ cbor.textString( pathText ) ];
}

function encodeUserObject( value, state ) {
	if ( state.ids.has( value ) ) {
		return [ 0, state.ids.get( value ) ];
	}
	if ( !state.onDump.has( value ) ) {
		state.onDump.add( value );
		if ( typeof value.__on_dump__ === 'function' ) {
			try {
				value.__on_dump__();
			}
			catch ( err ) {
				throw new Error(
					`__on_dump__ for ${typeName( value )} failed: ${err.message || err}`
				);
			}
		}
	}
	const id = state.objects.length;
	state.ids.set( value, id );
	state.objects.push( null );
	const slots = Object.keys( value )
		.filter( (key) => isMarshalableObjectSlot( value[key] ) )
		.sort()
		.map( (key) => [
			cbor.textString( key ),
			encodeValue( value[key], state ),
		] );
	state.objects[id] = [
		KIND_OBJECT,
		[
			encodeClassReference( value.constructor, state ),
			slots,
		],
	];
	return [ 0, id ];
}

function encodeBoundMethod( value, state ) {
	if ( state.ids.has( value ) ) {
		return [ 0, state.ids.get( value ) ];
	}
	const receiver = value.__zuzu_bound_receiver || value.receiver || null;
	const methodName = value.__zuzu_bound_method_name || value.name;
	if ( !receiver || !methodName ) {
		throw new Error( 'Bound method values are not marshalable in this phase' );
	}
	const id = state.objects.length;
	state.ids.set( value, id );
	state.objects.push( null );
	state.objects[id] = [
		KIND_BOUND_METHOD,
		[
			encodeValue( receiver, state ),
			cbor.textString( methodName ),
		],
	];
	return [ 0, id ];
}

function encodeFunctionReference( fn, state ) {
	return encodeCodeBackedObject( fn, KIND_FUNCTION, state, encodeFunctionCode );
}

function encodeTraitReference( trait, state ) {
	return encodeCodeBackedObject( trait, KIND_TRAIT, state, encodeTraitCode );
}

function encodeCodeBackedObject( value, kind, state, codeEncoder ) {
	if ( state.ids.has( value ) ) {
		return [ 0, state.ids.get( value ) ];
	}
	const id = state.objects.length;
	state.ids.set( value, id );
	state.objects.push( null );
	const codeId = codeEncoder( value, state );
	state.objects[id] = [ kind, [ codeId ] ];
	return [ 0, id ];
}

function encodeClassReference( klass, state ) {
	if ( !isUserClassValue( klass ) ) {
		throw new Error( 'Object class is not marshalable in this phase' );
	}
	return encodeCodeBackedObject( klass, KIND_CLASS, state, encodeClassCode );
}

function encodeClassCode( klass, state ) {
	if ( !klass.__zuzu_marshal_meta ) {
		Object.defineProperty( klass, '__zuzu_marshal_meta', {
			value: {
				kind: 'class',
				name: klass.__zuzu_class_name || klass.name,
				source: marshalClassSource( klass, klass.__zuzu_class_name || klass.name ),
				captures: {},
			},
			enumerable: false,
			configurable: true,
			writable: true,
		} );
	}
	return encodeCodeRecord( klass, state, CODE_CLASS );
}

function encodeFunctionCode( fn, state, preferredName = null ) {
	return encodeCodeRecord( fn, state, CODE_FUNCTION, preferredName );
}

function encodeTraitCode( trait, state, preferredName = null ) {
	return encodeCodeRecord( trait, state, CODE_TRAIT, preferredName );
}

function encodeCodeRecord( value, state, kind, preferredName = null ) {
	if ( state.codeIds.has( value ) ) {
		return state.codeIds.get( value );
	}
	const meta = value.__zuzu_marshal_meta || {};
	if ( !meta.source ) {
		throw new Error( `Value of type ${typeName( value )} is not marshalable in this phase` );
	}
	const id = state.code.length;
	state.codeIds.set( value, id );
	state.code.push( null );
	const bindingName = marshalBindingName( preferredName || meta.name, id );
	const captures = [];
	const dependencies = [];
	for ( const [ name, captured ] of Object.entries( meta.captures || {} ).sort() ) {
		if ( isFunctionValue( captured ) ) {
			dependencies.push( [ 0, encodeFunctionCode( captured, state, name ) ] );
		}
		else if ( isUserClassValue( captured ) ) {
			dependencies.push( [ 0, encodeClassCode( captured, state, name ) ] );
		}
		else if ( isTraitValue( captured ) ) {
			dependencies.push( [ 0, encodeTraitCode( captured, state, name ) ] );
		}
		else if ( isScalarForCapture( captured ) ) {
			captures.push( [ cbor.textString( name ), encodeValue( captured, state ) ] );
		}
	}
	registerCodeValue( kind, bindingName, meta.source, value );
	state.code[id] = [
		kind,
		cbor.textString( bindingName ),
		cbor.textString( meta.source ),
		captures,
		dependencies,
	];
	return id;
}

function decodeEnvelope( decoded ) {
	if ( !cbor.isTagged( decoded ) || cbor.tagNumber( decoded ) !== cbor.SELF_DESCRIBED_TAG ) {
		throw new Error( 'Top-level item is not tag 55799' );
	}
	const envelope = cbor.tagValue( decoded );
	if ( !Array.isArray( envelope ) ) {
		throw new Error( 'Envelope must be an array' );
	}
	if ( envelope.length !== 6 ) {
		throw new Error( 'Envelope must contain exactly 6 fields' );
	}
	const [ magic, version, options, root, objects, code ] = envelope;
	if ( !cbor.isTextString( magic ) || cbor.textValue( magic ) !== 'ZUZU-MARSHAL' ) {
		throw new Error( 'Envelope magic is invalid' );
	}
	if ( typeof version !== 'number' || version !== 1 ) {
		throw new Error( 'Unsupported Zuzu Marshal version' );
	}
	if ( !( options instanceof Map ) ) {
		throw new Error( 'Envelope options must be a map' );
	}
	if ( !Array.isArray( objects ) ) {
		throw new Error( 'Envelope object table must be an array' );
	}
	if ( !Array.isArray( code ) ) {
		throw new Error( 'Envelope code table must be an array' );
	}
	return { root, objects, code };
}

function loadCodeTable( code ) {
	const records = code.map( validateCodeRecord );
	const values = [];
	const loading = new Set();
	function loadById( id ) {
		if ( values[id] ) {
			return values[id];
		}
		if ( loading.has( id ) ) {
			throw new Error( `Cyclic code dependency involving record ${id}` );
		}
		loading.add( id );
		const value = loadCodeRecord( records[id], id, loadById );
		values[id] = value;
		loading.delete( id );
		return value;
	}
	for ( let id = 0; id < records.length; id++ ) {
		loadById( id );
	}
	return values;
}

function validateCodeRecord( record, id ) {
	assertRecordArray( record, `Code table entry ${id}`, 5 );
	const [ kind, bindingNameValue, sourceValue, captures, dependencies ] = record;
	assertInteger( kind, `Code table entry ${id} kind` );
	if ( ![ CODE_FUNCTION, CODE_CLASS, CODE_TRAIT ].includes( kind ) ) {
		throw new Error( `Unsupported code kind ${kind} in current loader` );
	}
	if ( !cbor.isTextString( bindingNameValue ) ) {
		throw new Error( `Code table entry ${id} binding name must be a text string` );
	}
	if ( !cbor.isTextString( sourceValue ) ) {
		throw new Error( `Code table entry ${id} source must be a text string` );
	}
	if ( !Array.isArray( captures ) ) {
		throw new Error( `Code table entry ${id} captures must be an array` );
	}
	if ( !Array.isArray( dependencies ) ) {
		throw new Error( `Code table entry ${id} dependencies must be an array` );
	}
	return {
		kind,
		bindingName: cbor.textValue( bindingNameValue ),
		source: cbor.textValue( sourceValue ),
		captures,
		dependencies,
	};
}

function loadCodeRecord( record, id, loadById ) {
	const registered = codeRegistry.get(
		codeRegistryKey( record.kind, record.bindingName, record.source )
	);
	if ( registered ) {
		return registered;
	}
	const env = Object.create( null );
	for ( const capture of record.captures ) {
		assertRecordArray( capture, `Capture in code record ${id}`, 2 );
		const [ nameValue, encodedValue ] = capture;
		if ( !cbor.isTextString( nameValue ) ) {
			throw new Error( `Capture name in code record ${id} must be a text string` );
		}
		const name = cbor.textValue( nameValue );
		if ( isWeakStorageRecord( encodedValue ) ) {
			throw new Error(
				`Capture '${name}' in code record ${id} weak storage record is not allowed here`
			);
		}
		env[name] = decodeScalar( encodedValue );
	}
	for ( const dependency of record.dependencies ) {
		assertRecordArray( dependency, `Code dependency in record ${id}`, 2 );
		const [ depKind, depId ] = dependency;
		assertInteger( depKind, `Code dependency in record ${id} kind` );
		if ( depKind !== 0 ) {
			throw new Error( `Unsupported code dependency kind ${depKind} in record ${id}` );
		}
		assertInteger( depId, `Internal dependency in record ${id}` );
		const value = loadById( depId );
		const name = value.__zuzu_class_name
			|| value.__zuzu_trait_name
			|| value.__zuzu_marshal_meta && value.__zuzu_marshal_meta.name;
		if ( name ) {
			env[name] = value;
		}
	}
	if ( record.kind === CODE_FUNCTION ) {
		return buildFunctionFromSource( record.bindingName, record.source, env );
	}
	if ( record.kind === CODE_CLASS ) {
		return buildClassFromSource( record.bindingName, record.source, env );
	}
	return buildTraitFromSource( record.bindingName, record.source, env );
}

function allocatePlaceholders( objects, codeValues ) {
	const placeholders = [];
	for ( let id = 0; id < objects.length; id++ ) {
		const entry = objects[id];
		assertRecordArray( entry, `Object table entry ${id}`, 2 );
		const kind = entry[0];
		assertInteger( kind, `Object table entry ${id} kind` );
		switch ( kind ) {
			case KIND_PAIR:
				placeholders[id] = new Pair( { pair: [] } );
				break;
			case KIND_ARRAY:
				placeholders[id] = [];
				break;
			case KIND_DICT:
				placeholders[id] = {};
				break;
			case KIND_PAIRLIST:
				placeholders[id] = new PairList( [] );
				break;
			case KIND_SET:
				placeholders[id] = new Set();
				break;
			case KIND_BAG:
				placeholders[id] = new ZuzuBag( [] );
				break;
			case KIND_OBJECT:
				placeholders[id] = {};
				break;
			case KIND_FUNCTION:
				placeholders[id] = decodeFunctionPayload( id, entry[1], codeValues );
				break;
			case KIND_CLASS:
				placeholders[id] = decodeClassPayload( id, entry[1], codeValues );
				break;
			case KIND_TRAIT:
				placeholders[id] = decodeTraitPayload( id, entry[1], codeValues );
				break;
			case KIND_BOUND_METHOD:
				placeholders[id] = createBoundMethodPlaceholder( id );
				break;
			case KIND_TIME:
				placeholders[id] = new ( timeClass() )( 0 );
				break;
			case KIND_PATH:
				placeholders[id] = new ( pathClass() )( '.' );
				break;
			default:
				throw new Error( `Unsupported object kind ${kind} in current loader` );
		}
	}
	return placeholders;
}

function fillPlaceholders( objects, placeholders ) {
	for ( let id = 0; id < objects.length; id++ ) {
		const [ kind, payload ] = objects[id];
		switch ( kind ) {
			case KIND_PAIR:
				fillPair( id, payload, placeholders );
				break;
			case KIND_ARRAY:
				fillArray( id, payload, placeholders );
				break;
			case KIND_DICT:
				fillDict( id, payload, placeholders );
				break;
			case KIND_PAIRLIST:
				fillPairList( id, payload, placeholders );
				break;
			case KIND_SET:
				fillSet( id, payload, placeholders );
				break;
			case KIND_BAG:
				fillBag( id, payload, placeholders );
				break;
			case KIND_OBJECT:
				fillObject( id, payload, placeholders );
				break;
			case KIND_FUNCTION:
				break;
			case KIND_CLASS:
				break;
			case KIND_TRAIT:
				break;
			case KIND_BOUND_METHOD:
				break;
			case KIND_TIME:
				fillTime( id, payload, placeholders );
				break;
			case KIND_PATH:
				fillPath( id, payload, placeholders );
				break;
			default:
				throw new Error( `Unsupported object kind ${kind} in current loader` );
		}
	}
	for ( let id = 0; id < objects.length; id++ ) {
		const [ kind, payload ] = objects[id];
		if ( kind === KIND_BOUND_METHOD ) {
			fillBoundMethodPayload( id, payload, placeholders );
		}
	}
}

function fillPair( id, payload, placeholders ) {
	assertRecordArray( payload, `Pair object payload ${id}`, 2 );
	const [ key, value ] = payload;
	if ( !cbor.isTextString( key ) ) {
		throw new Error( `Pair object payload ${id} key must be a text string` );
	}
	placeholders[id].pair = [
		cbor.textValue( key ),
		storeStrongLoadedValue( decodeValue( value, placeholders, {
			context: `Pair object payload ${id} value`,
		} ) ),
	];
}

function fillArray( id, payload, placeholders ) {
	if ( !Array.isArray( payload ) ) {
		throw new Error( `Array object payload ${id} must be an array` );
	}
	placeholders[id].splice(
		0,
		placeholders[id].length,
		...payload.map( (item) => storeCollectionLoadedValue(
			placeholders[id],
			decodeValue(
				item,
				placeholders,
				{ context: `Array object payload ${id} item` }
			)
		) )
	);
}

function fillDict( id, payload, placeholders ) {
	if ( !Array.isArray( payload ) ) {
		throw new Error( `Dict object payload ${id} must be an array` );
	}
	const target = placeholders[id];
	for ( const pair of payload ) {
		const [ key, value ] = decodeKeyValueRecord(
			`Dict object payload ${id}`,
			pair,
			placeholders
		);
		if ( Object.prototype.hasOwnProperty.call( target, key ) ) {
			throw new Error( `Dict object payload ${id} contains duplicate key '${key}'` );
		}
		target[key] = storeCollectionLoadedValue( target, value );
	}
}

function fillPairList( id, payload, placeholders ) {
	if ( !Array.isArray( payload ) ) {
		throw new Error( `PairList object payload ${id} must be an array` );
	}
	placeholders[id].list = payload.map( (pair) => {
		const [ key, value ] = decodeKeyValueRecord(
			`PairList object payload ${id}`,
			pair,
			placeholders
		);
		return [ key, storeCollectionLoadedValue( placeholders[id], value ) ];
	} );
}

function fillSet( id, payload, placeholders ) {
	for ( const item of decodeItemPayload(
		`Set object payload ${id}`,
		payload,
		placeholders
	) ) {
		placeholders[id].add( storeCollectionLoadedValue( placeholders[id], item ) );
	}
}

function fillBag( id, payload, placeholders ) {
	placeholders[id].items = decodeItemPayload(
		`Bag object payload ${id}`,
		payload,
		placeholders
	).map( (item) => storeCollectionLoadedValue( placeholders[id], item ) );
}

function fillTime( id, payload, placeholders ) {
	if ( !Array.isArray( payload ) || ( payload.length !== 1 && payload.length !== 2 ) ) {
		throw new Error( `Time object payload ${id} must contain epoch and optional timezone` );
	}
	const epoch = payload[0];
	if ( typeof epoch !== 'number' ) {
		throw new Error( `Time object payload ${id} epoch must be a number` );
	}
	placeholders[id]._epoch = epoch;
	placeholders[id]._timezone = payload.length > 1 && cbor.isTextString( payload[1] )
		? cbor.textValue( payload[1] )
		: 'UTC';
}

function fillPath( id, payload, placeholders ) {
	assertRecordArray( payload, `Path object payload ${id}`, 1 );
	const pathValue = payload[0];
	if ( !cbor.isTextString( pathValue ) ) {
		throw new Error( `Path object payload ${id} path must be a text string` );
	}
	placeholders[id].value = cbor.textValue( pathValue );
}

function decodeFunctionPayload( id, payload, codeValues ) {
	return decodeCodeBackedPayload( 'Function', id, payload, codeValues );
}

function decodeClassPayload( id, payload, codeValues ) {
	return decodeCodeBackedPayload( 'Class', id, payload, codeValues );
}

function decodeTraitPayload( id, payload, codeValues ) {
	return decodeCodeBackedPayload( 'Trait', id, payload, codeValues );
}

function decodeCodeBackedPayload( label, id, payload, codeValues ) {
	assertRecordArray( payload, `${label} object payload ${id}`, 1 );
	const codeId = payload[0];
	if ( isWeakStorageRecord( codeId ) ) {
		throw new Error( `${label} object payload ${id} code id weak storage record is not allowed here` );
	}
	assertInteger( codeId, `${label} object payload ${id} code id` );
	if ( codeId < 0 || codeId >= codeValues.length ) {
		throw new Error( `${label} object payload ${id} code id is outside the code table` );
	}
	return codeValues[codeId];
}

function createBoundMethodPlaceholder( id ) {
	const fn = function __zuzu_loaded_bound_method( ...args ) {
		const receiver = fn.__zuzu_bound_receiver;
		const methodName = fn.__zuzu_bound_method_name;
		if ( receiver == null || typeof receiver[methodName] !== 'function' ) {
			throw new Error( `Bound method object payload ${id} method is not loaded` );
		}
		return receiver[methodName]( ...args );
	};
	Object.defineProperty( fn, '__zuzu_method', {
		value: true,
		enumerable: false,
		configurable: true,
	} );
	fn.invoke = function invoke( _self, args = [] ) {
		return fn( ...args );
	};
	return fn;
}

function fillBoundMethodPayload( id, payload, placeholders ) {
	assertRecordArray( payload, `Bound method object payload ${id}`, 2 );
	const receiver = decodeValue( payload[0], placeholders, {
		allowWeak: false,
		context: `Bound method object payload ${id} receiver`,
	} );
	if ( receiver == null || typeof receiver !== 'object' ) {
		throw new Error( `Bound method object payload ${id} receiver must resolve to an Object` );
	}
	if ( !cbor.isTextString( payload[1] ) ) {
		throw new Error( `Bound method object payload ${id} method name must be a text string` );
	}
	const methodName = cbor.textValue( payload[1] );
	if ( typeof receiver[methodName] !== 'function' ) {
		throw new Error(
			`Bound method object payload ${id} method '${methodName}' was not found`
		);
	}
	const fn = placeholders[id];
	Object.defineProperty( fn, '__zuzu_bound_receiver', {
		value: receiver,
		enumerable: false,
		configurable: true,
		writable: true,
	} );
	Object.defineProperty( fn, '__zuzu_bound_method_name', {
		value: methodName,
		enumerable: false,
		configurable: true,
		writable: true,
	} );
	fn.invoke = function invoke( _self, args = [] ) {
		return receiver[methodName]( ...args );
	};
}

function fillObject( id, payload, placeholders ) {
	assertRecordArray( payload, `Object payload ${id}`, 2 );
	const [ classRef, slotPayload ] = payload;
	const klass = decodeValue( classRef, placeholders, {
		allowWeak: false,
		context: `Object payload ${id} class`,
	} );
	if ( typeof klass !== 'function' ) {
		throw new Error( `Object payload ${id} class must resolve to a Class` );
	}
	if ( !Array.isArray( slotPayload ) ) {
		throw new Error( `Object payload ${id} slots must be an array` );
	}
	const object = placeholders[id];
	Object.setPrototypeOf( object, klass.prototype );
	const seen = new Set();
	for ( const record of slotPayload ) {
		assertRecordArray( record, `Object payload ${id} slot records`, 2 );
		const [ nameValue, encodedValue ] = record;
		if ( !cbor.isTextString( nameValue ) ) {
			throw new Error( `Object payload ${id} slot names must be text strings` );
		}
		const name = cbor.textValue( nameValue );
		if ( seen.has( name ) ) {
			throw new Error( `Object payload ${id} contains duplicate slot '${name}'` );
		}
		seen.add( name );
		object[name] = storeStrongLoadedValue( decodeValue( encodedValue, placeholders, {
			context: `Object payload ${id} slot '${name}'`,
		} ) );
	}
}

function runOnLoadHooks( objects, placeholders ) {
	for ( let id = 0; id < objects.length; id++ ) {
		const [ kind ] = objects[id];
		if ( kind !== KIND_OBJECT ) {
			continue;
		}
		const object = placeholders[id];
		if ( typeof object.__on_load__ === 'function' ) {
			try {
				object.__on_load__();
			}
			catch ( err ) {
				throw new Error(
					`__on_load__ for ${typeName( object )} failed: ${err.message || err}`
				);
			}
		}
	}
}

function decodeItemPayload( context, payload, placeholders ) {
	if ( !Array.isArray( payload ) ) {
		throw new Error( `${context} must be an array` );
	}
	return payload.map( (item) => decodeValue( item, placeholders, {
		context: `${context} item`,
	} ) );
}

function decodeKeyValueRecord( context, pair, placeholders ) {
	assertRecordArray( pair, `${context} entries`, 2 );
	const [ key, value ] = pair;
	if ( !cbor.isTextString( key ) ) {
		throw new Error( `${context} keys must be text strings` );
	}
	return [
		cbor.textValue( key ),
		decodeValue( value, placeholders, {
			context: `${context} value`,
		} ),
	];
}

function decodeValue( value, placeholders, opts = {} ) {
	const allowWeak = Object.prototype.hasOwnProperty.call( opts, 'allowWeak' )
		? opts.allowWeak
		: true;
	const context = opts.context || 'Encoded value';

	if ( isEncodedScalar( value ) ) {
		return decodeScalar( value );
	}
	if ( Array.isArray( value ) ) {
		if ( value.length !== 2 ) {
			throw new Error( `${context} array must be [0, id] or [1, value]` );
		}
		const [ marker, id ] = value;
		if ( !isInteger( marker ) || ( marker !== 0 && marker !== 1 ) ) {
			throw new Error( `${context} marker must be 0 or 1` );
		}
		if ( marker === 1 ) {
			validateWeakStorageRecord( value, placeholders, context );
			if ( !allowWeak ) {
				throw new Error( `${context} weak storage record is not allowed here` );
			}
			return makeWeakValue( decodeValue( id, placeholders, {
				allowWeak: false,
				context: `${context} weak storage value`,
			} ) );
		}
		if ( !isInteger( id ) ) {
			throw new Error( 'Encoded reference id must be an integer' );
		}
		if ( id < 0 || id >= placeholders.length ) {
			throw new Error( `Reference id ${id} is outside the object table` );
		}
		return placeholders[id];
	}
	throw new Error( 'Envelope root is not a scalar or supported reference' );
}

function storeStrongLoadedValue( value ) {
	return isWeakCell( value ) ? value : retainValue( value );
}

function storeCollectionLoadedValue( owner, value ) {
	return isWeakCell( value ) ? value : retainCollectionValue( owner, value );
}

function validateWeakStorageRecord( record, placeholders, context ) {
	assertRecordArray( record, `${context} weak storage record`, 2 );
	const inner = record[1];
	if ( isWeakStorageRecord( inner ) ) {
		throw new Error( `${context} nested weak storage records are invalid` );
	}
	decodeValue( inner, placeholders, {
		allowWeak: false,
		context: `${context} weak storage value`,
	} );
}

function isWeakStorageRecord( value ) {
	return Array.isArray( value ) && value.length === 2 && value[0] === 1;
}

function isEncodedScalar( value ) {
	return value == null
		|| typeof value === 'boolean'
		|| typeof value === 'number'
		|| cbor.isTextString( value )
		|| cbor.isByteString( value );
}

function decodeScalar( value ) {
	if ( value == null ) {
		return null;
	}
	if ( typeof value === 'boolean' || typeof value === 'number' ) {
		return value;
	}
	if ( cbor.isTextString( value ) ) {
		return cbor.textValue( value );
	}
	if ( cbor.isByteString( value ) ) {
		return new BinaryString( cbor.bytesValue( value ) );
	}
	throw new Error( 'Envelope root is not a scalar value' );
}

function assertRecordArray( value, context, length ) {
	if ( !Array.isArray( value ) || value.length !== length ) {
		const item = length === 1 ? 'one-item' : `${length}-item`;
		throw new Error( `${context} must be a ${item} array` );
	}
}

function assertInteger( value, context ) {
	if ( !isInteger( value ) ) {
		throw new Error( `${context} must be an integer` );
	}
}

function isInteger( value ) {
	return typeof value === 'number' && Number.isInteger( value );
}

function isPlainDict( value ) {
	if ( value == null || typeof value !== 'object' ) {
		return false;
	}
	if ( value instanceof ZuzuBinary || value instanceof Pair || isPairListLike( value ) ) {
		return false;
	}
	if ( value instanceof Set || value instanceof ZuzuBag || Array.isArray( value ) ) {
		return false;
	}
	if ( isTimeValue( value ) || isPathValue( value ) ) {
		return false;
	}
	const proto = Object.getPrototypeOf( value );
	if ( proto === null || proto === Object.prototype ) {
		return true;
	}
	return Object.prototype.toString.call( value ) === '[object Object]'
		&& value.constructor
		&& value.constructor.name === 'Object';
}

function isUserObjectValue( value ) {
	return value
		&& typeof value === 'object'
		&& !Array.isArray( value )
		&& isUserClassValue( value.constructor )
		&& !isTimeValue( value )
		&& !isPathValue( value );
}

function isFunctionValue( value ) {
	return typeof value === 'function'
		&& !isUserClassValue( value )
		&& value.__zuzu_marshal_meta
		&& value.__zuzu_marshal_meta.kind === 'function';
}

function isUserClassValue( value ) {
	return typeof value === 'function'
		&& typeof value.__zuzu_class_name === 'string'
		&& value.__zuzu_class_spec
		&& typeof value.__zuzu_class_spec === 'object';
}

function isTraitValue( value ) {
	return value
		&& typeof value === 'object'
		&& value.__zuzu_trait_methods
		&& typeof value.__zuzu_trait_name === 'string';
}

function isBoundMethodValue( value ) {
	return value
		&& (
			value.__zuzu_method
			|| value.constructor && value.constructor.name === 'ZuzuMethod'
		);
}

function isScalarForCapture( value ) {
	return value == null
		|| typeof value === 'boolean'
		|| typeof value === 'number'
		|| typeof value === 'string'
		|| value instanceof ZuzuBinary;
}

function isMarshalableObjectSlot( value ) {
	return typeof value !== 'function';
}

function isTimeValue( value ) {
	return value
		&& typeof value === 'object'
		&& (
			value.__zuzu_type_name === 'Time'
			|| ( value.constructor && value.constructor.name === 'Time' )
		)
		&& ( typeof value.epoch === 'function' || typeof value._epoch === 'number' );
}

function isPathValue( value ) {
	return value
		&& typeof value === 'object'
		&& value.constructor
		&& value.constructor.name === 'Path'
		&& ( typeof value.to_String === 'function' || typeof value.value === 'string' );
}

function timeClass() {
	return require( '../time' ).Time;
}

function pathClass() {
	if ( runtimePolicy.host_name === 'browser' ) {
		throw new Error( 'UnmarshallingException: Path requires std/io' );
	}
	const dynamicRequire = require;
	return dynamicRequire( '../io' ).Path;
}

function marshalBindingName( rawName, id ) {
	const name = String( rawName || '' );
	if ( /^[A-Za-z_][A-Za-z0-9_]*$/u.test( name ) ) {
		return name;
	}
	return `__zuzu_marshal_class_${id}`;
}

function marshalClassSource( klass, bindingName ) {
	const fields = classFields( klass ).map( sourceField ).join( '\n' );
	return fields
		? `class ${bindingName} {\n${fields}\n}`
		: `class ${bindingName} {}`;
}

function classFields( klass ) {
	const spec = klass.__zuzu_class_spec || {};
	return Array.isArray( spec.fields ) ? spec.fields : [];
}

function sourceField( field ) {
	const kind = field.kind === 'const' ? 'const' : 'let';
	const typeName = field.typeName ? `${field.typeName} ` : '';
	const accessors = Array.isArray( field.accessors ) && field.accessors.length > 0
		? ` with ${field.accessors.join( ', ' )}`
		: '';
	return `\t${kind} ${typeName}${field.name}${accessors};`;
}

function registerCodeValue( kind, bindingName, source, value ) {
	codeRegistry.set( codeRegistryKey( kind, bindingName, source ), value );
	if ( kind === CODE_CLASS ) {
		classRegistry.set( classRegistryKey( bindingName, source ), value );
	}
}

function classRegistryKey( bindingName, source ) {
	return `${bindingName}\0${source}`;
}

function codeRegistryKey( kind, bindingName, source ) {
	return `${kind}\0${bindingName}\0${source}`;
}

function buildFunctionFromSource( bindingName, source, env = {} ) {
	const names = Object.keys( env );
	const values = names.map( (name) => env[name] );
	let fn;
	if ( [ 'node', 'browser', 'electron' ].includes( runtimePolicy.host_name ) ) {
		try {
			fn = buildFunctionWithRuntime( bindingName, source, env );
		}
		catch ( runtimeErr ) {
			try {
				fn = Function( ...names, `return ( ${source} );` )( ...values );
			}
			catch ( rawErr ) {
				fn = unloadedFunction( bindingName, runtimeErr, rawErr );
			}
		}
	}
	else {
		try {
			fn = Function( ...names, `return ( ${source} );` )( ...values );
		}
		catch ( rawErr ) {
			fn = unloadedFunction( bindingName, rawErr );
		}
	}
	Object.defineProperty( fn, '__zuzu_marshal_meta', {
		value: {
			kind: 'function',
			name: bindingName,
			source,
			captures: env,
		},
		enumerable: false,
		configurable: true,
		writable: true,
	} );
	return fn;
}

function unloadedFunction( bindingName, ...errors ) {
	return function __zuzu_loaded_function() {
		const err = errors.find( (item) => item && item.message );
		const message = err
			? err.message
			: `Loaded function '${bindingName}' is not executable in JS`;
		throw new Error( message );
	};
}

function buildFunctionWithRuntime( bindingName, source, env = {} ) {
	if (
		runtimePolicy.host_name
		&& ![ 'node', 'browser', 'electron' ].includes( runtimePolicy.host_name )
	) {
		throw new Error( `Loaded function '${bindingName}' is not executable in JS` );
	}
	const denyCapabilities = [];
	for ( const capability of [
		'fs',
		'net',
		'perl',
		'js',
		'proc',
		'db',
		'clib',
		'gui',
		'worker',
	] ) {
		if ( runtimePolicy[`deny_${capability}`] ) {
			denyCapabilities.push( capability );
		}
	}
	const runtimeOptions = {
		repoRoot: runtimePolicy.repo_root || undefined,
		includePaths: runtimePolicy.include_paths || [],
		denyCapabilities,
		denyModules: runtimePolicy.deny_modules || [],
		debugLevel: runtimePolicy.debug_level || 0,
		transpiler: runtimePolicy.transpiler || undefined,
	};
	let runtime;
	if ( runtimePolicy.host_name === 'browser' ) {
		const { createBrowserRuntime } = require( '../../../lib/browser-runtime' );
		const defaults = typeof globalThis !== 'undefined'
			&& globalThis.__ZUZU_BROWSER_DEFAULT_RUNTIME_OPTIONS__
			&& typeof globalThis.__ZUZU_BROWSER_DEFAULT_RUNTIME_OPTIONS__ === 'object'
			? globalThis.__ZUZU_BROWSER_DEFAULT_RUNTIME_OPTIONS__
			: {};
		runtime = createBrowserRuntime( {
			...defaults,
			...runtimeOptions,
		} ).runtime;
	}
	else {
		const entrypointsModule = '../../../lib/' + 'runtime-entrypoints';
		const { createNodeRuntime } = require( entrypointsModule );
		runtime = createNodeRuntime( runtimeOptions );
	}
	const js = runtime.transpile(
		`let __zuzu_marshal_value := ${source};\n`
		+ '__global__{__zuzu_marshal_result} := __zuzu_marshal_value;'
	);
	const context = runtime.buildContext( {
		filename: '<std/marshal-code>',
		globals: env,
	} );
	context.__global__ = Object.create( null );
	runtime.installCollectionMethods( context );
	runtime.host.runInContext(
		js,
		context,
		{ filename: '<std/marshal-code>' },
	);
	const fn = context.__global__.__zuzu_marshal_result;
	if ( typeof fn !== 'function' ) {
		throw new Error( `Loaded function '${bindingName}' is not executable in JS` );
	}
	return fn;
}

function buildClassFromSource( bindingName, source, env = {} ) {
	const spec = parseClassSource( source, env );
	return buildMarshalClass(
		bindingName,
		spec.fields,
		spec.methods,
		spec.statics,
		spec.traitNames.map( (name) => env[name] ).filter( isTraitValue ),
		env,
		source
	);
}

function buildTraitFromSource( bindingName, source, env = {} ) {
	const trait = {
		__zuzu_trait_name: bindingName,
		__zuzu_trait_methods: parseMethods( source, env ).methods,
	};
	Object.defineProperty( trait, '__zuzu_marshal_meta', {
		value: {
			kind: 'trait',
			name: bindingName,
			source,
			captures: env,
		},
		enumerable: false,
		configurable: true,
		writable: true,
	} );
	return trait;
}

function parseClassSource( source, env = {} ) {
	return {
		fields: parseClassFields( source ),
		traitNames: parseClassTraitNames( source ),
		...parseMethods( source, env ),
	};
}

function parseClassFields( source ) {
	const body = String( source || '' ).replace( /\/\*[\s\S]*?\*\//gu, '' );
	const fields = [];
	const byName = new Map();
	const rx = /\b(let|const)\s+(?:(Null|Any|Boolean|Number|String|BinaryString|Array|Dict|PairList|Set|Bag|Pair|Time|Path|Object)\s+)?([A-Za-z_][A-Za-z0-9_]*)(?:\s+with\s+([^;:=]+?))?\s*(?::=\s*([^;]*))?;/gu;
	let match = rx.exec( body );
	while ( match ) {
		const field = {
			kind: match[1],
			typeName: match[2] || null,
			name: match[3],
			accessors: match[4]
				? match[4].split( ',' ).map( (item) => item.trim() ).filter( Boolean )
				: [],
			defaultSource: match[5] ? match[5].trim() : null,
		};
		fields.push( field );
		byName.set( field.name, field );
		match = rx.exec( body );
	}
	const methodRx = /\bmethod\s+(get|set|clear|has)_([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/gu;
	let methodMatch = methodRx.exec( body );
	while ( methodMatch ) {
		const field = byName.get( methodMatch[2] );
		if ( field && !field.accessors.includes( methodMatch[1] ) ) {
			field.accessors.push( methodMatch[1] );
		}
		if ( field && methodMatch[1] === 'set' && !field.typeName ) {
			const typeMatch = methodMatch[3].match( /\b(Null|Any|Boolean|Number|String|BinaryString|Array|Dict|PairList|Set|Bag|Pair|Time|Path|Object)\s+[A-Za-z_][A-Za-z0-9_]*\b/u );
			if ( typeMatch ) {
				field.typeName = typeMatch[1];
			}
		}
		methodMatch = methodRx.exec( body );
	}
	return fields;
}

function parseClassTraitNames( source ) {
	const match = String( source || '' ).match(
		/\bclass\s+[A-Za-z_][A-Za-z0-9_]*(?:\s+extends\s+[A-Za-z_][A-Za-z0-9_]*)?\s+with\s+([^{]+)/u
	);
	if ( !match ) {
		return [];
	}
	return match[1]
		.split( ',' )
		.map( (item) => item.trim() )
		.filter( (item) => /^[A-Za-z_][A-Za-z0-9_]*$/u.test( item ) );
}

function parseMethods( source, env = {} ) {
	const text = String( source || '' ).replace( /\/\*[\s\S]*?\*\//gu, '' );
	const methods = {};
	const statics = {};
	const rx = /\b(static\s+)?method\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:->\s*[A-Za-z_][A-Za-z0-9_]*)?\s*\{([\s\S]*?)\}/gu;
	let match = rx.exec( text );
	while ( match ) {
		const target = match[1] ? statics : methods;
		target[match[2]] = compileSimpleMethod(
			match[2],
			parseParamNames( match[3] ),
			match[4],
			env
		);
		match = rx.exec( text );
	}
	return { methods, statics };
}

function parseParamNames( source ) {
	return String( source || '' )
		.split( ',' )
		.map( (item) => item.trim() )
		.filter( Boolean )
		.map( (item) => {
			const match = item.match( /([A-Za-z_][A-Za-z0-9_]*)$/u );
			return match ? match[1] : null;
		} )
		.filter( Boolean );
}

function compileSimpleMethod( name, paramNames, body, env ) {
	const match = String( body || '' ).match( /\breturn\s+([\s\S]*?)\s*;/u );
	if ( !match ) {
		return function _loaded_method() {
			return null;
		};
	}
	const expression = match[1];
	return {
		[name]: function _loaded_method( ...args ) {
			const params = Object.create( null );
			for ( let i = 0; i < paramNames.length; i++ ) {
				params[paramNames[i]] = args[i];
			}
			return evalSimpleExpression( expression, this, env, params );
		},
	}[name];
}

function evalSimpleExpression( source, self, env = {}, params = {} ) {
	const expression = normalizeSimpleExpression( source );
	const envNames = Object.keys( env );
	const paramNames = Object.keys( params );
	const fn = Function(
		'self',
		...envNames,
		...paramNames,
		`with ( self ) { return ( ${expression} ); }`
	);
	return fn(
		self || {},
		...envNames.map( (name) => env[name] ),
		...paramNames.map( (name) => params[name] )
	);
}

function normalizeSimpleExpression( source ) {
	return String( source || 'null' ).replace( /\s+_\s+/gu, ' + ' );
}

function buildMarshalClass(
	name,
	fields,
	methods = {},
	statics = {},
	traits = [],
	env = {},
	source = ''
) {
	const ctor = {
		[name]: class {
			constructor( initial = {} ) {
				for ( const field of fields ) {
					let value = field.defaultSource
						? evalSimpleExpression( field.defaultSource, this, env )
						: null;
					if ( isPairListLike( initial ) ) {
						value = initial.get( field.name, value );
					}
					else if (
						initial
						&& typeof initial === 'object'
						&& Object.prototype.hasOwnProperty.call( initial, field.name )
					) {
						value = initial[field.name];
					}
					this[field.name] = value;
				}
			}
		},
	}[name];
	for ( const field of fields ) {
		if ( !Array.isArray( field.accessors ) ) {
			continue;
		}
		if ( field.accessors.includes( 'get' ) ) {
			ctor.prototype[`get_${field.name}`] = function _get_field() {
				return this[field.name];
			};
		}
		if ( field.accessors.includes( 'set' ) ) {
			ctor.prototype[`set_${field.name}`] = function _set_field( value ) {
				if ( field.typeName && value != null && !typeMatches( value, field.typeName ) ) {
					throw new Error(
						`TypeException: field '${field.name}' must be ${field.typeName}, got ${typeName( value )}`
					);
				}
				this[field.name] = value;
				return this;
			};
		}
	}
	for ( const trait of traits ) {
		for ( const [ methodName, fn ] of Object.entries( trait.__zuzu_trait_methods ) ) {
			if ( typeof fn === 'function' && typeof ctor.prototype[methodName] !== 'function' ) {
				ctor.prototype[methodName] = fn;
			}
		}
	}
	const generatedAccessors = new Set();
	for ( const field of fields ) {
		for ( const accessor of field.accessors || [] ) {
			generatedAccessors.add( `${accessor}_${field.name}` );
		}
	}
	for ( const [ methodName, fn ] of Object.entries( methods ) ) {
		if ( generatedAccessors.has( methodName ) ) {
			continue;
		}
		ctor.prototype[methodName] = fn;
	}
	for ( const [ methodName, fn ] of Object.entries( statics ) ) {
		ctor[methodName] = fn;
	}
	Object.defineProperty( ctor, '__zuzu_class_name', {
		value: name,
		enumerable: false,
		configurable: true,
		writable: true,
	} );
	Object.defineProperty( ctor, '__zuzu_class_spec', {
		value: { fields, traits, methods, statics, nested: {} },
		enumerable: false,
		configurable: true,
		writable: true,
	} );
	Object.defineProperty( ctor, '__zuzu_marshal_meta', {
		value: {
			kind: 'class',
			name,
			source,
			captures: env,
		},
		enumerable: false,
		configurable: true,
		writable: true,
	} );
	return ctor;
}

function typeMatches( value, expected ) {
	if ( expected === 'Any' || expected == null ) {
		return true;
	}
	if ( expected === 'Null' ) {
		return value == null;
	}
	if ( expected === 'Boolean' ) {
		return typeof value === 'boolean';
	}
	if ( expected === 'Number' ) {
		return typeof value === 'number';
	}
	if ( expected === 'String' ) {
		return typeof value === 'string';
	}
	if ( expected === 'BinaryString' ) {
		return value instanceof BinaryString;
	}
	if ( expected === 'Array' ) {
		return Array.isArray( value );
	}
	if ( expected === 'Dict' ) {
		return isPlainDict( value );
	}
	if ( expected === 'PairList' ) {
		return isPairListLike( value );
	}
	if ( expected === 'Set' ) {
		return value instanceof Set;
	}
	if ( expected === 'Bag' ) {
		return value instanceof ZuzuBag;
	}
	if ( expected === 'Pair' ) {
		return value instanceof Pair;
	}
	if ( expected === 'Time' ) {
		return isTimeValue( value );
	}
	if ( expected === 'Path' ) {
		return isPathValue( value );
	}
	return true;
}

function typeName( value ) {
	if ( value == null ) {
		return 'Null';
	}
	if ( value instanceof BinaryString ) {
		return 'BinaryString';
	}
	if ( typeof value === 'boolean' ) {
		return 'Boolean';
	}
	if ( typeof value === 'number' ) {
		return 'Number';
	}
	if ( typeof value === 'string' ) {
		return 'String';
	}
	if ( Array.isArray( value ) ) {
		return 'Array';
	}
	if ( value && value.constructor && value.constructor.name ) {
		return value.constructor.name;
	}
	return typeof value;
}

module.exports = {
	dumpGraph,
	loadGraph,
	safeToDumpGraph,
	setRuntimePolicy,
};
