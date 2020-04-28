const ipc = require('node-ipc');

ipc.config.id = 'world';
ipc.config.retry = 1500;
ipc.config.silent = true;

ipc.serve(
  function(){
    ipc.server.on('message', function(data, socket) {
        console.log('got a message : ', data);
        ipc.server.emit(
          socket,
          'message',
          data+' world!'
        );
      }
    );
    ipc.server.on(
      'socket.disconnected',
      function(socket, destroyedSocketID) {
        console.log('client ' + destroyedSocketID + ' has disconnected!');
      }
    );
  }
);

ipc.server.start();
