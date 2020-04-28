const ipc = require('node-ipc');

ipc.config.id = 'hello';
ipc.config.retry = 1500;
ipc.config.silent = true;
// ipc.config.logger=console.log.bind(console);

const server = 'world';

ipc.connectTo(
  server,
  function(){
    //
    ipc.of[server].on('connect', function(){
      console.log('connect', ipc.config.delay);
      ipc.of[server].emit(
        'message',
        'hello'
      )
    });

    ipc.of[server].on('disconnect', function(){
      console.log('disconnected from world');
    });

    ipc.of[server].on('message', function(data){
      console.log('got a message from world : ', data);
    });
  }
);
