'use strict';

class BigNum {
	constructor( value, text = null, isInt = null ) {
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
		return new BigNum( Number( text || '0' ), text || '0', !/[.eE]/.test( text ) );
	}

	static from_hex( value ) {
		const text = String( value ?? '0' ).trim().toLowerCase().replace( /^0x/u, '' ) || '0';
		const parsed = Number.parseInt( text, 16 );
		return new BigNum( parsed, String( parsed ), true );
	}

	get is_int() {
		return this._isInt;
	}

	bcmp( other ) {
		const rhs = BigNum._coerce( other )._value;
		return this._value < rhs ? -1 : ( this._value > rhs ? 1 : 0 );
	}

	beq( other ) { return this.bcmp( other ) === 0; }
	bne( other ) { return this.bcmp( other ) !== 0; }
	blt( other ) { return this.bcmp( other ) < 0; }
	ble( other ) { return this.bcmp( other ) <= 0; }
	bgt( other ) { return this.bcmp( other ) > 0; }
	bge( other ) { return this.bcmp( other ) >= 0; }

	get babs() { return new BigNum( Math.abs( this._value ), String( Math.abs( this._value ) ), this._isInt ); }
	get bneg() { return new BigNum( -this._value, String( -this._value ), this._isInt ); }
	get binv() { return new BigNum( 1 / this._value ); }
	get bsin() { return new BigNum( Math.sin( this._value ), String( Math.sin( this._value ) ), false ); }
	get bcos() { return new BigNum( Math.cos( this._value ) ); }
	get btan() { return new BigNum( Math.tan( this._value ), String( Math.tan( this._value ) ), false ); }
	get bsqrt() { return new BigNum( Math.sqrt( this._value ) ); }
	get bround() { return new BigNum( Math.round( this._value ) ); }
	get bfloor() { return new BigNum( Math.floor( this._value ) ); }
	get bceil() { return new BigNum( Math.ceil( this._value ) ); }

	badd( other ) { return new BigNum( this._value + BigNum._coerce( other )._value, String( this._value + BigNum._coerce( other )._value ), false ); }
	bsub( other ) { return new BigNum( this._value - BigNum._coerce( other )._value, String( this._value - BigNum._coerce( other )._value ), false ); }
	bmul( other ) { return new BigNum( this._value * BigNum._coerce( other )._value, String( this._value * BigNum._coerce( other )._value ), false ); }
	bdiv( other ) { return new BigNum( this._value / BigNum._coerce( other )._value ); }
	bmod( other ) { return new BigNum( this._value % BigNum._coerce( other )._value ); }
	bpow( other ) { return new BigNum( this._value ** BigNum._coerce( other )._value ); }

	get to_hex() {
		return `0x${Math.trunc( this._value ).toString( 16 )}`;
	}

	get to_dec() {
		return this._isInt ? Math.trunc( this._value ) : this._textify();
	}

	get to_String() {
		return this.to_dec;
	}

	get to_Number() {
		return this._value;
	}

	_textify() {
		if ( this._text != null && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u.test( this._text ) ) {
			return this._text.replace( /\.0+$/u, '' ).replace( /(\.\d*?)0+$/u, '$1' ).replace( /\.$/u, '' );
		}
		return String( this._value );
	}
}

module.exports = {
	BigNum,
};
