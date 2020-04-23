const express = require('express');
const http = require('http');
const cors = require('cors');

const main = express();
main.use(cors());
main.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,content-type,application/json');
    next();
});

const server = http.createServer(main);
const io = require('socket.io').listen(server);

const PORT = process.env.PORT || 80;

server.listen(PORT);

const channels = {};
const sockets = {};

io.sockets.on('connection', (socket) => {
    console.log('connected', socket.id);

    socket.channels = {};
    sockets[socket.id] = socket;

    socket.on('disconnect', () => {
        console.log('disconnect', socket.id);
        for (const channel in socket.channels) {
            quitChannel(channel);
        }
        delete sockets[socket.id];
    });


    socket.on('join', (config) => {
        console.log(socket.id, ' joins ', config.channel);

        const channel = config.channel;

        if (channel in socket.channels) {
            return;
        }

        if (!(channel in channels)) {
            channels[channel] = {};
        }

        for (const id in channels[channel]) {
            channels[channel][id].emit('addPeer', {
                'peerId': socket.id,
                'should_create_offer': false
            });

            socket.emit('addPeer', {
                'peerId': id,
                'should_create_offer': true
            });
        }

        channels[channel][socket.id] = socket;
        socket.channels[channel] = channel;
    });

    function quitChannel(channel) {
        if (!(channel in socket.channels)) {
            return;
        }

        delete socket.channels[channel];
        delete channels[channel][socket.id];

        for (const id in channels[channel]) {
            channels[channel][id].emit('removePeer', {'peerId': socket.id});
            socket.emit('removePeer', {'peerId': id});
        }
    }

    socket.on('relayCandidate', (config) => {
        const peerId = config.peerId;
        const iceCandidate = config.iceCandidate;

        console.log(socket.id, ' relayed to ', peerId);

        if (peerId in sockets) {
            sockets[peerId].emit('iceCandidate', {
                'peerId': socket.id,
                'iceCandidate': iceCandidate
            });
        }
    });

    socket.on('relaySessionDescription', (config) => {
        const peerId = config.peerId;
        const sessionDescription = config.sessionDescription;

        console.log(socket.id, ' relaying session to ', peerId);

        if (peerId in sockets) {
            sockets[peerId].emit('sessionDescription', {
                'peerId': socket.id,
                'sessionDescription': sessionDescription
            });
        }
    });
});
