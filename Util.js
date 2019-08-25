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

module.exports =
{
    debugLog: fs.createWriteStream( "debug.log", { flags: "a" } ),
    n2: new Intl.NumberFormat( "en-US", { style: "decimal", useGrouping: false, minimumIntegerDigits: 2 } ),
    n4: new Intl.NumberFormat( "en-US", { style: "decimal", useGrouping: false, minimumIntegerDigits: 4 } ),

    log( message, toConsole )
    {
        var date = new Date();
        var timestamp = this.n4.format( date.getFullYear()  ) + "-" +
                        this.n2.format( date.getMonth() + 1 ) + "-" +
                        this.n2.format( date.getDate()      ) + " " +
                        this.n2.format( date.getHours()     ) + ":" +
                        this.n2.format( date.getMinutes()   ) + ":" +
                        this.n2.format( date.getSeconds()   );
        this.debugLog.write( timestamp + " - " + message + "\n" );
        if ( toConsole ) console.log( message );
    },

    // remove leading space, remove trailing space, and replace multiple spaces with a single space
    collapseSpace( value )
    {
        var splits = value.split( " " );
        var result = "";

        splits.forEach( function( item )
        {
            // add space between each item, but prevent leading space and add only one space between items
            if (( item.length > 0 ) && ( result.length > 0 )) result += " ";

            result += item;
        } );

        return result;
    },

    // get the first element of a space-delimitted string and lower case it
    getCommandPrefix( command )
    {
        return this.collapseSpace( command ).split( " " )[ 0 ].toLowerCase();
    },

    // get everything after the first element of a space-delimitted string
    getCommandRemainder( command )
    {
        return this.collapseSpace( command ).substring( this.getCommandPrefix( command ).length ).trim();
    }
};
