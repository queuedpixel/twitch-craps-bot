# Player Guide

The Twitch Craps Bot allows you to play craps in Twitch chat.

[Craps Basics](https://wizardofodds.com/games/craps/basics/)

## Play Overview

Commands to the Twitch Craps Bot start with `!craps`.
Example: `!craps help`

Players place bets using the `!craps bet` command.
Example: `!craps bet pass 1`

The Twitch Craps Bot will automatically roll the dice a short while after the last bet is placed.
The bot will continue to roll the dice as long as there are bets remaining.

## Command Guide

* `!craps help` - Show a link to this guide.
* `!craps balance` - Show your current balance.
* `!craps bets` - Show your current bets.
* `!craps bet [type] [amount]` - Place a bet of the specified type with the specified amount.

## Bet Guide

Bets that don't apply to a specific point (such as the `pass` bet) use this format:

`!craps bet [type] [amount]`

Bets that apply to a specific number (such as the `place` bet) use this format:

`!craps bet [type] [number] [amount]`

* `pass` - Pass
* `pass-odds` - Pass Odds
* `dpass` - Don't Pass
* `dpass-odds` - Don't Pass Odds
* `come` - Come
* `come-odds [number]` - Come Odds on the Specified Number
* `dcome-odds [number]` - Don't Come Odds on the Specified Number
* `place [number]` - Place on the Specified Number
