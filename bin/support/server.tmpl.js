"use strict";

var Gnd = require('gnd')
  , config = require('./config')
  , cabinet = require('cabinet') 
  , http = require('http')
  , app = require('connect').createServer()
  , server = http.createServer(app)
  , sio = require('socket.io').listen(server)
  , redis = require('redis')
  , mongoose = require('mongoose')
  , staticDir = __dirname
  , path = require('path')
  , requirejs = require('requirejs');
  
switch(config.MODE){
  case 'development': 
    app.use(cabinet(path.join(__dirname, 'app'), {
      ignore: ['.git', 'node_modules', '*~'],
      files: {
        '/gnd.js': Gnd.debug,
        '/lib/curl.js': Gnd.third.curl,
        '/lib/underscore.js': Gnd.third.underscore
      }
    }));
    break;
  case 'production':
    app.use(cabinet(path.join(__dirname, 'build')));
    break;
  default:
    console.log("No valid MODE configured:", config.MODE);
    process.exit(-1);
}
  
server.listen(config.APP_PORT);
console.log("Started server at port: %d in %s mode", server.address().port, config.MODE);


mongoose.connect(config.MONGODB_URI);

requirejs.config({
    baseUrl: __dirname,
    nodeRequire: require
});

var models = requirejs('app/models/models');

var mongooseStorage = new Gnd.Storage.MongooseStorage(models, mongoose)
  , pubClient = redis.createClient(config.REDIS_PORT, config.REDIS_ADDR)
  , subClient = redis.createClient(config.REDIS_PORT, config.REDIS_ADDR)
  , syncHub = new Gnd.Sync.Hub(pubClient, subClient, sio.sockets)
  , sessionManager =  new Gnd.SessionManager()
  , gndServer = new Gnd.Server(mongooseStorage, sessionManager, syncHub);
                               
var socketServer = new Gnd.SocketBackend(sio.sockets, gndServer);

if (config.MODE === 'development' && !process.env.TEST){
  var open = require('open');
  open('http://localhost:' + server.address().port);
}

module.exports = server.address().port;
