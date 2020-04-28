const express = require('express');
const app = express();
const http = require('http').Server(app);
const ipc = require('node-ipc');
const helper = require('./utils/helper');
const cluster = require('cluster');

const port = process.env.PORT || 80;

const startListener = function() {
  // const numCPUs = require('os').cpus().length;
  const numCPUs = 3;

  if(cluster.isMaster) {
    for(let i=0; i < numCPUs; i++){
      const worker = cluster.fork();

      worker.send('hi worker');  // send msg to worker
      worker.on('message', (msg)=>{ // receive msg from worker
        console.log('[master] get msg from worker: '  + msg);
      });
      worker.on('exit', (code, signal) => {
        if (signal) {
          console.log(`worker was killed by signal: ${signal}`);
        } else if (code !== 0) {
          console.log(`worker exited with error code: ${code}`);
        } else {
          console.log('worker success!');
        }
      })
    }

    cluster.on("listening", function(worker, address){
      console.log("[master] " + "listening: worker " + worker.id + ", pid:"+worker.process.pid + ",Address:" + address.address + ":" + address.port);
    });

    cluster.on("exit", function(worker, code, signal){
      console.log('worker ' + worker.process.pid + ' died');
      cluster.fork();
    });

    cluster.on('death', function(worker) {
      console.log('worker ' + worker.pid + ' died. restart...');
      cluster.fork();
    });

    ipc.config.id = 'master';
    ipc.config.retry = 1500;
    ipc.config.silent = true;

    ipc.serve(() => {
      ipc.server.on('reload_message', async pid => {
        console.log('准备重启: ', pid);
        const workers = cluster.workers;
        for(let id in workers) {
            const worker = workers[id];
            if(worker.process.pid === +pid) {
                worker.kill(); // cfork出来的app-worker，会在终止后，重新fork
                // process.kill(pid, 'SIGTERM')
                // process.env.EGG_SERVER_ENV === 'prod' || cluster.fork();
            }
        }
      })
    })
    ipc.server.start();
    process.on('exit', () => {
        ipc.server.stop();
    });
  } else {
    process.on('message', (msg)=>{ // receive msg from master
      console.log('[worker' + cluster.worker.id + '] get msg from master:' + msg);
    });
    if (cluster.worker.id === 4) {
      // https.createServer(options, app).listen(sslPort);
    } else {
      http.listen(port);
    }
  }
};

app.get('/cluster/reload', async function (req, res) {
  const serverName = 'master';
  const processList = await helper.findNodeProcess(item => {
    const cmd = item.cmd;
    return cmd.includes('node.exe') && cmd.includes('app')
  })
  // console.log(processList, 'processList')
  let pidArr = processList.map(x => x.pid);
  // console.log(pidArr, 'pidArr')
  if (pidArr.length > 0) {
    ipc.connectTo(serverName, async () => {
      ipc.of[serverName].on('connect', async function () {
        for (const pid of pidArr) {
          console.log(`reloading app-worker: ${pid}`);
          await new Promise(async resolve => {
            ipc.of[serverName].emit('reload_message', pid);
            await helper.sleep(5000);
            // 为了防止 worker kill过快导致进程完全无法访问，每个进程间隔延迟5s
            resolve();
          })
        }
        console.log('success restarted`')
        process.exit(0);
      })
    })
  }
  res.status(200).send(`<div>正在重启，大约半分钟~</div>`)
})

/**
 * 路由错误处理
 */
app.use(function (err, req, res, next) {
    if (err.message && (~err.message.indexOf('not found') || (~err.message.indexOf('Cast to ObjectId failed')))) {
        return next()
    }

    console.error(err.stack, '500');
    res.status(500).render('500')
});

startListener();
