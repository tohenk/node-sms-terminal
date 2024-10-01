# Node SMS Terminal

## Introduction

Node SMS Terminal is designed to handle GSM communication such as sending or
receiving short message (SMS), querying USSD data from network provider. It
utilizes modem dongle usually used to connect to data network from provider,
so it doesn't need special or expensive hardware.

Node SMS Terminal doesn't provide direct method to handle its functionality,
but it uses socket communication to provide those functionality to other party.

Currently, there is [Node SMS Gateway](https://github.com/tohenk/node-sms-gateway)
other party implementation for this terminal.

## Installation

Stand alone installation is available using GIT.

```
$ cd ~
$ git clone https://github.com/tohenk/node-sms-terminal.git
$ cd node-sms-terminal
$ npm install
```

A web interface installation is needed as its now a separate package.

```
$ npm install @ntlab/sms-terminal-ui
```

To run application (On some Linux distribution replace `node` with `nodejs`)

```
$ node app.js --auto
```

## Configuration

Node SMS Terminal uses JSON configuration named `config.json` in the working
directory, but it can be told to use configuration elsewhere.

### `database`

Set [Sequelize](http://docs.sequelizejs.com/) database connection parameter.

```json
{
    "database": {
        "dialect": "mysql",
        "host": "localhost",
        "port": 3306,
        "user": "username",
        "password": "password",
        "database": "smsgw",
        "timezone": "Asia/Jakarta"
    }
}
```

### `secret`

Set socket connection secret. Each socket client must send `auth` with secret
and will be checked against this value. If it matches, connection accepted,
otherwise connection will be closed.

```json
{
    "secret": "CHANGEME"
}
```

### `security`

Set web interface username and password. Default username and password is both
`admin`. To secure your instance, it is advised to change default password.

```json
{
    "security": {
        "username": "admin",
        "password": "admin"
    }
}
```

## Command line options

```
$ node app.js --help
Usage:
  node app.js [options]

Options:
--config=config-file  Read app configuration from file
--driver=driver-file  Read driver from file
--port=port, -p=port  Set web server port to listen
--logdir=directory    Set the log file location
--auto, -a            Automatically open all available ports
--read-new-message    Once the terminal opened, try to read new messages
--log-ussd, -u        Add ussd command to activity
```

## Web interface

Node SMS Terminal web interface can be accessed via port `8000` (default) or as
specified by the command line options above.

## Todo

- Text SMS mode currently not supported
- STK functionality still missing
- Socket and web interface currently doesn't support https