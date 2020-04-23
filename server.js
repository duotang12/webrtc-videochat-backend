const express = require('express');
const http = require('http');
const main = express();
const server = http.createServer(main);
const io = require('socket.io').listen(server);

const PORT = 8080;

server.listen(PORT, null, () => {
    console.log('Listening on port ' + PORT);
});

const channels = {};
const sockets = {};

io.sockets.on('connection', (socket) => {
    socket.channels = {};
    sockets[socket.id] = socket;

    console.log('[' + socket.id + '] connected');

    socket.on('disconnect', () => {
        for (const channel in socket.channels) {
            quitChannel(channel);
        }
        console.log('[' + socket.id + '] disconnected');
        delete sockets[socket.id];
    });


    socket.on('join', (config) => {
        console.log('[' + socket.id + '] join ', config);

        const channel = config.channel;

        if (channel in socket.channels) {
            console.log('[' + socket.id + '] ERROR: already joined ', channel);
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
        console.log('[' + socket.id + '] quit channel ');

        if (!(channel in socket.channels)) {
            console.log('[' + socket.id + '] ERROR: not in ', channel);
            return;
        }

        delete socket.channels[channel];
        delete channels[channel][socket.id];

        for (const id in channels[channel]) {
            channels[channel][id].emit('removePeer', {'peerId': socket.id});
            socket.emit('removePeer', {'peerId': id});
        }
    }

    socket.on('quitChannel', quitChannel);

    socket.on('relayICECandidate', (config) => {
        const peerId = config.peerId;
        const ice_candidate = config.ice_candidate;
        console.log('[' + socket.id + '] relaying ICE candidate to [' + peerId + '] ', ice_candidate);

        if (peerId in sockets) {
            sockets[peerId].emit('iceCandidate', {
                'peerId': socket.id,
                'ice_candidate': ice_candidate
            });
        }
    });

    socket.on('relaySessionDescription', (config) => {
        const peerId = config.peerId;
        const sessionDescription = config.sessionDescription;
        console.log('[' + socket.id + '] relaying session description to [' + peerId + '] ', sessionDescription);

        if (peerId in sockets) {
            sockets[peerId].emit('sessionDescription', {
                'peerId': socket.id,
                'sessionDescription': sessionDescription
            });
        }
    });
});
