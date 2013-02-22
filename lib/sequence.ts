/**
  Ground Web Framework (c) 2011-2012 Optimal Bits Sweden AB
  MIT Licensed.
*/
/**
  Sequence Class
  
  This class represents a ordered collection of models.
  The sequence supports persistent storage, offline and
  automatic client<->server synchronization.
  
  Events:
  
*/
/// <reference path="base.ts" />
/// <reference path="model.ts" />
/// <reference path="overload.ts" />

module Gnd {

export class Sequence extends Base implements Sync.ISynchronizable
{
  public items: Model[]; //TODO: Should be a linked list
  
  private _keepSynced: bool = false;
  private _added: Model[] = [];
  private _insertedBefore: Model[] = [];
  private _removed: Model[] = [];
  private _formatters: any[];
  
  private updateFn: (model: Model, args) => void;
  private deleteFn: (model: Model) => void;
  private resyncFn: (items: any[]) => void;
  
  public model: IModel;
  public parent: Model;
  public sortByFn: () => number; //public sortByFn: string;
  public sortOrder: string = 'asc';
  public filterFn: (item: Model) => bool = null;
  public count: number = 0;
  
  // Prototypes for underscore imported methods.
  public filter: (iterator: (item: any)=>bool) => Model[];
  
  constructor(model: IModel, parent?: Model, items?: Model[])
  {
    super();
    
    var self = this;
    this.updateFn = function(args){
      // if(self.sortByFn){
      //   var index = self['indexOf'](this);
      //   self.items.splice(index, 1);
      //   self.sortedAdd(this);
      // }
      self.emit('updated:', this, args);
    };
  
    this.deleteFn = (itemId) => {
      //TODO: noremove
      // this.remove(itemId, false, Util.noop);
      throw Error('deleteFn not implemented');
    };
  
    this.items = items || [];
    this.initItems(this.items);

    this.model = model;
    this.parent = parent;
    
    this.on('sortByFn sortOrder', (fn) => {
      var oldItems = this.items;
      if(this.sortByFn){
        this.items = this['sortBy'](this.sortByFn)
      }
      (this.sortOrder == 'desc') && this.items.reverse();
      this.emit('sorted:', this.items, oldItems);
    });
    
    if(parent){
      if(parent.isPersisted()){
        this.listenToResync();
      }else{
        parent.once('id', ()=> {
          this.listenToResync()
        });
      }
    }else{
      this.listenToResync();
    }
  }
  
  destroy(){
    this._keepSynced && this.endSync();
    this.deinitItems(this.items);
    this.items = null;
    super.destroy();
  }
  
  static public create(model: IModel, parent: Model, items: Model[]): Sequence;
  static public create(model: IModel, parent: Model, docs: {}[], cb: (err?: Error, sequence?: Sequence) => void);
  static public create(model: IModel, docs: {}[], cb: (err?: Error, sequence?: Sequence) => void);

  static public create(model?: IModel, parent?: Model, docs?: {}[], cb?): any
  {
    return overload({
      'Function Model Array': function(model, parent, models){
        var sequence = new Sequence(model, parent, models);
        Util.release(models);
        if(parent && parent.isKeptSynced()){
          sequence.keepSynced()
        }
        sequence.count = models.length;
        return sequence;
      },
      'Function Model Array Function': function(model, parent, items, cb){
        model.createModels(items, (err?: Error, models?: Model[])=>{
          if(err){
            cb(err)
          }else{
            cb(err, this.create(model, parent, models));
          }
        });
      },
      'Function Array Function': function(model, items, cb){
        this.create(model, undefined, items, cb);
      },
      'Function Model Function': function(model, parent, cb){
        this.create(model, parent, [], cb);
      }
    }).apply(this, arguments);
  } 
  
  static private getItemIds(items: Model[])
  {
    return _.map(items, function(item){return item.id()});
  }
  
  private findById(id)
  {
    return this['find']((item) => {
      return item.id() == id
    });
  }
  
