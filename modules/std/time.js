'use strict';

const MONTHS = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];
const MONTH_BY_NAME = new Map( [
	[ 'jan', 1 ], [ 'january', 1 ],
	[ 'feb', 2 ], [ 'february', 2 ],
	[ 'mar', 3 ], [ 'march', 3 ],
	[ 'apr', 4 ], [ 'april', 4 ],
	[ 'may', 5 ],
	[ 'jun', 6 ], [ 'june', 6 ],
	[ 'jul', 7 ], [ 'july', 7 ],
	[ 'aug', 8 ], [ 'august', 8 ],
	[ 'sep', 9 ], [ 'sept', 9 ], [ 'september', 9 ],
	[ 'oct', 10 ], [ 'october', 10 ],
	[ 'nov', 11 ], [ 'november', 11 ],
	[ 'dec', 12 ], [ 'december', 12 ],
] );
const DAY_ABBR = [ 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun' ];
const WEEKDAY_BY_NAME = new Set( [
	'sun', 'sunday',
	'mon', 'monday',
	'tue', 'tues', 'tuesday',
	'wed', 'weds', 'wednesday',
	'thu', 'thur', 'thurs', 'thursday',
	'fri', 'friday',
	'sat', 'saturday',
] );

function defineType( object, name ) {
	Object.defineProperty( object, '__zuzu_type_name', {
		value: name,
		enumerable: false,
		configurable: true,
	} );
}

function zoneName( zone ) {
	if ( zone instanceof TimeZone ) {
		return zone.name();
	}
	if ( zone == null || String( zone ) === '' ) {
		return 'UTC';
	}
	const text = String( zone );
	if ( /^z$/iu.test( text ) || /^gmt$/iu.test( text ) ) {
		return 'UTC';
	}
	if ( /^([+-]\d\d):?(\d\d)$/u.test( text ) ) {
		return text.replace( /^([+-]\d\d):?(\d\d)$/u, '$1:$2' );
	}
	return text;
}

function isFixedOffset( zone ) {
	return /^([+-]\d\d):(\d\d)$/u.test( zoneName( zone ) );
}

function offsetSeconds( zone ) {
	const m = zoneName( zone ).match( /^([+-])(\d\d):(\d\d)$/u );
	if ( !m ) {
		return null;
	}
	const seconds = Number( m[2] ) * 3600 + Number( m[3] ) * 60;
	return m[1] === '-' ? -seconds : seconds;
}

function pad( value, width = 2, fill = '0' ) {
	return String( value ).padStart( width, fill );
}

function stripTrailingPeriod( text ) {
	return String( text ).replace( /\.+$/u, '' ).toLowerCase();
}

function weekdayIndex( parts ) {
	const date = new Date(
		parts.year,
		parts.month - 1,
		parts.day
	);
	return ( ( date.getDay() + 6 ) % 7 ) + 1;
}

function weekParts( parts ) {
	const date = new Date(
		parts.year,
		parts.month - 1,
		parts.day
	);
	const weekDay = date.getDay() || 7;
	const shifted = new Date( date );
	shifted.setDate( date.getDate() + 4 - weekDay );
	const weekYear = shifted.getFullYear();
	const yearStart = new Date( weekYear, 0, 1 );
	return {
		year: weekYear,
		week: Math.ceil( ( shifted - yearStart ) / 86400000 / 7 + 1 ),
	};
}

function dayOfMonthForDisplay( day ) {
	return String( day ).padStart( 2, ' ' );
}

function dayOfYear( parts ) {
	const start = new Date( parts.year, 0, 1 );
	const now = new Date( parts.year, parts.month - 1, parts.day );
	return ( now - start ) / 86400000;
}

function julianDay( parts ) {
	let year = parts.year;
	let month = parts.month;
	const day = parts.day;
	if ( month <= 2 ) {
		year -= 1;
		month += 12;
	}
	const a = Math.floor( ( 14 - month ) / 12 );
	const y = year + 4800 - a;
	const m = month + 12 * a - 3;
	const jd = day
		+ Math.floor( ( 153 * m + 2 ) / 5 )
		+ 365 * y
		+ Math.floor( y / 4 )
		- Math.floor( y / 100 )
		+ Math.floor( y / 400 )
		- 32045;
	const fraction = ( parts.hour * 3600 + parts.minute * 60 + parts.second ) / 86400;
	return jd + fraction - 0.5;
}

function isLeapYear( year ) {
	if ( year % 4 !== 0 ) return false;
	if ( year % 100 !== 0 ) return true;
	return year % 400 === 0;
}

function daysInMonth( year, month ) {
	if ( [ 1, 3, 5, 7, 8, 10, 12 ].includes( month ) ) return 31;
	if ( [ 4, 6, 9, 11 ].includes( month ) ) return 30;
	if ( month === 2 ) return isLeapYear( year ) ? 29 : 28;
	return 0;
}

function normaliseParts( parts ) {
	if ( parts.hour === 24 ) {
		parts.hour = 0;
	}
	return parts;
}

function partsForEpoch( epoch, zone ) {
	const name = zoneName( zone );
	if ( isFixedOffset( name ) ) {
		const d = new Date( ( epoch + offsetSeconds( name ) ) * 1000 );
		return {
			year: d.getUTCFullYear(),
			month: d.getUTCMonth() + 1,
			day: d.getUTCDate(),
			hour: d.getUTCHours(),
			minute: d.getUTCMinutes(),
			second: d.getUTCSeconds(),
			offset: offsetSeconds( name ),
		};
	}
	const formatter = new Intl.DateTimeFormat( 'en-GB-u-ca-gregory', {
		timeZone: name === 'local' ? undefined : name,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
	} );
	const out = {};
	for ( const part of formatter.formatToParts( new Date( epoch * 1000 ) ) ) {
		if ( part.type === 'year' ) out.year = Number( part.value );
		if ( part.type === 'month' ) out.month = Number( part.value );
		if ( part.type === 'day' ) out.day = Number( part.value );
		if ( part.type === 'hour' ) out.hour = Number( part.value );
		if ( part.type === 'minute' ) out.minute = Number( part.value );
		if ( part.type === 'second' ) out.second = Number( part.value );
	}
	return normaliseParts( out );
}

function offsetForEpoch( epoch, zone ) {
	if ( isFixedOffset( zone ) ) {
		return offsetSeconds( zone );
	}
	const parts = partsForEpoch( epoch, zone );
	const naive = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second
	) / 1000;
	return naive - Math.floor( epoch );
}

