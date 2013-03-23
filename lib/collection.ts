/**
  Ground Web Framework (c) 2011-2013 Optimal Bits Sweden AB
  MIT Licensed.
*/
/**
  Collection Class
  
  This class represents a unordered collection of models.
  The collection supports persistent storage, offline and
  automatic client<->server synchronization.
  
  Events:
  
*/
/// <reference path="base.ts" />
/// <reference path="model.ts" />
/// <reference path="overload.ts" />
/// <reference path="container.ts" />

module Gnd {

export class Collection extends Container
{    
  // Even handlers
  private updateFn: (model: Model, args) => void;
  private deleteFn: (model: Model) => void;
  
  // Links
  private linkFn: (evt: string, item: Model, fields?: string[]) => void;
  private linkTarget: Collection;
    
  public sortByFn: () => number; //public sortByFn: string;
  public sortOrder: string = 'asc';
  public filterFn: (item: Model) => bool = null;
  public count: number = 0;
  
  // Prototypes for underscore imported methods.
  public filter: (iterator: (item: any)=>bool) => Model[];
  
  // TODO: Support for anonymous collections
  // constructor(items: {}[]) // i.e. new Collection(Model); add(new Model({..}))
  
  constructor(model: IModel, parent?: Model, items?: Model[])
  {
    super(model, parent, items);
    
    var _this = this;
    this.updateFn = function(args){
      if(_this.sortByFn){
        var index = _this['indexOf'](this);
        _this.items.splice(index, 1);
        _this.sortedAdd(<Model>this);
      }
      _this.emit('updated:', this, args);
    };
    
    this.deleteFn = (itemId)=>{
      this.remove(itemId, false, Util.noop);
    };

    this.on('sortByFn sortOrder', (fn) => {
      var oldItems = this.items;
      if(this.sortByFn){
        this.items = this['sortBy'](this.sortByFn)
      }
      (this.sortOrder == 'desc') && this.items.reverse();
      this.emit('sorted:', this.items, oldItems);
    });
    
    this.initItems(this.items);
  }
  
  destroy(){
    this.unlink();
    super.destroy();
  }
  
  static public create(model: IModel, parent: Model, items: Model[]): Collection;
  static public create(model: IModel, parent: Model, docs: {}[], cb: (err?: Error, collection?: Collection) => void);
  static public create(model: IModel, docs: {}[], cb: (err?: Error, collection?: Collection) => void);

  static public create(model?: IModel, parent?: Model, docs?: {}[], cb?): any
  {
    return overload({
      'Function Model Array': function(model, parent, models){
        var collection = new Collection(model, parent, models);
        Util.release(models);
        if(parent && parent.isKeptSynced()){
          collection.keepSynced()
        }
        collection.count = models.length;
        return collection;
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
  
  findById(id)
  {
    return this['find']((item) => {
      return item.id() == id
    });
  }
  
  add(items: Model[], opts?, cb?: (err)=>void): void
  {
    if(_.isFunction(opts)){
      cb = opts;
      opts = {};
    }
    Util.asyncForEach(items, (item, done) => {
      this.addItem(item, opts, (err) => {
        !err && this._keepSynced && !item.keepSynced && item.keepSynced();
        done(err);
      });
    }, cb || Util.noop);
  }

  remove(itemIds, opts, cb){
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
        
        if(!opts || !opts.nosync){
          var itemKeyPath = _.initial(item.getKeyPath());
          this.storageQueue.remove(keyPath, itemKeyPath, [item.id()], done);
          return;
        }
      }
      done();
    }, cb);
  }
  
  toggleSortOrder(){
    this['set']('sortOrder', this.sortOrder == 'asc' ? 'desc' : 'asc');
  }
  
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
  
  /*
    link
    
    Links the collection to target one, listening to added, removed and
    updated event. Besides that, when link is called the first time, it
    generated added events for all the items in the target collection.
    
    Note: a collection can only link to one target collection, although
    many collections can link to the same target.
  */
  link(target: Collection, 
       fn: (evt: string, item: Model, fields?: string[]) => void)
  {
    if(this.linkFn){
      this.unlink();
    }
    
    this.linkFn = fn;
    this.linkTarget = target;
    target
      .on('added:', (item)=>{
        fn('added:', item);
      })
      .on('removed:', (item)=>{
        fn('removed:', item);
      })
      .on('updated:', (item, fields)=>{
        fn('added:', item, fields);
      });
    target['each']((item)=>{
      fn('added:', item);
    });
  }
  
  unlink()
  {
    var fn = this.linkFn;
    if(fn){
      this.linkTarget.off('added:', fn).off('removed:', fn).off('updated:', fn);
      this.linkFn = null;
    }
  }
  
  private addPersistedItem(item: Model, cb:(err?: Error) => void): void
  {
    var keyPath = this.getKeyPath();
    var itemKeyPath = _.initial(item.getKeyPath());
    
    this.storageQueue.add(keyPath, itemKeyPath, [item.id()], cb);
  }

  private addItem(item, opts, cb)
  {
    if(this.findById(item.id())) return cb();
    
    if(this.sortByFn){
      this.sortedAdd(item);
    }else {
      this.items.push(item);
    }

    this.initItems(item);
    
    this.set('count', this.items.length);
    this.emit('added:', item);
    
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
  }
  
  // This function feel a bit hacky
  private sortedAdd(item: Model): number
  {    
    (this.sortOrder == 'desc') && this.items.reverse();
    var i = this['sortedIndex'](item, this.sortByFn);
    this.items.splice(i, 0, item);
    (this.sortOrder == 'desc') && this.items.reverse();
    return i;
  }
    
  private startSync()
  {
    super.startSync();
    /*
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
    */
    
    this.on('add:', (itemsKeyPath, itemIds) => {
      Util.asyncForEach(itemIds, (itemId: string, done) => {
        if(!this.findById(itemId)){
          this.model.findById(itemsKeyPath.concat(itemId), true, {}, (err: Error, item?: Model): void => {
            if(item){
              this.addItem(item, {nosync: true}, done);
            }
          });
        }
      }, Util.noop);
    });

    this.on('remove:', (itemsKeyPath, itemId) => {
      this.remove(itemId, true, Util.noop);
    });

    /*
    this.storageQueue.exec((err?)=>{
      this.storageQueue = using.storageQueue;
      this.listenToResync(using.storageQueue);
    });
    */
  }
  
  private resync(items: any[]){
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
  }
  
  private initItems(items)
  {  
    items = _.isArray(items)? items:[items];
    for (var i=0,len=items.length; i<len;i++){
      var item = items[i];
      item.retain();
      item.on('changed:', this.updateFn);
      item.on('deleted:', this.deleteFn);
    }
  }
  
  private deinitItems(items)
  {
    var key = Storage.Queue.makeKey(this.getKeyPath());
    this.storageQueue.off('resync:'+key, this.resyncFn);
    for (var i=0,len=items.length; i<len;i++){
      var item = items[i];
      item.off('changed:', this.updateFn);
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
  Collection.prototype[method] = function() {
    return _[method].apply(_, [this.items].concat(_.toArray(arguments)))
  }
});

}
