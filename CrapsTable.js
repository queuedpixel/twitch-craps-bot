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

var fs = require( "fs" );

var config = require( "./config.js" );

module.exports =
{
    playerBalances: new Map(),
    passBets: new Map(),
    passOddsBets: new Map(),
    dpassBets: new Map(),
    dpassOddsBets: new Map(),
    comeBets: [],
    comeOddsBets: [],
    dcomeBets: [],
    betResults: new Map(),
    point: 0,
    timerRunning: false,
    timerCounter: 0,

    // override this function to listen to craps table messages
    onMessage( message ) {},

    userMessage( username, message )
    {
        this.onMessage( "@" + username + ", " + message );
    },

    init()
    {
        // initialize come bets arrays; indices: [ 0, 4, 5, 6, 8, 9, 10 ]
        for ( var i = 0; i <= 10; i++ ) if (( i == 0 ) || (( i >= 4 ) && ( i != 7 )))
        {
            this.comeBets[  i ] = new Map();
            this.dcomeBets[ i ] = new Map();
            if ( i != 0 ) this.comeOddsBets[ i ] = new Map();
        }

        setInterval( this.crapsTimer.bind( this ), 1000 );

        fs.readFile( "players.json", ( err, data ) =>
        {
            if ( err )
            {
                console.log( "Unable to read \"players.json\". Resetting player balances." );
                console.log( "" );
                return;
            }

            this.playerBalances = new Map( JSON.parse( data ));
        } );
    },

    startTimer()
    {
        this.timerRunning = true;
        this.timerCounter = config.rollingDelay;
    },

    stopTimer()
    {
        this.timerRunning = false;
    },

    // roll the dice after the specified rolling delay has expired
    crapsTimer()
    {
        // do nothing if the timer isn't running
        if ( !this.timerRunning ) return;

        this.timerCounter--;
        if ( this.timerCounter <= 0 )
        {
            this.processRandomRoll();
        }
    },

    // helper function for getting a random die roll
    dieRoll()
    {
        return Math.floor( Math.random() * 6 ) + 1;
    },

    formatCurrency( amount )
    {
        return "§" + ( amount / 100 ).toLocaleString( "en-US", { minimumFractionDigits: 2 } );
    },

    getBalance( username )
    {
        if ( !this.playerBalances.has( username ))
        {
            // set the starting balance for players
            // balances are stored in hundredths of one unit of currency; multiply the configured value by 100
            this.playerBalances.set( username, config.minimumBalance * 100 );
        }

        return this.playerBalances.get( username );
    },

    getAvailableBalance( username )
    {
        var availableBalance = this.getBalance( username );
        if ( this.passBets.has(      username )) availableBalance -= this.passBets.get(      username );
        if ( this.passOddsBets.has(  username )) availableBalance -= this.passOddsBets.get(  username );
        if ( this.dpassBets.has(     username )) availableBalance -= this.dpassBets.get(     username );
        if ( this.dpassOddsBets.has( username )) availableBalance -= this.dpassOddsBets.get( username );

        // iterate over come bets arrays; indices: [ 0, 4, 5, 6, 8, 9, 10 ]
        for ( var i = 0; i <= 10; i++ ) if (( i == 0 ) || (( i >= 4 ) && ( i != 7 )))
        {
            if ( this.comeBets[  i ].has( username )) availableBalance -= this.comeBets[  i ].get( username );
            if ( this.dcomeBets[ i ].has( username )) availableBalance -= this.dcomeBets[ i ].get( username );

            if ( i != 0 )
            {
                if ( this.comeOddsBets[ i ].has( username )) availableBalance -= this.comeOddsBets[ i ].get( username );
            }
        }

        return availableBalance;
    },

    // set player balances to the minimum balance for all players below the minimum
    checkMinimumBalances()
    {
        for ( let username of this.playerBalances.keys() )
        {
            if ( this.getBalance( username ) < config.minimumBalance * 100 )
            {
                this.playerBalances.set( username, config.minimumBalance * 100 );
            }
        }
    },

    oddsMultiplier( point )
    {
        switch( point )
        {
            case 4  :
            case 10 : return 2;
            case 5  :
            case 9  : return 3 / 2;
            case 6  :
            case 8  : return 6 / 5;
            default : throw "Unrecognized point."
        }
    },

    betWon( bet )
    {
        return bet;
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - point: the point for the odds
    lightOddsWon( bet )
    {
        return this.crapsTable.oddsMultiplier( this.point ) * bet;
    },

    darkOddsWon( bet )
    {
        return bet / this.oddsMultiplier( this.point );
    },

    betLost( bet )
    {
        return -bet;
    },

    processBets( bets, betResult )
    {
        for ( let username of bets.keys() )
        {
            var result = betResult( bets.get( username ));
            this.playerBalances.set( username, this.getBalance( username ) + result );
            if ( !this.betResults.has( username )) this.betResults.set( username, 0 );
            this.betResults.set( username, this.betResults.get( username ) + result );
        }

        bets.clear();
    },

    showBetResults()
    {
        for ( let username of this.betResults.keys() )
        {
            var result = this.betResults.get( username );
            if ( result > 0 ) this.userMessage( username, "won "  + this.formatCurrency(  result ));
            if ( result < 0 ) this.userMessage( username, "lost " + this.formatCurrency( -result ));
        }

        this.betResults.clear();
    },

    // perform a random die roll
    processRandomRoll()
    {
        // randomly determine the die roll
        var die1 = this.dieRoll();
        var die2 = this.dieRoll();
        this.processRoll( die1, die2 );
    },

    processComeBetPoint( dieTotal )
    {
        if (( dieTotal >= 4 ) && ( dieTotal != 7 ) && ( dieTotal <= 10 ))
        {
            this.processBets( this.comeBets[  dieTotal ], this.betWon  );
            this.processBets( this.dcomeBets[ dieTotal ], this.betLost );
            this.processBets( this.comeOddsBets[ dieTotal ],
                              this.lightOddsWon.bind( { crapsTable: this, point: dieTotal } ));

            // copy come bets over to their respective point
            for ( let username of this.comeBets[ 0 ].keys() )
            {
                this.comeBets[ dieTotal ].set( username, this.comeBets[ 0 ].get( username ));
            }

            // copy don't come bets over to their respective point
            for ( let username of this.dcomeBets[ 0 ].keys() )
            {
                this.dcomeBets[ dieTotal ].set( username, this.dcomeBets[ 0 ].get( username ));
            }

            // clear out come and don't come bets
            this.comeBets[  0 ].clear();
            this.dcomeBets[ 0 ].clear();
        }
    },

    processComeBets( dieTotal )
    {
        // handle seven out for come bet points
        if ( dieTotal == 7 )
        {
            // iterate over come bets array; indices: [ 4, 5, 6, 8, 9, 10 ]
            for ( var i = 4; i <= 10; i++ ) if ( i != 7 )
            {
                this.processBets( this.comeBets[     i ], this.betLost );
                this.processBets( this.comeOddsBets[ i ], this.betLost );
                this.processBets( this.dcomeBets[    i ], this.betWon  );
            }
        }

        // check to see if we have a come bet winner
        if (( dieTotal == 7 ) || ( dieTotal == 11 ))
        {
            this.processBets( this.comeBets[  0 ], this.betWon  );
            this.processBets( this.dcomeBets[ 0 ], this.betLost );
        }

        // check to see if we have a come bet loser
        if (( dieTotal == 2 ) || ( dieTotal == 3 ) || ( dieTotal == 12 ))
        {
            this.processBets( this.comeBets[ 0 ], this.betLost );
            if ( dieTotal != 12 ) this.processBets( this.dcomeBets[ 0 ], this.betWon );
        }

        // migrate come and don't come bets to their specific points
        this.processComeBetPoint( dieTotal );
    },

    // update the craps table based on the results of the specifed roll
    processRoll( die1, die2 )
    {
        // print out the roll
        var dieTotal = die1 + die2;
        var pointDisplay = this.point == 0 ? "No Point" : "Point: " + this.point;
        this.onMessage( pointDisplay + ", Roll: " + die1 + " " + die2 + " (" + dieTotal + ")" );
        this.processComeBets( dieTotal );

        // if we have no point currently ...
        if ( this.point == 0 )
        {
            // check to see if we have a pass bet winner
            if (( dieTotal == 7 ) || ( dieTotal == 11 ))
            {
                this.processBets( this.passBets,  this.betWon  );
                this.processBets( this.dpassBets, this.betLost );
            }

            // check to see if we have a pass bet loser
            if (( dieTotal == 2 ) || ( dieTotal == 3 ) || ( dieTotal == 12 ))
            {
                this.processBets( this.passBets, this.betLost );
                if ( dieTotal != 12 ) this.processBets( this.dpassBets, this.betWon );
            }

            // check to see if we've established a point
            if (( dieTotal >= 4 ) && ( dieTotal != 7 ) && ( dieTotal <= 10 ))
            {
                this.point = dieTotal;
                this.onMessage( "New point established: " + this.point );
            }
        }

        // check to see if the point was made
        else if ( this.point == dieTotal )
        {
            this.processBets( this.passBets,      this.betWon  );
            this.processBets( this.dpassBets,     this.betLost );
            this.processBets( this.dpassOddsBets, this.betLost );
            this.processBets( this.passOddsBets, this.lightOddsWon.bind( { crapsTable: this, point: this.point } ));
            this.point = 0;
            this.onMessage( "The point was made." );
        }

        // check to see if we sevened out
        else if ( dieTotal == 7 )
        {
            this.processBets( this.passBets,      this.betLost                 );
            this.processBets( this.passOddsBets,  this.betLost                 );
            this.processBets( this.dpassBets,     this.betWon                  );
            this.processBets( this.dpassOddsBets, this.darkOddsWon.bind( this ));
            this.point = 0;
            this.onMessage( "Seven out." );
        }

        // if there are no bets and no point: check minimum balances, save player balances, and stop the timer
        if (( !this.betsExist() ) && ( this.point == 0 ))
        {
            this.checkMinimumBalances();
            fs.writeFile( "players.json", JSON.stringify( [ ...this.playerBalances ], undefined, 4 ),
                          ( err ) => { if ( err ) throw err; } );
            this.stopTimer();
        }
        // otherwise: start the timer for the next roll
        else this.startTimer();

        this.showBetResults();
    },

    betsExist()
    {
        if ( this.passBets.size      > 0 ) return true;
        if ( this.passOddsBets.size  > 0 ) return true;
        if ( this.dpassBets.size     > 0 ) return true;
        if ( this.dpassOddsBets.size > 0 ) return true;

        // iterate over come bets array; indices: [ 0, 4, 5, 6, 8, 9, 10 ]
        for ( var i = 0; i <= 10; i++ ) if (( i == 0 ) || (( i >= 4 ) && ( i != 7 )))
        {
            if ( this.comeBets[  i ].size > 0 ) return true;
            if ( this.dcomeBets[ i ].size > 0 ) return true;
            if (( i != 0 ) && ( this.comeOddsBets[ i ].size > 0 )) return true;
        }

        return false;
    },

    // process chat commands
    processCommand( username, message )
    {
        if ( !message.startsWith( "!craps " ))
        {
            this.userMessage( username, "you must specify a command. For help: !craps help" );
            return;
        }

        var command = message.substr( 6 ).trim();

        if (( command.startsWith( "roll" )) &&
            ( username.toLowerCase() == config.owner.toLowerCase() ) &&
            ( config.debug ))
        {
            this.rollCommand( username, command );
        }
        else if ( command == "help" ) this.userMessage( username, "player guide: https://git.io/fhHjL" );
        else if ( command == "balance" ) this.balanceCommand( username );
        else if ( command.startsWith( "bet" )) this.betCommand( username, command );
        else this.userMessage( username, "uncrecognized command. For help: !craps help" );
    },

    rollCommand( username, command )
    {
        // perform random roll if die values are not specified
        if ( !command.startsWith( "roll " ))
        {
            this.processRandomRoll();
            return;
        }

        var data = command.substr( 4 ).trim();
        var values = data.split( " " );
        if ( values.length != 2 )
        {
            this.userMessage( username, "you must specify two values." );
            return;
        }

        var die1 = parseInt( values[ 0 ] );
        var die2 = parseInt( values[ 1 ] );

        if (( Number.isNaN( die1 )) || ( Number.isNaN( die2 )))
        {
            this.userMessage( username, "unable to parse die values." );
            return;
        }

        if (( die1 < 1 ) || ( die1 > 6 ) || ( die2 < 1 ) || ( die2 > 6 ))
        {
            this.userMessage( username, "values must be between 1 and 6." );
            return;
        }

        this.processRoll( die1, die2 );
    },

    balanceCommand( username )
    {
        var balance = this.getBalance( username );
        var availableBalance = this.getAvailableBalance( username );

        var message = "balance: " + this.formatCurrency( balance );
        if ( balance != availableBalance ) message += "; available balance: " + this.formatCurrency( availableBalance );
        this.userMessage( username, message );
    },

    betCommand( username, command )
    {
        if ( !command.startsWith( "bet " ))
        {
            this.userMessage( username, "you must specify which bet you wish to make." );
            return;
        }

        var bet = command.substr( 3 ).trim();

        if ( bet.startsWith( "pass-odds" ))
        {
            this.handleBet( username, "pass-odds", this.passOddsBets, this.passOddsCheck.bind( this ), bet );
        }
        else if ( bet.startsWith( "pass" ))
        {
            this.handleBet( username, "pass", this.passBets, undefined, bet );
        }
        else if ( bet.startsWith( "dpass-odds" ))
        {
            this.handleBet( username, "dpass-odds", this.dpassOddsBets, this.dpassOddsCheck.bind( this ), bet );
        }
        else if ( bet.startsWith( "dpass" ))
        {
            this.handleBet( username, "dpass", this.dpassBets, this.dpassCheck.bind( this ), bet );
        }
        else if ( bet.startsWith( "come-odds" ))
        {
            this.handleOddsBet( username, "come-odds", this.comeBets, this.comeOddsBets, bet );
        }
        else if ( bet.startsWith( "come" ))
        {
            this.handleBet( username, "come", this.comeBets[ 0 ], this.pointCheck.bind( this ), bet );
        }
        else if ( bet.startsWith( "dcome" ))
        {
            this.handleBet( username, "dcome", this.dcomeBets[ 0 ], this.pointCheck.bind( this ), bet );
        }
        else this.userMessage( username, "unrecognized bet." );
    },

    handleOddsBet( username, type, comeBets, comeOddsBets, bet )
    {
        if ( !bet.startsWith( type + " " ))
        {
            this.userMessage( username, "you must specify a point." );
            return;
        }

        var point = parseInt( bet.substr( type.length ).trim() );
        if ( Number.isNaN( point ))
        {
            this.userMessage( username, "unable to parse point." );
            return;
        }

        if (( point < 4 ) || ( point == 7 ) || ( point > 10 ))
        {
            this.userMessage( username, "invalid point." );
            return;
        }

        var checkFunction = this.comeOddsCheck.bind( { crapsTable: this, comeBets: comeBets, point: point } );
        this.handleBet( username, "come-odds " + point, comeOddsBets[ point ], checkFunction, bet );
    },

    handleBet( username, type, bets, checkFunction, bet )
    {
        if ( !bet.startsWith( type + " " ))
        {
            this.userMessage( username, "you must specify an amount." );
            return;
        }

        var amount = parseInt( bet.substr( type.length ).trim() ) * 100;
        if ( Number.isNaN( amount ))
        {
            this.userMessage( username, "unable to parse amount." );
            return;
        }

        if ( amount < 1 )
        {
            this.userMessage( username, "bet is too small." );
            return;
        }

        var availableBalance = this.getAvailableBalance( username );
        if ( amount > availableBalance )
        {
            this.userMessage(
                    username, "bet exceeds your available balance of " + this.formatCurrency( availableBalance ));
            return;
        }

        if ( bets.has( username ))
        {
            this.userMessage( username, "you've already made this bet." );
            return;
        }

        if ( checkFunction !== undefined )
        {
            if ( !checkFunction( username, amount )) return;
        }

        this.userMessage( username, "bet made." );
        bets.set( username, amount );
        this.startTimer();
    },

    pointCheck( username, amount )
    {
        if ( this.point == 0 )
        {
            this.userMessage( username, "you need a point first." );
            return false;
        }

        return true;
    },

    maxOddsCheck( username, baseAmount, oddsAmount )
    {
        var maxBet = baseAmount * config.maxOdds;
        if ( oddsAmount > maxBet )
        {
            this.userMessage( username, "bet exceeds your maximum odds bet of " + this.formatCurrency( maxBet ));
            return false;
        }

        return true;
    },

    passOddsCheck( username, amount )
    {
        if ( !this.passBets.has( username ))
        {
            this.userMessage( username, "you need a \"pass\" bet first." );
            return false;
        }

        if ( !this.pointCheck( username, amount )) return false;
        if ( !this.maxOddsCheck( username, this.passBets.get( username ), amount )) return false;
        return true;
    },

    dpassOddsCheck( username, amount )
    {
        if ( !this.dpassBets.has( username ))
        {
            this.userMessage( username, "you need a \"don't pass\" bet first." );
            return false;
        }

        if ( !this.pointCheck( username, amount )) return false;

        var maxBet = this.dpassBets.get( username ) * config.maxOdds * this.oddsMultiplier( this.point );
        if ( amount > maxBet )
        {
            this.userMessage( username, "bet exceeds your maximum odds bet of " + this.formatCurrency( maxBet ));
            return false;
        }

        return true;
    },

    dpassCheck( username, amount )
    {
        if ( this.point != 0 )
        {
            this.userMessage( username, "you cannot bet \"don't pass\" when a point is set." );
            return false;
        }

        return true;
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - comeBets: the come bets array containing the corresponding come bets for the come odds bet
    // - point: the point for the come odds
    comeOddsCheck( username, amount )
    {
        if ( !this.comeBets[ this.point ].has( username ))
        {
            this.crapsTable.userMessage( username, "you need a \"come\" bet on this point first." );
            return false;
        }

        var baseAmount = this.comeBets[ this.point ].get( username );
        if ( !this.crapsTable.maxOddsCheck.bind( this.crapsTable )( username, baseAmount, amount )) return false;
        return true;
    }
};
