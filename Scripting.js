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
    playerPrograms: new Map(),
    activePlayerPrograms: new Map(),

    // override this function to chat messages to users
    externalUserMessage( username, isScripting, isError, helpNeeded, message ) {},

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

    isOperator( token )
    {
        return !Number.isNaN( this.getOperatorPrecedence( token ));
    },

    getOperatorPrecedence( operator )
    {
        switch( operator.type )
        {
            case "and"                : return 1;
            case "greaterThan"        : return 2;
            case "greaterThanOrEqual" : return 2;
            case "plus"               : return 3;
            default                   : return NaN;
        }
    },

    getPlayerPrograms( username )
    {
        if ( !this.playerPrograms.has( username )) this.playerPrograms.set( username, new Map() );
        return this.playerPrograms.get( username );
    },

    runPrograms()
    {
        for ( let username of this.activePlayerPrograms.keys() )
        {
            var programName = this.activePlayerPrograms.get( username );
            this.debugMessage( username, "Running Program: " + programName, 0 );

            var playerPrograms = this.getPlayerPrograms( username );
            var program = playerPrograms.get( programName );
            this.evalProgram( username, program, 1 );
        }
    },

    evalProgram( username, program, indent )
    {
        for ( var i = 0; i < program.length; i++ )
        {
            var condition = program[ i ].condition;
            var action    = program[ i ].action;
            this.debugMessage( username, "Evaluating Statement " + i + " : " + condition + " : " + action, indent );

            var result = this.evalExpression( username, condition, indent + 1 );
            if ( result === null ) continue;

            if ( result.type != "boolean" )
            {
                this.errorMessage( username, "Expected boolean, but got: " + this.tokenToString( result ), indent + 1 );
                continue;
            }

            if ( result.value )
            {
                this.debugMessage( username, "Condition evaluated to true; performing action.", indent + 1 );
                this.evalCompoundStatement( username, action, indent + 2 );
            }
            else this.debugMessage( username, "Condition evaluated to false; skipping action.", indent + 1 );
        }
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
                if ( result === null ) return;

                // replace the expression in the statement with the evaluation result
                statement = statement.replace( "{" + expression + "}", result.value );
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

        this.debugMessage( username, "After Expression Evaluation: " + statement, indent );
        this.processScriptingCommand( username, statement );
    },

    evalExpression( username, expression, indent )
    {
        this.debugMessage( username, "Evaluating Expression: {" + expression + "}", indent );

        var tokens = this.tokenize( username, expression, indent + 1 );
        if ( tokens === null ) return null;

        return this.evalTokens( username, tokens, indent + 1 );
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
        // - 2 : processing literal integer
        // - 3 : processing operator
        var state = 0;

        var token = "";

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
                    token = character;
                    state = 1;
                    continue;
                }

                // look for the the start of a literal integer
                if (( character >= "0" ) && ( character <= "9" ))
                {
                    token = character;
                    state = 2;
                    continue;
                }

                if ( character == "+" )
                {
                    tokens.push( { type: "plus" } );
                    continue;
                }

                if (( character == ">" ) || ( character == "&" ))
                {
                    token = character;
                    state = 3;
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
                    token += character;
                    continue;
                }

                // otherwise, assume we are done with the identifier
                tokens.push( { type: "identifier", name: token } );
                state = 0;
                i--; // process this character again with the new state
                continue;
            }
            else if ( state == 2 )
            {
                // look for the the next character of the integer
                if (( character >= "0" ) && ( character <= "9" ))
                {
                    token += character;
                    continue;
                }

                // otherwise, assume we are done with the integer
                tokens.push( { type: "integer", value: parseInt( token, 10 ) } );
                state = 0;
                i--; // process this character again with the new state
                continue;
            }
            else if ( state == 3 )
            {
                // look for the second character of the operator
                if (( character == "=" ) || ( character == "&" ))
                {
                    token += character;
                }
                else i--; // process this character again, but not as the second character of an operator

                state = 0;
                switch ( token )
                {
                    case "&&" : tokens.push( { type: "and"                } ); break;
                    case ">"  : tokens.push( { type: "greaterThan"        } ); break;
                    case ">=" : tokens.push( { type: "greaterThanOrEqual" } ); break;
                    default : this.errorMessage( username, "Unrecognized Operator: " + token, indent ); return null;
                }
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
        var tokenMessage = "Evaluating Tokens: ";
        for ( var i = 0; i < tokens.length; i++ )
        {
            if ( i != 0 ) tokenMessage += ", ";
            tokenMessage += this.tokenToString( tokens[ i ] );
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
            var token = tokens[ 0 ];
            if ( token.type == "identifier" )
            {
                var varName = token.name;
                this.debugMessage( username, "Variable: " + varName, indent );

                var result = this.externalVariableReference( username, varName );
                if ( result === null )
                {
                    this.errorMessage( username, "Unable to find variable.", indent );
                    return null;
                }

                this.debugMessage( username, "Value: " + this.tokenToString( result ), indent );
                return result;
            }
            else if ( token.type == "integer" ) return token;
            else
            {
                this.errorMessage( username, "Unable to evaluate.", indent );
                return null;
            }
        }

        return this.evalOperator( username, tokens, indent );
    },

    evalOperator( username, tokens, indent )
    {
        var operationType;
        var operationFunction;

        // look for the lowest precedence operator
        var operatorIndex      = NaN;
        var operatorPrecedence = NaN;
        for ( var i = 0; i < tokens.length; i++ )
        {
            var token = tokens[ i ];
            if ( this.isOperator( token ))
            {
                var tokenPrecedence = this.getOperatorPrecedence( token );
                if (( Number.isNaN( operatorPrecedence )) || ( operatorPrecedence > tokenPrecedence ))
                {
                    operatorIndex = i;
                    operatorPrecedence = tokenPrecedence;
                }
            }
        }

        if ( Number.isNaN( operatorIndex ))
        {
            this.errorMessage( username, "Unable to find operator.", indent );
            return null;
        }

        var operatorToken = tokens[ operatorIndex ];
        this.debugMessage( username, "Handling operator: " + this.tokenToString( operatorToken ), indent );

        if ( operatorToken.type == "and" )
        {
            operationType = "And";
            operationFunction = this.andOperation.bind( this );
        }
        else if ( operatorToken.type == "greaterThan" )
        {
            operationType = "Greater Than";
            operationFunction = this.greaterThanOperation.bind( this );
        }
        else if ( operatorToken.type == "greaterThanOrEqual" )
        {
            operationType = "Greater Than or Equal";
            operationFunction = this.greaterThanOrEqualOperation.bind( this );
        }
        else if ( operatorToken.type == "plus" )
        {
            operationType = "Plus";
            operationFunction = this.plusOperation.bind( this );
        }
        else
        {
            this.errorMessage( username, "Unrecognized operator.", indent );
            return null;
        }

        this.debugMessage( username, "Left Value:", indent );
        var leftValue = this.evalTokens( username, tokens.slice( 0, operatorIndex ), indent + 1 );
        if ( leftValue === null ) return null;

        this.debugMessage( username, "Right Value:", indent );
        var rightValue = this.evalTokens( username, tokens.slice( operatorIndex + 1 ), indent + 1 );
        if ( rightValue === null ) return null;

        var message = "Operation: " + operationType +
                      ", Left: " + this.tokenToString( leftValue ) +
                      ", Right: " + this.tokenToString( rightValue );
        this.debugMessage( username, message, indent );

        var result = operationFunction( username, leftValue, rightValue, indent );
        if ( result === null ) return null;
        this.debugMessage( username, "Result: " + this.tokenToString( result ), indent );
        return result;
    },

    andOperation( username, leftValue, rightValue, indent )
    {
        if (( leftValue.type != "boolean" ) || ( rightValue.type != "boolean" ))
        {
            this.errorMessage( username,
                               "Unable to perform logical and on " +
                               leftValue.type + " and " + rightValue.type + ".", indent );
            return null;
        }

        return { type: "boolean", value: leftValue.value && rightValue.value };
    },

    greaterThanOperation( username, leftValue, rightValue, indent )
    {
        if ((( leftValue.type  != "integer" ) && ( leftValue.type  != "float" )) ||
            (( rightValue.type != "integer" ) && ( rightValue.type != "float" )))
        {
            this.errorMessage(
                    username, "Unable to compare " + leftValue.type + " and " + rightValue.type + ".", indent );
            return null;
        }

        return { type: "boolean", value: leftValue.value > rightValue.value };
    },

    greaterThanOrEqualOperation( username, leftValue, rightValue, indent )
    {
        if ((( leftValue.type  != "integer" ) && ( leftValue.type  != "float" )) ||
            (( rightValue.type != "integer" ) && ( rightValue.type != "float" )))
        {
            this.errorMessage(
                    username, "Unable to compare " + leftValue.type + " and " + rightValue.type + ".", indent );
            return null;
        }

        return { type: "boolean", value: leftValue.value >= rightValue.value };
    },

    plusOperation( username, leftValue, rightValue, indent )
    {
        if ((( leftValue.type  != "integer" ) && ( leftValue.type  != "float" )) ||
            (( rightValue.type != "integer" ) && ( rightValue.type != "float" )))
        {
            this.errorMessage(
                    username, "Unable to add " + leftValue.type + " and " + rightValue.type + ".", indent );
            return null;
        }

        var type = (( leftValue.type == "float" ) || ( rightValue.type == "float" )) ? "float" : "integer";
        return { type: type, value: leftValue.value + rightValue.value };
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
            case "eval"    : this.evalCommand(    username, commandData ); return true;
            case "program" : this.programCommand( username, commandData ); return true;
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
            default : this.errorMessage( username, "Unrecognized Command: " + commandName );
        }
    },

    evalCommand( username, commandData )
    {
        this.evalCompoundStatement( username, commandData, 0 );
    },

    programCommand( username, command )
    {
        if ( command.length == 0 )
        {
            this.externalUserMessage( username, false, true, true, "you must specify a program command." );
            return;
        }

        var commandName = Util.getCommandPrefix( command );
        var commandData = Util.getCommandRemainder( command );

        switch( commandName )
        {
            case "create" : this.createProgramCommand( username, commandData ); break;
            case "add"    : this.addStatementCommand(  username, commandData ); break;
            case "run"    : this.runProgramCommand(    username, commandData ); break;
            default : this.externalUserMessage( username, false, true, true, "unrecognized program command." );
        }
    },

    createProgramCommand( username, commandData )
    {
        if ( commandData.length == 0 )
        {
            this.externalUserMessage( username, false, true, true, "you must specify a program name." );
            return;
        }

        var playerPrograms = this.getPlayerPrograms( username );
        var programName = Util.getCommandPrefix( commandData );
        if ( playerPrograms.has( programName ))
        {
            this.externalUserMessage( username, false, true, false, "program already exists." );
            return;
        }

        playerPrograms.set( programName, [] );
        this.externalUserMessage( username, false, false, false, "created program." );
    },

    addStatementCommand( username, commandData )
    {
        if ( commandData.length == 0 )
        {
            this.externalUserMessage( username, false, true, true, "you must specify a program name." );
            return;
        }

        var programName = Util.getCommandPrefix( commandData );
        var statement   = Util.getCommandRemainder( commandData );

        var playerPrograms = this.getPlayerPrograms( username );
        if ( !playerPrograms.has( programName ))
        {
            this.externalUserMessage( username, false, true, false, "program does not exist." );
            return;
        }

        var statementSplits = statement.split( ":" );
        if ( statementSplits.length != 2 )
        {
            this.externalUserMessage( username, false, true, true, "invalid statement syntax." );
            return;
        }

        var program = playerPrograms.get( programName );
        program.push( { condition: statementSplits[ 0 ].trim(), action: statementSplits[ 1 ].trim() } );
        this.externalUserMessage( username, false, false, false, "added statement." );
    },

    runProgramCommand( username, commandData )
    {
        if ( commandData.length == 0 )
        {
            this.externalUserMessage( username, false, true, true, "you must specify a program name." );
            return;
        }

        var playerPrograms = this.getPlayerPrograms( username );
        var programName = Util.getCommandPrefix( commandData );
        if ( !playerPrograms.has( programName ))
        {
            this.externalUserMessage( username, false, true, false, "program does not exist." );
            return;
        }

        this.activePlayerPrograms.set( username, programName );
        this.externalUserMessage( username, false, false, false, "running program." );
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