  save(cb: (err?: Error) => void): void
  {
    // var keyPath = this.getKeyPath();
    // var itemsKeyPath = [];
    // 
    // if(this._removed.length){
    //   itemsKeyPath = _.initial(this._removed[0].getKeyPath());
    // }else if(this._added.length){
    //   itemsKeyPath = _.initial(this._added[0].getKeyPath());
    // }
    // var itemIds = Collection.getItemIds(this._removed);
    // Model.storageQueue.remove(keyPath, itemsKeyPath, itemIds, (err?: Error) => {
    //   if(!err){
    //     this._removed = []
    //     Util.asyncForEach(this.items, (item, cb) => {
    //       item.save(cb);
    //     }, (err) => {
    //       if((!err)&&(this._added.length > 0)){
    //         itemIds = Collection.getItemIds(this._added);
    //         
    //         Model.storageQueue.add(keyPath, itemsKeyPath, itemIds, (err?: Error) => {
    //           if(!err){
    //             this._added = [];
    //           }
    //           cb(err);
    //         });
    //       }else{
    //         cb(err);
    //       }
    //     });
    //   }else{
    //     cb(err);
    //   }
    // })
  }

  first()
  {
    return _.first(this.items);
  }

  next(item)
  {
    var index = _.indexOf(this.items, item) + 1;
    if(index >= this.count) return null;
    return this.items[index]; //TODO: tombstones
  }

  prev(item)
  {
    var index = _.indexOf(this.items, item) - 1;
    if(index < 0) return null;
    return this.items[index]; //TODO: tombstones
  }

  last()
  {
    return _.last(this.items);
  }

  push(item: Model, opts?, cb?: (err)=>void): void
  {
    this.insertBefore(null, item, opts, cb);
  }

  unshift(item: Model, opts?, cb?: (err)=>void): void
  {
    var first = this.first();
    this.insertBefore(first, item, opts, cb);
  }

  insertBefore(refItem: Model, item: Model, opts?, cb?: (err)=>void): void
  {
    if(_.isFunction(opts)){
      cb = opts;
      opts = {};
    }
    cb = cb || Util.noop;

    this.insertItemBefore(refItem, item, opts, (err) => {
      !err && this._keepSynced && !item.isKeptSynced() && item.keepSynced();
      cb(null);
    });
  }
  
  getKeyPath(): string[]
  {
    if(this.parent) return [this.parent.bucket(), this.parent.id(), this.model.__bucket];
    return [this.model.__bucket];
  }

  keepSynced(): void
  {  
    this.startSync();
  
    this['map']((item) => {
      item.keepSynced()
    });
  }
  
  isKeptSynced(): bool
  {
    return this._keepSynced;
  }
  
  // setFormatters(formatters){
  //   this._formatters = formatters;
  //   this['each'](function(item){
  //     item.format(formatters);
  //   });
  // }

  filtered(result: (err: Error, models?: Model[])=>void)
  {
    if(this.filterFn){
      result(null, this.filter(this.filterFn));
    }else{
      result(null, this.items);
    }
  }
  
  isFiltered(item: Model): bool
  {
    return this.filterFn ? this.filterFn(item) : true;
  } 
  
  // private pushPersistedItem(item: Model, cb:(err?: Error) => void): void
  // {
  //   var keyPath = this.getKeyPath();
  //   var itemKeyPath = item.getKeyPath();
  //   
  //   Model.storageQueue.push(keyPath, itemKeyPath, {}, cb);
  // }

  private insertPersistedItemBefore(refItem: Model, item: Model, cb:(err?: Error) => void): void
  {
    var keyPath = this.getKeyPath();
    var refItemKeyPath = refItem ? refItem.getKeyPath() : null;
    var itemKeyPath = item.getKeyPath();
    
    Model.storageQueue.insertBefore(keyPath, refItemKeyPath, itemKeyPath, {}, cb);
  }