function sameWallEpoch( wall, zone ) {
	const name = zoneName( zone );
	let current = { ...wall };
	for ( let shift = 0; shift <= 180; shift++ ) {
		if ( shift > 0 ) {
			const shifted = new Date( Date.UTC(
				wall.year,
				wall.month - 1,
				wall.day,
				wall.hour,
				wall.minute + shift,
				wall.second
			) );
			current = {
				year: shifted.getUTCFullYear(),
				month: shifted.getUTCMonth() + 1,
				day: shifted.getUTCDate(),
				hour: shifted.getUTCHours(),
				minute: shifted.getUTCMinutes(),
				second: shifted.getUTCSeconds(),
			};
		}
		const naive = Date.UTC(
			current.year,
			current.month - 1,
			current.day,
			current.hour,
			current.minute,
			current.second
		) / 1000;
		const offsets = new Set( [
			offsetForEpoch( naive - 172800, name ),
			offsetForEpoch( naive - 86400, name ),
			offsetForEpoch( naive - 3600, name ),
			offsetForEpoch( naive, name ),
			offsetForEpoch( naive + 3600, name ),
			offsetForEpoch( naive + 86400, name ),
			offsetForEpoch( naive + 172800, name ),
		] );
		const candidates = [];
		for ( const offset of offsets ) {
			const candidate = naive - offset;
			const check = partsForEpoch( candidate, name );
			if (
				check.year === current.year
				&& check.month === current.month
				&& check.day === current.day
				&& check.hour === current.hour
				&& check.minute === current.minute
				&& check.second === current.second
			) {
				candidates.push( candidate );
			}
		}
		if ( candidates.length ) {
			return Math.min( ...candidates ) + ( wall.fraction || 0 );
		}
	}
	return Date.UTC( wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second ) / 1000;
}

function addMonthsToWall( parts, months ) {
	const total = parts.year * 12 + ( parts.month - 1 ) + Number( months );
	const year = Math.floor( total / 12 );
	const month = ( ( total % 12 ) + 12 ) % 12 + 1;
	const last = new Date( Date.UTC( year, month, 0 ) ).getUTCDate();
	return { ...parts, year, month, day: Math.min( parts.day, last ) };
}

