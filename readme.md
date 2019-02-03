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
* `startingBalance` : starting balance for players

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

## Contributing

Instructions for those wishing to contribute to this project are available in our
[contributing documentation](contributing.md).
