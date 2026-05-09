'use strict';

class ZuzuBag {
	constructor( ...items ) {
		if ( items.length === 0 ) {
			this.items = [];
			return;
		}
		if ( items.length > 1 ) {
			this.items = items.slice();
			return;
		}
		const first = items[0];
		if ( Array.isArray( first ) ) {
			this.items = first.slice();
			return;
		}
		if ( first != null && typeof first !== 'string' && typeof first[Symbol.iterator] === 'function' ) {
			this.items = Array.from( first );
			return;
		}
		this.items = [ first ];
	}

	length() { return this.items.length; }
	count( value ) {
		if ( arguments.length === 0 ) {
			return this.items.length;
		}
		return this.items.filter( (item) => item === value ).length;
	}
	empty() { return this.items.length === 0 ? 1 : 0; }
	is_empty() { return this.empty(); }
	contains( value ) { return this.items.includes( value ) ? 1 : 0; }
	add( ...values ) { this.items.push( ...values ); return this; }
	push( ...values ) { return this.add( ...values ); }
	remove( value ) { return this.remove_first( value ); }
	remove_first( value ) {
		const idx = this.items.indexOf( value );
		if ( idx >= 0 ) {
			this.items.splice( idx, 1 );
		}
		return this;
	}
	remove_if( fn ) { this.items = this.items.filter( (item) => !fn( item ) ); return this; }
	get( idx, fallback = null ) { return idx >= 0 && idx < this.items.length ? this.items[idx] : fallback; }
	map( fn ) { return new ZuzuBag( this.items.map( fn ) ); }
	grep( fn ) { return new ZuzuBag( this.items.filter( fn ) ); }
	any( fn ) { return this.items.some( fn ) ? 1 : 0; }
	all( fn ) { return this.items.every( fn ) ? 1 : 0; }
	first( fn ) {
		for ( const item of this.items ) {
			if ( fn( item ) ) {
				return item;
			}
		}
		return null;
	}
	for_each_value( fn ) { this.items.forEach( fn ); return this; }
	to_Array() { return this.items.slice(); }
	to_Set() { return new Set( this.items ); }
	to_Iterator() { return this.items[Symbol.iterator](); }
	uniq() { return new ZuzuBag( [ ...new Set( this.items ) ] ); }
	sum() { return this.items.reduce( (a, b) => Number( a ) + Number( b ), 0 ); }
	product() { return this.items.reduce( (a, b) => Number( a ) * Number( b ), 1 ); }
	sort( fn ) { return this.to_Array().sort( fn ); }
	sortstr() { return this.to_Array().sort( (a, b) => String( a ).localeCompare( String( b ) ) ); }
	sortnum() { return this.to_Array().map( (item) => Number( item ) ).sort( (a, b) => a - b ); }
	clear() { this.items = []; return this; }
	[Symbol.iterator]() { return this.items[Symbol.iterator](); }
}

class Pair {
	constructor( options = {} ) {
		this.pair = options.pair || [];
	}

	get key() {
		return this.pair[0] ?? null;
	}

	set key( value ) {
		this.pair[0] = value;
	}

	get value() {
		return this.pair[1] ?? null;
	}

	set value( value ) {
		this.pair[1] = value;
	}
}

class PairList {
	constructor( ...options ) {
		this.list = [];
		if ( options.length > 1 ) {
			this.list = options
				.filter( (entry) => Array.isArray( entry ) && entry.length >= 2 )
				.map( (entry) => [ String( entry[0] ), entry[1] ] );
			return;
		}
		const first = options.length === 0 ? {} : options[0];
		if ( Array.isArray( first ) ) {
			this.list = first.slice();
			return;
		}
		if ( Array.isArray( first.list ) ) {
			this.list = first.list.slice();
		}
		return new Proxy( this, {
			get( target, prop, receiver ) {
				if ( typeof prop === 'symbol' || prop in target ) {
					return Reflect.get( target, prop, receiver );
				}
				if ( typeof prop === 'string' ) {
					return target.get( prop, null );
				}
				return undefined;
			},
			set( target, prop, value, receiver ) {
				if ( typeof prop === 'symbol' || prop in target ) {
					return Reflect.set( target, prop, value, receiver );
				}
				if ( typeof prop === 'string' ) {
					const idx = target.list.findIndex( (pair) => pair[0] === String( prop ) );
					if ( idx >= 0 ) {
						target.list[idx][1] = value;
					}
					else {
						target.list.push( [ String( prop ), value ] );
					}
					return true;
				}
				return false;
			},
		} );
	}

