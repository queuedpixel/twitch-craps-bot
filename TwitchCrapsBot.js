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

var fs     = require( "fs"        );
var os     = require( "os"        );
var twitch = require( "twitch-js" );

var config = require( "./config.js" );
var channel = "#" + config.channel;

var crapsTable = require( "./CrapsTable.js" );
var Util       = require( "./Util.js"       );

function logMessage( username, message )
{
    console.log( "<" + username + ">: " + message );
}

crapsTable.onMessage = function( message ) { messageQueue.push( message ); };

var messageQueue = [];

function processMessageQueue()
{
    if ( messageQueue.length == 0 )
    {
        crapsTable.messageQueueEmpty();
        return;
    }

    var message = messageQueue.shift();
    client.say( channel, message );
    logMessage( twitchAuth.username.toLowerCase(), message );
}

function getTwitchAuth()
{
    var result = {};
    var contents = fs.readFileSync( process.env.HOME + "/.TwitchAuth", "utf8" );
    var lines = contents.split( os.EOL );
    for ( line of lines )
    {
        var nameValuePair = line.split( "=" );

        if ( nameValuePair.length == 2 )
        {
            var name  = nameValuePair[ 0 ].trim();
            var value = nameValuePair[ 1 ].trim();

            if ( name == "username" ) result.username = value;
            if ( name == "auth"     ) result.auth     = value;
        }
    }

    return result;
}

var twitchAuth = getTwitchAuth();

var options =
{
    options:
    {
        debug: false
    },
    connection:
    {
        secure: true
    },
    identity:
    {
        username: twitchAuth.username,
        password: twitchAuth.auth,
    },
    channels: [ channel ]
};

var client = new twitch.client( options );

client.on( "chat", function( chatChannel, userstate, message, self )
{
    // skip if message is for another chat channel
    if ( chatChannel != channel ) return;

    // skip if the message is from us
    if ( userstate.username.toLowerCase() == twitchAuth.username.toLowerCase() ) return;

    // log all chat messages
    logMessage( userstate.username, message );

    // pass the message along to the craps table class if it contains the "!craps" prefix
    var commandName = Util.getCommandPrefix( message );
    var commandData = Util.getCommandRemainder( message );
    if ( commandName == "!craps" ) crapsTable.processCommand( userstate.username, commandData );
} );

client.connect();
setInterval( processMessageQueue, config.messageInterval );
crapsTable.init( twitchAuth.username.toLowerCase() );
