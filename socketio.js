// socketio.js
const socketIo = require('socket.io');

let io;

module.exports = {
  init: (httpServer) => {
    io = socketIo(httpServer);
    return io;
  },
  getIo: () => {
    if (!io) {
      throw new Error('Socket.io não inicializado!');
    }
    return io;
  }
};