  private insertItemBefore(refItem, item, opts, cb)
  {
    if(refItem){
      var index = _.indexOf(this.items, refItem);
      this.items.splice(index, 0, item);
    }else{
      this.items.push(item);
    }
    this.initItems(item);
    
    this.set('count', this.items.length);
    this.emit('insertedBefore:', item); //TODO: we probably need more args
    
    if(this.isKeptSynced()){
      if(!opts || (opts.nosync !== true)){
        if(item.isPersisted()){
          this.insertPersistedItemBefore(refItem, item, cb);
        }else{
          item.save((err) => {
            if(!err){
              this.insertPersistedItemBefore(refItem, item, Util.noop);
            }
            cb(err);
            //TODO: Why callback here?
          });
        }
      }else{
        cb();
      }
    }else{
      this._insertedBefore.push(item); //TODO: We probably need more items
      cb();
    }
  }

  // private pushItem(item, opts, cb)
  // {
  //   this.items.push(item); //TODO update next, prev...

  //   this.initItems(item);
  //   
  //   this.set('count', this.items.length);
  //   this.emit('pushed:', item);
  //   
  //   if(this.isKeptSynced()){
  //     if(!opts || (opts.nosync !== true)){
  //       if(item.isPersisted()){
  //         this.pushPersistedItem(item, cb);
  //       }else{
  //         item.save((err) => {
  //           if(!err){
  //             this.pushPersistedItem(item, Util.noop);
  //           }
  //           cb(err);
  //         });
  //       }
  //     }else{
  //       cb();
  //     }
  //   }else{
  //     this._added.push(item); //TODO: _pushed?
  //     cb();
  //   }
  // }
  
  //TODO: noadd
  // This function feel a bit hacky
  // private sortedAdd(item: Model): number
  // {    
  //   (this.sortOrder == 'desc') && this.items.reverse();
  //   var i = this['sortedIndex'](item, this.sortByFn);
  //   this.items.splice(i, 0, item);
  //   (this.sortOrder == 'desc') && this.items.reverse();
  //   return i;
  // }
    
  private startSync()
  {
    this._keepSynced = true;
    
    if(this.parent && Model.syncManager){
      if(this.parent.isPersisted()){
        Model.syncManager.startSync(this);
      }else{
        this.parent.on('id', () => {
          Model.syncManager.startSync(this);
        });
      }
    }
    

    //TODO: noadd
    this.on('remove:', (itemsKeyPath, itemId) => {
        //TODO: fix
        throw Error('remove on seq not possible');
      // this.remove(itemId, true, Util.noop);
    });

  //   this.on('push:', (itemsKeyPath, itemId) => {
  //     console.log('--push');
  //     console.log(itemId);
  //     if(!this.findById(itemId)){
  //       this.model.findById(itemsKeyPath.concat(itemId), true, {}, (err: Error, item?: Model): void => {
  //         if(item){
  //           this.pushItem(item, {nosync: true}, Util.noop);
  //         }
  //       });
  //     }
  //   });

  }

  private addPersistedItem(item: Model, cb:(err?: Error) => void): void
  {
    var keyPath = this.getKeyPath();
    var itemKeyPath = _.initial(item.getKeyPath());
    
    Model.storageQueue.add(keyPath, itemKeyPath, [item.id()], cb);
  }
  private addItem(item, opts, cb)
  {
    if(this.findById(item.id())) return cb();
    
    if(this.sortByFn){
      // this.sortedAdd(item);
    }else {
      this.items.push(item);
    }

    this.initItems(item);
    
    this.set('count', this.items.length);
    this.emit('added:', item);
    
    if(this.isKeptSynced()){
      if(!opts || (opts.nosync !== true)){
        if(item.isPersisted()){
          this.addPersistedItem(item, cb);
        }else{
          item.save((err) => {
            if(!err){
              this.addPersistedItem(item, Util.noop);
            }
            cb(err);
          });
        }
      }else{
        cb();
      }
    }else{
      this._added.push(item);
      cb();
    }
  }
  private add(items: Model[], opts?, cb?: (err)=>void): void
  {
    if(_.isFunction(opts)){
      cb = opts;
      opts = {};
    }
    Util.asyncForEach(items, (item, done) => {
      this.addItem(item, opts, (err) => {
        !err && this._keepSynced && !item._keepSynced && item.keepSynced();
        done(err);
      });
    }, cb || Util.noop);
  }