function formatOffset( seconds, colon = true ) {
	const sign = seconds < 0 ? '-' : '+';
	const abs = Math.abs( seconds );
	const text = `${sign}${pad( Math.floor( abs / 3600 ) )}${pad( Math.floor( ( abs % 3600 ) / 60 ) )}`;
	return colon ? `${text.slice( 0, 3 )}:${text.slice( 3 )}` : text;
}

function parseOffset( text ) {
	if ( text == null || /^(?:z|utc|gmt)$/iu.test( text ) ) {
		return 0;
	}
	if ( /^ut$/iu.test( text ) ) {
		return 0;
	}
	const m = String( text ).match( /^([+-])(\d\d):?(\d\d)$/u );
	if ( !m ) {
		return null;
	}
	const hours = Number( m[2] );
	const minutes = Number( m[3] );
	if ( hours > 23 || minutes > 59 ) {
		return null;
	}
	const value = hours * 3600 + minutes * 60;
	return m[1] === '-' ? -value : value;
}

function parseRfc5322Zone( text ) {
	const offset = parseOffset( text );
	if ( offset != null ) {
		return offset;
	}
	const key = String( text ).toUpperCase();
	const legacy = {
		EST: -5 * 3600,
		EDT: -4 * 3600,
		CST: -6 * 3600,
		CDT: -5 * 3600,
		MST: -7 * 3600,
		MDT: -6 * 3600,
		PST: -8 * 3600,
		PDT: -7 * 3600,
	};
	if ( Object.prototype.hasOwnProperty.call( legacy, key ) ) {
		return legacy[key];
	}
	if ( /^[A-Z]$/u.test( key ) && key !== 'J' ) {
		const pos = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'.indexOf( key );
		if ( pos >= 0 ) {
			return pos < 12 ? ( pos + 1 ) * 3600 : -( pos - 11 ) * 3600;
		}
	}
	return null;
}

class TimeZone {
	constructor( name = 'UTC' ) {
		defineType( this, 'TimeZone' );
		this._name = zoneName( name );
	}
	static utc() { return new TimeZone( 'UTC' ); }
	static local() { return new TimeZone( 'local' ); }
	static named( name ) { return new TimeZone( name ); }
	static offset( seconds ) { return new TimeZone( formatOffset( Number( seconds ), true ) ); }
	name() { return zoneName( this._name ); }
	to_String() { return this.name(); }
}

class Duration {
	constructor( seconds = 0, options = {} ) {
		defineType( this, 'Duration' );
		this._years = Number( options.years || 0 );
		this._months = Number( options.months || 0 );
		this._weeks = Number( options.weeks || 0 );
		this._days = Number( options.days || 0 );
		this._hours = Number( options.hours || 0 );
		this._minutes = Number( options.minutes || 0 );
		this._seconds = Number( options.seconds == null ? seconds : options.seconds );
	}
	static seconds( n ) { return new Duration( n ); }
	static minutes( n ) { return new Duration( 0, { minutes: n } ); }
	static hours( n ) { return new Duration( 0, { hours: n } ); }
	static days( n ) { return new Duration( 0, { days: n } ); }
	static weeks( n ) { return new Duration( 0, { weeks: n } ); }
	static months( n ) { return new Duration( 0, { months: n } ); }
	static years( n ) { return new Duration( 0, { years: n } ); }
	years() { return this._years; }
	months() { return this._months; }
	weeks() { return this._weeks; }
	days() { return this._days; }
	hours() { return this._hours; }
	minutes() { return this._minutes; }
	seconds() { return this._seconds; }
}

class TimeFormat {
	constructor( pattern = '', options = {} ) {
		defineType( this, 'TimeFormat' );
		this._kind = options.kind || 'strftime';
		this._pattern = pattern == null ? '' : String( pattern );
		this._timezone = options.timezone == null ? null : zoneName( options.timezone );
	}
	static iso8601() { return new TimeFormat( '', { kind: 'iso8601' } ); }
	static rfc3339() { return new TimeFormat( '', { kind: 'rfc3339' } ); }
	static rfc5322() { return new TimeFormat( '', { kind: 'rfc5322' } ); }
	static strftime( pattern, options = {} ) {
		return new TimeFormat( pattern, { kind: 'strftime', timezone: options.timezone } );
	}
	format( time ) { return time.format( this ); }
	parse( text, options = {} ) {
		const parsed = parseTimeText( String( text ), this._timezone || options.timezone, true );
		return new Time( parsed.epoch, { timezone: this._timezone || options.timezone || parsed.zone } );
	}
}

