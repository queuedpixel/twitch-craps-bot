/*

Twitch Craps Bot : Twitch Craps Table Chat Bot

Copyright (c) 2019 Queued Pixel <git@queuedpixel.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

var Util = require( "./Util.js" );

module.exports =
{
    // override this function to process scripting commands
    externalProcessScriptingCommand( username, command )
    {
        return false;
    },

    // override this function to process variable references
    externalVariableReference( username, varName )
    {
        return null;
    },

    evalCompoundStatement( username, compoundStatement, indent )
    {
        this.debugMessage( username, "Evaluating Compound Statement: " + compoundStatement, indent );

        var statements = compoundStatement.split( ";" );
        statements.forEach( function( statement )
        {
            statement = statement.trim();
            this.evalStatement( username, statement, indent + 1 );
        }.bind( this ));
    },

    evalStatement( username, statement, indent )
    {
        this.debugMessage( username, "Evaluating Single Statement: " + statement, indent );

        var expressionsRemain = true;
        while ( expressionsRemain )
        {
            // check for opening bracket, indicating the start of an expression
            var expressionStart = statement.indexOf( "{" );
            if ( expressionStart >= 0 )
            {
                // ensure that we have a closing bracket
                var expressionEnd = statement.indexOf( "}" );
                if ( expressionEnd < 0 )
                {
                    this.errorMessage( username, "Missing closing bracket: }", indent );
                    return;
                }

                // ensure that the closing bracket appears after the opening bracket
                if ( expressionEnd < expressionStart )
                {
                    this.errorMessage( username, "Missing opening bracket: {", indent );
                    return;
                }

                // evaluate the expression
                var expression = statement.substring( expressionStart + 1, expressionEnd );
                var result = this.evalExpression( username, expression, indent + 1 );
                if ( result === null )
                {
                    this.errorMessage( username, "Failed to evaluate expression.", indent );
                    return;
                }

                // replace the expression in the statement with the evaluation result
                statement = statement.replace( "{" + expression + "}", result.value );
                this.debugMessage( username, "After Expression Evaluation: " + statement, indent );
            }
            else
            {
                // when there is no opening bracket, ensure that there is no mismatched closing bracket
                var expressionEnd = statement.indexOf( "}" );
                if ( expressionEnd >= 0 )
                {
                    this.errorMessage( username, "Missing opening bracket: {", indent );
                    return;
                }

                expressionsRemain = false;
            }
        }

        this.processScriptingCommand( username, statement );
    },

    evalExpression( username, expression, indent )
    {
        this.debugMessage( username, "Evaluating Expression: " + expression, indent );

        var tokens = this.tokenize( username, expression, indent + 1 );
        if ( tokens === null )
        {
            this.errorMessage( username, "Failed to tokenize expression.", indent );
            return null;
        }

        var result = this.evalTokens( username, tokens, indent + 1 );
        if ( result === null )
        {
            this.errorMessage( username, "Failed to evaluate tokens.", indent );
            return null;
        }

        this.debugMessage( username, "Result: " + this.tokenToString( result ), indent );
        return result;
    },

    // process scripting commands; return true if a command was processed, false otherwise
    tokenize( username, expression, indent )
    {
        // add space to the end of the expression to make easier to handle tokens at the end of the expression
        expression += " ";

        var tokens = [];

        // possible states:
        // - 0 : start state
        // - 1 : processing identifier
        var state = 0;

        var identifier = "";

        for ( var i = 0; i < expression.length; i++ )
        {
            var character = expression.charAt( i );

            if ( state == 0 )
            {
                // ignore whitespace
                if ( character == " " ) continue;

                // look for the the start of an identifier
                if ((( character >= "a" ) && ( character <= "z" )) ||
                    (( character >= "A" ) && ( character <= "Z" )) ||
                    ( character == "_" ))
                {
                    identifier = character;
                    state = 1;
                    continue;
                }

                // look for plus sign
                if ( character == "+" )
                {
                    tokens.push( { type: "plus" } );
                    continue;
                }

                this.errorMessage( username, "Unrecognized Character: [" + character + "]", indent );
                return null;
            }
            else if ( state == 1 )
            {
                // look for the the next character of the identifier
                if ((( character >= "a" ) && ( character <= "z" )) ||
                    (( character >= "A" ) && ( character <= "Z" )) ||
                    (( character >= "0" ) && ( character <= "9" )) ||
                    ( character == "_" ))
                {
                    identifier += character;
                    continue;
                }

                // otherwise, assume we are done with the identifier
                tokens.push( { type: "identifier", name: identifier } );
                state = 0;
                i--; // process this character again with the new state
                continue;
            }
            else
            {
                this.errorMessage( username, "Unrecognized State: " + state, indent );
                return null;
            }
        }

        return tokens;
    },

    evalTokens( username, tokens, indent )
    {
        var tokenMessage = "Evaluating Tokens:";
        for ( var i = 0; i < tokens.length; i++ )
        {
            if ( i != 0 ) tokenMessage += ",";
            tokenMessage += " " + this.tokenToString( tokens[ i ] );
        }

        this.debugMessage( username, tokenMessage, indent );

        if ( tokens.length == 0 )
        {
            this.errorMessage( username, "No tokens found.", indent );
            return null;
        }

        // handle single tokens
        if ( tokens.length == 1 )
        {
            if ( tokens[ 0 ].type == "identifier" )
            {
                var varName = tokens[ 0 ].name;
                this.debugMessage( username, "Variable Lookup: " + varName, indent );

                var result = this.externalVariableReference( username, varName );
                if ( result === null )
                {
                    this.errorMessage( username, "Unable to find variable.", indent );
                    return null;
                }

                this.debugMessage( username, "Result: " + this.tokenToString( result ), indent );
                return result;
            }
            else
            {
                this.errorMessage( username, "Unable to evaluate.", indent );
                return null;
            }
        }

        // handle plus operator
        if ( tokens[ 1 ].type == "plus" )
        {
            this.debugMessage( username, "Handling Plus", indent );
            this.debugMessage( username, "Left Value:", indent );
            var leftValue = this.evalTokens( username, tokens.slice( 0, 1 ), indent + 1 );
            if ( leftValue === null )
            {
                this.errorMessage( username, "Unable to evaluate left value.", indent );
                return null;
            }

            this.debugMessage( username, "Right Value:", indent );
            var rightValue = this.evalTokens( username, tokens.slice( 2 ), indent + 1 );
            if ( rightValue === null )
            {
                this.errorMessage( username, "Unable to evaluate right value.", indent );
                return null;
            }

            var message = "Adding " + this.tokenToString( leftValue ) + " and " + this.tokenToString( rightValue );
            this.debugMessage( username, message, indent );

            if ( leftValue.type != rightValue.type )
            {
                this.errorMessage(
                        username, "Unable to add " + leftValue.type + " and " + rightValue.type + ".", indent );
                return null;
            }

            if (( leftValue.type != "integer" ) && ( leftValue.type != "float" ))
            {
                this.errorMessage( username, "Unable to add " + leftValue.type + " values.", indent );
                return null;
            }

            var result = { type: leftValue.type, value: leftValue.value + rightValue.value };
            this.debugMessage( username, "Result: " + this.tokenToString( result ), indent );
            return result;
        }
        else
        {
            this.errorMessage( username, "Expected operator, but got: " + this.tokenToString( tokens[ 1 ] ), indent );
            return null;
        }
    },

    tokenToString( token )
    {
        if ( token.type === undefined   ) return undefined;
        if ( token.type == "identifier" ) return "[identifier: " + token.name  + "]";
        if ( token.type == "integer"    ) return "[integer: "    + token.value + "]";
        if ( token.type == "float"      ) return "[float: "      + token.value + "]";
        if ( token.type == "boolean"    ) return "[boolean: "    + token.value + "]";
        return "[" + token.type + "]";
    },

    processCommand( username, command )
    {
        var commandName = Util.getCommandPrefix( command );
        var commandData = Util.getCommandRemainder( command );

        switch( commandName )
        {
            case "eval" : this.evalCommand( username, commandData ); return true;
        }

        return false;
    },

    processScriptingCommand( username, command )
    {
        if ( command.length == 0 )
        {
            this.errorMessage( username, "No command specified." );
            return;
        }

        var commandName = Util.getCommandPrefix( command );
        var commandData = Util.getCommandRemainder( command );

        // allow the external system to process the command rather than this function
        if ( this.externalProcessScriptingCommand( username, command )) return;

        switch( commandName )
        {
            case "print" : this.printCommand( username, commandData ); break;
            default : this.errorMessage( username, "Unrecognized Command: " + commandName ); break;
        }
    },

    evalCommand( username, commandData )
    {
        this.evalCompoundStatement( username, commandData, 0 );
    },

    printCommand( username, commandData )
    {
        this.userMessage( username, "print - " + commandData );
    },

    errorMessage( username, message, indent = 0 )
    {
        var padding = "";
        for ( var i = 0; i < indent; i++ ) padding += "  ";
        this.userMessage( username, "error - " + padding + message );
    },

    infoMessage( username, message )
    {
        this.userMessage( username, "info - " + message );
    },

    debugMessage( username, message, indent = 0 )
    {
        var padding = "";
        for ( var i = 0; i < indent; i++ ) padding += "  ";
        this.userMessage( username, "debug - " + padding + message );
    },

    userMessage( username, message )
    {
        console.log( username + ": " + message );
    }
};
