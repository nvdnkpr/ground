"use_strict";

/*global _:true*/

var Gnd = require('../index');

var express = require('express'),
    mongoose = require('mongoose'),
    app = express.createServer(),
    appSessions = express.createServer(),
    sio = require('socket.io').listen(app),
    sioSessions = require('socket.io').listen(appSessions),
    models = require('./fixtures/mongo_models'),
    redis = require('redis'),
    cabinet = require('cabinet'),
    passport = require('passport'),
    cookie = require('cookie'),
    staticDir = __dirname + '/../',
    oneMinute = 60*1000,
    uuid = require('node-uuid'),
    Cookies = require('cookies'),
    acl = require('acl'),
    requirejs = require('requirejs'),
    posix = require('posix');

// Increase limits to avoid problems with cabinet. 
var limits = posix.setrlimit('nofile', {soft: 8000, hard: 8000});
limits = posix.getrlimit('nofile');

var models = requirejs('fixtures/models');

app.use(passport.initialize());

app.use(cabinet(staticDir+'node_modules/mocha', {
  ignore: ['.git', 'node_modules', '*~', 'examples']
}));

app.use(cabinet(staticDir+'node_modules/expect.js', {
  ignore: ['.git', 'node_modules', '*~', 'examples']
}));

app.use(cabinet(staticDir+'third', {
  ignore: ['.git', 'node_modules', '*~', 'examples']
}));

app.use(cabinet(staticDir,
  {
    ignore: ['.git', 'node_modules', '*~', 'examples', '*.js'],
    typescript: {
      tmpPath: '/var/tmp',
      out: true,
    }
  },
  function(url){
    if(url.indexOf('.ts') !== -1){
      sio.sockets.emit('file_changed:', url);
    }
  }
));

app.use(cabinet(__dirname, {ignore:['.git', '*~']}, function(url){
  sio.sockets.emit('file_changed:', url);
}));

app.use(express.bodyParser());

var mongooseStorage = new Gnd.Storage.MongooseStorage(models, mongoose);
var TEST_COOKIE = 'testCookie';

var pubClient = redis.createClient(6379, "127.0.0.1"),
    subClient = redis.createClient(6379, "127.0.0.1");

var syncHub = new Gnd.Sync.Hub(pubClient, subClient, sio.sockets);

var gndServer = new Gnd.Server(mongooseStorage, 
                               new Gnd.SessionManager(), 
                               syncHub);
                               
var socketServer = new Gnd.SocketBackend(sio.sockets, gndServer);

//
// Ajax APIs used for some unit tests
//
app.put('/animals/:id', function(req, res){
  console.log("Updating animals:");
  mongooseStorage.models.animals.update({_id:req.params.id}, req.body, function(err){
    if (err) throw new Error('Error updating animal:'+req.params.id+' '+err);
    res.send(204);
  });
});

app.put('/zoos/:zooId/animals/:id', function(req, res){
  res.send(204);
});

app.del('/zoos/:zooId/animals/:id', function(req, res){
  mongooseStorage.models.zoo.findById(req.params.zooId, function(err, zoo){
    if (err) {
      throw new Error('Error remove animal:'+req.params.id+' from Zoo:'+req.params.zooId+' '+err);
    } else {
      var index = zoo.animals.indexOf(req.params.id);
      zoo.animals.splice(index, 1);
      zoo.save(function(err){
        res.send(204);
      });
    }
  });
});

app.put('/parade/:seqId/seq/animals/:id', function(req, res){
  console.log('pushing '+req.params.id+' to '+req.params.seqId);
  gndServer.storage.insertBefore(['parade', req.params.seqId, 'animals'], 
                                 null, 
                                 ['animals', req.params.id], {}).then(function(){
    res.send(204);
  }).fail(function(err){
    return Error('Error in test service')
  });
});

app.del('/parade/:seqId/seq/animals/:id', function(req, res){
  console.log('deleting '+req.params.id+' from '+req.params.seqId);
  gndServer.storage.deleteItem(['parade', req.params.seqId, 'animals'],
                               req.params.id, {}).then(function(){
    res.send(204);
  }).fail(function(err){
     return Error('Error in test service');
  });
});

// Server for sessions
var sessionManager = new Gnd.SessionManager(TEST_COOKIE, cookie.parse);

rules = {
  create: {
    
  },
  
  put: {
  
  },
  
  del: {
  
  },
  
  add: {
  
  },
  
  remove: {
  
  },
}

var rightsManager = new Gnd.RightsManager(acl, rules);

var gndSessionServer = new Gnd.Server(mongooseStorage, sessionManager, syncHub);

var socketServerSessions = new Gnd.SocketBackend(sioSessions.sockets, gndSessionServer);

//
// Passport based Login
//
var LocalStrategy = require('passport-local').Strategy;

passport.use(new LocalStrategy(
  function(username, password, done) {
    if (username == 'tester' && password == 'passwd'){
      done(null, {username: username, userId: '1234'});
    }else{
      done(null, false);
    }
  }
));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(id, done) {
  done(null, id);
});

app.post('/sessions', passport.authenticate('local'), function(req, res) {
  cookies = new Cookies(req, res);
  var sessionId = uuid.v1()
  cookies.set(TEST_COOKIE, sessionId);
  
  sessionManager.setSession(sessionId, req.user, function(err){
    if(!err){
      res.send(req.user);
    }else{
      res.send(500);
    }
  });
});

app.get('/sessions',  function(req, res) {  
  sessionManager.getSession(req.headers.cookie, function(err, session){
    console.log(err);
    if(!err){
      res.send({username: session.username}, 200);
    }else{
      res.send(err, 400);
    }
  })
});

app.del('/sessions',  function(req, res) {
  sessionManager.removeSession(req.headers.cookie, function(err){
    if(!err){
      res.send(200);
    }else{
      res.send(err, 400);
    }
  });
});


//
// Mongoose test database
//
var mongooseDB = 'mongodb://localhost/GndTestDB';

mongoose.connect(mongooseDB, function(){
  mongoose.connection.db.executeDbCommand( {dropDatabase:1}, function(err, result) {
    console.log(result);
    mongoose.disconnect(function(){
      mongoose.connect(mongooseDB);

      app.listen(10000);
      appSessions.listen(9999);
      console.log("Started test server at port: %d in %s mode", app.address().port, app.settings.env);
    });
  });
});


