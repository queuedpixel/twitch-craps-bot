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

var fs   = require( "fs"        ).promises;
var Util = require( "./Util.js" );

module.exports =
{
    identifierRegex: /^[A-Za-z_]\w*$/,
    maxCallStack: 1000,
    playerPrograms: new Map(),
    activePlayerPrograms: new Map(),
    playerFunctions: new Map(),
    playerVariables: new Map(),
    runningUsername: null,
    initializingProgram: false,

    // override this function to send chat messages to users
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

    // override this function to change how programs are run, when initiated by the scripting engine
    externalRunPrograms()
    {
        this.runPrograms();
    },

    init()
    {
        return fs.readFile( "programs.json" )
        .then( fileData =>
        {
            var data = JSON.parse( fileData );
            data.playerPrograms  = data.playerPrograms.map(  item => [ item[ 0 ], new Map( item[ 1 ] ) ] );
            data.playerFunctions = data.playerFunctions.map( item => [ item[ 0 ], new Map( item[ 1 ] ) ] );
            data.playerVariables = data.playerVariables.map( item => [ item[ 0 ], new Map( item[ 1 ] ) ] );
            this.playerPrograms       = new Map( data.playerPrograms       );
            this.activePlayerPrograms = new Map( data.activePlayerPrograms );
            this.playerFunctions      = new Map( data.playerFunctions      );
            this.playerVariables      = new Map( data.playerVariables      );
        },
        () => { Util.log( "Unable to read \"programs.json\". Resetting player programs.", true ); } );
    },

    saveData()
    {
        var data =
        {
            playerPrograms       : [ ...this.playerPrograms       ],
            activePlayerPrograms : [ ...this.activePlayerPrograms ],
            playerFunctions      : [ ...this.playerFunctions      ],
            playerVariables      : [ ...this.playerVariables      ]
        };

        data.playerPrograms  = data.playerPrograms.map(  item => [ item[ 0 ], [ ...item[ 1 ]]] );
        data.playerFunctions = data.playerFunctions.map( item => [ item[ 0 ], [ ...item[ 1 ]]] );
        data.playerVariables = data.playerVariables.map( item => [ item[ 0 ], [ ...item[ 1 ]]] );

        fs.writeFile( "programs.json", JSON.stringify( data, undefined, 4 ))
        .catch( error => { console.log( error ); process.exit( 1 ); } );
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

    isUnaryOperator( token )
    {
        return token.type == "negate" || token.type == "not";
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
            case "negate"             : return 7;
            case "not"                : return 7;
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

    getPlayerVariables( username )
    {
        if ( !this.playerVariables.has( username )) this.playerVariables.set( username, new Map() );
        return this.playerVariables.get( username );
    },

    playerVariableReference( username, varName )
    {
        var playerVariables = this.getPlayerVariables( username );
        return playerVariables.has( varName ) ? playerVariables.get( varName ) : null;
    },

    scriptingVariableReference( varName )
    {
        switch( varName )
        {
            case "true"  : return { type: "boolean", value: true                     };
            case "false" : return { type: "boolean", value: false                    };
            case "init"  : return { type: "boolean", value: this.initializingProgram };
        }

        return null;
    },

    runPrograms()
    {
        for ( let username of this.activePlayerPrograms.keys() )
        {
            // if running programs for a specific user, skip over programs from other users
            if (( this.runningUsername !== null ) && ( this.runningUsername != username )) continue;

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
                    if (( tokens.length == 0 ) ||
                        ( this.isOperator( tokens[ tokens.length - 1 ] )) ||
                        ( tokens[ tokens.length - 1 ].type == "openParen" ))
                    {
                        tokens.push( { type: "negate" } );
                    }
                    else
                    {
                        tokens.push( { type: "subtract" } );
                    }
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
                    case "!"  : tokens.push( { type: "not"                } ); break;
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

                var result = null;
                if ( context.params.has( identifier )) result = context.params.get( identifier );
                if ( result === null ) result = this.scriptingVariableReference( identifier );
                if ( result === null ) result = this.externalVariableReference( username, identifier );
                if ( result === null ) result = this.playerVariableReference( username, identifier );
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
                if (( Number.isNaN( operatorPrecedence )) ||     // we haven't found any operators yet
                    ( operatorPrecedence > tokenPrecedence ) ||  // token is lower-precedence operator
                    (( !this.isUnaryOperator( token )) &&
                     ( operatorPrecedence == tokenPrecedence ))) // token is left-to-right operator of same precedence
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


        if ( this.isUnaryOperator( tokens[ operatorIndex ] ))
        {
            return this.evalUnaryOperator( username, context, tokens, operatorIndex, indent );
        }
        else
        {
            return this.evalBinaryOperator( username, context, tokens, operatorIndex, indent );
        }
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

    evalUnaryOperator( username, context, tokens, operatorIndex, indent )
    {
        var operatorToken = tokens[ operatorIndex ];
        this.debugMessage( username, "Handling unary operator: " + this.tokenToString( operatorToken ), indent );

        var operationName;
        var operationFunction;
        var operandType;
        var resultType;

        if ( operatorToken.type == "negate" )
        {
            operationName = "Negate";
            operationFunction = this.negateOperation;
            operandType = "number";
            resultType = "number";
        }
        else if ( operatorToken.type == "not" )
        {
            operationName = "Not";
            operationFunction = this.notOperation;
            operandType = "boolean";
            resultType = "boolean";
        }
        else
        {
            this.errorMessage( username, "Unrecognized unary operator.", indent );
            return null;
        }

        this.debugMessage( username, "Operand:", indent );
        var operand = this.evalTokens( username, context, tokens.slice( operatorIndex + 1 ), indent + 1 );
        if ( operand === null ) return null;

        var message = "Operation: " + operationName + ", Operand: " + this.tokenToString( operand );
        this.debugMessage( username, message, indent );

        if ( operand.type != operandType )
        {
            this.errorMessage( username,
                               "Expected " + operandType + " operand, but received: " + operand.type, indent );
            return null;
        }

        var result = { type: resultType, value: operationFunction( operand.value ) };
        this.debugMessage( username, "Result: " + this.tokenToString( result ), indent );
        return result;
    },

    negateOperation( operand ) { return -operand; },
    notOperation(    operand ) { return !operand; },

    evalBinaryOperator( username, context, tokens, operatorIndex, indent )
    {
        var operatorToken = tokens[ operatorIndex ];
        this.debugMessage( username, "Handling binary operator: " + this.tokenToString( operatorToken ), indent );

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
            this.errorMessage( username, "Unrecognized binary operator.", indent );
            return null;
        }

        this.debugMessage( username, "Left Operand:", indent );
        var leftOperand = this.evalTokens( username, context, tokens.slice( 0, operatorIndex ), indent + 1 );
        if ( leftOperand === null ) return null;

        this.debugMessage( username, "Right Operand:", indent );
        var rightOperand = this.evalTokens( username, context, tokens.slice( operatorIndex + 1 ), indent + 1 );
        if ( rightOperand === null ) return null;

        var message = "Operation: " + operationName +
                      ", Left: " + this.tokenToString( leftOperand ) +
                      ", Right: " + this.tokenToString( rightOperand );
        this.debugMessage( username, message, indent );

        if (( operandType !== undefined ) &&
            (( leftOperand.type != operandType ) || ( rightOperand.type != operandType )))
        {
            this.errorMessage( username,
                               "Expected " + operandType + " operands, but received: " +
                               leftOperand.type + " and " + rightOperand.type, indent );
            return null;
        }

        var result = { type: resultType, value: operationFunction( leftOperand.value, rightOperand.value ) };
        this.debugMessage( username, "Result: " + this.tokenToString( result ), indent );
        return result;
    },

    orOperation(                 leftOperand, rightOperand ) { return leftOperand ||  rightOperand; },
    andOperation(                leftOperand, rightOperand ) { return leftOperand &&  rightOperand; },
    equalOperation(              leftOperand, rightOperand ) { return leftOperand === rightOperand; },
    notEqualOperation(           leftOperand, rightOperand ) { return leftOperand !== rightOperand; },
    lessThanOperation(           leftOperand, rightOperand ) { return leftOperand <   rightOperand; },
    lessThanOrEqualOperation(    leftOperand, rightOperand ) { return leftOperand <=  rightOperand; },
    greaterThanOperation(        leftOperand, rightOperand ) { return leftOperand >   rightOperand; },
    greaterThanOrEqualOperation( leftOperand, rightOperand ) { return leftOperand >=  rightOperand; },
    addOperation(                leftOperand, rightOperand ) { return leftOperand +   rightOperand; },
    subtractOperation(           leftOperand, rightOperand ) { return leftOperand -   rightOperand; },
    multiplyOperation(           leftOperand, rightOperand ) { return leftOperand *   rightOperand; },
    divideOperation(             leftOperand, rightOperand ) { return leftOperand /   rightOperand; },
    remainderOperation(          leftOperand, rightOperand ) { return leftOperand %   rightOperand; },

    processCommand( username, command )
    {
        var commandName = Util.getCommandPrefix( command ).toLowerCase();
        var commandData = Util.getCommandRemainder( command );

        switch( commandName )
        {
            case "eval"     : this.evalCommand(     username, commandData        ); return true;
            case "program"  : this.programCommand(  username, commandData        ); return true;
            case "function" : this.functionCommand( username, commandData        ); return true;
            case "variable" : this.variableCommand( username, commandData, false ); return true;
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

        var commandName = Util.getCommandPrefix( command ).toLowerCase();
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
            this.userMessage( username, "[" + i + "] " + program[ i ].condition + " ; " + program[ i ].action, true );
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

        // run programs, but just for this username
        this.runningUsername = username;
        this.initializingProgram = true;
        this.externalRunPrograms();
        this.runningUsername = null;
        this.initializingProgram = false;
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
        var seperatorIndex = commandData.indexOf( ";" );
        if ( seperatorIndex < 0 )
        {
            this.externalUserMessage( username, false, true, true, "invalid statement syntax." );
            return null;
        }

        var condition = commandData.substring( 0, seperatorIndex ).trim();
        var action = commandData.substring( seperatorIndex + 1 ).trim();

        if ( condition.length == 0 )
        {
            this.externalUserMessage( username, false, true, true, "missing condition." );
            return null;
        }

        if ( action.length == 0 )
        {
            this.externalUserMessage( username, false, true, true, "missing action." );
            return null;
        }

        return { condition: condition, action: action };
    },

    functionCommand( username, command )
    {
        if ( command.length == 0 )
        {
            this.externalUserMessage( username, false, true, true, "you must specify a function command." );
            return;
        }

        var commandName = Util.getCommandPrefix( command ).toLowerCase();
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
        if ( commandData.length == 0 )
        {
            this.externalUserMessage( username, false, true, true, "you must specify your function." );
            return;
        }

        var paramStart = commandData.indexOf( "(" );
        var functionName = commandData.substring( 0, paramStart );
        if ( !this.identifierRegex.test( functionName ))
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
                if ( !this.identifierRegex.test( paramName ))
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

    variableCommand( username, command, isScripting )
    {
        if ( command.length == 0 )
        {
            this.externalUserMessage( username, isScripting, true, true, "you must specify a variable command." );
            return;
        }

        var commandName = Util.getCommandPrefix( command ).toLowerCase();
        var commandData = Util.getCommandRemainder( command );

        switch( commandName )
        {
            case "create" : this.createVariableCommand( username, commandData, isScripting ); break;
            case "list"   : this.listVariablesCommand(  username,              isScripting ); break;
            case "delete" : this.deleteVariableCommand( username, commandData, isScripting ); break;
            default : this.externalUserMessage( username, isScripting, true, true, "unrecognized variable command." );
        }
    },

    createVariableCommand( username, commandData, isScripting )
    {
        if ( commandData.length == 0 )
        {
            this.externalUserMessage( username, isScripting, true, true, "you must specify your variable." );
            return;
        }

        var variableName = Util.getCommandPrefix( commandData );
        var variableData = Util.getCommandRemainder( commandData );

        if ( !this.identifierRegex.test( variableName ))
        {
            this.externalUserMessage( username, isScripting, true, true, "invalid variable name." );
            return;
        }

        if ( variableData.length == 0 )
        {
            this.externalUserMessage( username, isScripting, true, true,
                                      "you must specify a value for your variable." );
            return;
        }

        var context = { callStack: 0, params: new Map() };
        var result = this.evalExpression( username, context, variableData, 0 );
        if ( result === null )
        {
            this.externalUserMessage( username, isScripting, true, true, "failed to evaluate variable value." );
            return;
        }

        var playerVariables = this.getPlayerVariables( username );
        var operation = playerVariables.has( variableName ) ? "updated" : "created";
        playerVariables.set( variableName, result );
        this.externalUserMessage( username, isScripting, false, false, operation + " variable." );
    },

    listVariablesCommand( username, isScripting )
    {
        if ( isScripting )
        {
            this.externalUserMessage( username, isScripting, true, false,
                                      "cannot list variables from within a program." );
            return;
        }

        var playerVariables = this.getPlayerVariables( username );
        if ( playerVariables.size == 0 )
        {
            this.externalUserMessage( username, isScripting, false, false, "you have no variables." );
        }
        else
        {
            this.externalUserMessage( username, isScripting, false, false,
                                      "listed " + playerVariables.size + " variable" +
                                      ( playerVariables.size == 1 ? "" : "s" ) + "." );
        }

        for ( let variableName of playerVariables.keys() )
        {
            var variableValue = playerVariables.get( variableName );
            this.userMessage( username, variableName + " = " + this.tokenToString( variableValue ), true );
        }
    },

    deleteVariableCommand( username, commandData, isScripting )
    {
        if ( commandData.length == 0 )
        {
            this.externalUserMessage( username, isScripting, true, true, "you must specify a variable name." );
            return;
        }

        var playerVariables = this.getPlayerVariables( username );
        var variableName = Util.getCommandPrefix( commandData );
        if ( !playerVariables.has( variableName ))
        {
            this.externalUserMessage( username, isScripting, true, false, "variable does not exist." );
            return;
        }

        playerVariables.delete( variableName );
        this.externalUserMessage( username, isScripting, false, false, "deleted variable." );
    },

    processScriptingCommand( username, command )
    {
        if ( command.length == 0 )
        {
            this.errorMessage( username, "No command specified." );
            return;
        }

        var commandName = Util.getCommandPrefix( command ).toLowerCase();
        var commandData = Util.getCommandRemainder( command );

        // allow the external system to process the command rather than this function
        if ( this.externalProcessScriptingCommand( username, command )) return;

        switch( commandName )
        {
            case "print"    : this.printCommand(    username, commandData       ); break;
            case "variable" : this.variableCommand( username, commandData, true ); break;
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