  private remove(itemIds, opts, cb){
    var 
      items = this.items,
      keyPath = this.getKeyPath();
    
    if(_.isFunction(opts)){
      cb = opts;
      opts = {};
    }
    
    Util.asyncForEach(itemIds, (itemId, done) => {
      var index, item, len = items.length;
      for(index=0; index<len; index++){
        if(items[index].id() == itemId){
          item = items[index];
          break;
        }
      }
  
      if(item){
        items.splice(index, 1);
        
        item.off('changed:', this.updateFn);
        item.off('deleted:', this.deleteFn);
        
        this.set('count', items.length);
        this.emit('removed:', item, index);
        item.release();
        
        if(this.isKeptSynced() && (!opts || !opts.nosync)){
          var itemKeyPath = _.initial(item.getKeyPath());
          Model.storageQueue.remove(keyPath, itemKeyPath, [item.id()], done);
          return;
        }else{
          this._removed.push(itemId);
        }
      }
      done();
    }, cb);
  }
  
  private resync(keyPaths: any[]){
    
    var items = [];
    Util.asyncForEach(keyPaths, (keyPath, fn)=>{
      Model.storageQueue.fetch(keyPath, (err, item)=>{

        items.push(item);
        fn(err);
      });
    }, (err) => {

    // throw Error('fix me');
    // this.items = items.slice(0);
    // this.set('count', this.items.length);
    // this.emit('resynced:');
    var 
      itemsToRemove = [],
      itemsToAdd = items.slice(0);
      
    this['each'](function(item){
      var id = item.id(), shouldRemove = true;
      for(var i=0; i<items.length; i++){
        if(id == items[i]._id){
          item.set(items[i], {nosync: true});
          shouldRemove = false;
          break;
        }
      }
      shouldRemove && itemsToRemove.push(id);
    });
    
    // throw Error('this.remove not impl');
    this.remove(itemsToRemove, {nosync: true}, (err) => {
      if(!err){
        //TODO: Is there a better way?
        (<any>this.model).createModels(itemsToAdd, (err, models) => {
          if(!err){
            this.add(models, {nosync: true}, (err) => {
              this.emit('resynced:');
            });
          }
        });
      }
    });
    });
  }
  
  private listenToResync(){
    var key = Storage.Queue.makeKey(this.getKeyPath());
    this.resyncFn = (items) => {
      this.resync(items);
    }
    Model.storageQueue &&
    Model.storageQueue.on('resync:'+key, this.resyncFn);
  }
  
  private endSync()
  {
    Model.syncManager && Model.syncManager.endSync(this);
    this._keepSynced = false;
  }
  
  private initItems(items)
  {  
    items = _.isArray(items)? items:[items];
    for (var i=0,len=items.length; i<len;i++){
      var item = items[i];
      item.retain();
      item.on('changed:', this.updateFn);
      //TODO: nodelete
      item.on('deleted:', this.deleteFn);
    }
  }
  
  private deinitItems(items)
  {
    var key = Storage.Queue.makeKey(this.getKeyPath());
    Model.storageQueue &&
    Model.storageQueue.off('resync:'+key, this.resyncFn);
    for (var i=0,len=items.length; i<len;i++){
      var item = items[i];
      item.off('changed:', this.updateFn);
      //TODO: nodelete
      item.off('deleted:', this.deleteFn);
      item.release();
    }
  }
}

//
// Underscore methods that we want to implement on the Collection.
//
var methods = 
  ['forEach', 'each', 'map', 'reduce', 'reduceRight', 'find', 'detect', 'pluck',
    'filter', 'select', 'reject', 'every', 'all', 'some', 'any', 'include',
    'contains', 'invoke', 'max', 'min', 'sortBy', 'sortedIndex', 'toArray', 'size',
    'first', 'rest', 'last', 'without', 'indexOf', 'lastIndexOf', 'isEmpty', 'groupBy']

// Mix in each Underscore method as a proxy to `Collection#items`.
_.each(methods, function(method) {
  Sequence.prototype[method] = function() {
    return _[method].apply(_, [this.items].concat(_.toArray(arguments)))
  }
});

}