	length() { return this.list.length; }
	count() { return this.list.length; }
	empty() { return this.list.length === 0 ? 1 : 0; }
	keys() { return this.list.map( (pair) => pair[0] ); }
	values() { return this.list.map( (pair) => pair[1] ); }
	enumerate() { return this.to_Array(); }
	has( key ) { return this.list.some( (pair) => pair[0] === String( key ) ) ? 1 : 0; }
	exists( key ) { return this.has( key ); }
	defined( key ) {
		const found = this.list.find( (pair) => pair[0] === String( key ) );
		return found ? ( found[1] == null ? 0 : 1 ) : 0;
	}
	get( key, fallback = null ) {
		const found = this.list.find( (pair) => pair[0] === String( key ) );
		return found ? found[1] : fallback;
	}
	get_all( key ) {
		return this.list
			.filter( (pair) => pair[0] === String( key ) )
			.map( (pair) => pair[1] );
	}
	all( key ) { return this.get_all( key ); }
	add( key, value ) { this.list.push( [ String( key ), value ] ); return this; }
	set( key, value ) { return this.add( key, value ); }
	kv() {
		const out = [];
		for ( const [ key, value ] of this.list ) {
			out.push( key, value );
		}
		return out;
	}
	sorted_keys() {
		return this.keys().slice().sort();
	}
	remove( key ) {
		if ( typeof key === 'function' ) {
			this.list = this.list.filter(
				(pair) => !key( new Pair( { pair: pair.slice() } ) )
			);
			return this;
		}
		const normalized = String( key );
		this.list = this.list.filter( (pair) => pair[0] !== normalized );
		return this;
	}
	for_each_key( fn ) {
		for ( const key of this.keys() ) {
			fn( key );
		}
		return this;
	}
	for_each_value( fn ) {
		for ( const value of this.values() ) {
			fn( value );
		}
		return this;
	}
	for_each_pair( fn ) {
		for ( const pair of this.list ) {
			fn( new Pair( { pair: pair.slice() } ) );
		}
		return this;
	}
	to_Array() { return this.list.map( (pair) => new Pair( { pair: pair.slice() } ) ); }
	to_Iterator() { return this.keys()[Symbol.iterator](); }
	clear() { this.list = []; return this; }
}

function withArrayMethods() {
	const define = ( name, fn ) => {
		if ( !Object.prototype.hasOwnProperty.call( Array.prototype, name ) ) {
			const desc = Object.create( null );
			desc.value = fn;
			desc.enumerable = false;
			Object.defineProperty( Array.prototype, name, desc );
		}
	};
	define( 'count', function _count() { return this.length; } );
	define( 'empty', function _empty() { return this.length === 0 ? 1 : 0; } );
	define( 'is_empty', function _is_empty() { return this.empty(); } );
	define( 'append', function _append( ...values ) { this.push( ...values ); return this; } );
	define( 'add', function _add( ...values ) { this.push( ...values ); return this; } );
	define( 'prepend', function _prepend( ...values ) { this.unshift( ...values ); return this; } );
	define( 'get', function _get( idx, fallback = null ) { return idx >= 0 && idx < this.length ? this[idx] : fallback; } );
	define( 'set', function _set( idx, value ) { this[idx] = value; return this; } );
	define( 'grep', function _grep( fn ) { return this.filter( fn ); } );
	define( 'any', function _any( fn ) { return this.some( fn ) ? 1 : 0; } );
	define( 'all', function _all( fn ) { return this.every( fn ) ? 1 : 0; } );
	define( 'first', function _first( fn ) { return this.find( fn ) ?? null; } );
	define( 'remove', function _remove( fn ) {
		for ( let i = this.length - 1; i >= 0; i-- ) {
			if ( fn( this[i] ) ) {
				this.splice( i, 1 );
			}
		}
		return this;
	} );
	define( 'contains', function _contains( value ) { return this.includes( value ) ? 1 : 0; } );
	define( 'first_index', function _first_index( fn ) { return this.findIndex( fn ); } );
	define( 'reductions', function _reductions( fn ) {
		const out = [];
		for ( const item of this ) {
			if ( out.length === 0 ) {
				out.push( item );
			}
			else {
				out.push( fn( out[out.length - 1], item ) );
			}
		}
		return out;
	} );
	define( 'head', function _head( n ) { return this.slice( 0, n ); } );
	define( 'tail', function _tail( n ) { return this.slice( n - 1 ); } );
	define( 'sum', function _sum() { return this.reduce( (a, b) => Number( a ) + Number( b ), 0 ); } );
	define( 'product', function _product() { return this.reduce( (a, b) => Number( a ) * Number( b ), 1 ); } );
	define( 'shuffle', function _shuffle() { return this.slice(); } );
	define( 'sample', function _sample( n ) { return this.slice( 0, n ); } );
	define( 'for_each_value', function _for_each_value( fn ) { this.forEach( fn ); return this; } );
	define( 'sortstr', function _sortstr() { return this.slice().sort( (a, b) => String( a ).localeCompare( String( b ) ) ); } );
	define(
		'sortnum',
		function _sortnum() {
			return this
				.map( (item) => Number( item ) )
				.sort( (a, b) => a - b );
		}
	);
	define( 'to_Array', function _to_array() { return this.slice(); } );
	define( 'to_Set', function _to_set() { return new Set( this ); } );
	define( 'to_Bag', function _to_bag() { return new ZuzuBag( this ); } );
	define( 'to_Iterator', function _to_iterator() { return this[Symbol.iterator](); } );
	define( 'clear', function _clear() { this.splice( 0, this.length ); return this; } );
}

module.exports = {
	ZuzuBag,
	Pair,
	PairList,
	withArrayMethods,
};
