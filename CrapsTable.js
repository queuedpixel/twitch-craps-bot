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

var config = require( "./config.js" );

module.exports =
{
    playerBalances: new Map(),
    passBets: new Map(),
    point: 0,

    // override this function to listen to craps table messages
    onMessage( message ) {},

    userMessage( username, message )
    {
        this.onMessage( "@" + username + ", " + message );
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
            this.playerBalances.set( username, config.startingBalance * 100 );
        }

        return this.playerBalances.get( username );
    },

    betWon( bet )
    {
        return bet;
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

            if ( result > 0 ) this.userMessage( username, "won " + this.formatCurrency( result ));
            else this.userMessage( username, "lost " + this.formatCurrency( -result ));
        }

        bets.clear();
    },

    // perform a random die roll
    processRandomRoll()
    {
        // randomly determine the die roll
        var die1 = this.dieRoll();
        var die2 = this.dieRoll();
        this.processRoll( die1, die2 );
    },

    // update the craps table based on the results of the specifed roll
    processRoll( die1, die2 )
    {
        // print out the roll
        var dieTotal = die1 + die2;
        this.onMessage( "Roll: " + die1 + ", " + die2 + " - (" + dieTotal + ")" );

        // if we have no point currently ...
        if ( this.point == 0 )
        {
            // check to see if we have a winner
            if (( dieTotal == 7  ) ||
                ( dieTotal == 11 ))
            {
                this.processBets( this.passBets, this.betWon );
            }

            // check to see if we have a loser
            if (( dieTotal == 2  ) ||
                ( dieTotal == 3  ) ||
                ( dieTotal == 12 ))
            {
                this.processBets( this.passBets, this.betLost );
            }

            // check to see if we've established a point
            if (( dieTotal == 4  ) ||
                ( dieTotal == 5  ) ||
                ( dieTotal == 6  ) ||
                ( dieTotal == 8  ) ||
                ( dieTotal == 9  ) ||
                ( dieTotal == 10 ))
            {
                this.point = dieTotal;
                this.onMessage( "New point established: " + this.point );
            }
        }

        // check to see if the point was made
        else if ( this.point == dieTotal )
        {
            this.point = 0;
            this.onMessage( "The point was made." );
            this.processBets( this.passBets, this.betWon );
        }

        // check to see if we sevened out
        else if ( dieTotal == 7 )
        {
            this.point = 0;
            this.onMessage( "Seven out." );
            this.processBets( this.passBets, this.betLost );
        }
    },

    // process chat commands
    processCommand( username, message )
    {
        if ( !message.startsWith( "!craps " ))
        {
            this.userMessage( username, "you must specify a command." );
            return;
        }

        var command = message.substr( 6 ).trim();

        if (( command.startsWith( "roll" )) &&
            ( username.toLowerCase() == config.owner.toLowerCase() ) &&
            ( config.debug ))
        {
            this.rollCommand( username, command );
        }
        else if ( command == "balance" ) this.balanceCommand( username );
        else if ( command.startsWith( "bet" )) this.betCommand( username, command );
        else this.userMessage( username, "uncrecognized command." );
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
            this.userMessage( username, "unable to parse values." );
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
        this.userMessage( username, "balance: " + this.formatCurrency( this.getBalance( username )));
    },

    betCommand( username, command )
    {
        if ( !command.startsWith( "bet " ))
        {
            this.userMessage( username, "you must specify which bet you wish to make." );
            return;
        }

        var bet = command.substr( 3 ).trim();

        if ( bet.startsWith( "pass" ))
        {
            if ( !bet.startsWith( "pass " ))
            {
                this.userMessage( username, "you must specify an amount." );
                return;
            }

            var amount = parseInt( bet.substr( 4 ).trim() ) * 100;

            if ( Number.isNaN( amount ))
            {
                this.userMessage( username, "unable to parse bet." );
                return;
            }

            if ( amount < 1 )
            {
                this.userMessage( username, "bet is too small." );
                return;
            }

            if ( amount > this.getBalance( username ))
            {
                this.userMessage(
                        username, "bet exceeds your balance of " + this.formatCurrency( this.getBalance( username )));
                return;
            }

            if ( this.passBets.has( username ))
            {
                this.userMessage( username, "you've already made this bet." );
                return;
            }

            this.userMessage( username, "bet made." );
            this.passBets.set( username, amount );
        }
        else
        {
            this.userMessage( username, "unrecognized bet." );
        }
    }
};
