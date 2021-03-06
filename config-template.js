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

// Use this template to create a filed called "config.js" with your desired configuration.

module.exports =
{
    channel                : "channel-name", // name of the channel to connect to, without the the "#" character
    owner                  : "bot-owner",    // name of the bot owner
    messageInterval        : 2000,           // interval between sending messages; milliseconds
    rollingDelay           : 60,             // delay for rolling after the last bet is placed; seconds
    minimumBalance         : 10000,          // minimum balance for players
    balanceCheckInterval   : 60,             // interval for adjusting player balances below minimum balance; seconds
    balanceCheckAdjustment : 1,              // adjustment amount for player balances below minimum balance
    maxOdds                : 100,            // maximum odds that can be placed; multiple of (don't) pass/come bets
    maxBetPayout           : 0.01,           // maximum bet payout as a percentage of banker balance; between 0 and 1
    helpCooldown           : 60,             // global cooldown on the "help" command; seconds
    debug                  : false           // whether or not to enable debugging features
};
