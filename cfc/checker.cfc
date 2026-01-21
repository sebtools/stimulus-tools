component checker {

	/*
	This component provides remote functions to validate usernames.
	Normally this wouldn't have as many separate functions,
	but it does so to demonstrate different ways the cfc controller can be used.
	*/

	public function init() {
		return This;
	}
	remote string function getUsernameMessage( required string username) returnformat="plain" {

		return getUsernameValidityMessage( isValidUsername( username ) );
	}

	remote string function getUsernameValidityMessage( required boolean isValid) returnformat="plain" {
		
		if ( Arguments.isValid ) {
			return "Username is valid.";
		} else {
			return "Invalid username. It must be at least 3 characters long and contain only alphanumeric characters. 'admin' and 'root' are not allowed.";
		}
	}

	remote boolean function isValidUsername( required string username) returnformat="plain" {
		// Simple validation: username must be at least 3 characters and contain only alphanumeric characters
		if (
			NOT (
				Len(Arguments.username) >= 3
				AND
				REFind("^[a-zA-Z0-9]+$", Arguments.username)
			)
		) {
			return false;
		}

		if ( Arguments.username EQ "admin" OR Arguments.username EQ "root" ) {
			return false;
		}

		return true;
	}

	remote string function validateUsername( required string username) returnformat="plain" {

		if ( NOT isValidUsername( Arguments.username ) ) {
			return getUsernameValidityMessage( false );
		}

		return "";
	}

}