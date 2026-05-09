'use strict';

class Time {
	constructor( epoch = null ) {
		Object.defineProperty( this, '__zuzu_type_name', {
			value: 'Time',
			enumerable: false,
			configurable: true,
		} );
		this._epoch = epoch == null ? Math.floor( Date.now() / 1000 ) : Number( epoch );
	}

	_clone( nextEpoch ) { return new Time( nextEpoch ); }
	epoch() { return this._epoch; }
	sec() { return new Date( this._epoch * 1000 ).getUTCSeconds(); }
	min() { return new Date( this._epoch * 1000 ).getUTCMinutes(); }
	hour() { return new Date( this._epoch * 1000 ).getUTCHours(); }
	day_of_month() { return new Date( this._epoch * 1000 ).getUTCDate(); }
	mon() { return new Date( this._epoch * 1000 ).getUTCMonth() + 1; }
	month() { return this.mon(); }
	year() { return new Date( this._epoch * 1000 ).getUTCFullYear(); }
	add_seconds( n ) { return this._clone( this._epoch + Number( n ) ); }
	add_minutes( n ) { return this.add_seconds( Number( n ) * 60 ); }
	add_hours( n ) { return this.add_seconds( Number( n ) * 3600 ); }
	add_days( n ) { return this.add_seconds( Number( n ) * 86400 ); }
	add_weeks( n ) { return this.add_days( Number( n ) * 7 ); }
	add_months( n ) {
		const d = new Date( this._epoch * 1000 );
		d.setUTCMonth( d.getUTCMonth() + Number( n ) );
		return this._clone( Math.floor( d.getTime() / 1000 ) );
	}
	add_years( n ) {
		const d = new Date( this._epoch * 1000 );
		d.setUTCFullYear( d.getUTCFullYear() + Number( n ) );
		return this._clone( Math.floor( d.getTime() / 1000 ) );
	}
	datetime() { return this.strftime( '%Y-%m-%dT%H:%M:%S' ); }
	to_String() { return this.datetime(); }
	strftime( fmt ) {
		const d = new Date( this._epoch * 1000 );
		const pad = ( value, width = 2 ) => String( value ).padStart( width, '0' );
		const parts = {
			Y: pad( d.getUTCFullYear(), 4 ),
			m: pad( d.getUTCMonth() + 1 ),
			d: pad( d.getUTCDate() ),
			H: pad( d.getUTCHours() ),
			M: pad( d.getUTCMinutes() ),
			S: pad( d.getUTCSeconds() ),
			z: '+0000',
			Z: 'UTC',
			'%': '%',
		};
		return String( fmt ).replace( /%([%YmdHMSzZ])/g, ( _match, key ) => parts[key] );
	}
}

class TimeParser {
	constructor( _fmt = '%Y-%m-%d' ) {
	}

	parse( text ) {
		const m = String( text ).match( /([0-9]{1,2})(?:st|nd|rd|th)\s+([A-Za-z]{3}),\s+([0-9]{4})/u );
		if ( !m ) {
			throw new Error( 'Exception: unable to parse time string' );
		}
		const day = Number( m[1] );
		const monName = m[2].toLowerCase();
		const year = Number( m[3] );
		const months = [ 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec' ];
		const mon = months.indexOf( monName );
		if ( mon < 0 ) {
			throw new Error( 'Exception: unable to parse month' );
		}
		const epoch = Math.floor( Date.UTC( year, mon, day, 0, 0, 0 ) / 1000 );
		return new Time( epoch );
	}
}

module.exports = {
	Time,
	TimeParser,
};
