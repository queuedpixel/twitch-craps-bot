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
    fieldBets: new Map(),
    anyCrapsBets: new Map(),
    anySevenBets: new Map(),
    comeBets: [],
    comeOddsBets: [],
    dcomeBets: [],
    dcomeOddsBets: [],
    placeBets: [],
    dplaceBets: [],
    buyBets: [],
    layBets: [],
    hardBets: [],
    hopBets: [],
    betResults: new Map(),
    playersShownBets: [],
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
        // initialize bets arrays; indices: [ 0, 4, 5, 6, 8, 9, 10 ]
        for ( var i = 0; i <= 10; i++ ) if (( i == 0 ) || (( i >= 4 ) && ( i != 7 )))
        {
            this.comeBets[  i ] = new Map();
            this.dcomeBets[ i ] = new Map();

            // skip index 0
            if ( i != 0 )
            {
                this.comeOddsBets[  i ] = new Map();
                this.dcomeOddsBets[ i ] = new Map();
                this.placeBets[     i ] = new Map();
                this.dplaceBets[    i ] = new Map();
                this.buyBets[       i ] = new Map();
                this.layBets[       i ] = new Map();
            }
        }

        // initialize hard bets array; indices: [ 4, 6, 8, 10 ]
        for ( var i = 4; i <= 10; i += 2 ) this.hardBets[ i ] = new Map();

        // initialize hop bets array
        for ( var i = 1; i <= 6; i++ )
        {
            this.hopBets[ i ] = [];
            for ( var j = i; j <= 6; j++ ) this.hopBets[ i ][ j ] = new Map();
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

    // perform a random die roll
    processRandomRoll()
    {
        // randomly determine the die roll
        var die1 = this.dieRoll();
        var die2 = this.dieRoll();
        this.processRoll( die1, die2 );
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

    getBet( username, betMap )
    {
        if ( betMap.has( username )) return betMap.get( username );
        return 0;
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
        availableBalance -= this.getBet( username, this.passBets      );
        availableBalance -= this.getBet( username, this.passOddsBets  );
        availableBalance -= this.getBet( username, this.dpassBets     );
        availableBalance -= this.getBet( username, this.dpassOddsBets );
        availableBalance -= this.getBet( username, this.fieldBets     );
        availableBalance -= this.getBet( username, this.anyCrapsBets  );
        availableBalance -= this.getBet( username, this.anySevenBets  );

        // iterate over bets arrays; indices: [ 0, 4, 5, 6, 8, 9, 10 ]
        for ( var i = 0; i <= 10; i++ ) if (( i == 0 ) || (( i >= 4 ) && ( i != 7 )))
        {
            availableBalance -= this.getBet( username, this.comeBets[  i ] );
            availableBalance -= this.getBet( username, this.dcomeBets[ i ] );

            // skip index 0
            if ( i != 0 )
            {
                availableBalance -= this.getBet( username, this.comeOddsBets[  i ] );
                availableBalance -= this.getBet( username, this.dcomeOddsBets[ i ] );
                availableBalance -= this.getBet( username, this.placeBets[     i ] );
                availableBalance -= this.getBet( username, this.dplaceBets[    i ] );
                availableBalance -= this.getBet( username, this.buyBets[       i ] );
                availableBalance -= this.getBet( username, this.layBets[       i ] );
            }
        }

        // iterate over hard bets array; indices: [ 4, 6, 8, 10 ]
        for ( var i = 4; i <= 10; i += 2 ) availableBalance -= this.getBet( username, this.hardBets[ i ] );

        // iterate over hop bets array
        for ( var i = 1; i <= 6; i++ ) for ( var j = i; j <= 6; j++ )
        {
            availableBalance -= this.getBet( username, this.hopBets[ i ][ j ] );
        }

        return availableBalance;
    },

    adjustBalance( username, amount )
    {
        this.playerBalances.set( username, this.getBalance( username ) + amount );
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

    showBetResults()
    {
        for ( let username of this.betResults.keys() )
        {
            var result = this.betResults.get( username );
            if ( result > 0 ) this.userMessage( username, "won: "  + this.formatCurrency(  result ));
            if ( result < 0 ) this.userMessage( username, "lost: " + this.formatCurrency( -result ));
        }

        this.betResults.clear();
    },

    oddsMultiplier( number )
    {
        switch( number )
        {
            case 4  :
            case 10 : return 2;
            case 5  :
            case 9  : return 3 / 2;
            case 6  :
            case 8  : return 6 / 5;
            default : throw "Unrecognized number."
        }
    },

    placeMultiplier( number )
    {
        switch( number )
        {
            case 4  :
            case 10 : return 9 / 5;
            case 5  :
            case 9  : return 7 / 5;
            case 6  :
            case 8  : return 7 / 6;
            default : throw "Unrecognized number."
        }
    },

    dplaceMultiplier( number )
    {
        switch( number )
        {
            case 4  :
            case 10 : return 5 / 11;
            case 5  :
            case 9  : return 5 / 8;
            case 6  :
            case 8  : return 4 / 5;
            default : throw "Unrecognized number."
        }
    },

    betWon( bet )
    {
        return bet;
    },

    // you must bind an object to this function as follows:
    // - multiplier: the multiplier for the bet
    betWonMultiplier( bet )
    {
        return bet * this.multiplier;
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - number: the point for the odds
    lightOddsWon( bet )
    {
        return this.crapsTable.oddsMultiplier( this.number ) * bet;
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - number: the point for the odds
    darkOddsWon( bet )
    {
        return bet / this.crapsTable.oddsMultiplier( this.number );
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - number: the number for the bet
    placeWon( bet )
    {
        return this.crapsTable.placeMultiplier( this.number ) * bet;
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - number: the number for the bet
    dplaceWon( bet )
    {
        return this.crapsTable.dplaceMultiplier( this.number ) * bet;
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - number: the number for the bet
    buyWon( bet )
    {
        var commission = Math.ceil( bet - ( 19 * bet / 20 ));
        var amountWon = this.crapsTable.oddsMultiplier( this.number ) * bet;
        return amountWon - commission;
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - number: the number for the bet
    layWon( bet )
    {
        var amountWon = bet / this.crapsTable.oddsMultiplier( this.number );
        var commission = Math.ceil( amountWon - ( 19 * amountWon / 20 ));
        return amountWon - commission;
    },

    betLost( bet )
    {
        return -bet;
    },

    processBets( bets, betResult )
    {
        for ( let username of bets.keys() )
        {
            var result = Math.floor( betResult( bets.get( username )));
            this.adjustBalance( username, result );
            if ( !this.betResults.has( username )) this.betResults.set( username, 0 );
            this.betResults.set( username, this.betResults.get( username ) + result );
        }

        bets.clear();
    },

    processComeBetNumber( dieTotal )
    {
        if (( dieTotal >= 4 ) && ( dieTotal != 7 ) && ( dieTotal <= 10 ))
        {
            this.processBets( this.comeBets[      dieTotal ], this.betWon  );
            this.processBets( this.dcomeBets[     dieTotal ], this.betLost );
            this.processBets( this.dcomeOddsBets[ dieTotal ], this.betLost );
            this.processBets( this.comeOddsBets[  dieTotal ],
                              this.lightOddsWon.bind( { crapsTable: this, number: dieTotal } ));

            // copy come bets over to their respective number
            for ( let username of this.comeBets[ 0 ].keys() )
            {
                this.comeBets[ dieTotal ].set( username, this.comeBets[ 0 ].get( username ));
            }

            // copy don't come bets over to their respective number
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
        // handle seven out for come bet numbers
        if ( dieTotal == 7 )
        {
            // iterate over come bets arrays; indices: [ 4, 5, 6, 8, 9, 10 ]
            for ( var i = 4; i <= 10; i++ ) if ( i != 7 )
            {
                this.processBets( this.comeBets[      i ], this.betLost );
                this.processBets( this.comeOddsBets[  i ], this.betLost );
                this.processBets( this.dcomeBets[     i ], this.betWon  );
                this.processBets( this.dcomeOddsBets[ i ], this.darkOddsWon.bind( { crapsTable: this, number: i } ));
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

        // migrate come and don't come bets to their specific numbers
        this.processComeBetNumber( dieTotal );
    },

    processNumberBets( dieTotal )
    {
        // handle seven out
        if ( dieTotal == 7 )
        {
            // iterate over place bets arrays; indices: [ 4, 5, 6, 8, 9, 10 ]
            for ( var i = 4; i <= 10; i++ ) if ( i != 7 )
            {
                this.processBets( this.placeBets[  i ], this.betLost );
                this.processBets( this.buyBets[    i ], this.betLost );
                this.processBets( this.dplaceBets[ i ], this.dplaceWon.bind( { crapsTable: this, number: i } ));
                this.processBets( this.layBets[    i ], this.layWon.bind(    { crapsTable: this, number: i } ));
            }
        }

        // handle hitting a specific number
        if (( dieTotal >= 4 ) && ( dieTotal != 7 ) && ( dieTotal <= 10 ))
        {
            this.processBets( this.dplaceBets[ dieTotal ], this.betLost );
            this.processBets( this.layBets[    dieTotal ], this.betLost );
            this.processBets( this.placeBets[ dieTotal ], this.placeWon.bind( { crapsTable: this, number: dieTotal } ));
            this.processBets( this.buyBets[   dieTotal ], this.buyWon.bind(   { crapsTable: this, number: dieTotal } ));
        }
    },

    processFieldBets( dieTotal )
    {
        // handle field bet 1x winners
        if (( dieTotal == 3 ) || ( dieTotal == 4 ) || ( dieTotal == 9 ) || ( dieTotal == 10 ) || ( dieTotal == 11 ))
        {
            this.processBets( this.fieldBets, this.betWon );
        }

        // handle field bet 2x winners
        if ( dieTotal == 2 ) this.processBets( this.fieldBets, this.betWonMultiplier.bind( { multiplier: 2 } ));

        // handle field bet 3x winners
        if ( dieTotal == 12 ) this.processBets( this.fieldBets, this.betWonMultiplier.bind( { multiplier: 3 } ));

        // handle field bet losers
        if (( dieTotal == 5 ) || ( dieTotal == 6 ) || ( dieTotal == 7 ) || ( dieTotal == 8 ))
        {
            this.processBets( this.fieldBets, this.betLost );
        }
    },

    processHardNumber( die1, die2, number )
    {
        // skip if we're processing a number other than what was rolled
        if ( number != die1 + die2 ) return;

        var multiplier = 0;
        switch( number )
        {
            case 4  :
            case 10 : multiplier = 7; break;
            case 6  :
            case 8  : multiplier = 9; break;
            default : throw "Unrecognized number."
        }

        if ( die1 == die2 )
        {
            this.processBets( this.hardBets[ number ], this.betWonMultiplier.bind( { multiplier: multiplier } ));
        }
        else this.processBets( this.hardBets[ number ], this.betLost );
    },

    processHardBets( die1, die2 )
    {
        if ( die1 + die2 == 7 )
        {
            // rolling a seven causes all hard bets to lose
            // iterate over hard bets array; indices: [ 4, 6, 8, 10 ]
            for ( var i = 4; i <= 10; i += 2 ) this.processBets( this.hardBets[ i ], this.betLost );
        }
        else
        {
            // process each individual hard bet
            // iterate over hard bets array; indices: [ 4, 6, 8, 10 ]
            for ( var i = 4; i <= 10; i += 2 ) this.processHardNumber( die1, die2, i );
        }
    },

    processHopBets( die1, die2 )
    {
        var dieTotal = die1 + die2;

        // handle any-craps bets
        if (( dieTotal == 2 ) || ( dieTotal == 3 ) || ( dieTotal == 12 ))
        {
            this.processBets( this.anyCrapsBets, this.betWonMultiplier.bind( { multiplier: 7.5 } ));
        }
        else this.processBets( this.anyCrapsBets, this.betLost );

        // handle any-seven bets
        if ( dieTotal == 7 ) this.processBets( this.anySevenBets, this.betWonMultiplier.bind( { multiplier: 4 } ));
        else this.processBets( this.anySevenBets, this.betLost );

        // ensure that we access our hop bet array with the lower die as the first index
        var i = die1 < die2 ? die1 : die2;
        var j = die1 < die2 ? die2 : die1;

        // determine multiplier based on "hard" or "easy" hop bets
        var multiplier = ( i == j ) ? 33 : 16;

        // hop bets for the specific die roll win
        this.processBets( this.hopBets[ i ][ j ], this.betWonMultiplier.bind( { multiplier: multiplier } ));

        // iterate over hop bets array
        for ( var i = 1; i <= 6; i++ ) for ( var j = i; j <= 6; j++ )
        {
            // all other hop bets lose
            this.processBets( this.hopBets[ i ][ j ], this.betLost );
        }
    },

    // update the craps table based on the results of the specifed roll
    processRoll( die1, die2 )
    {
        // allow all players to view their bets again
        this.playersShownBets = [];

        // print out the roll
        var dieTotal = die1 + die2;
        var pointDisplay = this.point == 0 ? "No Point" : "Point: " + this.point;
        this.onMessage( "GivePLZ " + pointDisplay + ", Roll: " + die1 + " " + die2 + " (" + dieTotal + ") TakeNRG" );
        this.processComeBets( dieTotal );
        this.processNumberBets( dieTotal );
        this.processFieldBets( dieTotal );
        this.processHardBets( die1, die2 );
        this.processHopBets( die1, die2 );

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
                this.onMessage( "GivePLZ Point established: " + this.point + " TakeNRG" );
            }
        }

        // check to see if the point was made
        else if ( this.point == dieTotal )
        {
            this.processBets( this.passBets,      this.betWon  );
            this.processBets( this.dpassBets,     this.betLost );
            this.processBets( this.dpassOddsBets, this.betLost );
            this.processBets( this.passOddsBets,  this.lightOddsWon.bind( { crapsTable: this, number: this.point } ));
            this.point = 0;
            this.onMessage( "GivePLZ The point was made. TakeNRG" );
        }

        // check to see if we sevened out
        else if ( dieTotal == 7 )
        {
            this.processBets( this.passBets,      this.betLost );
            this.processBets( this.passOddsBets,  this.betLost );
            this.processBets( this.dpassBets,     this.betWon  );
            this.processBets( this.dpassOddsBets, this.darkOddsWon.bind( { crapsTable: this, number: this.point } ));
            this.point = 0;
            this.onMessage( "GivePLZ Seven out. TakeNRG" );
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
        if ( this.fieldBets.size     > 0 ) return true;
        if ( this.anyCrapsBets.size  > 0 ) return true;
        if ( this.anySevenBets.size  > 0 ) return true;

        // iterate over bets arrays; indices: [ 0, 4, 5, 6, 8, 9, 10 ]
        for ( var i = 0; i <= 10; i++ ) if (( i == 0 ) || (( i >= 4 ) && ( i != 7 )))
        {
            if ( this.comeBets[  i ].size > 0 ) return true;
            if ( this.dcomeBets[ i ].size > 0 ) return true;

            // skip index 0
            if ( i != 0 )
            {
                if ( this.comeOddsBets[  i ].size > 0 ) return true;
                if ( this.dcomeOddsBets[ i ].size > 0 ) return true;
                if ( this.placeBets[     i ].size > 0 ) return true;
                if ( this.dplaceBets[    i ].size > 0 ) return true;
                if ( this.buyBets[       i ].size > 0 ) return true;
                if ( this.layBets[       i ].size > 0 ) return true;
            }
        }

        // iterate over hard bets array; indices: [ 4, 6, 8, 10 ]
        for ( var i = 4; i <= 10; i += 2 ) if ( this.hardBets[ i ].size > 0 ) return true;

        // iterate over hop bets array
        for ( var i = 1; i <= 6; i++ ) for ( var j = i; j <= 6; j++ )
        {
            if ( this.hopBets[ i ][ j ].size > 0 ) return true;
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

        if ( command.startsWith( "roll" )) this.rollCommand( username, command );
        else if ( command == "help" ) this.userMessage( username, "player guide: https://git.io/fhHjL" );
        else if ( command == "balance" ) this.balanceCommand( username );
        else if ( command == "bets" ) this.betsCommand( username );
        else if ( command.startsWith( "bet" )) this.betCommand( username, command );
        else this.userMessage( username, "uncrecognized command. For help: !craps help" );
    },

    rollCommand( username, command )
    {
        if ( username.toLowerCase() != config.owner.toLowerCase() )
        {
            this.userMessage( username, "you are not authorized to use this command." );
            return;
        }

        if ( !config.debug )
        {
            this.userMessage( username, "enable debugging to use this command." );
            return;
        }

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
            this.userMessage( username, "you must specify two die values." );
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
            this.userMessage( username, "die values must be between 1 and 6." );
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

    betDispaly( username, betType, betMap )
    {
        // skip bet display for bets that don't exist (such as come odds for index 0)
        if ( betMap === undefined ) return false;

        if ( betMap.has( username ))
        {
            this.userMessage( username, betType + ": " + this.formatCurrency( betMap.get( username )));
            return true;
        }

        return false;
    },

    betsCommand( username )
    {
        // skip if the player has already viewed their bets since the last die roll
        if ( this.playersShownBets.includes( username )) return;
        this.playersShownBets.push( username );

        var betsFound = false;
        if ( this.betDispaly( username, "pass",       this.passBets      )) betsFound = true;
        if ( this.betDispaly( username, "pass-odds",  this.passOddsBets  )) betsFound = true;
        if ( this.betDispaly( username, "dpass",      this.dpassBets     )) betsFound = true;
        if ( this.betDispaly( username, "dpass-odds", this.dpassOddsBets )) betsFound = true;
        if ( this.betDispaly( username, "field",      this.fieldBets     )) betsFound = true;
        if ( this.betDispaly( username, "any-craps",  this.anyCrapsBets  )) betsFound = true;
        if ( this.betDispaly( username, "any-seven",  this.anySevenBets  )) betsFound = true;

        // iterate over come bets arrays; indices: [ 0, 4, 5, 6, 8, 9, 10 ]
        for ( var i = 0; i <= 10; i++ ) if (( i == 0 ) || (( i >= 4 ) && ( i != 7 )))
        {
            var number = ( i == 0 ) ? "" : " " + i;

            if ( this.betDispaly( username, "come"       + number, this.comeBets[      i ] )) betsFound = true;
            if ( this.betDispaly( username, "come-odds"  + number, this.comeOddsBets[  i ] )) betsFound = true;
            if ( this.betDispaly( username, "dcome"      + number, this.dcomeBets[     i ] )) betsFound = true;
            if ( this.betDispaly( username, "dcome-odds" + number, this.dcomeOddsBets[ i ] )) betsFound = true;
        }

        // iterate over place, dplace, buy, and lay bets arrays; indices: [ 4, 5, 6, 8, 9, 10 ]
        for ( var i = 4; i <= 10; i++ ) if ( i != 7 )
        {
            if ( this.betDispaly( username, "place "  + i, this.placeBets[  i ] )) betsFound = true;
            if ( this.betDispaly( username, "dplace " + i, this.dplaceBets[ i ] )) betsFound = true;
            if ( this.betDispaly( username, "buy "    + i, this.buyBets[    i ] )) betsFound = true;
            if ( this.betDispaly( username, "lay "    + i, this.layBets[    i ] )) betsFound = true;
        }

        // iterate over hard bets array; indices: [ 4, 6, 8, 10 ]
        for ( var i = 4; i <= 10; i += 2 )
        {
            if ( this.betDispaly( username, "hard " + i, this.hardBets[ i ] )) betsFound = true;
        }

        // iterate over hop bets array
        for ( var i = 1; i <= 6; i++ ) for ( var j = i; j <= 6; j++ )
        {
            if ( this.betDispaly( username, "hop " + i + " " + j, this.hopBets[ i ][ j ] )) betsFound = true;
        }

        if ( !betsFound ) this.userMessage( username, "you have no bets." );
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
        else if ( bet.startsWith( "field" ))
        {
            this.handleBet( username, "field", this.fieldBets, undefined, bet );
        }
        else if ( bet.startsWith( "any-craps" ))
        {
            this.handleBet( username, "any-craps", this.anyCrapsBets, undefined, bet );
        }
        else if ( bet.startsWith( "any-seven" ))
        {
            this.handleBet( username, "any-seven", this.anySevenBets, undefined, bet );
        }
        else if ( bet.startsWith( "come-odds" ))
        {
            this.handleComeOddsBet( username, "come-odds", this.comeBets, this.comeOddsBets, bet, true );
        }
        else if ( bet.startsWith( "come" ))
        {
            this.handleBet( username, "come", this.comeBets[ 0 ], this.pointCheck.bind( this ), bet );
        }
        else if ( bet.startsWith( "dcome-odds" ))
        {
            this.handleComeOddsBet( username, "dcome-odds", this.dcomeBets, this.dcomeOddsBets, bet, false );
        }
        else if ( bet.startsWith( "dcome" ))
        {
            this.handleBet( username, "dcome", this.dcomeBets[ 0 ], this.pointCheck.bind( this ), bet );
        }
        else if ( bet.startsWith( "place"  )) this.handleNumberBet( username, "place",  this.placeBets,  bet );
        else if ( bet.startsWith( "dplace" )) this.handleNumberBet( username, "dplace", this.dplaceBets, bet );
        else if ( bet.startsWith( "buy"    )) this.handleNumberBet( username, "buy",    this.buyBets,    bet );
        else if ( bet.startsWith( "lay"    )) this.handleNumberBet( username, "lay",    this.layBets,    bet );
        else if ( bet.startsWith( "hard"   )) this.handleHardBet( username, bet );
        else if ( bet.startsWith( "hop"    )) this.handleHopBet( username, bet );
        else this.userMessage( username, "unrecognized bet." );
    },

    getBetNumber( username, type, bet )
    {
        if ( !bet.startsWith( type + " " ))
        {
            this.userMessage( username, "you must specify a number." );
            return Number.NaN;
        }

        var number = parseInt( bet.substr( type.length ).trim() );
        if ( Number.isNaN( number ))
        {
            this.userMessage( username, "unable to parse number." );
            return Number.NaN;
        }

        return number;
    },

    getBetPoint( username, type, bet )
    {
        number = this.getBetNumber( username, type, bet );
        if ( Number.isNaN( number )) return Number.NaN;

        if (( number < 4 ) || ( number == 7 ) || ( number > 10 ))
        {
            this.userMessage( username, "invalid number." );
            return Number.NaN;
        }

        return number;
    },

    getBetHardPoint( username, type, bet )
    {
        number = this.getBetPoint( username, type, bet );
        if ( Number.isNaN( number )) return Number.NaN;

        if (( number == 5 ) || ( number == 9 ))
        {
            this.userMessage( username, "invalid number." );
            return Number.NaN;
        }

        return number;
    },

    handleComeOddsBet( username, type, comeBets, comeOddsBets, bet, isLight )
    {
        number = this.getBetPoint( username, type, bet );
        if ( Number.isNaN( number )) return;
        var checkParams = { crapsTable: this, comeBets: comeBets, number: number, isLight: isLight }
        var checkFunction = this.comeOddsCheck.bind( checkParams );
        this.handleBet( username, type + " " + number, comeOddsBets[ number ], checkFunction, bet );
    },

    handleNumberBet( username, type, bets, bet )
    {
        number = this.getBetPoint( username, type, bet );
        if ( Number.isNaN( number )) return;
        this.handleBet( username, type + " " + number, bets[ number ], undefined, bet );
    },

    handleHardBet( username, bet )
    {
        var type = "hard";
        number = this.getBetHardPoint( username, type, bet );
        if ( Number.isNaN( number )) return;
        this.handleBet( username, type + " " + number, this.hardBets[ number ], undefined, bet );
    },

    handleHopBet( username, bet )
    {
        var type = "hop";
        var data = bet.substr( type.length ).trim();
        var values = data.split( " " );
        if ( values.length < 2 )
        {
            this.userMessage( username, "you must specify two die values." );
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
            this.userMessage( username, "die values must be between 1 and 6." );
            return;
        }

        // ensure that we access our hop bet array with the lower die as the first index
        var i = die1 < die2 ? die1 : die2;
        var j = die1 < die2 ? die2 : die1;

        this.handleBet( username, type + " " + die1 + " " + die2, this.hopBets[ i ][ j ], undefined, bet );
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
                    username, "bet exceeds your available balance: " + this.formatCurrency( availableBalance ));
            return;
        }

        if ( bets.has( username ))
        {
            this.userMessage( username, "you've already made this bet." );
            return;
        }

        // call check function, if it is defined
        if (( checkFunction !== undefined ) && ( !checkFunction( username, amount ))) return;

        this.userMessage( username, "bet made: " + this.formatCurrency( amount ));
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

    maxOddsCheck( username, baseAmount, oddsAmount, oddsMultiplier )
    {
        var maxBet = baseAmount * config.maxOdds * oddsMultiplier;
        if ( oddsAmount > maxBet )
        {
            this.userMessage( username, "bet exceeds your maximum odds bet: " + this.formatCurrency( maxBet ));
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
        if ( !this.maxOddsCheck( username, this.passBets.get( username ), amount, 1 )) return false;
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

        var baseAmount = this.dpassBets.get( username );
        var oddsMultiplier = this.oddsMultiplier( this.point );
        if ( !this.maxOddsCheck( username, baseAmount, amount, oddsMultiplier )) return false;

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
    // - number: the point for the come odds
    // - isLight: true for "come-odds" bets, false for "dcome-odds" bets
    comeOddsCheck( username, amount )
    {
        var type = this.isLight ? "come" : "don't come";

        if ( !this.comeBets[ this.number ].has( username ))
        {
            this.crapsTable.userMessage( username, "you need a \"" + type + "\" bet on this number first." );
            return false;
        }

        var baseAmount = this.comeBets[ this.number ].get( username );
        var oddsMultiplier = this.isLight ? 1 : this.crapsTable.oddsMultiplier( this.number );
        if ( !this.crapsTable.maxOddsCheck.bind( this.crapsTable )( username, baseAmount, amount, oddsMultiplier ))
        {
            return false;
        }

        return true;
    }
};
