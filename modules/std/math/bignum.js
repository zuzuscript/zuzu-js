'use strict';

class BigNum {
	constructor( value, text = null, isInt = null ) {
		if ( typeof value === 'bigint' ) {
			this._value = value;
			this._text = text == null ? String( value ) : String( text );
			this._isInt = isInt == null ? true : Boolean( isInt );
			return;
		}
		this._value = Number( value ?? 0 );
		this._text = text == null ? String( this._value ) : String( text );
		this._isInt = isInt == null ? Number.isInteger( this._value ) : Boolean( isInt );
	}

	static _coerce( value ) {
		if ( value instanceof BigNum ) {
			return value;
		}
		if ( typeof value === 'string' ) {
			return BigNum.from_dec( value );
		}
		return new BigNum( Number( value ?? 0 ) );
	}

	static from_dec( value ) {
		const text = String( value ?? '0' ).trim();
		const safeText = text || '0';
		if ( BigNum._isIntegerText( safeText ) ) {
			return new BigNum( BigInt( safeText ), safeText, true );
		}
		return new BigNum( Number( safeText ), safeText, !/[.eE]/.test( safeText ) );
	}

	static from_hex( value ) {
		const text = String( value ?? '0' ).trim().replace( /^0x/u, '' ).toLowerCase() || '0';
		const negative = text.startsWith( '-' );
		const digits = text.replace( /^[+-]/u, '' );
		const parsed = BigInt( `0x${digits}` ) * ( negative ? -1n : 1n );
		return new BigNum( parsed, String( parsed ), true );
	}

	is_int() {
		return this._isInt;
	}

	_toBigInt() {
		if ( !this._isInt ) {
			return null;
		}
		if ( typeof this._value === 'bigint' ) {
			return this._value;
		}
		try {
			return BigInt( this._text );
		}
		catch {
			return null;
		}
	}

	_toNumber() {
		return typeof this._value === 'bigint' ? Number( this._value ) : this._value;
	}

	bcmp( other ) {
		const rhs = BigNum._coerce( other );
		const lhsBigInt = this._toBigInt();
		const rhsBigInt = rhs._toBigInt();
		if ( lhsBigInt !== null && rhsBigInt !== null ) {
			return lhsBigInt < rhsBigInt ? -1 : ( lhsBigInt > rhsBigInt ? 1 : 0 );
		}
		return this._toNumber() < rhs._toNumber()
			? -1
			: ( this._toNumber() > rhs._toNumber() ? 1 : 0 );
	}

	beq( other ) { return this.bcmp( other ) === 0; }
	bne( other ) { return this.bcmp( other ) !== 0; }
	blt( other ) { return this.bcmp( other ) < 0; }
	ble( other ) { return this.bcmp( other ) <= 0; }
	bgt( other ) { return this.bcmp( other ) > 0; }
	bge( other ) { return this.bcmp( other ) >= 0; }

	babs() {
		const value = this._toBigInt();
		if ( value !== null ) {
			return new BigNum( value < 0n ? -value : value, String( value < 0n ? -value : value ), this._isInt );
		}
		return new BigNum( Math.abs( this._toNumber() ), String( Math.abs( this._toNumber() ) ), this._isInt );
	}

	bneg() {
		const value = this._toBigInt();
		if ( value !== null ) {
			return new BigNum( -value, String( -value ), this._isInt );
		}
		return new BigNum( -this._toNumber(), String( -this._toNumber() ), this._isInt );
	}

	binv() { return new BigNum( 1 / this._toNumber() ); }
	bsin() { return new BigNum( Math.sin( this._toNumber() ), String( Math.sin( this._toNumber() ) ), false ); }
	bcos() { return new BigNum( Math.cos( this._toNumber() ) ); }
	btan() { return new BigNum( Math.tan( this._toNumber() ), String( Math.tan( this._toNumber() ) ), false ); }
	bsqrt() { return new BigNum( Math.sqrt( this._toNumber() ) ); }
	bround() { return new BigNum( Math.round( this._toNumber() ) ); }
	bfloor() { return new BigNum( Math.floor( this._toNumber() ) ); }
	bceil() { return new BigNum( Math.ceil( this._toNumber() ) ); }

