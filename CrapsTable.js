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

var fs        = require( "fs"             );
var scripting = require( "./Scripting.js" );
var Util      = require( "./Util.js"      );
var config    = require( "./config.js"    );

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
    fireBets: new Map(),
    firePoints: [],
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
    die1: 0,
    die2: 0,
    dieTotal: 0,
    point: 0,
    botUsername: null,
    banker: null,
    bankerQueue: [],
    removeBanker: false,
    commandCooldownHelp: 0,
    commandCooldownBalance: [],
    commandCooldownBankerBalance: [],
    commandCooldownBanker: [],
    commandCooldownBankerStop: [],
    commandCooldownBets: [],
    balanceAdjustmentCounter: 0,
    rollTimerRunning: false,
    rollTimerCounter: 0,
    canDisplayLeaderboard: false,

    // override this function to listen to craps table messages
    onMessage( message ) {},

    // inform the craps table that the message queue is empty
    messageQueueEmpty()
    {
        if ( this.canDisplayLeaderboard )
        {
            this.displayLeaderboard();
            this.canDisplayLeaderboard = false;
        }
    },

    userMessage( username, isScripting, isError, helpNeeded, message )
    {
        if (( helpNeeded ) && ( !isScripting )) message += " For help: !craps help";

        if ( isScripting )
        {
            if ( isError ) scripting.errorMessage( username, message );
            else scripting.infoMessage( username, message );
        }
        else this.onMessage( "@" + username + ", " + message );
    },

    resetFirePoints()
    {
        // iterate over fire points array; indices: [ 4, 5, 6, 8, 9, 10 ]
        for ( var i = 4; i <= 10; i++ ) if ( i != 7 ) this.firePoints[ i ] = false;
    },

    init( botUsername )
    {
        this.botUsername = botUsername;
        this.resetFirePoints();

        scripting.externalUserMessage             = this.userMessage.bind( this );
        scripting.externalProcessScriptingCommand = this.processScriptingCommand.bind( this );
        scripting.externalVariableReference       = this.scriptingVariableReference.bind( this );

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
                Util.log( "Unable to read \"players.json\". Resetting player balances.", true );
                return;
            }

            this.playerBalances = new Map( JSON.parse( data ));
            this.displayLeaderboard();
        } );
    },

    startRollTimer()
    {
        this.rollTimerRunning = true;
        this.rollTimerCounter = config.rollingDelay;
    },

    stopRollTimer()
    {
        this.rollTimerRunning = false;
    },

    // decrement global cooldowns
    cooldownTimer()
    {
        if ( this.commandCooldownHelp > 0 ) this.commandCooldownHelp--;
    },

    // increment player balances below minimum balance
    balanceAdjustmentTimer()
    {
        this.balanceAdjustmentCounter++;
        if ( this.balanceAdjustmentCounter > config.balanceCheckInterval )
        {
            this.balanceAdjustmentCounter = 0;

            for ( let username of this.playerBalances.keys() )
            {
                if ( this.getBalance( username ) < config.minimumBalance * 100 )
                {
                    var newBalance = this.getBalance( username ) + config.balanceCheckAdjustment * 100;
                    if ( newBalance > config.minimumBalance * 100 ) newBalance = config.minimumBalance * 100;
                    this.playerBalances.set( username, newBalance );
                }
            }
        }
    },

    // roll the dice after the specified rolling delay has expired
    rollTimer()
    {
        // do nothing if the timer isn't running
        if ( !this.rollTimerRunning ) return;

        this.rollTimerCounter--;
        if ( this.rollTimerCounter <= 0 )
        {
            this.processRandomRoll();
        }
    },

    crapsTimer()
    {
        this.cooldownTimer();
        this.balanceAdjustmentTimer();
        this.rollTimer();
    },

    // handle scripting variable references
    scriptingVariableReference( username, varName )
    {
        var fireBetAllowed = ( this.firePointCount() == 0 ) && ( this.point == 0 );
        switch( varName )
        {
            case "fireBetAllowed" : return { type: "boolean", value: fireBetAllowed                    };
            case "die1"           : return { type: "number",  value: this.die1                         };
            case "die2"           : return { type: "number",  value: this.die2                         };
            case "dieTotal"       : return { type: "number",  value: this.dieTotal                     };
            case "point"          : return { type: "number",  value: this.point                        };
            case "maxPayout"      : return { type: "number",  value: this.getMaxPayout()         / 100 };
            case "balance"        : return { type: "number",  value: this.getBalance( username ) / 100 };
            case "bankerBalance"  : return { type: "number",  value: this.getBankerBalance()     / 100 };
        }

        return null;
    },

    checkBanker()
    {
        if ( this.banker === null )
        {
            this.banker = this.botUsername;
            this.onMessage( "GivePLZ " + this.banker + " is the banker. TakeNRG" );
            this.displayMaxPayout();
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

    formatCurrency( amount, prefix = "§" )
    {
        return prefix + ( amount / 100 ).toLocaleString( "en-US", { minimumFractionDigits: 2 } );
    },

    safeParseInt( value )
    {
        // don't attempt to parse if the value is not entirely numeric
        var regex = /^\d+$/;
        if ( !regex.test( value )) return NaN;

        // otherwise, parse the value with a radix of 10
        return parseInt( value, 10 );
    },

    getBet( username, betMap )
    {
        if ( betMap.has( username )) return betMap.get( username );
        return 0;
    },

    getBetsPayout( bets, betResult )
    {
        var payout = 0;
        for ( let username of bets.keys() ) payout += Math.floor( betResult() * bets.get( username ));
        return payout;
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

    getBankerBalance()
    {
        this.checkBanker();
        return this.getBalance( this.banker );
    },

    getMaxPayout()
    {
        return Math.floor( this.getBankerBalance() * config.maxBetPayout );
    },

    getAvailableBankerBalance()
    {
        var availableBalance = this.getBankerBalance();

        availableBalance -= this.getBetsPayout( this.passBets,     this.betWon                                      );
        availableBalance -= this.getBetsPayout( this.dpassBets,    this.betWon                                      );
        availableBalance -= this.getBetsPayout( this.fieldBets,    this.betWonMultiplier.bind( { multiplier: 3   } ));
        availableBalance -= this.getBetsPayout( this.anyCrapsBets, this.betWonMultiplier.bind( { multiplier: 7.5 } ));
        availableBalance -= this.getBetsPayout( this.anySevenBets, this.betWonMultiplier.bind( { multiplier: 4   } ));
        availableBalance -= this.getBetsPayout( this.fireBets,     this.betWonMultiplier.bind( { multiplier: 999 } ));

        availableBalance -= this.getBetsPayout(
                this.passOddsBets, this.lightOddsWon.bind( { crapsTable: this, number: this.point } ));
        availableBalance -= this.getBetsPayout(
                this.dpassOddsBets, this.darkOddsWon.bind( { crapsTable: this, number: this.point } ));

        // iterate over bets arrays; indices: [ 0, 4, 5, 6, 8, 9, 10 ]
        for ( var i = 0; i <= 10; i++ ) if (( i == 0 ) || (( i >= 4 ) && ( i != 7 )))
        {
            availableBalance -= this.getBetsPayout( this.comeBets[  i ], this.betWon );
            availableBalance -= this.getBetsPayout( this.dcomeBets[ i ], this.betWon );

            // skip index 0
            if ( i != 0 )
            {
                availableBalance -= this.getBetsPayout(
                        this.comeOddsBets[ i ], this.lightOddsWon.bind( { crapsTable: this, number: i } ));
                availableBalance -= this.getBetsPayout(
                        this.dcomeOddsBets[ i ], this.darkOddsWon.bind( { crapsTable: this, number: i } ));
                availableBalance -= this.getBetsPayout(
                        this.placeBets[ i ], this.placeWon.bind( { crapsTable: this, number: i } ));
                availableBalance -= this.getBetsPayout(
                        this.dplaceBets[ i ], this.dplaceWon.bind( { crapsTable: this, number: i } ));
                availableBalance -= this.getBetsPayout(
                        this.buyBets[ i ], this.buyWon.bind( { crapsTable: this, number: i } ));
                availableBalance -= this.getBetsPayout(
                        this.layBets[ i ], this.layWon.bind( { crapsTable: this, number: i } ));
            }
        }

        // iterate over hard bets array; indices: [ 4, 6, 8, 10 ]
        for ( var i = 4; i <= 10; i += 2 )
        {
            availableBalance -= this.getBetsPayout(
                    this.hardBets[ i ], this.hardwayWon.bind( { crapsTable: this, number: i } ));
        }

        // iterate over hop bets array
        for ( var i = 1; i <= 6; i++ ) for ( var j = i; j <= 6; j++ )
        {
            availableBalance -= this.getBetsPayout(
                    this.hopBets[ i ][ j ], this.hopWon.bind( { crapsTable: this, die1: i, die2: j } ));
        }

        return availableBalance;
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
        availableBalance -= this.getBet( username, this.fireBets      );

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

    showBetResults()
    {
        for ( let username of this.betResults.keys() )
        {
            var result = this.betResults.get( username );
            if ( result > 0 )
            {
                this.userMessage( username, false, false, false, "won: " + this.formatCurrency( result ));
            }
            if ( result < 0 )
            {
                this.userMessage( username, false, false, false, "lost: " + this.formatCurrency( -result ));
            }
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
            default : return NaN;
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
            default : throw "Unrecognized number.";
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
            default : throw "Unrecognized number.";
        }
    },

    hardwayMultiplier( number )
    {
        switch( number )
        {
            case 4  :
            case 10 : return 7;
            case 6  :
            case 8  : return 9;
            default : throw "Unrecognized number.";
        }
    },

    hopMultiplier( die1, die2 )
    {
        // determine multiplier based on "hard" or "easy" hop bets
        return ( die1 == die2 ) ? 33 : 16;
    },

    betWon()
    {
        return 1;
    },

    // you must bind an object to this function as follows:
    // - multiplier: the multiplier for the bet
    betWonMultiplier()
    {
        return this.multiplier;
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - number: the point for the odds
    lightOddsWon()
    {
        return this.crapsTable.oddsMultiplier( this.number );
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - number: the point for the odds
    darkOddsWon()
    {
        return 1 / this.crapsTable.oddsMultiplier( this.number );
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - number: the number for the bet
    placeWon()
    {
        return this.crapsTable.placeMultiplier( this.number );
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - number: the number for the bet
    dplaceWon()
    {
        return this.crapsTable.dplaceMultiplier( this.number );
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - number: the number for the bet
    buyWon()
    {
        return this.crapsTable.oddsMultiplier( this.number ) - ( 1 / 20 );
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - number: the number for the bet
    layWon()
    {
        var oddsMultiplier = this.crapsTable.oddsMultiplier( this.number );
        return ( 1 / oddsMultiplier ) - ( 1 / ( oddsMultiplier * 20 ));
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - number: the number for the bet
    hardwayWon()
    {
        return this.crapsTable.hardwayMultiplier( this.number );
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - die1: the number on the first die
    // - die2: the number on the second die
    hopWon()
    {
        return this.crapsTable.hopMultiplier( this.die1, this.die2 );
    },

    betLost()
    {
        return -1;
    },

    processBets( bets, betResult )
    {
        for ( let username of bets.keys() )
        {
            var result = Math.floor( betResult() * bets.get( username ));
            this.adjustBalance( username, result );
            this.adjustBalance( this.banker, -result );
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

        if ( die1 == die2 )
        {
            this.processBets( this.hardBets[ number ], this.hardwayWon.bind( { crapsTable: this, number: number } ));
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

        // hop bets for the specific die roll win
        this.processBets( this.hopBets[ i ][ j ], this.hopWon.bind( { crapsTable: this, die1: i, die2: j } ));

        // iterate over hop bets array
        for ( var i = 1; i <= 6; i++ ) for ( var j = i; j <= 6; j++ )
        {
            // all other hop bets lose
            this.processBets( this.hopBets[ i ][ j ], this.betLost );
        }
    },

    firePointCount()
    {
        // count up fire points by iterating over fire points array; indices: [ 4, 5, 6, 8, 9, 10 ]
        var result = 0;
        for ( var i = 4; i <= 10; i++ ) if ( i != 7 ) if ( this.firePoints[ i ] ) result++;
        return result;
    },

    // display which fire points have been made
    displayFirePoints()
    {
        var firePointCount = this.firePointCount();
        if ( firePointCount == 6 ) this.onMessage( "GivePLZ All six fire points made! TakeNRG" );
        else if ( firePointCount > 0 )
        {
            var firePointDisplay = "";

            // iterate over fire points array; indices: [ 4, 5, 6, 8, 9, 10 ]
            for ( var i = 4; i <= 10; i++ ) if ( i != 7 ) if ( this.firePoints[ i ] )
            {
                if ( firePointDisplay.length > 0 ) firePointDisplay += ", ";
                firePointDisplay += i;
            }

            this.onMessage( "GivePLZ Fire points: " + firePointDisplay + " TakeNRG" );
        }
    },

    // update the craps table based on the results of the specifed roll
    processRoll( die1, die2 )
    {
        // allow all players to use once-per-roll commands again
        this.commandCooldownBalance       = [];
        this.commandCooldownBankerBalance = [];
        this.commandCooldownBanker        = [];
        this.commandCooldownBankerStop    = [];
        this.commandCooldownBets          = [];

        // print out the roll
        var dieTotal = die1 + die2;
        var pointDisplay = this.point == 0 ? "No Point" : "Point: " + this.point;
        this.onMessage( "GivePLZ " + pointDisplay + ", Roll: " + die1 + " " + die2 + " (" + dieTotal + ") TakeNRG" );

        // preserve the die values
        this.die1 = die1;
        this.die2 = die2;
        this.dieTotal = dieTotal;

        // process bets
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
            // if fire bets exist, mark the fire point
            if ( this.fireBets.size > 0 ) this.firePoints[ dieTotal ] = true;

            this.processBets( this.passBets,      this.betWon  );
            this.processBets( this.dpassBets,     this.betLost );
            this.processBets( this.dpassOddsBets, this.betLost );
            this.processBets( this.passOddsBets,  this.lightOddsWon.bind( { crapsTable: this, number: this.point } ));
            this.point = 0;
            this.onMessage( "GivePLZ The point was made. TakeNRG" );
            this.displayFirePoints();

            // pay out fire bet if all six fire points are made
            var firePointCount = this.firePointCount();
            if ( firePointCount == 6 )
            {
                this.processBets( this.fireBets, this.betWonMultiplier.bind( { multiplier: 999 } ));
                this.resetFirePoints();
            }
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

            // process fire bets, if they exist
            if ( this.fireBets.size > 0 )
            {
                // process fire bets
                var firePointCount = this.firePointCount();
                if ( firePointCount == 4 )
                {
                    this.processBets( this.fireBets, this.betWonMultiplier.bind( { multiplier: 24 } ));
                }
                else if ( firePointCount == 5 )
                {
                    this.processBets( this.fireBets, this.betWonMultiplier.bind( { multiplier: 249 } ));
                }
                else this.processBets( this.fireBets, this.betLost );

                // display fire point count
                this.onMessage( "GivePLZ " + ( firePointCount == 0 ? "No" : "Only " + firePointCount ) +
                                " fire point" + ( firePointCount == 1 ? "" : "s" ) + " made. TakeNRG" );

                this.resetFirePoints();
            }
        }

        var betResultsDisplayed = this.betResults.size > 0;
        this.showBetResults();

        // if the table is not active: stop the roll timer (among other things)
        if ( !this.isTableActive() )
        {
            // save player balances
            fs.writeFile( "players.json", JSON.stringify( [ ...this.playerBalances ], undefined, 4 ),
                          ( err ) => { if ( err ) throw err; } );

            // select the next banker
            if ( this.bankerQueue.length == 0 )
            {
                if ( this.removeBanker )
                {
                    this.banker = null;
                    this.removeBanker = false;
                    this.onMessage( "GivePLZ We need a new banker! TakeNRG" );
                }
                else this.onMessage( "GivePLZ " + this.banker + " is still the banker. TakeNRG" );
            }
            else
            {
                this.banker = this.bankerQueue.shift();
                this.removeBanker = false;
                this.onMessage( "GivePLZ " + this.banker + " is the new banker. TakeNRG" );
            }

            if ( this.banker !== null ) this.displayMaxPayout();
            this.stopRollTimer();
            this.canDisplayLeaderboard = true;
        }
        // otherwise: start the timer for the next roll and display the max payout
        else
        {
            // only display the max payout if bets were won or lost
            if ( betResultsDisplayed ) this.displayMaxPayout();
            this.startRollTimer();
        }

        scripting.runPrograms();
    },

    isTableActive()
    {
        // table is active if bets exist or if we have a point
        return ( this.betsExist() || this.point != 0 );
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
        if ( this.fireBets.size      > 0 ) return true;

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

    displayMaxPayout()
    {
        this.onMessage( "GivePLZ Max payout: " + this.formatCurrency( this.getMaxPayout() ) + " TakeNRG" );
    },

    displayLeaderboard()
    {
        // get the maximum length of the leaderboard elements
        var indexMaxLength = this.playerBalances.size.toString().length;
        var usernameMaxLength = 0;
        var balanceMaxLength = 0;
        for ( let username of this.playerBalances.keys() )
        {
            var balance = this.formatCurrency( this.getBalance( username ), "" );
            if ( username.length > usernameMaxLength ) usernameMaxLength = username.length;
            if ( balance.length > balanceMaxLength   ) balanceMaxLength  = balance.length;
        }

        // format the leaderboard
        var leaderboard = [];
        for ( let username of this.playerBalances.keys() )
        {
            var balance = this.formatCurrency( this.getBalance( username ), "" );
            var usernameSpacing = " ".repeat( usernameMaxLength - username.length );
            var balanceSpacing  = " ".repeat( balanceMaxLength  - balance.length  );
            var item = username + usernameSpacing + " : § " + balanceSpacing + balance;
            leaderboard.push( { balance: this.getBalance( username ), item: item } );
        }

        // sort and print out the leaderboard
        var line = "-".repeat( indexMaxLength    ) +
                   "-".repeat( usernameMaxLength ) +
                   "-".repeat( balanceMaxLength  ) +
                   "--------";
        Util.log( line, true );

        leaderboard.sort( function( b, a ) { return a.balance - b.balance; } );
        for ( var i = 0; i < leaderboard.length; i++ )
        {
            var index = ( i + 1 ).toString();
            var indexSpacing = " ".repeat( indexMaxLength - index.length );
            Util.log( indexSpacing + index + " - " + leaderboard[ i ].item, true );
        }

        Util.log( line, true );
    },

    // cooldown for commands users are allowed to run once per roll; return true if the user has already run the command
    commandCooldown( username, cooldownArray )
    {
        if ( cooldownArray.includes( username )) return true;
        cooldownArray.push( username );
        return false;
    },

    // process chat commands
    processCommand( username, command )
    {
        if ( command.length == 0 )
        {
            this.userMessage( username, false, true, true, "you must specify a command." );
            return;
        }

        // allow the scripting engine to process the command rather than this function
        if ( scripting.processCommand( username, command )) return;

        var commandName = Util.getCommandPrefix( command );
        var commandData = Util.getCommandRemainder( command );

        switch( commandName )
        {
            case "force"          : this.forceCommand(         username, commandData        ); break;
            case "roll"           : this.rollCommand(          username, commandData        ); break;
            case "help"           : this.helpCommand(          username                     ); break;
            case "balance"        : this.balanceCommand(       username                     ); break;
            case "banker-balance" : this.bankerBalanceCommand( username                     ); break;
            case "banker"         : this.bankerCommand(        username                     ); break;
            case "banker-stop"    : this.bankerStopCommand(    username                     ); break;
            case "bets"           : this.betsCommand(          username                     ); break;
            case "bet"            : this.betCommand(           username, commandData, false ); break;
            default : this.userMessage( username, false, true, true, "uncrecognized command." );
        }
    },

    // process scripting commands
    processScriptingCommand( username, command )
    {
        if ( command.length == 0 ) return;

        var commandName = Util.getCommandPrefix( command );
        var commandData = Util.getCommandRemainder( command );

        switch( commandName )
        {
            case "bet" : this.betCommand( username, commandData, true ); return true;
        }

        return false;
    },

    authorizeAdminCommand( username )
    {
        if ( username.toLowerCase() != config.owner.toLowerCase() )
        {
            this.userMessage( username, false, true, false, "you are not authorized to use this command." );
            return false;
        }

        if ( !config.debug )
        {
            this.userMessage( username, false, true, false, "enable debugging to use this command." );
            return false;
        }

        return true;
    },

    forceCommand( username, commandData )
    {
        // skip if the user is not authorized to use admin commands
        if ( !this.authorizeAdminCommand( username )) return;

        if ( commandData.length == 0 )
        {
            this.userMessage( username, false, true, false, "you must specify who you are forcing to run a command." );
            return;
        }

        var forcedUsername = Util.getCommandPrefix( commandData );
        var forcedCommand  = Util.getCommandRemainder( commandData );
        this.processCommand( forcedUsername, forcedCommand );
    },

    rollCommand( username, commandData )
    {
        // skip if the user is not authorized to use admin commands
        if ( !this.authorizeAdminCommand( username )) return;

        this.checkBanker();

        if ( commandData.length == 0 )
        {
            this.processRandomRoll();
            return;
        }

        commandData = Util.collapseSpace( commandData );
        var commandDataSplits = commandData.split( " " );

        if ( commandDataSplits.length < 2 )
        {
            this.userMessage( username, false, true, false, "you must specify two die values." );
            return;
        }

        var die1 = this.safeParseInt( commandDataSplits[ 0 ] );
        var die2 = this.safeParseInt( commandDataSplits[ 1 ] );

        if (( Number.isNaN( die1 )) || ( Number.isNaN( die2 )))
        {
            this.userMessage( username, false, true, false, "unable to parse die values." );
            return;
        }

        if (( die1 < 1 ) || ( die1 > 6 ) || ( die2 < 1 ) || ( die2 > 6 ))
        {
            this.userMessage( username, false, true, false, "die values must be between 1 and 6." );
            return;
        }

        this.processRoll( die1, die2 );
    },

    helpCommand( username )
    {
        // skip if the help command cooldown has not expired
        if ( this.commandCooldownHelp > 0 ) return;

        this.userMessage( username, false, false, false, "player guide: https://git.io/fhHjL" );
        this.commandCooldownHelp = config.helpCooldown;
    },

    balanceCommand( username )
    {
        // skip if the player has already run this command since the last die roll
        if ( this.commandCooldown( username, this.commandCooldownBalance )) return;

        var balance = this.getBalance( username );
        var availableBalance =
                this.banker == username ? this.getAvailableBankerBalance() : this.getAvailableBalance( username );
        var message = "balance: " + this.formatCurrency( balance );
        if ( balance != availableBalance ) message += "; available balance: " + this.formatCurrency( availableBalance );
        this.userMessage( username, false, false, false, message );
    },

    bankerBalanceCommand( username )
    {
        // skip if the player has already run this command since the last die roll
        if ( this.commandCooldown( username, this.commandCooldownBankerBalance )) return;

        var balance = this.getBankerBalance();
        var availableBalance = this.getAvailableBankerBalance();

        var message = "banker balance: " + this.formatCurrency( balance );
        if ( balance != availableBalance )
        {
            message += "; available banker balance: " + this.formatCurrency( availableBalance );
        }

        this.userMessage( username, false, false, false, message );
    },

    bankerCommand( username )
    {
        // skip if the player has already run this command since the last die roll
        if ( this.commandCooldown( username, this.commandCooldownBanker )) return;

        if ( this.banker !== null )
        {
            if ( this.banker == username )
            {
                this.userMessage( username, false, false, false, "you're already the banker." );
                return;
            }

            if ( this.bankerQueue.includes( username ))
            {
                this.userMessage( username, false, false, false, "you're already in the banker queue." );
                return;
            }

            this.bankerQueue.push( username );
            this.userMessage( username, false, false, false, "you've been added to the banker queue." );
        }
        else
        {
            this.banker = username;
            this.userMessage( username, false, false, false, "you're now the banker!" );
            this.displayMaxPayout();
        }
    },

    bankerStopCommand( username )
    {
        // skip if the player has already run this command since the last die roll
        if ( this.commandCooldown( username, this.commandCooldownBankerStop )) return;

        if ( this.banker != username )
        {
            if ( !this.bankerQueue.includes( username ))
            {
                // user is not currently the banker and is not in the banker queue
                this.userMessage( username, false, false, false,
                                  "you're not currently the banker or in the banker queue." );
            }
            else
            {
                // user is not currently the banker but is in the banker queue
                var newBankerQueue = [];
                while ( this.bankerQueue.length != 0 )
                {
                    var bankerName = this.bankerQueue.shift();
                    if ( bankerName != username ) newBankerQueue.push( bankerName );
                }

                this.bankerQueue = newBankerQueue;
                this.userMessage( username, false, false, false, "you've been removed from the banker queue." );
            }
        }
        else
        {
            if ( this.isTableActive() )
            {
                // user is currently the banker and the table is active
                this.removeBanker = true;
                this.userMessage( username, false, false, false, "you'll be removed as banker as soon as possible." );
            }
            else
            {
                // user is currently the banker and the table is not active
                this.banker = null;
                this.userMessage( username, false, false, false, "you're no longer the banker." );
            }
        }
    },

    betDispaly( username, betType, betMap )
    {
        // skip bet display for bets that don't exist (such as come odds for index 0)
        if ( betMap === undefined ) return false;

        if ( betMap.has( username ))
        {
            this.userMessage( username, false, false, false,
                              betType + ": " + this.formatCurrency( betMap.get( username )));
            return true;
        }

        return false;
    },

    betsCommand( username )
    {
        // skip if the player has already run this command since the last die roll
        if ( this.commandCooldown( username, this.commandCooldownBets )) return;

        var betsFound = false;
        if ( this.betDispaly( username, "pass",       this.passBets      )) betsFound = true;
        if ( this.betDispaly( username, "pass-odds",  this.passOddsBets  )) betsFound = true;
        if ( this.betDispaly( username, "dpass",      this.dpassBets     )) betsFound = true;
        if ( this.betDispaly( username, "dpass-odds", this.dpassOddsBets )) betsFound = true;
        if ( this.betDispaly( username, "field",      this.fieldBets     )) betsFound = true;
        if ( this.betDispaly( username, "any-craps",  this.anyCrapsBets  )) betsFound = true;
        if ( this.betDispaly( username, "any-seven",  this.anySevenBets  )) betsFound = true;
        if ( this.betDispaly( username, "fire",       this.fireBets      )) betsFound = true;

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

        if ( !betsFound ) this.userMessage( username, false, false, false, "you have no bets." );
    },

    betCommand( username, commandData, isScripting )
    {
        this.checkBanker();

        if ( this.banker == username )
        {
            this.userMessage( username, isScripting, true, true, "the banker cannot bet." );
            return;
        }

        if ( commandData.length == 0 )
        {
            this.userMessage( username, isScripting, true, true, "you must specify which bet you wish to make." );
            return;
        }

        var betType = Util.getCommandPrefix( commandData );
        var betData = Util.getCommandRemainder( commandData );

        if ( betType == "pass" )
        {
            this.handleBet( username, this.passBets, undefined, undefined, this.betWon, betData, isScripting );
        }
        else if ( betType == "pass-odds" )
        {
            var payoutFunction = this.lightOddsWon.bind( { crapsTable: this, number: this.point } );
            this.handleBet( username, this.passOddsBets, this.passOddsMaxBet.bind( this ),
                            this.passOddsCheck.bind( this ), payoutFunction, betData, isScripting );
        }
        else if ( betType == "dpass" )
        {
            this.handleBet( username, this.dpassBets, undefined, this.dpassCheck.bind( this ), this.betWon, betData,
                            isScripting );
        }
        else if ( betType == "dpass-odds" )
        {
            var payoutFunction = this.darkOddsWon.bind( { crapsTable: this, number: this.point } );
            this.handleBet( username, this.dpassOddsBets, this.dpassOddsMaxBet.bind( this ),
                            this.dpassOddsCheck.bind( this ), payoutFunction, betData, isScripting );
        }
        else if ( betType == "field" )
        {
            var payoutFunction = this.betWonMultiplier.bind( { multiplier: 3 } );
            this.handleBet( username, this.fieldBets, undefined, undefined, payoutFunction, betData, isScripting );
        }
        else if ( betType == "any-craps" )
        {
            var payoutFunction = this.betWonMultiplier.bind( { multiplier: 7.5 } );
            this.handleBet( username, this.anyCrapsBets, undefined, undefined, payoutFunction, betData, isScripting );
        }
        else if ( betType == "any-seven" )
        {
            var payoutFunction = this.betWonMultiplier.bind( { multiplier: 4 } );
            this.handleBet( username, this.anySevenBets, undefined, undefined, payoutFunction, betData, isScripting );
        }
        else if ( betType == "fire" )
        {
            var payoutFunction = this.betWonMultiplier.bind( { multiplier: 999 } );
            this.handleBet( username, this.fireBets, undefined, this.fireCheck.bind( this ), payoutFunction, betData,
                            isScripting );
        }
        else if ( betType == "come" )
        {
            this.handleBet( username, this.comeBets[ 0 ], undefined, this.pointCheck.bind( this ), this.betWon, betData,
                            isScripting );
        }
        else if ( betType == "come-odds" )
        {
            this.handleComeOddsBet( username, this.comeBets, this.comeOddsBets, betData, true, isScripting );
        }
        else if ( betType == "dcome" )
        {
            this.handleBet( username, this.dcomeBets[ 0 ], undefined, this.pointCheck.bind( this ), this.betWon,
                            betData, isScripting );
        }
        else if ( betType == "dcome-odds" )
        {
            this.handleComeOddsBet( username, this.dcomeBets, this.dcomeOddsBets, betData, false, isScripting );
        }
        else if ( betType == "place" )
        {
            this.handleNumberBet( username, this.placeBets, this.placeWon, betData, isScripting );
        }
        else if ( betType == "dplace" )
        {
            this.handleNumberBet( username, this.dplaceBets, this.dplaceWon, betData, isScripting );
        }
        else if ( betType == "buy"  ) this.handleNumberBet( username, this.buyBets, this.buyWon, betData, isScripting );
        else if ( betType == "lay"  ) this.handleNumberBet( username, this.layBets, this.layWon, betData, isScripting );
        else if ( betType == "hard" ) this.handleHardBet( username, betData, isScripting );
        else if ( betType == "hop"  ) this.handleHopBet(  username, betData, isScripting );
        else this.userMessage( username, isScripting, true, true, "unrecognized bet." );
    },

    getBetNumber( username, betData, isScripting )
    {
        if ( betData.length == 0 )
        {
            this.userMessage( username, isScripting, true, true, "you must specify a number." );
            return Number.NaN;
        }

        var number = this.safeParseInt( Util.getCommandPrefix( betData ));
        if ( Number.isNaN( number ))
        {
            this.userMessage( username, isScripting, true, true, "unable to parse number." );
            return Number.NaN;
        }

        return number;
    },

    getBetPoint( username, betData, isScripting )
    {
        var number = this.getBetNumber( username, betData, isScripting );
        if ( Number.isNaN( number )) return Number.NaN;

        if (( number < 4 ) || ( number == 7 ) || ( number > 10 ))
        {
            this.userMessage( username, isScripting, true, true, "invalid number." );
            return Number.NaN;
        }

        return number;
    },

    getBetHardPoint( username, betData, isScripting )
    {
        var number = this.getBetPoint( username, betData, isScripting );
        if ( Number.isNaN( number )) return Number.NaN;

        if (( number == 5 ) || ( number == 9 ))
        {
            this.userMessage( username, isScripting, true, true, "invalid number." );
            return Number.NaN;
        }

        return number;
    },

    handleComeOddsBet( username, comeBets, comeOddsBets, betData, isLight, isScripting )
    {
        var number = this.getBetPoint( username, betData, isScripting );
        if ( Number.isNaN( number )) return;

        var bindParams = { crapsTable: this, comeBets: comeBets, number: number, isLight: isLight };
        var checkFunction = this.comeOddsCheck.bind( bindParams );
        var maxBetFunction = this.comeOddsMaxBet.bind( bindParams );

        var payoutFunction = isLight ?
                             this.lightOddsWon.bind( { crapsTable: this, number: number } ) :
                             this.darkOddsWon.bind( { crapsTable: this, number: number } );

        var amountData = Util.getCommandRemainder( betData );
        this.handleBet( username, comeOddsBets[ number ], maxBetFunction, checkFunction, payoutFunction, amountData,
                        isScripting );
    },

    handleNumberBet( username, bets, payoutFunction, betData, isScripting )
    {
        var number = this.getBetPoint( username, betData, isScripting );
        if ( Number.isNaN( number )) return;
        payoutFunction = payoutFunction.bind( { crapsTable: this, number: number } );
        var amountData = Util.getCommandRemainder( betData );
        this.handleBet( username, bets[ number ], undefined, undefined, payoutFunction, amountData, isScripting );
    },

    handleHardBet( username, betData, isScripting )
    {
        var number = this.getBetHardPoint( username, betData, isScripting );
        if ( Number.isNaN( number )) return;
        var payoutFunction = this.hardwayWon.bind( { crapsTable: this, number: number } );
        var amountData = Util.getCommandRemainder( betData );
        this.handleBet(
                username, this.hardBets[ number ], undefined, undefined, payoutFunction, amountData, isScripting );
    },

    handleHopBet( username, betData, isScripting )
    {
        betData = Util.collapseSpace( betData );
        var betDataSplits = betData.split( " " );
        if ( betDataSplits.length < 2 )
        {
            this.userMessage( username, isScripting, true, true, "you must specify two die values." );
            return;
        }

        var die1 = this.safeParseInt( betDataSplits[ 0 ] );
        var die2 = this.safeParseInt( betDataSplits[ 1 ] );

        if (( Number.isNaN( die1 )) || ( Number.isNaN( die2 )))
        {
            this.userMessage( username, isScripting, true, true, "unable to parse die values." );
            return;
        }

        if (( die1 < 1 ) || ( die1 > 6 ) || ( die2 < 1 ) || ( die2 > 6 ))
        {
            this.userMessage( username, isScripting, true, true, "die values must be between 1 and 6." );
            return;
        }

        // ensure that we access our hop bet array with the lower die as the first index
        var i = die1 < die2 ? die1 : die2;
        var j = die1 < die2 ? die2 : die1;

        var payoutFunction = this.hopWon.bind( { crapsTable: this, die1: i, die2: j } );
        var prefix = betDataSplits[ 0 ] + " " + betDataSplits[ 1 ];
        var amountData = betData.substring( prefix.length ).trim();
        this.handleBet(
                username, this.hopBets[ i ][ j ], undefined, undefined, payoutFunction, amountData, isScripting );
    },

    handleBet( username, bets, maxBetFunction, checkFunction, payoutFunction, betData, isScripting )
    {
        if ( betData.length == 0 )
        {
            this.userMessage( username, isScripting, true, true, "you must specify an amount." );
            return;
        }

        // get the max payout permitted by the banker
        var maxPayout = this.getMaxPayout();

        // limit payout to available banker balance, if the available banker balance is smaller
        var availableBankerBalance = this.getAvailableBankerBalance();
        if ( availableBankerBalance < maxPayout ) maxPayout = availableBankerBalance;

        // determine the max bet with a payout less than or equal to the max payout
        var payoutFactor = payoutFunction();
        var maxBet = maxPayout / payoutFactor;

        // If the max bet is not a number, we have a problem that will be caught by another check below.
        // In that case: Set max bet to infinity to get past the max bet checks.
        if ( Number.isNaN( maxBet )) maxBet = Infinity;

        // if needed: allow a max bet of at least one whole unit, provided the banker has a large enough balance
        if (( maxBet < 100 ) && ( 100 * payoutFactor <= availableBankerBalance )) maxBet = 100;

        // ensure that the banker can accept this bet for any amount
        if ( maxBet < 100 )
        {
            this.userMessage( username, isScripting, true, false,
                              "banker cannot accept this bet for any amount; banker balance: " +
                              this.formatCurrency( availableBankerBalance ));
            return;
        }

        // limit max bet to your available balance
        var availableBalance = this.getAvailableBalance( username );
        if ( maxBet > availableBalance ) maxBet = availableBalance;

        // limit max bet to the result of the max bet function, if it is defined
        if ( maxBetFunction !== undefined )
        {
            var result = maxBetFunction( username );
            if ( maxBet > result ) maxBet = result;
        }

        // floor the max bet to a whole unit of currency
        maxBet = Math.floor( maxBet / 100 ) * 100;

        var rawAmount = Util.getCommandPrefix( betData );
        var amount = this.safeParseInt( rawAmount ) * 100;
        if ( rawAmount == "max" )
        {
            if ( maxBet < 100 )
            {
                this.userMessage( username, isScripting, true, false,
                                  "your available balance is too low: " + this.formatCurrency( availableBalance ));
                return;
            }

            amount = maxBet;
        }

        if ( Number.isNaN( amount ))
        {
            this.userMessage( username, isScripting, true, true, "unable to parse amount." );
            return;
        }

        if ( amount < 1 )
        {
            this.userMessage( username, isScripting, true, false, "bet is too small." );
            return;
        }

        if ( amount > availableBalance )
        {
            this.userMessage( username, isScripting, true, false,
                              "bet exceeds your available balance: " + this.formatCurrency( availableBalance ) +
                              "; maximum allowed bet: " + this.formatCurrency( maxBet ));
            return;
        }

        if ( bets.has( username ))
        {
            this.userMessage( username, isScripting, true, false, "you've already made this bet." );
            return;
        }

        // call check function, if it is defined
        if (( checkFunction !== undefined ) && ( !checkFunction( username, amount, isScripting ))) return;

        // ensure that the banker has sufficient balance to accomodate the largest possible payout for the bet
        var amountPayout = Math.floor( payoutFactor * amount );
        if ( amountPayout > availableBankerBalance )
        {
            this.userMessage( username, isScripting, true, false,
                              "payout of " + this.formatCurrency( amountPayout ) +
                              " exceeds available banker balance of " + this.formatCurrency( availableBankerBalance ) +
                              "; maximum allowed bet: " + this.formatCurrency( maxBet ));
            return;
        }

        // prevent bets with payouts larger than the max, but allow bets of whole one unit (even if they exceed the max)
        if (( amountPayout > maxPayout ) && ( amount > 100 ))
        {
            this.userMessage( username, isScripting, true, false,
                              "payout of " + this.formatCurrency( amountPayout ) +
                              " exceeds max payout of " + this.formatCurrency( maxPayout ) +
                              "; maximum allowed bet: " + this.formatCurrency( maxBet ));
            return;
        }

        // place the bet
        this.userMessage( username, isScripting, false, false, "bet made: " + this.formatCurrency( amount ));
        bets.set( username, amount );
        this.startRollTimer();
    },

    pointCheck( username, amount, isScripting )
    {
        if ( this.point == 0 )
        {
            this.userMessage( username, isScripting, true, true, "you need a point first." );
            return false;
        }

        return true;
    },

    maxOddsCheck( username, baseAmount, oddsAmount, oddsMultiplier, isScripting )
    {
        var maxBet = baseAmount * config.maxOdds * oddsMultiplier;
        if ( oddsAmount > maxBet )
        {
            this.userMessage( username, isScripting, true, false,
                              "bet exceeds your maximum odds bet: " + this.formatCurrency( maxBet ));
            return false;
        }

        return true;
    },

    passOddsCheck( username, amount, isScripting )
    {
        if ( !this.passBets.has( username ))
        {
            this.userMessage( username, isScripting, true, true, "you need a \"pass\" bet first." );
            return false;
        }

        if ( !this.pointCheck( username, amount, isScripting )) return false;
        if ( !this.maxOddsCheck( username, this.passBets.get( username ), amount, 1, isScripting )) return false;
        return true;
    },

    dpassOddsCheck( username, amount, isScripting )
    {
        if ( !this.dpassBets.has( username ))
        {
            this.userMessage( username, isScripting, true, true, "you need a \"don't pass\" bet first." );
            return false;
        }

        if ( !this.pointCheck( username, amount, isScripting )) return false;

        var baseAmount = this.dpassBets.get( username );
        var oddsMultiplier = this.oddsMultiplier( this.point );
        if ( !this.maxOddsCheck( username, baseAmount, amount, oddsMultiplier, isScripting )) return false;

        return true;
    },

    dpassCheck( username, amount, isScripting )
    {
        if ( this.point != 0 )
        {
            this.userMessage( username, isScripting, true, true, "you cannot bet \"don't pass\" when a point is set." );
            return false;
        }

        return true;
    },

    fireCheck( username, amount, isScripting )
    {
        if ( this.firePointCount() > 0 )
        {
            this.userMessage(
                    username, isScripting, true, true, "you cannot bet \"fire\" once a fire point has been made." );
            return false;
        }

        if ( this.point != 0 )
        {
            this.userMessage( username, isScripting, true, true, "you cannot bet \"fire\" when a point is set." );
            return false;
        }

        return true;
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - comeBets: the come bets array containing the corresponding come bets for the come odds bet
    // - number: the point for the come odds
    // - isLight: true for "come-odds" bets, false for "dcome-odds" bets
    comeOddsCheck( username, amount, isScripting )
    {
        var type = this.isLight ? "come" : "don't come";

        if ( !this.comeBets[ this.number ].has( username ))
        {
            this.crapsTable.userMessage( username, isScripting, true, true,
                                         "you need a \"" + type + "\" bet on this number first." );
            return false;
        }

        var baseAmount = this.comeBets[ this.number ].get( username );
        var oddsMultiplier = this.isLight ? 1 : this.crapsTable.oddsMultiplier( this.number );
        var maxOddsCheck = this.crapsTable.maxOddsCheck.bind( this.crapsTable );
        if ( !maxOddsCheck( username, baseAmount, amount, oddsMultiplier, isScripting ))
        {
            return false;
        }

        return true;
    },

    passOddsMaxBet( username )
    {
        var baseAmount = this.passBets.get( username );
        return baseAmount * config.maxOdds;
    },

    dpassOddsMaxBet( username )
    {
        var baseAmount = this.dpassBets.get( username );
        return baseAmount * config.maxOdds * this.oddsMultiplier( this.point );
    },

    // you must bind an object to this function as follows:
    // - crapsTable: reference to the craps table object
    // - comeBets: the come bets array containing the corresponding come bets for the come odds bet
    // - number: the point for the come odds
    // - isLight: true for "come-odds" bets, false for "dcome-odds" bets
    comeOddsMaxBet( username )
    {
        var baseAmount = this.comeBets[ this.number ].get( username );
        var oddsMultiplier = this.isLight ? 1 : this.crapsTable.oddsMultiplier( this.number );
        return baseAmount * config.maxOdds * oddsMultiplier;
    }
};
