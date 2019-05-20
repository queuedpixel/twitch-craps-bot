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

Players serve as the banker for the craps table.
Bets that are won are paid out by the banker and bets that are lost are paid to the banker.
Players can serve as the banker using the `!craps banker` command.

## Command Guide

* `!craps help` - Show a link to this guide.
* `!craps balance` - Show your current balance.
* `!craps banker` - Serve as the banker.
* `!craps bets` - Show your current bets.
* `!craps bet [type] [amount]` - Place a bet of the specified type with the specified amount.

## Bet Guide

Bets that don't apply to a specific number (such as the `pass` bet) use this format:

`!craps bet [type] [amount]`

Bets that apply to a specific number (such as the `place` bet) use this format:

`!craps bet [type] [number] [amount]`

Bets that apply to a specific die roll (such as the `hop` bet) use this format:

`!craps bet [type] [die1] [die2] [amount]`

Default maximum odds is 100x.

### Available Bets

* `pass` - Pass
* `pass-odds` - Pass Odds
* `dpass` - Don't Pass
* `dpass-odds` - Don't Pass Odds
* `field` - Field; 2 pays 2 to 1, 12 pays 3 to 1
* `any-craps` - Any Craps; pays 7.5 to 1
* `any-seven` - Any Seven; pays 4 to 1
* `fire` - Fire; 4 fire points pays 24 to 1, 5 fire points pays 249 to 1, 6 fire points pays 999 to 1
* `come` - Come
* `come-odds [number]` - Come Odds on the Specified Number
* `dcome` - Don't Come
* `dcome-odds [number]` - Don't Come Odds on the Specified Number
* `place [number]` - Place on the Specified Number
* `dplace [number]` - Place to Lose on the Specified Number
* `buy [number]` - Buy on the Specified Number; commission is charged when bet is won
* `lay [number]` - Lay on the Specified Number; commission is charged when bet is won
* `hard [number]` - Hard Way on the Specified Number
* `hop [die1] [die2]` - Hop Bet on the Specified Die Roll
