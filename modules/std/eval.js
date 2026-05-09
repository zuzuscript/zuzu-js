'use strict';

function evalZuzu( code ) {
	const src = String( code ?? '' );
	return ( 0, eval )( src );
}

module.exports = {
	eval: evalZuzu,
};