	badd( other ) {
		const rhs = BigNum._coerce( other );
		const lhsInt = this._toBigInt();
		const rhsInt = rhs._toBigInt();
		if ( lhsInt !== null && rhsInt !== null ) {
			return new BigNum( lhsInt + rhsInt, String( lhsInt + rhsInt ), false );
		}
		return new BigNum( this._toNumber() + rhs._toNumber(), String( this._toNumber() + rhs._toNumber() ), false );
	}

	bsub( other ) {
		const rhs = BigNum._coerce( other );
		const lhsInt = this._toBigInt();
		const rhsInt = rhs._toBigInt();
		if ( lhsInt !== null && rhsInt !== null ) {
			return new BigNum( lhsInt - rhsInt, String( lhsInt - rhsInt ), false );
		}
		return new BigNum( this._toNumber() - rhs._toNumber(), String( this._toNumber() - rhs._toNumber() ), false );
	}

	bmul( other ) {
		const rhs = BigNum._coerce( other );
		const lhsInt = this._toBigInt();
		const rhsInt = rhs._toBigInt();
		if ( lhsInt !== null && rhsInt !== null ) {
			return new BigNum( lhsInt * rhsInt, String( lhsInt * rhsInt ), false );
		}
		return new BigNum( this._toNumber() * rhs._toNumber(), String( this._toNumber() * rhs._toNumber() ), false );
	}

	bdiv( other ) {
		const rhs = BigNum._coerce( other );
		return new BigNum( this._toNumber() / rhs._toNumber() );
	}

	bmod( other ) {
		const rhs = BigNum._coerce( other );
		const lhsInt = this._toBigInt();
		const rhsInt = rhs._toBigInt();
		if ( lhsInt !== null && rhsInt !== null && rhsInt !== 0n ) {
			return new BigNum( lhsInt % rhsInt, String( lhsInt % rhsInt ), true );
		}
		return new BigNum( this._toNumber() % rhs._toNumber() );
	}
	bpow( other ) {
		const rhs = BigNum._coerce( other );
		const lhsInt = this._toBigInt();
		const rhsInt = rhs._toBigInt();
		if ( lhsInt !== null && rhsInt !== null && rhsInt >= 0n ) {
			let base = lhsInt;
			let power = rhsInt;
			let result = 1n;
			while ( power > 0n ) {
				if ( power & 1n ) {
					result *= base;
				}
				power >>= 1n;
				if ( power > 0n ) {
					base *= base;
				}
			}
			return new BigNum( result, String( result ), true );
		}
		return new BigNum( this._toNumber() ** rhs._toNumber() );
	}

	to_hex() {
		const value = this._toBigInt();
		if ( value === null ) {
			return `0x${Math.trunc( this._toNumber() ).toString( 16 )}`;
		}
		if ( value === 0n ) {
			return '0x0';
		}
		const absolute = value < 0n ? -value : value;
		return value < 0n ? `-0x${ absolute.toString( 16 ) }` : `0x${ absolute.toString( 16 ) }`;
	}

	to_dec() {
		if ( this._isInt ) {
			const value = this._toBigInt();
			if ( value !== null ) {
				const number = Number( value );
				if ( Number.isSafeInteger( number ) ) {
					return number;
				}
			}
			return this._textify();
		}
		return this._textify();
	}

	to_String() {
		return this.to_dec();
	}

	toString() {
		return String( this.to_String() );
	}

	to_Number() {
		return this._toNumber();
	}

	static _isIntegerText( text ) {
		return /^[+-]?(?:\d+)$/u.test( text );
	}

	_textify() {
		if ( this._text != null && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u.test( this._text ) ) {
			return this._text.replace( /\.0+$/u, '' ).replace( /(\.\d*?)0+$/u, '$1' ).replace( /\.$/u, '' );
		}
		return this._toBigInt() !== null ? this._toBigInt().toString() : String( this._value );
	}
}

module.exports = {
	BigNum,
};
