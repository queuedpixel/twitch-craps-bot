# Twitch Craps Bot

Twitch Craps Table Chat Bot

## Setup

### Authentication

Create a file in your home directory called `.TwitchAuth` with the following contents:

```
username = [username]
auth = [auth]
```

Replace `[username]` with the username for your chat bot.

Replace `[auth]` with an OAuth token obtained from: <http://twitchapps.com/tmi/>

### Configuration

Make a copy of `config-template.js` called `config.js` and specify your configuration settings:

* `channel` : name of the channel to connect to
* `owner` : name of the bot owner
* `messageInterval` : interval between sending messages; milliseconds
* `rollingDelay` : delay for rolling after the last bet is placed; seconds
* `startingBalance` : starting balance for players
* `debug` : whether or not to enable debugging features

## Usage

### Node.js

Download Node.js from <https://nodejs.org/> and install it.

### Dependencies

Install dependencies using npm:

```Shell
npm install
```

### Run

Run the bot using Node.js:

```Shell
node TwitchCrapsBot.js
```

### Debugging Tools

If the `debug` configuration is set to `true`, the following debug tools are available:

#### Die Rolls

You can manually roll the dice using the `!craps roll` command.
If you wish, you can specify the die values.

Example: `!craps roll 3 4`

## Contributing

Instructions for those wishing to contribute to this project are available in our
[contributing documentation](contributing.md).
