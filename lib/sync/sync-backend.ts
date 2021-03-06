/**
  Ground Web Framework (c) 2011-2012 Optimal Bits Sweden AB
  MIT Licensed.
*/
/// <reference path="../log.ts" />
/// <reference path="../../third/underscore.d.ts" />

/**
  @module Gnd
  @submodule Sync
*/
module Gnd.Sync {
  
/**
  This class is run server side to provide automatic synchronization between
  models, sequences and collections.
  
  Uses Redis PubSub in order to provide scalability. Any number of socket.io 
  servers can be deployed, as long as they have access to a common redis server,
  the synchronization will work transparently between them.
  
  This class is used mostly internally by the framework but its method can
  sometimes be called by the user when manual notification of changes is
  required.
    
  @class Sync.Hub
  @constructor
  @param pubClient {Redis} redis client to be used for publishing messages.
  @param subClient {Redis} redis client to be used for receiving messages.
  @param [sockets]
  @param [sio]
*/
export class Hub {
  private pubClient;
  
  constructor(pubClient, subClient?, sockets?, sio?)
  {    
    this.pubClient = pubClient;
    
    if(sockets){
      if(!sio){
        sio = sockets;
      }

      sio.on('connection', (socket) => {
        log("Socket %s connected in the Sync Module", socket.id);
        
        socket.on('observe', function(keyPath: string[], cb:(err?: Error) => void){
          
          log("Request to start observing:", keyPath);
          
          if(!Array.isArray(keyPath)){
            cb && cb(new TypeError("keyPath must be a string[]"));
          }else{
            var id = keyPath.join(':');
            
            if(this.check){
              if (this.check(socket.id, keyPath)){
                socket.join(id);
              }
            }else{
              log("Socket %s started synchronization for id:%s", socket.id, keyPath);
              socket.join(id);
            }
            cb();
          }
        });
    
        socket.on('unobserve', function(keyPath: string[], cb:(err?: Error) => void){
          var id = keyPath.join(':');
          socket.leave(id);
          log("Socket %s stopped synchronization for id:%s", socket.id, id);
          cb();
        });
        
        socket.emit('ready');
      });

      subClient.subscribe('update:');
      subClient.subscribe('delete:');
      subClient.subscribe('add:');
      subClient.subscribe('remove:');
      subClient.subscribe('insertBefore:');
      subClient.subscribe('deleteItem:');
      
      subClient.on('message', (channel, msg) => {
        var args = JSON.parse(msg);
        
        if(!_.isArray(args.keyPath)){
          log("Error: keyPath must be an array:", args.keyPath);
          return;
        }
        var id = args.keyPath.join(':');
        var clientId = args.clientId;
                
        //var room = sio.in(id).except(args.clientId);
        log("About to emit: ", channel, args);
        switch(channel)
        {
          case 'update:':
            sio.in(id).except(clientId).emit('update:', args.keyPath, args.doc);
            break;
          case 'delete:': 
            sio.in(id).except(clientId).emit('delete:', args.keyPath);
            break;
          case 'add:':
            sio.in(id).except(clientId).emit('add:', args.keyPath, args.itemsKeyPath, args.itemIds);
            break;
          case 'remove:':
            sio.in(id).except(clientId).emit('remove:', args.keyPath, args.itemsKeyPath, args.itemIds);
            break;
          case 'insertBefore:':
            sio.in(id).except(clientId).emit('insertBefore:', args.keyPath, args.id, args.itemKeyPath, args.refId);
            break;
          case 'deleteItem:':
            sio.in(id).except(clientId).emit('deleteItem:', args.keyPath, args.id);
            break;
        }
      });
    }
  }

  /**
    Sends an update notification to all relevant observers.
    
    @method update
    @param clientId {String} clientId performing the update (use null if not
      relevant)
    @param keyPath {KeyPath} key path pointing to the document that was updated.
    @param doc {Object} Plain object with the changed values for the given properties.
  */
  update(clientId: string, keyPath: string[], doc:{})
  {
    var args = {keyPath:keyPath, doc: doc, clientId: clientId};
    this.pubClient.publish('update:', JSON.stringify(args));
  }

  /**
    Sends a delete notification to all relevant observers.
    
    @method delete
    @param clientId {String} clientId performing the deletion (use null if not
      relevant)
    @param keyPath {KeyPath} key path pointing to the document that was deleted.
  */
  delete(clientId: string, keyPath: string[]){
    var args = {keyPath:keyPath, clientId: clientId};
    this.pubClient.publish('delete:', JSON.stringify(args));
  }

  /**
    Sends an add notification to all relevant observers.
    
    @method add
    @param clientId {String} clientId performing the addition (use null if not
      relevant)
    @param keyPath {KeyPath} key path pointing to the bucket where the collection resides.
    @param itemsKeyPath {KeyPath} key path to the bucket containing the added items.
    @param itemIds {Array} array of ids with the documents added to this collection.
  */
  add(clientId: string, keyPath: string[], itemsKeyPath: string[], itemIds: string[]){
    var args = {keyPath: keyPath, itemsKeyPath: itemsKeyPath, itemIds: itemIds, clientId: clientId};
    this.pubClient.publish('add:', JSON.stringify(args));
  }

  /**
    Sends a remove notification to all relevant observers.
    
    @method remove
    @param clientId {String} clientId performing the removal (use null if not
      relevant)
    @param keyPath {KeyPath} key path pointing to the bucket where the collection resides.
    @param itemsKeyPath {KeyPath} key path to the bucket containing the removed items.
    @param itemIds {Array} array of ids with the documents removed to this collection.
  */
  remove(clientId: string, keyPath: string[], itemsKeyPath: string[], itemIds: string[]){
    var args = {keyPath: keyPath, itemsKeyPath: itemsKeyPath, itemIds: itemIds, clientId: clientId};
    this.pubClient.publish('remove:', JSON.stringify(args));
  }
  
  /**
    Sends an insertBefore notification to all relevant observers.
    
    @method insertBefore
    @param clientId {String} clientId performing the insertion (use null if not
      relevant)
    @param keyPath {KeyPath} key path pointing to the bucket where the sequence resides.
    @param id {String} id of the document that was inserted.
    @param itemKeyPath {KeyPath} key path pointing to the bucket where the document resides.
    @param refId {String} reference id for where the document was inserted.
    @param doc {Object} Plain object with the changed values for the given properties.
  */
  insertBefore(clientId: string, keyPath: string[], id: string, itemKeyPath: string[], refId: string)
  {
    var args = {keyPath: keyPath, id: id, itemKeyPath: itemKeyPath, refId: refId, clientId: clientId};
    log('insertBefore-synchub', args);
    this.pubClient.publish('insertBefore:', JSON.stringify(args));
  }

  /**
    Sends an deleteItem notification to all relevant observers.
    
    @method deleteItem
    @param clientId {String} clientId performing the deletion (use null if not
      relevant)
    @param keyPath {KeyPath} key path pointing to the document that was deleted.
    @param doc {Object} Plain object with the changed values for the given properties.
  */
  deleteItem(clientId: string, keyPath: string[], id: string)
  {
    var args = {keyPath: keyPath, id: id, clientId: clientId};
    log('deleteItem-synchub', args);
    this.pubClient.publish('deleteItem:', JSON.stringify(args));
  }
}

}