function parseTimeText( text, defaultZone, requireZone ) {
	let m = text.match( /^(\d{4})-(\d\d)-(\d\d)(?:[Tt ](\d\d):(\d\d)(?::(\d\d)(?:\.\d+)?)?)?(?:\s*(Z|[+-]\d\d:?\d\d))?$/u );
	if ( m ) {
		if ( requireZone && !m[7] && defaultZone == null ) {
			throw new Error( 'Time.parse() requires a timezone' );
		}
		const offset = m[7] ? parseOffset( m[7] ) : null;
		if ( m[7] && offset == null ) {
			throw new Error( 'invalid time zone' );
		}
		const zone = m[7] ? formatOffset( offset, true ) : zoneName( defaultZone );
		const year = Number( m[1] );
		const month = Number( m[2] );
		const day = Number( m[3] );
		const hour = Number( m[4] || 0 );
		const minute = Number( m[5] || 0 );
		const second = Number( m[6] || 0 );
		if ( hour > 23 || minute > 59 || second > 59 ) {
			throw new Error( 'invalid time' );
		}
		if ( day < 1 || day > daysInMonth( year, month ) ) {
			throw new Error( 'invalid date' );
		}
		return {
			epoch: sameWallEpoch( {
				year,
				month,
				day,
				hour,
				minute,
				second,
			}, zone ),
			zone,
		};
	}
	m = text.match( /^(?:([A-Za-z.]+),\s*)?(\d{1,2})\s+([A-Za-z.]+)\s+(\d{2}|\d{4})\s+(\d{1,2}):(\d\d)(?::(\d\d))?\s+([+-]\d\d:?\d\d|[A-Za-z]{1,5})$/iu );
	if ( m ) {
		if ( m[1] && !WEEKDAY_BY_NAME.has( stripTrailingPeriod( m[1] ) ) ) {
			throw new Error( 'invalid weekday' );
		}
		const month = MONTH_BY_NAME.get( stripTrailingPeriod( m[3] ) );
		if ( !month ) throw new Error( 'invalid month' );
		let year = Number( m[4] );
		if ( String( m[4] ).length === 2 ) {
			year += year >= 50 ? 1900 : 2000;
		}
		if ( year < 1 ) {
			throw new Error( 'invalid year' );
		}
		const day = Number( m[2] );
		const hour = Number( m[5] );
		const minute = Number( m[6] );
		const second = Number( m[7] || 0 );
		if ( hour > 23 || minute > 59 || second > 59 ) {
			throw new Error( 'invalid time' );
		}
		if ( day < 1 || day > daysInMonth( year, month ) ) {
			throw new Error( 'invalid date' );
		}
		const offset = parseRfc5322Zone( m[8] );
		if ( offset == null ) {
			throw new Error( 'invalid time zone' );
		}
		const zone = formatOffset( offset, true );
		return {
			epoch: sameWallEpoch( {
				year,
				month,
				day,
				hour,
				minute,
				second,
			}, zone ),
			zone,
		};
	}
	throw new Error( 'Error parsing time' );
}

class Time {
	constructor( epoch = null, options = {} ) {
		defineType( this, 'Time' );
		this._epoch = epoch == null ? Math.floor( Date.now() / 1000 ) : Number( epoch );
		this._timezone = zoneName( options.timezone || 'UTC' );
	}

	static parse( text, options = {} ) {
		const parsed = parseTimeText( String( text ), options.timezone, true );
		return new Time( parsed.epoch, { timezone: options.timezone || parsed.zone } );
	}

