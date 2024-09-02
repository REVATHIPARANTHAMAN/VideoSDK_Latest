const winston = require('winston');
require('winston-daily-rotate-file');

const infoTransport = new winston.transports.DailyRotateFile({
    level: 'info',
    filename: 'infolog-%DATE%.log',
    datePattern: 'YYYY-MM-DD-HH',
    zippedArchive: true,
    maxSize: '1k',
    frequency: "1m",
    dirname: "serverlogs"
});

const errorTransport = new winston.transports.DailyRotateFile({
    level: 'error',
    filename: 'errorlog-%DATE%.log',
    datePattern: 'YYYY-MM-DD-HH',
    zippedArchive: true,
    maxSize: '1k',
    maxFiles: '1m',
    dirname: "serverlogs"
  });

module.exports =  getLogger = () => {
    try {
        return winston.createLogger({
            transports: [
                infoTransport,
                errorTransport
            ]
        })
    } catch (e) {
        console.log("Exception while creating logger" + e);
    }
}