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

    evalCompoundStatement( username, compoundStatement )
    {
        this.debugMessage( username, "Evaluating Compound Statement: " + compoundStatement );

        var statements = compoundStatement.split( ";" );
        statements.forEach( function( statement )
        {
            statement = statement.trim();
            this.evalStatement( username, statement );
        }.bind( this ));
    },

    evalStatement( username, statement )
    {
        this.debugMessage( username, "Evaluating Single Statement: " + statement );

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
                    this.errorMessage( username, "Missing closing bracket: }" );
                    return;
                }

                // ensure that the closing bracket appears after the opening bracket
                if ( expressionEnd < expressionStart )
                {
                    this.errorMessage( username, "Missing opening bracket: {" );
                    return;
                }

                // evaluate the expression
                var expression = statement.substring( expressionStart + 1, expressionEnd );
                var result = this.evalExpression( username, expression );
                if ( result === null )
                {
                    this.errorMessage( username, "Failed to evaluate expression." );
                    return;
                }

                // replace the expression in the statement with the evaluation result
                statement = statement.replace( "{" + expression + "}", result );
                this.debugMessage( username, "After Expression Evaluation: " + statement );
            }
            else
            {
                // when there is no opening bracket, ensure that there is no mismatched closing bracket
                var expressionEnd = statement.indexOf( "}" );
                if ( expressionEnd >= 0 )
                {
                    this.errorMessage( username, "Missing opening bracket: {" );
                    return;
                }

                expressionsRemain = false;
            }
        }

        this.processScriptingCommand( username, statement );
    },

    evalExpression( username, expression )
    {
        this.debugMessage( username, "Evaluating Expression: " + expression );

        var result = this.externalVariableReference( username, expression );
        if ( result === null )
        {
            this.errorMessage( username, "Unable to find variable: " + expression );
            return null;
        }

        this.debugMessage( username, "Result: " + result );
        return result;
    },

    // process scripting commands; return true if a command was processed, false otherwise
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
        this.evalCompoundStatement( username, commandData );
    },

    printCommand( username, commandData )
    {
        this.userMessage( username, "print - " + commandData );
    },

    errorMessage( username, message )
    {
        this.userMessage( username, "error - " + message );
    },

    infoMessage( username, message )
    {
        this.userMessage( username, "info - " + message );
    },

    debugMessage( username, message )
    {
        this.userMessage( username, "debug - " + message );
    },

    userMessage( username, message )
    {
        console.log( username + ": " + message );
    }
};
