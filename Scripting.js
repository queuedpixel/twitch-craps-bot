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

var fs   = require( "fs"        );
var Util = require( "./Util.js" );

module.exports =
{
    maxCallStack: 1000,
    playerPrograms: new Map(),
    activePlayerPrograms: new Map(),
    playerFunctions: new Map(),

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

    init()
    {
        fs.readFile( "programs.json", ( err, fileData ) =>
        {
            if ( err )
            {
                Util.log( "Unable to read \"programs.json\". Resetting player programs.", true );
                return;
            }

            var data = JSON.parse( fileData );
            data.playerPrograms  = data.playerPrograms.map(  item => [ item[ 0 ], new Map( item[ 1 ] ) ] );
            data.playerFunctions = data.playerFunctions.map( item => [ item[ 0 ], new Map( item[ 1 ] ) ] );
            this.playerPrograms       = new Map( data.playerPrograms       );
            this.activePlayerPrograms = new Map( data.activePlayerPrograms );
            this.playerFunctions      = new Map( data.playerFunctions      );
        } );
    },

    saveData()
    {
        var data =
        {
            playerPrograms       : [ ...this.playerPrograms       ],
            activePlayerPrograms : [ ...this.activePlayerPrograms ],
            playerFunctions      : [ ...this.playerFunctions      ]
        };

        data.playerPrograms  = data.playerPrograms.map(  item => [ item[ 0 ], [ ...item[ 1 ]]] );
        data.playerFunctions = data.playerFunctions.map( item => [ item[ 0 ], [ ...item[ 1 ]]] );

        fs.writeFile( "programs.json", JSON.stringify( data, undefined, 4 ),
                      ( err ) => { if ( err ) throw err; } );
    },

    tokenToString( token )
    {
        if ( token.type === undefined   ) return undefined;
        if ( token.type == "identifier" ) return "[identifier: " + token.name  + "]";
        if ( token.type == "number"     ) return "[number: "     + token.value + "]";
        if ( token.type == "boolean"    ) return "[boolean: "    + token.value + "]";
        return "[" + token.type + "]";
    },

    getFunctionDetails( functionName )
    {
        switch( functionName )
        {
            case "floor" : return { paramTypes: [ "number" ], resultType: "number", functionFunction: Math.floor };
            default      : return null;
        }
    },

    isOperator( token )
    {
        return !Number.isNaN( this.getOperatorPrecedence( token ));
    },

    getOperatorPrecedence( operator )
    {
        switch( operator.type )
        {
            case "or"                 : return 1;
            case "and"                : return 2;
            case "equal"              : return 3;
            case "notEqual"           : return 3;
            case "lessThan"           : return 4;
            case "lessThanOrEqual"    : return 4;
            case "greaterThan"        : return 4;
            case "greaterThanOrEqual" : return 4;
            case "add"                : return 5;
            case "subtract"           : return 5;
            case "multiply"           : return 6;
            case "divide"             : return 6;
            case "remainder"          : return 6;
            default                   : return NaN;
        }
    },

    getPlayerPrograms( username )
    {
        if ( !this.playerPrograms.has( username )) this.playerPrograms.set( username, new Map() );
        return this.playerPrograms.get( username );
    },

    getPlayerProgram( username, programName )
    {
        var playerPrograms = this.getPlayerPrograms( username );
        if ( !playerPrograms.has( programName ))
        {
            this.externalUserMessage( username, false, true, false, "program does not exist." );
            return null;
        }

        return playerPrograms.get( programName );
    },

    getPlayerFunctions( username )
    {
        if ( !this.playerFunctions.has( username )) this.playerFunctions.set( username, new Map() );
        return this.playerFunctions.get( username );
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

            var context = { callStack: 0, params: new Map() };
            var result = this.evalExpression( username, context, condition, indent + 1 );
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
                var context = { callStack: 0, params: new Map() };
                var expression = statement.substring( expressionStart + 1, expressionEnd );
                var result = this.evalExpression( username, context, expression, indent + 1 );
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

    evalExpression( username, context, expression, indent )
    {
        this.debugMessage( username, "Evaluating Expression: {" + expression + "}", indent );
        this.debugMessage( username, "Call Stack: " + context.callStack, indent );

        var tokens = this.tokenize( username, expression, indent + 1 );
        if ( tokens === null ) return null;

        return this.evalTokens( username, context, tokens, indent + 1 );
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

                if ( character == "(" )
                {
                    tokens.push( { type: "openParen" } );
                    continue;
                }

                if ( character == "," )
                {
                    tokens.push( { type: "comma" } );
                    continue;
                }

                if ( character == ")" )
                {
                    tokens.push( { type: "closeParen" } );
                    continue;
                }

                if ( character == "+" )
                {
                    tokens.push( { type: "add" } );
                    continue;
                }

                if ( character == "-" )
                {
                    tokens.push( { type: "subtract" } );
                    continue;
                }

                if ( character == "*" )
                {
                    tokens.push( { type: "multiply" } );
                    continue;
                }

                if ( character == "/" )
                {
                    tokens.push( { type: "divide" } );
                    continue;
                }

                if ( character == "%" )
                {
                    tokens.push( { type: "remainder" } );
                    continue;
                }

                if (( character == "|" ) ||
                    ( character == "&" ) ||
                    ( character == "=" ) ||
                    ( character == "!" ) ||
                    ( character == "<" ) ||
                    ( character == ">" ))
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
                tokens.push( { type: "number", value: parseInt( token, 10 ) } );
                state = 0;
                i--; // process this character again with the new state
                continue;
            }
            else if ( state == 3 )
            {
                // look for the second character of the operator
                if (( character == "|" ) || ( character == "&" ) || ( character == "=" ))
                {
                    token += character;
                }
                else i--; // process this character again, but not as the second character of an operator

                state = 0;
                switch ( token )
                {
                    case "||" : tokens.push( { type: "or"                 } ); break;
                    case "&&" : tokens.push( { type: "and"                } ); break;
                    case "==" : tokens.push( { type: "equal"              } ); break;
                    case "!=" : tokens.push( { type: "notEqual"           } ); break;
                    case "<"  : tokens.push( { type: "lessThan"           } ); break;
                    case "<=" : tokens.push( { type: "lessThanOrEqual"    } ); break;
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

    evalTokens( username, context, tokens, indent )
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
                var identifier = token.name;
                this.debugMessage( username, "Identifer: " + identifier, indent );

                var result = context.params.has( identifier ) ?
                             context.params.get( identifier ) :
                             this.externalVariableReference( username, identifier );
                if ( result === null )
                {
                    this.errorMessage( username, "Unable to find identifier.", indent );
                    return null;
                }

                this.debugMessage( username, "Value: " + this.tokenToString( result ), indent );
                return result;
            }
            else if ( token.type == "number" ) return token;
            else
            {
                this.errorMessage( username, "Unable to evaluate.", indent );
                return null;
            }
        }

        // look for the lowest precedence operator
        var operatorIndex      = NaN;
        var operatorPrecedence = NaN;
        var parenDepth         = 0;
        var parenCount         = 0;

        for ( var i = 0; i < tokens.length; i++ )
        {
            var token = tokens[ i ];

            if ( token.type == "openParen" )
            {
                parenDepth++;
                continue;
            }

            if ( token.type == "closeParen" )
            {
                if ( parenDepth == 0 )
                {
                    this.errorMessage( username, "Missing opening parenthesis: (", indent );
                    return null;
                }

                // count the number of top-level parenthesized expressions
                if ( --parenDepth == 0 ) parenCount++;
                continue;
            }

            // only look for operators outside of parenthesized expressions
            if (( this.isOperator( token )) && ( parenDepth == 0 ))
            {
                var tokenPrecedence = this.getOperatorPrecedence( token );
                if (( Number.isNaN( operatorPrecedence )) || ( operatorPrecedence >= tokenPrecedence ))
                {
                    operatorIndex = i;
                    operatorPrecedence = tokenPrecedence;
                }
            }
        }

        if ( parenDepth != 0 )
        {
            this.errorMessage( username, "Missing closing parenthesis: )", indent );
            return null;
        }

        // strip parenthesis if the entire expression is a parenthesized expression
        if (( tokens[ 0 ].type == "openParen" ) &&
            ( tokens[ tokens.length - 1 ].type == "closeParen" ) &&
            ( parenCount == 1 ))
        {
            this.debugMessage( username, "Stripping parenthesis.", indent );
            return this.evalTokens( username, context, tokens.slice( 1, tokens.length - 1 ), indent );
        }

        // handle function calls
        if (( tokens[ 0 ].type == "identifier" ) &&
            ( tokens[ 1 ].type == "openParen" ) &&
            ( tokens[ tokens.length - 1 ].type == "closeParen" ) &&
            ( parenCount == 1 ))
        {
            var functionName = tokens[ 0 ].name;
            var paramTokens = tokens.slice( 2, tokens.length - 1 );
            return this.evalFunctionCall( username, context, functionName, paramTokens, indent );
        }

        if ( Number.isNaN( operatorIndex ))
        {
            this.errorMessage( username, "Unable to find operator.", indent );
            return null;
        }

        return this.evalOperator( username, context, tokens, operatorIndex, indent );
    },

    evalFunctionCall( username, context, functionName, paramTokens, indent )
    {
        this.debugMessage( username, "Calling function: " + functionName, indent );

        var functionDetails = this.getFunctionDetails( functionName );
        if ( functionDetails === null )
        {
            var playerFunctions = this.getPlayerFunctions( username );
            if ( !playerFunctions.has( functionName ))
            {
                this.errorMessage( username, "Unrecognized function.", indent );
                return null;
            }
        }

        // create array of parameter tokens seperated by commas
        var splitParamTokens = [];
        if ( paramTokens.length > 0 )
        {
            var lastSplit = 0;
            var parenDepth = 0;
            for ( var i = 0; i < paramTokens.length; i++ )
            {
                var token = paramTokens[ i ];

                // track the depth of paranthesized expressions
                // ignore error handling since earlier logic should already have handled it
                if ( token.type == "openParen" ) parenDepth++;
                if ( token.type == "closeParen" ) parenDepth--;

                // find commas outside of paranthesized expressions
                if (( token.type == "comma" ) && ( parenDepth == 0 ))
                {
                    splitParamTokens.push( paramTokens.slice( lastSplit, i ));
                    lastSplit = i + 1;
                }
            }

            splitParamTokens.push( paramTokens.slice( lastSplit, paramTokens.length ));
        }

        // evaluate parameters
        var params = [];
        for ( var i = 0; i < splitParamTokens.length; i++ )
        {
            this.debugMessage( username, "Evaluating Parameter " + i + ":", indent );
            var param = this.evalTokens( username, context, splitParamTokens[ i ], indent + 1 );
            if ( param === null ) return null;
            params.push( param );
        }

        var message = "Function call: " + functionName + "(";
        for ( var i = 0; i < params.length; i++ )
        {
            if ( i > 0 ) message += ",";
            message += " " + this.tokenToString( params[ i ] );
        }
        if ( params.length > 0 ) message += " ";
        message += ")";
        this.debugMessage( username, message, indent );

        if ( functionDetails !== null )
        {
            // handle system-defined functions
            if ( functionDetails.paramTypes.length != params.length )
            {
                this.errorMessage( username,
                                   "Expected " + functionDetails.paramTypes.length +
                                   " parameter" + ( functionDetails.paramTypes.length == 1 ? "" : "s" ) +
                                   ", but received " + params.length +
                                   " parameter" + ( params.length == 1 ? "" : "s" ) + ".",
                                   indent );
                return null;
            }

            for ( var i = 0; i < functionDetails.paramTypes.length; i++ )
            {
                if ( functionDetails.paramTypes[ i ] != params[ i ].type )
                {
                    this.errorMessage( username,
                                       "Expected " + functionDetails.paramTypes[ i ] +
                                       " for parameter " + i + ", but received: " + params[ i ].type,
                                       indent );
                    return null;
                }
            }

            // convert parameters into values
            var paramValues = [];
            for ( var i = 0; i < params.length; i++ ) paramValues.push( params[ i ].value );

            // call the function
            var result = { type: functionDetails.resultType, value: functionDetails.functionFunction( ...paramValues ) };
            this.debugMessage( username, "Result: " + this.tokenToString( result ), indent );
            return result;
        }
        else
        {
            // handle player-defined functions
            if ( context.callStack >= this.maxCallStack )
            {
                this.errorMessage( username, "Max call stack of " + this.maxCallStack + " exceeded.", indent );
                return null;
            }

            var playerFunction = playerFunctions.get( functionName );
            if ( playerFunction.params.length != params.length )
            {
                this.errorMessage( username,
                                   "Expected " + playerFunction.params.length +
                                   " parameter" + ( playerFunction.params.length == 1 ? "" : "s" ) +
                                   ", but received " + params.length +
                                   " parameter" + ( params.length == 1 ? "" : "s" ) + ".",
                                   indent );
                return null;
            }

            var paramsMap = new Map();
            for ( var i = 0; i < playerFunction.params.length; i++ )
            {
                paramsMap.set( playerFunction.params[ i ], params[ i ] );
            }

            var newContext = { callStack: context.callStack + 1, params: paramsMap };
            return this.evalExpression( username, newContext, playerFunction.expression, indent + 1 );
        }
    },

    evalOperator( username, context, tokens, operatorIndex, indent )
    {
        var operatorToken = tokens[ operatorIndex ];
        this.debugMessage( username, "Handling operator: " + this.tokenToString( operatorToken ), indent );

        var operationName;
        var operationFunction;
        var operandType;
        var resultType;

        if ( operatorToken.type == "or" )
        {
            operationName = "Or";
            operationFunction = this.orOperation;
            operandType = "boolean";
            resultType = "boolean";
        }
        else if ( operatorToken.type == "and" )
        {
            operationName = "And";
            operationFunction = this.andOperation;
            operandType = "boolean";
            resultType = "boolean";
        }
        else if ( operatorToken.type == "equal" )
        {
            operationName = "Equal";
            operationFunction = this.equalOperation;
            operandType = undefined;
            resultType = "boolean";
        }
        else if ( operatorToken.type == "notEqual" )
        {
            operationName = "Not Equal";
            operationFunction = this.notEqualOperation;
            operandType = undefined;
            resultType = "boolean";
        }
        else if ( operatorToken.type == "lessThan" )
        {
            operationName = "Less Than";
            operationFunction = this.lessThanOperation;
            operandType = "number";
            resultType = "boolean";
        }
        else if ( operatorToken.type == "lessThanOrEqual" )
        {
            operationName = "Less Than or Equal";
            operationFunction = this.lessThanOrEqualOperation;
            operandType = "number";
            resultType = "boolean";
        }
        else if ( operatorToken.type == "greaterThan" )
        {
            operationName = "Greater Than";
            operationFunction = this.greaterThanOperation;
            operandType = "number";
            resultType = "boolean";
        }
        else if ( operatorToken.type == "greaterThanOrEqual" )
        {
            operationName = "Greater Than or Equal";
            operationFunction = this.greaterThanOrEqualOperation;
            operandType = "number";
            resultType = "boolean";
        }
        else if ( operatorToken.type == "add" )
        {
            operationName = "Add";
            operationFunction = this.addOperation;
            operandType = "number";
            resultType = "number";
        }
        else if ( operatorToken.type == "subtract" )
        {
            operationName = "Subtract";
            operationFunction = this.subtractOperation;
            operandType = "number";
            resultType = "number";
        }
        else if ( operatorToken.type == "multiply" )
        {
            operationName = "Multiply";
            operationFunction = this.multiplyOperation;
            operandType = "number";
            resultType = "number";
        }
        else if ( operatorToken.type == "divide" )
        {
            operationName = "Divide";
            operationFunction = this.divideOperation;
            operandType = "number";
            resultType = "number";
        }
        else if ( operatorToken.type == "remainder" )
        {
            operationName = "Remainder";
            operationFunction = this.remainderOperation;
            operandType = "number";
            resultType = "number";
        }
        else
        {
            this.errorMessage( username, "Unrecognized operator.", indent );
            return null;
        }

        this.debugMessage( username, "Left Value:", indent );
        var leftValue = this.evalTokens( username, context, tokens.slice( 0, operatorIndex ), indent + 1 );
        if ( leftValue === null ) return null;

        this.debugMessage( username, "Right Value:", indent );
        var rightValue = this.evalTokens( username, context, tokens.slice( operatorIndex + 1 ), indent + 1 );
        if ( rightValue === null ) return null;

        var message = "Operation: " + operationName +
                      ", Left: " + this.tokenToString( leftValue ) +
                      ", Right: " + this.tokenToString( rightValue );
        this.debugMessage( username, message, indent );

        if (( operandType !== undefined ) &&
            (( leftValue.type != operandType ) || ( rightValue.type != operandType )))
        {
            this.errorMessage( username,
                               "Expected " + operandType + " operands, but received: " +
                               leftValue.type + " and " + rightValue.type, indent );
            return null;
        }

        var result = { type: resultType, value: operationFunction( leftValue.value, rightValue.value ) };
        this.debugMessage( username, "Result: " + this.tokenToString( result ), indent );
        return result;
    },

    orOperation(                 leftValue, rightValue ) { return leftValue ||  rightValue; },
    andOperation(                leftValue, rightValue ) { return leftValue &&  rightValue; },
    equalOperation(              leftValue, rightValue ) { return leftValue === rightValue; },
    notEqualOperation(           leftValue, rightValue ) { return leftValue !== rightValue; },
    lessThanOperation(           leftValue, rightValue ) { return leftValue <   rightValue; },
    lessThanOrEqualOperation(    leftValue, rightValue ) { return leftValue <=  rightValue; },
    greaterThanOperation(        leftValue, rightValue ) { return leftValue >   rightValue; },
    greaterThanOrEqualOperation( leftValue, rightValue ) { return leftValue >=  rightValue; },
    addOperation(                leftValue, rightValue ) { return leftValue +   rightValue; },
    subtractOperation(           leftValue, rightValue ) { return leftValue -   rightValue; },
    multiplyOperation(           leftValue, rightValue ) { return leftValue *   rightValue; },
    divideOperation(             leftValue, rightValue ) { return leftValue /   rightValue; },
    remainderOperation(          leftValue, rightValue ) { return leftValue %   rightValue; },

    processCommand( username, command )
    {
        var commandName = Util.getCommandPrefix( command );
        var commandData = Util.getCommandRemainder( command );

        switch( commandName )
        {
            case "eval"     : this.evalCommand(     username, commandData ); return true;
            case "program"  : this.programCommand(  username, commandData ); return true;
            case "function" : this.functionCommand( username, commandData ); return true;
        }

        return false;
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
            case "create" : this.createProgramCommand(   username, commandData ); break;
            case "list"   : this.listProgramsCommand(    username              ); break;
            case "view"   : this.viewProgramCommand(     username, commandData ); break;
            case "add"    : this.addStatementCommand(    username, commandData ); break;
            case "insert" : this.insertStatementCommand( username, commandData ); break;
            case "update" : this.updateStatementCommand( username, commandData ); break;
            case "remove" : this.removeStatementCommand( username, commandData ); break;
            case "run"    : this.runProgramCommand(      username, commandData ); break;
            case "stop"   : this.stopProgramCommand(     username              ); break;
            case "delete" : this.deleteProgramCommand(   username, commandData ); break;
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

    listProgramsCommand( username )
    {
        var playerPrograms = this.getPlayerPrograms( username );
        if ( playerPrograms.size == 0 )
        {
            this.externalUserMessage( username, false, false, false, "you have no programs." );
        }
        else
        {
            this.externalUserMessage( username, false, false, false,
                                      "listed " + playerPrograms.size + " program" +
                                      ( playerPrograms.size == 1 ? "" : "s" ) + "." );
        }

        for ( let programName of playerPrograms.keys() )
        {
            this.userMessage( username, programName, true );
        }
    },

    viewProgramCommand( username, commandData )
    {
        if ( commandData.length == 0 )
        {
            this.externalUserMessage( username, false, true, true, "you must specify a program name." );
            return;
        }

        var programName = Util.getCommandPrefix( commandData );
        var playerPrograms = this.getPlayerPrograms( username );
        if ( !playerPrograms.has( programName ))
        {
            this.externalUserMessage( username, false, true, false, "program does not exist." );
            return;
        }

        var program = playerPrograms.get( programName );
        for ( var i = 0; i < program.length; i++ )
        {
            this.userMessage( username, "[" + i + "] " + program[ i ].condition + " : " + program[ i ].action, true );
        }

        this.externalUserMessage( username, false, false, false,
                                  "listed " + program.length + " statement" +
                                  ( program.length == 1 ? "" : "s" ) + "." );
    },

    addStatementCommand( username, commandData )
    {
        if ( commandData.length == 0 )
        {
            this.externalUserMessage( username, false, true, true, "you must specify a program name." );
            return;
        }

        var programName = Util.getCommandPrefix( commandData );
        var statementData = Util.getCommandRemainder( commandData );

        var program = this.getPlayerProgram( username, programName );
        if ( program === null ) return;

        var statement = this.getStatementFromCommand( username, statementData );
        if ( statement === null ) return;

        program.push( statement );
        this.externalUserMessage( username, false, false, false, "added statement." );
    },

    insertStatementCommand( username, commandData )
    {
        this.insertStatement( username, commandData, false );
    },

    updateStatementCommand( username, commandData )
    {
        this.insertStatement( username, commandData, true );
    },

    insertStatement( username, commandData, deleteExisting )
    {
        if ( commandData.length == 0 )
        {
            this.externalUserMessage( username, false, true, true, "you must specify a program name." );
            return;
        }

        var programName = Util.getCommandPrefix( commandData );
        var insertData = Util.getCommandRemainder( commandData );
        var rawIndex = Util.getCommandPrefix( insertData );
        var statementData = Util.getCommandRemainder( insertData );

        var program = this.getPlayerProgram( username, programName );
        if ( program === null ) return;

        var index = Util.safeParseInt( rawIndex );
        if ( Number.isNaN( index ))
        {
            this.externalUserMessage( username, false, true, true, "unable to parse index." );
            return;
        }

        if ( index > ( deleteExisting ? program.length - 1 : program.length ))
        {
            this.externalUserMessage( username, false, true, false, "index is too large." );
            return;
        }

        var statement = this.getStatementFromCommand( username, statementData );
        if ( statement === null ) return;

        program.splice( index, deleteExisting ? 1 : 0, statement );
        this.externalUserMessage( username, false, false, false,
                                  ( deleteExisting ? "updated" : "inserted" ) + " statement." );
    },

    removeStatementCommand( username, commandData )
    {
        if ( commandData.length == 0 )
        {
            this.externalUserMessage( username, false, true, true, "you must specify a program name." );
            return;
        }

        var programName = Util.getCommandPrefix( commandData );
        var removeData = Util.getCommandRemainder( commandData );
        var rawIndex = Util.getCommandPrefix( removeData );

        var program = this.getPlayerProgram( username, programName );
        if ( program === null ) return;

        var index = Util.safeParseInt( rawIndex );
        if ( Number.isNaN( index ))
        {
            this.externalUserMessage( username, false, true, true, "unable to parse index." );
            return;
        }

        if ( index >= program.length )
        {
            this.externalUserMessage( username, false, true, false, "index is too large." );
            return;
        }

        program.splice( index, 1 );
        this.externalUserMessage( username, false, false, false, "removed statement." );
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

    stopProgramCommand( username )
    {
        if ( !this.activePlayerPrograms.has( username ))
        {
            this.externalUserMessage( username, false, true, false, "you have no program running." );
            return;
        }

        this.activePlayerPrograms.delete( username );
        this.externalUserMessage( username, false, false, false, "stopping program." );
    },

    deleteProgramCommand( username, commandData )
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

        if (( this.activePlayerPrograms.has( username )) &&
            ( this.activePlayerPrograms.get( username ) == programName ))
        {
            this.externalUserMessage( username, false, true, true, "cannot delete a running program." );
            return;
        }

        playerPrograms.delete( programName );
        this.externalUserMessage( username, false, false, false, "deleted program." );
    },

    getStatementFromCommand( username, commandData )
    {
        var splits = commandData.split( ":" );
        if ( splits.length != 2 )
        {
            this.externalUserMessage( username, false, true, true, "invalid statement syntax." );
            return null;
        }

        return { condition: splits[ 0 ].trim(), action: splits[ 1 ].trim() };
    },

    functionCommand( username, command )
    {
        if ( command.length == 0 )
        {
            this.externalUserMessage( username, false, true, true, "you must specify a function command." );
            return;
        }

        var commandName = Util.getCommandPrefix( command );
        var commandData = Util.getCommandRemainder( command );

        switch( commandName )
        {
            case "create" : this.createFunctionCommand( username, commandData ); break;
            case "list"   : this.listFunctionsCommand( username ); break;
            case "delete" : this.deleteFunctionCommand( username, commandData ); break;
            default : this.externalUserMessage( username, false, true, true, "unrecognized function command." );
        }
    },

    createFunctionCommand( username, commandData )
    {
        var identifierRegex = /^[A-Za-z_]\w*$/;

        if ( commandData.length == 0 )
        {
            this.externalUserMessage( username, false, true, true, "you must specify your function." );
            return;
        }

        var paramStart = commandData.indexOf( "(" );
        var functionName = commandData.substring( 0, paramStart );
        if ( !identifierRegex.test( functionName ))
        {
            this.externalUserMessage( username, false, true, true, "invalid function name." );
            return;
        }

        var paramEnd = commandData.indexOf( ")" );
        if ( paramEnd < 0 )
        {
            this.externalUserMessage( username, false, true, true, "missing closing parenthesis after parameters." );
            return;
        }

        var params = [];
        var paramData = commandData.substring( paramStart + 1, paramEnd );
        var paramSplits = paramData.split( "," );
        if (( paramSplits.length > 1 ) || ( paramSplits[ 0 ].trim().length > 0 ))
        {
            for ( var i = 0; i < paramSplits.length; i++ )
            {
                var paramName = paramSplits[ i ].trim();
                if ( !identifierRegex.test( paramName ))
                {
                    this.externalUserMessage( username, false, true, true, "invalid parameter name." );
                    return;
                }

                params.push( paramName );
            }
        }

        var expression = commandData.substring( paramEnd + 1 ).trim();
        if ( expression.length == 0 )
        {
            this.externalUserMessage( username, false, true, true, "you must specify an expression." );
            return;
        }

        if ( this.getFunctionDetails( functionName ) !== null )
        {
            this.externalUserMessage( username, false, true, false, "system function with this name already exists." );
            return;
        }

        var playerFunctions = this.getPlayerFunctions( username );
        var operation = playerFunctions.has( functionName ) ? "updated" : "created";
        playerFunctions.set( functionName, { params: params, expression: expression } );
        this.externalUserMessage( username, false, false, false, operation + " function." );
    },

    listFunctionsCommand( username )
    {
        var playerFunctions = this.getPlayerFunctions( username );
        if ( playerFunctions.size == 0 )
        {
            this.externalUserMessage( username, false, false, false, "you have no functions." );
        }
        else
        {
            this.externalUserMessage( username, false, false, false,
                                      "listed " + playerFunctions.size + " function" +
                                      ( playerFunctions.size == 1 ? "" : "s" ) + "." );
        }

        for ( let functionName of playerFunctions.keys() )
        {
            var functionDefinition = playerFunctions.get( functionName );
            var params = functionDefinition.params;
            var expression = functionDefinition.expression;

            var message = functionName + "(";
            for ( var i = 0; i < params.length; i++ )
            {
                if ( i > 0 ) message += ",";
                message += " " + params[ i ];
            }
            if ( params.length > 0 ) message += " ";
            message += ") " + expression;

            this.userMessage( username, message, true );
        }
    },

    deleteFunctionCommand( username, commandData )
    {
        var functionName = Util.getCommandPrefix( commandData );
        var paramStart = functionName.indexOf( "(" );
        if ( paramStart >= 0 ) functionName = functionName.substring( 0, paramStart );

        if ( functionName.length == 0 )
        {
            this.externalUserMessage( username, false, true, true, "you must specify a function name." );
            return;
        }

        var playerFunctions = this.getPlayerFunctions( username );
        if ( !playerFunctions.has( functionName ))
        {
            this.externalUserMessage( username, false, true, false, "function does not exist." );
            return;
        }

        playerFunctions.delete( functionName );
        this.externalUserMessage( username, false, false, false, "deleted function." );
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

    printCommand( username, commandData )
    {
        this.userMessage( username, "print - " + commandData, true );
    },

    errorMessage( username, message, indent = 0 )
    {
        var padding = "";
        for ( var i = 0; i < indent; i++ ) padding += "  ";
        this.userMessage( username, "error - " + padding + message, false );
    },

    infoMessage( username, message )
    {
        this.userMessage( username, "info - " + message, false );
    },

    debugMessage( username, message, indent = 0 )
    {
        var padding = "";
        for ( var i = 0; i < indent; i++ ) padding += "  ";
        this.userMessage( username, "debug - " + padding + message, false );
    },

    userMessage( username, message, toConsole )
    {
        Util.log( username + ": " + message, toConsole );
    }
};
