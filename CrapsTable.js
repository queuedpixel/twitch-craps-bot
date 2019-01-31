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
    point: 0,

    // override this function to listen to craps table messages
    onMessage( message ) {},

    // helper function for getting a random die roll
    dieRoll()
    {
        return Math.floor( Math.random() * 6 ) + 1;
    },

    formatCurrency( amount )
    {
        return "§" + ( amount / 100 ).toLocaleString( "en-US", { minimumFractionDigits: 2 } );
    },

    // process chat commands
    processCommand( username, command )
    {
        if (( command == "roll" ) && ( username.toLowerCase() == config.owner.toLowerCase() )) this.roll();
        if ( command == "balance" ) this.showBalance( username );
    },

    // roll the dice and update the craps table status based on the roll
    roll()
    {
        // roll the dice
        var die1 = this.dieRoll();
        var die2 = this.dieRoll();
        var dieTotal = die1 + die2;
        this.onMessage( "Roll: " + die1 + ", " + die2 + " - (" + dieTotal + ")" );

        // if we have no point currently ...
        if ( this.point == 0 )
        {
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
        }

        // check to see if we sevened out
        else if ( dieTotal == 7 )
        {
            this.point = 0;
            this.onMessage( "Seven out." );
        }
    },

    showBalance( username )
    {
        if ( !this.playerBalances.has( username ))
        {
            // set the starting balance for players
            // balances are stored in hundredths of one unit of currency; multiply the configured value by 100
            this.playerBalances.set( username, config.startingBalance * 100 );
        }

        this.onMessage( username + " Balance: " + this.formatCurrency( this.playerBalances.get( username )));
    }
};