	_clone( nextEpoch, zone = this._timezone ) { return new Time( nextEpoch, { timezone: zone } ); }
	_parts() { return partsForEpoch( this._epoch, this._timezone ); }
	epoch() { return this._epoch; }
	timezone() { return new TimeZone( this._timezone ); }
	with_timezone( zone ) { return this._clone( this._epoch, zoneName( zone ) ); }
	reinterpret_timezone( zone ) {
		return this._clone( sameWallEpoch( this._parts(), zone ), zoneName( zone ) );
	}
	as_utc() { return this.with_timezone( 'UTC' ); }
	as_local() { return this.with_timezone( 'local' ); }
	sec() { return this._parts().second; }
	min() { return this._parts().minute; }
	hour() { return this._parts().hour; }
	day_of_month() { return this._parts().day; }
	mon() { return this._parts().month; }
	month() { return this.mon(); }
	year() { return this._parts().year; }
	yy() { return pad( this._parts().year % 100, 2 ); }
	day_of_week() { return weekdayIndex( this._parts() ); }
	day() { return DAY_ABBR[ this.day_of_week() - 1 ]; }
	day_of_year() { return dayOfYear( this._parts() ); }
	month_last_day() { return daysInMonth( this._parts().year, this._parts().month ); }
	hms( separator = ':' ) {
		const p = this._parts();
		return `${pad( p.hour )}${String( separator )}${pad( p.minute )}${String( separator )}${pad( p.second )}`;
	}
	ymd( separator = '-' ) {
		const p = this._parts();
		const sep = String( separator );
		return `${pad( p.year, 4 )}${sep}${pad( p.month )}${sep}${pad( p.day )}`;
	}
	mdy( separator = '-' ) {
		const p = this._parts();
		const sep = String( separator );
		return `${pad( p.month )}${sep}${pad( p.day )}${sep}${pad( p.year, 4 )}`;
	}
	dmy( separator = '-' ) {
		const p = this._parts();
		const sep = String( separator );
		return `${pad( p.day )}${sep}${pad( p.month )}${sep}${pad( p.year, 4 )}`;
	}
	cdate() {
		const p = this._parts();
		return `${DAY_ABBR[ weekdayIndex( p ) - 1 ]} ${MONTHS[p.month - 1]} ${dayOfMonthForDisplay( p.day )} ${pad( p.hour )}:${pad( p.minute )}:${pad( p.second )} ${p.year}`;
	}
	tzoffset() { return offsetForEpoch( this._epoch, this._timezone ); }
	is_leap_year() { return isLeapYear( this._parts().year ); }
	week() { return weekParts( this._parts() ).week; }
	week_year() { return weekParts( this._parts() ).year; }
	julian_day() { return julianDay( this._parts() ); }
	add_seconds( n ) { return this._clone( this._epoch + Number( n ) ); }
	add_minutes( n ) { return this.add_seconds( Number( n ) * 60 ); }
	add_hours( n ) { return this.add_seconds( Number( n ) * 3600 ); }
	_calendarAdd( delta ) {
		let parts = this._parts();
		if ( delta.years ) parts = addMonthsToWall( parts, Number( delta.years ) * 12 );
		if ( delta.months ) parts = addMonthsToWall( parts, delta.months );
		const dayDelta = Number( delta.days || 0 ) + Number( delta.weeks || 0 ) * 7;
		if ( dayDelta ) {
			const d = new Date( Date.UTC(
				parts.year,
				parts.month - 1,
				parts.day + dayDelta,
				parts.hour,
				parts.minute,
				parts.second
			) );
			parts = {
				year: d.getUTCFullYear(),
				month: d.getUTCMonth() + 1,
				day: d.getUTCDate(),
				hour: d.getUTCHours(),
				minute: d.getUTCMinutes(),
				second: d.getUTCSeconds(),
			};
		}
		return this._clone( sameWallEpoch( parts, this._timezone ) );
	}
	add_days( n ) { return this._calendarAdd( { days: n } ); }
	add_weeks( n ) { return this._calendarAdd( { weeks: n } ); }
	add_months( n ) { return this._calendarAdd( { months: n } ); }
	add_years( n ) { return this._calendarAdd( { years: n } ); }
	subtract_seconds( n ) { return this.add_seconds( -Number( n ) ); }
	subtract_minutes( n ) { return this.add_minutes( -Number( n ) ); }
	subtract_hours( n ) { return this.add_hours( -Number( n ) ); }
	subtract_days( n ) { return this.add_days( -Number( n ) ); }
	subtract_weeks( n ) { return this.add_weeks( -Number( n ) ); }
	subtract_months( n ) { return this.add_months( -Number( n ) ); }
	subtract_years( n ) { return this.add_years( -Number( n ) ); }
	add( duration ) {
		return this.add_seconds(
			Number( duration.seconds() )
			+ Number( duration.minutes() ) * 60
			+ Number( duration.hours() ) * 3600
		)._calendarAdd( {
			days: duration.days(),
			weeks: duration.weeks(),
			months: duration.months(),
			years: duration.years(),
		} );
	}
	subtract( duration ) {
		return this.add( new Duration( -duration.seconds(), {
			minutes: -duration.minutes(),
			hours: -duration.hours(),
			days: -duration.days(),
			weeks: -duration.weeks(),
			months: -duration.months(),
			years: -duration.years(),
		} ) );
	}
	elapsed_seconds_until( other ) { return other.epoch() - this._epoch; }
	compare( other ) { return this._epoch < other.epoch() ? -1 : this._epoch > other.epoch() ? 1 : 0; }
	is_before( other ) { return this._epoch < other.epoch(); }
	is_after( other ) { return this._epoch > other.epoch(); }
	datetime() { return this.strftime( '%Y-%m-%dT%H:%M:%S' ); }
	to_String() { return this.datetime(); }
	to_iso8601() { return this.to_rfc3339(); }
	to_rfc3339() {
		const p = this._parts();
		return `${pad( p.year, 4 )}-${pad( p.month )}-${pad( p.day )}T${pad( p.hour )}:${pad( p.minute )}:${pad( p.second )}${formatOffset( offsetForEpoch( this._epoch, this._timezone ), true )}`;
	}
	to_rfc5322( options = {} ) {
		const p = this._parts();
		const weekday = DAY_ABBR[ weekdayIndex( p ) - 1 ];
		const core = `${pad( p.day )} ${MONTHS[p.month - 1]} ${pad( p.year, 4 )} ${pad( p.hour )}:${pad( p.minute )}:${pad( p.second )} ${formatOffset( offsetForEpoch( this._epoch, this._timezone ), false )}`;
		return options.include_weekday === false ? core : `${weekday}, ${core}`;
	}
	format( timeFormat ) {
		const time = timeFormat._timezone == null ? this : this.with_timezone( timeFormat._timezone );
		if ( timeFormat._kind === 'iso8601' || timeFormat._kind === 'rfc3339' ) return time.to_rfc3339();
		if ( timeFormat._kind === 'rfc5322' ) return time.to_rfc5322();
		return time.strftime( timeFormat._pattern );
	}
	strftime( fmt ) {
		const p = this._parts();
		const offset = offsetForEpoch( this._epoch, this._timezone );
		const parts = {
			Y: pad( p.year, 4 ),
			m: pad( p.month ),
			d: pad( p.day ),
			H: pad( p.hour ),
			M: pad( p.minute ),
			S: pad( p.second ),
			z: formatOffset( offset, false ),
			Z: this._timezone,
			'%': '%',
		};
		return String( fmt ).replace( /%([%YmdHMSzZ])/g, ( _match, key ) => parts[key] );
	}
}

class TimeParser {
	constructor( _fmt = '%Y-%m-%d' ) {
		this._format = String( _fmt );
	}

	parse( text ) {
		const m = String( text ).match( /(?:[A-Za-z]+\.?\s+)?([0-9]{1,2})(?:st|nd|rd|th)\s+([A-Za-z]{3}),\s+([0-9]{4})/u );
		if ( !m ) {
			try {
				return new Time( parseTimeText( String( text ), 'UTC', false ).epoch, { timezone: 'UTC' } );
			}
			catch ( _err ) {
				throw new Error( 'Exception: unable to parse time string' );
			}
		}
		const day = Number( m[1] );
		const mon = MONTH_BY_NAME.get( m[2].toLowerCase() );
		const year = Number( m[3] );
		if ( !mon ) {
			throw new Error( 'Exception: unable to parse month' );
		}
		return new Time( sameWallEpoch( {
			year,
			month: mon,
			day,
			hour: 0,
			minute: 0,
			second: 0,
		}, 'UTC' ), { timezone: 'UTC' } );
	}
}

module.exports = {
	Time,
	TimeZone,
	Duration,
	TimeFormat,
	TimeParser,
};
