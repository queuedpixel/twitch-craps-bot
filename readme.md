# Twitch Craps Bot

Twitch Craps Table Chat Bot

## Setup

### Authentication

Create a file in your home directory called `.TwitchAuth` with the following contents:

```
username = [Twitch Username]
auth = [Twitch Auth Token]
```

Replace `[Twitch Username]` with the Twitch username for your chat bot.

Replace `[Twitch Auth Token]` with an auth token obtained from: <http://twitchapps.com/tmi/>

### Configuration

Make a copy of `channel-template.js`, rename it to `channel.js`,
and enter the name of the channel to which you want to connect.

## Usage

### Node.js

Install Node.js from: <https://nodejs.org/>

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
